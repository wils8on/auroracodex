// js/app.js
import { signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { doc, getDoc, setDoc, collection, onSnapshot, query, orderBy, getDocs, where } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { auth, db } from "./firebase.js";
import { loadUserProfile } from "./user-service.js";
import { bindFavoriteButton } from "./progress-service.js";
import { extractYouTubeId, openMediaViewer } from "./media-viewer.js";
import { loadBookChapters } from "./catalog-service.js";
import { renderChapterList } from "./chapter-list.js";
import { renderContentState, showToast } from "./feedback.js";
import { bindDialogCloseButton, closeAccessibleDialog, makeActivatable, openAccessibleDialog } from "./dialog-accessibility.js";
import { escapeHtml, safeUrl } from "./security.js";
import { bookStatusMarkup, emptyBookStatusMessage } from "./book-status.js";

window.fecharModal = () => closeAccessibleDialog(document.getElementById("netflix-modal"));
bindDialogCloseButton(document.getElementById("netflix-modal"));

// Estado do Carrossel de Destaques
let listaDestaques = [];
let indiceDestaqueAtual = 0;
let timerCarrossel = null;
let livrosHome = [];
let progressoHome = [];

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
        const dados = await loadUserProfile(user.uid);
        if (dados) {
            setDoc(doc(db, "usuarios", user.uid), { ultimoLogin: new Date().toISOString() }, { merge: true }).catch(error => console.warn("Não foi possível registrar o último acesso:", error));
            
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
            ouvirProgressoUsuario(user.uid);
        }
    }
});

// Busca os livros no Firestore, atualiza o catálogo e preenche o Carrossel de Destaques
function ouvirCatalogo() {
    const livrosRef = collection(db, "livros");

    onSnapshot(livrosRef, (snapshot) => {
        const container = document.getElementById("catalogo-livros");
        if (container) container.innerHTML = "";

        listaDestaques = []; // Reinicia a lista a cada atualização do banco
        const livrosCatalogo = [];

        if (snapshot.empty) {
            if (container) {
                container.innerHTML = `<p style="color: #737373; padding: 20px;">Nenhum livro cadastrado ainda.</p>`;
            }
            return;
        }

        snapshot.forEach((docSnap) => {
            const livro = docSnap.data();
            const id = docSnap.id;
            livrosCatalogo.push({ id, ...livro });

            // 1. RENDERIZA OS CARDS DA FILEIRA "UNIVERSOS CONECTADOS"
            if (container) {
                const card = document.createElement("div");
                card.className = "book-card";
                card.style.cursor = "pointer";
                const capaSegura = safeUrl(livro.capa);
                const tituloSeguro = escapeHtml(livro.titulo);
                const universoSeguro = escapeHtml(filtrarNomeUniverso(livro.universo));
                
                // Clique abre o modal estilo Netflix
                makeActivatable(card, () => abrirModalNetflix(id, livro), `Abrir detalhes de ${livro.titulo}`);

                card.innerHTML = `
                    <img src="${capaSegura}" alt="" class="book-cover-backdrop" aria-hidden="true">
                    <img src="${capaSegura}" alt="${tituloSeguro}" class="book-cover">
                    <div class="book-hover-info">
                        <h4>${tituloSeguro}</h4>
                        <div class="book-meta"><span>${universoSeguro}</span></div>
                    </div>
                `;
                container.appendChild(card);
            }

            // 2. COLETA OS LIVROS MARCADOS PARA DESTAQUE
            if (livro.destacar) {
                listaDestaques.push({ id, ...livro });
            }
        });

        // Inicializa o slider principal com todos os destaques encontrados
        iniciarCarrosselHero();
        livrosHome = livrosCatalogo;
        renderizarContinuarLeitura();
        renderizarTrilhasInicio(livrosCatalogo);
    }, (error) => {
        console.error("Erro ao carregar catálogo:", error);
        renderContentState(document.getElementById("catalogo-livros"), {
            type: "error",
            title: "Catálogo indisponível",
            message: "Verifique sua conexão e recarregue a página."
        });
        showToast("Não foi possível atualizar o catálogo.", "error");
    });
}

