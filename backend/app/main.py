from contextlib import asynccontextmanager
from datetime import datetime, timezone
from io import BytesIO
from typing import Annotated, Type
from uuid import uuid4
import warnings

import qrcode
from PIL import Image, ImageOps, UnidentifiedImageError
from pillow_heif import register_heif_opener
from pydantic import ValidationError, create_model
from fastapi import Depends, FastAPI, File, HTTPException, Query, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app import models, schemas
from app.database import SessionLocal, get_db
from app.security import ALGORITHM, create_access_token, hash_password, verify_password
from app.settings import settings

@asynccontextmanager
async def lifespan(app: FastAPI):
    initialize_admin()
    yield


app = FastAPI(title="ForgeQuality API", version="1.0.0", description="Manufacturing quality and production monitoring API", lifespan=lifespan)
register_heif_opener()
app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in settings.cors_origins.split(",")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
bearer = HTTPBearer(auto_error=False)
MAX_DEFECT_IMAGE_BYTES = 10 * 1024 * 1024
MAX_DEFECT_UPLOAD_BYTES = 40 * 1024 * 1024
MAX_DEFECT_IMAGES = 10
RESOURCE_MAP: dict[str, tuple[Type, Type[schemas.BaseModel]]] = {
    "production": (models.ProductionRecord, schemas.ProductionCreate),
    "defects": (models.Defect, schemas.DefectCreate),
    "inspections": (models.Inspection, schemas.InspectionCreate),
    "equipment": (models.Equipment, schemas.EquipmentCreate),
    "issues": (models.EquipmentIssue, schemas.IssueCreate),
    "downtime": (models.DowntimeEvent, schemas.DowntimeCreate),
    "maintenance": (models.MaintenanceWorkOrder, schemas.MaintenanceCreate),
}


def current_user(credentials: HTTPAuthorizationCredentials | None = Depends(bearer), db: Session = Depends(get_db)):
    if credentials is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Authentication required", headers={"WWW-Authenticate": "Bearer"})
    try:
        payload = jwt.decode(credentials.credentials, settings.secret_key, algorithms=[ALGORITHM])
        username = payload.get("sub")
    except JWTError as exc:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid or expired token") from exc
    user = db.scalar(select(models.User).where(models.User.username == username, models.User.active.is_(True)))
    if user is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "User account is unavailable")
    return user


def require_roles(*roles: str):
    def check(user=Depends(current_user)):
        if user.role not in roles:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Insufficient permissions")
        return user
    return check


def initialize_admin():
    if len(settings.secret_key) < 32 or "replace-with" in settings.secret_key.lower():
        raise RuntimeError("Set SECRET_KEY to at least 32 non-placeholder characters")
    with SessionLocal() as db:
        has_users = db.scalar(select(models.User.id).limit(1)) is not None
        if has_users:
            return
        if not settings.initial_admin_username or not settings.initial_admin_password:
            raise RuntimeError("Set INITIAL_ADMIN_USERNAME and INITIAL_ADMIN_PASSWORD to create the first administrator")
        if len(settings.initial_admin_password) < 12:
            raise RuntimeError("INITIAL_ADMIN_PASSWORD must contain at least 12 characters")
        if len(settings.initial_admin_password.encode("utf-8")) > 72:
            raise RuntimeError("INITIAL_ADMIN_PASSWORD must be at most 72 UTF-8 bytes")
        if "replace-with" in settings.initial_admin_password.lower():
            raise RuntimeError("Replace the INITIAL_ADMIN_PASSWORD example value before deployment")
        db.add(models.User(username=settings.initial_admin_username,
                           password_hash=hash_password(settings.initial_admin_password), role="admin"))
        try:
            db.commit()
        except Exception:
            db.rollback()
            raise


@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.post("/api/auth/login", response_model=schemas.TokenResponse)
def login(payload: schemas.LoginRequest, db: Session = Depends(get_db)):
    user = db.scalar(select(models.User).where(models.User.username == payload.username, models.User.active.is_(True)))
    if user is None or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Incorrect username or password")
    return {"access_token": create_access_token(user.username, user.role), "username": user.username, "role": user.role}


