# Finanças da Casa · piloto Capacitor

O PWA `../stk-desp-firebase-google/src` (v2.6.3) empacotado como app Android, **sem mudar uma linha do PWA**.

```bash
npm run web      # copia o PWA para www/ (sem componentes.html); rode a cada versão nova do PWA
npm run sync     # web + cap sync android (precisa Node 22+)
```

O APK sai pelo GitHub Actions (`.github/workflows/build-apk.yml`, artefato `financas-casa-capacitor-apk`), porque a máquina local não tem Android SDK e o Capacitor 8 pede Node 22+.

### `www/` fora do git

O PWA vem do repositório privado `financas-casa`, então `www/` não é versionado aqui. Local: `npm run web` gera a pasta a partir de `../stk-desp-firebase-google/src`.

> **Pendente:** o workflow ainda espera o `www/` no repositório, então o build do APK no Actions falha até ele saber de onde tirar o PWA.

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
