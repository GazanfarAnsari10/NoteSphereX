const token = localStorage.getItem("token")

if (!token) {
    window.location.href = "/login"
}

// ----------------------------
// Fetch Notes
// ----------------------------
async function fetchNotes() {

    const res = await fetch("/notes", {
        headers: {
            "Authorization": "Bearer " + token
        }
    })

    if (res.status === 401) {
        alert("Session expired. Please login again.")
        logout()
        return
    }

    const notes = await res.json()

    const container = document.getElementById("notesList")
    container.innerHTML = ""

    notes.forEach(note => {

        const div = document.createElement("div")
        div.classList.add("note")

        const text = document.createElement("p")
        text.innerText = note.content

        const editBtn = document.createElement("button")
        editBtn.innerText = "Edit"
        editBtn.onclick = () => editNote(note)

        const deleteBtn = document.createElement("button")
        deleteBtn.innerText = "Delete"
        deleteBtn.onclick = () => deleteNote(note.id)

        div.appendChild(text)
        div.appendChild(editBtn)
        div.appendChild(deleteBtn)

        container.appendChild(div)
    })
}

// ----------------------------
// Create Note
// ----------------------------
async function createNote() {

    const content = document.getElementById("noteContent").value

    if (!content || !content.trim()) return

    const res = await fetch("/notes", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": "Bearer " + token
        },
        body: JSON.stringify({
            content: content
        })
    })

    if (res.status === 401) {
        alert("Session expired. Please login again.")
        logout()
        return
    }

    document.getElementById("noteContent").value = ""

    fetchNotes()
}

// ----------------------------
// Delete Note
// ----------------------------
async function deleteNote(id) {

    const confirmDelete = confirm("Are you sure you want to delete this note?")
    if (!confirmDelete) return

    const res = await fetch(`/notes/${id}`, {
        method: "DELETE",
        headers: {
            "Authorization": "Bearer " + token
        }
    })

    if (res.status === 401) {
        alert("Session expired. Please login again.")
        logout()
        return
    }

    fetchNotes()
}

// ----------------------------
// Edit Note
// ----------------------------
async function editNote(note) {

    const newContent = prompt("Edit note:", note.content)

    if (!newContent || !newContent.trim()) return

    const res = await fetch(`/notes/${note.id}`, {
        method: "PUT",
        headers: {
            "Content-Type": "application/json",
            "Authorization": "Bearer " + token
        },
        body: JSON.stringify({
            content: newContent
        })
    })

    if (res.status === 401) {
        alert("Session expired. Please login again.")
        logout()
        return
    }

    fetchNotes()
}

// ----------------------------
// Logout
// ----------------------------
function logout() {
    localStorage.removeItem("token")
    window.location.href = "/login"
}

// Initial Load
fetchNotes()