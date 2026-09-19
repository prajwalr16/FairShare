from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field, field_validator

from .common import APIModel

SUPPORTED_GROUP_TYPES = {"Trip", "Home", "Friends", "Office", "Other"}
SUPPORTED_ROLES = {"admin", "member", "viewer"}


class GroupCreate(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    type: str = "Trip"
    currency: str = Field(default="INR", min_length=3, max_length=3)
    description: str | None = Field(default=None, max_length=500)

    @field_validator("name")
    @classmethod
    def clean_name(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Group name is required.")
        return value

    @field_validator("currency")
    @classmethod
    def clean_currency(cls, value: str) -> str:
        value = value.strip().upper()
        if not value.isalpha():
            raise ValueError("Currency must be a valid 3-letter code.")
        return value

    @field_validator("type")
    @classmethod
    def valid_type(cls, value: str) -> str:
        value = value.strip()
        if value not in SUPPORTED_GROUP_TYPES:
            raise ValueError("Invalid group type.")
        return value

    @field_validator("description")
    @classmethod
    def clean_description(cls, value: str | None) -> str | None:
        value = value.strip() if value else None
        return value or None


class GroupUpdate(GroupCreate):
    pass


class GroupSummary(APIModel):
    id: UUID
    owner_id: UUID
    name: str
    type: str
    currency: str
    description: str | None
    created_at: datetime


class GroupSettings(GroupSummary):
    is_owner: bool
    role: str


class MemberResponse(APIModel):
    id: UUID
    group_id: UUID
    user_id: UUID | None
    email: str
    full_name: str | None
    role: str
    status: str
    created_at: datetime


class RoleUpdate(BaseModel):
    role: str

    @field_validator("role")
    @classmethod
    def clean_role(cls, value: str) -> str:
        value = value.strip().lower()
        if value not in SUPPORTED_ROLES:
            raise ValueError("Role must be admin, member, or viewer.")
        return value


class InviteMember(BaseModel):
    email: str
    redirect_to: str | None = None

    @field_validator("email")
    @classmethod
    def clean_email(cls, value: str) -> str:
        value = value.strip().lower()
        if "@" not in value or "." not in value.split("@")[-1]:
            raise ValueError("Invalid email address.")
        return value


class AcceptInvitation(BaseModel):
    group_id: UUID
    full_name: str | None = Field(default=None, max_length=120)

    @field_validator("full_name")
    @classmethod
    def clean_full_name(cls, value: str | None) -> str | None:
        value = value.strip() if value else None
        return value or None


class PendingInvitation(APIModel):
    group_id: UUID
    group_name: str
    email: str
    member_id: UUID
    status: str
