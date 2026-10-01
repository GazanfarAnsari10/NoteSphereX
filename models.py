from sqlalchemy import CheckConstraint, Column, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint, func, text
from sqlalchemy.orm import relationship
from database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    password = Column(String)

    notes = relationship("Note", back_populates="owner")
    conversations_as_first = relationship(
        "Conversation",
        foreign_keys="Conversation.participant_one_id",
        back_populates="participant_one",
    )
    conversations_as_second = relationship(
        "Conversation",
        foreign_keys="Conversation.participant_two_id",
        back_populates="participant_two",
    )
    sent_messages = relationship("Message", back_populates="sender")


class Note(Base):
    __tablename__ = "notes"
    __table_args__ = (
        CheckConstraint(
            "category IN ('Personal', 'Work', 'Study', 'Ideas', 'Other')",
            name="ck_notes_category",
        ),
    )

    id = Column(Integer, primary_key=True, index=True)
    content = Column(String)
    title = Column(String(160), nullable=False, default="", server_default=text("''"))
    category = Column(String(20), nullable=False, default="Other", server_default=text("'Other'"))
    updated_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=func.now(),
        onupdate=func.now(),
        server_default=func.now(),
    )
    user_id = Column(Integer, ForeignKey("users.id"))

    owner = relationship("User", back_populates="notes")


class Conversation(Base):
    __tablename__ = "conversations"
    __table_args__ = (
        CheckConstraint(
            "participant_one_id < participant_two_id",
            name="ck_conversations_ordered_participants",
        ),
        UniqueConstraint(
            "participant_one_id",
            "participant_two_id",
            name="uq_conversations_participant_pair",
        ),
    )

    id = Column(Integer, primary_key=True, index=True)
    participant_one_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    participant_two_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=func.now(),
        server_default=func.now(),
    )

    participant_one = relationship(
        "User",
        foreign_keys=[participant_one_id],
        back_populates="conversations_as_first",
    )
    participant_two = relationship(
        "User",
        foreign_keys=[participant_two_id],
        back_populates="conversations_as_second",
    )
    messages = relationship(
        "Message",
        back_populates="conversation",
        cascade="all, delete-orphan",
        order_by="Message.id",
    )


class Message(Base):
    __tablename__ = "messages"

    id = Column(Integer, primary_key=True, index=True)
    conversation_id = Column(
        Integer,
        ForeignKey("conversations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    sender_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    content = Column(Text, nullable=False)
    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=func.now(),
        server_default=func.now(),
    )

    conversation = relationship("Conversation", back_populates="messages")
    sender = relationship("User", back_populates="sent_messages")