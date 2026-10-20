from uuid import UUID
from pydantic import BaseModel, Field

from .common import APIModel


class UserProfileUpdate(BaseModel):
    full_name: str = Field(min_length=1, max_length=120)


class UserResponse(APIModel):
    id: UUID
    email: str | None = None
    full_name: str | None = None

