let currentPage = "dashboard";

function navigate(page) {
    currentPage = page;
    renderPage();
}

function renderPage() {
    const el = document.getElementById("page");

    switch(currentPage) {
        case "dashboard":
            el.innerHTML = renderDashboard();
            break;
        case "loans":
            el.innerHTML = renderLoans();
            break;
        case "payments":
            el.innerHTML = renderPayments();
            break;
        case "logs":
            el.innerHTML = renderLogs();
            break;
        case "users":
            el.innerHTML = renderUsers();
            break;
    }
}
