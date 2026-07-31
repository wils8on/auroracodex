// js/ler.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { 
    getFirestore, doc, getDoc, collection, addDoc, 
    onSnapshot, query, orderBy, setDoc, deleteDoc,
    limit, startAfter, getDocs 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

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

let usuarioAtual = null;
let livroId = null;
let capituloId = null;

onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = "index.html";
    } else {
        usuarioAtual = user;
        const avatarElem = document.getElementById("user-comment-avatar");
        if (avatarElem && user.photoURL) avatarElem.src = user.photoURL;

        const urlParams = new URLSearchParams(window.location.search);
        livroId = urlParams.get('livroId');
        capituloId = urlParams.get('capituloId');

        if (!livroId || !capituloId) {
            alert("Capítulo não especificado.");
            window.location.href = "dashboard.html";
            return;
        }

        carregarConteudoCapitulo();
        iniciarEscutaCurtidas();
        iniciarEscutaComentarios();
    }
});

// 1. Carrega dados do capítulo e prepara trilha
async function carregarConteudoCapitulo() {
    try {
        const livroDoc = await getDoc(doc(db, "livros", livroId));
        const capDoc = await getDoc(doc(db, "livros", livroId, "capitulos", capituloId));

        if (capDoc.exists()) {
            const dadosCap = capDoc.data();
            const dadosLivro = livroDoc.exists() ? livroDoc.data() : { titulo: "Obra Codex" };

            document.getElementById("header-nome-livro").innerText = dadosLivro.titulo;
            document.getElementById("header-nome-capitulo").innerText = `Cap. ${dadosCap.numero}: ${dadosCap.titulo}`;
            document.getElementById("capitulo-numero-exibicao").innerText = `CAPÍTULO ${dadosCap.numero}`;
            document.getElementById("capitulo-titulo-exibicao").innerText = dadosCap.titulo.toUpperCase();
            
            const txtConteudo = document.getElementById("capitulo-texto-exibicao");
            if (txtConteudo) {
                txtConteudo.innerHTML = dadosCap.conteudo.split('\n').map(p => {
                    if (p.trim() === "") return "";
                    return `<p style="line-height: 1.85; margin-bottom: 24px; font-size: 1.2rem; color: #D4D4D4; text-align: justify; text-indent: 2em;">${p}</p>`;
                }).join('');
            }

            configurarPlayerTrilha(dadosCap.trilhaSonora, dadosCap.titulo);
            carregarPersonagensCodi();
        } else {
            alert("Capítulo não localizado.");
            window.location.href = "dashboard.html";
        }
    } catch (err) {
        console.error("Erro ao carregar leitura:", err);
    }
}

