#!/usr/bin/env bash
set -euo pipefail

# ==============================================================================
# Master Build Script: Generiert alle Installer Pakete (Linux & Windows)
# ==============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DIST_DIR="${SCRIPT_DIR}/dist"

echo "=========================================================="
echo "   🚀 Baue alle Pomodoro Installer Pakete (Linux & Windows)..."
echo "=========================================================="
echo ""

chmod +x "${SCRIPT_DIR}/build-deb.sh"
chmod +x "${SCRIPT_DIR}/build-rpm.sh"
chmod +x "${SCRIPT_DIR}/build-tarball.sh"
chmod +x "${SCRIPT_DIR}/build-windows.sh"
chmod +x "${SCRIPT_DIR}/install-linux.sh"
chmod +x "${SCRIPT_DIR}/uninstall-linux.sh"

# 1. Debian / Ubuntu
echo "----------------------------------------------------------"
"${SCRIPT_DIR}/build-deb.sh"
echo ""

# 2. Fedora / RHEL
echo "----------------------------------------------------------"
"${SCRIPT_DIR}/build-rpm.sh"
echo ""

# 3. Portable Linux Tarball
echo "----------------------------------------------------------"
"${SCRIPT_DIR}/build-tarball.sh"
echo ""

# 4. Windows App & Installer (.exe & .zip)
echo "----------------------------------------------------------"
"${SCRIPT_DIR}/build-windows.sh"
echo ""

# 5. Checksums berechnen
echo "----------------------------------------------------------"
echo "==> Generiere SHA256 Prüfsummen..."
cd "${DIST_DIR}"
sha256sum *.{deb,rpm,tar.gz,zip} 2>/dev/null > SHA256SUMS || true

echo ""
echo "=========================================================="
echo "✅ Alle Installer wurden erfolgreich generiert!"
echo "=========================================================="
echo ""
ls -lh "${DIST_DIR}"
echo ""
