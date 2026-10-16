/* Modo local do APK: mesma API do Firestore que o app.js usa, gravando no SQLite do aparelho (tabela docs,
   aberta pelo fb-local/boot.js). Nada sai do celular. Os registros continuam cifrados pelo app (campo c);
   aqui só se guarda o que chega. Cobre só o que o app.js chama: doc, collection, query/where, get/set/update/delete,
   writeBatch, onSnapshot, serverTimestamp/Timestamp, arrayUnion/arrayRemove/deleteField, getCountFromServer. */

const L = window.__stkLocal;
if (!L) throw new Error('Modo local sem o boot.js');
const docs = L.docs;               // path -> dados (cópia em memória do SQLite)
const ouvintes = new Set();
const pronto = L.aberto;

/* ---------- Timestamp e sentinelas ---------- */
export class Timestamp {
  constructor(seconds, nanoseconds = 0) { this.seconds = seconds; this.nanoseconds = nanoseconds; }
  static fromMillis(ms) { return new Timestamp(Math.floor(ms / 1000), Math.round((ms % 1000) * 1e6)); }
  static now() { return Timestamp.fromMillis(Date.now()); }
  static fromDate(d) { return Timestamp.fromMillis(d.getTime()); }
  toMillis() { return this.seconds * 1000 + Math.floor(this.nanoseconds / 1e6); }
  toDate() { return new Date(this.toMillis()); }
}
const SENT = Symbol('sentinela');
export const serverTimestamp = () => ({ [SENT]: 'ts' });
export const deleteField = () => ({ [SENT]: 'del' });
export const arrayUnion = (...v) => ({ [SENT]: 'union', v });
export const arrayRemove = (...v) => ({ [SENT]: 'remove', v });

// Guarda: Timestamp vira {__ts: ms}. Lê: volta a ser Timestamp.
const paraBanco = v => v instanceof Timestamp ? { __ts: v.toMillis() }
  : Array.isArray(v) ? v.map(paraBanco)
  : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, paraBanco(x)])) : v;
const doBanco = v => v && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length === 1 && typeof v.__ts === 'number' ? Timestamp.fromMillis(v.__ts)
  : Array.isArray(v) ? v.map(doBanco)
  : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, doBanco(x)])) : v;

const igual = (a, b) => JSON.stringify(paraBanco(a)) === JSON.stringify(paraBanco(b));
function aplicar(alvo, valor, atual) {
  const s = valor?.[SENT];
  if (s === 'ts') return Timestamp.now();
  if (s === 'union') { const arr = Array.isArray(atual) ? [...atual] : []; for (const x of valor.v) if (!arr.some(y => igual(x, y))) arr.push(x); return arr; }
  if (s === 'remove') return (Array.isArray(atual) ? atual : []).filter(y => !valor.v.some(x => igual(x, y)));
  if (valor && typeof valor === 'object' && !(valor instanceof Timestamp) && !Array.isArray(valor))
    return Object.fromEntries(Object.entries(valor).filter(([, x]) => x?.[SENT] !== 'del').map(([k, x]) => [k, aplicar(null, x, undefined)]));
  return valor;
}

/* ---------- referências ---------- */
const AUTO = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
const autoId = () => Array.from(crypto.getRandomValues(new Uint8Array(20)), b => AUTO[b % 62]).join('');
const juntar = partes => partes.join('/').split('/').filter(Boolean);

export function initializeFirestore() { return { tipo: 'db' }; }
export const getFirestore = initializeFirestore;
export const persistentLocalCache = () => ({});
export const persistentMultipleTabManager = () => ({});

