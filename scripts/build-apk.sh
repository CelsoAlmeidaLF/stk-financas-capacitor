#!/usr/bin/env bash
# Build local do APK: copia o PWA para www/, cria/sincroniza o projeto Android e compila o release assinado.
# Precisa: Node 22+ (nvm), JDK 21 e Android SDK (ANDROID_HOME, padrão ~/Android/Sdk).
set -euo pipefail
cd "$(dirname "$0")/.."
export ANDROID_HOME="${ANDROID_HOME:-$HOME/Android/Sdk}"
export JAVA_HOME="${JAVA_HOME:-/usr/lib/jvm/java-21-openjdk-amd64}"
if [ -s "$HOME/.nvm/nvm.sh" ]; then . "$HOME/.nvm/nvm.sh"; nvm use 22 >/dev/null; fi

npm install --no-audit --no-fund
npm run web
[ -d android ] || npx cap add android
npx cap sync android
# Assinatura de release: chave própria fora do repositório (nunca commitar).
KEYSTORE="${STK_KEYSTORE:-$HOME/.android-keys/systekna-release.jks}"
KEYPASS="${STK_KEYPASS_FILE:-$HOME/.android-keys/systekna-release.pass}"
[ -f "$KEYSTORE" ] && [ -f "$KEYPASS" ] || { echo "Falta a chave de assinatura ($KEYSTORE e $KEYPASS)"; exit 1; }
BT="$(ls -d "$ANDROID_HOME"/build-tools/* | sort -V | tail -1)"
assinar() { # $1 = APK sem assinatura, $2 = APK final
  mkdir -p dist
  "$BT/zipalign" -f -p 4 "$1" dist/alinhado.apk
  "$BT/apksigner" sign --ks "$KEYSTORE" --ks-key-alias systekna --ks-pass "file:$KEYPASS" --out "$2" dist/alinhado.apk
  rm -f dist/alinhado.apk "$2.idsig"
  "$BT/apksigner" verify "$2"
  echo "APK: $(pwd)/$2"
}

(cd android && ./gradlew --no-daemon assembleRelease)

assinar android/app/build/outputs/apk/release/app-release-unsigned.apk dist/financas-casa-capacitor.apk
