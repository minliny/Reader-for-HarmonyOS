#!/usr/bin/env bash
# gen-debug-signing.sh — generate debug self-signed signing materials for HarmonyOS.
#
# Produces a complete debug PKI under ./signing/ matching the paths referenced
# in build-profile.json5:
#   ./signing/app-keypair.p12   (app keypair, alias=debugKey)
#   ./signing/app-cert.cer       (app cert chain signed by local CA)
#   ./signing/app-profile.p7b    (debug profile, bundle-name from $1 or com.minliny.reader)
#
# Also writes ./signing.local.json5 with the passwords so build-profile.json5's
# ${HARMONY_KEY_PASSWORD} / ${HARMONY_STORE_PASSWORD} can be resolved.
#
# Usage:
#   ./scripts/gen-debug-signing.sh [bundleName]
#
# Idempotent: re-runs overwrite existing materials.
set -euo pipefail

REPO="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO"

BUNDLE_NAME="${1:-com.minliny.reader}"
SIGN_DIR="$REPO/signing"
HAP_SIGN_JAR="/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony/toolchains/lib/hap-sign-tool.jar"

# Debug passwords are local-only. Callers may provide the app passwords through
# the environment; every other signing password is generated per run.
# HarmonyOS requires storePassword/keyPassword length >= 32 AND odd.
random_password() {
  printf '%sx' "$(openssl rand -hex 20)"
}

KEY_PWD="${HARMONY_KEY_PASSWORD:-$(random_password)}"
STORE_PWD="${HARMONY_STORE_PASSWORD:-$(random_password)}"
CA_KEY_PWD="$(random_password)"
CA_STORE_PWD="$(random_password)"
PROFILE_KEY_PWD="$(random_password)"
PROFILE_STORE_PWD="$(random_password)"

CA_ALIAS="reader-root-ca"
APP_ALIAS="debugKey"
PROFILE_ALIAS="reader-profile-key"

CA_SUBJECT="CN=Reader Root CA,O=Reader,C=CN"
APP_SUBJECT="CN=Reader for HarmonyOS,O=Reader,C=CN"
PROFILE_SUBJECT="CN=Reader Profile,O=Reader,C=CN"

CA_JKS="$SIGN_DIR/root-ca.jks"
CA_CER="$SIGN_DIR/root-ca.cer"
SUB_APP_ALIAS="reader-sub-app-ca"
SUB_APP_JKS="$SIGN_DIR/sub-app-ca.jks"
SUB_APP_CER="$SIGN_DIR/sub-app-ca.cer"
SUB_PROFILE_ALIAS="reader-sub-profile-ca"
SUB_PROFILE_JKS="$SIGN_DIR/sub-profile-ca.jks"
SUB_PROFILE_CER="$SIGN_DIR/sub-profile-ca.cer"
SUB_KEY_PWD="$(random_password)"
SUB_STORE_PWD="$(random_password)"
APP_P12="$SIGN_DIR/app-keypair.p12"
APP_CER="$SIGN_DIR/app-cert.cer"
PROFILE_JKS="$SIGN_DIR/profile-keypair.jks"
PROFILE_CER="$SIGN_DIR/profile.cer"
PROFILE_P7B="$SIGN_DIR/app-profile.p7b"
PROFILE_JSON="$SIGN_DIR/profile.json"
SIGN_LOCAL="$REPO/signing.local.json5"

mkdir -p "$SIGN_DIR"
APP_CER_SINGLE="$SIGN_DIR/app-cert-single.cer"

rm -f "$CA_JKS" "$CA_CER" "$APP_P12" "$APP_CER" "$APP_CER_SINGLE" \
      "$SUB_APP_JKS" "$SUB_APP_CER" "$SUB_PROFILE_JKS" "$SUB_PROFILE_CER" \
      "$PROFILE_JKS" "$PROFILE_CER" "$PROFILE_P7B" "$PROFILE_JSON"

SUB_APP_SUBJECT="CN=Reader App Sub CA,O=Reader,C=CN"
SUB_PROFILE_SUBJECT="CN=Reader Profile Sub CA,O=Reader,C=CN"

