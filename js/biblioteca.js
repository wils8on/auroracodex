// js/biblioteca.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, doc, getDoc, collection, onSnapshot, query, orderBy, getDocs } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

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
}