/* Modo local do APK: primeiro script da página. Abre o banco SQLite nativo (plugin @capacitor-community/sqlite),
   carrega tudo para a memória e só então carrega os scripts do PWA (lista em data-scripts, gerada pelo copiar-web.mjs).

   Nada fica no armazenamento do navegador:
   - localStorage   → tabela kv do SQLite (cofre do PIN, chave da casa, preferências);
   - dados da casa  → tabela docs do SQLite (via fb-local/firebase-firestore.js);
   - sessionStorage → só memória (some ao fechar; recarregar pede o PIN de novo);
   - IndexedDB, service worker e Cache Storage → desligados.
   O arquivo do banco fica na pasta privada do app no celular (databases/financas-casaSQLite.db).
   Fora do Android (navegador, para desenvolvimento) não há SQLite: usa só memória e avisa no console. */
(function () {
  'use strict';
  const BANCO = 'financas-casa';
  const eu = document.currentScript;
  const scripts = JSON.parse(eu.dataset.scripts || '[]');

  /* ---------- armazenamento nativo (SQLite) ou memória ---------- */
  const Cap = window.Capacitor;
  const nativo = Boolean(Cap?.isNativePlatform?.());
  const SQL = nativo ? (Cap.Plugins?.CapacitorSQLite || Cap.registerPlugin('CapacitorSQLite')) : null;
  const docs = new Map(), kv = new Map();
  let fila = Promise.resolve();             // escritas em ordem, uma de cada vez
  const enfileirar = fn => (fila = fila.then(fn, fn));

  async function abrirSqlite() {
    try { await SQL.checkConnectionsConsistency({ dbNames: [], openModes: [] }); } catch (_) {} // fecha conexões de uma carga anterior
    await SQL.createConnection({ database: BANCO, version: 1, encrypted: false, mode: 'no-encryption', readonly: false });
    await SQL.open({ database: BANCO, readonly: false });
    await SQL.execute({ database: BANCO, readonly: false, transaction: true, statements: `
      CREATE TABLE IF NOT EXISTS docs (path TEXT PRIMARY KEY NOT NULL, colecao TEXT NOT NULL, dados TEXT NOT NULL);
      CREATE INDEX IF NOT EXISTS docs_colecao ON docs (colecao);
      CREATE TABLE IF NOT EXISTS kv (chave TEXT PRIMARY KEY NOT NULL, valor TEXT NOT NULL);` });
    const q = async sql => (await SQL.query({ database: BANCO, statement: sql, values: [], readonly: false })).values || [];
    for (const r of await q('SELECT path, dados FROM docs')) docs.set(r.path, JSON.parse(r.dados));
    for (const r of await q('SELECT chave, valor FROM kv')) kv.set(r.chave, r.valor);
  }
  const executarSet = set => SQL.executeSet({ database: BANCO, set, transaction: true, readonly: false });

  const colecaoDe = path => path.slice(0, path.lastIndexOf('/'));
  // mudancas: [[path, dados | null]]. Grava no SQLite numa transação; a memória só muda se gravou.
  function gravarDocs(mudancas) {
    return enfileirar(async () => {
      if (nativo) await executarSet(mudancas.map(([p, d]) => d === null
        ? { statement: 'DELETE FROM docs WHERE path = ?', values: [p] }
        : { statement: 'INSERT OR REPLACE INTO docs (path, colecao, dados) VALUES (?, ?, ?)', values: [p, colecaoDe(p), JSON.stringify(d)] }));
      for (const [p, d] of mudancas) d === null ? docs.delete(p) : docs.set(p, d);
    });
  }
  // Troca tudo (restaurar backup): docs e kv numa transação só.
  function substituirTudo(listaDocs, listaKv) {
    return enfileirar(async () => {
      if (nativo) await executarSet([
        { statement: 'DELETE FROM docs', values: [] }, { statement: 'DELETE FROM kv', values: [] },
        ...listaDocs.map(({ path, dados }) => ({ statement: 'INSERT INTO docs (path, colecao, dados) VALUES (?, ?, ?)', values: [path, colecaoDe(path), JSON.stringify(dados)] })),
        ...listaKv.map(([k, v]) => ({ statement: 'INSERT INTO kv (chave, valor) VALUES (?, ?)', values: [k, v] }))]);
      docs.clear(); listaDocs.forEach(({ path, dados }) => docs.set(path, dados));
      kv.clear(); listaKv.forEach(([k, v]) => kv.set(k, v));
    });
  }
  function gravarKv(chave, valor) { // valor null = apagar
    if (!nativo) return;
    enfileirar(() => executarSet([valor === null
      ? { statement: 'DELETE FROM kv WHERE chave = ?', values: [chave] }
      : { statement: 'INSERT OR REPLACE INTO kv (chave, valor) VALUES (?, ?)', values: [chave, valor] }])
    ).catch(e => console.error('[modo local] kv', e));
  }

  /* ---------- Storage (API do localStorage) sobre um Map ---------- */
  function criarStorage(mapa, persistir) {
    const api = {
      get length() { return mapa.size; },
      key: i => [...mapa.keys()][i] ?? null,
      getItem: k => mapa.has(String(k)) ? mapa.get(String(k)) : null,
      setItem: (k, v) => { k = String(k); v = String(v); mapa.set(k, v); persistir?.(k, v); },
      removeItem: k => { k = String(k); if (mapa.delete(k)) persistir?.(k, null); },
      clear: () => { for (const k of [...mapa.keys()]) api.removeItem(k); }
    };
    return api;
  }
  const trocar = (alvo, nome, valor) => { try { Object.defineProperty(alvo, nome, { value: valor, configurable: true, writable: false }); } catch (e) { console.error('[modo local] não troquei ' + nome, e); } };
  trocar(window, 'localStorage', criarStorage(kv, gravarKv));
  trocar(window, 'sessionStorage', criarStorage(new Map(), null));
  trocar(window, 'indexedDB', {
    open() { const r = {}; setTimeout(() => { r.error = new Error('IndexedDB desligado no modo local'); r.onerror?.({ target: r }); }); return r; },
    deleteDatabase() { const r = {}; setTimeout(() => r.onsuccess?.({ target: r })); return r; }
  });
  trocar(window, 'caches', { keys: async () => [], delete: async () => true, open: async () => { throw new Error('Cache desligado no modo local'); }, match: async () => undefined });
  trocar(navigator, 'serviceWorker', {
    controller: null, ready: new Promise(() => {}),
    register: () => Promise.reject(new Error('Service worker desligado no modo local')),
    getRegistrations: async () => [], addEventListener() {}, removeEventListener() {}
  });
  // Sem servidor não existe "offline": o app trata como sempre conectado.
  trocar(navigator, 'onLine', true);

  // fila() = espera as escritas pendentes (usar antes de recarregar a página).
  window.__stkLocal = { nativo, banco: BANCO, docs, kv, gravarDocs, substituirTudo, fila: () => fila.catch(() => {}) };

  /* ---------- abre o banco e carrega o PWA ---------- */
  function carregar(src) {
    return new Promise((ok, falha) => {
      const s = document.createElement('script');
      if (src.module) s.type = 'module';
      s.src = src.src; s.async = false;
      s.onload = ok; s.onerror = () => falha(new Error('Não carregou ' + src.src));
      document.head.append(s);
    });
  }
  function falhaFatal(e) {
    console.error('[modo local]', e);
    const p = document.createElement('pre');
    p.style.cssText = 'white-space:pre-wrap;padding:24px;font:14px/1.5 monospace;color:#E08585';
    p.textContent = 'Não consegui abrir o banco de dados do aparelho.\n\n' + (e?.message || e);
    document.body.replaceChildren(p);
  }
  // aberto = banco carregado (o firebase-firestore.js espera por ele). Os scripts do PWA só carregam depois.
  const aberto = nativo ? abrirSqlite() : Promise.resolve(console.warn('[modo local] fora do Android: dados só na memória, nada é salvo.'));
  window.__stkLocal.aberto = aberto;
  // Os scripts do PWA eram defer/module: esperam a página inteira montada.
  const domPronto = document.readyState === 'loading' ? new Promise(ok => document.addEventListener('DOMContentLoaded', ok, { once: true })) : Promise.resolve();
  Promise.all([aberto, domPronto]).then(async () => { for (const s of scripts) await carregar(s); })
    .catch(e => domPronto.then(() => falhaFatal(e)));
})();
