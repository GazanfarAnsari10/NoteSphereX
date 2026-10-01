const messagesToken = localStorage.getItem("token")
const messagesShell = document.getElementById("messagesShell")
const userSearch = document.getElementById("userSearch")
const userSearchResults = document.getElementById("userSearchResults")
const userSearchStatus = document.getElementById("userSearchStatus")
const conversationList = document.getElementById("conversationList")
const conversationCountBadge = document.getElementById("conversationCountBadge")
const chatEmptyState = document.getElementById("chatEmptyState")
const activeChat = document.getElementById("activeChat")
const activeUserAvatar = document.getElementById("activeUserAvatar")
const activeUserName = document.getElementById("activeUserName")
const messageThread = document.getElementById("messageThread")
const messageForm = document.getElementById("messageForm")
const messageInput = document.getElementById("messageInput")
const messageStatus = document.getElementById("messageStatus")
const sendMessageButton = document.getElementById("sendMessageButton")
const loadOlderMessagesButton = document.getElementById("loadOlderMessages")
const sidebarMenu = document.getElementById("sidebarMenu")
const sidebarClose = document.getElementById("sidebarClose")
const sidebarBackdrop = document.getElementById("sidebarBackdrop")
const sidebarCollapse = document.getElementById("sidebarCollapse")
const dashLayout = document.getElementById("dashLayout")
const mobileSidebar = window.matchMedia("(max-width: 800px)")

let currentUser = null
let activeConversation = null
let loadedConversations = []
let activeMessages = []
let searchTimer = null
let loadingOlderMessages = false

function showStatus(element, message, isError = false) {
    element.textContent = message
    element.hidden = !message
    element.dataset.state = isError ? "error" : ""
}

function readApiError(payload) {
    if (typeof payload.detail === "string") return payload.detail
    if (Array.isArray(payload.detail)) {
        const messages = payload.detail
            .map(error => error.msg)
            .filter(message => typeof message === "string")
        if (messages.length) return messages.join(" ")
    }
    return "Something went wrong. Please try again."
}

async function requestMessagesApi(path, options = {}) {
    const response = await fetch(path, {
        cache: "no-store",
        ...options,
        headers: {
            Authorization: `Bearer ${messagesToken}`,
            ...(options.headers || {})
        }
    })
    const payload = await response.json().catch(() => ({}))

    if (response.status === 401) {
        logout()
        throw new Error("Your session has expired.")
    }
    if (!response.ok) throw new Error(readApiError(payload))
    return payload
}

function shortTime(value) {
    if (!value) return ""
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return ""
    return new Intl.DateTimeFormat(undefined, {
        hour: "numeric",
        minute: "2-digit"
    }).format(date)
}

function makeAvatar(username) {
    const avatar = document.createElement("span")
    avatar.className = "messages-avatar"
    avatar.setAttribute("aria-hidden", "true")
    avatar.textContent = username.trim().charAt(0).toUpperCase() || "?"
    return avatar
}

function renderConversations(conversations) {
    conversationList.replaceChildren()
    conversationCountBadge.textContent = conversations.length === 1
        ? "1 conversation"
        : `${conversations.length} conversations`

    if (!conversations.length) {
        const empty = document.createElement("div")
        empty.className = "messages-list-placeholder"
        empty.textContent = "No conversations yet. Search for a user to start one."
        conversationList.appendChild(empty)
        return
    }

    conversations.forEach(conversation => {
        const button = document.createElement("button")
        button.type = "button"
        button.className = "messages-conversation-item"
        button.classList.toggle("is-active", activeConversation?.id === conversation.id)
        button.setAttribute("role", "listitem")
        button.setAttribute("aria-current", activeConversation?.id === conversation.id ? "true" : "false")
        button.addEventListener("click", () => openConversation(conversation))

        button.appendChild(makeAvatar(conversation.other_user.username))
        const details = document.createElement("span")
        details.className = "messages-conversation-details"
        const name = document.createElement("span")
        name.className = "messages-conversation-name"
        name.textContent = conversation.other_user.username
        const preview = document.createElement("span")
        preview.className = "messages-conversation-preview"
        preview.textContent = conversation.last_message?.content || "No messages yet"
        details.append(name, preview)
        button.appendChild(details)

        const time = document.createElement("span")
        time.className = "messages-conversation-time"
        time.textContent = shortTime(conversation.last_message?.created_at || conversation.created_at)
        button.appendChild(time)
        conversationList.appendChild(button)
    })
}

async function refreshConversations() {
    loadedConversations = await requestMessagesApi("/messages/conversations")
    renderConversations(loadedConversations)
    return loadedConversations
}

function renderMessageHistory() {
    messageThread.replaceChildren()
    if (!activeMessages.length) {
        const empty = document.createElement("li")
        empty.className = "messages-thread-empty"
        empty.textContent = "Start the conversation with a message."
        messageThread.appendChild(empty)
        return
    }

    activeMessages.forEach(message => {
        const item = document.createElement("li")
        item.className = "messages-message"
        const isOwnMessage = message.sender_id === currentUser.id
        item.classList.toggle("is-own-message", isOwnMessage)

        const sender = document.createElement("span")
        sender.className = "messages-message-sender"
        sender.textContent = isOwnMessage ? "You" : message.sender_username
        const bubble = document.createElement("p")
        bubble.className = "messages-message-bubble"
        bubble.textContent = message.content
        const time = document.createElement("time")
        time.className = "messages-message-time"
        time.dateTime = message.created_at
        time.textContent = shortTime(message.created_at)
        item.append(sender, bubble, time)
        messageThread.appendChild(item)
    })
}

