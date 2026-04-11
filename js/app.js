function renderUIByRole() {
    const role = DB.currentUser.role;

    if (role !== "SUPER_ADMIN") {
        const el = document.getElementById("menuUsers");
        if (el) el.style.display = "none";
    }
}