// 2. Trilha sonora inteligente (YouTube, Spotify ou Áudio Direto)
function configurarPlayerTrilha(urlTrilha, tituloCapitulo) {
    const trackTitle = document.getElementById("player-track-title");
    const trackAuthor = document.getElementById("player-track-author");
    const container = document.getElementById("media-player-container");

    if (!urlTrilha || urlTrilha.trim() === "") {
        if (trackTitle) trackTitle.innerText = "Sem Trilha Sonora";
        if (trackAuthor) trackAuthor.innerText = "Capítulo Silencioso";
        if (container) container.innerHTML = `<span style="color: #737373; font-size: 0.85rem;">Nenhuma mídia vinculada</span>`;
        return;
    }

    if (trackAuthor) trackAuthor.innerText = `Trilha: ${tituloCapitulo}`;

    // A) Link do YouTube
    if (urlTrilha.includes("youtube.com") || urlTrilha.includes("youtu.be")) {
        let videoId = "";
        if (urlTrilha.includes("youtu.be/")) {
            videoId = urlTrilha.split("youtu.be/")[1].split("?")[0];
        } else if (urlTrilha.includes("v=")) {
            videoId = urlTrilha.split("v=")[1].split("&")[0];
        }
        if (trackTitle) trackTitle.innerText = "Trilha do YouTube";
        if (container) {
            container.innerHTML = `
                <iframe 
                    width="260" 
                    height="42" 
                    src="https://www.youtube.com/embed/${videoId}?enablejsapi=1" 
                    title="Trilha Sonora" 
                    frameborder="0" 
                    allow="autoplay; encrypted-media" 
                    style="border-radius: 6px; border: 1px solid rgba(255,255,255,0.1);" 
                    allowfullscreen>
                </iframe>
            `;
        }
    } 
    // B) Link do Spotify
    else if (urlTrilha.includes("spotify.com")) {
        let spotifyPath = urlTrilha.split("spotify.com/")[1];
        if (trackTitle) trackTitle.innerText = "Trilha do Spotify";
        if (container) {
            container.innerHTML = `
                <iframe 
                    src="https://open.spotify.com/embed/${spotifyPath}" 
                    width="280" 
                    height="80" 
                    frameborder="0" 
                    allowtransparency="true" 
                    allow="encrypted-media"
                    style="border-radius: 8px;">
                </iframe>
            `;
        }
    }
    // C) Arquivo de áudio direto (MP3 / AAC / Stream)
    else {
        if (trackTitle) trackTitle.innerText = "Áudio Oficial";
        if (container) {
            container.innerHTML = `
                <audio id="chapter-audio" src="${urlTrilha}"></audio>
                <button class="btn-play-pause" id="play-pause-btn" style="background:#FFF; border:none; width:36px; height:36px; border-radius:50%; cursor:pointer; display:flex; align-items:center; justify-content:center;">
                    <svg viewBox="0 0 24 24" style="width:20px; height:20px; fill:#000;" id="play-icon"><path d="M8 5v14l11-7z"/></svg>
                </button>
                <div class="progress-bar-container" id="progress-container" style="flex-grow:1; height:4px; background:#404040; border-radius:2px; cursor:pointer; position:relative; min-width:120px;">
                    <div class="progress-bar" id="audio-progress" style="height:100%; width:0%; background:#E50914; border-radius:2px;"></div>
                </div>
            `;

            const audio = document.getElementById('chapter-audio');
            const playBtn = document.getElementById('play-pause-btn');
            const progressBar = document.getElementById('audio-progress');
            const progressContainer = document.getElementById('progress-container');

            playBtn.addEventListener('click', () => {
                if (audio.paused) {
                    audio.play();
                    playBtn.innerHTML = `<svg viewBox="0 0 24 24" style="width:20px; height:20px; fill:#000;"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>`;
                } else {
                    audio.pause();
                    playBtn.innerHTML = `<svg viewBox="0 0 24 24" style="width:20px; height:20px; fill:#000;"><path d="M8 5v14l11-7z"/></svg>`;
                }
            });

            audio.addEventListener('timeupdate', () => {
                if (audio.duration) {
                    const percentage = (audio.currentTime / audio.duration) * 100;
                    if (progressBar) progressBar.style.width = percentage + '%';
                }
            });

            progressContainer.addEventListener('click', (e) => {
                const width = progressContainer.clientWidth;
                const clickX = e.offsetX;
                if (audio.duration) {
                    audio.currentTime = (clickX / width) * audio.duration;
                }
            });
        }
    }
}

// 3. Sistema de Curtidas Real-Time
function iniciarEscutaCurtidas() {
    const curtidasRef = collection(db, "livros", livroId, "capitulos", capituloId, "curtidas");
    const btnLike = document.getElementById("btn-like");
    const countElem = document.getElementById("like-count");

    onSnapshot(curtidasRef, (snapshot) => {
        const total = snapshot.size;
        if (countElem) countElem.innerText = total;

        const jaCurtiu = snapshot.docs.some(docSnap => docSnap.id === usuarioAtual.uid);
        if (btnLike) {
            if (jaCurtiu) {
                btnLike.classList.add("liked");
            } else {
                btnLike.classList.remove("liked");
            }
        }
    });

    if (btnLike) {
        btnLike.onclick = async () => {
            const userLikeRef = doc(db, "livros", livroId, "capitulos", capituloId, "curtidas", usuarioAtual.uid);
            const userLikeSnap = await getDoc(userLikeRef);

            if (userLikeSnap.exists()) {
                await deleteDoc(userLikeRef);
            } else {
                await setDoc(userLikeRef, {
                    usuarioId: usuarioAtual.uid,
                    nome: usuarioAtual.displayName || "Leitor",
                    data: new Date().toISOString()
                });
            }
        };
    }
}

