"""Gera a edição local do PWA (SQLite, sem Firebase, sem armazenamento do navegador) a partir do src original.
Uso: python3 transformar.py <src-original> <saida>  (copia só os 3 arquivos alterados para <saida>)."""
import sys, os, re

src, out = sys.argv[1], sys.argv[2]
os.makedirs(os.path.join(out, 'js'), exist_ok=True)

def ler(p): return open(os.path.join(src, p), encoding='utf8').read()
def gravar(p, s): open(os.path.join(out, p), 'w', encoding='utf8').write(s)

def troca(s, de, para, n=1):
    c = s.count(de)
    assert c == n, f'esperava {n}x, achei {c}x: {de[:80]!r}'
    return s.replace(de, para)

def corta(s, inicio, fim, para='', incluir_fim=True):
    """Remove de `inicio` até `fim` (inclusive), trocando por `para`."""
    a = s.index(inicio)
    b = s.index(fim, a) + (len(fim) if incluir_fim else 0)
    assert s.count(inicio) == 1, f'início ambíguo: {inicio[:60]!r}'
    return s[:a] + para + s[b:]

# ======================= js/app.js =======================
s = ler('js/app.js')
s = troca(s, "   Ordem de abertura: PIN/biometria (cofre local) → login Firebase (+2FA) → chave da casa (12 palavras ou hash, 1x por aparelho) → app. */",
             "   Edição local do APK: dados num banco SQLite no aparelho, sem servidor e sem armazenamento do navegador.\n"
             "   Ordem de abertura: PIN (cofre local) → chave da casa (12 palavras ou hash, 1x por aparelho) → app. */")
s = re.sub(r"const FB = 'https://www\.gstatic\.com/firebasejs/[^']+';\n", '', s, count=1)
s = troca(s, "const CFG_KEY = 'financasCasa.firebaseConfig', MODE_KEY", "const MODE_KEY")
s = corta(s, "const DEFAULT_CONFIG = {", "};\n")
# preferências: armazenamento do app (SQLite), não o localStorage
s = troca(s, "  get: k => { try { return localStorage.getItem(k); } catch { return null; } },\n  set: (k, v) => { try { localStorage.setItem(k, v); } catch {} },\n  del: k => { try { localStorage.removeItem(k); } catch {} }",
             "  get: k => window.stkArmazem.getItem(k),\n  set: (k, v) => window.stkArmazem.setItem(k, v),\n  del: k => window.stkArmazem.removeItem(k)")
s = troca(s, "if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});\n", '')
# ilha de status: sem servidor não há offline nem sincronização
s = troca(s, "  const s = !navigator.onLine ? 'off' : pend ? 'sync' : 'ok';", "  const s = pend ? 'sync' : 'ok';")
s = troca(s, "let t = '', v = '', d = 'Tudo sincronizado e cifrado de ponta a ponta.';", "let t = '', v = '', d = 'Tudo salvo e cifrado neste aparelho.';")
s = troca(s, "  if (s === 'off') { t = 'Offline'; v = ''; d = 'Os lançamentos ficam cifrados neste aparelho e sobem quando a internet voltar.'; }\n  else if (s === 'sync') { t = 'Sincronizando…'; d = 'Há lançamentos esperando o servidor.'; }\n  else if (avisoCartao)",
             "  if (s === 'sync') { t = 'Salvando…'; d = 'Gravando no banco do aparelho.'; }\n  else if (avisoCartao)")
s = troca(s, "addEventListener('online', atualizarIlha); addEventListener('offline', atualizarIlha);\n", '')
s = troca(s, "const TELAS = ['scrBoot', 'scrConfig', 'scrAuth', 'scrSemCasa', ", "const TELAS = ['scrBoot', ")
s = troca(s, "  if (v === 'casa') { renderCasa(); carregarConvites(); }", "  if (v === 'casa') renderCasa();")
# abertura: sem projeto Firebase nem tela de configuração
s = corta(s, "/* ======================= Firebase e sessão ======================= */\nfunction lerConfig()", "$('cfgDefault').onclick = () => { store.del(CFG_KEY); location.reload(); };\n",
          "/* ======================= banco local e sessão ======================= */\n")
