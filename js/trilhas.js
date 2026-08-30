import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { auth } from "./firebase.js";
import { loadUserProfile, APPROVED_PROFILES, hasProfile } from "./user-service.js";
import { loadBookChapters, subscribeBooks } from "./catalog-service.js";
import { extractYouTubeId } from "./media-viewer.js";
import { safeUrl } from "./security.js";

let trilhas = [];
let trilhaAtual = null;
let carregamentoAtual = 0;

function capituloVisivel(capitulo) {
    if (capitulo.status === "rascunho") return false;
    if (capitulo.status !== "agendado") return true;
    return Boolean(capitulo.data_agendamento) && new Date(capitulo.data_agendamento).getTime() <= Date.now();
}

onAuthStateChanged(auth, async user => {
    if (!user) { window.location.href = "index.html"; return; }
    const perfil = await loadUserProfile(user.uid);
    if (!hasProfile(perfil, APPROVED_PROFILES)) { window.location.href = "aguardando.html"; return; }
    const avatar = document.getElementById("user-avatar");
    if (avatar && user.photoURL) avatar.src = user.photoURL;
    document.getElementById("user-role-badge").textContent = perfil.perfil.toUpperCase();
    if (perfil.perfil === "admin") document.getElementById("link-adm").style.display = "block";
    inicializarTrilhas();
});

document.getElementById("btn-logout")?.addEventListener("click", async () => {
    await signOut(auth);
    window.location.href = "index.html";
});

function inicializarTrilhas() {
    subscribeBooks(async livros => {
        const token = ++carregamentoAtual;
        const resultados = await Promise.all(livros.map(async livro => {
            try {
                const capitulos = await loadBookChapters(livro.id);
                return capitulos.filter(capitulo => capituloVisivel(capitulo) && String(capitulo.trilhaSonora || "").trim()).map(capitulo => ({
                    id: `${livro.id}:${capitulo.id}`,
                    livroId: livro.id,
                    livroTitulo: livro.titulo || "Obra sem título",
                    capa: safeUrl(livro.capa, "assets/icons/aurora-codex-512.png"),
                    capituloId: capitulo.id,
                    capituloNumero: capitulo.numero,
                    capituloTitulo: capitulo.titulo || "Capítulo sem título",
                    url: String(capitulo.trilhaSonora || "").trim()
                }));
            } catch (erro) {
                console.error(`Não foi possível carregar as trilhas de ${livro.titulo}:`, erro);
                return [];
            }
        }));
        if (token !== carregamentoAtual) return;
        trilhas = resultados.flat().sort((a, b) => a.livroTitulo.localeCompare(b.livroTitulo, "pt-BR") || Number(a.capituloNumero) - Number(b.capituloNumero));
        preencherFiltroObras();
        renderizarTrilhas();
    }, erro => {
        console.error("Erro ao carregar playlist:", erro);
        document.getElementById("lista-trilhas").innerHTML = '<p class="playlist-empty">Não foi possível carregar as trilhas agora.</p>';
    });
    document.getElementById("filtro-obra-trilhas")?.addEventListener("change", renderizarTrilhas);
}

function preencherFiltroObras() {
    const select = document.getElementById("filtro-obra-trilhas");
    const atual = select.value;
    const obras = [...new Map(trilhas.map(item => [item.livroId, item.livroTitulo])).entries()].sort((a, b) => a[1].localeCompare(b[1], "pt-BR"));
    select.replaceChildren(new Option("Todas as obras", ""), ...obras.map(([id, titulo]) => new Option(titulo, id)));
    if (obras.some(([id]) => id === atual)) select.value = atual;
}

