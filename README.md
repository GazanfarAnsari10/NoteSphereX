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
│   └── messages.html
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
  Set <code>DATABASE_URL</code> to your PostgreSQL connection URL and <code>SECRET_KEY</code> to a unique random value of at least 32 bytes. Store these in deployment environment variables or an untracked local <code>.env</code>; never commit secrets. Generate a key with:
</p>
<pre>python -c "import secrets; print(secrets.token_hex(32))"</pre>

<h3>7. Run the Application</h3>
<pre>uvicorn main:app --reload</pre>

<p>On startup, SQLAlchemy creates missing tables additively, including the messaging tables; it does not alter or remove existing note data. The application also applies an idempotent PostgreSQL schema update that adds title, category, and last-modified columns to existing notes. Existing note content is preserved. For first deployment of messaging, the database role needs permission to create tables and sequences in the target schema. If note metadata has not yet been applied, the role also needs permission to alter the notes table. No migration framework is used.</p>

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
  <li><code>messages</code>: id, conversation_id, sender_id, text content, created_at.</li>
</ul>
<p>All messaging endpoints require the existing bearer JWT and only return or accept messages for conversations in which the authenticated user participates. Message history is returned in ascending order; the messages endpoint accepts optional <code>limit</code> and <code>before_id</code> query parameters for paging.</p>

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
