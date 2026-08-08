// js/ler.js
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { doc, getDoc, setDoc, updateDoc, arrayUnion, arrayRemove, collection, getDocs, query, orderBy } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { auth, db } from "./firebase.js";
import { escapeHtml, sanitizeRichHtml, safeUrl } from "./security.js";
import { APPROVED_PROFILES, loadUserProfile, hasProfile } from "./user-service.js";

// Credenciais Oficiais

// Estado do Carrossel de Destaques e Leitura
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = "index.html";
    } else {
        const perfil = await loadUserProfile(user.uid);
        if (!hasProfile(perfil, APPROVED_PROFILES)) {
            window.location.href = "aguardando.html";
            return;
        }
        carregarConteudoCapitulo(user);
    }
});

async function carregarConteudoCapitulo(user) {
    const urlParams = new URLSearchParams(window.location.search);
    const livroId = urlParams.get('livroId');
    const capituloId = urlParams.get('capituloId');

    if (!livroId || !capituloId) {
        alert("Capítulo não especificado.");
        window.location.href = "dashboard.html";
        return;
    }

    try {
        const livroDoc = await getDoc(doc(db, "livros", livroId));
        const capDoc = await getDoc(doc(db, "livros", livroId, "capitulos", capituloId));

        if (capDoc.exists()) {
            const dadosCap = capDoc.data();
            const dadosLivro = livroDoc.exists() ? livroDoc.data() : { titulo: "Obra Codex" };

            // 1. Atualiza cabeçalho e texto narrativo
            const txtHeaderLivro = document.getElementById("header-nome-livro");
            const txtHeaderCapitulo = document.getElementById("header-nome-capitulo");
            const txtNumero = document.getElementById("capitulo-numero-exibicao");
            const txtTitulo = document.getElementById("capitulo-titulo-exibicao");
            const txtConteudo = document.getElementById("capitulo-texto-exibicao");

            if (txtHeaderLivro) txtHeaderLivro.innerText = dadosLivro.titulo;
            if (txtHeaderCapitulo) txtHeaderCapitulo.innerText = `Capítulo ${dadosCap.numero}: ${dadosCap.titulo}`;
            if (txtNumero) txtNumero.innerText = `CAPÍTULO ${dadosCap.numero}`;
            if (txtTitulo) txtTitulo.innerText = dadosCap.titulo.toUpperCase();
            
            if (txtConteudo) {
                const conteudoBruto = dadosCap.conteudo || "";
                // Capítulos escritos no editor rico já vêm em HTML; capítulos antigos são texto puro com quebras de linha
                const pareceHtml = /<\/?[a-z][\s\S]*>/i.test(conteudoBruto);

                if (pareceHtml) {
                    txtConteudo.innerHTML = sanitizeRichHtml(conteudoBruto);
                } else {
                    txtConteudo.innerHTML = conteudoBruto.split('\n').map(paragrafo => {
                        if (paragrafo.trim() === "") return "";
                        return `<p style="line-height: 1.8; margin-bottom: 20px; font-size: 1.15rem; color: #D2D2D2; text-align: justify;">${escapeHtml(paragrafo)}</p>`;
                    }).join('');
                }
            }

            // Capa de destaque e cor de cena do capítulo (opcionais, definidos pelo autor)
            const bannerCapitulo = document.getElementById("capitulo-banner-capa");
            if (bannerCapitulo) {
                if (dadosCap.capa) {
                    bannerCapitulo.style.backgroundImage = `url('${safeUrl(dadosCap.capa)}')`;
                    bannerCapitulo.style.display = "block";
                } else {
                    bannerCapitulo.style.display = "none";
                }
            }
            if (dadosCap.corCena && txtNumero) {
                txtNumero.style.color = dadosCap.corCena;
            }

            // 2. CONFIGURAÇÃO DINÂMICA DA TRILHA SONORA (PLAYER NO RODAPÉ)
            configurarPlayerTrilha(dadosCap.trilhaSonora, dadosCap.titulo);

            // 2.4 CONFIGURA O BOTÃO DE CURTIDAS (persistido no Firestore, por usuário)
            configurarBotaoLike(user, livroId, capituloId, dadosCap);

            // 2.5 REGISTRA O PROGRESSO DE LEITURA (usado no Dashboard de Leitores do admin)
            registrarProgressoLeitura(user, livroId, dadosLivro.titulo, dadosCap, dadosLivro.capa);

            // 3. BUSCA OS PERSONAGENS REAIS DO CÓDICE PARA ESSE LIVRO
            const sidebarContent = document.querySelector(".sidebar-content");
            if (sidebarContent) {
                sidebarContent.innerHTML = `<h4>Personagens em Cena</h4>`;
                
                const queryPersonagens = await getDocs(collection(db, "livros", livroId, "personagens"));
                
                if (queryPersonagens.empty) {
                    sidebarContent.innerHTML += `<p style="color: #737373; font-size: 0.9rem; padding-top: 10px;">Nenhum detalhe registrado no códice para este universo.</p>`;
                } else {
                    queryPersonagens.forEach((pSnap) => {
                        const p = pSnap.data();
                        const cardChar = document.createElement("div");
                        cardChar.className = "character-mini-card";
                        cardChar.innerHTML = `
                            <img src="${safeUrl(p.foto, 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?q=80&w=100')}" alt="${escapeHtml(p.nome)}">
                            <div class="char-info">
                                <h5>${escapeHtml(p.nome)}</h5>
                                <p class="char-role">${p.papel || p.funcao || 'Personagem'}${p.primeiraAparicao ? ' • ' + p.primeiraAparicao : ''}</p>
                                <p class="char-desc">${escapeHtml(p.descricao)}</p>
                            </div>
                        `;
                        sidebarContent.appendChild(cardChar);
                    });
                }
            }

        } else {
            alert("O conteúdo deste capítulo não foi localizado no Codex.");
            window.location.href = "dashboard.html";
        }
    } catch (err) {
        console.error("Erro ao carregar leitura:", err);
    }
}

