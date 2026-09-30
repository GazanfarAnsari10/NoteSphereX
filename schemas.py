from pydantic import BaseModel, Field, field_validator
from typing import Optional

class UserRegister(BaseModel):
    username: str
    password: str = Field(min_length=8, max_length=72)

    @field_validator("password")
    @classmethod
    def validate_password_bytes(cls, password: str) -> str:
        if not password.strip():
            raise ValueError("Password cannot be blank.")
        if len(password.encode("utf-8")) > 72:
            raise ValueError("Password cannot exceed 72 UTF-8 bytes.")
        return password


class UserPublic(BaseModel):
    id: int
    username: str

class UserLogin(BaseModel):
    username: str
    password: str

class Note(BaseModel):
    content: str
    title: Optional[str] = None