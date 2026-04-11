function addLog(action, data) {
    DB.logs.push({
        user: DB.currentUser.username,
        role: DB.currentUser.role,
        action,
        data,
        time: new Date().toISOString()
    });
}

function renderLogs() {
    return `
        <div>
            <h2>Logs</h2>
            ${DB.logs.map(l => `
                <div class="card">
                    ${l.user} - ${l.action} - ${l.time}
                </div>
            `).join("")}
        </div>
    `;
}
