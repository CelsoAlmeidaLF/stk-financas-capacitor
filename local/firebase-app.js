/* Modo local do APK: substitui o firebase-app.js. Não há projeto Firebase; carrega o modo local (backup e ajustes de tela). */
import './modo-local.js';
export const initializeApp = (config = {}, nome = '[DEFAULT]') => ({ name: nome, options: config, local: true });
export const deleteApp = async () => {};
export const getApp = () => ({ name: '[DEFAULT]', options: {}, local: true });
