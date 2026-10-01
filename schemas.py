from pydantic import BaseModel, ConfigDict, Field, field_validator
from typing import Literal
from datetime import datetime

def validate_password_input(password: str) -> str:
    if not password.strip():
        raise ValueError("Password cannot be blank.")
    if len(password.encode("utf-8")) > 72:
        raise ValueError("Password cannot exceed 72 UTF-8 bytes.")
    return password


class UserRegister(BaseModel):
    username: str
    password: str = Field(min_length=8, max_length=72)

    @field_validator("password")
    @classmethod
    def validate_password_bytes(cls, password: str) -> str:
        return validate_password_input(password)


class UserPublic(BaseModel):
    id: int
    username: str


class PasswordChange(BaseModel):
    current_password: str = Field(min_length=1)
    new_password: str = Field(min_length=8, max_length=72)

    @field_validator("new_password")
    @classmethod
    def validate_new_password(cls, password: str) -> str:
        return validate_password_input(password)

class UserLogin(BaseModel):
    username: str
    password: str

NoteCategory = Literal["Personal", "Work", "Study", "Ideas", "Other"]

class Note(BaseModel):
    content: str
    title: str = Field(default="", max_length=160)
    category: NoteCategory = "Other"

    @field_validator("title")
    @classmethod
    def normalize_title(cls, title: str) -> str:
        return title.strip()


class NoteRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    content: str
    title: str
    category: NoteCategory


class NoteBulkDelete(BaseModel):
    note_ids: list[int] = Field(min_length=1)

    @field_validator("note_ids")
    @classmethod
    def validate_note_ids(cls, note_ids: list[int]) -> list[int]:
        if any(note_id <= 0 for note_id in note_ids):
            raise ValueError("Note IDs must be positive integers.")
        return list(dict.fromkeys(note_ids))


class UserSearchRead(BaseModel):
    id: int
    username: str


class ConversationStart(BaseModel):
    username: str = Field(min_length=1, max_length=255)

    @field_validator("username")
    @classmethod
    def normalize_username(cls, username: str) -> str:
        username = username.strip()
        if not username:
            raise ValueError("Username cannot be blank.")
        return username


class MessageCreate(BaseModel):
    content: str = Field(min_length=1, max_length=5000)

    @field_validator("content")
    @classmethod
    def normalize_content(cls, content: str) -> str:
        content = content.strip()
        if not content:
            raise ValueError("Message cannot be blank.")
        return content


class MessagePreview(BaseModel):
    id: int
    content: str
    sender_id: int
    created_at: datetime


class ConversationRead(BaseModel):
    id: int
    other_user: UserSearchRead
    last_message: MessagePreview | None = None
    created_at: datetime


class MessageRead(BaseModel):
    id: int
    conversation_id: int
    sender_id: int
    sender_username: str
    content: str
    created_at: datetime