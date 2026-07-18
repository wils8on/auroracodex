// js/adm.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, collection, onSnapshot, doc, updateDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// CREDENCIAIS OFICIAIS SINCRONIZADAS COM O AUTH.JS
const firebaseConfig = {
  apiKey: "AIzaSyCPFNgtGch_nWL6gDNmXzGuwWtd4X4QDgs",
  authDomain: "aurora-codex.firebaseapp.com",
  projectId: "aurora-codex",
  storageBucket: "aurora-codex.firebasestorage.app",
  messagingSenderId: "193340365366",
  appId: "1:193340365366:web:6b6920e8c8b4d434749697"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Trava de segurança: Garante que apenas o ADMIN acesse esta página
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = "../index.html";
    } else {
        const userDoc = await getDoc(doc(db, "usuarios", user.uid));
        if (!userDoc.exists() || userDoc.data().perfil !== "admin") {
            alert("Acesso restrito apenas ao administrador.");
            window.location.href = "../dashboard.html";
        } else {
            ouvirUsuarios(); // Se for admin, carrega a lista em tempo real
        }
    }
});

// Busca os usuários no Firestore e monta a tabela dinamicamente
function ouvirUsuarios() {
    const usuariosRef = collection(db, "usuarios");
    
    // O onSnapshot atualiza a tela automaticamente se alguém novo logar
    onSnapshot(usuariosRef, (snapshot) => {
        const tbody = document.getElementById("lista-usuarios");
        tbody.innerHTML = ""; // Limpa a tabela

        snapshot.forEach((docSnap) => {
            const id = docSnap.id;
            const u = docSnap.data();
            
            // Define o design da tag de status baseado no perfil
            const statusClass = u.perfil === "pendente" ? "status-pending" : "status-active";
            const statusTexto = u.perfil === "pendente" ? "Pendente" : "Ativo";

            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td>
                    <div class="user-row-info">
                        <img src="${u.foto_perfil || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?q=80&w=100'}" class="user-row-avatar">
                        <strong>${u.nome}</strong>
                    </div>
                </td>
                <td>${u.email}</td>
                <td><span class="badge-status ${statusClass}">${statusTexto}</span></td>
                <td>
                    <select data-id="${id}" class="select-perfil">
                        <option value="pendente" ${u.perfil === 'pendente' ? 'selected' : ''}>Pendente</option>
                        <option value="leitor" ${u.perfil === 'leitor' ? 'selected' : ''}>Leitor</option>
                        <option value="autor" ${u.perfil === 'autor' ? 'selected' : ''}>Autor</option>
                        <option value="admin" ${u.perfil === 'admin' ? 'selected' : ''}>Admin</option>
                    </select>
                </td>
            `;
            tbody.appendChild(tr);
        });

        // Adiciona o evento de alteração em cada select do perfil
        document.querySelectorAll(".select-perfil").forEach(select => {
            select.addEventListener("change", async (e) => {
                const userId = e.target.getAttribute("data-id");
                const novoPerfil = e.target.value;
                
                // Atualiza diretamente no banco de dados
                await updateDoc(doc(db, "usuarios", userId), {
                    perfil: novoPerfil
                });
            });
        });
    });
}