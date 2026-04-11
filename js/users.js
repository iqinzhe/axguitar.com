function renderUsers() {
    if (DB.currentUser.role !== "SUPER_ADMIN") {
        return "<h3>No Permission</h3>";
    }

    return `
        <div>
            <h2>Users</h2>
            ${DB.users.map(u => `
                <div class="card">
                    👤 ${u.name} (${u.role})
                </div>
            `).join("")}
        </div>
    `;
}