s = troca(s, "const config = lerConfig() || DEFAULT_CONFIG;\n", '')
s = troca(s, "let A, F, fbApp, auth, db, deleteApp, initializeApp;", "let A, F, auth, db;")
s = corta(s, "try {\n  ({ initializeApp, deleteApp } = await import(FB + 'firebase-app.js'));", "  setMsg($('cfgMsg'), 'Não consegui iniciar o Firebase: ' + e.message, 'err');\n}\n",
          "try {\n  // Porta de dados local (SQLite) com a mesma forma de chamada usada pelo app, e o usuário local (o PIN já abriu o cofre).\n"
          "  A = await import('/local/acesso.js');\n  F = await import('/local/dados.js');\n  auth = A.getAuth();\n  db = F.banco();\n"
          "  import('/local/backup.js').catch(e => console.error('backup', e));\n"
          "  A.onAuthStateChanged(auth, u => entrar(u).catch(erroFatal));\n} catch (e) { erroFatal(e); }\n")
# mensagens de login, login, 2FA e "esqueci a senha"
s = corta(s, "const MSG_AUTH = {", "const msgAuth = e => MSG_AUTH[e?.code] || e?.message || String(e);\n")
s = corta(s, "/* ---------- login (sem cadastro público) + 2FA ---------- */", "$('authPass').value = ''; }\n")
s = corta(s, "async function sair() {", "document.addEventListener('click', e => { if (e.target.closest('[data-logout]')) sair().catch(erroFatal); });\n")
s = troca(s, "  if (!u) { $('avatar').textContent = 'FC'; $('title').textContent = APP_NOME; resetLogin(); mostrar('scrAuth'); return; }\n", '')
s = troca(s, "  if (!casaId) return souAdminApp ? telaSetup('nova') : telaSemCasa();", "  if (!casaId) return telaSetup('nova');")
s = troca(s, "  if (!casa.cripto) return souAdminApp ? telaSetup('proteger') : telaSemCasa('A casa ainda não foi protegida com criptografia. Peça ao administrador para abrir o app e ativar a proteção.');",
             "  if (!casa.cripto) return telaSetup('proteger');")
s = corta(s, "function telaSemCasa(msg) {", "$('copyUid').onclick = () => copiar(user.uid, 'Código copiado');\n")
s = troca(s, "  if (!navigator.onLine) return setMsg($('setupMsg'), 'Conecte-se à internet para continuar.', 'err');\n", '')
# casa: sem pessoas extras, convites, 2FA, e-mail, senha, instalação, cache e dados antigos do Firestore
s = troca(s, "  $('adminPessoas').hidden = !admin;\n  if (admin) renderConvites();\n  $('adminDados').hidden = !admin || !legadoN;\n", '')
s = corta(s, "  $('legadoN').textContent = legadoN ?", ".catch(() => {});\n\n")
s = troca(s, "  const tem2fa = A.multiFactor(user).enrolledFactors.length > 0;\n", '')
s = troca(s, "    linhaCfg('PIN e biometria', 'Abrem o app neste aparelho. Bloqueio automático e troca de PIN.', 'Ajustar', 'pin')", "    linhaCfg('PIN', 'Abre o app neste aparelho. Bloqueio automático e troca de PIN.', 'Ajustar', 'pin')")
s = corta(s, "    + linhaCfg('Duas etapas (Proton Pass)'", "'Trocar', 'senha')\n")
s = troca(s, "linhaCfg('Criptografia', 'Ponta a ponta (AES-256). O servidor só guarda dados cifrados.', '', '')", "linhaCfg('Criptografia', 'AES-256. Os dados ficam cifrados no banco SQLite deste aparelho.', '', '')")
s = troca(s, "    + linhaCfg('Selo da casa', casa.cripto?.selo ? `<b class=\"num\">${esc(casa.cripto.selo)}</b> · igual em todos os aparelhos da casa`", "    + linhaCfg('Selo da casa', casa.cripto?.selo ? `<b class=\"num\">${esc(casa.cripto.selo)}</b> · confere com o backup`")
s = corta(s, "  const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone;", "'Atualizar', 'updateApp');\n",
          "  $('appInfo').innerHTML = linhaCfg('Versão', esc(root.dataset.vaultVersion) + ' · modo local (SQLite)', '', '');\n")
