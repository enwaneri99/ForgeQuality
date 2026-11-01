from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, LargeBinary, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(primary_key=True)
    username: Mapped[str] = mapped_column(String(80), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    role: Mapped[str] = mapped_column(String(30), default="operator")
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc)


class ProductionRecord(Base):
    __tablename__ = "production_records"
    id: Mapped[int] = mapped_column(primary_key=True)
    order_number: Mapped[str] = mapped_column(String(80), index=True)
    product: Mapped[str] = mapped_column(String(120))
    batch: Mapped[str] = mapped_column(String(80), index=True)
    line: Mapped[str] = mapped_column(String(80), index=True)
    workstation: Mapped[str] = mapped_column(String(80), default="")
    equipment_id: Mapped[str] = mapped_column(String(80), default="")
    shift: Mapped[str] = mapped_column(String(40), default="Day")
    operator: Mapped[str] = mapped_column(String(100), default="")
    supervisor: Mapped[str] = mapped_column(String(100), default="")
    target_quantity: Mapped[int] = mapped_column(Integer, default=0)
    actual_quantity: Mapped[int] = mapped_column(Integer, default=0)
    good_quantity: Mapped[int] = mapped_column(Integer, default=0)
    defective_quantity: Mapped[int] = mapped_column(Integer, default=0)
    awaiting_inspection: Mapped[int] = mapped_column(Integer, default=0)
    status: Mapped[str] = mapped_column(String(30), default="In progress")
    production_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    ended_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    rework_quantity: Mapped[int] = mapped_column(Integer, default=0)
    scrap_quantity: Mapped[int] = mapped_column(Integer, default=0)
    rejected_quantity: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc)


class Defect(Base):
    __tablename__ = "defects"
    id: Mapped[int] = mapped_column(primary_key=True)
    inspection_id: Mapped[int | None] = mapped_column(ForeignKey("inspections.id"), unique=True, nullable=True)
    defect_number: Mapped[str] = mapped_column(String(40), unique=True, index=True)
    product: Mapped[str] = mapped_column(String(120))
    component: Mapped[str] = mapped_column(String(120), default="")
    supplier: Mapped[str] = mapped_column(String(120), default="")
    batch: Mapped[str] = mapped_column(String(80), index=True)
    line: Mapped[str] = mapped_column(String(80), default="")
    workstation: Mapped[str] = mapped_column(String(80), default="")
    equipment_id: Mapped[str] = mapped_column(String(80), default="")
    category: Mapped[str] = mapped_column(String(80), index=True)
    description: Mapped[str] = mapped_column(Text)
    severity: Mapped[str] = mapped_column(String(30), default="Medium")
    priority: Mapped[str] = mapped_column(String(30), default="Medium")
    quantity_inspected: Mapped[int] = mapped_column(Integer, default=0)
    quantity_defective: Mapped[int] = mapped_column(Integer, default=1)
    source: Mapped[str] = mapped_column(String(80), default="Operator inspection")
    status: Mapped[str] = mapped_column(String(40), default="Open", index=True)
    reported_by: Mapped[str] = mapped_column(String(100), default="")
    assigned_to: Mapped[str] = mapped_column(String(100), default="")
    root_cause: Mapped[str] = mapped_column(Text, default="")
    containment: Mapped[str] = mapped_column(Text, default="")
    corrective_action: Mapped[str] = mapped_column(Text, default="")
    disposition: Mapped[str] = mapped_column(String(40), default="Pending")
    due_date: Mapped[str] = mapped_column(String(30), default="")
    detected_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc)


class DefectImage(Base):
    __tablename__ = "defect_images"
    id: Mapped[int] = mapped_column(primary_key=True)
    defect_id: Mapped[int] = mapped_column(ForeignKey("defects.id", ondelete="CASCADE"), index=True)
    file_name: Mapped[str] = mapped_column(String(255))
    media_type: Mapped[str] = mapped_column(String(100))
    file_size: Mapped[int] = mapped_column(Integer)
    image_data: Mapped[bytes] = mapped_column(LargeBinary)
    preview_data: Mapped[bytes] = mapped_column(LargeBinary)
    uploaded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc)


