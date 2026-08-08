// js/auth.js

// CONFIGURAÇÃO DO FIREBASE (Substitua pelos seus dados gerados no console)
// Integração com os scripts do Firebase via CDN (HTML Puro)
import {
    browserLocalPersistence,
    GoogleAuthProvider,
    onAuthStateChanged,
    setPersistence,
    signInWithPopup
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { doc, setDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { auth, db } from "./firebase.js";
import { loadUserProfile } from "./user-service.js";

// Inicializa o Firebase e os Serviços
const provider = new GoogleAuthProvider();
let perfilEmVerificacao = false;

// Captura o botão de login da tela index.html se ele existir na página
const btnLogin = document.getElementById('btn-google-login');

if (btnLogin) {
    btnLogin.addEventListener('click', async () => {
        btnLogin.disabled = true;
        try {
            await setPersistence(auth, browserLocalPersistence);
            const resultado = await signInWithPopup(auth, provider);
            await processarUsuarioAutenticado(resultado.user);
        } catch (error) {
            console.error("Erro ao iniciar login:", error);
            btnLogin.disabled = false;
            alert("Falha ao iniciar a autenticação com o Google.");
        }
    });
}

onAuthStateChanged(auth, user => {
    if (user) processarUsuarioAutenticado(user);
});

async function processarUsuarioAutenticado(user) {
    if (!user || perfilEmVerificacao) return;

    perfilEmVerificacao = true;
    try {
        await verificarPerfilUsuario(user);
    } catch (error) {
        console.error("Erro ao verificar perfil:", error);
        if (btnLogin) btnLogin.disabled = false;
        alert(`Login concluído, mas não foi possível carregar o perfil (${error?.code || "erro desconhecido"}).`);
    } finally {
        perfilEmVerificacao = false;
    }
}

// Função lógica para verificar permissões e direcionar o usuário
async function verificarPerfilUsuario(user) {
    const userRef = doc(db, "usuarios", user.uid);
    const dadosUsuario = await loadUserProfile(user.uid);

    if (dadosUsuario) {
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
