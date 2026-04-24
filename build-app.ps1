param (
    [parameter(Mandatory=$false)]
    [string]$AppName = "dof-pdf"
)

cd app

# ── Build the Tauri app ───────────────────────────────────────────────────────
npm run tauri build

mv -Force "src-tauri/target/release/$AppName.exe" "../$AppName.exe"

cd ..