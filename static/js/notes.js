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
const selectModeButton = document.getElementById("selectModeButton")
const noteSelectionControls = document.getElementById("noteSelectionControls")
const selectAllNotes = document.getElementById("selectAllNotes")
const selectedNoteCount = document.getElementById("selectedNoteCount")
const deleteSelectedButton = document.getElementById("deleteSelectedButton")
const bulkDeleteStatus = document.getElementById("bulkDeleteStatus")
const noteShareDialog = document.getElementById("noteShareDialog")
const noteShareNoteTitle = document.getElementById("noteShareNoteTitle")
const noteShareConversation = document.getElementById("noteShareConversation")
const noteShareUserSearch = document.getElementById("noteShareUserSearch")
const noteShareUserResults = document.getElementById("noteShareUserResults")
const noteShareStatus = document.getElementById("noteShareStatus")
const confirmNoteShareButton = document.getElementById("confirmNoteShare")
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
let selectionMode = false
const selectedNoteIds = new Set()
let noteToShare = null
let noteShareSearchTimer = null

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

function getMatchingNotes() {
    return loadedNotes.filter(note => {
        const searchableText = `${note.title || ""}\n${note.content || ""}\n${note.category || "Other"}`.toLowerCase()
        return searchableText.includes(searchTerm)
    })
}

function updateSelectionControls() {
    const matchingNotes = getMatchingNotes()
    const selectedVisibleCount = matchingNotes.filter(note => selectedNoteIds.has(note.id)).length

    selectedNoteCount.textContent = `${selectedNoteIds.size} selected`
    deleteSelectedButton.disabled = selectedNoteIds.size === 0
    selectAllNotes.checked = matchingNotes.length > 0 && selectedVisibleCount === matchingNotes.length
    selectAllNotes.indeterminate = selectedVisibleCount > 0 && selectedVisibleCount < matchingNotes.length
}

function setSelectionMode(isActive) {
    selectionMode = isActive
    selectModeButton.textContent = isActive ? "Cancel" : "Select"
    selectModeButton.setAttribute("aria-pressed", String(isActive))
    noteSelectionControls.hidden = !isActive
    bulkDeleteStatus.hidden = true
    bulkDeleteStatus.textContent = ""

    if (!isActive) selectedNoteIds.clear()
    renderNotes()
}

function toggleNoteSelection(noteId) {
    if (selectedNoteIds.has(noteId)) selectedNoteIds.delete(noteId)
    else selectedNoteIds.add(noteId)

    const card = document.querySelector(`.note-card[data-note-id="${noteId}"]`)
    if (card) {
        card.classList.toggle("is-selected", selectedNoteIds.has(noteId))
        const checkbox = card.querySelector(".note-select-checkbox")
        if (checkbox) checkbox.checked = selectedNoteIds.has(noteId)
    }
    updateSelectionControls()
}

selectModeButton.addEventListener("click", () => setSelectionMode(!selectionMode))

selectAllNotes.addEventListener("change", () => {
    getMatchingNotes().forEach(note => {
        if (selectAllNotes.checked) selectedNoteIds.add(note.id)
        else selectedNoteIds.delete(note.id)
    })
    renderNotes()
})

deleteSelectedButton.addEventListener("click", deleteSelectedNotes)
document.getElementById("closeNoteShare").addEventListener("click", () => noteShareDialog.close())
document.getElementById("cancelNoteShare").addEventListener("click", () => noteShareDialog.close())
confirmNoteShareButton.addEventListener("click", confirmNoteShare)