function refDoc(seg) { const path = seg.join('/'); return { type: 'document', path, id: seg.at(-1), parent: { type: 'collection', path: seg.slice(0, -1).join('/') } }; }
export function collection(base, ...partes) {
  const seg = juntar([base.path || '', ...partes]);
  return { type: 'collection', path: seg.join('/'), id: seg.at(-1) };
}
export function doc(base, ...partes) {
  if (base.type === 'collection' && !partes.length) return refDoc([...juntar([base.path]), autoId()]);
  return refDoc(juntar([base.path || '', ...partes]));
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
const campo = (d, c) => c.split('.').reduce((o, k) => o?.[k], d);
function passa(d, { campo: c, op, valor }) {
  const v = doBanco(campo(d, c)), x = valor;
  const cmp = (a, b) => (a instanceof Timestamp ? a.toMillis() : a) < (b instanceof Timestamp ? b.toMillis() : b) ? -1 : igual(a, b) ? 0 : 1;
  if (v === undefined) return false;
  switch (op) {
    case '==': return igual(v, x);
    case '!=': return !igual(v, x);
    case '>=': return cmp(v, x) >= 0;
    case '>': return cmp(v, x) > 0;
    case '<=': return cmp(v, x) <= 0;
    case '<': return cmp(v, x) < 0;
    case 'array-contains': return Array.isArray(v) && v.some(y => igual(y, x));
    case 'in': return x.some(y => igual(v, y));
    default: throw new Error('Filtro não suportado no modo local: ' + op);
  }
}
function snapConsulta(alvo) {
  const filtros = alvo.filtros || [];
  const lista = filhosDe(alvo.path).filter(p => filtros.every(f => passa(docs.get(p), f))).sort().map(snapDoc);
  return { docs: lista, size: lista.length, empty: !lista.length, metadata: meta, forEach: fn => lista.forEach(fn) };
}
export async function getDoc(ref) { await pronto; return snapDoc(ref.path); }
export async function getDocs(alvo) { await pronto; return snapConsulta(alvo); }
export async function getCountFromServer(alvo) { await pronto; const n = snapConsulta(alvo).size; return { data: () => ({ count: n }) }; }

/* ---------- escrita ---------- */
function setarCampo(obj, caminho, valor) {
  const ks = caminho.split('.'); let o = obj;
  for (const k of ks.slice(0, -1)) o = (o[k] && typeof o[k] === 'object') ? o[k] : (o[k] = {});
  const ult = ks.at(-1);
  if (valor?.[SENT] === 'del') delete o[ult]; else o[ult] = aplicar(null, valor, o[ult]);
}
function calcular(op, base) { // devolve [path, novo | null]; base = estado com as operações anteriores do lote
  const bruto = base.has(op.path) ? base.get(op.path) : docs.get(op.path);
  const atual = bruto == null ? undefined : doBanco(structuredClone(bruto));
  if (op.tipo === 'delete') return [op.path, null];
  if (op.tipo === 'update' && atual === undefined) throw Object.assign(new Error('Documento não existe: ' + op.path), { code: 'not-found' });
  let novo;
  if (op.tipo === 'set' && !op.merge) novo = aplicar(null, op.dados, undefined);
  else { novo = atual || {}; for (const [k, v] of Object.entries(op.dados)) setarCampo(novo, k, v); }
  return [op.path, paraBanco(novo)];
}
async function executar(ops) {
  await pronto;
  const base = new Map();
  const mudancas = ops.map(op => { const m = calcular(op, base); base.set(m[0], m[1]); return m; });
  await L.gravarDocs(mudancas);    // SQLite numa transação; a memória só muda se gravou
  avisar(mudancas.map(([p]) => p));
}
export const setDoc = (ref, dados, opcoes = {}) => executar([{ tipo: 'set', path: ref.path, dados, merge: !!opcoes.merge }]);
export const updateDoc = (ref, dados) => executar([{ tipo: 'update', path: ref.path, dados }]);
export const deleteDoc = ref => executar([{ tipo: 'delete', path: ref.path }]);
export function writeBatch() {
  const ops = [];
  const b = {
    set: (ref, dados, opcoes = {}) => (ops.push({ tipo: 'set', path: ref.path, dados, merge: !!opcoes.merge }), b),
    update: (ref, dados) => (ops.push({ tipo: 'update', path: ref.path, dados }), b),
    delete: ref => (ops.push({ tipo: 'delete', path: ref.path }), b),
    commit: () => executar(ops)
  };
  return b;
}

/* ---------- tempo real ---------- */
function avisar(paths) {
  for (const o of ouvintes) {
    const afeta = o.alvo.type === 'document' ? paths.includes(o.alvo.path) : paths.some(p => p.slice(0, p.lastIndexOf('/')) === o.alvo.path);
    if (afeta) o.emitir();
  }
}
export function onSnapshot(alvo, ...args) {
  if (typeof args[0] === 'object' && args[0] !== null && typeof args[0] !== 'function') args.shift(); // opções
  const [proximo, erro] = args;
  const o = { alvo, ativo: true, emitir: () => queueMicrotask(() => {
    if (!o.ativo) return;
    try { proximo(alvo.type === 'document' ? snapDoc(alvo.path) : snapConsulta(alvo)); } catch (e) { console.error(e); erro?.(e); }
  }) };
  ouvintes.add(o);
  pronto.then(o.emitir, e => erro?.(e));
  return () => { o.ativo = false; ouvintes.delete(o); };
}

/* ---------- backup (usado por modo-local.js) ---------- */
export async function exportarTudo() { await pronto; return [...docs.entries()].map(([path, dados]) => ({ path, dados })); }
export async function vazio() { await pronto; return docs.size === 0; }
