from datetime import datetime

from pydantic import BaseModel, EmailStr


class GuestRegister(BaseModel):
    full_name: str
    email: EmailStr
    mobile: str


class GuestRegisterResponse(BaseModel):
    guest_id: int
    status: str
    message: str


class OtpVerifyRequest(BaseModel):
    guest_id: int
    code: str
    target_type: str  # "guest_email" or "guest_mobile"


class OtpSendRequest(BaseModel):
    guest_id: int
    target_type: str  # "guest_email" or "guest_mobile"


class GuestApproveRequest(BaseModel):
    bandwidth_profile_id: int | None = None
    notes: str | None = None
    access_hours: int | None = None  # None = no expiry


class GuestRejectRequest(BaseModel):
    notes: str | None = None


class GuestResponse(BaseModel):
    id: int
    full_name: str
    email: str
    mobile: str
    email_verified: bool
    mobile_verified: bool
    hotspot_username: str | None
    bandwidth_profile_id: int | None
    status: str
    approval_notes: str | None
    approved_at: datetime | None
    rejected_at: datetime | None
    access_expires_at: datetime | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class GuestStatusResponse(BaseModel):
    guest_id: int
    status: str
    hotspot_username: str | None = None
    hotspot_password: str | None = None


class QueueEntryResponse(BaseModel):
    id: int
    guest_id: int
    full_name: str
    email: str
    mobile: str
    submitted_at: datetime
    priority: int
    notes: str | None

    model_config = {"from_attributes": True}


class GuestListResponse(BaseModel):
    items: list[GuestResponse]
    total: int
    page: int
    per_page: int