s = corta(s, "    '2fa-on': ativar2FA, '2fa-off': desativar2FA,\n", "    frase: gerarPalavrasCasa,", "    frase: gerarPalavrasCasa,", incluir_fim=True)
s = corta(s, "    instalar: async () => { if (!instalar) return;", "      window.location.reload(true);\n    }\n")
s = troca(s, "    frase: gerarPalavrasCasa, codigo: gerarCodigoCasa, envelope: gerarEnvelope,\n  })[b.dataset.cfg]?.();", "    frase: gerarPalavrasCasa, codigo: gerarCodigoCasa, envelope: gerarEnvelope\n  })[b.dataset.cfg]?.();")
s = corta(s, "/* reautenticação (com 2FA, se ativado) antes de operações sensíveis */", "async function gerarPalavrasCasa() {", "async function gerarPalavrasCasa() {")
s = corta(s, "/* pessoas (administrador) */", "async function incluirPessoa(uid, nome) {\n  await F.updateDoc(F.doc(db, 'casas', casaId), { membros: F.arrayUnion(uid), [`pessoas.${uid}`]: { nome } });\n  await F.setDoc(F.doc(db, 'usuarios', uid), { nome, casaId });\n}\n",
          "/* pessoas: só o nome de quem usa este aparelho */\n")
s = corta(s, "    aoExcluir: uid === user.uid ? null : async () => {", "    }\n  });\n});", "  });\n});")
i = s.index("/* dados antigos (sem criptografia) */")
s = s[:i].rstrip() + '\n'
# arquivos (certificado do administrador): no Android não há download de blob; grava em Documentos (backup.js)
s = troca(s, """function baixar(nome, texto, tipo) {
  const url = URL.createObjectURL(new Blob([texto], { type: tipo }));
  const a = Object.assign(document.createElement('a'), { href: url, download: nome });
  document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 2000);
}""", """function baixar(nome, texto) {
  window.stkSalvarArquivo(nome, texto).then(r => toast(r.local ? 'Salvo em ' + r.local : 'Arquivo pronto')).catch(e => toast('Não salvei: ' + e.message, 'err'));
}""")
# ganchos que sobraram de recursos removidos
s = troca(s, "let user = null, perfil = null, casaId = null, casa = null, chave = null, souAdminApp = false;", "let user = null, perfil = null, casaId = null, casa = null, chave = null;")
s = troca(s, "  souAdminApp = !cfgDoc?.exists() || cfgDoc.data().admin === u.uid;\n", '')
s = troca(s, "  const cfgDoc = await F.getDoc(F.doc(db, 'config', 'app')).catch(() => null);\n", '')
s = troca(s, "    const cfgRef = F.doc(db, 'config', 'app');\n    if (!(await F.getDoc(cfgRef)).exists()) await F.setDoc(cfgRef, { admin: user.uid });\n", '')
s = troca(s, "let cartaoSel = null, planoSel = 'metas', filtro = 'all', pessoaFiltro = 'all', busca = '', legadoN = 0;", "let cartaoSel = null, planoSel = 'metas', filtro = 'all', pessoaFiltro = 'all', busca = '';")
s = troca(s, "      legadoN = 0; setMsg($('setupMsg'),", "      setMsg($('setupMsg'),")
s = troca(s, "const COLECOES_CASA = ['lancamentos', 'compras', 'cartoes', 'dividas', 'investimentos', 'metas', 'despesas'];", "const COLECOES_CASA = ['lancamentos', 'compras', 'cartoes', 'dividas', 'investimentos', 'metas'];")
s = troca(s, "/* Instalação (PWA): o evento chega cedo, antes do PIN. */\nlet instalar = null;\naddEventListener('beforeinstallprompt', e => { e.preventDefault(); instalar = e; });\naddEventListener('appinstalled', () => { instalar = null; });\n", '')
gravar('js/app.js', s)

