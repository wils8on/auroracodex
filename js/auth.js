// js/auth.js

// CONFIGURAÇÃO DO FIREBASE (Substitua pelos seus dados gerados no console)
const firebaseConfig = {
  apiKey: "AIzaSyCPFNgtGch_nWL6gDNmXzGuwWtd4X4QDgs",
  authDomain: "aurora-codex.firebaseapp.com",
  projectId: "aurora-codex",
  storageBucket: "aurora-codex.firebasestorage.app",
  messagingSenderId: "193340365366",
  appId: "1:193340365366:web:6b6920e8c8b4d434749697"
};

// Integração com os scripts do Firebase via CDN (HTML Puro)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// Inicializa o Firebase e os Serviços
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

// Captura o botão de login da tela index.html se ele existir na página
const btnLogin = document.getElementById('btn-google-login');

if (btnLogin) {
    btnLogin.addEventListener('click', () => {
        signInWithPopup(auth, provider)
            .then((result) => {
                const user = result.user;
                verificarPerfilUsuario(user);
            })
            .catch((error) => {
                console.error("Erro ao logar:", error);
                alert("Falha na autenticação com o Google.");
            });
    });
}

// Função lógica para verificar permissões e direcionar o usuário
async function verificarPerfilUsuario(user) {
    const userRef = doc(db, "usuarios", user.uid);
    const userSnap = await getDoc(userRef);

    if (userSnap.exists()) {
        const dadosUsuario = userSnap.data();
        
        // Redirecionamento baseado no perfil cadastrado pelo Admin
        if (dadosUsuario.perfil === "pendente") {
            window.location.href = "aguardando.html";
        } else {
            window.location.href = "dashboard.html";
        }
    } else {
        // Se é o primeiro login da pessoa, salva no banco com perfil "pendente"
        await setDoc(userRef, {
            nome: user.displayName,
            email: user.email,
            foto_perfil: user.photoURL,
            perfil: "pendente",
            data_cadastro: new Date().toISOString().split('T')[0]
        });
        
        // Envia para a tela de espera
        window.location.href = "aguardando.html";
    }
}