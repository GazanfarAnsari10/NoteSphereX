import unittest

from fastapi import HTTPException
from fastapi.security import HTTPAuthorizationCredentials
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from auth import create_token, get_current_user
from database import Base
from messaging import (
    get_authenticated_user,
    get_messages,
    get_shared_note,
    list_conversations,
    search_users,
    share_note,
    send_message,
    start_conversation,
)
from models import Conversation, Message, Note, User
from schemas import ConversationStart, MessageCreate, NoteShareCreate


class MessagingApiTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.engine = create_engine(
            "sqlite://",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )
        event.listen(
            cls.engine,
            "connect",
            lambda connection, record: connection.execute("PRAGMA foreign_keys=ON"),
        )
        Base.metadata.create_all(cls.engine)
        cls.session_factory = sessionmaker(bind=cls.engine, autoflush=False)

    @classmethod
    def tearDownClass(cls):
        cls.engine.dispose()

    def setUp(self):
        self.db = self.session_factory()
        self.db.query(Message).delete()
        self.db.query(Conversation).delete()
        self.db.query(Note).delete()
        self.db.query(User).delete()
        self.db.add_all(
            [
                User(username="alice", password="unused"),
                User(username="bob", password="unused"),
                User(username="cara", password="unused"),
            ]
        )
        self.db.commit()

        self.alice = self.user_for("alice")
        self.bob = self.user_for("bob")
        self.cara = self.user_for("cara")

    def tearDown(self):
        self.db.close()

    def user_for(self, username):
        return self.db.query(User).filter_by(username=username).one()

    def test_user_search_excludes_self_and_handles_missing_users(self):
        results = search_users("bob", self.alice, self.db)
        self.assertEqual(results, [{"id": self.bob.id, "username": "bob"}])
        self.assertEqual(search_users("alice", self.alice, self.db), [])
        self.assertEqual(search_users("missing", self.alice, self.db), [])

    def test_start_rejects_missing_or_self_and_reuses_existing_conversation(self):
        with self.assertRaises(HTTPException) as missing:
            start_conversation(ConversationStart(username="missing"), self.alice, self.db)
        self.assertEqual(missing.exception.status_code, 404)

        with self.assertRaises(HTTPException) as self_chat:
            start_conversation(ConversationStart(username="alice"), self.alice, self.db)
        self.assertEqual(self_chat.exception.status_code, 400)

        first = start_conversation(ConversationStart(username="bob"), self.alice, self.db)
        reopened = start_conversation(ConversationStart(username="alice"), self.bob, self.db)
        self.assertEqual(first.id, reopened.id)
        self.assertEqual(self.db.query(Conversation).count(), 1)

    def test_history_persists_and_nonparticipants_cannot_read_or_send(self):
        conversation = start_conversation(ConversationStart(username="bob"), self.alice, self.db)
        sent = send_message(conversation.id, MessageCreate(content="  Persisted message  "), self.alice, self.db)
        self.assertEqual(sent.content, "Persisted message")

        history = get_messages(conversation.id, None, 100, self.bob, self.db)
        self.assertEqual(history[0].content, "Persisted message")
        self.assertEqual(history[0].message_type, "text")
        self.assertEqual(list_conversations(self.bob, self.db)[0].last_message.content, "Persisted message")

        with self.assertRaises(HTTPException) as outsider_read:
            get_messages(conversation.id, None, 100, self.cara, self.db)
        with self.assertRaises(HTTPException) as outsider_send:
            send_message(conversation.id, MessageCreate(content="intrusion"), self.cara, self.db)
        self.assertEqual(outsider_read.exception.status_code, 404)
        self.assertEqual(outsider_send.exception.status_code, 404)

    def test_share_is_owner_and_participant_scoped_and_survives_note_deletion(self):
        conversation = start_conversation(ConversationStart(username="bob"), self.alice, self.db)
        note = Note(user_id=self.alice.id, title="Title at share time", content="Private body", category="Work")
        other_owners_note = Note(
            user_id=self.bob.id,
            title="Bob's note",
            content="Bob's private body",
            category="Personal",
        )
        self.db.add_all([note, other_owners_note])
        self.db.commit()

        shared_message = share_note(
            conversation.id,
            NoteShareCreate(note_id=note.id),
            self.alice,
            self.db,
        )
        self.assertEqual(shared_message.message_type, "note_share")
        self.assertEqual(shared_message.shared_note_title, "Title at share time")
        self.assertTrue(shared_message.shared_note_available)
        last_preview = list_conversations(self.bob, self.db)[0].last_message
        self.assertEqual(last_preview.message_type, "note_share")
        self.assertEqual(last_preview.shared_note_title, "Title at share time")
        self.assertTrue(last_preview.shared_note_available)

        opened = get_shared_note(conversation.id, shared_message.id, self.bob, self.db)
        self.assertEqual(opened.content, "Private body")
        self.assertEqual(opened.shared_by, "alice")

        note.title = "Changed title"
        self.db.commit()
        self.assertEqual(get_shared_note(conversation.id, shared_message.id, self.bob, self.db).title, "Changed title")
        self.assertEqual(
            get_messages(conversation.id, None, 100, self.bob, self.db)[0].shared_note_title,
            "Title at share time",
        )

        with self.assertRaises(HTTPException) as other_owner:
            share_note(
                conversation.id,
                NoteShareCreate(note_id=other_owners_note.id),
                self.alice,
                self.db,
            )
        self.assertEqual(other_owner.exception.status_code, 404)

        with self.assertRaises(HTTPException) as outsider:
            get_shared_note(conversation.id, shared_message.id, self.cara, self.db)
        self.assertEqual(outsider.exception.status_code, 404)
        with self.assertRaises(HTTPException) as never_shared:
            get_shared_note(conversation.id, 99999, self.bob, self.db)
        self.assertEqual(never_shared.exception.status_code, 404)
        with self.assertRaises(HTTPException) as outsider_share:
            share_note(
                conversation.id,
                NoteShareCreate(note_id=note.id),
                self.cara,
                self.db,
            )
        self.assertEqual(outsider_share.exception.status_code, 404)
        self.assertEqual(self.db.query(Note).count(), 2)

        self.db.delete(note)
        self.db.commit()
        stored_message = self.db.query(Message).filter(Message.id == shared_message.id).one()
        self.assertIsNone(stored_message.shared_note_id)
        self.assertEqual(stored_message.shared_note_title, "Title at share time")
        self.assertEqual(self.db.query(Note).count(), 1)
        deleted_share = get_messages(conversation.id, None, 100, self.bob, self.db)[0]
        self.assertFalse(deleted_share.shared_note_available)
        self.assertFalse(list_conversations(self.bob, self.db)[0].last_message.shared_note_available)
        with self.assertRaises(HTTPException) as deleted_note:
            get_shared_note(conversation.id, shared_message.id, self.bob, self.db)
        self.assertEqual(deleted_note.exception.status_code, 404)

    def test_jwt_subject_resolves_to_existing_user(self):
        credentials = HTTPAuthorizationCredentials(
            scheme="Bearer",
            credentials=create_token({"sub": "alice"}),
        )
        self.assertEqual(get_current_user(credentials), "alice")
        self.assertEqual(get_authenticated_user("alice", self.db).id, self.alice.id)

        with self.assertRaises(HTTPException) as invalid_token:
            get_current_user(HTTPAuthorizationCredentials(scheme="Bearer", credentials="invalid"))
        self.assertEqual(invalid_token.exception.status_code, 401)


if __name__ == "__main__":
    unittest.main()
