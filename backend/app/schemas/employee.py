from datetime import datetime

from pydantic import BaseModel, EmailStr, field_validator


class EmployeeCreate(BaseModel):
    full_name: str
    email: EmailStr
    password: str
    bandwidth_profile_id: int | None = None
    notes: str | None = None

    @field_validator("password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        return v


class EmployeeUpdate(BaseModel):
    full_name: str | None = None
    bandwidth_profile_id: int | None = None
    notes: str | None = None


class EmployeeResponse(BaseModel):
    id: int
    full_name: str
    email: str
    hotspot_username: str
    bandwidth_profile_id: int | None
    status: str
    mikrotik_synced: bool
    notes: str | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class EmployeeListResponse(BaseModel):
    items: list[EmployeeResponse]
    total: int
    page: int
    per_page: int
