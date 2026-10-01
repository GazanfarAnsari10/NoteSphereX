import hashlib
import os
import secrets
from datetime import datetime, timezone
from urllib.parse import urlsplit

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import JSONResponse
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from auth import get_current_user
from database import SessionLocal
from models import Note, NotePublicShare, User
from schemas import NotePublicShareStatus, PublicShareLookup, PublicShareNoteRead

router = APIRouter(tags=["public sharing"])

PUBLIC_RESPONSE_HEADERS = {
    "Cache-Control": "private, no-store, max-age=0",
    "Referrer-Policy": "no-referrer",
    "X-Robots-Tag": "noindex, nofollow",
    "X-Content-Type-Options": "nosniff",
}
UNAVAILABLE_DETAIL = "This link is invalid or no longer available."


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def token_digest(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def get_owned_note(note_id: int, current_user: str, db: Session) -> Note:
    user = db.query(User).filter(User.username == current_user).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")

    note = db.query(Note).filter(Note.id == note_id, Note.user_id == user.id).first()
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")
    return note


def build_share_url(request: Request, token: str) -> str:
    configured_base_url = os.getenv("PUBLIC_BASE_URL", "").strip()
    if configured_base_url:
        parsed = urlsplit(configured_base_url)
        if (
            parsed.scheme not in {"http", "https"}
            or not parsed.netloc
            or parsed.username
            or parsed.password
            or parsed.path not in {"", "/"}
            or parsed.query
            or parsed.fragment
        ):
            raise HTTPException(
                status_code=503,
                detail="Public sharing is unavailable until PUBLIC_BASE_URL is configured correctly.",
            )
        origin = f"{parsed.scheme}://{parsed.netloc}"
    else:
        origin = f"{request.url.scheme}://{request.url.netloc}"

    return f"{origin}/share#token={token}"


def public_json_response(content: dict, status_code: int = 200) -> JSONResponse:
    return JSONResponse(
        content=content,
        status_code=status_code,
        headers=PUBLIC_RESPONSE_HEADERS,
    )


@router.get("/notes/{note_id}/public-share", response_model=NotePublicShareStatus)
def get_public_share_status(
    note_id: int,
    current_user: str = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    note = get_owned_note(note_id, current_user, db)
    share = db.query(NotePublicShare).filter(NotePublicShare.note_id == note.id).first()
    if not share:
        return NotePublicShareStatus(active=False)
    return NotePublicShareStatus(
        active=share.revoked_at is None,
        created_at=share.created_at,
    )


@router.post("/notes/{note_id}/public-share", response_model=NotePublicShareStatus)
def create_or_regenerate_public_share(
    note_id: int,
    request: Request,
    current_user: str = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    note = get_owned_note(note_id, current_user, db)
    token = secrets.token_urlsafe(32)
    share_url = build_share_url(request, token)
    share = db.query(NotePublicShare).filter(NotePublicShare.note_id == note.id).first()
    now = datetime.now(timezone.utc)

    if share:
        share.token_hash = token_digest(token)
        share.created_at = now
        share.revoked_at = None
    else:
        share = NotePublicShare(
            note_id=note.id,
            token_hash=token_digest(token),
            created_at=now,
        )
        db.add(share)

    try:
        db.commit()
    except IntegrityError as error:
        db.rollback()
        raise HTTPException(status_code=409, detail="Could not create a share link. Please try again.") from error

    return NotePublicShareStatus(
        active=True,
        created_at=share.created_at,
        share_url=share_url,
    )


@router.delete("/notes/{note_id}/public-share", response_model=NotePublicShareStatus)
def revoke_public_share(
    note_id: int,
    current_user: str = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    note = get_owned_note(note_id, current_user, db)
    share = db.query(NotePublicShare).filter(NotePublicShare.note_id == note.id).first()
    if not share:
        return NotePublicShareStatus(active=False)

    if share.revoked_at is None:
        share.revoked_at = datetime.now(timezone.utc)
        db.commit()
    return NotePublicShareStatus(active=False, created_at=share.created_at)


@router.post("/public/shares/resolve", response_model=PublicShareNoteRead)
def resolve_public_share(
    lookup: PublicShareLookup,
    db: Session = Depends(get_db),
):
    share = (
        db.query(NotePublicShare)
        .filter(
            NotePublicShare.token_hash == token_digest(lookup.token),
            NotePublicShare.revoked_at.is_(None),
        )
        .first()
    )
    if not share:
        return public_json_response({"detail": UNAVAILABLE_DETAIL}, status_code=404)

    note = db.query(Note).filter(Note.id == share.note_id).first()
    if not note:
        return public_json_response({"detail": UNAVAILABLE_DETAIL}, status_code=404)

    return public_json_response({
        "title": note.title or "Untitled note",
        "content": note.content or "",
    })