# ======================= index.html =======================
h = ler('index.html')
h = troca(h, '<section id="scrBoot"><div class="glass empty">Conectando…</div></section>', '<section id="scrBoot"><div class="glass empty">Abrindo…</div></section>')
h = corta(h, "  <!-- trocar projeto Firebase (DEV com outro projeto) -->", "  </section>\n")
h = corta(h, "  <!-- login: sem cadastro público -->", "  </section>\n")
h = corta(h, "  <!-- logado, mas sem casa liberada -->", "  </section>\n")
h = troca(h, '    <div class="sec-h"><span></span><button class="link" data-logout>Sair da conta</button></div>\n', '')
h = corta(h, '      <div id="adminPessoas" hidden>', '      <div class="sec-h"><b>Segurança</b></div>', '      <div class="sec-h"><b>Segurança</b></div>')
h = corta(h, '      <div id="adminDados" hidden>', '      <div class="sec-h"><b>App</b></div>', '      <div class="sec-h"><b>App</b></div>')
h = corta(h, '      <button class="btn danger" data-logout>Sair da conta</button>', '</p>\n')
h = troca(h, 'Passe as palavras <b>ou</b> a hash para sua esposa <b>pessoalmente</b>. Ela digita uma única vez no celular dela. O selo pode ser mostrado sem risco: serve só para conferir.',
             'Guarde as palavras <b>ou</b> a hash fora do celular: são elas que abrem o backup num aparelho novo. O selo pode ser mostrado sem risco: serve só para conferir.')
h = re.sub(r'<meta http-equiv="Content-Security-Policy" content="[^"]*">',
           '<meta http-equiv="Content-Security-Policy" content="default-src \'self\'; script-src \'self\'; style-src \'self\' \'unsafe-inline\'; font-src \'self\'; connect-src \'self\'; img-src \'self\' data: blob:; object-src \'none\'; base-uri \'self\'; form-action \'self\'; manifest-src \'self\'">', h, count=1)
# boot.js primeiro: abre o SQLite e só então carrega os scripts do app, na mesma ordem
tags = re.findall(r'<script\b([^>]*)\bsrc="([^"]+)"[^>]*></script>\n', h)
assert len(tags) == 5, tags
lista = ','.join('{"src":"%s","module":%s}' % (src_, 'true' if 'type="module"' in attrs else 'false') for attrs, src_ in tags)
h = re.sub(r'(<script\b[^>]*\bsrc="[^"]+"[^>]*></script>\n)+', lambda m: '<script src="local/boot.js" data-scripts=\'[' + lista + ']\'></script>\n', h, count=1)
gravar('index.html', h)

# ======================= stk-pkg-secure-ui.js =======================
u = ler('stk-pkg-secure-ui.js')
u = troca(u, "  const nativeStorage = window.localStorage;", "  const nativeStorage = window.stkArmazem; // edição local: SQLite do aparelho")
u = troca(u, "sessionStorage.", "window.stkSessao.", n=u.count("sessionStorage."))
# Sessão entre recargas: sem IndexedDB, não há chave de sessão; recarregar pede o PIN de novo.
u = troca(u, "  // Recarregar a página não bloqueia: a chave do cofre fica cifrada no sessionStorage da aba (some ao fechar a aba)\n  // por uma chave AES não-exportável guardada no IndexedDB. Só o bloqueio (manual, por inatividade ou ao sair) apaga.\n", '')
u = corta(u, "  function sessionStore(mode, run) {", "  const sessionReady = tabReady.then(loadSessionKey).catch(() => {});",
          "  // Edição local: sem IndexedDB não há chave de sessão; recarregar a página pede o PIN de novo.\n  const sessionReady = Promise.resolve();")
u = corta(u, "  async function clearLegacySessionKeys() {", "  legacyCleanup.catch(block);\n", "  const legacyCleanup = tabReady;\n")
u = corta(u, "  if ('serviceWorker' in navigator) {\n    navigator.serviceWorker.register('sw.js'", "      location.reload();\n    });\n  }\n")
gravar('stk-pkg-secure-ui.js', u)
print('ok')