@app.post("/api/auth/users", status_code=201)
def create_user(payload: schemas.UserCreate, db: Session = Depends(get_db), _admin=Depends(require_roles("admin"))):
    if db.scalar(select(models.User.id).where(models.User.username == payload.username)) is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, "Username already exists")
    user = models.User(username=payload.username, password_hash=hash_password(payload.password), role=payload.role)
    db.add(user)
    db.commit()
    db.refresh(user)
    return {"id": user.id, "username": user.username, "role": user.role}


@app.get("/api/auth/me")
def who_am_i(user=Depends(current_user)):
    return {"username": user.username, "role": user.role}


@app.get("/api/dashboard")
def dashboard(db: Session = Depends(get_db), _user=Depends(current_user)):
    production = db.scalars(select(models.ProductionRecord)).all()
    defects = db.scalars(select(models.Defect)).all()
    inspections = db.scalars(select(models.Inspection)).all()
    equipment = db.scalars(select(models.Equipment)).all()
    downtime = db.scalars(select(models.DowntimeEvent)).all()
    open_issues = db.scalar(select(func.count()).select_from(models.EquipmentIssue).where(models.EquipmentIssue.status != "Resolved")) or 0
    open_maintenance = db.scalar(select(func.count()).select_from(models.MaintenanceWorkOrder).where(models.MaintenanceWorkOrder.status != "Completed")) or 0
    total_units = sum(row.actual_quantity for row in production)
    total_good = sum(row.good_quantity for row in production)
    total_defects = sum(row.quantity_defective for row in defects)
    inspected = len(inspections)
    passed = sum(1 for row in inspections if row.result == "Pass")
    all_hours = downtime_hours(downtime)
    unplanned_hours = downtime_hours([row for row in downtime if not row.planned])
    closed_issues = [row for row in db.scalars(select(models.EquipmentIssue).where(models.EquipmentIssue.resolved_at.is_not(None))).all()
                     if elapsed_seconds(row.reported_at, row.resolved_at) >= 0]
    mttr_hours = round(sum(elapsed_seconds(row.reported_at, row.resolved_at) for row in closed_issues) / len(closed_issues) / 3600, 1) if closed_issues else None
    return {
        "total_production": total_units,
        "good_units": total_good,
        "defective_units": total_defects,
        "awaiting_inspection": sum(row.awaiting_inspection for row in production),
        "yield_percent": round(total_good / total_units * 100, 1) if total_units else 0,
        "defect_rate": round(total_defects / sum(row.quantity_inspected for row in defects) * 100, 2) if sum(row.quantity_inspected for row in defects) else 0,
        "inspection_pass_rate": round(passed / inspected * 100, 1) if inspected else 0,
        "equipment_operational": sum(1 for row in equipment if row.status == "Operational"),
        "equipment_total": len(equipment),
        "open_issues": open_issues,
        "maintenance_backlog": open_maintenance,
        "downtime_hours": round(all_hours, 1),
        "unplanned_downtime_hours": round(unplanned_hours, 1),
        "mttr_hours": mttr_hours,
        "mttr_completed_repairs": len(closed_issues),
        "recent_defects": [serialize(row) for row in sorted(defects, key=lambda item: make_aware(item.detected_at), reverse=True)[:5]],
        "production_by_line": production_by_line(production),
    }


def make_aware(dt: datetime | None) -> datetime:
    if dt is None:
        return datetime.min.replace(tzinfo=timezone.utc)
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt


def production_by_line(records):
    summary = {}
    for row in records:
        item = summary.setdefault(row.line, {"line": row.line, "produced": 0, "target": 0, "defects": 0})
        item["produced"] += row.actual_quantity
        item["target"] += row.target_quantity
        item["defects"] += row.defective_quantity
    return list(summary.values())


def elapsed_seconds(start: datetime, end: datetime | None) -> float:
    if end is None:
        return 0
    if start.tzinfo is None:
        start = start.replace(tzinfo=timezone.utc)
    if end.tzinfo is None:
        end = end.replace(tzinfo=timezone.utc)
    return (end - start).total_seconds()


