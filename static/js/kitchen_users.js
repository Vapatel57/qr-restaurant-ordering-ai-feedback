function createUser() {
    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value.trim();

    if (!email || !password) {
        alert("Email and password required");
        return;
    }

    fetch("/api/kitchen-users", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({ email, password })
    })
    .then(res => res.json())
    .then(data => {
        if (data.success) {
            location.reload();
        } else {
            alert(data.error || "Failed to create user");
        }
    })
    .catch(err => {
        console.error(err);
        alert("Server error");
    });
}

function deleteUser(id) {
    if (!confirm("Delete this kitchen user?")) return;

    fetch(`/api/kitchen-users/${id}`, {
        method: "DELETE"
    })
    .then(res => res.json())
    .then(() => location.reload())
    .catch(() => alert("Failed to delete user"));
}
