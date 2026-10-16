/* Modo local do APK: substitui o firebase-auth.js. Sem e-mail e senha: quem abre o app já passou pelo PIN do cofre
   (window.vaultReady), então há um único usuário local, sempre "logado". Login, convites e duas etapas não existem aqui. */
const indisponivel = () => Promise.reject(Object.assign(new Error('Indisponível no modo local: este app guarda tudo só no aparelho.'), { code: 'local/indisponivel' }));

const usuario = { uid: 'local', email: '', emailVerified: true, displayName: null, isAnonymous: false, providerData: [] };
export const getAuth = () => ({ currentUser: usuario, languageCode: 'pt-BR' });
export const initializeAuth = getAuth;
export const inMemoryPersistence = {};
export function onAuthStateChanged(auth, cb) { setTimeout(() => cb(usuario)); return () => {}; }
// "Sair" no modo local só tranca o app de novo (volta ao PIN).
export const signOut = async () => { await window.__stkLocal?.fila?.(); location.reload(); };

export const signInWithEmailAndPassword = indisponivel;
export const createUserWithEmailAndPassword = indisponivel;
export const sendPasswordResetEmail = indisponivel;
export const sendEmailVerification = indisponivel;
export const updateProfile = async () => {};
export const reauthenticateWithCredential = async () => {};
export const getMultiFactorResolver = () => { throw Object.assign(new Error('Indisponível no modo local.'), { code: 'local/indisponivel' }); };
export const multiFactor = () => ({ enrolledFactors: [], getSession: indisponivel, enroll: indisponivel, unenroll: indisponivel });
export const TotpMultiFactorGenerator = { FACTOR_ID: 'totp', generateSecret: indisponivel, assertionForSignIn: () => ({}), assertionForEnrollment: () => ({}) };
export const EmailAuthProvider = { credential: () => ({}) };
