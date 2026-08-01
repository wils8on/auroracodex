// js/biblioteca.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, collection, onSnapshot, query, orderBy, getDocs } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

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

    const userDoc = await getDoc(doc(db, "usuarios", user.uid));
    if (userDoc.exists()) {
        const dados = userDoc.data();

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
        card.onclick = () => abrirModalNetflix(livro.id, livro);

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
        modal.style.display = 'block';
        document.body.style.overflow = 'hidden';
    }

    try {
        const capsRef = collection(db, "livros", idLivro, "capitulos");
        const q = query(capsRef, orderBy("numero", "asc"));
        const capsSnap = await getDocs(q);

        if (listaCapitulosContainer) {
            listaCapitulosContainer.innerHTML = "";

            if (capsSnap.empty) {
                listaCapitulosContainer.innerHTML = '<p style="color: #737373;">Nenhum capítulo publicado para esta obra ainda.</p>';
                return;
            }

            capsSnap.forEach((capSnap) => {
                const cap = capSnap.data();
                const item = document.createElement('div');
                item.style.cssText = "background: #2f2f2f; padding: 16px; border-radius: 4px; display: flex; justify-content: space-between; align-items: center; cursor: pointer; transition: background 0.2s;";

                item.onmouseenter = () => item.style.background = "#3c3c3c";
                item.onmouseleave = () => item.style.background = "#2f2f2f";

                item.onclick = (e) => {
                    e.stopPropagation();
                    window.location.href = `ler.html?livroId=${idLivro}&capituloId=${capSnap.id}`;
                };

                item.innerHTML = `
                    <div>
                        <span style="color: #E50914; font-weight: 600; margin-right: 10px;">Episódio ${cap.numero}</span>
                        <strong style="color: #FFF;">${cap.titulo}</strong>
                    </div>
                    <span style="color: #8C8C8C; font-size: 0.85rem;">Ler Agora &rarr;</span>
                `;
                listaCapitulosContainer.appendChild(item);
            });
        }
    } catch (err) {
        console.error("Erro ao carregar capítulos:", err);
        if (listaCapitulosContainer) {
            listaCapitulosContainer.innerHTML = '<p style="color: #E50914;">Erro ao carregar lista de episódios.</p>';
        }
    }

    carregarGaleriaModal(idLivro);
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
                const videoId = extrairYoutubeId(item.url);
                thumbSrc = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
                iconePlay = `<div style="position:absolute; inset:0; display:flex; align-items:center; justify-content:center; font-size:1.8rem; color:#FFF; text-shadow:0 2px 6px rgba(0,0,0,0.8);">▶</div>`;
            }

            card.innerHTML = `
                <div style="position:relative; width:110px; height:110px; border-radius:6px; overflow:hidden; background:#1A1A1A;">
                    <img src="${thumbSrc}" style="width:100%; height:100%; object-fit:cover;">
                    ${iconePlay}
                </div>
                <p style="color:#D4D4D4; font-size:0.75rem; margin-top:6px; text-align:center; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${item.categoria}</p>
            `;
            card.onclick = () => abrirLightboxGaleria(item.url, item.tipo);
            grid.appendChild(card);
        });
    } catch (err) {
        console.error("Erro ao carregar galeria:", err);
    }
}

function extrairYoutubeId(url) {
    if (!url) return "";
    if (url.includes("youtu.be/")) return url.split("youtu.be/")[1].split("?")[0];
    if (url.includes("v=")) return url.split("v=")[1].split("&")[0];
    return "";
}

// Lightbox simples em tela cheia pra ver imagem/vídeo da galeria em tamanho maior
function abrirLightboxGaleria(url, tipo) {
    const overlay = document.createElement("div");
    overlay.style.cssText = "position:fixed; inset:0; background:rgba(0,0,0,0.92); z-index:10000; display:flex; align-items:center; justify-content:center; padding:20px;";
    overlay.onclick = () => overlay.remove();

    if (tipo === "video") {
        const videoId = extrairYoutubeId(url);
        overlay.innerHTML = `<iframe width="800" height="450" style="max-width:90vw; max-height:80vh; border:none; border-radius:8px;" src="https://www.youtube.com/embed/${videoId}?autoplay=1" allow="autoplay; encrypted-media" allowfullscreen></iframe>`;
    } else {
        overlay.innerHTML = `<img src="${url}" style="max-width:90vw; max-height:85vh; border-radius:8px; box-shadow:0 20px 60px rgba(0,0,0,0.6);">`;
    }

    document.body.appendChild(overlay);
}


// =====================================================
// FAVORITAR (usado no Dashboard de Leitores do admin)
// =====================================================

async function atualizarBotaoFavorito(idLivro) {
    const btn = document.getElementById("modal-btn-favoritar");
    if (!btn || !auth.currentUser) return;

    const uid = auth.currentUser.uid;
    const registroRef = doc(db, "progresso_leitura", `${uid}_${idLivro}`);

    let favoritoAtual = false;
    try {
        const snap = await getDoc(registroRef);
        favoritoAtual = snap.exists() && snap.data().favorito === true;
    } catch (err) {
        console.error("Erro ao verificar favorito:", err);
    }

    renderizarBotaoFavorito(btn, favoritoAtual);

    btn.onclick = async (e) => {
        e.stopPropagation();
        favoritoAtual = !favoritoAtual;
        renderizarBotaoFavorito(btn, favoritoAtual);

        try {
            await setDoc(registroRef, {
                uid,
                emailUsuario: auth.currentUser.email || "",
                nomeUsuario: auth.currentUser.displayName || "",
                livroId: idLivro,
                favorito: favoritoAtual
            }, { merge: true });
        } catch (err) {
            console.error("Erro ao favoritar:", err);
        }
    };
}

function renderizarBotaoFavorito(btn, favoritado) {
    btn.innerHTML = favoritado ? "&#9829;" : "&#9825;";
    btn.style.color = favoritado ? "#E50914" : "#FFF";
}