echo "==> [1/9] Generate root CA (keypair + self-signed cert, JKS)"
java -jar "$HAP_SIGN_JAR" generate-ca \
  -keyAlias "$CA_ALIAS" -keyPwd "$CA_KEY_PWD" \
  -keyAlg ECC -keySize NIST-P-256 \
  -subject "$CA_SUBJECT" \
  -signAlg SHA256withECDSA -validity 3650 \
  -keystoreFile "$CA_JKS" -keystorePwd "$CA_STORE_PWD" \
  -outFile "$CA_CER"

echo "==> [2/9] Generate sub-app-CA (signed by root CA)"
java -jar "$HAP_SIGN_JAR" generate-ca \
  -keyAlias "$SUB_APP_ALIAS" -keyPwd "$SUB_KEY_PWD" \
  -keyAlg ECC -keySize NIST-P-256 \
  -issuer "$CA_SUBJECT" \
  -issuerKeyAlias "$CA_ALIAS" -issuerKeyPwd "$CA_KEY_PWD" \
  -issuerKeystoreFile "$CA_JKS" -issuerKeystorePwd "$CA_STORE_PWD" \
  -subject "$SUB_APP_SUBJECT" \
  -signAlg SHA256withECDSA -validity 3650 \
  -keystoreFile "$SUB_APP_JKS" -keystorePwd "$SUB_STORE_PWD" \
  -outFile "$SUB_APP_CER"

echo "==> [3/9] Generate sub-profile-CA (signed by root CA)"
java -jar "$HAP_SIGN_JAR" generate-ca \
  -keyAlias "$SUB_PROFILE_ALIAS" -keyPwd "$SUB_KEY_PWD" \
  -keyAlg ECC -keySize NIST-P-256 \
  -issuer "$CA_SUBJECT" \
  -issuerKeyAlias "$CA_ALIAS" -issuerKeyPwd "$CA_KEY_PWD" \
  -issuerKeystoreFile "$CA_JKS" -issuerKeystorePwd "$CA_STORE_PWD" \
  -subject "$SUB_PROFILE_SUBJECT" \
  -signAlg SHA256withECDSA -validity 3650 \
  -keystoreFile "$SUB_PROFILE_JKS" -keystorePwd "$SUB_STORE_PWD" \
  -outFile "$SUB_PROFILE_CER"

echo "==> [4/9] Generate app keypair (P12, alias=debugKey, ECC)"
java -jar "$HAP_SIGN_JAR" generate-keypair \
  -keyAlias "$APP_ALIAS" -keyPwd "$KEY_PWD" \
  -keyAlg ECC -keySize NIST-P-256 \
  -keystoreFile "$APP_P12" -keystorePwd "$STORE_PWD"

echo "==> [5/9] Sign app cert chain (root → sub-app → app)"
java -jar "$HAP_SIGN_JAR" generate-app-cert \
  -keyAlias "$APP_ALIAS" -keyPwd "$KEY_PWD" \
  -issuer "$SUB_APP_SUBJECT" \
  -issuerKeyAlias "$SUB_APP_ALIAS" -issuerKeyPwd "$SUB_KEY_PWD" \
  -issuerKeystoreFile "$SUB_APP_JKS" -issuerKeystorePwd "$SUB_STORE_PWD" \
  -subject "$APP_SUBJECT" \
  -signAlg SHA256withECDSA -validity 1825 \
  -keystoreFile "$APP_P12" -keystorePwd "$STORE_PWD" \
  -outForm certChain \
  -rootCaCertFile "$CA_CER" \
  -subCaCertFile "$SUB_APP_CER" \
  -outFile "$APP_CER"

# Extract leaf cert only — profile.json's development-certificate must be the
# single app cert (not the full chain). sign-app's -appCertFile uses the chain.
openssl x509 -in "$APP_CER" -out "$APP_CER_SINGLE"

