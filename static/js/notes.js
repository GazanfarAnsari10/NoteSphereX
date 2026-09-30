const token = localStorage.getItem("token")

const dashLayout = document.getElementById("dashLayout")
const sidebarMenu = document.getElementById("sidebarMenu")
const sidebarClose = document.getElementById("sidebarClose")
const sidebarBackdrop = document.getElementById("sidebarBackdrop")
const sidebarCollapse = document.getElementById("sidebarCollapse")
const mobileSidebar = window.matchMedia("(max-width: 800px)")

function setSidebarOpen(isOpen, restoreFocus = false) {
    dashLayout.classList.toggle("is-sidebar-open", isOpen)
    document.body.classList.toggle("is-sidebar-open", isOpen)
    sidebarMenu.setAttribute("aria-expanded", String(isOpen))
    sidebarMenu.setAttribute("aria-label", isOpen ? "Close navigation" : "Open navigation")

    if (restoreFocus) sidebarMenu.focus()
}

sidebarMenu.addEventListener("click", () => {
    setSidebarOpen(!dashLayout.classList.contains("is-sidebar-open"))
})
sidebarClose.addEventListener("click", () => setSidebarOpen(false, true))
sidebarBackdrop.addEventListener("click", () => setSidebarOpen(false, true))

sidebarCollapse.addEventListener("click", () => {
    const isCollapsed = dashLayout.classList.toggle("is-sidebar-collapsed")
    sidebarCollapse.setAttribute("aria-expanded", String(!isCollapsed))
    sidebarCollapse.setAttribute("aria-label", isCollapsed ? "Expand sidebar" : "Collapse sidebar")
    sidebarCollapse.title = isCollapsed ? "Expand sidebar" : "Collapse sidebar"
})

document.addEventListener("keydown", event => {
    if (event.key === "Escape" && dashLayout.classList.contains("is-sidebar-open")) {
        setSidebarOpen(false, true)
    }
})

mobileSidebar.addEventListener("change", event => {
    setSidebarOpen(false)
    if (event.matches) dashLayout.classList.remove("is-sidebar-collapsed")
})

document.querySelectorAll("[data-sidebar-link]").forEach(link => {
    link.addEventListener("click", () => {
        document.querySelectorAll("[data-sidebar-link]").forEach(item => {
            item.classList.toggle("is-active", item === link)
            if (item === link) item.setAttribute("aria-current", "page")
            else item.removeAttribute("aria-current")
        })

        if (mobileSidebar.matches) setSidebarOpen(false)
        if (link.hash === "#noteContent") {
            document.getElementById("noteContent").focus({ preventScroll: true })
        }
    })
})

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

    // Update note count badge in header
    const badge = document.getElementById("noteCountBadge")
    if (badge) {
        badge.innerText = notes.length === 1 ? "1 note" : `${notes.length} notes`
    }

    // Show empty state if no notes
    if (notes.length === 0) {
        const empty = document.createElement("div")
        empty.classList.add("dash-empty")
        empty.innerHTML = `
            <div class="dash-empty-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                    <polyline points="14 2 14 8 20 8"/>
                    <line x1="12" y1="18" x2="12" y2="12"/>
                    <line x1="9" y1="15" x2="15" y2="15"/>
                </svg>
            </div>
            <div class="dash-empty-title">No notes yet</div>
            <div class="dash-empty-sub">Write your first note above to get started.</div>
        `
        container.appendChild(empty)
        return
    }

    notes.forEach(note => {

        const div = document.createElement("div")
        div.classList.add("note-card")

        const text = document.createElement("p")
        text.innerText = note.content
        text.classList.add("note-text")

        const actions = document.createElement("div")
        actions.classList.add("note-actions")

        const editBtn = document.createElement("button")
        editBtn.innerText = "Edit"
        editBtn.classList.add("note-btn", "note-btn-edit")
        editBtn.onclick = () => editNote(note, div, text, actions)

        const deleteBtn = document.createElement("button")
        deleteBtn.innerText = "Delete"
        deleteBtn.classList.add("note-btn", "note-btn-delete")
        deleteBtn.onclick = () => deleteNote(note.id)

        actions.appendChild(editBtn)
        actions.appendChild(deleteBtn)

        div.appendChild(text)
        div.appendChild(actions)

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
// Edit Note  — inline card editing (no prompt())
// ----------------------------
async function editNote(note, cardDiv, textEl, actionsEl) {

    // If already in edit mode, do nothing
    if (cardDiv.classList.contains("is-editing")) return
    cardDiv.classList.add("is-editing")

    // Hide the static text
    textEl.style.display = "none"

    // Create inline textarea
    const textarea = document.createElement("textarea")
    textarea.value = note.content
    textarea.classList.add("note-textarea")
    // Auto-resize to content
    textarea.style.height = "auto"

    // Replace actions with Save / Cancel
    actionsEl.innerHTML = ""

    const saveBtn = document.createElement("button")
    saveBtn.innerText = "Save"
    saveBtn.classList.add("note-btn", "note-btn-save")
    saveBtn.onclick = async () => {
        const newContent = textarea.value.trim()
        if (!newContent) return

        const res = await fetch(`/notes/${note.id}`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
                "Authorization": "Bearer " + token
            },
            body: JSON.stringify({ content: newContent })
        })

        if (res.status === 401) {
            alert("Session expired. Please login again.")
            logout()
            return
        }

        fetchNotes()
    }

    const cancelBtn = document.createElement("button")
    cancelBtn.innerText = "Cancel"
    cancelBtn.classList.add("note-btn", "note-btn-edit")
    cancelBtn.onclick = () => {
        // Restore original view without a network call
        cardDiv.classList.remove("is-editing")
        textarea.remove()
        textEl.style.display = ""
        actionsEl.innerHTML = ""

        const editBtn = document.createElement("button")
        editBtn.innerText = "Edit"
        editBtn.classList.add("note-btn", "note-btn-edit")
        editBtn.onclick = () => editNote(note, cardDiv, textEl, actionsEl)

        const deleteBtn = document.createElement("button")
        deleteBtn.innerText = "Delete"
        deleteBtn.classList.add("note-btn", "note-btn-delete")
        deleteBtn.onclick = () => deleteNote(note.id)

        actionsEl.appendChild(editBtn)
        actionsEl.appendChild(deleteBtn)
    }

    actionsEl.appendChild(saveBtn)
    actionsEl.appendChild(cancelBtn)

    // Insert textarea before actions
    cardDiv.insertBefore(textarea, actionsEl)
    textarea.focus()
    // Move cursor to end
    textarea.setSelectionRange(textarea.value.length, textarea.value.length)
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