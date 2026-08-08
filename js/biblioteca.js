// js/biblioteca.js
import { signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { doc, getDoc, setDoc, collection, onSnapshot, query, orderBy, getDocs } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { auth, db } from "./firebase.js";
import { loadUserProfile } from "./user-service.js";
import { bindFavoriteButton } from "./progress-service.js";
import { extractYouTubeId, openMediaViewer } from "./media-viewer.js";
import { loadBookChapters } from "./catalog-service.js";
import { renderChapterList } from "./chapter-list.js";
import { renderContentState, showToast } from "./feedback.js";
import { bindDialogCloseButton, closeAccessibleDialog, makeActivatable, openAccessibleDialog } from "./dialog-accessibility.js";

window.fecharModal = () => closeAccessibleDialog(document.getElementById("netflix-modal"));
bindDialogCloseButton(document.getElementById("netflix-modal"));

let todosLivros = [];       // Lista completa vinda do Firestore
let tagsSelecionadas = new Set(); // Tags de subgênero ativas no momento

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

        inicializarCatalogo();
    }
});

function inicializarCatalogo() {
    const livrosRef = collection(db, "livros");

    onSnapshot(livrosRef, (snapshot) => {
        todosLivros = [];
        snapshot.forEach((docSnap) => {
            todosLivros.push({ id: docSnap.id, ...docSnap.data() });
        });

        renderizarTagsDisponiveis();
        aplicarFiltros();
    }, (error) => {
        console.error("Erro ao carregar biblioteca:", error);
        renderContentState(document.getElementById("biblioteca-grid"), {
            type: "error",
            title: "Biblioteca indisponível",
            message: "Não foi possível buscar as obras. Verifique sua conexão e tente novamente."
        });
        showToast("Falha ao atualizar a Biblioteca.", "error");
    });

    // Carrega as opções de gênero a partir da mesma coleção de configurações usada no painel do autor
    onSnapshot(doc(db, "configuracoes", "catalogo"), (snap) => {
        if (!snap.exists()) return;

        const generos = snap.data().generos || [];
        const select = document.getElementById("filtro-genero");
        const valorAtual = select.value;

        select.innerHTML = '<option value="">Todos os Gêneros</option>';
        generos.forEach(g => {
            const opt = document.createElement("option");
            opt.value = g;
            opt.innerText = g;
            select.appendChild(opt);
        });

        if (generos.includes(valorAtual)) select.value = valorAtual;
    }, (error) => {
        console.error("Erro ao carregar filtros:", error);
        showToast("Os filtros de gênero não puderam ser atualizados.", "error");
    });

    // Vincula os campos de filtro (uma única vez)
    document.getElementById("busca-titulo").addEventListener("input", aplicarFiltros);
    document.getElementById("filtro-genero").addEventListener("change", aplicarFiltros);
    document.getElementById("filtro-status").addEventListener("change", aplicarFiltros);

    document.getElementById("btn-logout")?.addEventListener("click", () => {
        signOut(auth).then(() => window.location.href = "index.html");
    });
}

// Gera os chips de subgênero dinamicamente, a partir de tudo que já foi usado nos livros cadastrados
function renderizarTagsDisponiveis() {
    const container = document.getElementById("biblioteca-tags");
    const todasAsTags = new Set();

    todosLivros.forEach(livro => {
        (livro.subgeneros || []).forEach(tag => todasAsTags.add(tag));
    });

    container.innerHTML = "";
    todasAsTags.forEach(tag => {
        const chip = document.createElement("button");
        chip.className = "tag-filtro" + (tagsSelecionadas.has(tag) ? " active" : "");
        chip.innerText = tag;
        chip.onclick = () => {
            if (tagsSelecionadas.has(tag)) {
                tagsSelecionadas.delete(tag);
            } else {
                tagsSelecionadas.add(tag);
            }
            renderizarTagsDisponiveis();
            aplicarFiltros();
        };
        container.appendChild(chip);
    });
}

// Combina todos os filtros ativos (texto + gênero + status + tags) e redesenha o grid
function aplicarFiltros() {
    const textoBusca = document.getElementById("busca-titulo").value.trim().toLowerCase();
    const generoSelecionado = document.getElementById("filtro-genero").value;
    const statusSelecionado = document.getElementById("filtro-status").value;

    const resultado = todosLivros.filter(livro => {
        const bateTexto = !textoBusca ||
            (livro.titulo || "").toLowerCase().includes(textoBusca) ||
            (livro.sinopse || "").toLowerCase().includes(textoBusca);

        const bateGenero = !generoSelecionado || livro.genero === generoSelecionado;
        const bateStatus = !statusSelecionado || livro.status === statusSelecionado;

        const bateTags = tagsSelecionadas.size === 0 ||
            (livro.subgeneros || []).some(tag => tagsSelecionadas.has(tag));

        return bateTexto && bateGenero && bateStatus && bateTags;
    });

    renderizarGrid(resultado);
}

function renderizarGrid(livros) {
    const grid = document.getElementById("biblioteca-grid");
    const avisoVazio = document.getElementById("biblioteca-vazio");

    grid.innerHTML = "";

    if (livros.length === 0) {
        avisoVazio.style.display = "block";
        return;
    }
    avisoVazio.style.display = "none";

    livros.forEach(livro => {
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
                ${gerarBadgeStatus(livro.status)}
            </div>
        `;
        grid.appendChild(card);
    });
}

function gerarBadgeStatus(status) {
    const mapaClasses = {
        "Em Breve": "status-em-breve",
        "Em Andamento": "status-em-andamento",
        "Concluído": "status-concluido"
    };
    const classe = mapaClasses[status] || "status-em-breve";
    return `<span class="status-badge ${classe}">${status || 'Em Breve'}</span>`;
}

// Pop-up estilo Netflix com busca de capítulos (mesmo comportamento da Home)
async function abrirModalNetflix(idLivro, livro) {
    const banner = document.getElementById('modal-banner');
    const titulo = document.getElementById('modal-titulo');
    const universo = document.getElementById('modal-universo');
    const sinopse = document.getElementById('modal-sinopse');
    const listaCapitulosContainer = document.getElementById('modal-lista-capitulos');

    if (banner) banner.style.backgroundImage = `url('${livro.capa}')`;
    if (titulo) titulo.innerText = livro.titulo;
    if (universo) universo.innerText = livro.universo || "Universo Independente";
    if (sinopse) sinopse.innerText = livro.sinopse;

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
        const q = query(galeriaRef, orderBy("ordem", "asc"));
        const snap = await getDocs(q);

        if (snap.empty) return;

        secao.style.display = "block";

        snap.forEach((docSnap) => {
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
            makeActivatable(card, () => openMediaViewer(item.url, item.tipo), `Abrir ${item.categoria || "item da galeria"}`);
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