def downtime_hours(events) -> float:
    intervals: dict[int, list[tuple[datetime, datetime]]] = {}
    now = datetime.now(timezone.utc)
    for event in events:
        start = event.started_at
        end = event.ended_at or now
        if start.tzinfo is None:
            start = start.replace(tzinfo=timezone.utc)
        if end.tzinfo is None:
            end = end.replace(tzinfo=timezone.utc)
        if end > start:
            intervals.setdefault(event.equipment_id, []).append((start, end))
    total_seconds = 0
    for asset_intervals in intervals.values():
        asset_intervals.sort(key=lambda interval: interval[0])
        start, end = asset_intervals[0]
        for next_start, next_end in asset_intervals[1:]:
            if next_start <= end:
                end = max(end, next_end)
            else:
                total_seconds += (end - start).total_seconds()
                start, end = next_start, next_end
        total_seconds += (end - start).total_seconds()
    return total_seconds / 3600


def serialize(row):
    return {column.name: getattr(row, column.name) for column in row.__table__.columns}


@app.post("/api/defects/{defect_id}/images", status_code=201)
async def upload_defect_images(
    defect_id: int,
    files: list[UploadFile] = File(...),
    db: Session = Depends(get_db),
    _user=Depends(current_user),
):
    defect = db.get(models.Defect, defect_id)
    if defect is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Defect not found")
    if not files or len(files) > MAX_DEFECT_IMAGES:
        raise HTTPException(status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, f"Upload between 1 and {MAX_DEFECT_IMAGES} photos at a time")

    current_count = db.scalar(
        select(func.count()).select_from(models.DefectImage).where(models.DefectImage.defect_id == defect_id)
    ) or 0
    if current_count + len(files) > MAX_DEFECT_IMAGES:
        raise HTTPException(status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, f"A defect report can have at most {MAX_DEFECT_IMAGES} photos")

    pending_images = []
    total_bytes = 0
    for upload in files:
        original_name = (upload.filename or "defect-photo").replace("\\", "/").rsplit("/", 1)[-1].strip()
        if not original_name or len(original_name) > 255:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Photo filename is empty or too long")
        if not upload.content_type or not upload.content_type.lower().startswith("image/"):
            raise HTTPException(status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, f"{original_name} is not an image")

        content = await upload.read(MAX_DEFECT_IMAGE_BYTES + 1)
        if len(content) > MAX_DEFECT_IMAGE_BYTES:
            raise HTTPException(status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, f"{original_name} exceeds the 10 MB per-photo limit")
        total_bytes += len(content)
        if total_bytes > MAX_DEFECT_UPLOAD_BYTES:
            raise HTTPException(status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, "Total photo upload size exceeds the 40 MB limit")
        try:
            with warnings.catch_warnings():
                warnings.simplefilter("error", Image.DecompressionBombWarning)
                with Image.open(BytesIO(content)) as image:
                    image.verify()
                    detected_type = Image.MIME.get(image.format or "")
        except (UnidentifiedImageError, OSError, ValueError, Image.DecompressionBombError, Image.DecompressionBombWarning) as exc:
            raise HTTPException(status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, f"{original_name} is not a supported, valid photo") from exc
        if not detected_type:
            raise HTTPException(status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, f"{original_name} uses an unsupported image format")
        try:
            with warnings.catch_warnings():
                warnings.simplefilter("error", Image.DecompressionBombWarning)
                with Image.open(BytesIO(content)) as image:
                    image = ImageOps.exif_transpose(image)
                    image.thumbnail((960, 960))
                    if image.mode not in ("RGB", "L"):
                        image = image.convert("RGB")
                    preview = BytesIO()
                    image.save(preview, format="JPEG", quality=82, optimize=True)
        except (UnidentifiedImageError, OSError, ValueError, Image.DecompressionBombError, Image.DecompressionBombWarning) as exc:
            raise HTTPException(status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, f"{original_name} could not be previewed") from exc
        pending_images.append(models.DefectImage(
            defect_id=defect_id,
            file_name=original_name,
            media_type=detected_type,
            file_size=len(content),
            image_data=content,
            preview_data=preview.getvalue(),
        ))

    db.add_all(pending_images)
    try:
        db.commit()
    except Exception:
        db.rollback()
        raise
    for image in pending_images:
        db.refresh(image)
    return [{"id": image.id, "defect_id": image.defect_id, "file_name": image.file_name,
             "media_type": image.media_type, "file_size": image.file_size, "uploaded_at": image.uploaded_at}
            for image in pending_images]


