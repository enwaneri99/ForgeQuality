from datetime import datetime

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


class InputSchema(BaseModel):
    model_config = ConfigDict(extra="forbid")


class LoginRequest(InputSchema):
    username: str = Field(min_length=1, max_length=80)
    password: str = Field(min_length=1, max_length=72)

    @field_validator("password")
    @classmethod
    def bcrypt_password_limit(cls, value: str):
        if len(value.encode("utf-8")) > 72:
            raise ValueError("password must be at most 72 UTF-8 bytes")
        return value


class UserCreate(InputSchema):
    username: str = Field(min_length=1, max_length=80)
    password: str = Field(min_length=12, max_length=72)
    role: Literal["admin", "supervisor", "quality_engineer", "maintenance", "operator"]

    @field_validator("password")
    @classmethod
    def bcrypt_password_limit(cls, value: str):
        if len(value.encode("utf-8")) > 72:
            raise ValueError("password must be at most 72 UTF-8 bytes")
        return value


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    username: str
    role: str


class ProductionCreate(InputSchema):
    order_number: str = Field(min_length=1, max_length=80)
    product: str = Field(min_length=1, max_length=120)
    batch: str = Field(min_length=1, max_length=80)
    line: str = Field(min_length=1, max_length=80)
    workstation: str = ""
    equipment_id: str = ""
    shift: str = "Day"
    operator: str = ""
    supervisor: str = ""
    target_quantity: int = Field(default=0, ge=0)
    actual_quantity: int = Field(default=0, ge=0)
    good_quantity: int = Field(default=0, ge=0)
    defective_quantity: int = Field(default=0, ge=0)
    rework_quantity: int = Field(default=0, ge=0)
    scrap_quantity: int = Field(default=0, ge=0)
    rejected_quantity: int = Field(default=0, ge=0)
    awaiting_inspection: int = Field(default=0, ge=0)
    status: str = "In progress"
    production_date: datetime | None = None
    started_at: datetime | None = None
    ended_at: datetime | None = None


class DefectCreate(InputSchema):
    product: str
    component: str = ""
    supplier: str = ""
    batch: str
    line: str = ""
    workstation: str = ""
    equipment_id: str = ""
    category: str
    description: str
    severity: str = "Medium"
    priority: str = "Medium"
    quantity_inspected: int = Field(default=0, ge=0)
    quantity_defective: int = Field(default=1, ge=1)
    source: str = "Operator inspection"
    status: str = "Open"
    reported_by: str = ""
    assigned_to: str = ""
    root_cause: str = ""
    containment: str = ""
    corrective_action: str = ""
    disposition: str = "Pending"
    due_date: str = ""


class InspectionCreate(InputSchema):
    inspection_type: str
    product: str
    batch: str
    characteristic: str
    measured_value: float
    lower_limit: float
    upper_limit: float
    inspector: str = ""
    notes: str = ""

    @model_validator(mode="after")
    def limits_must_be_ordered(self):
        if self.lower_limit > self.upper_limit:
            raise ValueError("lower_limit must be less than or equal to upper_limit")
        return self


class EquipmentCreate(InputSchema):
    equipment_code: str
    name: str
    equipment_type: str = "Machine"
    manufacturer: str = ""
    model: str = ""
    serial_number: str = ""
    line: str = ""
    location: str = ""
    status: str = "Operational"
    criticality: str = "Medium"
    assigned_technician: str = ""
    maintenance_due: str = ""


class IssueCreate(InputSchema):
    equipment_id: int
    problem: str
    severity: str = "Medium"
    machine_state: str = "Running"
    safety_concern: bool = False
    reported_by: str = ""
    assigned_to: str = ""
    resolution: str = ""
    parts_used: str = ""
    root_cause: str = ""
    follow_up: str = ""


class DowntimeCreate(InputSchema):
    equipment_id: int
    issue_id: int | None = None
    line: str = ""
    reason: str
    explanation: str = ""
    planned: bool = False
    production_loss: int = Field(default=0, ge=0)
    started_at: datetime | None = None
    ended_at: datetime | None = None


class MaintenanceCreate(InputSchema):
    equipment_id: int
    title: str
    work_type: str = "Corrective"
    priority: str = "Medium"
    assigned_to: str = ""
    status: str = "Open"
    due_date: str = ""
    notes: str = ""


class RecordOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
