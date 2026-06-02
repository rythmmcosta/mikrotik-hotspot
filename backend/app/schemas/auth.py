from datetime import datetime

from pydantic import BaseModel, EmailStr


class LoginRequest(BaseModel):
    username: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class RefreshRequest(BaseModel):
    refresh_token: str


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str


class UpdateProfileRequest(BaseModel):
    full_name: str | None = None
    email: EmailStr | None = None
    mobile: str | None = None
    telegram_chat_id: str | None = None
    avatar_url: str | None = None


class UserProfile(BaseModel):
    id: int
    username: str
    email: str
    role: str
    is_active: bool
    full_name: str | None = None
    avatar_url: str | None = None
    mobile: str | None = None
    telegram_chat_id: str | None = None
    last_login_at: datetime | None = None
    created_at: datetime | None = None

    model_config = {"from_attributes": True}