async function renderizarTrilhasInicio(livros) {
    const container = document.getElementById("trilhas-inicio");
    const secao = document.getElementById("secao-trilhas-inicio");
    if (!container || !secao) return;
    try {
        const grupos = await Promise.all(livros.map(async livro => {
            const capitulos = await loadBookChapters(livro.id);
            const publicados = capitulos.filter(capitulo => {
                if (!String(capitulo.trilhaSonora || "").trim() || capitulo.status === "rascunho") return false;
                return capitulo.status !== "agendado" || (capitulo.data_agendamento && new Date(capitulo.data_agendamento).getTime() <= Date.now());
            });
            const disponiveis = capitulos.filter(capitulo => capitulo.status !== "rascunho" && (capitulo.status !== "agendado" || (capitulo.data_agendamento && new Date(capitulo.data_agendamento).getTime() <= Date.now())));
            livro.capitulosDaObra = capitulos;
            return publicados.map(capitulo => ({ livro, capitulo }));
        }));
        renderizarContinuarLeitura();
        const faixas = grupos.flat();
        const porLivro = [...new Map(faixas.map(item => [item.livro.id, { livro:item.livro, quantidade:faixas.filter(faixa => faixa.livro.id === item.livro.id).length }])).values()];
        if (!porLivro.length) { secao.style.display = "none"; return; }
        container.replaceChildren();
        porLivro.forEach(({ livro, quantidade }) => {
            const card = document.createElement("a");
            card.className = "soundtrack-book-card";
            card.href = `trilhas.html?livro=${encodeURIComponent(livro.id)}`;
            const capa = document.createElement("img"); capa.src = safeUrl(livro.capa, "assets/icons/aurora-codex-192.png"); capa.alt = "";
            const copy = document.createElement("div"); copy.className = "soundtrack-book-copy";
            const titulo = document.createElement("b"); titulo.textContent = livro.titulo;
            const meta = document.createElement("span"); meta.textContent = `♫ ${quantidade} faixa${quantidade === 1 ? "" : "s"}`;
            copy.append(titulo, meta); card.append(capa, copy); container.appendChild(card);
        });
    } catch (error) {
        console.error("Erro ao carregar trilhas na página inicial:", error);
        secao.style.display = "none";
    }
}

function ouvirProgressoUsuario(uid) {
    onSnapshot(query(collection(db, "progresso_leitura"), where("uid", "==", uid)), snapshot => {
        progressoHome = snapshot.docs.map(item => item.data()).filter(item => item.ultimoCapituloId);
        renderizarContinuarLeitura();
    }, error => console.error("Erro ao carregar continuidade de leitura:", error));
}

