// js/universos.js
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

        inicializarDados();
    }
});

function inicializarDados() {
    onSnapshot(collection(db, "universos"), (snapshot) => {
        universosCache = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        renderizarTela();
    });

    onSnapshot(collection(db, "livros"), (snapshot) => {
        livrosCache = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        renderizarTela();
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
        card.onclick = () => window.location.href = `universos.html?id=${u.id}`;

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
        card.onclick = () => abrirModalNetflix(livro.id, livro);

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