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
        // Trava de segurança: só ADMIN ou AUTOR podem usar este painel
        const userDoc = await getDoc(doc(db, "usuarios", user.uid));
        const perfil = userDoc.exists() ? userDoc.data().perfil : null;

        if (perfil !== "autor" && perfil !== "admin") {
            alert("Acesso restrito a autores e administradores.");
            window.location.href = "../dashboard.html";
            return;
        }

        inicializarDadosAutor();
        inicializarDadosPersonagens();
    }
});

function inicializarDadosAutor() {
    const livrosRef = collection(db, "livros");
    
    onSnapshot(livrosRef, (snapshot) => {
        const tbody = document.getElementById("tabela-gerenciar-livros");
        const selectLivro = document.getElementById("select-livro-capitulo");
        const selectLivroPersonagem = document.getElementById("select-livro-personagem");

        if (tbody) tbody.innerHTML = "";
        if (selectLivro) selectLivro.innerHTML = '<option value="">Selecione a Obra...</option>';
        if (selectLivroPersonagem) selectLivroPersonagem.innerHTML = '<option value="">Selecione a Obra...</option>';

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

            if (selectLivroPersonagem) {
                const optP = document.createElement("option");
                optP.value = id;
                optP.innerText = livro.titulo;
                selectLivroPersonagem.appendChild(optP);
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
                document.getElementById("universo").value = livro.universo || "";
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
        universo: document.getElementById("universo").value.trim(),
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

// =====================================================
// CRUD DE PERSONAGENS (CÓDICE)
// =====================================================

let idPersonagemEdicao = null;
let unsubscribePersonagens = null; // guarda o listener ativo para poder cancelar ao trocar de obra

function inicializarDadosPersonagens() {
    const selectLivroPersonagem = document.getElementById("select-livro-personagem");
    if (!selectLivroPersonagem) return;

    // Sempre que o autor trocar a obra selecionada, recarrega a lista de personagens dela
    selectLivroPersonagem.addEventListener("change", () => {
        carregarPersonagensDaObra(selectLivroPersonagem.value);
    });
}

function carregarPersonagensDaObra(livroId) {
    const listaContainer = document.getElementById("lista-personagens-cadastrados");
    if (!listaContainer) return;

    // Cancela a escuta da obra anterior antes de trocar
    if (unsubscribePersonagens) {
        unsubscribePersonagens();
        unsubscribePersonagens = null;
    }

    if (!livroId) {
        listaContainer.innerHTML = "";
        return;
    }

    const personagensRef = collection(db, "livros", livroId, "personagens");

    unsubscribePersonagens = onSnapshot(personagensRef, (snapshot) => {
        listaContainer.innerHTML = "";

        if (snapshot.empty) {
            listaContainer.innerHTML = '<p style="color:#737373; font-size:0.9rem;">Nenhum personagem cadastrado para esta obra ainda.</p>';
            return;
        }

        snapshot.forEach((docSnap) => {
            const p = docSnap.data();
            const id = docSnap.id;

            const card = document.createElement("div");
            card.style.cssText = "display:flex; gap:15px; align-items:center; background:#1A1A1E; border:1px solid #29292E; border-radius:6px; padding:12px; margin-bottom:10px;";
            card.innerHTML = `
                <img src="${p.foto || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?q=80&w=100'}" style="width:48px; height:48px; object-fit:cover; border-radius:4px;">
                <div style="flex-grow:1;">
                    <strong style="color:#FFF;">${p.nome}</strong>
                    <p style="color:#8C8C8C; font-size:0.8rem;">${p.funcao}</p>
                </div>
                <button class="btn-editar-personagem" data-id="${id}" style="background:#29292E; color:#FFF; border:none; padding:6px 12px; margin-right:8px; border-radius:4px; cursor:pointer;">Editar</button>
                <button class="btn-excluir-personagem" data-id="${id}" style="background:#E50914; color:#FFF; border:none; padding:6px 12px; border-radius:4px; cursor:pointer;">Excluir</button>
            `;
            listaContainer.appendChild(card);
        });

        vincularEventosPersonagens(livroId);
    });
}

function vincularEventosPersonagens(livroId) {
    document.querySelectorAll(".btn-editar-personagem").forEach(btn => {
        btn.addEventListener("click", async (e) => {
            const id = e.target.getAttribute("data-id");
            const docSnap = await getDoc(doc(db, "livros", livroId, "personagens", id));
            if (docSnap.exists()) {
                const p = docSnap.data();
                idPersonagemEdicao = id;

                document.getElementById("nome-personagem").value = p.nome;
                document.getElementById("funcao-personagem").value = p.funcao;
                document.getElementById("url-avatar-personagem").value = p.foto || "";
                document.getElementById("descricao-personagem").value = p.descricao;

                document.getElementById("form-cadastrar-personagem").querySelector(".btn-submit").innerText = "Atualizar Personagem";
                document.getElementById("nome-personagem").scrollIntoView({ behavior: "smooth" });
            }
        });
    });

    document.querySelectorAll(".btn-excluir-personagem").forEach(btn => {
        btn.addEventListener("click", async (e) => {
            const id = e.target.getAttribute("data-id");
            if (confirm("Deseja mesmo remover este personagem do códice?")) {
                await deleteDoc(doc(db, "livros", livroId, "personagens", id));
            }
        });
    });
}

// Salvar / Atualizar Personagem
document.getElementById("form-cadastrar-personagem")?.addEventListener("submit", async (e) => {
    e.preventDefault();

    const livroId = document.getElementById("select-livro-personagem").value;
    if (!livroId) {
        alert("Selecione a obra à qual este personagem pertence.");
        return;
    }

    const dadosPersonagem = {
        nome: document.getElementById("nome-personagem").value,
        funcao: document.getElementById("funcao-personagem").value,
        foto: document.getElementById("url-avatar-personagem").value,
        descricao: document.getElementById("descricao-personagem").value
    };

    try {
        if (idPersonagemEdicao) {
            await updateDoc(doc(db, "livros", livroId, "personagens", idPersonagemEdicao), dadosPersonagem);
            alert("Personagem atualizado com sucesso!");
            idPersonagemEdicao = null;
            e.target.querySelector(".btn-submit").innerText = "Adicionar ao Códice";
        } else {
            await addDoc(collection(db, "livros", livroId, "personagens"), dadosPersonagem);
            alert("Personagem adicionado ao Códice!");
        }
        e.target.reset();
        document.getElementById("select-livro-personagem").value = livroId; // mantém a obra selecionada
    } catch (err) {
        console.error(err);
        alert("Erro ao salvar personagem.");
    }
});