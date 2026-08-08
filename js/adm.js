// js/adm.js
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { collection, onSnapshot, doc, updateDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { auth, db } from "./firebase.js";
import { loadUserProfile, hasProfile } from "./user-service.js";
import { renderContentState, showToast } from "./feedback.js";
import { escapeHtml, safeUrl } from "./security.js";

// Trava de segurança: Garante que apenas o ADMIN acesse esta página
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = "../index.html";
    } else {
        const perfil = await loadUserProfile(user.uid);
        if (!hasProfile(perfil, ["admin"])) {
            showToast("Acesso restrito apenas ao administrador.", "error");
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
                        <img src="${safeUrl(u.foto_perfil, 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?q=80&w=100')}" alt="" class="user-row-avatar">
                        <strong>${escapeHtml(u.nome || "Sem nome")}</strong>
                    </div>
                </td>
                <td>${escapeHtml(u.email || "")}</td>
                <td><span class="badge-status ${statusClass}">${statusTexto}</span></td>
                <td>
                    <select data-id="${escapeHtml(id)}" data-perfil-anterior="${escapeHtml(u.perfil)}" class="select-perfil" aria-label="Definir perfil de ${escapeHtml(u.nome || u.email || 'usuário')}">
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
                const perfilAnterior = e.target.dataset.perfilAnterior || "pendente";
                e.target.disabled = true;
                try {
                    await updateDoc(doc(db, "usuarios", userId), { perfil: novoPerfil });
                    e.target.dataset.perfilAnterior = novoPerfil;
                    showToast("Perfil atualizado com sucesso.", "success");
                } catch (error) {
                    console.error("Erro ao atualizar perfil:", error);
                    e.target.value = perfilAnterior;
                    showToast("Não foi possível atualizar o perfil.", "error");
                } finally {
                    e.target.disabled = false;
                }
            });
        });
    }, (error) => {
        console.error("Erro ao carregar usuários:", error);
        renderContentState(document.getElementById("lista-usuarios")?.closest(".table-wrapper"), {
            type: "error",
            title: "Usuários indisponíveis",
            message: "Não foi possível atualizar a lista de credenciais."
        });
        showToast("Falha ao carregar usuários.", "error");
    });
}
