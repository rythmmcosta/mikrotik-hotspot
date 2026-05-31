from datetime import datetime

from pydantic import BaseModel


class BandwidthProfileCreate(BaseModel):
    name: str
    description: str | None = None
    rate_limit_rx: str
    rate_limit_tx: str
    burst_limit_rx: str | None = None
    burst_limit_tx: str | None = None
    burst_threshold_rx: str | None = None
    burst_threshold_tx: str | None = None
    burst_time_seconds: int | None = None
    is_default_employee: bool = False
    is_default_guest: bool = False


class BandwidthProfileUpdate(BandwidthProfileCreate):
    name: str | None = None
    rate_limit_rx: str | None = None
    rate_limit_tx: str | None = None


class BandwidthProfileResponse(BaseModel):
    id: int
    name: str
    description: str | None
    rate_limit_rx: str
    rate_limit_tx: str
    burst_limit_rx: str | None
    burst_limit_tx: str | None
    mikrotik_profile_name: str | None
    is_default_employee: bool
    is_default_guest: bool
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}
