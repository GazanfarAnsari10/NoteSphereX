const token = localStorage.getItem("token")
let loadedNotes = []
let searchTerm = ""

const dashLayout = document.getElementById("dashLayout")
const sidebarMenu = document.getElementById("sidebarMenu")
const sidebarClose = document.getElementById("sidebarClose")
const sidebarBackdrop = document.getElementById("sidebarBackdrop")
const sidebarCollapse = document.getElementById("sidebarCollapse")
const mobileSidebar = window.matchMedia("(max-width: 800px)")
const noteSearch = document.getElementById("noteSearch")
const noteComposer = document.getElementById("noteComposer")
const createNoteButton = document.getElementById("createNoteButton")
const noteTitleInput = document.getElementById("noteTitle")
const noteCategoryInput = document.getElementById("noteCategory")
const noteSaveStatus = document.getElementById("noteSaveStatus")
const noteSubmitButton = document.getElementById("noteSubmitButton")
const noteSubmitIcon = document.getElementById("noteSubmitIcon")
const noteSubmitLabel = document.getElementById("noteSubmitLabel")
const noteContentInput = document.getElementById("noteContent")
let activeNote = null
let initialNoteValues = null
let savingNote = false
let notesRefreshPending = false

function setEditorMode(isEditing) {
    noteSubmitLabel.textContent = isEditing ? "Done" : "Add Note"
    noteSubmitButton.setAttribute("aria-label", isEditing ? "Save and close note" : "Add note")
    noteSubmitIcon.innerHTML = isEditing
        ? '<path d="m5 12 4 4L19 6"/>'
        : '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>'
    document.querySelector(".dash-char-hint").textContent = isEditing
        ? "Changes save when you close this note."
        : "Write something worth remembering."
}

function setSaveStatus(message, isError = false) {
    noteSaveStatus.textContent = message
    noteSaveStatus.hidden = !message
    noteSaveStatus.dataset.state = isError ? "error" : ""
}

function getEditorValues() {
    return {
        title: noteTitleInput.value.trim(),
        category: noteCategoryInput.value,
        content: noteContentInput.value
    }
}

function resizeNoteContent() {
    noteContentInput.style.height = "auto"
    noteContentInput.style.height = `${noteContentInput.scrollHeight}px`
}

noteContentInput.addEventListener("input", resizeNoteContent)

function setComposerOpen(isOpen, focusEditor = false) {
    noteComposer.hidden = !isOpen
    createNoteButton.setAttribute("aria-expanded", String(isOpen))
    createNoteButton.setAttribute("aria-label", isOpen ? "Close note editor" : "Create note")
    createNoteButton.title = isOpen ? "Close note editor" : "Create note"
    createNoteButton.innerHTML = isOpen
        ? '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>'
        : '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>'

    if (focusEditor) noteTitleInput.focus({ preventScroll: true })
}

function openCreateEditor() {
    activeNote = null
    initialNoteValues = null
    notesRefreshPending = false
    noteTitleInput.value = ""
    noteCategoryInput.value = "Other"
    noteContentInput.value = ""
    setEditorMode(false)
    setSaveStatus("")
    setComposerOpen(true, true)
    resizeNoteContent()
}

function openNoteEditor(note) {
    activeNote = note
    initialNoteValues = {
        title: note.title || "",
        category: note.category || "Other",
        content: note.content || ""
    }
    noteTitleInput.value = initialNoteValues.title
    noteCategoryInput.value = initialNoteValues.category
    noteContentInput.value = initialNoteValues.content
    setEditorMode(true)
    setSaveStatus("")
    setComposerOpen(true, true)
    resizeNoteContent()
}

