from passlib.context import CryptContext
from jose import JWTError, jwt
from datetime import datetime, timedelta
from fastapi import Depends,  HTTPException
from fastapi.security import HTTPBearer
import os
from dotenv import load_dotenv

load_dotenv()  # Load environment variables from .env file

pwd_context = CryptContext(schemes=["bcrypt"])

def hash_password (password: str):
    return pwd_context.hash(password)

def verify_password(plain, hashed):
    return pwd_context.verify(plain, hashed)

SECRET = os.getenv("SECRET_KEY")
if not SECRET or not SECRET.strip():
    raise RuntimeError("SECRET_KEY must be set in the environment before starting NoteSphereX.")
if len(SECRET.encode("utf-8")) < 32:
    raise RuntimeError("SECRET_KEY must contain at least 32 bytes for HS256 security.")

ALGORITHM = "HS256"
security = HTTPBearer()
def create_token(data: dict):
    payload = data.copy()
    payload['exp'] = datetime.utcnow() + timedelta(minutes=30)
    return jwt.encode(payload, SECRET, algorithm = ALGORITHM) 



def get_current_user(token=Depends(security)):
    try:
        payload = jwt.decode(token.credentials, SECRET, algorithms=[ALGORITHM])
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid Token")

    subject = payload.get("sub") if isinstance(payload, dict) else None
    if not isinstance(subject, str) or not subject:
        raise HTTPException(status_code=401, detail="Invalid Token")

    return subject