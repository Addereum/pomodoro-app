#!/usr/bin/env bash
set -euo pipefail

# Generate Android Release Signing Keystore & GitHub Secret instructions
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OUTPUT_DIR="${SCRIPT_DIR}/keystore"
KEYSTORE_FILE="${OUTPUT_DIR}/addereum-release.keystore"
ALIAS="addereum"
VALIDITY_DAYS=10000

mkdir -p "${OUTPUT_DIR}"

# Generate secure random password
PASSWORD=$(python3 -c "import secrets; print(secrets.token_hex(16))")

echo "=========================================================="
echo "   🔑 Android Release Keystore Generator für Pomodoro"
echo "=========================================================="
echo ""

if [ -f "${KEYSTORE_FILE}" ]; then
    echo "⚠️  Keystore existiert bereits: ${KEYSTORE_FILE}"
else
    echo "==> Generiere 2048-bit RSA Release Keystore (Gültigkeit: ~27 Jahre)..."
    keytool -genkeypair \
        -v \
        -keystore "${KEYSTORE_FILE}" \
        -alias "${ALIAS}" \
        -keyalg RSA \
        -keysize 2048 \
        -validity "${VALIDITY_DAYS}" \
        -storetype PKCS12 \
        -storepass "${PASSWORD}" \
        -keypass "${PASSWORD}" \
        -dname "CN=Addereum, OU=Pomodoro, O=Addereum Open Source, L=Berlin, C=DE"
    echo "✅ Keystore erfolgreich generiert!"
fi

# Erstelle Base64 String
BASE64_FILE="${OUTPUT_DIR}/keystore-base64.txt"
base64 -w 0 "${KEYSTORE_FILE}" > "${BASE64_FILE}"

echo ""
echo "=========================================================="
echo "📋 DEINE GITHUB SECRETS (Kopiere diese in dein GitHub Repo):"
echo "   Gehe auf GitHub: Settings -> Secrets and variables -> Actions"
echo "=========================================================="
echo ""
echo "1. Secret Name:   ANDROID_KEYSTORE_BASE64"
echo "   Secret Value:  (Inhalt von: ${BASE64_FILE})"
echo ""
echo "2. Secret Name:   ANDROID_KEYSTORE_PASSWORD"
echo "   Secret Value:  ${PASSWORD}"
echo ""
echo "3. Secret Name:   ANDROID_KEY_ALIAS"
echo "   Secret Value:  ${ALIAS}"
echo ""
echo "4. Secret Name:   ANDROID_KEY_PASSWORD"
echo "   Secret Value:  ${PASSWORD}"
echo ""
echo "=========================================================="
echo "Hinweis: Die Keystore-Dateien sind in .gitignore geschützt!"
echo "=========================================================="
