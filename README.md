# Finanças da Casa · piloto Capacitor

O PWA `../stk-desp-firebase-google/src` (v2.6.3) empacotado como app Android, **sem mudar uma linha do PWA**.

## Baixar o APK no celular

Página de download dos dois apps (com QR code para abrir no celular): **https://celsoalmeidalf.github.io/stk-financas-android/**

**[Baixar a última versão pelo GitHub](https://github.com/CelsoAlmeidaLF/stk-financas-capacitor/releases/latest/download/financas-casa-capacitor.apk)**: abra este link no navegador do Android, baixe e toque no arquivo. Na primeira vez, o Android pede para permitir a instalação de apps de fontes desconhecidas. Versões anteriores ficam em [Releases](https://github.com/CelsoAlmeidaLF/stk-financas-capacitor/releases).

O APK é assinado com a chave de release da Systekna (certificado `CN=Celso de Almeida Leite F, O=Systekna, C=BR`, SHA-256 `1b21a6ac…5e72de236`). As atualizações instalam por cima da versão anterior. Quem instalou um APK de debug antigo precisa desinstalá-lo uma vez antes.

## Desenvolvimento e build (local)

Tudo roda na máquina local; o repositório guarda o código e publica o APK em Releases.

```bash
npm run web          # copia o PWA para www/ (sem componentes.html); rode a cada versão nova do PWA
npm run sync         # web + cap sync android
npm run apk          # build completo: dist/financas-casa-capacitor.apk
scripts/publicar-apk.sh v2.6.4   # cria a Release e atualiza a página de download (precisa do gh logado)
```

Requisitos: Node 22+ (o script usa o `nvm` se houver), JDK 21, a chave de assinatura e Android SDK em `~/Android/Sdk` (ou `ANDROID_HOME`), com `platforms;android-36` e `build-tools;36.0.0`.

`www/` e `android/` não são versionados: o PWA vem de `../stk-desp-firebase-google/src` (repo privado `financas-casa`) e o projeto Android é gerado pelo Capacitor.

### Chave de assinatura

`scripts/build-apk.sh` compila o release e assina com `~/.android-keys/systekna-release.jks` (alias `systekna`, senha em `~/.android-keys/systekna-release.pass`). Outros caminhos: `STK_KEYSTORE` e `STK_KEYPASS_FILE`. A chave nunca entra no git. **Sem ela não dá para publicar atualizações**: os aparelhos recusam um APK assinado com outra chave.

## Antes de testar

- **Use um projeto Firebase de teste.** HOM e PRD usam o mesmo Firestore com dados reais. Na tela de login → "Projeto Firebase" → cole o `firebaseConfig` do projeto de teste (fica salvo só no aparelho).
- No projeto de teste, ligue E-mail/senha no Authentication. O app roda em `https://localhost`, que já vem nos domínios autorizados.

## O que muda no app em relação ao PWA

| Item | Comportamento no APK |
| --- | --- |
| Biometria (WebAuthn PRF) | O WebView do Android não oferece PRF: o cofre detecta e fica **só com o PIN**. Biometria nativa exige um plugin (BiometricPrompt + Keystore). |
| Offline | As telas abrem offline, mas o SDK do Firebase vem do `gstatic` (CDN): sem rede, não há login nem dados. Para offline total, empacotar o SDK no `www/`. |
| Cabeçalhos de segurança | Os do `firebase.json` (HSTS, X-Frame-Options) não se aplicam; a CSP do `<meta>` continua valendo. |
| Plugins Capacitor | A CSP (`script-src 'self'`) deve bloquear o script inline que o Capacitor injeta na página (confirmar no primeiro APK, pelo console do WebView). Hoje o app não usa plugin; para usar um, ajuste a CSP. |
| Instalar / Service Worker | O botão "Instalar" do PWA não aparece (já é app). O service worker continua registrado e funciona como cache. |

## Licença

Proprietária, todos os direitos reservados. Veja [LICENSE](LICENSE). O repositório é público só para consulta.