// Trata o link/arquivo do capítulo e injeta o player correto no rodapé
function configurarPlayerTrilha(urlTrilha, tituloCapitulo) {
    const trackTitle = document.getElementById("player-track-title");
    const trackAuthor = document.getElementById("player-track-author");
    const container = document.getElementById("media-player-container");

    // Sempre restaura a estrutura padrão do player antes de decidir o que exibir,
    // pois o container pode ter sido substituído por um iframe do YouTube antes.
    if (container) {
        container.innerHTML = `
            <audio id="chapter-audio" style="display: none;"></audio>
            <button class="btn-play-pause" id="play-pause-btn" style="display: none;">
                <svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
            </button>
            <div class="progress-bar-container" id="progress-container" style="display: none;">
                <div class="progress-bar" id="audio-progress"></div>
            </div>
            <span class="track-time" id="track-time" style="display: none;">0:00</span>
        `;
    }

    if (!urlTrilha || urlTrilha.trim() === "") {
        if (trackTitle) trackTitle.innerText = "Sem Trilha Sonora";
        if (trackAuthor) trackAuthor.innerText = "Capítulo silencioso";
        return;
    }

    if (trackTitle) trackTitle.innerText = tituloCapitulo || "Trilha Sonora";

    // SE FOR LINK DO YOUTUBE: injeta o iFrame do mini-player
    if (urlTrilha.includes("youtube.com") || urlTrilha.includes("youtu.be")) {
        let videoId = "";
        if (urlTrilha.includes("youtu.be/")) {
            videoId = urlTrilha.split("youtu.be/")[1].split("?")[0];
        } else if (urlTrilha.includes("v=")) {
            videoId = urlTrilha.split("v=")[1].split("&")[0];
        }

        if (trackAuthor) trackAuthor.innerText = "Reproduzindo via YouTube";

        if (container) {
            container.innerHTML = `
                <iframe
                    width="220"
                    height="40"
                    src="https://www.youtube.com/embed/${videoId}?enablejsapi=1&autoplay=0"
                    title="Trilha do Capítulo"
                    frameborder="0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    style="border-radius: 20px; filter: invert(0.9) hue-rotate(180deg);"
                    allowfullscreen>
                </iframe>
            `;
        }
        return;
    }

    // SE FOR LINK DO SPOTIFY: não dá pra tocar embutido sem o SDK deles, então oferece o link direto
    if (urlTrilha.includes("open.spotify.com")) {
        if (trackAuthor) trackAuthor.innerText = "Disponível no Spotify";
        if (container) {
            container.innerHTML = `<a href="${urlTrilha}" target="_blank" rel="noopener" style="color:#F97316; font-size:0.85rem; font-weight:600; text-decoration:none; display:flex; align-items:center; gap:6px;">🎧 Abrir no Spotify</a>`;
        }
        return;
    }

    // ÁUDIO DIRETO (upload próprio via Cloudinary ou link de mp3/stream): player nativo com progresso e tempo
    if (trackAuthor) trackAuthor.innerText = "Trilha oficial do capítulo";

    const audio = document.getElementById("chapter-audio");
    const playBtn = document.getElementById("play-pause-btn");
    const progressContainer = document.getElementById("progress-container");
    const progressBar = document.getElementById("audio-progress");
    const trackTime = document.getElementById("track-time");
    if (!audio || !playBtn) return;

    audio.src = urlTrilha;
    playBtn.style.display = "flex";
    if (progressContainer) progressContainer.style.display = "block";
    if (trackTime) trackTime.style.display = "inline-block";

    const iconPlay = `<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>`;
    const iconPause = `<svg viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>`;
    playBtn.innerHTML = iconPlay;

    playBtn.onclick = () => {
        if (audio.paused) {
            audio.play().catch(() => console.log("Aguardando ação de mídia do usuário."));
            playBtn.innerHTML = iconPause;
        } else {
            audio.pause();
            playBtn.innerHTML = iconPlay;
        }
    };

    audio.ontimeupdate = () => {
        if (audio.duration && progressBar) {
            progressBar.style.width = (audio.currentTime / audio.duration) * 100 + "%";
        }
        if (trackTime) {
            trackTime.innerText = `${formatarTempo(audio.currentTime)} / ${formatarTempo(audio.duration)}`;
        }
    };

    audio.onended = () => { playBtn.innerHTML = iconPlay; };

    if (progressContainer) {
        progressContainer.onclick = (e) => {
            if (!audio.duration) return;
            const rect = progressContainer.getBoundingClientRect();
            const pct = Math.min(Math.max((e.clientX - rect.left) / rect.width, 0), 1);
            audio.currentTime = pct * audio.duration;
        };
    }
}

