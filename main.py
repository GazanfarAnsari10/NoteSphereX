from database import SessionLocal, upgrade_message_note_shares, upgrade_note_metadata
from sqlalchemy.orm import Session
from database import engine
from models import Base
from fastapi import FastAPI, Depends, Request, HTTPException
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from models import User, Note
from schemas import PasswordChange, UserRegister, UserLogin, UserPublic, Note as NoteSchema, NoteRead, NoteBulkDelete
from auth import hash_password, verify_password, create_token, get_current_user
from messaging import router as messaging_router
from public_shares import PUBLIC_RESPONSE_HEADERS, router as public_shares_router

app = FastAPI(
    title="Notes API",
    description="Authenticated Notes Management API by Gazanfar Ansari",
    version="1.0.0"
)
app.include_router(messaging_router)
app.include_router(public_shares_router)


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    errors = [
        {key: value for key, value in error.items() if key != "input"}
        for error in exc.errors()
    ]
    headers = PUBLIC_RESPONSE_HEADERS if request.url.path == "/public/shares/resolve" else None
    return JSONResponse(status_code=422, content={"detail": errors}, headers=headers)

Base.metadata.create_all(bind=engine)
upgrade_note_metadata()
upgrade_message_note_shares()

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
    return templates.TemplateResponse(request, "login.html")

@app.get("/login")
def login_page(request: Request):
    return templates.TemplateResponse(request, "login.html")

@app.get("/register")
def register_page(request: Request):
    return templates.TemplateResponse(request, "register.html")

@app.get("/dashboard")
def dashboard_page(request: Request):
    return templates.TemplateResponse(request, "index.html")

@app.get("/settings")
def settings_page(request: Request):
    return templates.TemplateResponse(request, "settings.html")

@app.get("/messages")
def messages_page(request: Request):
    return templates.TemplateResponse(request, "messages.html")

@app.get("/share", include_in_schema=False)
def public_share_page(request: Request):
    return templates.TemplateResponse(
        request,
        "public_share.html",
        headers={
            **PUBLIC_RESPONSE_HEADERS,
            "Content-Security-Policy": (
                "default-src 'self'; script-src 'self'; style-src 'self'; "
                "img-src 'self' data:; base-uri 'none'; form-action 'none'; frame-ancestors 'none'"
            ),
        },
    )


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


@app.get("/users/me", response_model=UserPublic)
def get_current_user_profile(
    current_user: str = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    user = db.query(User).filter(User.username == current_user).first()

    if not user:
        raise HTTPException(status_code=401, detail="User not found")

    return {"id": user.id, "username": user.username}


@app.put("/users/me/password")
def change_current_user_password(
    password_change: PasswordChange,
    current_user: str = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    user = db.query(User).filter(User.username == current_user).first()

    if not user:
        raise HTTPException(status_code=401, detail="User not found")

    if not verify_password(password_change.current_password, user.password):
        raise HTTPException(status_code=400, detail="Current password is incorrect.")

    user.password = hash_password(password_change.new_password)
    db.commit()

    return {"message": "Password updated successfully."}


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
        title=note.title,
        category=note.category,
        user_id=db_user.id
    )

    db.add(new_note)
    db.commit()

    return {"message": "Note Created"}


@app.get("/notes", response_model=list[NoteRead])
def get_notes(
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db)
):

    db_user = db.query(User).filter(User.username == current_user).first()

    if not db_user:
        raise HTTPException(status_code=401, detail="User not found")

    user_notes = (
        db.query(Note)
        .filter(Note.user_id == db_user.id)
        .order_by(Note.updated_at.desc(), Note.id.desc())
        .all()
    )

    return user_notes


@app.post("/notes/bulk-delete")
def bulk_delete_notes(
    request: NoteBulkDelete,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    db_user = db.query(User).filter(User.username == current_user).first()

    if not db_user:
        raise HTTPException(status_code=401, detail="User not found")

    deleted_count = (
        db.query(Note)
        .filter(Note.user_id == db_user.id, Note.id.in_(request.note_ids))
        .delete(synchronize_session=False)
    )
    db.commit()

    return {
        "message": "Selected notes deleted successfully",
        "deleted_count": deleted_count,
    }


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

    has_changes = existing_note.content != note.content
    if has_changes:
        existing_note.content = note.content

    if "title" in note.model_fields_set:
        if existing_note.title != note.title:
            existing_note.title = note.title
            has_changes = True
    if "category" in note.model_fields_set:
        if existing_note.category != note.category:
            existing_note.category = note.category
            has_changes = True

    if has_changes:
        db.commit()
        db.refresh(existing_note)

    return {"message": "Note updated successfully"}