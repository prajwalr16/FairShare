from pydantic import BaseModel, Field


class PushTokenRegister(BaseModel):
    token: str = Field(min_length=10, max_length=255)
    platform: str | None = Field(default=None, max_length=32)