@app.get("/api/defects/{defect_id}/images")
def list_defect_images(defect_id: int, db: Session = Depends(get_db), _user=Depends(current_user)):
    if db.get(models.Defect, defect_id) is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Defect not found")
    images = db.scalars(select(models.DefectImage).where(
        models.DefectImage.defect_id == defect_id).order_by(models.DefectImage.id)).all()
    return [{"id": image.id, "defect_id": image.defect_id, "file_name": image.file_name,
             "media_type": image.media_type, "file_size": image.file_size, "uploaded_at": image.uploaded_at}
            for image in images]


@app.get("/api/defect-images/{image_id}")
def get_defect_image(image_id: int, db: Session = Depends(get_db), _user=Depends(current_user)):
    image = db.get(models.DefectImage, image_id)
    if image is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Defect photo not found")
    return StreamingResponse(BytesIO(image.image_data), media_type=image.media_type,
                             headers={"X-Content-Type-Options": "nosniff", "Cache-Control": "private, no-store"})


@app.get("/api/defect-images/{image_id}/preview")
def get_defect_image_preview(image_id: int, db: Session = Depends(get_db), _user=Depends(current_user)):
    image = db.get(models.DefectImage, image_id)
    if image is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Defect photo not found")
    return StreamingResponse(BytesIO(image.preview_data), media_type="image/jpeg",
                             headers={"X-Content-Type-Options": "nosniff", "Cache-Control": "private, no-store"})


@app.get("/api/reports/summary")
def reports_summary(db: Session = Depends(get_db), _user=Depends(current_user)):
    defects = db.scalars(select(models.Defect)).all()
    downtime = db.scalars(select(models.DowntimeEvent)).all()
    maintenance = db.scalars(select(models.MaintenanceWorkOrder)).all()
    by_category = {}
    for defect in defects:
        by_category[defect.category] = by_category.get(defect.category, 0) + defect.quantity_defective
    duration = downtime_hours(downtime) * 3600
    now = datetime.now(timezone.utc)
    return {"defects_by_category": [{"category": key, "count": count} for key, count in by_category.items()],
            "downtime_hours": round(duration / 3600, 2), "defect_count": len(defects),
            "overdue_investigations": sum(1 for item in defects if item.status != "Closed" and item.due_date and item.due_date < now.date().isoformat()),
            "overdue_maintenance": sum(1 for item in maintenance if item.status != "Completed" and item.due_date and item.due_date < now.date().isoformat())}


@app.get("/api/{resource}")
def list_records(resource: str, search: str = Query(default="", max_length=100), db: Session = Depends(get_db), _user=Depends(current_user)):
    if resource not in RESOURCE_MAP:
        raise HTTPException(404, "Resource not found")
    model, _schema = RESOURCE_MAP[resource]
    query = select(model).order_by(model.id.desc()).limit(250)
    if search:
        searchable = [column for column in model.__table__.columns if isinstance(column.type, (models.String, models.Text))]
        if searchable:
            from sqlalchemy import or_
            query = query.where(or_(*(column.ilike(f"%{search}%") for column in searchable)))
    records = db.scalars(query).all()
    image_counts = {}
    if resource == "defects" and records:
        image_counts = dict(db.execute(
            select(models.DefectImage.defect_id, func.count(models.DefectImage.id))
            .where(models.DefectImage.defect_id.in_([row.id for row in records]))
            .group_by(models.DefectImage.defect_id)
        ).all())
    result = []
    for row in records:
        item = serialize(row)
        if resource == "defects":
            item["image_count"] = image_counts.get(row.id, 0)
        result.append(item)
    return result


