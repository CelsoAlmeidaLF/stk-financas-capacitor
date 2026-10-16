/* Edição local do APK: porta de dados do app sobre o SQLite do aparelho (tabela docs, aberta pelo local/boot.js).
   Documentos em caminhos "colecao/id" (ex.: casas/X/lancamentos/Y), com a forma de chamada que o app.js usa:
   banco, collection, doc, query/where, getDoc, getDocs, setDoc, updateDoc, deleteDoc, writeBatch, onSnapshot,
   serverTimestamp e Timestamp. Os registros chegam já cifrados pelo app (campo c); aqui só se guarda. */

const L = window.stkLocal;
if (!L) throw new Error('local/boot.js não carregou');
const { docs } = L;                // path -> dados (cópia em memória do SQLite)
const pronto = L.aberto;
const ouvintes = new Set();

/* ---------- Timestamp ---------- */
export class Timestamp {
  constructor(seconds, nanoseconds = 0) { this.seconds = seconds; this.nanoseconds = nanoseconds; }
  static fromMillis(ms) { return new Timestamp(Math.floor(ms / 1000), Math.round((ms % 1000) * 1e6)); }
  static now() { return Timestamp.fromMillis(Date.now()); }
  toMillis() { return this.seconds * 1000 + Math.floor(this.nanoseconds / 1e6); }
  toDate() { return new Date(this.toMillis()); }
}
const AGORA = Symbol('agora');
export const serverTimestamp = () => AGORA;   // vira a hora do aparelho ao gravar

// No banco, Timestamp vira {__ts: ms}; na leitura volta a ser Timestamp.
const paraBanco = v => v instanceof Timestamp ? { __ts: v.toMillis() }
  : Array.isArray(v) ? v.map(paraBanco)
  : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, paraBanco(x)])) : v;
const doBanco = v => v && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length === 1 && typeof v.__ts === 'number' ? Timestamp.fromMillis(v.__ts)
  : Array.isArray(v) ? v.map(doBanco)
  : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, doBanco(x)])) : v;
const resolverAgora = v => v === AGORA ? Timestamp.now()
  : v && typeof v === 'object' && !(v instanceof Timestamp) && !Array.isArray(v) ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, resolverAgora(x)])) : v;
const igual = (a, b) => JSON.stringify(paraBanco(a)) === JSON.stringify(paraBanco(b));

/* ---------- referências ---------- */
const AUTO = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
const autoId = () => Array.from(crypto.getRandomValues(new Uint8Array(20)), b => AUTO[b % 62]).join('');
const partes = lista => lista.join('/').split('/').filter(Boolean);

export const banco = () => ({ path: '' });
const refDoc = seg => ({ type: 'document', path: seg.join('/'), id: seg.at(-1) });
export function collection(base, ...p) { const seg = partes([base.path, ...p]); return { type: 'collection', path: seg.join('/'), id: seg.at(-1) }; }
export function doc(base, ...p) {
  if (base.type === 'collection' && !p.length) return refDoc([...partes([base.path]), autoId()]); // id novo
  return refDoc(partes([base.path, ...p]));
}
export const where = (campo, op, valor) => ({ campo, op, valor });
export const query = (col, ...filtros) => ({ type: 'query', path: col.path, filtros });

