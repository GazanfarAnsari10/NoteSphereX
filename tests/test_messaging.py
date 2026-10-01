import unittest
import json
import re
from unittest.mock import patch

from fastapi import HTTPException
from fastapi import Request
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
from public_shares import (
    PUBLIC_RESPONSE_HEADERS,
    UNAVAILABLE_DETAIL,
    build_share_url,
    create_or_regenerate_public_share,
    get_public_share_status,
    resolve_public_share,
    revoke_public_share,
    token_digest,
)
from schemas import ConversationStart, MessageCreate, NoteShareCreate, PublicShareLookup


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

    def test_global_share_hashes_tokens_limits_access_and_revokes(self):
        note = Note(
            user_id=self.alice.id,
            title="<img src=x onerror=alert(1)>",
            content="<script>alert(1)</script>",
            category="Work",
        )
        self.db.add(note)
        self.db.commit()
        request = Request({
            "type": "http",
            "http_version": "1.1",
            "scheme": "http",
            "server": ("localhost", 8123),
            "client": ("127.0.0.1", 50000),
            "method": "POST",
            "path": "/notes/1/public-share",
            "raw_path": b"/notes/1/public-share",
            "query_string": b"",
            "headers": [],
        })

        with patch.dict("os.environ", {"PUBLIC_BASE_URL": "https://notespherex.onrender.com"}):
            created = create_or_regenerate_public_share(note.id, request, "alice", self.db)
        first_token = created.share_url.split("#token=", 1)[1]

        with patch.dict("os.environ", {"PUBLIC_BASE_URL": "https://bad.example/path"}):
            with self.assertRaises(HTTPException) as invalid_base:
                create_or_regenerate_public_share(note.id, request, "alice", self.db)
        self.assertEqual(invalid_base.exception.status_code, 503)
        self.assertEqual(get_public_share_status(note.id, "alice", self.db).active, True)

        with patch.dict("os.environ", {"PUBLIC_BASE_URL": "https://notespherex.onrender.com"}):
            regenerated = create_or_regenerate_public_share(note.id, request, "alice", self.db)

        second_token = regenerated.share_url.split("#token=", 1)[1]
        self.assertRegex(first_token, re.compile(r"^[A-Za-z0-9_-]{43}$"))
        self.assertNotEqual(first_token, second_token)
        stored_share = self.db.query(__import__("models").NotePublicShare).filter_by(note_id=note.id).one()
        self.assertEqual(stored_share.token_hash, token_digest(second_token))
        self.assertNotEqual(stored_share.token_hash, second_token)
        self.assertTrue(get_public_share_status(note.id, "alice", self.db).active)

        public_response = resolve_public_share(PublicShareLookup(token=second_token), self.db)
        payload = json.loads(public_response.body)
        self.assertEqual(set(payload), {"title", "content"})
        self.assertIn("<script>", payload["content"])
        for name, value in PUBLIC_RESPONSE_HEADERS.items():
            self.assertEqual(public_response.headers[name.lower()], value)

        invalid_response = resolve_public_share(PublicShareLookup(token=first_token), self.db)
        self.assertEqual(invalid_response.status_code, 404)
        self.assertEqual(json.loads(invalid_response.body)["detail"], UNAVAILABLE_DETAIL)
        self.assertEqual(resolve_public_share(PublicShareLookup(token="a" * 43), self.db).status_code, 404)

        for operation in (
            lambda: get_public_share_status(note.id, "bob", self.db),
            lambda: create_or_regenerate_public_share(note.id, request, "bob", self.db),
            lambda: revoke_public_share(note.id, "bob", self.db),
        ):
            with self.assertRaises(HTTPException) as unauthorized:
                operation()
            self.assertEqual(unauthorized.exception.status_code, 404)

        revoked = revoke_public_share(note.id, "alice", self.db)
        self.assertFalse(revoked.active)
        unavailable = resolve_public_share(PublicShareLookup(token=second_token), self.db)
        self.assertEqual(unavailable.status_code, 404)
        self.assertEqual(json.loads(unavailable.body)["detail"], UNAVAILABLE_DETAIL)

        with patch.dict("os.environ", {"PUBLIC_BASE_URL": "https://notespherex.onrender.com"}):
            fresh_link = create_or_regenerate_public_share(note.id, request, "alice", self.db)
        fresh_token = fresh_link.share_url.split("#token=", 1)[1]
        self.db.delete(note)
        self.db.commit()
        self.assertEqual(self.db.query(__import__("models").NotePublicShare).filter_by(note_id=note.id).count(), 0)
        deleted = resolve_public_share(PublicShareLookup(token=fresh_token), self.db)
        self.assertEqual(deleted.status_code, 404)
        self.assertEqual(json.loads(deleted.body)["detail"], UNAVAILABLE_DETAIL)
        with patch.dict("os.environ", {"PUBLIC_BASE_URL": ""}):
            self.assertTrue(build_share_url(request, "a" * 43).startswith("http://localhost:8123/share#token="))


if __name__ == "__main__":
    unittest.main()