@app.post("/api/{resource}", status_code=201)
def create_record(resource: str, payload: dict, db: Session = Depends(get_db), user=Depends(current_user)):
    if resource not in RESOURCE_MAP:
        raise HTTPException(404, "Resource not found")
    model, schema = RESOURCE_MAP[resource]
    allowed_roles = {
        "production": {"admin", "supervisor", "operator"},
        "defects": {"admin", "supervisor", "quality_engineer", "operator"},
        "inspections": {"admin", "supervisor", "quality_engineer", "operator"},
        "equipment": {"admin", "maintenance"},
        "issues": {"admin", "supervisor", "maintenance", "operator"},
        "downtime": {"admin", "supervisor", "maintenance"},
        "maintenance": {"admin", "supervisor", "maintenance"},
    }
    if user.role not in allowed_roles[resource]:
        raise HTTPException(403, "Your role cannot create this record")
    try:
        valid = schema.model_validate(payload)
    except ValidationError as exc:
        raise HTTPException(422, exc.errors(include_url=False, include_context=False)) from exc
    fields = valid.model_dump(exclude_unset=True)
    if resource == "inspections":
        fields["result"] = "Pass" if fields["lower_limit"] <= fields["measured_value"] <= fields["upper_limit"] else "Fail"
    if resource == "defects":
        fields["defect_number"] = f"NC-{datetime.now(timezone.utc):%y%m%d}-{uuid4().hex[:8].upper()}"
    if resource == "production" and fields.get("production_date") is None:
        fields.pop("production_date", None)
    if resource == "downtime" and fields.get("started_at") is None:
        fields["started_at"] = datetime.now(timezone.utc)
    record = model(**fields)
    db.add(record)
    try:
        db.flush()
        if resource == "issues" and record.machine_state == "Stopped":
            equipment = db.get(models.Equipment, record.equipment_id)
            db.add(models.DowntimeEvent(equipment_id=record.equipment_id, issue_id=record.id, reason="Equipment issue",
                                        explanation=record.problem, line=equipment.line if equipment else "",
                                        started_at=record.reported_at))
            if equipment:
                equipment.status = "Down"
        db.commit()
    except Exception as exc:
        db.rollback()
        raise HTTPException(422, "Record could not be saved; verify linked IDs and unique identifiers") from exc
    db.refresh(record)
    return serialize(record)


def update_equipment_status(db: Session, equipment_id: int):
    equipment = db.get(models.Equipment, equipment_id)
    if equipment is None:
        return
    db.flush()
    active_downtime = db.scalar(select(models.DowntimeEvent.id).where(
        models.DowntimeEvent.equipment_id == equipment_id, models.DowntimeEvent.ended_at.is_(None)).limit(1))
    if active_downtime is None:
        equipment.status = "Operational"


