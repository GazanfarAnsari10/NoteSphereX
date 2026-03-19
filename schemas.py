from pydantic import BaseModel
from typing import Optional

class UserRegister(BaseModel):
    username: str
    password: str

class UserLogin(BaseModel):
    username: str
    password: str

class Note(BaseModel):
    content: str
    title: Optional[str] = None