// js/ler.js
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { doc, getDoc, setDoc, updateDoc, addDoc, deleteDoc, arrayUnion, arrayRemove, collection, getDocs, query, orderBy } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { auth, db } from "./firebase.js";
import { escapeHtml, sanitizeRichHtml, safeUrl } from "./security.js";
import { APPROVED_PROFILES, loadUserProfile, hasProfile } from "./user-service.js";
import { renderContentState, setButtonBusy, showToast } from "./feedback.js";
import { confirmAction } from "./dialog-accessibility.js?v=confirm-dialog-v1";

const READER_PREFERENCES_KEY = "aurora-codex:preferencias-leitura";

function configurarProtecaoConteudo(user) {
    const areaProtegida = target => target instanceof Element && Boolean(target.closest(
        ".reading-core, .oracle-sidebar, .character-profile-dialog, .chapter-availability-dialog"
    ));
    document.addEventListener("contextmenu", event => {
        if (areaProtegida(event.target)) event.preventDefault();
    });
    document.addEventListener("dragstart", event => {
        if (areaProtegida(event.target)) event.preventDefault();
    });
    document.addEventListener("copy", event => {
        if (areaProtegida(event.target)) {
            event.preventDefault();
            showToast("A cópia do conteúdo de leitura está desativada.", "info");
        }
    });
}

function capituloDisponivel(capitulo, perfil) {
    if (capitulo.status === "rascunho") return false;
    if (capitulo.status !== "agendado") return true;
    return Boolean(capitulo.data_agendamento) && new Date(capitulo.data_agendamento).getTime() <= Date.now();
}

function configurarPreferenciasLeitura() {
    const core = document.querySelector(".reading-core");
    const chapterText = document.getElementById("capitulo-texto-exibicao");
    const status = document.getElementById("status-preferencias");
    if (!core || !chapterText) return;
    let preferences = { fontSize: 1.25, wide: false, theme: "dark" };
    try { preferences = { ...preferences, ...JSON.parse(localStorage.getItem(READER_PREFERENCES_KEY) || "{}") }; } catch { /* usa padrões */ }

    const apply = message => {
        preferences.fontSize = Math.min(1.6, Math.max(1, Number(preferences.fontSize) || 1.25));
        if (!["dark", "offwhite", "paper", "mono"].includes(preferences.theme)) preferences.theme = "dark";
        core.style.setProperty("--reader-font-size", `${preferences.fontSize}rem`);
        core.classList.toggle("reader-wide", !!preferences.wide);
        document.body.dataset.readerTheme = preferences.theme;
        const themePicker = document.getElementById("tema-leitura");
        if (themePicker) themePicker.value = preferences.theme;
        const themeColors = { dark: "#050505", offwhite: "#F4F1EA", paper: "#F2E3BC", mono: "#FFFFFF" };
        document.querySelector('meta[name="theme-color"]')?.setAttribute("content", themeColors[preferences.theme]);
        document.getElementById("alternar-largura")?.setAttribute("aria-pressed", String(!!preferences.wide));
        try { localStorage.setItem(READER_PREFERENCES_KEY, JSON.stringify(preferences)); } catch { /* preferência não persistida */ }
        if (status && message) status.textContent = message;
    };

    document.getElementById("diminuir-fonte")?.addEventListener("click", () => {
        preferences.fontSize -= 0.1;
        apply(`Tamanho do texto: ${Math.round(preferences.fontSize * 100)}%.`);
    });
    document.getElementById("aumentar-fonte")?.addEventListener("click", () => {
        preferences.fontSize += 0.1;
        apply(`Tamanho do texto: ${Math.round(preferences.fontSize * 100)}%.`);
    });
    document.getElementById("alternar-largura")?.addEventListener("click", () => {
        preferences.wide = !preferences.wide;
        apply(preferences.wide ? "Largura de leitura ampliada." : "Largura de leitura confortável.");
    });
    document.getElementById("tema-leitura")?.addEventListener("change", event => {
        preferences.theme = event.target.value;
        const nomes = { dark: "escuro", offwhite: "off-white", paper: "papel", mono: "preto e branco" };
        apply(`Tema de leitura alterado para ${nomes[preferences.theme]}.`);
    });
    apply();
}

configurarPreferenciasLeitura();

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
        configurarProtecaoConteudo(user);
        carregarConteudoCapitulo(user, perfil);
    }
});

