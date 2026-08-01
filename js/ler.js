// js/ler.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, collection, getDocs, query, orderBy } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

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

// Estado do Carrossel de Destaques e Leitura
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = "index.html";
    } else {
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
                    txtConteudo.innerHTML = conteudoBruto;
                } else {
                    txtConteudo.innerHTML = conteudoBruto.split('\n').map(paragrafo => {
                        if (paragrafo.trim() === "") return "";
                        return `<p style="line-height: 1.8; margin-bottom: 20px; font-size: 1.15rem; color: #D2D2D2; text-align: justify;">${paragrafo}</p>`;
                    }).join('');
                }
            }

            // Capa de destaque e cor de cena do capítulo (opcionais, definidos pelo autor)
            const bannerCapitulo = document.getElementById("capitulo-banner-capa");
            if (bannerCapitulo) {
                if (dadosCap.capa) {
                    bannerCapitulo.style.backgroundImage = `url('${dadosCap.capa}')`;
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

        } else {
            alert("O conteúdo deste capítulo não foi localizado no Codex.");
            window.location.href = "dashboard.html";
        }
    } catch (err) {
        console.error("Erro ao carregar leitura:", err);
    }
}

// Trata o link do capítulo e embuti o áudio/vídeo do YouTube direto no rodapé
function configurarPlayerTrilha(urlTrilha, tituloCapitulo) {
    const trackTitle = document.getElementById("player-track-title");
    const trackAuthor = document.getElementById("player-track-author");
    const container = document.getElementById("media-player-container");
    const audio = document.getElementById("chapter-audio");

    if (!urlTrilha || urlTrilha.trim() === "") {
        if (trackTitle) trackTitle.innerText = "Sem Trilha Sonora";
        if (trackAuthor) trackAuthor.innerText = "Capítulo Silencioso";
        if (container) container.innerHTML = `<span style="color: #737373; font-size: 0.85rem;">-</span>`;
        return;
    }

    if (trackAuthor) trackAuthor.innerText = `Trilha: ${tituloCapitulo}`;

    // SE FOR LINK DO YOUTUBE: Injeta o iFrame do mini-player na própria página
    if (urlTrilha.includes("youtube.com") || urlTrilha.includes("youtu.be")) {
        let videoId = "";
        if (urlTrilha.includes("youtu.be/")) {
            videoId = urlTrilha.split("youtu.be/")[1].split("?")[0];
        } else if (urlTrilha.includes("v=")) {
            videoId = urlTrilha.split("v=")[1].split("&")[0];
        }

        if (trackTitle) trackTitle.innerText = "Trilha do YouTube";

        // Substitui o botão padrão pelo player embutido compacto do YouTube
        if (container) {
            container.innerHTML = `
                <iframe 
                    width="200" 
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
    } 
    else {
        // Se for um arquivo de áudio direto (ex: MP3/Stream)
        if (audio) {
            audio.src = urlTrilha;
            audio.style.display = "none;"
            if (trackTitle) trackTitle.innerText = "Trilha Oficial do Capítulo";
        }
    }
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