noteShareUserSearch.addEventListener("input", () => {
    clearTimeout(noteShareSearchTimer)
    const query = noteShareUserSearch.value.trim()
    noteShareSearchTimer = setTimeout(() => searchShareUsers(query), 250)
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

function showNoteShareStatus(message, isError = false) {
    noteShareStatus.textContent = message
    noteShareStatus.hidden = !message
    noteShareStatus.dataset.state = isError ? "error" : ""
}

async function requestNoteShareApi(path, options = {}) {
    const response = await fetch(path, {
        ...options,
        headers: {
            Authorization: `Bearer ${token}`,
            ...(options.headers || {})
        }
    })
    const payload = await response.json().catch(() => ({}))

    if (response.status === 401) {
        logout(true)
        throw new Error("Your session has expired. Please log in again.")
    }
    if (!response.ok) {
        if (typeof payload.detail === "string") throw new Error(payload.detail)
        throw new Error("Could not share the note. Please try again.")
    }
    return payload
}

function selectShareConversation(conversation) {
    const value = String(conversation.id)
    let option = Array.from(noteShareConversation.options).find(item => item.value === value)
    if (!option) {
        option = document.createElement("option")
        option.value = value
        option.textContent = conversation.other_user.username
        noteShareConversation.appendChild(option)
    }
    noteShareConversation.value = value
    showNoteShareStatus(`Conversation with ${conversation.other_user.username} selected.`)
}

async function openNoteShare(note) {
    noteToShare = note
    noteShareNoteTitle.textContent = note.title?.trim() || "Untitled note"
    noteShareConversation.replaceChildren(new Option("Select a conversation", ""))
    noteShareUserSearch.value = ""
    noteShareUserResults.replaceChildren()
    noteShareUserResults.hidden = true
    confirmNoteShareButton.disabled = false
    confirmNoteShareButton.textContent = "Share note"
    showNoteShareStatus("Loading conversations...")
    noteShareDialog.showModal()

    try {
        const conversations = await requestNoteShareApi("/messages/conversations")
        conversations.forEach(conversation => {
            const option = document.createElement("option")
            option.value = String(conversation.id)
            option.textContent = conversation.other_user.username
            noteShareConversation.appendChild(option)
        })
        showNoteShareStatus(conversations.length ? "" : "No conversations yet. Search for a user to start one.")
    } catch (error) {
        showNoteShareStatus(error.message, true)
    }
}

async function searchShareUsers(query) {
    noteShareUserResults.replaceChildren()
    noteShareUserResults.hidden = true
    if (!query) {
        showNoteShareStatus("")
        return
    }

    try {
        const users = await requestNoteShareApi(`/messages/users?query=${encodeURIComponent(query)}`)
        if (!users.length) {
            showNoteShareStatus(`No users found for "${query}".`)
            return
        }

        users.forEach(user => {
            const button = document.createElement("button")
            button.type = "button"
            button.className = "note-share-result"
            button.setAttribute("role", "option")
            button.textContent = user.username
            button.addEventListener("click", async () => {
                button.disabled = true
                showNoteShareStatus("Opening conversation...")
                try {
                    const conversation = await requestNoteShareApi("/messages/conversations", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ username: user.username })
                    })
                    selectShareConversation(conversation)
                    noteShareUserResults.hidden = true
                    noteShareUserSearch.value = ""
                } catch (error) {
                    button.disabled = false
                    showNoteShareStatus(error.message, true)
                }
            })
            noteShareUserResults.appendChild(button)
        })
        noteShareUserResults.hidden = false
        showNoteShareStatus("")
    } catch (error) {
        showNoteShareStatus(error.message, true)
    }
}