async function carregarConteudoCapitulo(user, perfil) {
    const urlParams = new URLSearchParams(window.location.search);
    const livroId = urlParams.get('livroId');
    const capituloId = urlParams.get('capituloId');

    if (!livroId || !capituloId) {
        renderContentState(document.getElementById("capitulo-texto-exibicao"), { type: "error", title: "Capítulo não especificado", message: "Volte ao catálogo e escolha um capítulo para iniciar a leitura." });
        showToast("Não foi possível identificar o capítulo.", "error");
        return;
    }

    try {
        const livroDoc = await getDoc(doc(db, "livros", livroId));
        const capDoc = await getDoc(doc(db, "livros", livroId, "capitulos", capituloId));

        if (capDoc.exists()) {
            const dadosCap = capDoc.data();
            const dadosLivro = livroDoc.exists() ? livroDoc.data() : { titulo: "Obra Codex" };

            if (!capituloDisponivel(dadosCap, perfil)) {
                renderContentState(document.getElementById("capitulo-texto-exibicao"), { type: "empty", title: "Capítulo ainda não publicado", message: "Este capítulo estará disponível na data programada pelo autor." });
                showToast("Este capítulo ainda não está disponível.", "info");
                return;
            }

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

            const capitulosSnapshot = await getDocs(query(collection(db, "livros", livroId, "capitulos"), orderBy("numero", "asc")));
            const todosCapitulos = capitulosSnapshot.docs.map(registro => ({ id: registro.id, ...registro.data() }));
            configurarNavegacaoCapitulos(livroId, capituloId, todosCapitulos, perfil, dadosLivro.capa);

            // 2.4 CONFIGURA O BOTÃO DE CURTIDAS (persistido no Firestore, por usuário)
            configurarBotaoLike(user, livroId, capituloId, dadosCap);

            // 2.5 REGISTRA O PROGRESSO DE LEITURA (usado no Dashboard de Leitores do admin)
            registrarProgressoLeitura(user, livroId, capituloId, dadosLivro.titulo, dadosCap, dadosLivro.capa);
            configurarComentarios(user, perfil, livroId, capituloId);

            // 3. BUSCA OS PERSONAGENS REAIS DO CÓDICE PARA ESSE LIVRO
            const sidebarContent = document.querySelector(".sidebar-content");
            if (sidebarContent) {
                sidebarContent.innerHTML = `<h4>Personagens em Cena</h4>`;
                
                const queryPersonagens = await getDocs(collection(db, "livros", livroId, "personagens"));
                
                const personagensEmCena = queryPersonagens.docs.filter(registro => {
                    const aparicoes = registro.data().capitulosAparicao;
                    return Array.isArray(aparicoes) && aparicoes.includes(capituloId);
                });

                if (!personagensEmCena.length) {
                    sidebarContent.innerHTML += `<p style="color: #737373; font-size: 0.9rem; padding-top: 10px;">Nenhum detalhe registrado no códice para este universo.</p>`;
                } else {
                    personagensEmCena.forEach((pSnap) => {
                        const p = pSnap.data();
                        const cardChar = document.createElement("button");
                        cardChar.type = "button";
                        cardChar.className = "character-mini-card";
                        cardChar.innerHTML = `
                            <img src="${safeUrl(p.foto, 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?q=80&w=100')}" alt="${escapeHtml(p.nome)}">
                            <div class="char-info">
                                <h5>${escapeHtml(p.nome)}</h5>
                                <p class="char-role">${p.papel || p.funcao || 'Personagem'}${p.primeiraAparicao ? ' • ' + p.primeiraAparicao : ''}</p>
                                <p class="char-desc">${escapeHtml(p.descricao)}</p>
                            </div>
                        `;
                        cardChar.addEventListener("click", () => abrirFichaPersonagem(p));
                        sidebarContent.appendChild(cardChar);
                    });
                }
            }

        } else {
            renderContentState(document.getElementById("capitulo-texto-exibicao"), { type: "error", title: "Capítulo não encontrado", message: "Este conteúdo pode ter sido removido ou ainda não está disponível." });
            showToast("Capítulo não encontrado.", "error");
        }
    } catch (err) {
        console.error("Erro ao carregar leitura:", err);
        renderContentState(document.getElementById("capitulo-texto-exibicao"), { type: "error", title: "Leitura indisponível", message: "Não foi possível carregar o capítulo. Verifique sua conexão e tente novamente." });
        showToast("Falha ao carregar o capítulo.", "error");
    }
}

