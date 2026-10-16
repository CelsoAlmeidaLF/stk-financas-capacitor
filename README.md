# Finanças da Casa · app Android (Capacitor, modo local)

O PWA `../stk-desp-firebase-google/src` (v2.6.3) empacotado como app Android em **modo local**: os dados ficam num banco **SQLite** no próprio celular, sem Firebase, sem internet e sem armazenamento do navegador. O repositório do PWA não muda: o modo local é montado na cópia (`www/`) pelo `scripts/copiar-web.mjs`.

## Baixar o APK no celular

Página de download dos dois apps (com QR code para abrir no celular): **https://celsoalmeidalf.github.io/stk-financas-android/**

**[Baixar a última versão pelo GitHub](https://github.com/CelsoAlmeidaLF/stk-financas-capacitor/releases/latest/download/financas-casa-capacitor.apk)**: abra este link no navegador do Android, baixe e toque no arquivo. Na primeira vez, o Android pede para permitir a instalação de apps de fontes desconhecidas. Versões anteriores ficam em [Releases](https://github.com/CelsoAlmeidaLF/stk-financas-capacitor/releases).

O APK é assinado com a chave de release da Systekna (certificado `CN=Celso de Almeida Leite F, O=Systekna, C=BR`, SHA-256 `1b21a6ac…5e72de236`). As atualizações instalam por cima da versão anterior. Quem instalou um APK de debug antigo precisa desinstalá-lo uma vez antes.

## Desenvolvimento e build (local)

Tudo roda na máquina local; o repositório guarda o código e publica o APK em Releases.

```bash
npm run web          # copia o PWA para www/ e liga o modo local; rode a cada versão nova do PWA
npm run sync         # web + cap sync android
npm run apk          # build completo: dist/financas-casa-capacitor.apk
scripts/publicar-apk.sh v2.6.4   # cria a Release e atualiza a página de download (precisa do gh logado)
```

Requisitos: Node 22+ (o script usa o `nvm` se houver), JDK 21, a chave de assinatura e Android SDK em `~/Android/Sdk` (ou `ANDROID_HOME`), com `platforms;android-36` e `build-tools;36.0.0`.

`www/` e `android/` não são versionados: o PWA vem de `../stk-desp-firebase-google/src` (repo privado `financas-casa`) e o projeto Android é gerado pelo Capacitor.

### Chave de assinatura

`scripts/build-apk.sh` compila o release e assina com `~/.android-keys/systekna-release.jks` (alias `systekna`, senha em `~/.android-keys/systekna-release.pass`). Outros caminhos: `STK_KEYSTORE` e `STK_KEYPASS_FILE`. A chave nunca entra no git. **Sem ela não dá para publicar atualizações**: os aparelhos recusam um APK assinado com outra chave.

## Modo local (SQLite)

| Onde | O que guarda |
| --- | --- |
| Tabela `docs` | Os dados da casa (lançamentos, compras, cartões, dívidas, investimentos, metas), **cifrados com a chave da casa** (AES-256-GCM), como no PWA. |
| Tabela `kv` | O que o PWA guardava no `localStorage`: cofre do PIN, chave da casa (protegida pelo PIN) e preferências. |

O arquivo do banco fica na pasta privada do app no celular (`databases/financas-casaSQLite.db`, plugin `@capacitor-community/sqlite`). Desinstalar o app ou limpar os dados dele apaga o banco: por isso existe o backup.

Como funciona, em `local/` (vai para `www/fb-local/`):

- `boot.js`: primeiro script da página. Abre o SQLite, carrega para a memória e troca `localStorage` (SQLite), `sessionStorage` (só memória), IndexedDB, Cache Storage e service worker (desligados). Depois carrega os scripts do PWA.
- `firebase-firestore.js`, `firebase-auth.js`, `firebase-app.js`: mesma API do Firebase que o `app.js` usa, sem servidor. O `app.js` importa daqui (a URL do `gstatic` é trocada na cópia).
- `modo-local.js`: esconde o que só existe com servidor (convites, duas etapas, e-mail, senha, sair da conta) e cria o **backup**.

**Acesso:** só o PIN do cofre. Não há conta, e-mail nem casa compartilhada: cada celular tem a sua casa.

**Backup:** em *Casa → Backup*. *Exportar* gera um arquivo cifrado em `Documentos/FinancasCasa/` (dá para enviar ao Drive, e-mail etc.). *Restaurar* (também na tela de criar a casa, num celular novo) pede o arquivo e as **12 palavras**, a hash ou o código de recuperação da casa. Sem elas o arquivo não abre.

**Testes:** o fluxo inteiro (criar PIN, criar a casa, lançar, reabrir, exportar, restaurar num banco vazio, recusar palavras erradas) foi testado no Chrome com um SQLite real simulando o plugin nativo. A rodada no aparelho é a validação final.

## Outras diferenças em relação ao PWA

| Item | Comportamento no APK |
| --- | --- |
| Biometria (WebAuthn PRF) | O WebView do Android não oferece PRF: o cofre fica **só com o PIN**. Biometria nativa exige um plugin (BiometricPrompt + Keystore). |
| Recarregar a página | Pede o PIN de novo (a sessão fica só na memória, nada vai para o armazenamento). |
| Rede | A CSP só permite o próprio app (`'self'`): o app não fala com nenhum servidor. |
| Instalar / Service Worker | O botão "Instalar" do PWA não aparece (já é app). Service worker desligado. |
| Web (HOM/PRD) | Não muda: continua com Firebase. |

## Licença

Proprietária, todos os direitos reservados. Veja [LICENSE](LICENSE). O repositório é público só para consulta.
