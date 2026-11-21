from datetime import datetime
from uuid import UUID
from pydantic import BaseModel, Field

from .common import APIModel

CHECKLIST_CATEGORIES = {
    "Clothing",
    "Toiletries",
    "Electronics",
    "Documents",
    "Medical",
    "Food",
    "Gear",
    "General",
}


class ChecklistItemCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    category: str = Field(default="General", max_length=50)
    scope: str = Field(default="personal")  # 'personal' | 'group'
    is_private: bool = Field(default=False)
    assigned_to: UUID | None = None


class ChecklistBatchImportItem(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    category: str = Field(default="General", max_length=50)
    scope: str = Field(default="personal")
    is_private: bool = Field(default=False)


class ChecklistBatchImport(BaseModel):
    items: list[ChecklistBatchImportItem] = Field(min_length=1)


class ChecklistItemUpdate(BaseModel):
    title: str | None = None
    category: str | None = None
    scope: str | None = None
    is_private: bool | None = None
    assigned_to: UUID | None = None


class ChecklistItemOut(APIModel):
    id: UUID
    group_id: UUID
    created_by: UUID
    title: str
    category: str
    scope: str
    is_private: bool
    assigned_to: UUID | None = None
    assigned_name: str | None = None
    is_packed: bool = False
    created_at: datetime


class ChecklistSummary(APIModel):
    personal: list[ChecklistItemOut]
    group: list[ChecklistItemOut]
    personal_total: int
    personal_packed: int
    group_total: int
    group_packed: int
