const profileMenu = document.querySelector("[data-profile-menu]")

if (profileMenu) {
    const profileButton = profileMenu.querySelector("#profileMenuButton")
    const profileDropdown = profileMenu.querySelector("#profileDropdown")
    const pageToken = localStorage.getItem("token")
    if (["/dashboard", "/settings", "/messages"].includes(window.location.pathname)) {
        window.addEventListener("pagehide", () => {
            document.documentElement.style.visibility = "hidden"
        })

        window.addEventListener("pageshow", event => {
            if (!event.persisted) {
                document.documentElement.style.removeProperty("visibility")
                return
            }

            document.documentElement.style.visibility = "hidden"
            const restoredToken = localStorage.getItem("token")
            if (!restoredToken) {
                logout()
                return
            }

            if (restoredToken !== pageToken) {
                window.location.replace("/dashboard")
                return
            }

            fetch("/users/me", {
                cache: "no-store",
                headers: { "Authorization": `Bearer ${restoredToken}` }
            }).then(response => {
                if (!response.ok) {
                    logout()
                    return
                }

                document.documentElement.style.removeProperty("visibility")
            }).catch(() => logout())
        })
    }

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