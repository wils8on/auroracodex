import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { collection, onSnapshot } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { auth, db } from "./firebase.js";
import { loadUserProfile, hasProfile } from "./user-service.js";
import { loadBookChapters } from "./catalog-service.js";
import { renderContentState, showToast } from "./feedback.js";
import { escapeHtml, safeUrl } from "./security.js";

let registrosCache = [], livrosCache = [], usuariosCache = new Map();

onAuthStateChanged(auth, async user => {
    if (!user) { window.location.href = "../index.html"; return; }
    const perfil = await loadUserProfile(user.uid);
    if (!hasProfile(perfil, ["admin"])) { showToast("Acesso restrito apenas ao administrador.", "error"); window.location.href = "../dashboard.html"; return; }
    inicializarDashboard();
});

function inicializarDashboard() {
    onSnapshot(collection(db, "livros"), async snapshot => {
        const livros = snapshot.docs.map(d => ({ id:d.id, ...d.data() }));
        livrosCache = await Promise.all(livros.map(async livro => {
            try { const caps = await loadBookChapters(livro.id); const publicados = caps.filter(c => c.status !== "rascunho" && (c.status !== "agendado" || (c.data_agendamento && new Date(c.data_agendamento).getTime() <= Date.now()))); return { ...livro, ultimoCapituloPublicado:Math.max(0, ...publicados.map(c => Number(c.numero) || 0)) }; }
            catch { return { ...livro, ultimoCapituloPublicado:0 }; }
        }));
        renderizarTudo();
    }, mostrarErroDashboard);
    onSnapshot(collection(db, "progresso_leitura"), snapshot => { registrosCache = snapshot.docs.map(d => ({ id:d.id, ...d.data() })); renderizarTudo(); }, mostrarErroDashboard);
    onSnapshot(collection(db, "usuarios"), snapshot => { usuariosCache = new Map(snapshot.docs.map(d => [d.id, d.data()])); renderizarTudo(); }, mostrarErroDashboard);
    document.getElementById("busca-email")?.addEventListener("input", renderizarPorLeitor);
}

function renderizarTudo() { renderizarStats(); renderizarPorLeitor(); renderizarPorLivro(); renderizarCorrida(); }
function dataValida(valor) { const data = valor?.toDate ? valor.toDate() : new Date(valor || 0); return Number.isNaN(data.getTime()) ? null : data; }
function formatarData(valor) { const data = dataValida(valor); return data ? data.toLocaleString("pt-BR", { dateStyle:"short", timeStyle:"short" }) : "Ainda não registrado"; }

function renderizarStats() {
    const concluidas = registrosCache.filter(r => r.status === "concluida").length;
    const limite = Date.now() - 7 * 86400000;
    const ultimaAtividade = registrosCache.map(r => dataValida(r.dataUltimaLeitura)).filter(Boolean).sort((a,b) => b-a)[0];
    const valores = {
        "stat-leitores-unicos":new Set(registrosCache.map(r => r.uid).filter(Boolean)).size,
        "stat-leituras-ativas":registrosCache.filter(r => r.status === "ativa").length,
        "stat-favoritados":registrosCache.filter(r => r.favorito === true).length,
        "stat-concluiram":concluidas,
        "stat-ativos-sete-dias":new Set(registrosCache.filter(r => (dataValida(r.dataUltimaLeitura)?.getTime() || 0) >= limite).map(r => r.uid)).size,
        "stat-taxa-conclusao":`${registrosCache.length ? Math.round(concluidas / registrosCache.length * 100) : 0}%`,
        "insight-ultima-atividade":ultimaAtividade ? ultimaAtividade.toLocaleDateString("pt-BR") : "Sem leituras",
        "insight-obras-engajadas":new Set(registrosCache.map(r => r.livroId).filter(Boolean)).size
    };
    Object.entries(valores).forEach(([id, valor]) => { const el = document.getElementById(id); if (el) el.textContent = valor; });
}

function agruparLeitores() {
    const mapa = {};
    registrosCache.forEach(r => {
        const perfil = usuariosCache.get(r.uid) || {};
        if (!mapa[r.uid]) mapa[r.uid] = { nome:r.nomeUsuario || perfil.nome || "Leitor", email:r.emailUsuario || perfil.email || "", foto:r.fotoUsuario || perfil.foto_perfil || "", ultimoLogin:perfil.ultimoLogin, ativas:0, concluidas:0, favoritos:0 };
        if (r.status === "ativa") mapa[r.uid].ativas++;
        if (r.status === "concluida") mapa[r.uid].concluidas++;
        if (r.favorito) mapa[r.uid].favoritos++;
    });
    return Object.values(mapa);
}