// Trata o link/arquivo do capítulo e injeta o player correto no rodapé
async function configurarComentarios(user, perfil, livroId, capituloId) {
    const lista = document.getElementById("lista-comentarios");
    const campo = document.getElementById("input-comentario");
    const publicar = document.getElementById("btn-enviar-comentario");
    const carregarMais = document.getElementById("btn-carregar-mais-comentarios");
    const containerCarregarMais = document.getElementById("container-carregar-mais");
    const avatarUsuario = document.getElementById("user-comment-avatar");
    if (!lista || !campo || !publicar) return;
    campo.maxLength = 1000;

    const comentariosRef = collection(db, "livros", livroId, "capitulos", capituloId, "comentarios");
    const avatarPadrao = "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?q=80&w=100";
    if (avatarUsuario) avatarUsuario.src = safeUrl(user.photoURL, avatarPadrao);
    let comentarios = [];
    let quantidadeVisivel = 10;

    const renderizar = () => {
        lista.replaceChildren();
        if (comentarios.length === 0) {
            renderContentState(lista, { type: "empty", title: "Nenhum coment\u00e1rio ainda", message: "Seja a primeira pessoa a compartilhar uma impress\u00e3o sobre este cap\u00edtulo." });
        } else {
            comentarios.slice(0, quantidadeVisivel).forEach(comentario => {
                const item = document.createElement("article");
                item.className = "comment-item";
                const avatar = document.createElement("img");
                avatar.className = "comment-avatar";
                avatar.src = safeUrl(comentario.foto, avatarPadrao);
                avatar.alt = "";
                const conteudo = document.createElement("div");
                conteudo.className = "comment-content";
                const meta = document.createElement("p");
                meta.className = "comment-meta";
                const autor = document.createElement("strong");
                autor.textContent = comentario.nome || "Leitor do Codex";
                const data = document.createElement("span");
                const criada = new Date(comentario.criadoEm);
                data.textContent = Number.isNaN(criada.getTime()) ? "Data indispon\u00edvel" : criada.toLocaleDateString("pt-BR", { dateStyle: "medium" });
                meta.append(autor, data);
                const texto = document.createElement("p");
                texto.className = "comment-text";
                texto.textContent = comentario.texto;
                conteudo.append(meta, texto);

                if (comentario.uid === user.uid || perfil?.perfil === "admin") {
                    const remover = document.createElement("button");
                    remover.type = "button";
                    remover.className = "btn-comment-delete";
                    remover.textContent = perfil?.perfil === "admin" && comentario.uid !== user.uid ? "Remover como administrador" : "Excluir meu coment\u00e1rio";
                    remover.addEventListener("click", async () => {
                        const confirmado = await confirmAction({
                            title: "Excluir coment\u00e1rio?",
                            message: "A mensagem ser\u00e1 removida permanentemente desta conversa.",
                            confirmLabel: "Excluir coment\u00e1rio"
                        });
                        if (!confirmado) return;
                        setButtonBusy(remover, true, "Excluindo...");
                        try {
                            await deleteDoc(doc(comentariosRef, comentario.id));
                            showToast("Coment\u00e1rio exclu\u00eddo.", "success");
                            await carregar();
                        } catch (err) {
                            console.error("Erro ao excluir coment\u00e1rio:", err);
                            showToast("N\u00e3o foi poss\u00edvel excluir o coment\u00e1rio.", "error");
                            setButtonBusy(remover, false);
                        }
                    });
                    conteudo.appendChild(remover);
                }
                item.append(avatar, conteudo);
                lista.appendChild(item);
            });
        }
        if (containerCarregarMais) containerCarregarMais.style.display = comentarios.length > quantidadeVisivel ? "block" : "none";
    };

    const carregar = async () => {
        try {
            const snapshot = await getDocs(query(comentariosRef, orderBy("criadoEm", "desc")));
            comentarios = snapshot.docs.map(registro => ({ id: registro.id, ...registro.data() }));
            quantidadeVisivel = 10;
            renderizar();
        } catch (err) {
            console.error("Erro ao carregar coment\u00e1rios:", err);
            renderContentState(lista, { type: "error", title: "Coment\u00e1rios indispon\u00edveis", message: "N\u00e3o foi poss\u00edvel carregar esta conversa agora." });
        }
    };

    publicar.onclick = async () => {
        const texto = campo.value.trim();
        if (!texto || texto.length > 1000) {
            showToast(!texto ? "Escreva um coment\u00e1rio antes de publicar." : "O coment\u00e1rio deve ter no m\u00e1ximo 1.000 caracteres.", "error");
            campo.focus();
            return;
        }
        setButtonBusy(publicar, true, "Publicando...");
        try {
            await addDoc(comentariosRef, {
                uid: user.uid,
                nome: (user.displayName || "Leitor do Codex").slice(0, 100),
                foto: safeUrl(user.photoURL, "").slice(0, 1000),
                texto,
                criadoEm: new Date().toISOString()
            });
            campo.value = "";
            showToast("Coment\u00e1rio publicado.", "success");
            await carregar();
        } catch (err) {
            console.error("Erro ao publicar coment\u00e1rio:", err);
            showToast("N\u00e3o foi poss\u00edvel publicar o coment\u00e1rio.", "error");
        } finally {
            setButtonBusy(publicar, false);
        }
    };

    if (carregarMais) carregarMais.onclick = () => { quantidadeVisivel += 10; renderizar(); };
    await carregar();
}

