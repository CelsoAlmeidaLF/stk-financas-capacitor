/* Monta www/ com a EDIÇÃO LOCAL do app: SQLite no aparelho, sem Firebase e sem armazenamento do navegador.
   1. copia o PWA (fonte: ../stk-desp-firebase-google/src), sem componentes.html (vitrine) nem sw.js (service worker);
   2. aplica patches/pwa-local.patch (tira login, convites, duas etapas, config do Firebase e armazenamento do navegador);
   3. copia local/ para www/local/ (boot.js abre o SQLite; dados.js, acesso.js e backup.js).
   O repositório do PWA não muda. Se o PWA mudou e o patch não encaixa, o build para:
   regenere com "python3 scripts/gerar-patch-local.py" (veja o README). */
import { cpSync, rmSync, existsSync, readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { dirname, join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

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

try {
  execFileSync('git', ['apply', '--whitespace=nowarn', join(raiz, 'patches', 'pwa-local.patch')], { cwd: destino, stdio: 'inherit' });
} catch {
  console.error('O patch da edição local não encaixou: o PWA mudou. Regenere patches/pwa-local.patch (README → Atualizar o PWA).');
  process.exit(1);
}
for (const f of readdirSync(join(raiz, 'local'))) cpSync(join(raiz, 'local', f), join(destino, 'local', f));

// Garantia: nada de Firebase nem de armazenamento do navegador no app montado.
const proibido = /firebase|gstatic|\blocalStorage\b|\bsessionStorage\b|\bindexedDB\b|serviceWorker/i;
const achados = [];
(function varrer(dir) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) varrer(p);
    else if (/\.(js|html)$/.test(e.name)) readFileSync(p, 'utf8').split('\n').forEach((l, i) => {
      const codigo = l.replace(/\/\/.*$|\/\*.*?\*\/|^\s*\*.*$/g, ''); // ignora comentários de linha
      if (proibido.test(codigo)) achados.push(`${p.slice(destino.length + 1)}:${i + 1}: ${l.trim().slice(0, 100)}`);
    });
  }
})(destino);
if (achados.length) { console.error('Sobrou Firebase ou armazenamento do navegador:\n' + achados.join('\n')); process.exit(1); }

const versao = readFileSync(join(origem, 'index.html'), 'utf8').match(/data-vault-version="([^"]+)"/)?.[1] || '?';
writeFileSync(join(destino, 'ORIGEM.txt'), `Edição local (SQLite) do PWA stk-desp-firebase-google/src, versão ${versao}.\nNão edite aqui: edite local/ ou o patch e rode "npm run web".\n`);
console.log(`www/ montado: PWA ${versao} · edição local (SQLite)`);
