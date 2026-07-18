// js/autor.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, collection, addDoc, doc, getDoc, onSnapshot, deleteDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

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

let idLivroEdicao = null; // Controla se estamos editando um livro ou criando um novo

onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = "../index.html";
    } else {
        const userDoc = await getDoc(doc(db, "usuarios", user.uid));
        if (!userDoc.exists() || (userDoc.data().perfil !== "autor" && userDoc.data().perfil !== "admin")) {
            alert("Acesso restrito a autores cadastrados.");
            window.location.href = "../dashboard.html";
        } else {
            listarLivrosAutor(); // Carrega a tabela se o acesso for liberado
        }
    }
});

const form = document.getElementById("form-cadastrar-livro");
const btnSubmit = form ? form.querySelector(".btn-submit") : null;

if (form) {
    form.addEventListener("submit", async (e) => {
        e.preventDefault();

        const dados = {
            titulo: document.getElementById("titulo").value,
            universo: document.getElementById("universo").value,
            capa: document.getElementById("url-capa").value,
            sinopse: document.getElementById("sinopse").value
        };

        try {
            if (idLivroEdicao) {
                // MODO EDIÇÃO: Atualiza o livro existente
                await updateDoc(doc(db, "livros", idLivroEdicao), dados);
                alert("Obra atualizada com sucesso!");
                idLivroEdicao = null;
                if(btnSubmit) btnSubmit.innerText = "Publicar no Codex";
            } else {
                // MODO CADASTRO: Cria um documento novo
                dados.data_criacao = new Date().toISOString();
                await addDoc(collection(db, "livros"), dados);
                alert(`"${dados.titulo}" foi adicionado ao catálogo!`);
            }
            form.reset();
        } catch (error) {
            console.error("Erro ao salvar:", error);
            alert("Erro técnico ao salvar os dados.");
        }
    });
}

// Lista os livros na tabela com escuta em tempo real
function listarLivrosAutor() {
    const livrosRef = collection(db, "livros");
    
    onSnapshot(livrosRef, (snapshot) => {
        const tbody = document.getElementById("tabela-gerenciar-livros");
        if (!tbody) return;
        tbody.innerHTML = "";

        if (snapshot.empty) {
            tbody.innerHTML = `<tr><td colspan="4" style="text-align: center; padding: 20px; color: #737373;">Nenhum livro criado por você.</td></tr>`;
            return;
        }

        snapshot.forEach((docSnap) => {
            const id = docSnap.id;
            const livro = docSnap.data();

            const tr = document.createElement("tr");
            tr.style.borderBottom = "1px solid rgba(255,255,255,0.05)";
            
            tr.innerHTML = `
                <td style="padding: 12px;"><img src="${livro.capa}" style="width: 50px; height: 30px; object-fit: cover; border-radius: 4px;"></td>
                <td style="padding: 12px;"><strong>${livro.titulo}</strong></td>
                <td style="padding: 12px; color: #8C8C8C;">${livro.universo}</td>
                <td style="padding: 12px; text-align: right;">
                    <button class="btn-editar" data-id="${id}" style="background: #404040; color: #FFF; border: none; padding: 6px 12px; margin-right: 8px; border-radius: 4px; cursor: pointer;">Editar</button>
                    <button class="btn-excluir" data-id="${id}" style="background: #E50914; color: #FFF; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer;">Excluir</button>
                </td>
            `;
            tbody.appendChild(tr);
        });

        // Evento para o botão de Editar (Puxa os dados de volta para o formulário)
        document.querySelectorAll(".btn-editar").forEach(btn => {
            btn.addEventListener("click", async (e) => {
                const id = e.target.getAttribute("data-id");
                const docSnap = await getDoc(doc(db, "livros", id));
                if (docSnap.exists()) {
                    const livro = docSnap.data();
                    idLivroEdicao = id; // Ativa o modo de edição
                    
                    document.getElementById("titulo").value = livro.titulo;
                    document.getElementById("universo").value = livro.universo;
                    document.getElementById("url-capa").value = livro.capa;
                    document.getElementById("sinopse").value = livro.sinopse;
                    
                    if(btnSubmit) btnSubmit.innerText = "Salvar Alterações";
                    window.scrollTo({ top: 0, behavior: 'smooth' }); // Sobe a página suavemente até o formulário
                }
            });
        });

        // Evento para o botão de Excluir
        document.querySelectorAll(".btn-excluir").forEach(btn => {
            btn.addEventListener("click", async (e) => {
                const id = e.target.getAttribute("data-id");
                if (confirm("Tem certeza absoluta de que deseja deletar esta obra do Codex?")) {
                    await deleteDoc(doc(db, "livros", id));
                }
            });
        });
    });
}