function renderizarContinuarLeitura() {
    const secao = document.getElementById("secao-continuar-inicio");
    const container = document.getElementById("continuar-inicio");
    if (!secao || !container || !livrosHome.length) return;
    const leituras = progressoHome.map(registro => ({ registro, livro:livrosHome.find(livro => livro.id === registro.livroId) })).filter(item => item.livro).sort((a,b) => new Date(b.registro.dataUltimaLeitura || 0) - new Date(a.registro.dataUltimaLeitura || 0)).slice(0, 4);
    secao.style.display = leituras.length ? "block" : "none";
    container.replaceChildren();
    leituras.forEach(({ registro, livro }) => {
        const card = document.createElement("a"); card.className = "continue-card"; card.href = `ler.html?livroId=${encodeURIComponent(livro.id)}&capituloId=${encodeURIComponent(registro.ultimoCapituloId)}`;
        const capa = document.createElement("img"); capa.src = safeUrl(livro.capa, "assets/icons/aurora-codex-192.png"); capa.alt = "";
        const copy = document.createElement("div");
        const etiqueta = document.createElement("small"); etiqueta.textContent = registro.status === "concluida" ? "RELER" : "CONTINUAR LEITURA";
        const titulo = document.createElement("b"); titulo.textContent = livro.titulo;
        const capitulo = document.createElement("span"); capitulo.textContent = `Capítulo ${registro.ultimoCapituloNumero}${registro.ultimoCapituloTitulo ? ` · ${registro.ultimoCapituloTitulo}` : ""}`;
        const capitulosDaObra = Array.isArray(livro.capitulosDaObra) ? livro.capitulosDaObra : [];
        const total = capitulosDaObra.length || Math.max(1, Number(registro.ultimoCapituloNumero) || 1);
        const indiceAtual = capitulosDaObra.findIndex(item => item.id === registro.ultimoCapituloId);
        const lidos = indiceAtual >= 0 ? indiceAtual + 1 : Math.min(total, Number(registro.ultimoCapituloNumero) || 0);
        const percentual = Math.min(100, Math.max(0, lidos / total * 100));
        const percentualFormatado = percentual.toLocaleString("pt-BR", { minimumFractionDigits:2, maximumFractionDigits:2 });
        const linhaProgresso = document.createElement("div"); linhaProgresso.className = "continue-progress-row";
        const barra = document.createElement("div"); barra.className = "continue-progress"; const preenchimento = document.createElement("i"); preenchimento.style.width = `${percentual}%`; barra.appendChild(preenchimento);
        const legenda = document.createElement("span"); legenda.className = "continue-percent"; legenda.textContent = `${lidos} de ${total} • ${percentualFormatado}%`;
        linhaProgresso.append(barra, legenda);
        copy.append(etiqueta, titulo, capitulo, linhaProgresso); card.append(capa, copy); container.appendChild(card);
    });
}

// Inicializa ou reseta o Carrossel do Hero Banner
function iniciarCarrosselHero() {
    const controlesContainer = document.getElementById("hero-controls");
    
    if (listaDestaques.length === 0) {
        if (controlesContainer) controlesContainer.style.display = "none";
        return;
    }

    // Se houver mais de 1 destaque, exibe o painel de controles
    if (controlesContainer) {
        controlesContainer.style.display = listaDestaques.length > 1 ? "flex" : "none";
    }

    // Garante que o índice não saia dos limites da lista
    if (indiceDestaqueAtual >= listaDestaques.length) {
        indiceDestaqueAtual = 0;
    }

    exibirDestaquePorIndice(indiceDestaqueAtual);

    // Ativa rotação automática de 6 segundos apenas se houver mais de 1 item
    if (timerCarrossel) clearInterval(timerCarrossel);
    if (listaDestaques.length > 1) {
        timerCarrossel = setInterval(proximoDestaque, 6000);
    }
}

// Exibe um destaque específico com transição
function exibirDestaquePorIndice(index) {
    if (!listaDestaques[index]) return;
    
    const livro = listaDestaques[index];
    const heroBg = document.getElementById("hero-banner-bg") || document.querySelector(".hero-banner");
    const heroArtMain = document.getElementById("hero-art-main");
    const heroTitulo = document.getElementById("hero-titulo-destaque") || document.querySelector(".hero-title");
    const heroSinopse = document.getElementById("hero-sinopse-destaque") || document.querySelector(".hero-synopsis");
    const btnLer = document.getElementById("btn-ler-destaque") || document.querySelector(".btn-read");
    const btnInfo = document.getElementById("btn-info-destaque") || document.querySelector(".btn-info");
    const heroStatus = document.getElementById("hero-status-destaque");

    const capaSegura = safeUrl(livro.capa);
    if (heroBg && capaSegura) {
        heroBg.style.backgroundImage = `url('${capaSegura}')`;
        heroBg.style.backgroundSize = "cover";
        heroBg.style.backgroundPosition = "center top";
    }

    if (heroArtMain && capaSegura) heroArtMain.src = capaSegura;

    if (heroTitulo) heroTitulo.innerText = livro.titulo;
    if (heroSinopse) heroSinopse.innerText = livro.sinopse;
    if (heroStatus) heroStatus.innerHTML = bookStatusMarkup(livro.status, true);

    if (btnInfo) btnInfo.onclick = () => abrirModalNetflix(livro.id, livro);
    if (btnLer) btnLer.onclick = () => abrirModalNetflix(livro.id, livro);

    renderizarIndicadoresDots();
}

