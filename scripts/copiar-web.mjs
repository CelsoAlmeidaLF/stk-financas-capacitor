/* Copia o PWA (fonte única: ../stk-desp-firebase-google/src) para www/ e liga o MODO LOCAL do APK.
   O repositório do PWA não muda: os ajustes são feitos só na cópia, aqui.
   - local/ vai para www/fb-local/ (SQLite nativo no lugar do Firebase e do armazenamento do navegador);
   - js/app.js passa a importar o "Firebase" de /fb-local/ em vez do gstatic;
   - index.html carrega primeiro o fb-local/boot.js, que abre o SQLite e depois carrega os scripts do PWA;
   - a CSP deixa de liberar domínios do Google: o app não fala com nenhum servidor.
   componentes.html (vitrine de desenvolvimento) e sw.js (service worker, desligado no APK) não vão para o app. */
import { cpSync, rmSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const origem = join(raiz, '..', 'stk-desp-firebase-google', 'src');
const destino = join(raiz, 'www');
const FORA = new Set(['componentes.html', 'sw.js']);

if (!existsSync(join(origem, 'index.html'))) {
  console.error(`PWA não encontrado em ${origem}`);
  process.exit(1);
}
rmSync(destino, { recursive: true, force: true });
cpSync(origem, destino, { recursive: true, filter: f => !FORA.has(basename(f)) && !basename(f).startsWith('.') });
cpSync(join(raiz, 'local'), join(destino, 'fb-local'), { recursive: true });

// Troca exata de um trecho; se o PWA mudou e o trecho sumiu, para o build em vez de gerar um app quebrado.
function trocar(arquivo, de, para, rotulo) {
  const p = join(destino, arquivo), txt = readFileSync(p, 'utf8');
  const novo = typeof de === 'string' ? txt.replace(de, () => para) : txt.replace(de, para);
  if (novo === txt) { console.error(`Modo local: não achei ${rotulo} em ${arquivo}. O PWA mudou; ajuste scripts/copiar-web.mjs.`); process.exit(1); }
  writeFileSync(p, novo);
}

trocar('js/app.js', /const FB = 'https:\/\/www\.gstatic\.com\/firebasejs\/[^']+';/, "const FB = '/fb-local/'; // modo local do APK (copiar-web.mjs)", 'a URL do Firebase');

const html = readFileSync(join(destino, 'index.html'), 'utf8');
const tags = [...html.matchAll(/<script\b([^>]*)\bsrc="([^"]+)"[^>]*><\/script>\s*/g)];
if (!tags.length) { console.error('Modo local: nenhum <script src> no index.html.'); process.exit(1); }
const scripts = tags.map(t => ({ src: t[2], module: /type="module"/.test(t[1]) }));
let semScripts = html;
for (const t of tags) semScripts = semScripts.replace(t[0], '');
const boot = `<script src="fb-local/boot.js" data-scripts='${JSON.stringify(scripts)}'></script>\n`;
writeFileSync(join(destino, 'index.html'), semScripts.replace('</head>', boot + '</head>'));
trocar('index.html', /<meta http-equiv="Content-Security-Policy" content="[^"]*">/,
  `<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self'; connect-src 'self'; img-src 'self' data: blob:; object-src 'none'; base-uri 'self'; form-action 'self'; manifest-src 'self'">`, 'a CSP');

const versao = readFileSync(join(origem, 'index.html'), 'utf8').match(/data-vault-version="([^"]+)"/)?.[1] || '?';
writeFileSync(join(destino, 'ORIGEM.txt'), `Cópia de stk-desp-firebase-google/src (versão ${versao}) com o modo local do APK (SQLite, sem Firebase).\nNão edite aqui: edite o PWA ou local/ e rode "npm run web".\n`);
console.log(`www/ atualizado a partir do PWA ${versao} · modo local (SQLite)`);