function formatarTempo(segundos) {
    if (!isFinite(segundos) || isNaN(segundos)) return "0:00";
    const min = Math.floor(segundos / 60);
    const seg = Math.floor(segundos % 60).toString().padStart(2, "0");
    return `${min}:${seg}`;
}

// =====================================================
// CURTIDAS DO CAPÍTULO (persistidas no Firestore, por usuário)
// =====================================================
function configurarBotaoLike(user, livroId, capituloId, dadosCap) {
    const btnLike = document.getElementById("btn-like");
    const likeCountEl = document.getElementById("like-count");
    if (!btnLike || !likeCountEl) return;

    let curtidasUids = Array.isArray(dadosCap.curtidasUids) ? [...dadosCap.curtidasUids] : [];
    likeCountEl.innerText = curtidasUids.length;
    btnLike.classList.toggle("liked", curtidasUids.includes(user.uid));

    btnLike.onclick = async () => {
        const jaCurtiu = btnLike.classList.contains("liked");
        const capRef = doc(db, "livros", livroId, "capitulos", capituloId);

        // Atualização otimista: a interface responde na hora, o Firestore é gravado em seguida
        curtidasUids = jaCurtiu
            ? curtidasUids.filter(uid => uid !== user.uid)
            : [...curtidasUids, user.uid];

        btnLike.classList.toggle("liked", !jaCurtiu);
        likeCountEl.innerText = curtidasUids.length;

        try {
            await updateDoc(capRef, {
                curtidasUids: jaCurtiu ? arrayRemove(user.uid) : arrayUnion(user.uid)
            });
        } catch (err) {
            console.error("Erro ao curtir capítulo:", err);
            // Reverte a interface se a gravação no banco falhar
            curtidasUids = jaCurtiu
                ? [...curtidasUids, user.uid]
                : curtidasUids.filter(uid => uid !== user.uid);
            btnLike.classList.toggle("liked", jaCurtiu);
            likeCountEl.innerText = curtidasUids.length;
        }
    };
}

// =====================================================
// PROGRESSO DE LEITURA (usado no Dashboard de Leitores do admin)
// =====================================================

// Cria/atualiza um registro por (usuário, livro). Detecta automaticamente conclusão
// quando o capítulo lido é o último publicado da obra.
async function registrarProgressoLeitura(user, livroId, tituloLivro, dadosCap, capaLivro) {
    try {
        const registroId = `${user.uid}_${livroId}`;
        const registroRef = doc(db, "progresso_leitura", registroId);
        const registroExistente = await getDoc(registroRef);

        // Descobre se este é o último capítulo publicado, pra marcar a leitura como concluída
        const capsRef = collection(db, "livros", livroId, "capitulos");
        const capsSnap = await getDocs(query(capsRef, orderBy("numero", "desc")));
        const numeroUltimoCapitulo = capsSnap.empty ? dadosCap.numero : capsSnap.docs[0].data().numero;

        const jaEstavaConcluido = registroExistente.exists() && registroExistente.data().status === "concluida";
        const terminouAgora = dadosCap.numero >= numeroUltimoCapitulo;

        const dadosProgresso = {
            uid: user.uid,
            emailUsuario: user.email || "",
            nomeUsuario: user.displayName || "",
            livroId,
            livroTitulo: tituloLivro,
            livroCapa: capaLivro || "",
            ultimoCapituloNumero: dadosCap.numero,
            ultimoCapituloTitulo: dadosCap.titulo,
            ultimoCapituloId: capituloId,
            status: (jaEstavaConcluido || terminouAgora) ? "concluida" : "ativa",
            dataUltimaLeitura: new Date().toISOString()
        };

        if (!registroExistente.exists()) {
            dadosProgresso.dataInicio = new Date().toISOString();
            dadosProgresso.favorito = false;
        }

        await setDoc(registroRef, dadosProgresso, { merge: true });
    } catch (err) {
        // Falha ao registrar progresso não deve travar a leitura do capítulo
        console.error("Erro ao registrar progresso de leitura:", err);
    }
}
