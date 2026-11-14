# ==============================================================================
# Pomodoro App - Windows Uninstaller
# ==============================================================================

Add-Type -AssemblyName System.Windows.Forms
$ErrorActionPreference = "SilentlyContinue"

$res = [System.Windows.Forms.MessageBox]::Show(
    "Möchtest du die Pomodoro App wirklich vollständig von deinem System entfernen?",
    "Pomodoro Deinstallation",
    [System.Windows.Forms.MessageBoxButtons]::YesNo,
    [System.Windows.Forms.MessageBoxIcon]::Question
)

if ($res -ne [System.Windows.Forms.DialogResult]::Yes) {
    exit 0
}

$InstallDir = Split-Path -Parent $MyInvocation.MyCommand.Path

# 1. Remove Shortcuts
$DesktopDir = [System.Environment]::GetFolderPath("Desktop")
$DesktopShortcut = "$DesktopDir\Pomodoro.lnk"
if (Test-Path $DesktopShortcut) { Remove-Item $DesktopShortcut -Force }

$StartMenuDir = "$env:APPDATA\Microsoft\Windows\Start Menu\Programs"
$StartShortcut = "$StartMenuDir\Pomodoro.lnk"
if (Test-Path $StartShortcut) { Remove-Item $StartShortcut -Force }

# 2. Remove Registry Entry
$UninstallKey = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\PomodoroApp"
if (Test-Path $UninstallKey) { Remove-Item $UninstallKey -Recurse -Force }

# 3. Schedule Self-Deletion of Directory via background cmd
Start-Process cmd.exe -ArgumentList "/c timeout /t 2 /nobreak >nul & rmdir /s /q `"$InstallDir`"" -WindowStyle Hidden

[System.Windows.Forms.MessageBox]::Show(
    "Pomodoro wurde erfolgreich entfernt.",
    "Deinstallation abgeschlossen",
    [System.Windows.Forms.MessageBoxButtons]::OK,
    [System.Windows.Forms.MessageBoxIcon]::Information
)
