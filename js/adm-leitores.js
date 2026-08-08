// js/adm-leitores.js
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { doc, getDoc, collection, onSnapshot } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { auth, db } from "./firebase.js";
import { loadUserProfile, hasProfile } from "./user-service.js";

let registrosCache = [];
let livrosCache = [];

// Trava de segurança: só ADMIN acessa esta página
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = "../index.html";
    } else {
        const perfil = await loadUserProfile(user.uid);
        if (!hasProfile(perfil, ["admin"])) {
            alert("Acesso restrito apenas ao administrador.");
            window.location.href = "../dashboard.html";
        } else {
            inicializarDashboard();
        }
    }
});

function inicializarDashboard() {
    onSnapshot(collection(db, "livros"), (snapshot) => {
        livrosCache = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        renderizarTudo();
    });

    onSnapshot(collection(db, "progresso_leitura"), (snapshot) => {
        registrosCache = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        renderizarTudo();
    });

    document.getElementById("busca-email").addEventListener("input", renderizarPorLeitor);
}

function renderizarTudo() {
    renderizarStats();
    renderizarPorLeitor();
    renderizarPorLivro();
}

function renderizarStats() {
    const uidsUnicos = new Set(registrosCache.map(r => r.uid));
    const leiturasAtivas = registrosCache.filter(r => r.status === "ativa").length;
    const favoritados = registrosCache.filter(r => r.favorito === true).length;
    const concluiram = registrosCache.filter(r => r.status === "concluida").length;

    document.getElementById("stat-leitores-unicos").innerText = uidsUnicos.size;
    document.getElementById("stat-leituras-ativas").innerText = leiturasAtivas;
    document.getElementById("stat-favoritados").innerText = favoritados;
    document.getElementById("stat-concluiram").innerText = concluiram;
}

// Agrupa os registros por leitor (uid) e monta a tabela "Por Leitor"
function renderizarPorLeitor() {
    const tbody = document.getElementById("tabela-por-leitor");
    const termoBusca = (document.getElementById("busca-email")?.value || "").trim().toLowerCase();

    const porLeitor = {};
    registrosCache.forEach(r => {
        if (!porLeitor[r.uid]) {
            porLeitor[r.uid] = { nome: r.nomeUsuario || "(sem nome)", email: r.emailUsuario || "", ativas: 0, concluidas: 0, favoritos: 0 };
        }
        if (r.status === "ativa") porLeitor[r.uid].ativas++;
        if (r.status === "concluida") porLeitor[r.uid].concluidas++;
        if (r.favorito) porLeitor[r.uid].favoritos++;
    });

    let leitores = Object.values(porLeitor);

    if (termoBusca) {
        leitores = leitores.filter(l => l.email.toLowerCase().includes(termoBusca));
    }

    tbody.innerHTML = "";

    if (leitores.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:#737373;">Nenhum leitor encontrado.</td></tr>';
        return;
    }

    leitores.forEach(l => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td><strong>${l.nome}</strong></td>
            <td>${l.email}</td>
            <td>${l.ativas}</td>
            <td>${l.concluidas}</td>
            <td>${l.favoritos}</td>
        `;
        tbody.appendChild(tr);
    });
}

// Agrupa os registros por livro e monta a tabela "Por Livro"
function renderizarPorLivro() {
    const tbody = document.getElementById("tabela-por-livro");
    tbody.innerHTML = "";

    if (livrosCache.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; color:#737373;">Nenhum livro cadastrado.</td></tr>';
        return;
    }

    livrosCache.forEach(livro => {
        const registrosDoLivro = registrosCache.filter(r => r.livroId === livro.id);
        const ativos = registrosDoLivro.filter(r => r.status === "ativa").length;
        const concluiram = registrosDoLivro.filter(r => r.status === "concluida").length;
        const favoritos = registrosDoLivro.filter(r => r.favorito === true).length;

        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td><strong>${livro.titulo}</strong></td>
            <td>${ativos}</td>
            <td>${concluiram}</td>
            <td>${favoritos}</td>
        `;
        tbody.appendChild(tr);
    });
}