async function closeNoteEditor() {
    if (savingNote) return false

    if (activeNote) {
        const values = getEditorValues()
        const changed = values.title !== initialNoteValues.title
            || values.category !== initialNoteValues.category
            || values.content !== initialNoteValues.content

        if (changed && !values.content.trim()) {
            setSaveStatus("Note content cannot be empty. Your changes are still open.", true)
            return false
        }

        if (changed || notesRefreshPending) {
            savingNote = true
            createNoteButton.disabled = true
            noteSubmitButton.disabled = true
            setSaveStatus(changed ? "Saving changes..." : "Refreshing notes...")

            try {
                if (changed) {
                    const response = await fetch(`/notes/${activeNote.id}`, {
                        method: "PUT",
                        headers: {
                            "Content-Type": "application/json",
                            "Authorization": "Bearer " + token
                        },
                        body: JSON.stringify(values)
                    })

                    if (response.status === 401) {
                        alert("Session expired. Please login again.")
                        logout(true)
                        return false
                    }
                    if (!response.ok) throw new Error("Note update failed")

                    Object.assign(activeNote, values)
                    initialNoteValues = values
                    notesRefreshPending = true
                }

                if (!await fetchNotes()) return false
                notesRefreshPending = false
            } catch {
                setSaveStatus(
                    notesRefreshPending
                        ? "Changes were saved, but notes could not refresh. Close again to retry."
                        : "Changes could not be saved. Your note is still open; try again.",
                    true
                )
                return false
            } finally {
                savingNote = false
                createNoteButton.disabled = false
                noteSubmitButton.disabled = false
            }
        }
    }

    activeNote = null
    initialNoteValues = null
    notesRefreshPending = false
    setSaveStatus("")
    setEditorMode(false)
    setComposerOpen(false)
    return true
}

async function handleComposerAction() {
    if (activeNote) await closeNoteEditor()
    else await createNote()
}

createNoteButton.addEventListener("click", async () => {
    if (noteComposer.hidden) openCreateEditor()
    else await closeNoteEditor()
})

noteSearch.addEventListener("input", () => {
    searchTerm = noteSearch.value.trim().toLowerCase()
    renderNotes()
})

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
    if (event.key === "Escape" && !noteComposer.hidden) {
        event.preventDefault()
        closeNoteEditor().then(closed => {
            if (closed) createNoteButton.focus()
        })
    }
})

mobileSidebar.addEventListener("change", event => {
    setSidebarOpen(false)
    if (event.matches) dashLayout.classList.remove("is-sidebar-collapsed")
})

document.querySelectorAll("[data-sidebar-link]").forEach(link => {
    link.addEventListener("click", async event => {
        const isNewNoteLink = link.hash === "#noteContent"
        const isNotesLink = link.hash === "#notesList"

        if (isNewNoteLink) {
            event.preventDefault()
            if (activeNote && !(await closeNoteEditor())) return
            if (noteComposer.hidden) openCreateEditor()
            else noteTitleInput.focus({ preventScroll: true })
            window.location.hash = link.hash
        } else if (activeNote || !noteComposer.hidden) {
            event.preventDefault()
            if (!(await closeNoteEditor())) return
            if (isNotesLink) window.location.hash = link.hash
            else window.location.assign(link.href)
        }

        document.querySelectorAll("[data-sidebar-link]").forEach(item => {
            item.classList.toggle("is-active", item === link)
            if (item === link) item.setAttribute("aria-current", "page")
            else item.removeAttribute("aria-current")
        })

        if (mobileSidebar.matches) setSidebarOpen(false)
    })
})

document.addEventListener("click", event => {
    const link = event.target.closest("a[href]")
    if (!activeNote || !link || link.matches("[data-sidebar-link]") || event.defaultPrevented) return
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return

    event.preventDefault()
    closeNoteEditor().then(closed => {
        if (closed) window.location.assign(link.href)
    })
})

if (!token) {
    window.location.href = "/login"
}

// ----------------------------
// Fetch Notes
// ----------------------------
function createNoteActionButton(label, classNames, iconMarkup) {
    const button = document.createElement("button")
    button.type = "button"
    button.classList.add(...classNames.split(" "))
    button.setAttribute("aria-label", label)
    button.title = label
    button.innerHTML = iconMarkup
    return button
}

async function openExistingNote(note) {
    if (!noteComposer.hidden && !(await closeNoteEditor())) return
    openNoteEditor(note)
}