class Inspection(Base):
    __tablename__ = "inspections"
    id: Mapped[int] = mapped_column(primary_key=True)
    inspection_type: Mapped[str] = mapped_column(String(40))
    product: Mapped[str] = mapped_column(String(120))
    batch: Mapped[str] = mapped_column(String(80), index=True)
    characteristic: Mapped[str] = mapped_column(String(120))
    measured_value: Mapped[float] = mapped_column(Float)
    lower_limit: Mapped[float] = mapped_column(Float)
    upper_limit: Mapped[float] = mapped_column(Float)
    result: Mapped[str] = mapped_column(String(30), index=True)
    inspector: Mapped[str] = mapped_column(String(100), default="")
    notes: Mapped[str] = mapped_column(Text, default="")
    inspected_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc)


class Equipment(Base):
    __tablename__ = "equipment"
    id: Mapped[int] = mapped_column(primary_key=True)
    equipment_code: Mapped[str] = mapped_column(String(60), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(120))
    equipment_type: Mapped[str] = mapped_column(String(80), default="Machine")
    manufacturer: Mapped[str] = mapped_column(String(100), default="")
    model: Mapped[str] = mapped_column(String(100), default="")
    serial_number: Mapped[str] = mapped_column(String(100), default="")
    line: Mapped[str] = mapped_column(String(80), default="")
    location: Mapped[str] = mapped_column(String(120), default="")
    status: Mapped[str] = mapped_column(String(30), default="Operational", index=True)
    criticality: Mapped[str] = mapped_column(String(30), default="Medium")
    assigned_technician: Mapped[str] = mapped_column(String(100), default="")
    maintenance_due: Mapped[str] = mapped_column(String(30), default="")


class EquipmentIssue(Base):
    __tablename__ = "equipment_issues"
    id: Mapped[int] = mapped_column(primary_key=True)
    equipment_id: Mapped[int] = mapped_column(ForeignKey("equipment.id"), index=True)
    problem: Mapped[str] = mapped_column(Text)
    severity: Mapped[str] = mapped_column(String(30), default="Medium")
    machine_state: Mapped[str] = mapped_column(String(50), default="Running")
    safety_concern: Mapped[bool] = mapped_column(Boolean, default=False)
    reported_by: Mapped[str] = mapped_column(String(100), default="")
    assigned_to: Mapped[str] = mapped_column(String(100), default="")
    status: Mapped[str] = mapped_column(String(30), default="Open", index=True)
    resolution: Mapped[str] = mapped_column(Text, default="")
    parts_used: Mapped[str] = mapped_column(Text, default="")
    root_cause: Mapped[str] = mapped_column(Text, default="")
    follow_up: Mapped[str] = mapped_column(Text, default="")
    reported_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc)
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class DowntimeEvent(Base):
    __tablename__ = "downtime_events"
    id: Mapped[int] = mapped_column(primary_key=True)
    equipment_id: Mapped[int] = mapped_column(ForeignKey("equipment.id"), index=True)
    issue_id: Mapped[int | None] = mapped_column(ForeignKey("equipment_issues.id"), nullable=True)
    line: Mapped[str] = mapped_column(String(80), default="")
    reason: Mapped[str] = mapped_column(String(100))
    explanation: Mapped[str] = mapped_column(Text, default="")
    planned: Mapped[bool] = mapped_column(Boolean, default=False)
    production_loss: Mapped[int] = mapped_column(Integer, default=0)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc)
    ended_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class MaintenanceWorkOrder(Base):
    __tablename__ = "maintenance_work_orders"
    id: Mapped[int] = mapped_column(primary_key=True)
    equipment_id: Mapped[int] = mapped_column(ForeignKey("equipment.id"), index=True)
    title: Mapped[str] = mapped_column(String(160))
    work_type: Mapped[str] = mapped_column(String(40), default="Corrective")
    priority: Mapped[str] = mapped_column(String(30), default="Medium")
    assigned_to: Mapped[str] = mapped_column(String(100), default="")
    status: Mapped[str] = mapped_column(String(30), default="Open", index=True)
    due_date: Mapped[str] = mapped_column(String(30), default="")
    notes: Mapped[str] = mapped_column(Text, default="")
