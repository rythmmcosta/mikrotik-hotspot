from datetime import datetime

from pydantic import BaseModel


class ConnectionResponse(BaseModel):
    id: int
    session_id: str
    user_type: str
    user_id: int
    hotspot_username: str
    mac_address: str
    ip_address: str
    bytes_in: int
    bytes_out: int
    uptime_seconds: int
    connected_at: datetime
    disconnected_at: datetime | None
    disconnect_reason: str | None
    is_active: bool

    model_config = {"from_attributes": True}


class ConnectionListResponse(BaseModel):
    items: list[ConnectionResponse]
    total: int


class ConnectionStatsResponse(BaseModel):
    active_count: int
    total_sessions_today: int
    total_bytes_in: int
    total_bytes_out: int
    unique_users_today: int
