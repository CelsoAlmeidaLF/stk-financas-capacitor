/* Edição local do APK: quem abre o app já passou pelo PIN do cofre, então há um único usuário local.
   Sem conta, e-mail ou senha. Os dados da casa guardam `por: 'local'`. */
const usuario = { uid: 'local', displayName: null, email: '' };
export const getAuth = () => ({ currentUser: usuario });
export function onAuthStateChanged(auth, cb) { setTimeout(() => cb(usuario)); return () => {}; }