async function confirmNoteShare() {
    const conversationId = noteShareConversation.value
    if (!noteToShare || !conversationId) {
        showNoteShareStatus("Choose a conversation or search for a user first.", true)
        return
    }

    confirmNoteShareButton.disabled = true
    showNoteShareStatus("Sharing note...")
    try {
        await requestNoteShareApi(`/messages/conversations/${conversationId}/note-shares`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ note_id: noteToShare.id })
        })
        confirmNoteShareButton.textContent = "Shared"
        showNoteShareStatus("Note shared successfully.")
    } catch (error) {
        confirmNoteShareButton.disabled = false
        showNoteShareStatus(error.message, true)
    }
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
        updateSelectionControls()
        return
    }

    const matchingNotes = getMatchingNotes()

    if (matchingNotes.length === 0) {
        const empty = document.createElement("div")
        empty.classList.add("dash-empty")
        empty.innerHTML = `
            <div class="dash-empty-title">No matching notes found</div>
            <div class="dash-empty-sub">Try another search term.</div>
        `
        container.appendChild(empty)
        updateSelectionControls()
        return
    }

    matchingNotes.forEach(note => {
        const div = document.createElement("div")
        div.classList.add("note-card")
        div.dataset.noteId = String(note.id)
        div.classList.toggle("is-select-mode", selectionMode)
        div.classList.toggle("is-selected", selectedNoteIds.has(note.id))
        div.tabIndex = 0
        div.setAttribute("role", "article")
        div.setAttribute("aria-label", `Open note: ${note.title?.trim() || "Untitled note"}`)
        div.addEventListener("click", event => {
            if (event.target.closest("button, input, label")) return
            if (selectionMode) {
                toggleNoteSelection(note.id)
                return
            }
            openExistingNote(note)
        })
        div.addEventListener("keydown", event => {
            if (event.target !== div || (event.key !== "Enter" && event.key !== " ")) return
            event.preventDefault()
            if (selectionMode) toggleNoteSelection(note.id)
            else openExistingNote(note)
        })

        const heading = document.createElement("div")
        heading.classList.add("note-card-heading")

        if (selectionMode) {
            const selectionLabel = document.createElement("label")
            selectionLabel.classList.add("note-select-label")
            selectionLabel.setAttribute("aria-label", `Select ${note.title?.trim() || "Untitled note"}`)

            const checkbox = document.createElement("input")
            checkbox.type = "checkbox"
            checkbox.classList.add("note-select-checkbox")
            checkbox.checked = selectedNoteIds.has(note.id)
            checkbox.addEventListener("click", event => event.stopPropagation())
            checkbox.addEventListener("change", () => toggleNoteSelection(note.id))

            selectionLabel.appendChild(checkbox)
            heading.appendChild(selectionLabel)
        }

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

        const shareBtn = createNoteActionButton(
            "Share note",
            "note-btn note-btn-share",
            '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 10.7 6.8-4.4m-6.8 7 6.8 4.1"/></svg><span>Share</span>'
        )
        shareBtn.addEventListener("click", event => {
            event.stopPropagation()
            openNoteShare(note)
        })

        const deleteBtn = createNoteActionButton(
            "Delete note",
            "note-btn note-btn-delete note-btn-icon",
            '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="m19 6-1 14H6L5 6"/><path d="M10 11v5m4-5v5"/></svg>'
        )
        deleteBtn.onclick = event => {
            event.stopPropagation()
            deleteNote(note.id)
        }

        actions.append(shareBtn, deleteBtn)

        div.appendChild(heading)
        div.appendChild(text)
        div.appendChild(actions)
        container.appendChild(div)
    })
    updateSelectionControls()
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
    const loadedNoteIds = new Set(notes.map(note => note.id))
    selectedNoteIds.forEach(noteId => {
        if (!loadedNoteIds.has(noteId)) selectedNoteIds.delete(noteId)
    })

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

async function deleteSelectedNotes() {
    const noteIds = Array.from(selectedNoteIds)
    if (noteIds.length === 0) return
    if (!confirm(`Delete ${noteIds.length} selected note${noteIds.length === 1 ? "" : "s"}? This cannot be undone.`)) return

    deleteSelectedButton.disabled = true
    bulkDeleteStatus.hidden = true
    bulkDeleteStatus.textContent = ""

    try {
        const response = await fetch("/notes/bulk-delete", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": "Bearer " + token
            },
            body: JSON.stringify({ note_ids: noteIds })
        })

        if (response.status === 401) {
            alert("Session expired. Please login again.")
            logout(true)
            return
        }
        if (!response.ok) throw new Error("Bulk delete failed")

        const result = await response.json()
        const requestedIds = new Set(noteIds)
        loadedNotes = loadedNotes.filter(note => !requestedIds.has(note.id))
        setSelectionMode(false)
        bulkDeleteStatus.textContent = `${result.deleted_count} note${result.deleted_count === 1 ? "" : "s"} deleted.`
        bulkDeleteStatus.hidden = false
    } catch {
        bulkDeleteStatus.textContent = "Could not delete the selected notes. Please try again."
        bulkDeleteStatus.hidden = false
        deleteSelectedButton.disabled = selectedNoteIds.size === 0
    }
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