// Variable globais de controle da paginação de comentários
const TAMANHO_PAGINA_COMENTARIOS = 5;
let ultimoDocComentario = null;
let comentariosCarregados = [];

function iniciarEscutaComentarios() {
    const comentariosRef = collection(db, "livros", livroId, "capitulos", capituloId, "comentarios");
    const qInicial = query(comentariosRef, orderBy("data", "desc"), limit(TAMANHO_PAGINA_COMENTARIOS));
    const listaContainer = document.getElementById("lista-comentarios");
    const containerBtnMais = document.getElementById("container-carregar-mais");
    const btnMais = document.getElementById("btn-carregar-mais-comentarios");

    // 1. Escuta o primeiro lote em tempo real
    onSnapshot(qInicial, (snapshot) => {
        if (!listaContainer) return;

        if (snapshot.empty) {
            listaContainer.innerHTML = `<p style="color: #737373; font-size: 0.9rem; padding: 10px 0;">Seja o primeiro a comentar sobre este capítulo!</p>`;
            if (containerBtnMais) containerBtnMais.style.display = "none";
            return;
        }

        // Armazena os documentos do primeiro lote
        const novosComentarios = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        // Guarda a referência do último documento para saber onde continuar
        ultimoDocComentario = snapshot.docs[snapshot.docs.length - 1];

        // Se houver comentários adicionais carregados via "Carregar mais", preserva-os
        const idsIniciais = new Set(novosComentarios.map(c => c.id));
        const comentariosExtras = comentariosCarregados.filter(c => !idsIniciais.has(c.id));

        comentariosCarregados = [...novosComentarios, ...comentariosExtras];
        renderizarListaComentarios(comentariosCarregados);

        // Exibe o botão "Carregar mais" apenas se o primeiro lote atingiu o limite por página
        if (containerBtnMais) {
            containerBtnMais.style.display = snapshot.docs.length >= TAMANHO_PAGINA_COMENTARIOS ? "block" : "none";
        }
    });

    // 2. Evento do botão "Carregar mais comentários"
    if (btnMais) {
        btnMais.onclick = async () => {
            if (!ultimoDocComentario) return;

            btnMais.disabled = true;
            btnMais.innerText = "Carregando...";

            try {
                const qProximo = query(
                    comentariosRef, 
                    orderBy("data", "desc"), 
                    startAfter(ultimoDocComentario), 
                    limit(TAMANHO_PAGINA_COMENTARIOS)
                );
                
                const proximoSnap = await getDocs(qProximo);

                if (!proximoSnap.empty) {
                    const maisComentarios = proximoSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                    ultimoDocComentario = proximoSnap.docs[proximoSnap.docs.length - 1];

                    comentariosCarregados = [...comentariosCarregados, ...maisComentarios];
                    renderizarListaComentarios(comentariosCarregados);

                    // Oculta o botão se não houver mais páginas
                    if (proximoSnap.docs.length < TAMANHO_PAGINA_COMENTARIOS) {
                        containerBtnMais.style.display = "none";
                    }
                } else {
                    containerBtnMais.style.display = "none";
                }
            } catch (err) {
                console.error("Erro ao carregar mais comentários:", err);
            } finally {
                btnMais.disabled = false;
                btnMais.innerText = "Carregar mais comentários";
            }
        };
    }

    // 3. Publicar novo comentário
    const btnEnviar = document.getElementById("btn-enviar-comentario");
    const inputTexto = document.getElementById("input-comentario");

    if (btnEnviar && inputTexto) {
        btnEnviar.onclick = async () => {
            const texto = inputTexto.value.trim();
            if (!texto) return;

            btnEnviar.disabled = true;
            try {
                await addDoc(comentariosRef, {
                    usuarioId: usuarioAtual.uid,
                    nome: usuarioAtual.displayName || "Leitor",
                    fotoPerfil: usuarioAtual.photoURL || "",
                    texto,
                    data: new Date().toISOString()
                });
                inputTexto.value = "";
            } catch (err) {
                console.error("Erro ao publicar comentário:", err);
                alert("Falha ao enviar comentário.");
            } finally {
                btnEnviar.disabled = false;
            }
        };
    }
}

