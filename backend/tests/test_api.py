import os
from io import BytesIO
from uuid import uuid4

from PIL import Image

os.environ["DATABASE_URL"] = "sqlite:///./test_quality.db"
os.environ["SECRET_KEY"] = "test-only-signing-key-with-sufficient-length"
os.environ["INITIAL_ADMIN_USERNAME"] = "test-admin"
os.environ["INITIAL_ADMIN_PASSWORD"] = "test-only-password-12345"

from fastapi.testclient import TestClient
from app.main import app
from app.database import Base, engine
from app.main import downtime_hours


def test_authenticated_inspection_defect_and_equipment_workflow():
    Base.metadata.create_all(bind=engine)
    with TestClient(app) as client:
        assert client.get("/api/health").json() == {"status": "ok"}
        assert client.get("/api/dashboard").status_code == 401
        login = client.post("/api/auth/login", json={"username": "test-admin", "password": "test-only-password-12345"})
        assert login.status_code == 200
        headers = {"Authorization": f"Bearer {login.json()['access_token']}"}

        inspection = client.post("/api/inspections", headers=headers, json={
            "inspection_type": "In-process", "product": "Housing", "batch": "LOT-26",
            "characteristic": "Bore diameter", "measured_value": 12, "lower_limit": 10,
            "upper_limit": 11, "inspector": "Quality",
        })
        assert inspection.status_code == 201
        assert inspection.json()["result"] == "Fail"
        first_defect = client.post(f"/api/inspections/{inspection.json()['id']}/create-defect", headers=headers)
        repeated_defect = client.post(f"/api/inspections/{inspection.json()['id']}/create-defect", headers=headers)
        assert first_defect.status_code == 201
        assert first_defect.json()["id"] == repeated_defect.json()["id"]
        png = BytesIO()
        Image.new("RGB", (12, 8), color="red").save(png, format="PNG")
        jpeg = BytesIO()
        Image.new("RGB", (8, 12), color="blue").save(jpeg, format="JPEG")
        uploaded = client.post(
            f"/api/defects/{first_defect.json()['id']}/images",
            headers=headers,
            files=[("files", ("surface.png", png.getvalue(), "image/png")),
                   ("files", ("part.jpg", jpeg.getvalue(), "image/jpeg"))],
        )
        assert uploaded.status_code == 201
        assert len(uploaded.json()) == 2
        assert client.get(f"/api/defects/{first_defect.json()['id']}/images", headers=headers).json()[0]["file_name"] == "surface.png"
        defects = client.get("/api/defects", headers=headers).json()
        assert next(item for item in defects if item["id"] == first_defect.json()["id"])["image_count"] == 2
        preview = client.get(f"/api/defect-images/{uploaded.json()[0]['id']}/preview", headers=headers)
        assert preview.status_code == 200
        assert preview.headers["content-type"] == "image/jpeg"
        assert client.get(f"/api/defect-images/{uploaded.json()[0]['id']}").status_code == 401
        invalid = client.post(f"/api/defects/{first_defect.json()['id']}/images", headers=headers,
                              files=[("files", ("fake.jpg", b"not an image", "image/jpeg"))])
        assert invalid.status_code == 415

        equipment = client.post("/api/equipment", headers=headers, json={
            "equipment_code": f"M-{uuid4().hex[:8]}", "name": "Press 01", "status": "Operational",
        })
        issue = client.post("/api/issues", headers=headers, json={
            "equipment_id": equipment.json()["id"], "problem": "Hydraulic leak",
            "machine_state": "Stopped", "reported_by": "Operator",
        })
        assert issue.status_code == 201
        history = client.get(f"/api/equipment/{equipment.json()['id']}/history", headers=headers)
        assert len(history.json()["downtime"]) == 1
        running_issue = client.post("/api/issues", headers=headers, json={
            "equipment_id": equipment.json()["id"], "problem": "Intermittent vibration",
            "machine_state": "Running", "reported_by": "Operator",
        })
        assert running_issue.status_code == 201
        history = client.get(f"/api/equipment/{equipment.json()['id']}/history", headers=headers)
        assert len(history.json()["downtime"]) == 1
        resolved = client.patch(f"/api/issues/{issue.json()['id']}", headers=headers, json={"status": "Resolved"})
        assert resolved.status_code == 200
        history = client.get(f"/api/equipment/{equipment.json()['id']}/history", headers=headers)
        assert history.json()["downtime"][0]["ended_at"] is not None

        # Verify dashboard and reports with live data
        dash = client.get("/api/dashboard", headers=headers)
        assert dash.status_code == 200
        assert dash.json()["equipment_total"] >= 1
        assert len(dash.json()["recent_defects"]) >= 1

        reports = client.get("/api/reports/summary", headers=headers)
        assert reports.status_code == 200
        assert reports.json()["defect_count"] >= 1

        # Test production and maintenance endpoints
        prod = client.post("/api/production", headers=headers, json={
            "order_number": f"WO-{uuid4().hex[:6]}", "product": "Housing",
            "batch": "LOT-26", "line": "Line 1", "actual_quantity": 100, "good_quantity": 98,
        })
        assert prod.status_code == 201

        maint = client.post("/api/maintenance", headers=headers, json={
            "equipment_id": equipment.json()["id"], "title": "Check seals",
            "work_type": "Preventive",
        })
        assert maint.status_code == 201


def test_downtime_merges_overlapping_events_per_asset():
    from datetime import datetime, timedelta, timezone
    from types import SimpleNamespace

    start = datetime.now(timezone.utc)
    events = [
        SimpleNamespace(equipment_id=1, started_at=start, ended_at=start + timedelta(hours=2)),
        SimpleNamespace(equipment_id=1, started_at=start + timedelta(hours=1), ended_at=start + timedelta(hours=3)),
        SimpleNamespace(equipment_id=2, started_at=start, ended_at=start + timedelta(hours=1)),
    ]
    assert downtime_hours(events) == 4
