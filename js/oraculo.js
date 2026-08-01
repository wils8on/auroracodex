// js/oraculo.js
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

let livrosCache = [];

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

        inicializarFeed();
    }
});

function inicializarFeed() {
    onSnapshot(collection(db, "livros"), (snapshot) => {
        livrosCache = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    });

    onSnapshot(collection(db, "oraculo"), (snapshot) => {
        const agora = new Date();

        const posts = snapshot.docs
            .map(d => ({ id: d.id, ...d.data() }))
            // Um post "agendado" só aparece pro público depois que a data/hora dele chegar
            .filter(p => new Date(p.dataPublicacao) <= agora)
            .sort((a, b) => new Date(b.dataPublicacao) - new Date(a.dataPublicacao));

        renderizarFeed(posts);
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
            .map(livro => `<span class="oraculo-chip-livro" data-id="${livro.id}">${livro.titulo}</span>`)
            .join("");

        const card = document.createElement("article");
        card.className = "oraculo-post";
        card.innerHTML = `
            <div class="oraculo-post-header">
                <span class="oraculo-tipo-badge ${classeTipo}">${post.tipo}</span>
                <span class="oraculo-data">${dataFormatada}</span>
            </div>
            ${post.titulo ? `<h3>${post.titulo}</h3>` : ''}
            <p class="oraculo-conteudo">${post.conteudo}</p>
            ${post.imagem ? `<img class="oraculo-imagem" src="${post.imagem}" alt="${post.titulo || ''}">` : ''}
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
            } else {
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
        }
    } catch (err) {
        console.error("Erro ao carregar capítulos:", err);
        if (listaCapitulosContainer) {
            listaCapitulosContainer.innerHTML = '<p style="color: #E50914;">Erro ao carregar lista de episódios.</p>';
        }
    }

    carregarGaleriaModal(idLivro);
}

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