// js/oraculo.js
import { signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { doc, getDoc, setDoc, collection, onSnapshot, query, orderBy, getDocs } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { auth, db } from "./firebase.js";
import { loadUserProfile } from "./user-service.js";
import { loadBookChapters, subscribeBooks, subscribeOraclePosts } from "./catalog-service.js";
import { bindFavoriteButton } from "./progress-service.js";
import { renderChapterList } from "./chapter-list.js";
import { extractYouTubeId, openMediaViewer } from "./media-viewer.js";
import { escapeHtml, safeUrl } from "./security.js";
import { renderContentState, showToast } from "./feedback.js";
import { bindDialogCloseButton, closeAccessibleDialog, makeActivatable, openAccessibleDialog } from "./dialog-accessibility.js";
import { bookStatusMarkup, emptyBookStatusMessage } from "./book-status.js";

window.fecharModal = () => closeAccessibleDialog(document.getElementById("netflix-modal"));
bindDialogCloseButton(document.getElementById("netflix-modal"));


let livrosCache = [];

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

        inicializarFeed();
    }
});

function inicializarFeed() {
    subscribeBooks((livros) => {
        livrosCache = livros;
    }, (error) => {
        console.error("Erro ao carregar obras relacionadas:", error);
        showToast("Algumas obras relacionadas podem estar indisponíveis.", "error");
    });

    subscribeOraclePosts((todosPosts) => {
        const agora = new Date();

        const posts = todosPosts
            // Um post "agendado" só aparece pro público depois que a data/hora dele chegar
            .filter(p => new Date(p.dataPublicacao) <= agora)
            .sort((a, b) => new Date(b.dataPublicacao) - new Date(a.dataPublicacao));

        renderizarFeed(posts);
    }, (error) => {
        console.error("Erro ao carregar Oráculo:", error);
        renderContentState(document.getElementById("oraculo-feed"), {
            type: "error",
            title: "Oráculo indisponível",
            message: "Não foi possível consultar as publicações agora."
        });
        showToast("Falha ao atualizar o Oráculo.", "error");
    });

    document.getElementById("btn-logout")?.addEventListener("click", () => {
        signOut(auth).then(() => window.location.href = "index.html");
    });
}

function renderizarFeed(posts) {
    const feed = document.getElementById("oraculo-feed");
    const vazio = document.getElementById("oraculo-vazio");

    feed.innerHTML = "";

    if (posts.length === 0) {
        vazio.style.display = "block";
        return;
    }
    vazio.style.display = "none";

    posts.forEach(post => {
        const dataFormatada = new Date(post.dataPublicacao).toLocaleDateString("pt-BR", {
            day: '2-digit', month: 'long', year: 'numeric'
        });

        const classeTipo = `tipo-${(post.tipo || 'outro').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")}`;

        const chipsLivros = (post.livrosRelacionados || [])
            .map(id => livrosCache.find(l => l.id === id))
            .filter(Boolean)
            .map(livro => `<span class="oraculo-chip-livro" data-id="${escapeHtml(livro.id)}">${escapeHtml(livro.titulo)}</span>`)
            .join("");

        const card = document.createElement("article");
        card.className = "oraculo-post";
        card.innerHTML = `
            <div class="oraculo-post-header">
                <span class="oraculo-tipo-badge ${classeTipo}">${escapeHtml(post.tipo)}</span>
                <span class="oraculo-data">${dataFormatada}</span>
            </div>
            ${post.titulo ? `<h3>${escapeHtml(post.titulo)}</h3>` : ''}
            <p class="oraculo-conteudo">${escapeHtml(post.conteudo)}</p>
            ${post.imagem ? `<img class="oraculo-imagem" src="${safeUrl(post.imagem)}" alt="${escapeHtml(post.titulo || '')}">` : ''}
            ${chipsLivros ? `<div class="oraculo-livros-relacionados">${chipsLivros}</div>` : ''}
        `;
        feed.appendChild(card);

        card.querySelectorAll(".oraculo-chip-livro").forEach(chip => {
            chip.addEventListener("click", () => {
                const livro = livrosCache.find(l => l.id === chip.getAttribute("data-id"));
                if (livro) abrirModalNetflix(livro.id, livro);
            });
        });
    });
}

