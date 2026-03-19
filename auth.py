from passlib.context import CryptContext
from jose import JWTError, jwt
from datetime import datetime, timedelta
from fastapi import Depends,  HTTPException
from fastapi.security import HTTPBearer

pwd_context = CryptContext(schemes=["bcrypt"])

def hash_password (password: str):
    return pwd_context.hash(password)

def verify_password(plain, hashed):
    return pwd_context.verify(plain, hashed)

SECRET = "my_secret_key_123"
ALGORITHM = "HS256"
security = HTTPBearer()
def create_token(data: dict):
    payload = data.copy()
    payload['exp'] = datetime.utcnow() + timedelta(minutes=30)
    return jwt.encode(payload, SECRET, algorithm = ALGORITHM) 



def get_current_user(token=Depends(security)):
    try:
        payload = jwt.decode(token.credentials, SECRET, algorithms=[ALGORITHM])
        return payload["sub"]
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid Token")