function renderNotes() {
    const container = document.getElementById("notesList")
    container.innerHTML = ""

    if (loadedNotes.length === 0) {
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

    const matchingNotes = loadedNotes.filter(note => {
        const searchableText = `${note.title || ""}\n${note.content || ""}\n${note.category || "Other"}`.toLowerCase()
        return searchableText.includes(searchTerm)
    })

    if (matchingNotes.length === 0) {
        const empty = document.createElement("div")
        empty.classList.add("dash-empty")
        empty.innerHTML = `
            <div class="dash-empty-title">No matching notes found</div>
            <div class="dash-empty-sub">Try another search term.</div>
        `
        container.appendChild(empty)
        return
    }

    matchingNotes.forEach(note => {
        const div = document.createElement("div")
        div.classList.add("note-card")
        div.tabIndex = 0
        div.setAttribute("role", "article")
        div.setAttribute("aria-label", `Open note: ${note.title?.trim() || "Untitled note"}`)
        div.addEventListener("click", event => {
            if (event.target.closest("button")) return
            openExistingNote(note)
        })
        div.addEventListener("keydown", event => {
            if (event.target !== div || (event.key !== "Enter" && event.key !== " ")) return
            event.preventDefault()
            openExistingNote(note)
        })

        const heading = document.createElement("div")
        heading.classList.add("note-card-heading")

        const title = document.createElement("h3")
        title.innerText = note.title?.trim() || "Untitled note"
        title.classList.add("note-title")
        if (!note.title?.trim()) title.classList.add("is-untitled")

        const category = document.createElement("span")
        category.innerText = note.category || "Other"
        category.classList.add("note-category")

        heading.appendChild(title)
        heading.appendChild(category)

        const text = document.createElement("p")
        text.innerText = note.content || ""
        text.classList.add("note-text")

        const actions = document.createElement("div")
        actions.classList.add("note-actions")

        const deleteBtn = createNoteActionButton(
            "Delete note",
            "note-btn note-btn-delete note-btn-icon",
            '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="m19 6-1 14H6L5 6"/><path d="M10 11v5m4-5v5"/></svg>'
        )
        deleteBtn.onclick = event => {
            event.stopPropagation()
            deleteNote(note.id)
        }

        actions.appendChild(deleteBtn)

        div.appendChild(heading)
        div.appendChild(text)
        div.appendChild(actions)
        container.appendChild(div)
    })
}

async function fetchNotes() {

    const res = await fetch("/notes", {
        headers: {
            "Authorization": "Bearer " + token
        }
    })

    if (res.status === 401) {
        alert("Session expired. Please login again.")
        logout(true)
        return false
    }
    if (!res.ok) throw new Error("Failed to load notes")

    const notes = await res.json()
    loadedNotes = notes

    // Update note count badge in header
    const badge = document.getElementById("noteCountBadge")
    if (badge) {
        badge.innerText = notes.length === 1 ? "1 note" : `${notes.length} notes`
    }
    renderNotes()
    return true
}

// ----------------------------
// Create Note
// ----------------------------
async function createNote() {

    const content = document.getElementById("noteContent").value
    const title = noteTitleInput.value.trim()
    const category = noteCategoryInput.value

    if (!content || !content.trim()) return

    const res = await fetch("/notes", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": "Bearer " + token
        },
        body: JSON.stringify({
            content: content,
            title: title,
            category: category
        })
    })

    if (res.status === 401) {
        alert("Session expired. Please login again.")
        logout(true)
        return
    }
    if (!res.ok) {
        setSaveStatus("Could not create the note. Your draft is still open.", true)
        return
    }

    document.getElementById("noteContent").value = ""
    noteTitleInput.value = ""
    noteCategoryInput.value = "Other"
    setComposerOpen(false)

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
        logout(true)
        return
    }

    fetchNotes()
}

// ----------------------------
// Logout
// ----------------------------
async function logout(sessionExpired = false) {
    if (!sessionExpired && activeNote && !(await closeNoteEditor())) return
    localStorage.removeItem("token")
    window.location.replace("/login")
}

// Initial Load
fetchNotes()