function configurarNavegacaoCapitulos(livroId, capituloId, capitulos, perfil, capaLivro) {
    const indice = capitulos.findIndex(capitulo => capitulo.id === capituloId);
    const anterior = document.getElementById("capitulo-anterior");
    const proximo = document.getElementById("proximo-capitulo");
    const configurar = (elemento, capitulo, rotulo) => {
        if (!elemento) return;
        elemento.hidden = !capitulo;
        if (!capitulo) return;
        elemento.href = `ler.html?livroId=${encodeURIComponent(livroId)}&capituloId=${encodeURIComponent(capitulo.id)}`;
        const texto = elemento.querySelector("span");
        if (texto) texto.textContent = `${rotulo}: ${capitulo.titulo || `Capítulo ${capitulo.numero}`}`;
    };
    const anteriorPublicado = capitulos.slice(0, Math.max(indice, 0)).reverse().find(capitulo => capituloDisponivel(capitulo, perfil));
    configurar(anterior, anteriorPublicado || null, "Anterior");

    const seguinte = indice >= 0 && indice < capitulos.length - 1 ? capitulos[indice + 1] : null;
    if (!proximo) return;
    proximo.onclick = null;
    if (!seguinte || seguinte.status === "rascunho") {
        proximo.hidden = true;
    } else if (capituloDisponivel(seguinte, perfil)) {
        configurar(proximo, seguinte, "Próximo");
    } else if (seguinte.status === "agendado") {
        proximo.hidden = false;
        proximo.removeAttribute("href");
        const texto = proximo.querySelector("span");
        if (texto) texto.textContent = `Próximo: ${seguinte.titulo || `Capítulo ${seguinte.numero}`}`;
        proximo.onclick = event => {
            event.preventDefault();
            abrirAvisoDisponibilidade(seguinte, capaLivro);
        };
    }
}

function abrirFichaPersonagem(personagem) {
    const dialog = document.getElementById("character-profile-dialog");
    if (!dialog) return;
    const imagem = document.getElementById("character-profile-image");
    imagem.src = safeUrl(personagem.foto, "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?q=80&w=800");
    imagem.alt = personagem.nome ? `Retrato de ${personagem.nome}` : "Retrato do personagem";
    document.getElementById("character-profile-name").textContent = personagem.nome || "Personagem";
    const subtitulo = document.getElementById("character-profile-subtitle");
    subtitulo.textContent = personagem.subtitulo || "";
    subtitulo.hidden = !personagem.subtitulo;
    const dados = document.getElementById("character-profile-data");
    dados.textContent = personagem.dados || "";
    dados.hidden = !personagem.dados;
    document.getElementById("character-profile-role").textContent = personagem.papel || personagem.funcao || "Personagem";
    document.getElementById("character-profile-first").textContent = personagem.primeiraAparicao ? `Primeira aparição: ${personagem.primeiraAparicao}` : "Primeira aparição não informada";
    document.getElementById("character-profile-description").textContent = personagem.descricao || "Descrição ainda não cadastrada.";
    const citacao = document.getElementById("character-profile-quote");
    citacao.textContent = personagem.citacao || "";
    citacao.hidden = !personagem.citacao;
    preencherListaFicha("character-profile-traits", "character-profile-traits-section", personagem.tracos);
    preencherListaFicha("character-profile-secrets", "character-profile-secrets-section", personagem.segredos);
    const maniasSection = document.getElementById("character-profile-habits-section");
    document.getElementById("character-profile-habits").textContent = personagem.manias || "";
    maniasSection.hidden = !personagem.manias;
    dialog.showModal();
}

function preencherListaFicha(listaId, secaoId, valores) {
    const lista = document.getElementById(listaId);
    const secao = document.getElementById(secaoId);
    const itens = Array.isArray(valores) ? valores.filter(Boolean) : String(valores || "").split(/\r?\n/).filter(Boolean);
    lista.replaceChildren(...itens.map(texto => {
        const item = document.createElement("li");
        item.textContent = texto;
        return item;
    }));
    secao.hidden = !itens.length;
}

