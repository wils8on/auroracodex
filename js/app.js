// js/app.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const firebaseConfig = { apiKey: "AIzaSyCPFNgtGch_nWL6gDNmXzGuwWtd4X4QDgs",
  authDomain: "aurora-codex.firebaseapp.com",
  projectId: "aurora-codex",
  storageBucket: "aurora-codex.firebasestorage.app",
  messagingSenderId: "193340365366",
  appId: "1:193340365366:web:6b6920e8c8b4d434749697" };
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Monitora o estado do usuário logado na Home
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = "index.html"; // Se não está logado, expulsa para a tela de login
    } else {
        // Altera a foto do avatar para a foto real do Google da pessoa
        if(document.getElementById('user-avatar')) document.getElementById('user-avatar').src = user.photoURL;
        
        // Puxa as permissões do banco
        const userDoc = await getDoc(doc(db, "usuarios", user.uid));
        if (userDoc.exists()) {
            const dados = userDoc.data();
            
            // Atualiza a tag de perfil da navbar (Autor, Leitor, Admin)
            if(document.getElementById('user-role-badge')) {
                document.getElementById('user-role-badge').innerText = dados.perfil.toUpperCase();
            }

            // Se for admin, revela o botão secreto do painel de controle
            if (dados.perfil === "admin" && document.getElementById('link-adm')) {
                document.getElementById('link-adm').style.display = "block";
            }
        }
    }
});

// Executa o Logout (Sair da conta)
const btnLogout = document.getElementById("btn-logout");
if (btnLogout) {
    btnLogout.addEventListener("click", () => {
        signOut(auth).then(() => {
            window.location.href = "index.html";
        }).catch((err) => console.error("Erro ao sair:", err));
    });
}