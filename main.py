from database import SessionLocal
from sqlalchemy.orm import Session
from database import engine
from models import Base
from fastapi import FastAPI, Depends, Request, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from models import User, Note
from schemas import UserRegister, UserLogin, Note as NoteSchema
from auth import hash_password, verify_password, create_token, get_current_user

app = FastAPI(
    title="Notes API",
    description="Authenticated Notes Management API by Gazanfar Ansari",
    version="1.0.0"
)

Base.metadata.create_all(bind=engine)

# Mount static and templates FIRST
app.mount("/static", StaticFiles(directory="static"), name="static")
templates = Jinja2Templates(directory="templates")

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ----------------------------
# Frontend Routes
# ----------------------------

@app.get("/")
def root(request: Request):
    return templates.TemplateResponse("login.html", {"request": request})

@app.get("/login")
def login_page(request: Request):
    return templates.TemplateResponse("login.html", {"request": request})

@app.get("/register")
def register_page(request: Request):
    return templates.TemplateResponse("register.html", {"request": request})

@app.get("/dashboard")
def dashboard_page(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})


# ----------------------------
# API Routes
# ----------------------------

@app.post("/register")
def register(user: UserRegister, db: Session = Depends(get_db)):

    existing_user = db.query(User).filter(User.username == user.username).first()

    if existing_user:
        raise HTTPException(status_code=400, detail="Username already exists")

    hashed_password = hash_password(user.password)

    new_user = User(
        username=user.username,
        password=hashed_password
    )

    db.add(new_user)
    db.commit()

    return {"message": "User Registered Successfully"}


@app.post("/login")
def login(user: UserLogin, db: Session = Depends(get_db)):

    db_user = db.query(User).filter(User.username == user.username).first()

    if not db_user:
        raise HTTPException(status_code=401, detail="Invalid Credentials")

    if not verify_password(user.password, db_user.password):
        raise HTTPException(status_code=401, detail="Invalid Credentials")

    token = create_token({"sub": db_user.username})

    return {
        "access_token": token,
        "token_type": "bearer"
    }


@app.post("/notes")
def create_note(
    note: NoteSchema,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db)
):

    db_user = db.query(User).filter(User.username == current_user).first()

    if not db_user:
        raise HTTPException(status_code=401, detail="User not found")

    new_note = Note(
        content=note.content,
        user_id=db_user.id
    )

    db.add(new_note)
    db.commit()

    return {"message": "Note Created"}


@app.get("/notes")
def get_notes(
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db)
):

    db_user = db.query(User).filter(User.username == current_user).first()

    if not db_user:
        raise HTTPException(status_code=401, detail="User not found")

    user_notes = db.query(Note).filter(Note.user_id == db_user.id).all()

    return user_notes


@app.delete("/notes/{note_id}")
def delete_note(
    note_id: int,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db)
):

    db_user = db.query(User).filter(User.username == current_user).first()

    if not db_user:
        raise HTTPException(status_code=401, detail="User not found")

    note = db.query(Note).filter(
        Note.id == note_id,
        Note.user_id == db_user.id
    ).first()

    if not note:
        raise HTTPException(status_code=404, detail="Note not found")

    db.delete(note)
    db.commit()

    return {"message": "Note deleted successfully"}


@app.put("/notes/{note_id}")
def update_note(
    note_id: int,
    note: NoteSchema,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db)
):

    db_user = db.query(User).filter(User.username == current_user).first()

    if not db_user:
        raise HTTPException(status_code=401, detail="User not found")

    existing_note = db.query(Note).filter(
        Note.id == note_id,
        Note.user_id == db_user.id
    ).first()

    if not existing_note:
        raise HTTPException(status_code=404, detail="Note not found")

    existing_note.content = note.content

    db.commit()
    db.refresh(existing_note)

    return {"message": "Note updated successfully"}