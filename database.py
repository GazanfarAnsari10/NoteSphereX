import os
from dotenv import load_dotenv

from sqlalchemy import create_engine, text
from sqlalchemy.engine import make_url
from sqlalchemy.exc import ArgumentError
from sqlalchemy.orm import sessionmaker
from sqlalchemy.ext.declarative import declarative_base

load_dotenv()  # Load environment variables from .env file
DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL or not DATABASE_URL.strip():
    raise RuntimeError("DATABASE_URL must be set before starting NoteSphereX.")

try:
    database_url = make_url(DATABASE_URL)
except ArgumentError as error:
    raise RuntimeError("DATABASE_URL must be a valid PostgreSQL connection URL.") from error

if database_url.get_backend_name() != "postgresql":
    raise RuntimeError("DATABASE_URL must use PostgreSQL.")

if database_url.get_driver_name() not in {"psycopg", "psycopg2"}:
    raise RuntimeError("DATABASE_URL must use a PostgreSQL URL supported by psycopg.")

database_url = database_url.set(drivername="postgresql+psycopg")

engine = create_engine(database_url)


def upgrade_note_metadata():
    with engine.begin() as connection:
        connection.execute(text(
            "ALTER TABLE notes ADD COLUMN IF NOT EXISTS "
            "title VARCHAR(160) NOT NULL DEFAULT ''"
        ))
        connection.execute(text(
            "ALTER TABLE notes ADD COLUMN IF NOT EXISTS "
            "category VARCHAR(20) NOT NULL DEFAULT 'Other'"
        ))
        connection.execute(text("""
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_constraint
                    WHERE conrelid = 'notes'::regclass
                      AND conname = 'ck_notes_category'
                ) THEN
                    ALTER TABLE notes ADD CONSTRAINT ck_notes_category
                    CHECK (category IN ('Personal', 'Work', 'Study', 'Ideas', 'Other'));
                END IF;
            END $$;
        """))

SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine
)

Base = declarative_base()