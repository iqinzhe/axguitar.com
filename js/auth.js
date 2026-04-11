function login() {
    const u = document.getElementById("username").value;
    const p = document.getElementById("password").value;

    const user = DB.users.find(x => x.username === u && x.password === p);

    if (!user) return alert("Login gagal");

    DB.currentUser = user;

    document.getElementById("loginPage").style.display = "none";
    document.getElementById("adminApp").style.display = "flex";

    renderUIByRole();
    navigate("dashboard");
}

function logout() {
    DB.currentUser = null;
    location.reload();
}
