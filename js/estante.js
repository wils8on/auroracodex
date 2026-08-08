// js/estante.js
import { signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { doc, getDoc, setDoc, collection, onSnapshot, query, where, orderBy, getDocs } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { auth, db } from "./firebase.js";
import { loadUserProfile } from "./user-service.js";
import { loadBookChapters, subscribeBooks } from "./catalog-service.js";
import { bindFavoriteButton } from "./progress-service.js";
import { renderChapterList } from "./chapter-list.js";
import { renderContentState, showToast } from "./feedback.js";

let livrosCache = {};       // id -> dados do livro (para exibir capa/sinopse atualizadas)
let progressoCache = [];    // registros de progresso_leitura do usuário logado

onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = "index.html";
        return;
    }

    if (document.getElementById('user-avatar')) {
        document.getElementById('user-avatar').src = user.photoURL;
    }

    const dados = await loadUserProfile(user.uid);
    if (dados) {

        if (dados.perfil === "pendente") {
            window.location.href = "aguardando.html";
            return;
        }

        if (document.getElementById('user-role-badge')) {
            document.getElementById('user-role-badge').innerText = dados.perfil.toUpperCase();
        }
        if (dados.perfil === "admin" && document.getElementById('link-adm')) {
            document.getElementById('link-adm').style.display = "block";
        }

        inicializarEstante(user);
    }
});

function inicializarEstante(user) {
    // Mantém o catálogo de livros sempre atualizado (capas, sinopses, etc podem mudar)
    subscribeBooks((livros) => {
        livrosCache = {};
        livros.forEach(livro => { livrosCache[livro.id] = livro; });
        renderizarEstante();
    }, (error) => {
        console.error("Erro ao carregar livros da estante:", error);
        renderContentState(document.getElementById("card-continuar-leitura"), {
            type: "error",
            title: "Estante indisponível",
            message: "Não foi possível atualizar os dados das obras."
        });
        showToast("Falha ao atualizar a Estante.", "error");
    });

    // Escuta apenas o progresso de leitura do usuário logado
    const progressoRef = query(collection(db, "progresso_leitura"), where("uid", "==", user.uid));
    onSnapshot(progressoRef, (snapshot) => {
        progressoCache = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        renderizarEstante();
    }, (error) => {
        console.error("Erro ao carregar progresso:", error);
        document.getElementById("estante-vazio").style.display = "none";
        renderContentState(document.getElementById("card-continuar-leitura"), {
            type: "error",
            title: "Progresso indisponível",
            message: "Não foi possível carregar sua leitura. Tente recarregar a página."
        });
        showToast("Falha ao carregar seu progresso de leitura.", "error");
    });

    document.getElementById("btn-logout")?.addEventListener("click", () => {
        signOut(auth).then(() => window.location.href = "index.html");
    });
}

function renderizarEstante() {
    if (progressoCache.length === 0) {
        document.getElementById("estante-vazio").style.display = "block";
        ["secao-continuar", "secao-favoritos", "secao-lendo", "secao-concluidos"].forEach(id => {
            document.getElementById(id).style.display = "none";
        });
        return;
    }
    document.getElementById("estante-vazio").style.display = "none";

    // --- Continuar Leitura: leitura ativa mais recente ---
    const ativas = progressoCache.filter(r => r.status === "ativa");
    const secaoContinuar = document.getElementById("secao-continuar");
    if (ativas.length > 0) {
        const maisRecente = [...ativas].sort((a, b) => new Date(b.dataUltimaLeitura || 0) - new Date(a.dataUltimaLeitura || 0))[0];
        renderizarCardContinuar(maisRecente);
        secaoContinuar.style.display = "block";
    } else {
        secaoContinuar.style.display = "none";
    }

    // --- Favoritos ---
    const favoritos = progressoCache.filter(r => r.favorito === true);
    renderizarGridSecao("secao-favoritos", "grid-favoritos", favoritos, false);

    // --- Lendo (todas as leituras ativas) ---
    renderizarGridSecao("secao-lendo", "grid-lendo", ativas, true);

    // --- Concluídos ---
    const concluidos = progressoCache.filter(r => r.status === "concluida");
    renderizarGridSecao("secao-concluidos", "grid-concluidos", concluidos, false);
}

