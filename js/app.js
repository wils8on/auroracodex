// js/app.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, doc, getDoc, collection, onSnapshot, query, orderBy, getDocs } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// Credenciais Oficiais
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

// Monitora o estado do usuário logado na Home
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = "index.html"; // Expulsa se não estiver logado
    } else {
        // Atualiza avatar do usuário
        if (document.getElementById('user-avatar')) {
            document.getElementById('user-avatar').src = user.photoURL;
        }
        
        // Puxa permissões e perfil do banco
        const userDoc = await getDoc(doc(db, "usuarios", user.uid));
        if (userDoc.exists()) {
            const dados = userDoc.data();
            
            // Atualiza tag de perfil (AUTOR, LEITOR, ADMIN)
            if (document.getElementById('user-role-badge')) {
                document.getElementById('user-role-badge').innerText = dados.perfil.toUpperCase();
            }

            // Exibe botão do painel se for Admin
            if (dados.perfil === "admin" && document.getElementById('link-adm')) {
                document.getElementById('link-adm').style.display = "block";
            }

            // Inicializa a escuta do catálogo e do banner de destaque
            ouvirCatalogo();
        }
    }
});

// Busca os livros no Firestore, atualiza o catálogo e define o Destaque Principal (Hero Banner)
function ouvirCatalogo() {
    const livrosRef = collection(db, "livros");

    onSnapshot(livrosRef, (snapshot) => {
        const container = document.getElementById("catalogo-livros");
        if (container) container.innerHTML = "";

        if (snapshot.empty) {
            if (container) {
                container.innerHTML = `<p style="color: #737373; padding: 20px;">Nenhum livro cadastrado ainda.</p>`;
            }
            return;
        }

        let destaqueEncontrado = false;

        snapshot.forEach((docSnap) => {
            const livro = docSnap.data();
            const id = docSnap.id;

            // 1. RENDERIZA OS CARDS DA FILEIRA "UNIVERSOS CONECTADOS"
            if (container) {
                const card = document.createElement("div");
                card.className = "book-card";
                card.style.cursor = "pointer";
                
                // Clique abre o modal estilo Netflix
                card.onclick = () => abrirModalNetflix(id, livro);

                card.innerHTML = `
                    <img src="${livro.capa}" alt="${livro.titulo}" class="book-cover">
                    <div class="book-hover-info">
                        <h4>${livro.titulo}</h4>
                        <div class="book-meta"><span>${filtrarNomeUniverso(livro.universo)}</span></div>
                    </div>
                `;
                container.appendChild(card);
            }

            // 2. ATUALIZA O HERO BANNER SE O LIVRO FOR MARCADO COMO DESTAQUE
            if (livro.destacar && !destaqueEncontrado) {
                destaqueEncontrado = true;
                atualizarBannerDestaque(id, livro);
            }
        });
    });
}

// Atualiza o Hero Banner dinamicamente com a imagem e textos da obra destacada
function atualizarBannerDestaque(idLivro, livro) {
    const heroBg = document.getElementById("hero-banner-bg") || document.querySelector(".hero-banner");
    const heroTitulo = document.getElementById("hero-titulo-destaque") || document.querySelector(".hero-title");
    const heroSinopse = document.getElementById("hero-sinopse-destaque") || document.querySelector(".hero-synopsis");
    const btnLer = document.getElementById("btn-ler-destaque") || document.querySelector(".btn-read");
    const btnInfo = document.getElementById("btn-info-destaque") || document.querySelector(".btn-info");

    if (heroBg && livro.capa) {
        // Aplica a imagem limpa e deixa o gradiente profissional por conta do CSS (.hero-vignette)
        heroBg.style.backgroundImage = `url('${livro.capa}')`;
        heroBg.style.backgroundSize = "cover";
        heroBg.style.backgroundPosition = "center top";
    }

    if (heroTitulo) heroTitulo.innerText = livro.titulo;
    if (heroSinopse) heroSinopse.innerText = livro.sinopse;

    if (btnInfo) {
        btnInfo.onclick = () => abrirModalNetflix(idLivro, livro);
    }
    if (btnLer) {
        btnLer.onclick = () => abrirModalNetflix(idLivro, livro);
    }
}

// Pop-up estilo Netflix completo com busca de capítulos da subcoleção
async function abrirModalNetflix(idLivro, livro) {
    const banner = document.getElementById('modal-banner');
    const titulo = document.getElementById('modal-titulo');
    const universo = document.getElementById('modal-universo');
    const sinopse = document.getElementById('modal-sinopse');
    const listaCapitulosContainer = document.getElementById('modal-lista-capitulos');

    if (banner) banner.style.backgroundImage = `url('${livro.capa}')`;
    if (titulo) titulo.innerText = livro.titulo;
    if (universo) universo.innerText = filtrarNomeUniverso(livro.universo);
    if (sinopse) sinopse.innerText = livro.sinopse;

    if (listaCapitulosContainer) {
        listaCapitulosContainer.innerHTML = '<p style="color: #737373;">Carregando índice de capítulos...</p>';
    }

    const modal = document.getElementById('netflix-modal');
    if (modal) {
        modal.style.display = 'block';
        document.body.style.overflow = 'hidden'; // Trava o scroll da home
    }

    try {
        // Busca capítulos ordenados numericamente
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
                
                item.onclick = () => {
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

// Utilitário para formatar nomes dos universos na tela
function filtrarNomeUniverso(slug) {
    const nomes = {
        'original': 'Universo Original',
        'vampire-diaries': 'The Vampire Diaries',
        '50-shades': '50 Shades of Grey'
    };
    return nomes[slug] || 'Outro Universo';
}

// Executa o Logout (Sair)
const btnLogout = document.getElementById("btn-logout");
if (btnLogout) {
    btnLogout.addEventListener("click", () => {
        signOut(auth).then(() => {
            window.location.href = "index.html";
        }).catch((err) => console.error("Erro ao sair:", err));
    });
}