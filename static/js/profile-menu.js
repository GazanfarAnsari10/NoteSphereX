const profileMenu = document.querySelector("[data-profile-menu]")

if (profileMenu) {
    const profileButton = profileMenu.querySelector("#profileMenuButton")
    const profileDropdown = profileMenu.querySelector("#profileDropdown")

    function setProfileMenuOpen(isOpen, restoreFocus = false) {
        profileDropdown.hidden = !isOpen
        profileButton.setAttribute("aria-expanded", String(isOpen))
        profileButton.setAttribute("aria-label", isOpen ? "Close profile menu" : "Open profile menu")

        if (restoreFocus) profileButton.focus()
    }

    profileButton.addEventListener("click", () => {
        setProfileMenuOpen(profileDropdown.hidden)
    })

    document.addEventListener("pointerdown", event => {
        if (!profileMenu.contains(event.target)) setProfileMenuOpen(false)
    })

    document.addEventListener("keydown", event => {
        if (event.key === "Escape" && !profileDropdown.hidden) {
            setProfileMenuOpen(false, true)
        }
    })

    const usernameElement = document.querySelector("[data-account-username]")
    if (usernameElement) {
        try {
            const payloadPart = localStorage.getItem("token").split(".")[1]
            const base64 = payloadPart.replace(/-/g, "+").replace(/_/g, "/")
            const paddedBase64 = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=")
            const bytes = Uint8Array.from(atob(paddedBase64), character => character.charCodeAt(0))
            const payload = JSON.parse(new TextDecoder().decode(bytes))
            if (typeof payload.sub === "string" && payload.sub) {
                usernameElement.textContent = payload.sub
            }
        } catch {
            usernameElement.textContent = "Signed-in account"
        }
    }
}