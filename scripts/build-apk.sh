#!/usr/bin/env bash
# Build local do APK: copia o PWA para www/, cria/sincroniza o projeto Android e compila o debug.
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
(cd android && ./gradlew --no-daemon assembleDebug)

mkdir -p dist
cp android/app/build/outputs/apk/debug/app-debug.apk dist/financas-casa-capacitor.apk
echo "APK: $(pwd)/dist/financas-casa-capacitor.apk"
