import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyARY2gcT7TK1aUqgwaW11zlpogvHYQ_bd0",
  authDomain: "coordenacao-fbda9.firebaseapp.com",
  projectId: "coordenacao-fbda9",
  storageBucket: "coordenacao-fbda9.firebasestorage.app",
  messagingSenderId: "485307595932",
  appId: "1:485307595932:web:55d37df5c16b6815958159",
  measurementId: "G-XJMB8QQ7K2"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const COLLECTION = "rosaQuizSessions";
export const baseUrl = new URL("./", location.href).href;
export const errorMessage = (err) => {
  const messages = {
    "auth/operation-not-allowed": "Ative o método de autenticação no Firebase Authentication.",
    "auth/unauthorized-domain": "Adicione dtechbr.github.io aos domínios autorizados do Firebase Authentication.",
    "auth/popup-blocked": "Permita janelas pop-up neste navegador e tente novamente.",
    "auth/popup-closed-by-user": "A janela de login foi fechada antes da autenticação.",
    "permission-denied": "Acesso negado. Verifique as regras do Cloud Firestore e se a autenticação está ativa.",
    "failed-precondition": "Confirme se o banco Cloud Firestore foi criado no projeto."
  };
  return messages[err?.code] || (err?.message ? err.message : "Ocorreu um erro de conexão.");
};
export const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]));
