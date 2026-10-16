/* Edição local do APK: backup cifrado e gravação de arquivos (carregado pelo app.js depois do PIN).
   Exportar: gera um arquivo com os dados da casa, cifrado com a chave da casa (AES-256-GCM), em Documentos/FinancasCasa.
   Restaurar: o arquivo só abre com as 12 palavras, a hash ou o código de recuperação da casa. */
import * as C from '../js/cripto-casa.js';

const L = window.stkLocal;
const FORMATO = 'financas-casa-backup', VERSAO = 1;
const $ = id => document.getElementById(id);
const plugin = nome => window.Capacitor?.Plugins?.[nome] || window.Capacitor?.registerPlugin?.(nome);
const ctxBackup = casaId => `backup:${casaId}`;

/* ---------- ícones (Lucide, 24x24, currentColor) ---------- */
const svg = d => `<svg class="i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const ICO = {
  download: svg('<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/><path d="M12 15V3"/>'),
  upload: svg('<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m17 8-5-5-5 5"/><path d="M12 3v12"/>'),
  eye: svg('<path d="M2.06 12.35a1 1 0 0 1 0-.7 10.75 10.75 0 0 1 19.88 0 1 1 0 0 1 0 .7 10.75 10.75 0 0 1-19.88 0"/><circle cx="12" cy="12" r="3"/>'),
  eyeOff: svg('<path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c4.97 0 8.58 3.33 9.94 6.65a1 1 0 0 1 0 .7 10.75 10.75 0 0 1-1.44 2.49"/><path d="M14.08 14.16a3 3 0 0 1-4.24-4.24"/><path d="M17.48 17.5A10.75 10.75 0 0 1 2.06 12.35a1 1 0 0 1 0-.7 10.75 10.75 0 0 1 4.45-5.14"/><path d="m2 2 20 20"/>')
};

/* ---------- estilo das caixas de diálogo ---------- */
const css = document.createElement('style');
css.textContent = `
  .stk-local-dlg { border: 0; padding: 0; background: transparent; max-width: min(520px, calc(100vw - 32px)); width: 100%; color: inherit; }
  .stk-local-dlg::backdrop { background: rgba(0, 0, 0, .55); backdrop-filter: blur(4px); }
  .stk-local-dlg .glass { display: grid; gap: 12px; }
  .stk-local-dlg h3 { margin: 0; }
  .stk-local-acoes { display: grid; gap: 10px; }
  .stk-local-acoes .btn, .stk-local-dlg .btn { display: inline-flex; align-items: center; justify-content: center; gap: 8px; }
  .stk-senha { position: relative; }
  .stk-senha input { padding-right: 52px !important; }
  .stk-senha button { position: absolute; right: 6px; bottom: 6px; width: 40px; height: 36px; border: 0; border-radius: 10px; background: transparent; color: inherit; display: grid; place-items: center; cursor: pointer; }
  .stk-local-dlg input[type=file] { width: 100%; }`;
document.head.append(css);

/* ---------- caixa de diálogo ---------- */
function dialogo(html) {
  const d = document.createElement('dialog');
  d.className = 'stk-local-dlg';
  d.innerHTML = `<form method="dialog" class="glass pad" novalidate>${html}</form>`;
  d.addEventListener('close', () => d.remove());
  document.body.append(d); d.showModal();
  d.querySelectorAll('[data-fechar]').forEach(b => b.onclick = e => { e.preventDefault(); d.close(); });
  d.querySelectorAll('.stk-senha').forEach(caixa => {
    const inp = caixa.querySelector('input'), b = caixa.querySelector('button');
    const ver = mostrar => { inp.type = mostrar ? 'text' : 'password'; b.innerHTML = mostrar ? ICO.eyeOff : ICO.eye; b.setAttribute('aria-label', mostrar ? 'Ocultar' : 'Mostrar'); };
    b.onclick = e => { e.preventDefault(); ver(inp.type === 'password'); inp.focus(); }; ver(false);
  });
  return d;
}
const msg = (d, texto, tipo = '') => { const m = d.querySelector('.msg'); m.textContent = texto; m.className = 'msg ' + tipo; };

/* ---------- exportar ---------- */
function casaAtual() {
  const casaId = L.docs.get('usuarios/local')?.casaId;
  const casa = casaId && L.docs.get('casas/' + casaId);
  return casa ? { casaId, casa } : null;
}
async function gerarBackup() {
  const atual = casaAtual();
  if (!atual) throw new Error('Ainda não há casa criada neste aparelho.');
  const { casaId, casa } = atual;
  const dek = window.secureStorage?.getItem('dek:' + casaId);
  if (!dek) throw new Error('A chave da casa não está liberada neste aparelho.');
  const lista = [...L.docs.entries()].map(([path, dados]) => ({ path, dados }));
  const payload = await C.selar(await C.chaveDados(dek), lista, ctxBackup(casaId));
  return { formato: FORMATO, versao: VERSAO, criadoEm: new Date().toISOString(), casaId, selo: casa.cripto?.selo || '', cripto: casa.cripto, registros: lista.length, payload };
}
// Também usada pelo app (certificado do administrador): no Android não há download de arquivo pelo navegador.
export async function salvarArquivo(nome, texto) {
  if (L.nativo) {
    const FS = plugin('Filesystem');
    try {
      const r = await FS.writeFile({ path: 'FinancasCasa/' + nome, data: texto, directory: 'DOCUMENTS', encoding: 'utf8', recursive: true });
      return { local: 'Documentos/FinancasCasa/' + nome, uri: r.uri };
    } catch (e) {
      console.warn('[modo local] Documentos indisponível, uso o compartilhamento', e);
      const r = await FS.writeFile({ path: nome, data: texto, directory: 'CACHE', encoding: 'utf8' });
      return { local: null, uri: r.uri };
    }
  }
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([texto], { type: 'application/json' })), download: nome });
  a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  return { local: 'Downloads/' + nome, uri: null };
}
async function exportar() {
  const d = dialogo(`<h3>Exportar backup</h3>
    <p class="lede">Gera um arquivo com todos os dados da casa, <b>cifrado</b>. Ele só abre com as 12 palavras, a hash ou o código de recuperação da casa.</p>
    <div class="stk-local-acoes"><button class="btn" data-ir>${ICO.download}Gerar arquivo</button><button class="btn ghost" data-fechar>Fechar</button></div>
    <div class="msg" role="status"></div>`);
  d.querySelector('[data-ir]').onclick = async e => {
    e.preventDefault(); const b = e.currentTarget; b.disabled = true; msg(d, 'Cifrando…');
    try {
      const backup = await gerarBackup();
      const nome = `financas-casa-backup-${new Date().toISOString().slice(0, 10)}.json`;
      const r = await salvarArquivo(nome, JSON.stringify(backup));
      msg(d, r.local ? `Salvo em ${r.local} (${backup.registros} registros).` : `Arquivo pronto (${backup.registros} registros).`, 'ok');
      if (r.uri) {
        const share = document.createElement('button'); share.className = 'btn ghost'; share.innerHTML = ICO.upload + 'Enviar para outro lugar';
        share.onclick = ev => { ev.preventDefault(); plugin('Share').share({ title: 'Backup Finanças da Casa', url: r.uri, dialogTitle: 'Guardar o backup em…' }).catch(() => {}); };
        d.querySelector('.stk-local-acoes').prepend(share);
        if (!r.local) share.click();
      }
    } catch (err) { msg(d, err.message || String(err), 'err'); }
    finally { b.disabled = false; }
  };
}

/* ---------- restaurar ---------- */
async function abrirBackup(arquivo, entrada) {
  let b;
  try { b = JSON.parse(await arquivo.text()); } catch { throw new Error('Este arquivo não é um backup do Finanças da Casa.'); }
  if (b?.formato !== FORMATO || !b.casaId || !b.cripto || !b.payload) throw new Error('Este arquivo não é um backup do Finanças da Casa.');
  if (b.versao > VERSAO) throw new Error('Backup de uma versão mais nova do app. Atualize o app primeiro.');
  let dek;
  try { dek = await C.abrirComPalavras(b.casaId, b.cripto, entrada); }
  catch { try { dek = await C.abrirComCodigo(b.casaId, b.cripto, entrada); } catch { throw new Error('Palavras, hash ou código incorretos para este backup.'); } }
  const lista = await C.abrir(await C.chaveDados(dek), b.payload, ctxBackup(b.casaId));
  if (!Array.isArray(lista) || !lista.every(x => typeof x?.path === 'string' && x.dados && typeof x.dados === 'object')) throw new Error('Backup corrompido.');
  return { casaId: b.casaId, dek, lista };
}
function restaurar() {
  const temDados = L.docs.size > 0;
  const d = dialogo(`<h3>Restaurar backup</h3>
    <p class="lede">Escolha o arquivo de backup e digite as <b>12 palavras</b>, a <b>hash</b> ou o <b>código de recuperação</b> da casa.</p>
    <label class="f">Arquivo de backup<input type="file" accept=".json,application/json" data-arquivo></label>
    <label class="f stk-senha">Palavras, hash ou código<input type="password" autocomplete="off" autocapitalize="none" spellcheck="false" data-protonpass-ignore="true" data-entrada><button type="button"></button></label>
    ${temDados ? '<label class="ck"><input type="checkbox" data-substituir> Substituir todos os dados deste aparelho pelos do backup</label>' : ''}
    <div class="stk-local-acoes"><button class="btn" data-ir>${ICO.upload}Restaurar</button><button class="btn ghost" data-fechar>Cancelar</button></div>
    <div class="msg" role="status"></div>`);
  d.querySelector('[data-ir]').onclick = async e => {
    e.preventDefault(); const b = e.currentTarget;
    const arquivo = d.querySelector('[data-arquivo]').files[0], entrada = d.querySelector('[data-entrada]').value.trim();
    if (!arquivo) return msg(d, 'Escolha o arquivo de backup.', 'err');
    if (!entrada) return msg(d, 'Digite as palavras, a hash ou o código.', 'err');
    if (temDados && !d.querySelector('[data-substituir]').checked) return msg(d, 'Marque a confirmação para substituir os dados.', 'err');
    b.disabled = true; msg(d, 'Abrindo o backup… (pode levar alguns segundos)');
    try {
      const { casaId, dek, lista } = await abrirBackup(arquivo, entrada);
      await L.substituirDocs(lista);
      window.secureStorage?.setItem('dek:' + casaId, dek);   // a chave da casa fica no cofre do PIN deste aparelho
      await L.fila();
      msg(d, `${lista.length} registros restaurados. Abrindo…`, 'ok');
      setTimeout(() => location.reload(), 600);
    } catch (err) { msg(d, err.message || String(err), 'err'); b.disabled = false; }
  };
}

/* ---------- botões na tela ---------- */
function injetar() {
  const casa = $('v-casa');
  if (casa && !casa.querySelector('[data-stk-backup]')) {
    const app = [...casa.querySelectorAll(':scope > .sec-h')].find(h => h.textContent.trim() === 'App');
    const sec = document.createElement('div');
    sec.innerHTML = `<div class="sec-h" data-stk-backup><b>Backup</b><span class="hint">só neste aparelho</span></div>
      <div class="glass pad"><p class="lede" style="margin:0 0 10px">Os dados ficam só no banco deste celular. Exporte um backup cifrado de vez em quando e guarde fora dele.</p>
      <div class="stk-local-acoes"><button class="btn" data-stk-exportar>${ICO.download}Exportar backup</button><button class="btn ghost" data-stk-restaurar>${ICO.upload}Restaurar backup</button></div></div>`;
    app ? casa.insertBefore(sec, app) : casa.append(sec);
  }
  const setup = $('setupForm');
  if (setup && !$('stkRestaurarSetup')) {
    const b = document.createElement('button');
    b.type = 'button'; b.id = 'stkRestaurarSetup'; b.className = 'btn ghost'; b.innerHTML = ICO.upload + 'Restaurar de um backup';
    b.dataset.stkRestaurar = '';
    setup.after(b);
  }
}
document.addEventListener('click', e => {
  if (e.target.closest('[data-stk-exportar]')) exportar();
  else if (e.target.closest('[data-stk-restaurar]')) restaurar();
});
window.stkSalvarArquivo = salvarArquivo;
injetar();