function abrirAvisoDisponibilidade(capitulo, capaLivro) {
    const dialog = document.getElementById("chapter-availability-dialog");
    if (!dialog) return;
    const data = new Date(capitulo.data_agendamento);
    const dataTexto = data.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
    const horaTexto = data.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    document.getElementById("chapter-availability-message").textContent = `O próximo capítulo “${capitulo.titulo || `Capítulo ${capitulo.numero}`}” estará disponível a partir do dia ${dataTexto}, às ${horaTexto}.`;
    const banner = document.getElementById("chapter-availability-banner");
    banner.style.backgroundImage = capaLivro ? `linear-gradient(180deg, transparent, rgba(24,19,38,0.35)), url('${safeUrl(capaLivro)}')` : "linear-gradient(135deg, #332C4D, #F97316)";
    dialog.showModal();
}

document.getElementById("close-character-profile")?.addEventListener("click", () => document.getElementById("character-profile-dialog")?.close());
document.getElementById("close-chapter-availability")?.addEventListener("click", () => document.getElementById("chapter-availability-dialog")?.close());

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
                    src="https://www.youtube.com/embed/${videoId}?enablejsapi=1&autoplay=1&loop=1&playlist=${videoId}"
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
    audio.loop = true;
    playBtn.style.display = "flex";
    if (progressContainer) progressContainer.style.display = "block";
    if (trackTime) trackTime.style.display = "inline-block";

    const iconPlay = `<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>`;
    const iconPause = `<svg viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>`;
    playBtn.innerHTML = iconPlay;
    playBtn.setAttribute("aria-label", "Reproduzir trilha sonora");

    playBtn.onclick = () => {
        if (audio.paused) {
            audio.play().catch(() => console.log("Aguardando ação de mídia do usuário."));
            playBtn.innerHTML = iconPause;
            playBtn.setAttribute("aria-label", "Pausar trilha sonora");
        } else {
            audio.pause();
            playBtn.innerHTML = iconPlay;
            playBtn.setAttribute("aria-label", "Reproduzir trilha sonora");
        }
    };

    audio.play().then(() => {
        playBtn.innerHTML = iconPause;
        playBtn.setAttribute("aria-label", "Pausar trilha sonora");
    }).catch(() => {
        if (trackAuthor) trackAuthor.innerText = "Toque em reproduzir para iniciar a trilha em repetição";
    });

    audio.ontimeupdate = () => {
        if (audio.duration && progressBar) {
            const progresso = (audio.currentTime / audio.duration) * 100;
            progressBar.style.width = progresso + "%";
            progressContainer?.setAttribute("aria-valuenow", String(Math.round(progresso)));
            progressContainer?.setAttribute("aria-valuetext", `${formatarTempo(audio.currentTime)} de ${formatarTempo(audio.duration)}`);
        }
        if (trackTime) {
            trackTime.innerText = `${formatarTempo(audio.currentTime)} / ${formatarTempo(audio.duration)}`;
        }
    };

    audio.onpause = () => {
        playBtn.innerHTML = iconPlay;
        playBtn.setAttribute("aria-label", "Reproduzir trilha sonora");
    };

    audio.onplay = () => {
        playBtn.innerHTML = iconPause;
        playBtn.setAttribute("aria-label", "Pausar trilha sonora");
    };

    if (progressContainer) {
        progressContainer.tabIndex = 0;
        progressContainer.setAttribute("role", "slider");
        progressContainer.setAttribute("aria-label", "Posição da trilha sonora");
        progressContainer.setAttribute("aria-valuemin", "0");
        progressContainer.setAttribute("aria-valuemax", "100");
        progressContainer.onclick = (e) => {
            if (!audio.duration) return;
            const rect = progressContainer.getBoundingClientRect();
            const pct = Math.min(Math.max((e.clientX - rect.left) / rect.width, 0), 1);
            audio.currentTime = pct * audio.duration;
        };
        progressContainer.addEventListener("keydown", event => {
            if (!audio.duration || !["ArrowLeft", "ArrowRight"].includes(event.key)) return;
            event.preventDefault();
            const delta = event.key === "ArrowRight" ? 5 : -5;
            audio.currentTime = Math.min(audio.duration, Math.max(0, audio.currentTime + delta));
        });
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
async function registrarProgressoLeitura(user, livroId, capituloId, tituloLivro, dadosCap, capaLivro) {
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
