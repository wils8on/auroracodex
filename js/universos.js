// js/universos.js
import { signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { doc, getDoc, setDoc, collection, onSnapshot, query, orderBy, getDocs } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { auth, db } from "./firebase.js";
import { loadUserProfile } from "./user-service.js";
import { loadBookChapters, subscribeBooks, subscribeUniverses } from "./catalog-service.js";
import { bindFavoriteButton } from "./progress-service.js";
import { renderChapterList } from "./chapter-list.js";
import { extractYouTubeId, openMediaViewer } from "./media-viewer.js";
import { renderContentState, showToast } from "./feedback.js";
import { bindDialogCloseButton, closeAccessibleDialog, makeActivatable, openAccessibleDialog } from "./dialog-accessibility.js";
import { bookStatusMarkup, emptyBookStatusMessage } from "./book-status.js";

window.fecharModal = () => closeAccessibleDialog(document.getElementById("netflix-modal"));
bindDialogCloseButton(document.getElementById("netflix-modal"));

let universosCache = [];
let livrosCache = [];

const idUniversoNaUrl = new URLSearchParams(window.location.search).get("id");

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

        inicializarDados();
    }
});

function inicializarDados() {
    subscribeUniverses((universos) => {
        universosCache = universos;
        renderizarTela();
    }, (error) => {
        console.error("Erro ao carregar universos:", error);
        renderContentState(document.getElementById("universos-grid"), {
            type: "error",
            title: "Universos indisponíveis",
            message: "Não foi possível atualizar esta área. Tente novamente."
        });
        showToast("Falha ao carregar os universos.", "error");
    });

    subscribeBooks((livros) => {
        livrosCache = livros;
        renderizarTela();
    }, (error) => {
        console.error("Erro ao carregar obras dos universos:", error);
        showToast("Falha ao atualizar as obras dos universos.", "error");
    });

    document.getElementById("btn-logout")?.addEventListener("click", () => {
        signOut(auth).then(() => window.location.href = "index.html");
    });
}

// Decide qual vista mostrar (lista geral ou detalhe de um universo específico)
function renderizarTela() {
    if (idUniversoNaUrl) {
        renderizarDetalheUniverso(idUniversoNaUrl);
    } else {
        renderizarListaUniversos();
    }
}

function renderizarListaUniversos() {
    document.getElementById("vista-lista-universos").style.display = "block";
    document.getElementById("vista-detalhe-universo").style.display = "none";

    const grid = document.getElementById("universos-grid");
    const avisoVazio = document.getElementById("universos-vazio");

    grid.innerHTML = "";

    if (universosCache.length === 0) {
        avisoVazio.style.display = "block";
        return;
    }
    avisoVazio.style.display = "none";

    universosCache.forEach(u => {
        const qtdLivros = livrosCache.filter(l => l.universoId === u.id).length;

        const card = document.createElement("div");
        card.className = "universo-card";
        card.style.backgroundColor = u.corTema || "#7c3aed";
        if (u.capa) card.style.backgroundImage = `url('${u.capa}')`;
        makeActivatable(card, () => { window.location.href = `universos.html?id=${u.id}`; }, `Explorar universo ${u.nome}`);

        card.innerHTML = `
            <div class="universo-card-overlay">
                <span class="universo-card-count">${qtdLivros} livro${qtdLivros === 1 ? '' : 's'}</span>
                <h4>${u.nome}</h4>
                <p>${u.descricao || ''}</p>
            </div>
        `;
        grid.appendChild(card);
    });
}

function renderizarDetalheUniverso(id) {
    const universo = universosCache.find(u => u.id === id);

    // Ainda carregando os dados do Firestore — espera o próximo snapshot
    if (!universo) return;

    document.getElementById("vista-lista-universos").style.display = "none";
    document.getElementById("vista-detalhe-universo").style.display = "block";

    const banner = document.getElementById("universo-banner");
    banner.style.backgroundColor = universo.corTema || "#7c3aed";
    banner.style.backgroundImage = universo.capa ? `url('${universo.capa}')` : "none";

    document.getElementById("universo-nome-detalhe").innerText = universo.nome;
    document.getElementById("universo-descricao-detalhe").innerText = universo.descricao || "";

    const livrosDoUniverso = livrosCache.filter(l => l.universoId === id);
    const grid = document.getElementById("universo-livros-grid");
    grid.innerHTML = "";

    if (livrosDoUniverso.length === 0) {
        grid.innerHTML = '<p style="color:#737373; padding: 20px;">Nenhum livro vinculado a este universo ainda.</p>';
        return;
    }

    livrosDoUniverso.forEach(livro => {
        const card = document.createElement("div");
        card.className = "biblioteca-card";
        makeActivatable(card, () => abrirModalNetflix(livro.id, livro), `Abrir detalhes de ${livro.titulo}`);

        card.innerHTML = `
            <div class="biblioteca-card-capa">
                <img src="${livro.capa}" alt="${livro.titulo}" loading="lazy">
            </div>
            <div class="biblioteca-card-info">
                <h4>${livro.titulo}</h4>
                <p class="genero-label">${livro.genero || 'Não informado'}</p>
            </div>
        `;
        grid.appendChild(card);
    });
}

// Pop-up estilo Netflix com busca de capítulos (mesmo comportamento da Home/Biblioteca)
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

// Busca os itens de galeria do livro e renderiza miniaturas (imagem ou vídeo)
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
