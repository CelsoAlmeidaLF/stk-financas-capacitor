# Finanças da Casa · app Android (Capacitor, modo local)

Edição local do Finanças da Casa para Android: os dados ficam num banco **SQLite** no próprio celular. **Sem Firebase, sem internet e sem armazenamento do navegador** (nada de localStorage, sessionStorage, IndexedDB, cache ou service worker).

É montada a partir do PWA `../stk-desp-firebase-google/src` (v2.6.3), que não muda: a versão web continua com Firebase.

## Baixar o APK no celular

Página de download dos dois apps (com QR code para abrir no celular): **https://celsoalmeidalf.github.io/stk-financas-android/**

**[Baixar a última versão pelo GitHub](https://github.com/CelsoAlmeidaLF/stk-financas-capacitor/releases/latest/download/financas-casa-capacitor.apk)**: abra este link no navegador do Android, baixe e toque no arquivo. Na primeira vez, o Android pede para permitir a instalação de apps de fontes desconhecidas. Versões anteriores ficam em [Releases](https://github.com/CelsoAlmeidaLF/stk-financas-capacitor/releases).

O APK é assinado com a chave de release da Systekna (certificado `CN=Celso de Almeida Leite F, O=Systekna, C=BR`, SHA-256 `1b21a6ac…5e72de236`). As atualizações instalam por cima da versão anterior. Quem instalou um APK de debug antigo precisa desinstalá-lo uma vez antes.

## Desenvolvimento e build (local)

Tudo roda na máquina local; o repositório guarda o código e publica o APK em Releases.

```bash
npm run web          # monta www/: PWA + patches/pwa-local.patch + local/
npm run sync         # web + cap sync android
npm run apk          # build completo: dist/financas-casa-capacitor.apk
scripts/publicar-apk.sh v2.6.4   # cria a Release e atualiza a página de download (precisa do gh logado)
```

Requisitos: Node 22+ (o script usa o `nvm` se houver), JDK 21, a chave de assinatura e Android SDK em `~/Android/Sdk` (ou `ANDROID_HOME`), com `platforms;android-36` e `build-tools;36.0.0`.

`www/` e `android/` não são versionados: o PWA vem de `../stk-desp-firebase-google/src` (repo privado `financas-casa`) e o projeto Android é gerado pelo Capacitor.

### Chave de assinatura

`scripts/build-apk.sh` compila o release e assina com `~/.android-keys/systekna-release.jks` (alias `systekna`, senha em `~/.android-keys/systekna-release.pass`). Outros caminhos: `STK_KEYSTORE` e `STK_KEYPASS_FILE`. A chave nunca entra no git. **Sem ela não dá para publicar atualizações**: os aparelhos recusam um APK assinado com outra chave.

## Edição local (SQLite)

| Onde | O que guarda |
| --- | --- |
| Tabela `docs` | Os dados da casa (lançamentos, compras, cartões, dívidas, investimentos, metas), **cifrados com a chave da casa** (AES-256-GCM). |
| Tabela `kv` | Cofre do PIN, chave da casa (protegida pelo PIN) e preferências. |

O arquivo do banco fica na pasta privada do app no celular (`databases/financas-casaSQLite.db`, plugin `@capacitor-community/sqlite`). Desinstalar o app ou limpar os dados dele apaga o banco: por isso existe o backup.

### Como é montada

`npm run web` (`scripts/copiar-web.mjs`):

1. copia o PWA para `www/`, sem `componentes.html` e `sw.js`;
2. aplica **`patches/pwa-local.patch`**, que tira do app o login, os convites e as pessoas extras, as duas etapas, a configuração do Firebase, a migração de dados antigos, o service worker e o armazenamento do navegador;
3. copia `local/` para `www/local/`:
   - `boot.js`: primeiro script da página. Abre o SQLite e cria `stkArmazem` (tabela `kv`) e `stkSessao` (só memória). Depois carrega o app;
   - `dados.js`: porta de dados do app sobre a tabela `docs`;
   - `acesso.js`: usuário local (o PIN já abriu o cofre);
   - `backup.js`: exportar e restaurar o backup cifrado, e gravar arquivos em Documentos.
4. varre o `www/` e **para o build** se achar Firebase, `localStorage`, `sessionStorage`, `indexedDB` ou `serviceWorker` no código.

### Atualizar o PWA

Se o PWA mudar, o patch pode não encaixar e o `npm run web` para com aviso. Para regenerar:

```bash
python3 scripts/gerar-patch-local.py ../stk-desp-firebase-google/src /tmp/pwa-local
for f in index.html js/app.js stk-pkg-secure-ui.js; do
  diff -u --label a/$f --label b/$f ../stk-desp-firebase-google/src/$f /tmp/pwa-local/$f
done > patches/pwa-local.patch
```

O `gerar-patch-local.py` faz cada troca de forma exata e avisa qual trecho do PWA mudou.

### Uso

**Acesso:** só o PIN do cofre. Não há conta, e-mail nem casa compartilhada: cada celular tem a sua casa.

**Backup:** em *Casa → Backup*. *Exportar* gera um arquivo cifrado em `Documentos/FinancasCasa/` (dá para enviar ao Drive, e-mail etc.). *Restaurar* (também na tela de criar a casa, num celular novo) pede o arquivo e as **12 palavras**, a hash ou o código de recuperação da casa. Sem elas o arquivo não abre.

**Testes:** o fluxo inteiro (criar PIN, criar a casa, lançar, reabrir, exportar, restaurar num banco vazio, recusar palavras erradas) foi testado no Chrome com um SQLite real simulando o plugin nativo, e com o armazenamento do navegador conferido vazio no fim. A rodada no aparelho é a validação final.

## Outras diferenças em relação ao PWA

| Item | Comportamento no APK |
| --- | --- |
| Biometria (WebAuthn PRF) | O WebView do Android não oferece PRF: o cofre fica **só com o PIN**. Biometria nativa exige um plugin (BiometricPrompt + Keystore). |
| Reabrir o app | Pede o PIN de novo (a sessão fica só na memória). |
| Rede | A CSP só permite o próprio app (`'self'`): o app não fala com nenhum servidor. |
| Instalar / Service Worker | O botão "Instalar" do PWA não aparece (já é app). Service worker desligado. |
| Web (HOM/PRD) | Não muda: continua com Firebase. |

## Licença

Proprietária, todos os direitos reservados. Veja [LICENSE](LICENSE). O repositório é público só para consulta.