echo "==> [6/9] Generate profile keypair (JKS, ECC)"
java -jar "$HAP_SIGN_JAR" generate-keypair \
  -keyAlias "$PROFILE_ALIAS" -keyPwd "$PROFILE_KEY_PWD" \
  -keyAlg ECC -keySize NIST-P-256 \
  -keystoreFile "$PROFILE_JKS" -keystorePwd "$PROFILE_STORE_PWD"

echo "==> [7/9] Sign profile cert chain (root → sub-profile → profile)"
java -jar "$HAP_SIGN_JAR" generate-profile-cert \
  -keyAlias "$PROFILE_ALIAS" -keyPwd "$PROFILE_KEY_PWD" \
  -issuer "$SUB_PROFILE_SUBJECT" \
  -issuerKeyAlias "$SUB_PROFILE_ALIAS" -issuerKeyPwd "$SUB_KEY_PWD" \
  -issuerKeystoreFile "$SUB_PROFILE_JKS" -issuerKeystorePwd "$SUB_STORE_PWD" \
  -subject "$PROFILE_SUBJECT" \
  -signAlg SHA256withECDSA -validity 1825 \
  -keystoreFile "$PROFILE_JKS" -keystorePwd "$PROFILE_STORE_PWD" \
  -outForm certChain \
  -rootCaCertFile "$CA_CER" \
  -subCaCertFile "$SUB_PROFILE_CER" \
  -outFile "$PROFILE_CER"

echo "==> [6/7] Write profile.json (bundle=$BUNDLE_NAME)"
# Inline PEM certificate content — sign-profile does NOT resolve "@path" file
# references; it embeds the field value verbatim. The official template
# (UnsgnedDebugProfileTemplate.json) uses inline PEM with \n escapes.
CERT_PEM_ESCAPED=$(perl -0777 -pe 's/\n/\\n/g' "$APP_CER_SINGLE")
cat > "$PROFILE_JSON" <<EOF
{
  "version-name": "1.0.0",
  "version-code": 1,
  "uuid": "$(uuidgen | tr 'A-Z' 'a-z')",
  "type": "debug",
  "bundle-info": {
    "developer-id": "Reader",
    "development-certificate": "$CERT_PEM_ESCAPED",
    "bundle-name": "$BUNDLE_NAME",
    "apl": "normal",
    "app-feature": "hos_normal_app"
  },
  "acls": {
    "allowed-acls": [""]
  },
  "permissions": {
    "restricted-permissions": []
  },
  "debug-info": {
    "device-ids": [],
    "device-id-type": "udid"
  },
  "issuer": "pki_internal"
}
EOF

echo "==> [7/7] Sign debug profile -> app-profile.p7b"
java -jar "$HAP_SIGN_JAR" sign-profile \
  -mode localSign \
  -keyAlias "$PROFILE_ALIAS" -keyPwd "$PROFILE_KEY_PWD" \
  -profileCertFile "$PROFILE_CER" \
  -inFile "$PROFILE_JSON" \
  -signAlg SHA256withECDSA \
  -keystoreFile "$PROFILE_JKS" -keystorePwd "$PROFILE_STORE_PWD" \
  -outFile "$PROFILE_P7B"

# Write signing.local.json5 (gitignored) so build-profile.json5 can resolve passwords.
cat > "$SIGN_LOCAL" <<EOF
// AUTO-GENERATED by scripts/gen-debug-signing.sh — DO NOT COMMIT.
// Debug-only passwords; replace with release materials for production signing.
{
  "HARMONY_KEY_PASSWORD": "$KEY_PWD",
  "HARMONY_STORE_PASSWORD": "$STORE_PWD",
}
EOF

HARMONY_KEY_PASSWORD="$KEY_PWD" HARMONY_STORE_PASSWORD="$STORE_PWD" \
  node "$REPO/scripts/encrypt-signing-pwds.mjs"

echo ""
echo "✓ Debug signing materials generated:"
echo "  bundleName:        $BUNDLE_NAME"
echo "  app-keypair.p12:   $APP_P12  (alias=$APP_ALIAS)"
echo "  app-cert.cer:      $APP_CER"
echo "  app-profile.p7b:   $PROFILE_P7B"
echo "  signing.local.json5: $SIGN_LOCAL  (gitignored)"
