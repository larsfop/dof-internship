; Install-dof-pdf-server.nsi
; NSIS installer for dof-pdf server backend.
; Compile with: makensis Install-dof-pdf-server.nsi

!define APP_NAME    "dof-pdf"
!define APP_VERSION "1.0"
!define APP_GUID    "{A1B2C3D4-E5F6-7890-ABCD-EF1234567890}"
!define SRC_DIR     "app_backend"

; ── Compiler settings ────────────────────────────────────────────────────────
Name            "${APP_NAME} ${APP_VERSION}"
OutFile         "${APP_NAME}-server-installer.exe"
InstallDir      "$PROGRAMFILES64\${APP_NAME}"
RequestExecutionLevel admin
SetCompressor   /SOLID lzma

; ── Modern UI ────────────────────────────────────────────────────────────────
!include "MUI2.nsh"
!include "LogicLib.nsh"

!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES

!define MUI_FINISHPAGE_RUN
!define MUI_FINISHPAGE_RUN_TEXT    "Start Docker services"
!define MUI_FINISHPAGE_RUN_FUNCTION StartDockerServices
!insertmacro MUI_PAGE_FINISH

!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES

!insertmacro MUI_LANGUAGE "English"

; ── Pre-flight Docker checks ─────────────────────────────────────────────────
Function .onInit
  nsExec::ExecToStack 'cmd.exe /c docker --version'
  Pop $0   ; exit code
  Pop $1   ; output
  ${If} $0 != 0
    MessageBox MB_OK|MB_ICONSTOP \
      "Docker was not found in PATH.$\r$\n\
       Please install Docker Desktop from:$\r$\n\
       https://www.docker.com/products/docker-desktop$\r$\n\
       Then re-run this installer."
    Abort
  ${EndIf}

  nsExec::ExecToStack 'cmd.exe /c docker info'
  Pop $0
  Pop $1
  ${If} $0 != 0
    MessageBox MB_OK|MB_ICONSTOP \
      "Docker daemon is not running.$\r$\n\
       Please start Docker Desktop and re-run this installer."
    Abort
  ${EndIf}
FunctionEnd

; ── Finish-page: start Docker services ───────────────────────────────────────
Function StartDockerServices
  SetOutPath "$INSTDIR"
  nsExec::ExecToLog 'cmd.exe /c docker compose up --build -d'
FunctionEnd

; ── Main install section ──────────────────────────────────────────────────────
Section "Main" SEC_MAIN

  ; ── ProgramData (app binaries / compose / api) ───────────────────────────
  SetOutPath "$INSTDIR"
  IfFileExists "$INSTDIR\*.*" +2 0
    File "${SRC_DIR}\docker-compose.yml"
    File /nonfatal "${SRC_DIR}\.env"

  File "${SRC_DIR}\dockerfile"
  File "${SRC_DIR}\requirements.txt"

  SetOutPath "$INSTDIR\src"
  File /r "${SRC_DIR}\src\*"

  ; ── Documents (user data / configs) ──────────────────────────────────────
  IfFileExists "$DOCUMENTS\${APP_NAME}\volumes\data\*.*" +2 0
    SetOutPath "$DOCUMENTS\${APP_NAME}\volumes\data\configs"
    File /nonfatal /r "${SRC_DIR}\volumes\data\configs\*"

  SetOutPath "$DOCUMENTS\${APP_NAME}\volumes\data\lnav"
  File /nonfatal /r "${SRC_DIR}\volumes\data\lnav\*"

  ; Setup directory structure for runtime data
  CreateDirectory "$DOCUMENTS\${APP_NAME}\volumes\data\logs"
  CreateDirectory "$DOCUMENTS\${APP_NAME}\volumes\data\partitions"
  CreateDirectory "$DOCUMENTS\${APP_NAME}\volumes\pg-data"
  CreateDirectory "$DOCUMENTS\${APP_NAME}\volumes\pgadmin-data"

  SetOutPath "$DOCUMENTS\${APP_NAME}"
  File /nonfatal "${SRC_DIR}\README.md"
  File /nonfatal "${SRC_DIR}\*.ps1"

  ; ── Uninstaller ───────────────────────────────────────────────────────────
  WriteUninstaller "$INSTDIR\uninstall.exe"
  WriteRegStr HKLM \
    "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_GUID}" \
    "DisplayName"    "${APP_NAME}"
  WriteRegStr HKLM \
    "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_GUID}" \
    "DisplayVersion" "${APP_VERSION}"
  WriteRegStr HKLM \
    "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_GUID}" \
    "UninstallString" '"$INSTDIR\uninstall.exe"'

SectionEnd

; ── Uninstall section ─────────────────────────────────────────────────────────
Section "Uninstall"

  ; Stop and remove Docker containers
  SetOutPath "$INSTDIR"
  nsExec::Exec 'cmd.exe /c docker compose down'

  ; Remove installed files
  RMDir /r "$INSTDIR"
  RMDir /r "$DOCUMENTS\${APP_NAME}"

  ; Remove registry entries
  DeleteRegKey HKLM \
    "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_GUID}"

SectionEnd
