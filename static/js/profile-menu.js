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

}