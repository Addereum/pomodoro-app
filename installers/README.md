# 📦 Pomodoro App - Installer & Distribution (Linux & Windows)

Dieser Ordner enthält fertige Pakete und Generierungs-Skripte für alle gängigen Linux-Distributionen (Ubuntu, Debian, Fedora, Arch Linux, openSUSE etc.) sowie für **Windows 10 & 11**.

---

## 🎯 Fertige Installationspakete (`installers/dist/`)

Alle Pakete liegen installationsbereit im Verzeichnis [`installers/dist/`](file:///home/lukas/Apps/pomodoro-app/installers/dist):

| Plattform / Typ | Dateiname | Installation / Verwendung |
| :--- | :--- | :--- |
| **Windows 10 / 11 (App & Setup)** | [`dist/pomodoro-app-1.0.0-windows-x64.zip`](file:///home/lukas/Apps/pomodoro-app/installers/dist/pomodoro-app-1.0.0-windows-x64.zip) | Entpacken -> `Setup.exe` (Grafischer Installer) oder direkt `Pomodoro.exe` |
| **Ubuntu / Debian / Mint / Pop!_OS** | [`dist/pomodoro-app_1.0.0_all.deb`](file:///home/lukas/Apps/pomodoro-app/installers/dist/pomodoro-app_1.0.0_all.deb) | `sudo apt install ./dist/pomodoro-app_1.0.0_all.deb` |
| **Fedora / RHEL / CentOS / openSUSE** | [`dist/pomodoro-app-1.0.0-1.fc45.noarch.rpm`](file:///home/lukas/Apps/pomodoro-app/installers/dist/pomodoro-app-1.0.0-1.fc45.noarch.rpm) | `sudo dnf install ./dist/pomodoro-app-1.0.0-*.rpm` |
| **Universal Portable Linux** | [`dist/pomodoro-app-1.0.0-linux-x86_64-portable.tar.gz`](file:///home/lukas/Apps/pomodoro-app/installers/dist/pomodoro-app-1.0.0-linux-x86_64-portable.tar.gz) | `tar -xzf ... && ./pomodoro` |
| **Integritätsprüfung** | `SHA256SUMS` | `sha256sum -c SHA256SUMS` |

---

## 🪟 Windows (.exe & Installer)

Für Windows liegt in [`installers/dist/windows/`](file:///home/lukas/Apps/pomodoro-app/installers/dist/windows) ein komplett fertiges Paket bereit:

1. **`Setup.exe`**: Ein moderner grafischer Installer im Dark-Mode-Design.
   - Installiert die App nach `%LOCALAPPDATA%\Programs\PomodoroApp` (keine Administrator-Rechte / UAC nötig).
   - Erstellt optional ein Desktop-Icon und einen Startmenü-Eintrag.
   - Registriert die App sauber in den Windows-Einstellungen (*Apps und Features*) inklusive Uninstaller.
2. **`Pomodoro.exe`**: Startet die Anwendung direkt in einem randlosen, schlanken App-Fenster (ohne Adressleiste oder Browser-Tabs).
3. **`Uninstall.exe`**: Entfernt die App, Verknüpfungen und Registry-Einträge restlos.
4. **`pomodoro-setup.iss`**: Standard-Skript für Inno Setup 6, falls eine einzelne `Setup.exe` per Inno Compiler gebaut werden soll.

---

## 🛠️ Direkte Universal-Installation auf Linux (ohne Paketmanager)

Für jede beliebige Linux-Distribution gibt es ein universelles Shell-Skript:

```bash
# Benutzer-Installation in ~/.local/ (kein root / kein sudo erforderlich):
./installers/install-linux.sh

# Oder systemweite Installation (für alle Benutzer):
sudo ./installers/install-linux.sh
```

---

## 🏗️ Pakete neu bauen

Möchtest du nach Code-Änderungen neue Pakete generieren:

```bash
# Alle Pakete (Linux & Windows) auf einmal bauen:
./installers/build-all.sh

# Oder einzeln:
./installers/build-windows.sh   # Nur Windows (Pomodoro.exe, Setup.exe, ZIP)
./installers/build-deb.sh       # Nur Ubuntu / Debian (.deb)
./installers/build-rpm.sh       # Nur Fedora / RHEL (.rpm)
./installers/build-tarball.sh   # Nur Portable Linux .tar.gz
```
