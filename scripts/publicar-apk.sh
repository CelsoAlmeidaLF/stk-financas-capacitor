#!/usr/bin/env bash
# Publica dist/financas-casa-capacitor.apk numa Release do GitHub (gera antes com scripts/build-apk.sh).
# Uso: scripts/publicar-apk.sh <versão>   ex.: scripts/publicar-apk.sh v0.1.0
# O link fixo da última versão (para abrir no celular) fica no README.
set -euo pipefail
cd "$(dirname "$0")/.."
VERSAO="${1:?informe a versão, ex.: v0.1.0}"
APK="dist/financas-casa-capacitor.apk"
[ -f "$APK" ] || { echo "Falta $APK: rode scripts/build-apk.sh"; exit 1; }
gh release create "$VERSAO" "$APK" -R CelsoAlmeidaLF/stk-financas-capacitor \
  --title "$VERSAO" --notes "APK de teste (debug). Baixe e abra no celular: o Android pede para permitir a instalação de fontes desconhecidas." --latest
echo "Link: https://github.com/CelsoAlmeidaLF/stk-financas-capacitor/releases/latest/download/financas-casa-capacitor.apk"
