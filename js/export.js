const Export = {

    toJSON(db) {
        const blob = new Blob([JSON.stringify(db)], { type: "application/json" });
        const url = URL.createObjectURL(blob);

        const a = document.createElement("a");
        a.href = url;
        a.download = "jf-gadai-backup.json";
        a.click();
    }
};

window.Export = Export;