function renderizarPorLeitor() {
    const tbody = document.getElementById("tabela-por-leitor"); if (!tbody) return;
    const busca = (document.getElementById("busca-email")?.value || "").trim().toLowerCase();
    const leitores = agruparLeitores().filter(l => !busca || `${l.nome} ${l.email}`.toLowerCase().includes(busca));
    if (!leitores.length) { tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:#737373">Nenhum leitor encontrado.</td></tr>'; return; }
    tbody.innerHTML = leitores.map(l => `<tr><td><div class="reader-cell"><img src="${safeUrl(l.foto, "../assets/icons/aurora-codex-192.png")}" alt=""><strong>${escapeHtml(l.nome)}</strong></div></td><td>${escapeHtml(l.email)}</td><td class="muted-time">${formatarData(l.ultimoLogin)}</td><td>${l.ativas}</td><td>${l.concluidas}</td><td>${l.favoritos}</td></tr>`).join("");
}

function renderizarPorLivro() {
    const tbody = document.getElementById("tabela-por-livro"); if (!tbody) return;
    if (!livrosCache.length) { tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:#737373">Nenhum livro cadastrado.</td></tr>'; return; }
    tbody.innerHTML = livrosCache.map(livro => {
        const registros = registrosCache.filter(r => r.livroId === livro.id);
        return `<tr><td><div class="book-cell"><img src="${safeUrl(livro.capa, "../assets/icons/aurora-codex-192.png")}" alt=""><strong>${escapeHtml(livro.titulo)}</strong></div></td><td>${registros.filter(r => r.status === "ativa").length}</td><td>${registros.filter(r => r.status === "concluida").length}</td><td>${registros.filter(r => r.favorito).length}</td></tr>`;
    }).join("");
}

function renderizarCorrida() {
    const container = document.getElementById("corrida-leitores"); if (!container) return;
    const obras = livrosCache.map(livro => ({ livro, leitores:registrosCache.filter(r => r.livroId === livro.id).sort((a,b) => Number(b.ultimoCapituloNumero || 0)-Number(a.ultimoCapituloNumero || 0)).slice(0,5) })).filter(item => item.leitores.length);
    if (!obras.length) { container.innerHTML = '<p style="color:#737373">A corrida aparecerá quando houver progresso de leitura registrado.</p>'; return; }
    container.innerHTML = obras.map(({ livro, leitores }) => {
        const maximo = Math.max(Number(livro.ultimoCapituloPublicado)||0, ...leitores.map(r => Number(r.ultimoCapituloNumero)||0), 1);
        const corredores = leitores.map((r,index) => {
            const perfil = usuariosCache.get(r.uid) || {};
            const nome = r.nomeUsuario || perfil.nome || "Leitor";
            const progresso = Math.min(88, Math.max(2, (Number(r.ultimoCapituloNumero)||0) / maximo * 82));
            return `<div class="race-runner" style="--progress:${progresso}%;top:${8+index*4}px;z-index:${10-index}"><img src="${safeUrl(r.fotoUsuario || perfil.foto_perfil, "../assets/icons/aurora-codex-192.png")}" alt="${escapeHtml(nome)}"><span>${escapeHtml(nome)} · Cap. ${r.ultimoCapituloNumero||0}</span></div>`;
        }).join("");
        return `<article class="race-book"><div class="race-book-head"><img src="${safeUrl(livro.capa, "../assets/icons/aurora-codex-192.png")}" alt=""><div><strong>${escapeHtml(livro.titulo)}</strong><span>${leitores.length} leitor${leitores.length===1?"":"es"} no percurso · chegada no cap. ${maximo}</span></div></div><div class="race-track">${corredores}</div></article>`;
    }).join("");
}

function mostrarErroDashboard(error) {
    console.error("Erro ao carregar dashboard de leitores:", error);
    renderContentState(document.querySelector(".table-wrapper"), { type:"error", title:"Dados indisponíveis", message:"Não foi possível atualizar as métricas de leitura." });
    showToast("Falha ao carregar o dashboard de leitores.", "error");
}
