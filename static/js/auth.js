const API_BASE = "http://127.0.0.1:8000";

// LOGIN
async function login() {
    const username = document.getElementById("username").value;
    const password = document.getElementById("password").value;

    const response = await fetch("http://127.0.0.1:8000/login", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({ username, password })
    });

    const data = await response.json();

    if (response.ok) {
        localStorage.setItem("token", data.access_token);
        window.location.href = "/dashboard";
    } else {
        document.getElementById("message").innerText = data.detail;
    }
}

// REGISTER
async function register() {
    const username = document.getElementById("username").value;
    const password = document.getElementById("password").value;

    const response = await fetch(`${API_BASE}/register`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({ username, password })
    });

    const data = await response.json();

    if (response.ok) {
        window.location.href = "/login";
    } else {
        document.getElementById("message").innerText = data.detail;
    }
}

// LOGOUT
function logout() {
    localStorage.removeItem("token");
    window.location.href = "/login";
}

// PROTECT DASHBOARD
if (window.location.pathname === "/dashboard") {
    const token = localStorage.getItem("token");
    if (!token) {
        window.location.href = "/login";
    }
}