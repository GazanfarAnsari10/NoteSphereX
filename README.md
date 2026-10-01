<h1 align="center">NoteSphereX</h1>

<p align="center">
  A Full-Stack Notes Application with Secure Authentication and Database Integration
</p>

<hr>

<h2>Project Overview</h2>
<p>
  <b>NoteSphereX</b> is a full-stack web-based notes management application that allows users to securely create, manage, and organize their personal notes. The application implements user authentication using JWT and provides a seamless interface for performing CRUD operations on notes, all backed by PostgreSQL configured through <code>DATABASE_URL</code>.
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
  <li>✔ Logout functionality</li>
  <li>✔ Token-based protected routes</li>
</ul>

<hr>

<h2>📂 Project Structure</h2>

<pre>
NoteSphereX/
│
├── main.py
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
│   └── settings.html
│
└── static/
    ├── css/
    │   └── styles.css
    │
    └── js/
        ├── auth.js
        ├── notes.js
        ├── profile-menu.js
        ├── settings.js
        └── theme.js
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

<p>On startup, the application applies an idempotent PostgreSQL schema upgrade that adds title, category, and last-modified columns to existing notes. Existing note content is preserved; older notes receive an empty title, the <code>Other</code> category, and a default modification timestamp. The database role must have permission to alter the notes table during deployment.</p>

<h3>8. Open in Browser</h3>
<pre>http://127.0.0.1:8000</pre>

<hr>

<h2>🔌 API Endpoints</h2>

<pre>
POST   /register
POST   /login
GET    /users/me
PUT    /users/me/password
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
