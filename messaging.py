from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, or_
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from auth import get_current_user
from database import SessionLocal
from models import Conversation, Message, User
from schemas import (
    ConversationRead,
    ConversationStart,
    MessageCreate,
    MessagePreview,
    MessageRead,
    UserSearchRead,
)

router = APIRouter(prefix="/messages", tags=["messages"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_authenticated_user(
    current_username: str = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> User:
    user = db.query(User).filter(User.username == current_username).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


def get_participant_conversation(
    conversation_id: int,
    current_user: User,
    db: Session,
) -> Conversation:
    conversation = (
        db.query(Conversation)
        .filter(
            Conversation.id == conversation_id,
            or_(
                Conversation.participant_one_id == current_user.id,
                Conversation.participant_two_id == current_user.id,
            ),
        )
        .first()
    )
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return conversation


def conversation_response(
    conversation: Conversation,
    other_user: User,
    last_message: Message | None,
) -> ConversationRead:
    preview = None
    if last_message:
        preview = MessagePreview(
            id=last_message.id,
            content=last_message.content,
            sender_id=last_message.sender_id,
            created_at=last_message.created_at,
        )
    return ConversationRead(
        id=conversation.id,
        other_user=UserSearchRead(id=other_user.id, username=other_user.username),
        last_message=preview,
        created_at=conversation.created_at,
    )


def message_response(message: Message, sender_username: str) -> MessageRead:
    return MessageRead(
        id=message.id,
        conversation_id=message.conversation_id,
        sender_id=message.sender_id,
        sender_username=sender_username,
        content=message.content,
        created_at=message.created_at,
    )


@router.get("/users", response_model=list[UserSearchRead])
def search_users(
    query: str = Query(min_length=1, max_length=100),
    current_user: User = Depends(get_authenticated_user),
    db: Session = Depends(get_db),
):
    search_term = query.strip()
    if not search_term:
        raise HTTPException(status_code=422, detail="Enter a username to search.")

    users = (
        db.query(User.id, User.username)
        .filter(User.id != current_user.id, User.username.ilike(f"%{search_term}%"))
        .order_by(User.username)
        .limit(10)
        .all()
    )
    return [{"id": user_id, "username": username} for user_id, username in users]


@router.get("/conversations", response_model=list[ConversationRead])
def list_conversations(
    current_user: User = Depends(get_authenticated_user),
    db: Session = Depends(get_db),
):
    conversations = (
        db.query(Conversation)
        .filter(
            or_(
                Conversation.participant_one_id == current_user.id,
                Conversation.participant_two_id == current_user.id,
            )
        )
        .all()
    )
    if not conversations:
        return []

    other_user_ids = {
        conversation.participant_two_id
        if conversation.participant_one_id == current_user.id
        else conversation.participant_one_id
        for conversation in conversations
    }
    users_by_id = {
        user.id: user
        for user in db.query(User).filter(User.id.in_(other_user_ids)).all()
    }

    conversation_ids = [conversation.id for conversation in conversations]
    ranked_messages = (
        db.query(
            Message.id.label("message_id"),
            func.row_number()
            .over(
                partition_by=Message.conversation_id,
                order_by=(Message.created_at.desc(), Message.id.desc()),
            )
            .label("message_rank"),
        )
        .filter(Message.conversation_id.in_(conversation_ids))
        .subquery()
    )
    latest_message_ids = [
        row.message_id
        for row in db.query(ranked_messages.c.message_id)
        .filter(ranked_messages.c.message_rank == 1)
        .all()
    ]
    messages_by_conversation = {}
    if latest_message_ids:
        messages_by_conversation = {
            message.conversation_id: message
            for message in db.query(Message).filter(Message.id.in_(latest_message_ids)).all()
        }

    results = [
        conversation_response(
            conversation,
            users_by_id[
                conversation.participant_two_id
                if conversation.participant_one_id == current_user.id
                else conversation.participant_one_id
            ],
            messages_by_conversation.get(conversation.id),
        )
        for conversation in conversations
    ]
    results.sort(
        key=lambda item: item.last_message.created_at if item.last_message else item.created_at,
        reverse=True,
    )
    return results


@router.post("/conversations", response_model=ConversationRead)
def start_conversation(
    request: ConversationStart,
    current_user: User = Depends(get_authenticated_user),
    db: Session = Depends(get_db),
):
    other_user = db.query(User).filter(User.username == request.username).first()
    if not other_user:
        raise HTTPException(status_code=404, detail="No NoteSphereX user has that username.")
    if other_user.id == current_user.id:
        raise HTTPException(status_code=400, detail="You cannot start a conversation with yourself.")

    participant_one_id, participant_two_id = sorted((current_user.id, other_user.id))
    conversation = (
        db.query(Conversation)
        .filter(
            Conversation.participant_one_id == participant_one_id,
            Conversation.participant_two_id == participant_two_id,
        )
        .first()
    )
    if not conversation:
        conversation = Conversation(
            participant_one_id=participant_one_id,
            participant_two_id=participant_two_id,
        )
        db.add(conversation)
        try:
            db.commit()
        except IntegrityError:
            db.rollback()
            conversation = (
                db.query(Conversation)
                .filter(
                    Conversation.participant_one_id == participant_one_id,
                    Conversation.participant_two_id == participant_two_id,
                )
                .first()
            )
            if not conversation:
                raise
        else:
            db.refresh(conversation)

    return conversation_response(conversation, other_user, None)


@router.get("/conversations/{conversation_id}/messages", response_model=list[MessageRead])
def get_messages(
    conversation_id: int,
    before_id: int | None = Query(default=None, gt=0),
    limit: int = Query(default=100, ge=1, le=200),
    current_user: User = Depends(get_authenticated_user),
    db: Session = Depends(get_db),
):
    get_participant_conversation(conversation_id, current_user, db)
    message_query = (
        db.query(Message, User.username)
        .join(User, User.id == Message.sender_id)
        .filter(Message.conversation_id == conversation_id)
    )
    if before_id is not None:
        message_query = message_query.filter(Message.id < before_id)

    rows = (
        message_query.order_by(Message.created_at.desc(), Message.id.desc())
        .limit(limit)
        .all()
    )
    rows.reverse()
    return [message_response(message, username) for message, username in rows]


@router.post(
    "/conversations/{conversation_id}/messages",
    response_model=MessageRead,
    status_code=201,
)
def send_message(
    conversation_id: int,
    request: MessageCreate,
    current_user: User = Depends(get_authenticated_user),
    db: Session = Depends(get_db),
):
    get_participant_conversation(conversation_id, current_user, db)
    message = Message(
        conversation_id=conversation_id,
        sender_id=current_user.id,
        content=request.content,
    )
    db.add(message)
    db.commit()
    db.refresh(message)
    return message_response(message, current_user.username)