// Desenha os marcadores (dots) do carrossel
function renderizarIndicadoresDots() {
    const dotsContainer = document.getElementById("hero-dots");
    if (!dotsContainer) return;
    dotsContainer.innerHTML = "";

    listaDestaques.forEach((_, index) => {
        const dot = document.createElement("span");
        dot.style.cssText = `width: ${index === indiceDestaqueAtual ? '24px' : '8px'}; height: 8px; border-radius: 4px; background: ${index === indiceDestaqueAtual ? '#F97316' : 'rgba(255,255,255,0.4)'}; cursor: pointer; transition: all 0.3s;`;
        dot.onclick = () => {
            indiceDestaqueAtual = index;
            exibirDestaquePorIndice(indiceDestaqueAtual);
            reiniciarTimerCarrossel();
        };
        dotsContainer.appendChild(dot);
    });
}

function proximoDestaque() {
    if (listaDestaques.length === 0) return;
    indiceDestaqueAtual = (indiceDestaqueAtual + 1) % listaDestaques.length;
    exibirDestaquePorIndice(indiceDestaqueAtual);
}

function destaqueAnterior() {
    if (listaDestaques.length === 0) return;
    indiceDestaqueAtual = (indiceDestaqueAtual - 1 + listaDestaques.length) % listaDestaques.length;
    exibirDestaquePorIndice(indiceDestaqueAtual);
}

function reiniciarTimerCarrossel() {
    if (timerCarrossel) clearInterval(timerCarrossel);
    if (listaDestaques.length > 1) {
        timerCarrossel = setInterval(proximoDestaque, 6000);
    }
}

// Vincula os botões de controle de setas (se existirem na DOM)
document.getElementById("btn-next-hero")?.addEventListener("click", () => {
    proximoDestaque();
    reiniciarTimerCarrossel();
});

document.getElementById("btn-prev-hero")?.addEventListener("click", () => {
    destaqueAnterior();
    reiniciarTimerCarrossel();
});

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
    let statusContainer = document.getElementById("modal-status-obra");
    if (!statusContainer && sinopse) {
        statusContainer = document.createElement("div");
        statusContainer.id = "modal-status-obra";
        statusContainer.className = "modal-book-status";
        sinopse.before(statusContainer);
    }
    if (statusContainer) statusContainer.innerHTML = bookStatusMarkup(livro.status, true);

    atualizarBotaoFavorito(idLivro);

    if (listaCapitulosContainer) {
        listaCapitulosContainer.innerHTML = '<p style="color: #737373;">Carregando índice de capítulos...</p>';
    }

    const modal = document.getElementById('netflix-modal');
    if (modal) {
        openAccessibleDialog(modal);
    }

    try {
        // Busca capítulos ordenados numericamente
        const capitulos = await loadBookChapters(idLivro);
        renderChapterList({ container: listaCapitulosContainer, chapters: capitulos, bookId: idLivro });
        if (!capitulos.length && listaCapitulosContainer) listaCapitulosContainer.innerHTML = `<p class="book-status-empty">${emptyBookStatusMessage(livro.status)}</p>`;
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
        const snap = await getDocs(galeriaRef);

        if (snap.empty) return;

        secao.style.display = "block";

        [...snap.docs].sort((a, b) => Number(a.data().ordem ?? 0) - Number(b.data().ordem ?? 0)).forEach((docSnap) => {
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
            makeActivatable(card, () => openMediaViewer(item.url, item.tipo, item), `Abrir ${item.categoria || "item da galeria"}`);
            grid.appendChild(card);
        });
    } catch (err) {
        console.error("Erro ao carregar galeria:", err);
    }
}

// Exibe o nome do universo cadastrado pelo autor (campo dinâmico, sem mapa fixo)
function filtrarNomeUniverso(universo) {
    return universo && universo.trim() !== "" ? universo : "Universo Independente";
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