/* ---------- leitura ---------- */
const meta = { hasPendingWrites: false, fromCache: false };
function snapDoc(path) {
  const d = docs.get(path), ref = refDoc(path.split('/'));
  return { id: ref.id, ref, metadata: meta, exists: () => d !== undefined, data: () => d === undefined ? undefined : doBanco(structuredClone(d)) };
}
const filhosDe = col => [...docs.keys()].filter(p => p.startsWith(col + '/') && !p.slice(col.length + 1).includes('/'));
function passa(d, { campo, op, valor }) {
  const v = doBanco(campo.split('.').reduce((o, k) => o?.[k], d));
  if (v === undefined) return false;
  const n = x => x instanceof Timestamp ? x.toMillis() : x;
  if (op === '==') return igual(v, valor);
  if (op === '>=') return n(v) >= n(valor);
  if (op === '<=') return n(v) <= n(valor);
  if (op === '>') return n(v) > n(valor);
  if (op === '<') return n(v) < n(valor);
  throw new Error('Filtro não suportado: ' + op);
}
function snapConsulta(alvo) {
  const filtros = alvo.filtros || [];
  const lista = filhosDe(alvo.path).filter(p => filtros.every(f => passa(docs.get(p), f))).sort().map(snapDoc);
  return { docs: lista, size: lista.length, empty: !lista.length, metadata: meta, forEach: fn => lista.forEach(fn) };
}
export async function getDoc(ref) { await pronto; return snapDoc(ref.path); }
export async function getDocs(alvo) { await pronto; return snapConsulta(alvo); }

/* ---------- escrita ---------- */
function setarCampo(obj, caminho, valor) { // "a.b.c": cria os níveis que faltarem
  const ks = caminho.split('.'); let o = obj;
  for (const k of ks.slice(0, -1)) o = (o[k] && typeof o[k] === 'object') ? o[k] : (o[k] = {});
  o[ks.at(-1)] = resolverAgora(valor);
}
function calcular(op, lote) { // devolve [path, novo | null]; lote = operações anteriores do mesmo writeBatch
  if (op.tipo === 'delete') return [op.path, null];
  const bruto = lote.has(op.path) ? lote.get(op.path) : docs.get(op.path);
  const atual = bruto == null ? undefined : doBanco(structuredClone(bruto));
  if (op.tipo === 'update' && atual === undefined) throw Object.assign(new Error('Registro não existe: ' + op.path), { code: 'not-found' });
  let novo;
  if (op.tipo === 'set') novo = resolverAgora(op.dados);
  else { novo = atual; for (const [k, v] of Object.entries(op.dados)) setarCampo(novo, k, v); }
  return [op.path, paraBanco(novo)];
}
async function executar(ops) {
  await pronto;
  const lote = new Map();
  const mudancas = ops.map(op => { const m = calcular(op, lote); lote.set(m[0], m[1]); return m; });
  await L.gravarDocs(mudancas);    // SQLite numa transação; a memória só muda se gravou
  avisar(mudancas.map(([p]) => p));
}
export const setDoc = (ref, dados) => executar([{ tipo: 'set', path: ref.path, dados }]);
export const updateDoc = (ref, dados) => executar([{ tipo: 'update', path: ref.path, dados }]);
export const deleteDoc = ref => executar([{ tipo: 'delete', path: ref.path }]);
export function writeBatch() {
  const ops = [];
  const b = {
    set: (ref, dados) => (ops.push({ tipo: 'set', path: ref.path, dados }), b),
    update: (ref, dados) => (ops.push({ tipo: 'update', path: ref.path, dados }), b),
    delete: ref => (ops.push({ tipo: 'delete', path: ref.path }), b),
    commit: () => executar(ops)
  };
  return b;
}

/* ---------- avisos de mudança (telas que acompanham uma coleção ou um registro) ---------- */
function avisar(paths) {
  for (const o of ouvintes) {
    const afeta = o.alvo.type === 'document' ? paths.includes(o.alvo.path) : paths.some(p => p.slice(0, p.lastIndexOf('/')) === o.alvo.path);
    if (afeta) o.emitir();
  }
}
export function onSnapshot(alvo, ...args) {
  if (args[0] && typeof args[0] === 'object') args.shift(); // opções (ignoradas: não há servidor)
  const [proximo, erro] = args;
  const o = { alvo, ativo: true, emitir: () => queueMicrotask(() => {
    if (!o.ativo) return;
    try { proximo(alvo.type === 'document' ? snapDoc(alvo.path) : snapConsulta(alvo)); } catch (e) { console.error(e); erro?.(e); }
  }) };
  ouvintes.add(o);
  pronto.then(o.emitir, e => erro?.(e));
  return () => { o.ativo = false; ouvintes.delete(o); };
}
