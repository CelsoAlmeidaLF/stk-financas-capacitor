/* Copia o PWA (fonte única: ../stk-desp-firebase-google/src) para www/, sem mudar nenhum arquivo.
   componentes.html é vitrine de desenvolvimento e não vai para o app, como no Hosting de PRD. */
import { cpSync, rmSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const origem = join(raiz, '..', 'stk-desp-firebase-google', 'src');
const destino = join(raiz, 'www');
const FORA = new Set(['componentes.html']);

if (!existsSync(join(origem, 'index.html'))) {
  console.error(`PWA não encontrado em ${origem}`);
  process.exit(1);
}
rmSync(destino, { recursive: true, force: true });
cpSync(origem, destino, { recursive: true, filter: f => !FORA.has(basename(f)) && !basename(f).startsWith('.') });

const versao = readFileSync(join(origem, 'index.html'), 'utf8').match(/data-vault-version="([^"]+)"/)?.[1] || '?';
writeFileSync(join(destino, 'ORIGEM.txt'), `Cópia de stk-desp-firebase-google/src (versão ${versao}). Não edite aqui: edite o PWA e rode "npm run web".\n`);
console.log(`www/ atualizado a partir do PWA ${versao}`);
