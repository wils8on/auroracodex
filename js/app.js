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

// Busca as obras no Firestore em tempo real e monta os cards do Netflix Style
function ouvirCatalogo() {
    const livrosRef = collection(db, "livros");

    onSnapshot(livrosRef, (snapshot) => {
        const container = document.getElementById("catalogo-livros");
        if (!container) return;

        if (snapshot.empty) {
            container.innerHTML = `<p style="color: #737373; padding: 20px; font-size: 0.9rem;">Nenhum livro cadastrado ainda. Vá em 'Meus Livros' para começar!</p>`;
            return;
        }

        container.innerHTML = ""; // Limpa a mensagem de carregamento

        snapshot.forEach((docSnap) => {
            const livro = docSnap.data();
            const id = docSnap.id;

            // Cria o elemento do card exatamente com as suas classes CSS originais
            const card = document.createElement("div");
            card.className = "book-card";
            card.style.cursor = "pointer";
            
            // Redireciona para a página de leitura levando o ID exclusivo do Firebase
            card.onclick = () => {
                window.location.href = `ler.html?id=${id}`;
            };

            card.innerHTML = `
                <img src="${livro.capa || 'https://images.unsplash.com/photo-1543002588-bfa74002ed7e?q=80&w=400'}" alt="${livro.titulo}" class="book-cover">
                <div class="book-hover-info">
                    <h4>${livro.titulo}</h4>
                    <div class="book-meta">
                        <span>${filtrarNomeUniverso(livro.universo)}</span>
                    </div>
                    <p class="book-mini-desc">${livro.sinopse ? livro.sinopse.substring(0, 60) + '...' : 'Sem sinopse disponível.'}</p>
                </div>
            `;
            container.appendChild(card);
        });
    });
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