// Renderiza a lista combinada de comentários na tela
function renderizarListaComentarios(lista) {
    const listaContainer = document.getElementById("lista-comentarios");
    if (!listaContainer) return;
    listaContainer.innerHTML = "";

    lista.forEach((c) => {
        const dataFormatada = new Date(c.data).toLocaleDateString("pt-BR", {
            day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
        });

        const item = document.createElement("div");
        item.className = "comment-item";
        item.innerHTML = `
            <img src="${c.fotoPerfil || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?q=80&w=100'}" class="comment-avatar" alt="${c.nome}">
            <div class="comment-body" style="flex-grow: 1;">
                <div class="comment-meta">
                    <strong style="color: #FFF;">${c.nome}</strong> 
                    <span style="color: #737373; font-size: 0.75rem; margin-left: 8px;">${dataFormatada}</span>
                </div>
                <p class="comment-text" style="color: #D4D4D4; font-size: 0.95rem; margin-top: 4px; line-height: 1.4;">${c.texto}</p>
            </div>
        `;
        listaContainer.appendChild(item);
    });
}

    const btnEnviar = document.getElementById("btn-enviar-comentario");
    const inputTexto = document.getElementById("input-comentario");

    if (btnEnviar && inputTexto) {
        btnEnviar.onclick = async () => {
            const texto = inputTexto.value.trim();
            if (!texto) return;

            btnEnviar.disabled = true;
            try {
                await addDoc(comentariosRef, {
                    usuarioId: usuarioAtual.uid,
                    nome: usuarioAtual.displayName || "Leitor",
                    fotoPerfil: usuarioAtual.photoURL || "",
                    texto,
                    data: new Date().toISOString()
                });
                inputTexto.value = "";
            } catch (err) {
                console.error("Erro ao publicar comentário:", err);
                alert("Falha ao enviar comentário.");
            } finally {
                btnEnviar.disabled = false;
            }
        };
    }
}

// 5. Carrega Fichas dos Personagens no Código
async function carregarPersonagensCodi() {
    const sidebarContent = document.querySelector(".sidebar-content");
    if (!sidebarContent) return;

    sidebarContent.innerHTML = `<h4>Personagens em Cena</h4>`;
    const queryPersonagens = await getDocs(collection(db, "livros", livroId, "personagens"));

    if (queryPersonagens.empty) {
        sidebarContent.innerHTML += `<p style="color: #737373; font-size: 0.9rem; padding-top: 10px;">Nenhum detalhe registrado no códice para esta obra.</p>`;
    } else {
        queryPersonagens.forEach((pSnap) => {
            const p = pSnap.data();
            const cardChar = document.createElement("div");
            cardChar.className = "character-mini-card";
            cardChar.innerHTML = `
                <img src="${p.foto || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?q=80&w=100'}" alt="${p.nome}">
                <div class="char-info">
                    <h5>${p.nome}</h5>
                    <p class="char-role">${p.papel || p.funcao || 'Personagem'}${p.primeiraAparicao ? ' • ' + p.primeiraAparicao : ''}</p>
                    <p class="char-desc">${p.descricao}</p>
                </div>
            `;
            sidebarContent.appendChild(cardChar);
        });
    }
}