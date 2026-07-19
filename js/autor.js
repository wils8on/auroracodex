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

let idLivroEdicao = null;

onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = "../index.html";
    } else {
        const userDoc = await getDoc(doc(db, "usuarios", user.uid));
        if (!userDoc.exists() || (userDoc.data().perfil !== "autor" && userDoc.data().perfil !== "admin")) {
            alert("Acesso restrito.");
            window.location.href = "../dashboard.html";
        } else {
            inicializarDadosAutor();
        }
    }
});

function inicializarDadosAutor() {
    const livrosRef = collection(db, "livros");
    
    onSnapshot(livrosRef, (snapshot) => {
        const tbody = document.getElementById("tabela-gerenciar-livros");
        const selectLivro = document.getElementById("select-livro-capitulo");
        
        if (tbody) tbody.innerHTML = "";
        if (selectLivro) selectLivro.innerHTML = '<option value="">Selecione a Obra...</option>';

        if (snapshot.empty) {
            if (tbody) tbody.innerHTML = `<tr><td colspan="4" style="text-align: center; color:#737373;">Nenhum livro cadastrado.</td></tr>`;
            return;
        }

        snapshot.forEach((docSnap) => {
            const id = docSnap.id;
            const livro = docSnap.data();

            // Alimenta a tabela de gerenciamento
            if (tbody) {
                const tr = document.createElement("tr");
                tr.innerHTML = `
                    <td><img src="${livro.capa}" style="width: 50px; height: 30px; object-fit: cover; border-radius: 4px;"></td>
                    <td><strong>${livro.titulo}</strong></td>
                    <td>${livro.universo}</td>
                    <td style="text-align: right;">
                        <button class="btn-editar" data-id="${id}" style="background: #404040; color: #FFF; border: none; padding: 6px 12px; margin-right: 8px; border-radius: 4px; cursor: pointer;">Editar</button>
                        <button class="btn-excluir" data-id="${id}" style="background: #E50914; color: #FFF; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer;">Excluir</button>
                    </td>
                `;
                tbody.appendChild(tr);
            }

            // Alimenta o Select de Capítulos
            if (selectLivro) {
                const opt = document.createElement("option");
                opt.value = id;
                opt.innerText = livro.titulo;
                selectLivro.appendChild(opt);
            }
        });

        // Eventos de Editar e Deletar Obras
         VincularEventosObras();
    });
}

function VincularEventosObras() {
    document.querySelectorAll(".btn-editar").forEach(btn => {
        btn.addEventListener("click", async (e) => {
            const id = e.target.getAttribute("data-id");
            const docSnap = await getDoc(doc(db, "livros", id));
            if (docSnap.exists()) {
                const livro = docSnap.data();
                idLivroEdicao = id;
                document.getElementById("titulo").value = livro.titulo;
                document.getElementById("universo").value = livro.universo;
                document.getElementById("url-capa").value = livro.capa;
                document.getElementById("sinopse").value = livro.sinopse;
                
                document.getElementById("form-cadastrar-livro").querySelector(".btn-submit").innerText = "Salvar Alterações";
                // Abre a aba de cadastro automaticamente para edição
                document.querySelector('[onclick="alternarAba(\'aba-cadastrar\')"]').click();
            }
        });
    });

    document.querySelectorAll(".btn-excluir").forEach(btn => {
        btn.addEventListener("click", async (e) => {
            const id = e.target.getAttribute("data-id");
            if (confirm("Deseja mesmo excluir este livro?")) {
                await deleteDoc(doc(db, "livros", id));
            }
        });
    });
}

// Salvar/Editar Livro
document.getElementById("form-cadastrar-livro")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const dados = {
        titulo: document.getElementById("titulo").value,
        universo: document.getElementById("universo").value,
        capa: document.getElementById("url-capa").value,
        sinopse: document.getElementById("sinopse").value
    };
    if (idLivroEdicao) {
        await updateDoc(doc(db, "livros", idLivroEdicao), dados);
        alert("Livro atualizado!");
        idLivroEdicao = null;
        document.getElementById("form-cadastrar-livro").querySelector(".btn-submit").innerText = "Publicar no Codex";
    } else {
        dados.data_criacao = new Date().toISOString();
        await addDoc(collection(db, "livros"), dados);
        alert("Livro criado!");
    }
    e.target.reset();
});

// Salvar Capítulo na Subcoleção do Livro Selecionado
document.getElementById("form-cadastrar-capitulo")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const idLivro = document.getElementById("select-livro-capitulo").value;
    const capituloDados = {
        numero: parseInt(document.getElementById("numero-capitulo").value),
        titulo: document.getElementById("titulo-capitulo").value || `Capítulo ${document.getElementById("numero-capitulo").value}`,
        conteudo: document.getElementById("conteudo-capitulo").value,
        data_publicacao: new Date().toISOString()
    };

    try {
        // Grava na subcoleção: livros -> {idDoLivro} -> capitulos
        await addDoc(collection(db, "livros", idLivro, "capitulos"), capituloDados);
        alert("Capítulo publicado com sucesso!");
        e.target.reset();
    } catch (err) {
        console.error(err);
        alert("Erro ao salvar capítulo.");
    }
});