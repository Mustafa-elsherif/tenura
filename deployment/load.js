const loading = document.getElementById("loading");
const assets = [
    "src/dashboard.py",
    "src/dashboard.css",
    "hr_analytics/__init__.py",
    "hr_analytics/release.py",
    "artifacts/demo.zip",
];
const files = Object.fromEntries(assets.map((path) => [
    path,
    { url: new URL(path, window.location.href).href },
]));

try {
    const { mount } = await import("https://cdn.jsdelivr.net/npm/@stlite/browser@1.12.3/build/stlite.js");
    mount({
        entrypoint: "src/dashboard.py",
        files,
        requirements: ["pandas", "pyarrow", "plotly==6.9.0"],
        streamlitConfig: {
            "theme.base": "light",
            "theme.primaryColor": "#09674F",
            "theme.backgroundColor": "#F5F7F5",
            "theme.secondaryBackgroundColor": "#EAF1EC",
            "theme.textColor": "#172820",
            "theme.sidebar.backgroundColor": "#10281F",
            "theme.sidebar.secondaryBackgroundColor": "#213D32",
            "theme.sidebar.textColor": "#F3F8F4",
            "theme.sidebar.primaryColor": "#9FE2C8",
            "client.toolbarMode": "minimal",
            "client.showErrorDetails": "none",
            "browser.gatherUsageStats": false,
        },
    }, document.getElementById("dashboard"));
} catch (error) {
    console.error("Workforce Atlas failed to initialize", error);
    loading.textContent = "The dashboard could not load. Check your connection and reload the page.";
}
