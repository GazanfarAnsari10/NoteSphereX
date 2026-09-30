(() => {
    const token = localStorage.getItem("token")
    if (!token) {
        logout()
        return
    }

    const accountName = document.querySelector("[data-account-username]")
    const accountMessage = document.querySelector("[data-account-message]")
    const passwordForm = document.getElementById("settingsPasswordForm")
    const passwordMessage = document.getElementById("settingsPasswordMessage")
    const submitButton = passwordForm.querySelector("[type='submit']")

    function setPasswordMessage(message, state = "") {
        passwordMessage.textContent = message
        if (state) passwordMessage.dataset.state = state
        else delete passwordMessage.dataset.state
    }

    function readErrorMessage(payload) {
        if (typeof payload.detail === "string") return payload.detail
        if (Array.isArray(payload.detail)) {
            const messages = payload.detail
                .map(error => error.msg)
                .filter(message => typeof message === "string")
            if (messages.length) return messages.join(" ")
        }
        return "Unable to update your password. Please try again."
    }

    async function loadAccount() {
        try {
            const response = await fetch("/users/me", {
                headers: { "Authorization": `Bearer ${token}` }
            })

            if (response.status === 401) {
                logout()
                return
            }
            if (!response.ok) throw new Error("Account request failed")

            const account = await response.json()
            accountName.textContent = account.username
            accountMessage.hidden = true
        } catch {
            accountName.textContent = "Account unavailable"
            accountMessage.textContent = "Unable to load account information. Please try again later."
            accountMessage.hidden = false
        }
    }

    passwordForm.addEventListener("submit", async event => {
        event.preventDefault()

        const currentPassword = passwordForm.elements.current_password.value
        const newPassword = passwordForm.elements.new_password.value
        const confirmPassword = passwordForm.elements.confirm_password.value

        if (newPassword !== confirmPassword) {
            setPasswordMessage("New password and confirmation do not match.", "error")
            return
        }

        setPasswordMessage("")
        submitButton.disabled = true

        try {
            const response = await fetch("/users/me/password", {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify({ current_password: currentPassword, new_password: newPassword })
            })
            const payload = await response.json().catch(() => ({}))

            if (response.status === 401) {
                logout()
                return
            }
            if (!response.ok) {
                setPasswordMessage(readErrorMessage(payload), "error")
                return
            }

            passwordForm.reset()
            setPasswordMessage(payload.message || "Password updated successfully.", "success")
        } catch {
            setPasswordMessage("Unable to update your password. Please try again.", "error")
        } finally {
            submitButton.disabled = false
        }
    })

    loadAccount()
})()