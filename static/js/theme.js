(() => {
    const preferenceKey = "notesphere-theme"
    const systemTheme = window.matchMedia("(prefers-color-scheme: dark)")
    const validPreferences = new Set(["light", "dark", "system"])
    const root = document.documentElement
    let preference = "system"

    try {
        const savedPreference = localStorage.getItem(preferenceKey)
        if (validPreferences.has(savedPreference)) preference = savedPreference
    } catch {
        preference = "system"
    }

    function applyTheme() {
        const resolvedTheme = preference === "system"
            ? (systemTheme.matches ? "dark" : "light")
            : preference

        root.dataset.theme = resolvedTheme
        root.dataset.themePreference = preference
    }

    function updateThemeControls() {
        document.querySelectorAll('input[name="themePreference"]').forEach(input => {
            input.checked = input.value === preference
            input.addEventListener("change", () => {
                if (!input.checked || !validPreferences.has(input.value)) return

                preference = input.value
                try {
                    localStorage.setItem(preferenceKey, preference)
                } catch {
                    // Keep the selected theme for the current page if storage is unavailable.
                }
                applyTheme()
            })
        })
    }

    applyTheme()

    systemTheme.addEventListener("change", () => {
        if (preference === "system") applyTheme()
    })

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", updateThemeControls, { once: true })
    } else {
        updateThemeControls()
    }
})()