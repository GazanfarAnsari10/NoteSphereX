(() => {
    const loading = document.getElementById("publicNoteLoading")
    const note = document.getElementById("publicNote")
    const unavailable = document.getElementById("publicNoteUnavailable")
    const title = document.getElementById("publicNoteTitle")
    const content = document.getElementById("publicNoteContent")

    function showUnavailable() {
        loading.hidden = true
        note.hidden = true
        unavailable.hidden = false
    }

    async function loadPublicNote() {
        const tokenKey = "notesphere-public-share-token"
        const fragmentToken = new URLSearchParams(window.location.hash.slice(1)).get("token")
        const hasFragment = window.location.hash.length > 1
        let token = fragmentToken || ""
        try {
            if (fragmentToken === null && !hasFragment) {
                token = sessionStorage.getItem(tokenKey) || ""
            } else if (/^[A-Za-z0-9_-]{32,128}$/.test(fragmentToken)) {
                sessionStorage.setItem(tokenKey, fragmentToken)
            } else {
                sessionStorage.removeItem(tokenKey)
            }
        } catch {
            token = fragmentToken || ""
        }
        window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`)

        if (!/^[A-Za-z0-9_-]{32,128}$/.test(token)) {
            showUnavailable()
            return
        }

        try {
            const response = await fetch("/public/shares/resolve", {
                method: "POST",
                cache: "no-store",
                credentials: "omit",
                referrerPolicy: "no-referrer",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ token })
            })
            if (!response.ok) throw new Error("Share unavailable")

            const sharedNote = await response.json()
            title.textContent = sharedNote.title || "Untitled note"
            content.textContent = sharedNote.content || ""
            document.title = `${title.textContent} - NoteSphereX`
            loading.hidden = true
            note.hidden = false
        } catch {
            showUnavailable()
        }
    }

    loadPublicNote()
})()
