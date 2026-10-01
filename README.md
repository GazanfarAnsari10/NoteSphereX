<h1 align="center">NoteSphereX</h1>

<p align="center">
  A Full-Stack Notes Application with Secure Authentication and Database Integration
</p>

<hr>

<h2>Project Overview</h2>
<p>
  <b>NoteSphereX</b> is a full-stack web application for securely managing personal notes and exchanging private 1-to-1 messages with other NoteSphereX users. The application uses JWT authentication and PostgreSQL configured through <code>DATABASE_URL</code>.
</p>

<hr>

<h2>Tech Stack</h2>

<h3>Backend</h3>
<ul>
  <li>FastAPI (Python)</li>
  <li>SQLAlchemy (ORM)</li>
  <li>PostgreSQL via psycopg</li>
  <li>JWT Authentication (python-jose)</li>
  <li>Password Hashing (passlib - bcrypt)</li>
</ul>

<h3>Frontend</h3>
<ul>
  <li>HTML</li>
  <li>CSS</li>
  <li>JavaScript (Fetch API)</li>
</ul>

<hr>

<h2>Features</h2>

<ul>
  <li>✔ User Registration with hashed passwords</li>
  <li>✔ Secure Login using JWT authentication</li>
  <li>✔ Create Notes</li>
  <li>✔ View User-Specific Notes</li>
  <li>✔ Edit Notes (updates database in real-time)</li>
  <li>✔ Delete Notes (removes from database)</li>
  <li>✔ Private 1-to-1 messaging with persistent history</li>
  <li>✔ Search users and reopen existing conversations</li>
  <li>✔ Logout functionality</li>
  <li>✔ Token-based protected routes</li>
</ul>

<hr>

<h2>📂 Project Structure</h2>

<pre>
NoteSphereX/
│
├── main.py
├── messaging.py
├── public_shares.py
├── models.py
├── schemas.py
├── database.py
├── auth.py
├── requirements.txt
│
├── templates/
│   ├── login.html
│   ├── register.html
│   ├── index.html
│   ├── settings.html
│   ├── messages.html
│   └── public_share.html
│
├── static/
│   ├── css/
│   │   └── styles.css
│   │
│   └── js/
│       ├── auth.js
│       ├── notes.js
│       ├── profile-menu.js
│       ├── settings.js
│       ├── messages.js
│       ├── public-share.js
│       └── theme.js
│
└── tests/
    └── test_messaging.py
</pre>

<hr>

<h2>⚙️ Installation &amp; Setup</h2>

<h3>1. Clone the Repository</h3>
<pre>git clone https://github.com/GazanfarAnsari10/NoteSphereX.git</pre>

<h3>2. Navigate to Project Folder</h3>
<pre>cd NoteSphereX</pre>

<h3>3. Create Virtual Environment</h3>
<pre>python -m venv myenv</pre>

<h3>4. Activate Virtual Environment</h3>
<pre>
# Windows
myenv\Scripts\activate

# Mac/Linux
source myenv/bin/activate
</pre>

<h3>5. Install Dependencies</h3>
<pre>pip install -r requirements.txt</pre>

<h3>6. Configure Environment</h3>
<p>
  Set <code>DATABASE_URL</code> to your PostgreSQL connection URL, <code>SECRET_KEY</code> to a unique random value of at least 32 bytes, and <code>PUBLIC_BASE_URL</code> to the canonical HTTPS origin used for public links (for example, your deployed Render domain, with no path). Store these in deployment environment variables or an untracked local <code>.env</code>; never commit secrets. Generate a key with:
</p>
<pre>python -c "import secrets; print(secrets.token_hex(32))"</pre>

<h3>7. Run the Application</h3>
<pre>uvicorn main:app --reload</pre>