async function loadConversationMessages(conversationId) {
    const messages = await requestMessagesApi(
        `/messages/conversations/${conversationId}/messages?limit=100`
    )
    if (activeConversation?.id !== conversationId) return
    activeMessages = messages
    renderMessageHistory()
    loadOlderMessagesButton.hidden = messages.length < 100
    messageThread.scrollTop = messageThread.scrollHeight
}

async function openConversation(conversation) {
    activeConversation = conversation
    activeUserName.textContent = conversation.other_user.username
    activeUserAvatar.textContent = conversation.other_user.username.trim().charAt(0).toUpperCase() || "?"
    chatEmptyState.hidden = true
    activeChat.hidden = false
    messagesShell.classList.add("has-active-chat")
    showStatus(messageStatus, "")
    renderConversations(loadedConversations)

    try {
        await loadConversationMessages(conversation.id)
    } catch (error) {
        activeMessages = []
        renderMessageHistory()
        showStatus(messageStatus, error.message, true)
    }
}

async function searchUsers(query) {
    userSearchResults.replaceChildren()
    userSearchResults.hidden = true
    showStatus(userSearchStatus, "")
    if (!query) return

    try {
        const users = await requestMessagesApi(`/messages/users?query=${encodeURIComponent(query)}`)
        if (!users.length) {
            showStatus(userSearchStatus, `No users found for "${query}".`)
            return
        }

        users.forEach(user => {
            const button = document.createElement("button")
            button.type = "button"
            button.className = "messages-search-result"
            button.setAttribute("role", "option")
            button.appendChild(makeAvatar(user.username))
            const name = document.createElement("span")
            name.textContent = user.username
            button.appendChild(name)
            button.addEventListener("click", () => startConversation(user.username, button))
            userSearchResults.appendChild(button)
        })
        userSearchResults.hidden = false
    } catch (error) {
        showStatus(userSearchStatus, error.message, true)
    }
}

async function startConversation(username, resultButton) {
    resultButton.disabled = true
    showStatus(userSearchStatus, "Opening conversation...")
    try {
        const conversation = await requestMessagesApi("/messages/conversations", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username })
        })
        userSearch.value = ""
        userSearchResults.replaceChildren()
        userSearchResults.hidden = true
        showStatus(userSearchStatus, "")
        const conversations = await refreshConversations()
        await openConversation(conversations.find(item => item.id === conversation.id) || conversation)
    } catch (error) {
        resultButton.disabled = false
        showStatus(userSearchStatus, error.message, true)
    }
}

userSearch.addEventListener("input", () => {
    clearTimeout(searchTimer)
    const query = userSearch.value.trim()
    searchTimer = setTimeout(() => searchUsers(query), 250)
})

userSearch.addEventListener("keydown", event => {
    if (event.key === "Escape") {
        userSearchResults.hidden = true
        userSearch.blur()
    }
})

document.getElementById("focusUserSearch").addEventListener("click", () => {
    userSearch.focus()
})

document.getElementById("backToConversations").addEventListener("click", () => {
    messagesShell.classList.remove("has-active-chat")
    userSearch.focus({ preventScroll: true })
})

messageInput.addEventListener("input", () => {
    messageInput.style.height = "auto"
    messageInput.style.height = `${Math.min(messageInput.scrollHeight, 140)}px`
})

messageInput.addEventListener("keydown", event => {
    if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault()
        messageForm.requestSubmit()
    }
})

messageForm.addEventListener("submit", async event => {
    event.preventDefault()
    const content = messageInput.value.trim()
    if (!content || !activeConversation) return

    sendMessageButton.disabled = true
    showStatus(messageStatus, "")
    try {
        const message = await requestMessagesApi(
            `/messages/conversations/${activeConversation.id}/messages`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ content })
            }
        )
        activeMessages.push(message)
        messageInput.value = ""
        messageInput.style.height = "auto"
        renderMessageHistory()
        messageThread.scrollTop = messageThread.scrollHeight
        const conversations = await refreshConversations()
        activeConversation = conversations.find(item => item.id === activeConversation.id) || activeConversation
        renderConversations(conversations)
    } catch (error) {
        showStatus(messageStatus, error.message, true)
    } finally {
        sendMessageButton.disabled = false
        messageInput.focus()
    }
})

loadOlderMessagesButton.addEventListener("click", async () => {
    if (!activeConversation || !activeMessages.length || loadingOlderMessages) return
    loadingOlderMessages = true
    loadOlderMessagesButton.disabled = true
    const previousHeight = messageThread.scrollHeight
    const beforeId = activeMessages[0].id
    try {
        const olderMessages = await requestMessagesApi(
            `/messages/conversations/${activeConversation.id}/messages?limit=100&before_id=${beforeId}`
        )
        activeMessages = olderMessages.concat(activeMessages)
        renderMessageHistory()
        messageThread.scrollTop = messageThread.scrollHeight - previousHeight
        loadOlderMessagesButton.hidden = olderMessages.length < 100
    } catch (error) {
        showStatus(messageStatus, error.message, true)
    } finally {
        loadingOlderMessages = false
        loadOlderMessagesButton.disabled = false
    }
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

document.querySelectorAll(".dash-sidebar-link").forEach(link => {
    link.addEventListener("click", () => {
        if (mobileSidebar.matches) setSidebarOpen(false)
    })
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

async function initializeMessages() {
    if (!messagesToken) {
        window.location.replace("/login")
        return
    }

    try {
        currentUser = await requestMessagesApi("/users/me")
        await refreshConversations()
    } catch (error) {
        if (localStorage.getItem("token")) {
            const placeholder = conversationList.querySelector(".messages-list-placeholder")
            if (placeholder) placeholder.textContent = error.message
        }
    }
}

initializeMessages()
