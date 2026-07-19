// js/ler.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, doc, getDoc, collection, getDocs } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

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

// Proteção básica de rota
onAuthStateChanged(auth, (user) => {
    if (!user) {
        window.location.href = "index.html";
    } else {
        carregarConteudoCapitulo();
    }
});

async function carregarConteudoCapitulo() {
    // Pega os IDs que foram passados na URL (?livroId=XXX&capituloId=YYY)
    const urlParams = new URLSearchParams(window.location.search);
    const livroId = urlParams.get('livroId');
    const capituloId = urlParams.get('capituloId');

    if (!livroId || !capituloId) {
        alert("Capítulo não especificado.");
        window.location.href = "dashboard.html";
        return;
    }

    try {
        // 1. Busca os detalhes do Livro e do Capítulo de forma limpa
        const livroDoc = await getDoc(doc(db, "livros", livroId));
        const capDoc = await getDoc(doc(db, "livros", livroId, "capitulos", capituloId));

        if (capDoc.exists()) {
            const dadosCap = capDoc.data();
            const dadosLivro = livroDoc.exists() ? livroDoc.data() : { titulo: "Obra Codex" };

            // Substitui os textos estáticos da tela pelos dados reais do banco
            const txtHeaderLivro = document.getElementById("header-nome-livro");
            const txtHeaderCapitulo = document.getElementById("header-nome-capitulo");
            const txtNumero = document.getElementById("capitulo-numero-exibicao");
            const txtTitulo = document.getElementById("capitulo-titulo-exibicao");
            const txtConteudo = document.getElementById("capitulo-texto-exibicao");

            // Atualiza os metadados no topo e corpo da página
            if (txtHeaderLivro) txtHeaderLivro.innerText = dadosLivro.titulo;
            if (txtHeaderCapitulo) txtHeaderCapitulo.innerText = `Capítulo ${dadosCap.numero}: ${dadosCap.titulo}`;
            if (txtNumero) txtNumero.innerText = `CAPÍTULO ${dadosCap.numero}`;
            if (txtTitulo) txtTitulo.innerText = dadosCap.titulo.toUpperCase();
            
            // Renderiza o texto quebrando as linhas corretamente em parágrafos HTML
            if (txtConteudo) {
                const textoFormatado = dadosCap.conteudo.split('\n').map(paragrafo => {
                    if (paragrafo.trim() === "") return "";
                    return `<p style="line-height: 1.8; margin-bottom: 20px; font-size: 1.15rem; color: #D2D2D2; text-align: justify;">${paragrafo}</p>`;
                }).join('');
                
                txtConteudo.innerHTML = textoFormatado;
            }

            // 2. BUSCA OS PERSONAGENS REAIS DO CÓDICE PARA ESSE LIVRO
            const sidebarContent = document.querySelector(".sidebar-content");
            if (sidebarContent) {
                // Mantém o título da seção na sidebar e limpa os cards antigos estáticos
                sidebarContent.innerHTML = `<h4>Personagens em Cena</h4>`;
                
                const queryPersonagens = await getDocs(collection(db, "livros", livroId, "personagens")); //
                
                if (queryPersonagens.empty) {
                    sidebarContent.innerHTML += `<p style="color: #737373; font-size: 0.9rem; padding-top: 10px;">Nenhum detalhe registrado no códice para este universo.</p>`; //
                } else {
                    queryPersonagens.forEach((pSnap) => {
                        const p = pSnap.data();
                        const cardChar = document.createElement("div");
                        cardChar.className = "character-mini-card";
                        cardChar.innerHTML = `
                            <img src="${p.foto || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?q=80&w=100'}" alt="${p.nome}">
                            <div class="char-info">
                                <h5>${p.nome}</h5>
                                <p class="char-role">${p.funcao}</p>
                                <p class="char-desc">${p.descricao}</p>
                            </div>
                        `; //
                        sidebarContent.appendChild(cardChar); //
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