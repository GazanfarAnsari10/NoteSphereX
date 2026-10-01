from sqlalchemy import CheckConstraint, Column, DateTime, Integer, String, ForeignKey, func, text
from sqlalchemy.orm import relationship
from database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    password = Column(String)

    notes = relationship("Note", back_populates="owner")


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