function renderizarTrilhas() {
    const filtro = document.getElementById("filtro-obra-trilhas")?.value || "";
    const visiveis = filtro ? trilhas.filter(item => item.livroId === filtro) : trilhas;
    const lista = document.getElementById("lista-trilhas");
    if (trilhaAtual && !visiveis.some(item => item.id === trilhaAtual.id)) trilhaAtual = null;
    document.getElementById("contador-trilhas").textContent = `${visiveis.length} faixa${visiveis.length === 1 ? "" : "s"}`;
    lista.replaceChildren();
    if (!visiveis.length) {
        lista.innerHTML = '<p class="playlist-empty">Nenhum capítulo publicado com trilha sonora nesta seleção.</p>';
        limparPlayer();
        return;
    }
    visiveis.forEach((trilha, indice) => {
        const botao = document.createElement("button");
        botao.type = "button";
        botao.className = `track-item${trilhaAtual?.id === trilha.id ? " active" : ""}`;
        botao.setAttribute("aria-pressed", String(trilhaAtual?.id === trilha.id));
        botao.setAttribute("aria-label", `Tocar trilha do capítulo ${trilha.capituloNumero}: ${trilha.capituloTitulo}`);
        const imagem = document.createElement("img"); imagem.src = trilha.capa; imagem.alt = "";
        const texto = document.createElement("div"); texto.className = "track-item-copy";
        const titulo = document.createElement("b"); titulo.textContent = trilha.capituloTitulo;
        const meta = document.createElement("span"); meta.textContent = `${trilha.livroTitulo} · Capítulo ${trilha.capituloNumero}`;
        texto.append(titulo, meta);
        const play = document.createElement("span"); play.textContent = trilhaAtual?.id === trilha.id ? "♫" : "▶";
        botao.append(imagem, texto, play);
        botao.addEventListener("click", () => tocarTrilha(trilha));
        lista.appendChild(botao);
        if (!trilhaAtual && indice === 0) tocarTrilha(trilha, false);
    });
}

function tocarTrilha(trilha, atualizarLista = true) {
    trilhaAtual = trilha;
    const capa = document.getElementById("playlist-capa"); capa.src = trilha.capa; capa.alt = `Capa de ${trilha.livroTitulo}`;
    document.getElementById("playlist-obra").textContent = trilha.livroTitulo;
    document.getElementById("playlist-faixa").textContent = trilha.capituloTitulo;
    document.getElementById("playlist-capitulo").textContent = `Trilha vinculada ao capítulo ${trilha.capituloNumero}`;
    const player = document.getElementById("playlist-player");
    player.replaceChildren();
    const videoId = extractYouTubeId(trilha.url);
    if (videoId) {
        const iframe = document.createElement("iframe");
        iframe.height = "152";
        iframe.src = `https://www.youtube.com/embed/${encodeURIComponent(videoId)}?autoplay=1&loop=1&playlist=${encodeURIComponent(videoId)}`;
        iframe.title = `Trilha de ${trilha.capituloTitulo}`;
        iframe.allow = "autoplay; encrypted-media; picture-in-picture";
        iframe.allowFullscreen = true;
        player.appendChild(iframe);
    } else if (trilha.url.includes("open.spotify.com")) {
        const link = document.createElement("a"); link.className = "spotify-link"; link.href = safeUrl(trilha.url); link.target = "_blank"; link.rel = "noopener"; link.textContent = "♫ Ouvir no Spotify"; player.appendChild(link);
    } else {
        const source = safeUrl(trilha.url);
        const audio = document.createElement("audio"); audio.controls = true; audio.autoplay = true; audio.loop = true; audio.src = source; player.appendChild(audio);
        audio.play().catch(() => { document.getElementById("playlist-capitulo").textContent += " · Toque em reproduzir para iniciar"; });
    }
    if (atualizarLista) renderizarTrilhas();
}

function limparPlayer() {
    trilhaAtual = null;
    document.getElementById("playlist-obra").textContent = "AURORA CODEX";
    document.getElementById("playlist-faixa").textContent = "Nenhuma trilha nesta seleção";
    document.getElementById("playlist-capitulo").textContent = "Escolha outra obra para continuar.";
    document.getElementById("playlist-player").innerHTML = "<p>Aguardando uma faixa disponível.</p>";
}