@app.patch("/api/{resource}/{record_id}")
def update_record(resource: str, record_id: int, payload: dict, db: Session = Depends(get_db), user=Depends(current_user)):
    if resource not in RESOURCE_MAP:
        raise HTTPException(404, "Resource not found")
    model, schema = RESOURCE_MAP[resource]
    allowed_roles = {
        "production": {"admin", "supervisor"},
        "defects": {"admin", "supervisor", "quality_engineer"},
        "inspections": {"admin", "supervisor", "quality_engineer"},
        "equipment": {"admin", "maintenance"},
        "issues": {"admin", "supervisor", "maintenance"},
        "downtime": {"admin", "supervisor", "maintenance"},
        "maintenance": {"admin", "supervisor", "maintenance"},
    }
    if user.role not in allowed_roles[resource]:
        raise HTTPException(403, "Your role cannot update this record")
    record = db.get(model, record_id)
    if record is None:
        raise HTTPException(404, "Record not found")
    allowed = set(schema.model_fields) - {"result"}
    if resource == "downtime" and payload.get("status") == "Completed":
        if record.ended_at is None:
            record.ended_at = datetime.now(timezone.utc)
            update_equipment_status(db, record.equipment_id)
        db.commit()
        db.refresh(record)
        return serialize(record)
    if resource == "issues" and payload.get("status") == "Resolved":
        allowed.add("status")
    patch_fields = {}
    for field_name, field in schema.model_fields.items():
        if field_name not in allowed:
            continue
        annotation = field.annotation | None
        if field.metadata:
            patch_fields[field_name] = (Annotated[annotation, *field.metadata], None)
        else:
            patch_fields[field_name] = (annotation, None)
    if "status" in allowed and "status" not in patch_fields:
        patch_fields["status"] = (str | None, None)
    patch_schema = create_model(
        f"{schema.__name__}Patch",
        __base__=schemas.InputSchema,
        **patch_fields,
    )
    try:
        updates = patch_schema.model_validate(payload).model_dump(exclude_unset=True, exclude_none=True)
    except ValidationError as exc:
        raise HTTPException(422, exc.errors(include_url=False, include_context=False)) from exc
    if resource == "issues" and updates.get("status") == "Resolved":
        record.resolved_at = datetime.now(timezone.utc)
        related_events = db.scalars(select(models.DowntimeEvent).where(
            models.DowntimeEvent.issue_id == record.id, models.DowntimeEvent.ended_at.is_(None))).all()
        for event in related_events:
            event.ended_at = record.resolved_at
        update_equipment_status(db, record.equipment_id)
    for key, value in updates.items():
        setattr(record, key, value)
    db.commit()
    db.refresh(record)
    return serialize(record)


@app.post("/api/inspections/{inspection_id}/create-defect", status_code=201)
def create_defect_from_inspection(inspection_id: int, db: Session = Depends(get_db), user=Depends(current_user)):
    inspection = db.get(models.Inspection, inspection_id)
    if inspection is None:
        raise HTTPException(404, "Inspection not found")
    if inspection.result != "Fail":
        raise HTTPException(409, "Only failed inspections can create a defect")
    existing = db.scalar(select(models.Defect).where(models.Defect.inspection_id == inspection.id))
    if existing is not None:
        return serialize(existing)
    defect = models.Defect(defect_number=f"NC-{datetime.now(timezone.utc):%y%m%d}-{uuid4().hex[:8].upper()}",
                           product=inspection.product, batch=inspection.batch, category=inspection.characteristic,
                           description=f"Failed inspection: measured {inspection.measured_value}; acceptable range {inspection.lower_limit}–{inspection.upper_limit}",
                           quantity_inspected=1, quantity_defective=1, source="Quality inspection",
                           reported_by=user.username, inspection_id=inspection.id)
    db.add(defect)
    db.commit()
    db.refresh(defect)
    return serialize(defect)


@app.get("/api/equipment/{equipment_id}/qr")
def equipment_qr(equipment_id: int, db: Session = Depends(get_db), _user=Depends(current_user)):
    equipment = db.get(models.Equipment, equipment_id)
    if equipment is None:
        raise HTTPException(404, "Equipment not found")
    image = qrcode.make(f"{settings.frontend_url.rstrip('/')}/?equipment={equipment.id}")
    output = BytesIO()
    image.save(output, format="PNG")
    output.seek(0)
    return StreamingResponse(output, media_type="image/png")


@app.get("/api/equipment/{equipment_id}/history")
def equipment_history(equipment_id: int, db: Session = Depends(get_db), _user=Depends(current_user)):
    if db.get(models.Equipment, equipment_id) is None:
        raise HTTPException(404, "Equipment not found")
    return {
        "issues": [serialize(row) for row in db.scalars(select(models.EquipmentIssue).where(models.EquipmentIssue.equipment_id == equipment_id).order_by(models.EquipmentIssue.id.desc())).all()],
        "downtime": [serialize(row) for row in db.scalars(select(models.DowntimeEvent).where(models.DowntimeEvent.equipment_id == equipment_id).order_by(models.DowntimeEvent.id.desc())).all()],
        "maintenance": [serialize(row) for row in db.scalars(select(models.MaintenanceWorkOrder).where(models.MaintenanceWorkOrder.equipment_id == equipment_id).order_by(models.MaintenanceWorkOrder.id.desc())).all()],
    }