// Pop-up estilo Netflix (mesmo padrão da Home/Biblioteca/Universos)
async function abrirModalNetflix(idLivro, livro) {
    const banner = document.getElementById('modal-banner');
    const titulo = document.getElementById('modal-titulo');
    const universoLabel = document.getElementById('modal-universo');
    const sinopse = document.getElementById('modal-sinopse');
    const listaCapitulosContainer = document.getElementById('modal-lista-capitulos');

    if (banner) banner.style.backgroundImage = `url('${livro.capa}')`;
    if (titulo) titulo.innerText = livro.titulo;
    if (universoLabel) universoLabel.innerText = livro.universoNome || "Universo Independente";
    if (sinopse) sinopse.innerText = livro.sinopse;
    let statusContainer = document.getElementById("modal-status-obra");
    if (!statusContainer && sinopse) {
        statusContainer = document.createElement("div");
        statusContainer.id = "modal-status-obra";
        statusContainer.className = "modal-book-status";
        sinopse.before(statusContainer);
    }
    if (statusContainer) statusContainer.innerHTML = bookStatusMarkup(livro.status, true);

    atualizarBotaoFavorito(idLivro);

    if (listaCapitulosContainer) {
        listaCapitulosContainer.innerHTML = '<p style="color: #737373;">Carregando índice de capítulos...</p>';
    }

    const modal = document.getElementById('netflix-modal');
    if (modal) {
        openAccessibleDialog(modal);
    }

    try {
        const capitulos = await loadBookChapters(idLivro);
        renderChapterList({ container: listaCapitulosContainer, chapters: capitulos, bookId: idLivro });
        if (!capitulos.length && listaCapitulosContainer) listaCapitulosContainer.innerHTML = `<p class="book-status-empty">${emptyBookStatusMessage(livro.status)}</p>`;
        carregarGaleriaModal(idLivro);
    } catch (err) {
        console.error("Erro ao carregar capítulos:", err);
        if (listaCapitulosContainer) {
            listaCapitulosContainer.innerHTML = '<p style="color: #F97316;">Erro ao carregar lista de episódios.</p>';
        }
    }

}

async function carregarGaleriaModal(idLivro) {
    const secao = document.getElementById("modal-galeria-secao");
    const grid = document.getElementById("modal-galeria-grid");
    if (!secao || !grid) return;

    grid.innerHTML = "";
    secao.style.display = "none";

    try {
        const galeriaRef = collection(db, "livros", idLivro, "galeria");
        const snap = await getDocs(galeriaRef);

        if (snap.empty) return;

        secao.style.display = "block";

        [...snap.docs].sort((a, b) => Number(a.data().ordem ?? 0) - Number(b.data().ordem ?? 0)).forEach((docSnap) => {
            const item = docSnap.data();
            const card = document.createElement("div");
            card.style.cssText = "width:110px; cursor:pointer;";

            let thumbSrc = item.url;
            let iconePlay = "";
            if (item.tipo === "video") {
                const videoId = extractYouTubeId(item.url);
                thumbSrc = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
                iconePlay = `<div style="position:absolute; inset:0; display:flex; align-items:center; justify-content:center; font-size:1.8rem; color:#FFF; text-shadow:0 2px 6px rgba(0,0,0,0.8);">▶</div>`;
            }

            card.innerHTML = `
                <div style="position:relative; width:110px; height:110px; border-radius:6px; overflow:hidden; background:#1E1A30;">
                    <img src="${thumbSrc}" style="width:100%; height:100%; object-fit:cover;">
                    ${iconePlay}
                </div>
                <p style="color:#D4D4D4; font-size:0.75rem; margin-top:6px; text-align:center; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${item.categoria}</p>
            `;
            makeActivatable(card, () => openMediaViewer(item.url, item.tipo, item), `Abrir ${item.categoria || "item da galeria"}`);
            grid.appendChild(card);
        });
    } catch (err) {
        console.error("Erro ao carregar galeria:", err);
    }
}


// =====================================================
// FAVORITAR (usado no Dashboard de Leitores do admin)
// =====================================================

async function atualizarBotaoFavorito(idLivro) {
    const btn = document.getElementById("modal-btn-favoritar");
    if (!btn || !auth.currentUser) return;

    await bindFavoriteButton({ button: btn, user: auth.currentUser, bookId: idLivro, render: renderizarBotaoFavorito });
}

function renderizarBotaoFavorito(btn, favoritado) {
    btn.innerHTML = favoritado ? "&#9829;" : "&#9825;";
    btn.style.color = favoritado ? "#F97316" : "#FFF";
}
