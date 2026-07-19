// js/app.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, doc, getDoc, collection, onSnapshot } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

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
        window.location.href = "index.html"; // Se não está logado, expulsa para a tela de login
    } else {
        // Altera a foto do avatar para a foto real do Google da pessoa
        if(document.getElementById('user-avatar')) document.getElementById('user-avatar').src = user.photoURL;
        
        // Puxa as permissões do banco
        const userDoc = await getDoc(doc(db, "usuarios", user.uid));
        if (userDoc.exists()) {
            const dados = userDoc.data();
            
            // Atualiza a tag de perfil da navbar (Autor, Leitor, Admin)
            if(document.getElementById('user-role-badge')) {
                document.getElementById('user-role-badge').innerText = dados.perfil.toUpperCase();
            }

            // Se for admin, revela o botão secreto do painel de controle
            if (dados.perfil === "admin" && document.getElementById('link-adm')) {
                document.getElementById('link-adm').style.display = "block";
            }

            // Inicializa o carregamento do catálogo dinâmico
            ouvirCatalogo();
        }
    }
});

// Atualize a função ouvirCatalogo do js/app.js para abrir o modal no clique do card
function ouvirCatalogo() {
    const livrosRef = collection(db, "livros");

    onSnapshot(livrosRef, (snapshot) => {
        const container = document.getElementById("catalogo-livros");
        if (!container) return;
        container.innerHTML = "";

        if (snapshot.empty) {
            container.innerHTML = `<p style="color: #737373; padding: 20px;">Nenhum livro cadastrado.</p>`;
            return;
        }

        snapshot.forEach((docSnap) => {
            const livro = docSnap.data();
            const id = docSnap.id;

            const card = document.createElement("div");
            card.className = "book-card";
            card.style.cursor = "pointer";
            
            // CHAMA O MODAL PASSANDO OS DADOS COMPLETOS DA OBRA E O ID
            card.onclick = () => {
                abrirModalNetflix(id, livro);
            };

            card.innerHTML = `
                <img src="${livro.capa}" alt="${livro.titulo}" class="book-cover">
                <div class="book-hover-info">
                    <h4>${livro.titulo}</h4>
                    <div class="book-meta"><span>${filtrarNomeUniverso(livro.universo)}</span></div>
                </div>
            `;
            container.appendChild(card);
        });
    });
}

// Nova função para renderizar o Pop-up Netflix completo com os capítulos dinâmicos
import { query, orderBy, getDocs } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

async function abrirModalNetflix(idLivro, livro) {
    document.getElementById('modal-banner').style.backgroundImage = `url('${livro.capa}')`;
    document.getElementById('modal-titulo').innerText = livro.titulo;
    document.getElementById('modal-universo').innerText = filtrarNomeUniverso(livro.universo);
    document.getElementById('modal-sinopse').innerText = livro.sinopse;

    const listaCapitulosContainer = document.getElementById('modal-lista-capitulos');
    listaCapitulosContainer.innerHTML = '<p style="color: #737373;">Carregando índice de capítulos...</p>';

    document.getElementById('netflix-modal').style.display = 'block';
    document.body.style.overflow = 'hidden'; // Trava o scroll da home por trás

    try {
        // Busca os capítulos ordenados pelo número
        const capsRef = collection(db, "livros", idLivro, "capitulos");
        const q = query(capsRef, orderBy("numero", "asc"));
        const capsSnap = await getDocs(q);

        listaCapitulosContainer.innerHTML = "";

        if (capsSnap.empty) {
            listaCapitulosContainer.innerHTML = '<p style="color: #737373;">Nenhum capítulo publicado para esta obra ainda.</p>';
            return;
        }

        capsSnap.forEach((capSnap) => {
            const cap = capSnap.data();
            const item = document.createElement('div');
            item.style.cssText = "background: #2f2f2f; padding: 16px; border-radius: 4px; display: flex; justify-content: space-between; align-items: center; cursor: pointer; transition: background 0.2s;";
            
            // Efeito hover manual no JavaScript inline
            item.onmouseenter = () => item.style.background = "#3c3c3c";
            item.onmouseleave = () => item.style.background = "#2f2f2f";
            
            // Clique redireciona para a leitura do capítulo específico
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
    } catch (err) {
        console.error("Erro ao carregar os capítulos:", err);
        listaCapitulosContainer.innerHTML = '<p style="color: #E50914;">Erro ao mapear o índice de episódios.</p>';
    }
}

// Converte a tag interna do banco para um nome polido na interface
function filtrarNomeUniverso(slug) {
    const nomes = {
        'original': 'Universo Original',
        'vampire-diaries': 'The Vampire Diaries',
        '50-shades': '50 Shades of Grey'
    };
    return nomes[slug] || 'Outro Universo';
}

// Executa o Logout (Sair da conta)
const btnLogout = document.getElementById("btn-logout");
if (btnLogout) {
    btnLogout.addEventListener("click", () => {
        signOut(auth).then(() => {
            window.location.href = "index.html";
        }).catch((err) => console.error("Erro ao sair:", err));
    });
}