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
        inicializarDadosAutor();
    }
});

function inicializarDadosAutor() {
    const livrosRef = collection(db, "livros");
    
    onSnapshot(livrosRef, (snapshot) => {
        const tbody = document.getElementById("tabela-gerenciar-livros");
        const selectLivro = document.getElementById("select-livro-capitulo");
        
        if (tbody) tbody.innerHTML = "";
        if (selectLivro) selectLivro.innerHTML = '<option value="">Selecione a Obra...</option>';

        snapshot.forEach((docSnap) => {
            const id = docSnap.id;
            const livro = docSnap.data();

            if (tbody) {
                const tr = document.createElement("tr");
                tr.innerHTML = `
                    <td><img src="${livro.capa}" style="width: 45px; height: 55px; object-fit: cover; border-radius: 4px;"></td>
                    <td><strong>${livro.titulo}</strong><br><span style="color:#737373; font-size:0.8rem;">${livro.status || 'Pendente'}</span></td>
                    <td>${livro.genero || 'Não Informado'}</td>
                    <td style="text-align: right;">
                        <button class="btn-editar" data-id="${id}" style="background: #29292E; color: #FFF; border: none; padding: 6px 12px; margin-right: 8px; border-radius: 4px; cursor: pointer;">Editar</button>
                        <button class="btn-excluir" data-id="${id}" style="background: #E50914; color: #FFF; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer;">Excluir</button>
                    </td>
                `;
                tbody.appendChild(tr);
            }

            if (selectLivro) {
                const opt = document.createElement("option");
                opt.value = id;
                opt.innerText = livro.titulo;
                selectLivro.appendChild(opt);
            }
        });

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
                document.getElementById("genero").value = livro.genero || "Romance";
                document.getElementById("status-obra").value = livro.status || "Em Andamento";
                document.getElementById("sinopse").value = livro.sinopse;
                document.getElementById("url-capa").value = livro.capa;
                document.getElementById("cor-tema").value = livro.corTema || "#f59e0b";
                document.getElementById("destacar-home").checked = livro.destacar || false;

                // Reseta e marca os checkboxes das tags salvas
                document.querySelectorAll(".tag-checkbox").forEach(cb => cb.checked = false);
                if (livro.subgeneros) {
                    livro.subgeneros.forEach(tag => {
                        const inputTag = document.querySelector(`.tag-checkbox[value="${tag}"]`);
                        if(inputTag) inputTag.checked = true;
                    });
                }
                
                document.getElementById("form-cadastrar-livro").querySelector(".btn-submit").innerText = "Atualizar Obra";
                document.querySelector('[onclick="alternarAba(\'aba-cadastrar\')"]').click();
            }
        });
    });

    document.querySelectorAll(".btn-excluir").forEach(btn => {
        btn.addEventListener("click", async (e) => {
            const id = e.target.getAttribute("data-id");
            if (confirm("Deseja mesmo remover esta obra e todos os seus vínculos?")) {
                await deleteDoc(doc(db, "livros", id));
            }
        });
    });
}

// Salvar / Modificar Obra
document.getElementById("form-cadastrar-livro")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    
    // Captura as tags selecionadas no grid
    const tagsSelecionadas = [];
    document.querySelectorAll(".tag-checkbox:checked").forEach(cb => {
        tagsSelecionadas.push(cb.value);
    });

    const dados = {
        titulo: document.getElementById("titulo").value,
        genero: document.getElementById("genero").value,
        status: document.getElementById("status-obra").value,
        subgeneros: tagsSelecionadas,
        sinopse: document.getElementById("sinopse").value,
        capa: document.getElementById("url-capa").value,
        corTema: document.getElementById("cor-tema").value,
        destacar: document.getElementById("destacar-home").checked
    };

    if (idLivroEdicao) {
        await updateDoc(doc(db, "livros", idLivroEdicao), dados);
        alert("Configurações do livro atualizadas com sucesso!");
        idLivroEdicao = null;
        document.getElementById("form-cadastrar-livro").querySelector(".btn-submit").innerText = "Salvar Livro";
    } else {
        dados.data_criacao = new Date().toISOString();
        await addDoc(collection(db, "livros"), dados);
        alert("Nova obra catalogada com sucesso!");
    }
    e.target.reset();
    document.querySelectorAll(".tag-checkbox").forEach(cb => cb.checked = false);
});

// Salvar Novo Capítulo
document.getElementById("form-cadastrar-capitulo")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const idLivro = document.getElementById("select-livro-capitulo").value;
    
    const capituloDados = {
        numero: parseInt(document.getElementById("numero-capitulo").value),
        titulo: document.getElementById("titulo-capitulo").value,
        trilhaSonora: document.getElementById("trilha-sonora").value || "",
        conteudo: document.getElementById("conteudo-capitulo").value,
        data_publicacao: new Date().toISOString()
    };

    try {
        await addDoc(collection(db, "livros", idLivro, "capitulos"), capituloDados);
        alert(`Capítulo ${capituloDados.numero} publicado no Codex!`);
        e.target.reset();
        document.getElementById('contador-palavras').innerText = "0";
    } catch (err) {
        console.error(err);
        alert("Erro ao salvar capítulo.");
    }
});