<p>On startup, SQLAlchemy creates missing tables additively, including <code>note_public_shares</code>. Idempotent PostgreSQL schema updates add note metadata to older Notes tables and the message type, nullable shared-note reference, and title snapshot to older Messages tables; existing notes and text messages remain unchanged. The database role needs permission to create tables/sequences and alter the Notes and Messages tables during deployment. Internal-share foreign keys use <code>ON DELETE SET NULL</code>; public-share rows cascade on note deletion. No migration framework is used.</p>
<p>Set <code>PUBLIC_BASE_URL</code> to the canonical HTTPS origin in production so generated links do not depend on proxy host headers. If unset, links use the request origin; configure the proxy to forward the correct scheme/host. Add edge or application rate limiting for <code>POST /public/shares/resolve</code>; this project has no rate-limiting facility.</p>

<h3>8. Open in Browser</h3>
<pre>http://127.0.0.1:8000</pre>

<hr>

<h2>🔌 API Endpoints</h2>

<pre>
POST   /register
POST   /login
GET    /users/me
PUT    /users/me/password
GET    /messages/users?query={username}
GET    /messages/conversations
POST   /messages/conversations
GET    /messages/conversations/{id}/messages
POST   /messages/conversations/{id}/messages
POST   /messages/conversations/{conversation_id}/note-shares
GET    /messages/conversations/{conversation_id}/note-shares/{message_id}
GET    /notes/{note_id}/public-share
POST   /notes/{note_id}/public-share
DELETE /notes/{note_id}/public-share
GET    /share
POST   /public/shares/resolve (public; no JWT)
POST   /notes
GET    /notes
PUT    /notes/{id}
DELETE /notes/{id}
</pre>

<hr>

<h2>🔐 Authentication Workflow</h2>

<pre>
User Login → JWT Token Generated → Stored in Browser →
Token Sent in Headers → Backend Validates → Access Granted
</pre>

<hr>

<h2>Database Schema</h2>

<h3>Users Table</h3>
<ul>
  <li>id</li>
  <li>username (unique)</li>
  <li>password (hashed)</li>
</ul>

<h3>Notes Table</h3>
<ul>
  <li>id</li>
  <li>content</li>
  <li>user_id (foreign key)</li>
</ul>

<h3>Messaging Tables</h3>
<ul>
  <li><code>conversations</code>: id, two distinct ordered participant user IDs, created_at; a unique participant-pair constraint prevents duplicate conversations.</li>
  <li><code>messages</code>: id, conversation_id, sender_id, content, created_at, message_type, nullable shared_note_id, and share-time title snapshot.</li>
</ul>
<p>All messaging endpoints require the existing bearer JWT and only return or accept messages for conversations in which the authenticated user participates. Notes can only be shared by their owner. Recipients read shared notes through the originating share message and conversation, using a read-only response. Cards show the title snapshot from share time, while an opened note shows current content if the original still exists. Message history is returned in ascending order; the messages endpoint accepts optional <code>limit</code> and <code>before_id</code> query parameters for paging.</p>

<h3>Global Shares</h3>
<ul>
  <li><code>note_public_shares</code>: one row per note, a unique SHA-256 token hash, created_at, and nullable revoked_at. Deleting a note cascades to its public-share row.</li>
</ul>
<p>Only the note owner can manage a global link. Anyone with an active link can read only the note title and content. Raw tokens are returned only on create/regenerate and are stored as hashes. The public URL carries the token in a fragment; the page removes it from browser history before submitting it in a same-origin POST body.</p>

<h3>Messaging Tests</h3>
<pre>python -m unittest discover -s tests -v</pre>

<hr>

<h3>Author</h3>

<p>
<b>Mohammad Gazanfar Ansari</b><br>
B.Tech CSE (Artificial Intelligence & Machine Learning)
<br>
<a href="https://www.linkedin.com/in/mohammad-gazanfar-ansari" target="_blank">
LinkedIn</a>
&nbsp; | &nbsp;
<a href="mailto:gazi.freestyle@gmail.com">
Email</a>
</p>

<hr>

<p align="center">
  ⭐ If you like this project, consider giving it a star!
</p>
