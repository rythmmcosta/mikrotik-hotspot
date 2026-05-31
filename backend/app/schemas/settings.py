from pydantic import BaseModel


class SettingItem(BaseModel):
    key_name: str
    value: str | None
    is_encrypted: bool
    description: str | None

    model_config = {"from_attributes": True}


class SettingsCategoryResponse(BaseModel):
    category: str
    settings: list[SettingItem]


class SettingsUpdateRequest(BaseModel):
    settings: dict[str, str | None]


class TestConnectionResponse(BaseModel):
    success: bool
    message: str
    details: dict | None = None
