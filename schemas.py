from pydantic import BaseModel, ConfigDict, Field, field_validator
from typing import Literal

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