// js/ler.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

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
        // 1. Busca os detalhes do Livro (para o cabeçalho superior se necessário)
        const livroDoc = await getDoc(doc(db, "livros", livroId));
        
        // 2. Busca o conteúdo do capítulo na subcoleção
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

            // Atualiza os metadados no topo da página
            if (txtHeaderLivro) txtHeaderLivro.innerText = dadosLivro.titulo;
            if (txtHeaderCapitulo) txtHeaderCapitulo.innerText = `Capítulo ${dadosCap.numero}: ${dadosCap.titulo}`;
            if (txtNumero) txtNumero.innerText = `CAPÍTULO ${dadosCap.numero}`;
            if (txtTitulo) txtTitulo.innerText = dadosCap.titulo.toUpperCase();
            
            // Renderiza o texto quebrando as linhas corretamente em parágrafos HTML
            if (txtConteudo) {
                // Se o seu container original englobava outras coisas (como o player de música),
                // certifique-se de aplicar o ID ou a classe diretamente no container do TEXTO narrativo.
                const textoFormatado = dadosCap.conteudo.split('\n').map(paragrafo => {
                    if (paragrafo.trim() === "") return "";
                    return `<p style="line-height: 1.8; margin-bottom: 20px; font-size: 1.15rem; color: #D2D2D2; text-align: justify;">${paragrafo}</p>`;
                }).join('');
                
                txtConteudo.innerHTML = textoFormatado;
            }
        } else {
            alert("O conteúdo deste capítulo não foi localizado no Codex.");
            window.location.href = "dashboard.html";
        }
    } catch (err) {
        console.error("Erro ao carregar leitura:", err);
    }
}