function renderizarCardContinuar(registro) {
    const container = document.getElementById("card-continuar-leitura");
    const livro = livrosCache[registro.livroId];
    const capa = (livro && livro.capa) || registro.livroCapa || "";

    container.innerHTML = "";
    const card = document.createElement("div");
    card.className = "continuar-card";
    card.innerHTML = `
        <img src="${capa}" alt="${registro.livroTitulo}">
        <div class="continuar-card-info">
            <h4>${registro.livroTitulo}</h4>
            <p>Capítulo ${registro.ultimoCapituloNumero}${registro.ultimoCapituloTitulo ? ' — ' + registro.ultimoCapituloTitulo : ''}</p>
        </div>
        <span class="continuar-card-cta">Continuar &rarr;</span>
    `;
    card.onclick = () => {
        if (registro.ultimoCapituloId) {
            window.location.href = `ler.html?livroId=${registro.livroId}&capituloId=${registro.ultimoCapituloId}`;
        } else if (livro) {
            abrirModalNetflix(registro.livroId, livro);
        }
    };
    container.appendChild(card);
}

function renderizarGridSecao(idSecao, idGrid, registros, mostrarProgresso) {
    const secao = document.getElementById(idSecao);
    const grid = document.getElementById(idGrid);
    grid.innerHTML = "";

    if (registros.length === 0) {
        secao.style.display = "none";
        return;
    }
    secao.style.display = "block";

    registros.forEach(registro => {
        const livro = livrosCache[registro.livroId];
        const titulo = (livro && livro.titulo) || registro.livroTitulo;
        const capa = (livro && livro.capa) || registro.livroCapa || "";
        const genero = (livro && livro.genero) || "";

        const card = document.createElement("div");
        card.className = "biblioteca-card";
        card.onclick = () => {
            if (livro) {
                abrirModalNetflix(registro.livroId, livro);
            }
        };

        card.innerHTML = `
            <div class="biblioteca-card-capa">
                <img src="${capa}" alt="${titulo}" loading="lazy">
            </div>
            <div class="biblioteca-card-info">
                <h4>${titulo}</h4>
                <p class="genero-label">${genero}</p>
                ${mostrarProgresso ? `<p class="progresso-label">Capítulo ${registro.ultimoCapituloNumero}</p>` : ''}
                ${registro.status === 'concluida' ? '<span class="status-badge status-concluido">Concluído</span>' : ''}
            </div>
        `;
        grid.appendChild(card);
    });
}

// Pop-up estilo Netflix com busca de capítulos (mesmo padrão do resto do site)
async function abrirModalNetflix(idLivro, livro) {
    const banner = document.getElementById('modal-banner');
    const titulo = document.getElementById('modal-titulo');
    const universo = document.getElementById('modal-universo');
    const sinopse = document.getElementById('modal-sinopse');
    const listaCapitulosContainer = document.getElementById('modal-lista-capitulos');

    if (banner) banner.style.backgroundImage = `url('${livro.capa}')`;
    if (titulo) titulo.innerText = livro.titulo;
    if (universo) universo.innerText = livro.universoNome || livro.universo || "Universo Independente";
    if (sinopse) sinopse.innerText = livro.sinopse;

    atualizarBotaoFavorito(idLivro);

    if (listaCapitulosContainer) {
        listaCapitulosContainer.innerHTML = '<p style="color: #737373;">Carregando índice de capítulos...</p>';
    }

    const modal = document.getElementById('netflix-modal');
    if (modal) {
        modal.style.display = 'block';
        document.body.style.overflow = 'hidden';
    }

    try {
        const capitulos = await loadBookChapters(idLivro);
        renderChapterList({ container: listaCapitulosContainer, chapters: capitulos, bookId: idLivro, background: "#2a2440", hoverBackground: "#332C4D" });
    } catch (err) {
        console.error("Erro ao carregar capítulos:", err);
        if (listaCapitulosContainer) {
            listaCapitulosContainer.innerHTML = '<p style="color: #F97316;">Erro ao carregar lista de episódios.</p>';
        }
    }
}

async function atualizarBotaoFavorito(idLivro) {
    const btn = document.getElementById("modal-btn-favoritar");
    if (!btn || !auth.currentUser) return;

    await bindFavoriteButton({ button: btn, user: auth.currentUser, bookId: idLivro, render: renderizarBotaoFavorito });
}

function renderizarBotaoFavorito(btn, favoritado) {
    btn.innerHTML = favoritado ? "&#9829; Favoritado" : "&#9825; Favoritar";
    btn.style.color = favoritado ? "#F97316" : "#FFF";
}
