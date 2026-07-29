// js/autor.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, collection, addDoc, doc, getDoc, setDoc, onSnapshot, deleteDoc, updateDoc, orderBy, query, arrayUnion, arrayRemove, writeBatch } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

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

// =====================================================
// CONFIGURAÇÃO DO CLOUDINARY (upload de imagens gratuito)
// =====================================================
// Troque pelos valores do SEU painel do Cloudinary (Dashboard > Cloud name / Settings > Upload > presets)
const CLOUDINARY_CLOUD_NAME = "ffril2cr";
const CLOUDINARY_UPLOAD_PRESET = "qrtn86gx";

let idLivroEdicao = null;
let livrosCache = [];
let universosCache = [];

// =====================================================
// UPLOAD DE IMAGENS (Firebase Storage)
// =====================================================

// Faz upload de um arquivo para o Cloudinary e retorna a URL pública.
// Atualiza um elemento de texto (id do elemento) com o status do envio.
function uploadImagem(arquivo, pasta, idElementoProgresso) {
    const elementoProgresso = document.getElementById(idElementoProgresso);
    if (elementoProgresso) elementoProgresso.innerText = "Enviando imagem...";

    const formData = new FormData();
    formData.append("file", arquivo);
    formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);
    formData.append("folder", pasta); // organiza em pastas dentro do Cloudinary (capas / personagens)

    const requisicao = fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`, {
        method: "POST",
        body: formData
    }).then(async (resposta) => {
        if (!resposta.ok) {
            const detalhe = await resposta.text();
            throw new Error(`Falha no upload (status ${resposta.status}): ${detalhe}`);
        }
        const dados = await resposta.json();
        if (elementoProgresso) elementoProgresso.innerText = "Upload concluído ✔";
        return dados.secure_url;
    }).catch((erro) => {
        if (elementoProgresso) elementoProgresso.innerText = "Erro no upload.";
        throw erro;
    });

    // Proteção extra: nunca deixa a tela travada esperando pra sempre
    return comTimeout(requisicao, 30000, "O upload demorou demais e foi cancelado. Verifique sua internet e tente de novo.");
}

// Cancela uma promessa (e mostra um erro) se ela demorar mais que "ms" milissegundos
function comTimeout(promessa, ms, mensagemErro) {
    return Promise.race([
        promessa,
        new Promise((_, reject) => setTimeout(() => reject(new Error(mensagemErro)), ms))
    ]);
}

// Mostra uma pré-visualização local imediata (antes mesmo do upload) ao escolher um arquivo
function inicializarPreviewImagens() {
    const inputCapa = document.getElementById("arquivo-capa");
    const previewCapa = document.getElementById("preview-capa");
    const wrapperCapa = document.getElementById("preview-wrapper-capa");

    if (inputCapa) {
        inputCapa.addEventListener("change", () => {
            if (inputCapa.files && inputCapa.files[0]) {
                previewCapa.src = URL.createObjectURL(inputCapa.files[0]);
                wrapperCapa.style.display = "block";
                document.getElementById("progresso-upload-capa").innerText = "";
            }
        });
    }

    const inputPersonagem = document.getElementById("arquivo-avatar-personagem");
    const previewPersonagem = document.getElementById("preview-avatar-personagem");
    const wrapperPersonagem = document.getElementById("preview-wrapper-personagem");

    if (inputPersonagem) {
        inputPersonagem.addEventListener("change", () => {
            if (inputPersonagem.files && inputPersonagem.files[0]) {
                previewPersonagem.src = URL.createObjectURL(inputPersonagem.files[0]);
                wrapperPersonagem.style.display = "block";
                document.getElementById("progresso-upload-personagem").innerText = "";
            }
        });
    }
}

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
        inicializarDadosCapitulos();
        inicializarPreviewImagens();
        inicializarCatalogoConfig();
        inicializarDadosUniversos();
        inicializarDadosGaleria();
        inicializarDadosOraculo();
    }
});

function inicializarDadosAutor() {
    const livrosRef = collection(db, "livros");
    
    onSnapshot(livrosRef, (snapshot) => {
        const tbody = document.getElementById("tabela-gerenciar-livros");
        const selectLivro = document.getElementById("select-livro-capitulo");
        const selectLivroPersonagem = document.getElementById("select-livro-personagem");
        const selectLivroGaleria = document.getElementById("select-livro-galeria");

        if (tbody) tbody.innerHTML = "";
        if (selectLivro) selectLivro.innerHTML = '<option value="">Selecione a Obra...</option>';
        if (selectLivroPersonagem) selectLivroPersonagem.innerHTML = '<option value="">Selecione a Obra...</option>';
        if (selectLivroGaleria) selectLivroGaleria.innerHTML = '<option value="">Selecione a Obra...</option>';

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

            if (selectLivroGaleria) {
                const optG = document.createElement("option");
                optG.value = id;
                optG.innerText = livro.titulo;
                selectLivroGaleria.appendChild(optG);
            }
        });

        livrosCache = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        atualizarUIUniversos();

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
                document.getElementById("universo-atual-label").innerText = livro.universoNome
                    ? livro.universoNome
                    : "Nenhum — vincule na aba Universos";
                document.getElementById("status-obra").value = livro.status || "Em Andamento";
                document.getElementById("sinopse").value = livro.sinopse;
                document.getElementById("url-capa").value = livro.capa || "";
                document.getElementById("arquivo-capa").value = ""; // limpa seleção de arquivo anterior
                if (livro.capa) {
                    document.getElementById("preview-capa").src = livro.capa;
                    document.getElementById("preview-wrapper-capa").style.display = "block";
                    document.getElementById("progresso-upload-capa").innerText = "Capa atual (envie um novo arquivo para substituir)";
                }
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

    const btnSubmit = e.target.querySelector(".btn-submit");
    const arquivoCapa = document.getElementById("arquivo-capa").files[0];

    // Se não há arquivo novo e também não há uma capa já salva (nem em edição), bloqueia
    if (!arquivoCapa && !document.getElementById("url-capa").value) {
        alert("Selecione uma imagem de capa.");
        return;
    }

    // Captura as tags selecionadas no grid
    const tagsSelecionadas = [];
    document.querySelectorAll(".tag-checkbox:checked").forEach(cb => {
        tagsSelecionadas.push(cb.value);
    });

    btnSubmit.disabled = true;
    btnSubmit.innerText = "Salvando...";

    try {
        let urlCapaFinal = document.getElementById("url-capa").value;

        // Só faz upload se o autor escolheu um arquivo novo
        if (arquivoCapa) {
            urlCapaFinal = await uploadImagem(arquivoCapa, "capas", "progresso-upload-capa");
        }

        const dados = {
            titulo: document.getElementById("titulo").value,
            genero: document.getElementById("genero").value,
            status: document.getElementById("status-obra").value,
            subgeneros: tagsSelecionadas,
            sinopse: document.getElementById("sinopse").value,
            capa: urlCapaFinal,
            corTema: document.getElementById("cor-tema").value,
            destacar: document.getElementById("destacar-home").checked
        };

        if (idLivroEdicao) {
            await updateDoc(doc(db, "livros", idLivroEdicao), dados);
            alert("Configurações do livro atualizadas com sucesso!");
            idLivroEdicao = null;
            btnSubmit.innerText = "Salvar Livro";
        } else {
            dados.data_criacao = new Date().toISOString();
            await addDoc(collection(db, "livros"), dados);
            alert("Nova obra catalogada com sucesso!");
        }

        e.target.reset();
        document.querySelectorAll(".tag-checkbox").forEach(cb => cb.checked = false);
        document.getElementById("preview-wrapper-capa").style.display = "none";
        document.getElementById("universo-atual-label").innerText = "Nenhum — vincule na aba Universos";
    } catch (err) {
        console.error(err);
        alert("Erro ao salvar a obra. Verifique sua conexão e tente novamente.");
    } finally {
        btnSubmit.disabled = false;
        if (btnSubmit.innerText === "Salvando...") btnSubmit.innerText = "Salvar Livro";
    }
});

// =====================================================
// CRUD DE CAPÍTULOS
// =====================================================

let idCapituloEdicao = null;
let unsubscribeCapitulos = null;

function inicializarDadosCapitulos() {
    const selectLivro = document.getElementById("select-livro-capitulo");
    if (!selectLivro) return;

    selectLivro.addEventListener("change", () => {
        resetarFormularioCapitulo(); // evita salvar edição de um capítulo de outra obra por engano
        carregarCapitulosDaObra(selectLivro.value);
    });
}

function resetarFormularioCapitulo() {
    idCapituloEdicao = null;
    const form = document.getElementById("form-cadastrar-capitulo");
    if (form) {
        const idLivroAtual = document.getElementById("select-livro-capitulo").value;
        form.reset();
        document.getElementById("select-livro-capitulo").value = idLivroAtual;
        form.querySelector(".btn-submit").innerText = "Publicar Capítulo";
        document.getElementById("contador-palavras").innerText = "0";
    }
}

function carregarCapitulosDaObra(livroId) {
    const listaContainer = document.getElementById("lista-capitulos-cadastrados");
    if (!listaContainer) return;

    if (unsubscribeCapitulos) {
        unsubscribeCapitulos();
        unsubscribeCapitulos = null;
    }

    if (!livroId) {
        listaContainer.innerHTML = "";
        return;
    }

    const capsRef = collection(db, "livros", livroId, "capitulos");
    const q = query(capsRef, orderBy("numero", "asc"));

    unsubscribeCapitulos = onSnapshot(q, (snapshot) => {
        listaContainer.innerHTML = "";

        if (snapshot.empty) {
            listaContainer.innerHTML = '<p style="color:#737373; font-size:0.9rem;">Nenhum capítulo publicado para esta obra ainda.</p>';
            return;
        }

        snapshot.forEach((docSnap) => {
            const cap = docSnap.data();
            const id = docSnap.id;

            const item = document.createElement("div");
            item.style.cssText = "display:flex; justify-content:space-between; align-items:center; background:#1A1A1E; border:1px solid #29292E; border-radius:6px; padding:12px 15px; margin-bottom:10px;";
            item.innerHTML = `
                <div>
                    <span style="color:#E50914; font-weight:600; margin-right:10px;">Cap. ${cap.numero}</span>
                    <strong style="color:#FFF;">${cap.titulo}</strong>
                </div>
                <div>
                    <button class="btn-editar-capitulo" data-id="${id}" style="background:#29292E; color:#FFF; border:none; padding:6px 12px; margin-right:8px; border-radius:4px; cursor:pointer;">Editar</button>
                    <button class="btn-excluir-capitulo" data-id="${id}" style="background:#E50914; color:#FFF; border:none; padding:6px 12px; border-radius:4px; cursor:pointer;">Excluir</button>
                </div>
            `;
            listaContainer.appendChild(item);
        });

        vincularEventosCapitulos(livroId);
    });
}

function vincularEventosCapitulos(livroId) {
    document.querySelectorAll(".btn-editar-capitulo").forEach(btn => {
        btn.addEventListener("click", async (e) => {
            const id = e.target.getAttribute("data-id");
            const docSnap = await getDoc(doc(db, "livros", livroId, "capitulos", id));
            if (docSnap.exists()) {
                const cap = docSnap.data();
                idCapituloEdicao = id;

                document.getElementById("numero-capitulo").value = cap.numero;
                document.getElementById("titulo-capitulo").value = cap.titulo;
                document.getElementById("trilha-sonora").value = cap.trilhaSonora || "";
                document.getElementById("conteudo-capitulo").value = cap.conteudo;

                const palavras = cap.conteudo.trim() === "" ? 0 : cap.conteudo.trim().split(/\s+/).length;
                document.getElementById("contador-palavras").innerText = palavras;

                document.getElementById("form-cadastrar-capitulo").querySelector(".btn-submit").innerText = "Atualizar Capítulo";
                document.getElementById("titulo-capitulo").scrollIntoView({ behavior: "smooth" });
            }
        });
    });

    document.querySelectorAll(".btn-excluir-capitulo").forEach(btn => {
        btn.addEventListener("click", async (e) => {
            const id = e.target.getAttribute("data-id");
            if (confirm("Deseja mesmo excluir este capítulo? Essa ação não pode ser desfeita.")) {
                await deleteDoc(doc(db, "livros", livroId, "capitulos", id));
                // Se o capítulo excluído era o que estava sendo editado, limpa o formulário
                if (idCapituloEdicao === id) resetarFormularioCapitulo();
            }
        });
    });
}

// Salvar Novo Capítulo OU Atualizar Capítulo Existente
document.getElementById("form-cadastrar-capitulo")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const idLivro = document.getElementById("select-livro-capitulo").value;

    if (!idLivro) {
        alert("Selecione a obra à qual este capítulo pertence.");
        return;
    }

    const capituloDados = {
        numero: parseInt(document.getElementById("numero-capitulo").value),
        titulo: document.getElementById("titulo-capitulo").value,
        trilhaSonora: document.getElementById("trilha-sonora").value || "",
        conteudo: document.getElementById("conteudo-capitulo").value
    };

    const btnSubmit = e.target.querySelector(".btn-submit");
    btnSubmit.disabled = true;

    try {
        if (idCapituloEdicao) {
            await updateDoc(doc(db, "livros", idLivro, "capitulos", idCapituloEdicao), capituloDados);
            alert(`Capítulo ${capituloDados.numero} atualizado com sucesso!`);
        } else {
            capituloDados.data_publicacao = new Date().toISOString();
            await addDoc(collection(db, "livros", idLivro, "capitulos"), capituloDados);
            alert(`Capítulo ${capituloDados.numero} publicado no Codex!`);
        }
        resetarFormularioCapitulo();
    } catch (err) {
        console.error(err);
        alert("Erro ao salvar capítulo.");
    } finally {
        btnSubmit.disabled = false;
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
                    <p style="color:#8C8C8C; font-size:0.8rem;">${p.papel || p.funcao || 'Sem papel definido'}${p.primeiraAparicao ? ' • ' + p.primeiraAparicao : ''}</p>
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
                document.getElementById("papel-personagem").value = p.papel || "Secundário";
                document.getElementById("primeira-aparicao-personagem").value = p.primeiraAparicao || "";
                document.getElementById("url-avatar-personagem").value = p.foto || "";
                document.getElementById("arquivo-avatar-personagem").value = "";
                if (p.foto) {
                    document.getElementById("preview-avatar-personagem").src = p.foto;
                    document.getElementById("preview-wrapper-personagem").style.display = "block";
                    document.getElementById("progresso-upload-personagem").innerText = "Foto atual (envie um novo arquivo para substituir)";
                }
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

    const btnSubmit = e.target.querySelector(".btn-submit");
    const arquivoFoto = document.getElementById("arquivo-avatar-personagem").files[0];

    btnSubmit.disabled = true;
    btnSubmit.innerText = "Salvando...";

    try {
        let urlFotoFinal = document.getElementById("url-avatar-personagem").value;

        if (arquivoFoto) {
            urlFotoFinal = await uploadImagem(arquivoFoto, "personagens", "progresso-upload-personagem");
        }

        const dadosPersonagem = {
            nome: document.getElementById("nome-personagem").value,
            papel: document.getElementById("papel-personagem").value,
            primeiraAparicao: document.getElementById("primeira-aparicao-personagem").value.trim(),
            foto: urlFotoFinal,
            descricao: document.getElementById("descricao-personagem").value
        };

        if (idPersonagemEdicao) {
            await updateDoc(doc(db, "livros", livroId, "personagens", idPersonagemEdicao), dadosPersonagem);
            alert("Personagem atualizado com sucesso!");
            idPersonagemEdicao = null;
            btnSubmit.innerText = "Adicionar ao Códice";
        } else {
            await addDoc(collection(db, "livros", livroId, "personagens"), dadosPersonagem);
            alert("Personagem adicionado ao Códice!");
        }
        e.target.reset();
        document.getElementById("select-livro-personagem").value = livroId; // mantém a obra selecionada
        document.getElementById("preview-wrapper-personagem").style.display = "none";
    } catch (err) {
        console.error(err);
        alert("Erro ao salvar personagem.");
    } finally {
        btnSubmit.disabled = false;
        if (btnSubmit.innerText === "Salvando...") btnSubmit.innerText = "Adicionar ao Códice";
    }
});

// =====================================================
// CATÁLOGO DINÂMICO DE GÊNEROS E TAGS (configuracoes/catalogo)
// =====================================================

const CATALOGO_PADRAO = {
    generos: ["Romance", "Fantasia", "Cyberpunk", "Outro"],
    subgeneros: ["Dark Romance", "Enemies to Lovers", "Slow Burn", "Máfia", "Vampiros", "Psicológico", "Distopia"]
};

function inicializarCatalogoConfig() {
    const catalogoRef = doc(db, "configuracoes", "catalogo");

    onSnapshot(catalogoRef, async (snap) => {
        if (!snap.exists()) {
            // Primeira vez rodando: cria o documento com os valores que já estavam fixos no código.
            // Isso preserva a compatibilidade com livros já cadastrados anteriormente.
            await setDoc(catalogoRef, CATALOGO_PADRAO);
            return; // este mesmo onSnapshot dispara de novo assim que o documento for criado
        }

        const dados = snap.data();
        const generos = dados.generos || [];
        const subgeneros = dados.subgeneros || [];

        popularSelectGenero(generos);
        popularCheckboxesTags(subgeneros);
        renderizarListaConfig("lista-generos-config", generos, removerGenero);
        renderizarListaConfig("lista-tags-config", subgeneros, removerTag);
    });
}

function popularSelectGenero(lista) {
    const select = document.getElementById("genero");
    if (!select) return;

    const valorAtual = select.value; // preserva a seleção atual, se possível
    select.innerHTML = "";

    lista.forEach(g => {
        const opt = document.createElement("option");
        opt.value = g;
        opt.innerText = g;
        select.appendChild(opt);
    });

    if (lista.includes(valorAtual)) select.value = valorAtual;
}

function popularCheckboxesTags(lista) {
    const grid = document.getElementById("subgeneros-grid-dinamico");
    if (!grid) return;

    // Preserva quais tags já estavam marcadas antes de reconstruir a lista
    const marcadasAntes = new Set();
    grid.querySelectorAll(".tag-checkbox:checked").forEach(cb => marcadasAntes.add(cb.value));

    grid.innerHTML = "";

    lista.forEach((tag, index) => {
        const idCheckbox = `tag-chk-${index}`;

        const input = document.createElement("input");
        input.type = "checkbox";
        input.className = "tag-checkbox";
        input.id = idCheckbox;
        input.value = tag;
        if (marcadasAntes.has(tag)) input.checked = true;

        const label = document.createElement("label");
        label.className = "tag-label";
        label.setAttribute("for", idCheckbox);
        label.innerText = tag;

        grid.appendChild(input);
        grid.appendChild(label);
    });
}

function renderizarListaConfig(idContainer, lista, aoRemover) {
    const container = document.getElementById(idContainer);
    if (!container) return;

    container.innerHTML = "";

    if (lista.length === 0) {
        container.innerHTML = '<p style="color:#737373; font-size:0.85rem;">Nada cadastrado ainda.</p>';
        return;
    }

    lista.forEach(item => {
        const row = document.createElement("div");
        row.style.cssText = "display:flex; justify-content:space-between; align-items:center; padding:10px 14px; background:#1A1A1E; border:1px solid #29292E; border-radius:6px; margin-bottom:8px;";
        row.innerHTML = `
            <span style="color:#FFF; font-size:0.9rem;">${item}</span>
            <button type="button" style="background:transparent; border:none; color:#E50914; font-size:1.2rem; line-height:1; cursor:pointer; padding:0 4px;" title="Remover">&times;</button>
        `;
        row.querySelector("button").addEventListener("click", () => aoRemover(item));
        container.appendChild(row);
    });
}

async function removerGenero(nome) {
    if (!confirm(`Remover o gênero "${nome}" da lista de opções?`)) return;
    await updateDoc(doc(db, "configuracoes", "catalogo"), { generos: arrayRemove(nome) });
}

async function removerTag(nome) {
    if (!confirm(`Remover a tag "${nome}" da lista de opções?`)) return;
    await updateDoc(doc(db, "configuracoes", "catalogo"), { subgeneros: arrayRemove(nome) });
}

document.getElementById("btn-add-genero")?.addEventListener("click", async () => {
    const input = document.getElementById("novo-genero");
    const valor = input.value.trim();
    if (!valor) return;

    await setDoc(doc(db, "configuracoes", "catalogo"), { generos: arrayUnion(valor) }, { merge: true });
    input.value = "";
});

document.getElementById("btn-add-tag")?.addEventListener("click", async () => {
    const input = document.getElementById("nova-tag");
    const valor = input.value.trim();
    if (!valor) return;

    await setDoc(doc(db, "configuracoes", "catalogo"), { subgeneros: arrayUnion(valor) }, { merge: true });
    input.value = "";
});

// =====================================================
// UNIVERSOS (agrupamento de livros conectados)
// =====================================================

let idUniversoEdicao = null;

function inicializarDadosUniversos() {
    const universosRef = collection(db, "universos");

    onSnapshot(universosRef, (snapshot) => {
        universosCache = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        atualizarUIUniversos();
    });
}

// Chamado sempre que a lista de livros OU de universos muda, pra manter tudo sincronizado na tela
function atualizarUIUniversos() {
    renderizarChecklistLivros(idUniversoEdicao);
    renderizarListaUniversos();
    if (typeof renderizarChipsLivrosOraculo === "function") renderizarChipsLivrosOraculo();
}

function renderizarChecklistLivros(idUniversoAtual) {
    const container = document.getElementById("checklist-livros-universo");
    if (!container) return;

    container.innerHTML = "";

    if (livrosCache.length === 0) {
        container.innerHTML = '<p style="color:#737373; font-size:0.85rem;">Cadastre um livro primeiro na aba "Editar/Criar Livro".</p>';
        return;
    }

    livrosCache.forEach(livro => {
        const marcado = idUniversoAtual && livro.universoId === idUniversoAtual;
        const row = document.createElement("label");
        row.style.cssText = "display:flex; align-items:center; gap:10px; cursor:pointer; color:#D4D4D4; font-size:0.9rem;";
        row.innerHTML = `
            <input type="checkbox" class="checkbox-livro-universo" value="${livro.id}" ${marcado ? "checked" : ""} style="width:16px; height:16px; cursor:pointer;">
            ${livro.titulo}
        `;
        container.appendChild(row);
    });
}

function renderizarListaUniversos() {
    const container = document.getElementById("lista-universos-config");
    if (!container) return;

    container.innerHTML = "";

    if (universosCache.length === 0) {
        container.innerHTML = '<p style="color:#737373; font-size:0.85rem;">Nenhum universo cadastrado ainda.</p>';
        return;
    }

    universosCache.forEach(u => {
        const qtdLivros = livrosCache.filter(l => l.universoId === u.id).length;

        const row = document.createElement("div");
        row.style.cssText = "display:flex; align-items:center; gap:12px; padding:12px; background:#1A1A1E; border:1px solid #29292E; border-radius:6px; margin-bottom:10px;";
        row.innerHTML = `
            <div style="width:40px; height:40px; border-radius:6px; background-color:${u.corTema || '#7c3aed'}; background-image:${u.capa ? `url('${u.capa}')` : 'none'}; background-size:cover; background-position:center; flex-shrink:0;"></div>
            <div style="flex-grow:1;">
                <strong style="color:#FFF;">${u.nome}</strong>
                <p style="color:#8C8C8C; font-size:0.8rem;">${qtdLivros} livro(s)</p>
            </div>
            <button type="button" class="btn-editar-universo" data-id="${u.id}" style="background:#29292E; color:#FFF; border:none; padding:6px 12px; border-radius:4px; cursor:pointer;">Editar</button>
            <button type="button" class="btn-excluir-universo" data-id="${u.id}" style="background:#E50914; color:#FFF; border:none; padding:6px 12px; border-radius:4px; cursor:pointer;">Excluir</button>
        `;
        container.appendChild(row);
    });

    document.querySelectorAll(".btn-editar-universo").forEach(btn => {
        btn.addEventListener("click", () => carregarUniversoParaEdicao(btn.getAttribute("data-id")));
    });

    document.querySelectorAll(".btn-excluir-universo").forEach(btn => {
        btn.addEventListener("click", () => excluirUniverso(btn.getAttribute("data-id")));
    });
}

function carregarUniversoParaEdicao(id) {
    const u = universosCache.find(x => x.id === id);
    if (!u) return;

    idUniversoEdicao = id;
    document.getElementById("nome-universo").value = u.nome;
    document.getElementById("descricao-universo").value = u.descricao || "";
    document.getElementById("cor-universo").value = u.corTema || "#7c3aed";
    document.getElementById("url-capa-universo").value = u.capa || "";
    document.getElementById("arquivo-capa-universo").value = "";

    if (u.capa) {
        document.getElementById("preview-capa-universo").src = u.capa;
        document.getElementById("preview-wrapper-universo").style.display = "block";
        document.getElementById("progresso-upload-universo").innerText = "Capa atual (envie um novo arquivo para substituir)";
    } else {
        document.getElementById("preview-wrapper-universo").style.display = "none";
    }

    document.getElementById("titulo-form-universo").innerText = `Editando: ${u.nome}`;
    document.getElementById("form-universo").querySelector(".btn-submit").innerText = "Atualizar Universo";

    renderizarChecklistLivros(id);
    document.getElementById("nome-universo").scrollIntoView({ behavior: "smooth" });
}

function resetarFormularioUniverso() {
    idUniversoEdicao = null;
    document.getElementById("form-universo").reset();
    document.getElementById("titulo-form-universo").innerText = "Novo Universo";
    document.getElementById("form-universo").querySelector(".btn-submit").innerText = "Criar Universo";
    document.getElementById("preview-wrapper-universo").style.display = "none";
    document.getElementById("url-capa-universo").value = "";
    renderizarChecklistLivros(null);
}

async function excluirUniverso(id) {
    if (!confirm("Excluir este universo? Os livros vinculados a ele não serão apagados, só perdem essa conexão.")) return;

    const batch = writeBatch(db);

    livrosCache
        .filter(l => l.universoId === id)
        .forEach(livro => {
            batch.update(doc(db, "livros", livro.id), { universoId: null, universoNome: null, universo: "" });
        });

    batch.delete(doc(db, "universos", id));

    await batch.commit();

    if (idUniversoEdicao === id) resetarFormularioUniverso();
}

document.getElementById("form-universo")?.addEventListener("submit", async (e) => {
    e.preventDefault();

    const btnSubmit = e.target.querySelector(".btn-submit");
    const arquivoCapa = document.getElementById("arquivo-capa-universo").files[0];
    const nome = document.getElementById("nome-universo").value.trim();
    const idsMarcados = Array.from(document.querySelectorAll(".checkbox-livro-universo:checked")).map(cb => cb.value);

    btnSubmit.disabled = true;
    btnSubmit.innerText = "Salvando...";

    try {
        let urlCapaFinal = document.getElementById("url-capa-universo").value;
        if (arquivoCapa) {
            urlCapaFinal = await uploadImagem(arquivoCapa, "universos", "progresso-upload-universo");
        }

        const dadosUniverso = {
            nome,
            descricao: document.getElementById("descricao-universo").value.trim(),
            corTema: document.getElementById("cor-universo").value,
            capa: urlCapaFinal || ""
        };

        let idUniverso = idUniversoEdicao;

        if (idUniverso) {
            await updateDoc(doc(db, "universos", idUniverso), dadosUniverso);
        } else {
            dadosUniverso.data_criacao = new Date().toISOString();
            const novoDoc = await addDoc(collection(db, "universos"), dadosUniverso);
            idUniverso = novoDoc.id;
        }

        // Sincroniza os livros: vincula os marcados, desvincula os que foram desmarcados,
        // e atualiza o nome exibido nos livros já vinculados caso o universo tenha sido renomeado.
        const batch = writeBatch(db);

        livrosCache.forEach(livro => {
            const estavaVinculado = livro.universoId === idUniverso;
            const deveEstarVinculado = idsMarcados.includes(livro.id);

            if (deveEstarVinculado && !estavaVinculado) {
                batch.update(doc(db, "livros", livro.id), { universoId: idUniverso, universoNome: nome, universo: nome });
            } else if (!deveEstarVinculado && estavaVinculado) {
                batch.update(doc(db, "livros", livro.id), { universoId: null, universoNome: null, universo: "" });
            } else if (deveEstarVinculado && estavaVinculado && livro.universoNome !== nome) {
                batch.update(doc(db, "livros", livro.id), { universoNome: nome, universo: nome });
            }
        });

        await batch.commit();

        alert(idUniversoEdicao ? "Universo atualizado com sucesso!" : "Universo criado com sucesso!");
        resetarFormularioUniverso();
    } catch (err) {
        console.error(err);
        alert("Erro ao salvar universo.");
    } finally {
        btnSubmit.disabled = false;
        if (btnSubmit.innerText === "Salvando...") {
            btnSubmit.innerText = idUniversoEdicao ? "Atualizar Universo" : "Criar Universo";
        }
    }
});

// =====================================================
// GALERIA DE IMAGENS E VÍDEOS (subcoleção por livro)
// =====================================================

let idGaleriaEdicao = null;
let unsubscribeGaleria = null;

function inicializarDadosGaleria() {
    const selectLivroGaleria = document.getElementById("select-livro-galeria");
    if (!selectLivroGaleria) return;

    selectLivroGaleria.addEventListener("change", () => {
        resetarFormularioGaleria();
        carregarGaleriaDaObra(selectLivroGaleria.value);
    });

    // Alterna entre o campo de upload de imagem e o campo de URL do YouTube
    document.getElementById("tipo-galeria")?.addEventListener("change", (e) => {
        const ehImagem = e.target.value === "imagem";
        document.getElementById("campo-upload-imagem-galeria").style.display = ehImagem ? "flex" : "none";
        document.getElementById("campo-url-video-galeria").style.display = ehImagem ? "none" : "flex";
    });

    // Preview instantâneo ao escolher um arquivo de imagem
    document.getElementById("arquivo-imagem-galeria")?.addEventListener("change", (e) => {
        if (e.target.files && e.target.files[0]) {
            document.getElementById("preview-imagem-galeria").src = URL.createObjectURL(e.target.files[0]);
            document.getElementById("preview-wrapper-galeria").style.display = "block";
            document.getElementById("progresso-upload-galeria").innerText = "";
        }
    });
}

function resetarFormularioGaleria() {
    idGaleriaEdicao = null;
    const form = document.getElementById("form-galeria");
    if (!form) return;

    form.reset();
    document.getElementById("titulo-form-galeria").innerText = "Adicionar Item";
    form.querySelector(".btn-submit").innerText = "Adicionar";
    document.getElementById("preview-wrapper-galeria").style.display = "none";
    document.getElementById("url-imagem-galeria").value = "";
    document.getElementById("campo-upload-imagem-galeria").style.display = "flex";
    document.getElementById("campo-url-video-galeria").style.display = "none";
}

function carregarGaleriaDaObra(livroId) {
    const listaContainer = document.getElementById("lista-galeria-itens");
    if (!listaContainer) return;

    if (unsubscribeGaleria) {
        unsubscribeGaleria();
        unsubscribeGaleria = null;
    }

    if (!livroId) {
        listaContainer.innerHTML = "";
        return;
    }

    const galeriaRef = collection(db, "livros", livroId, "galeria");
    const q = query(galeriaRef, orderBy("ordem", "asc"));

    unsubscribeGaleria = onSnapshot(q, (snapshot) => {
        listaContainer.innerHTML = "";

        if (snapshot.empty) {
            listaContainer.innerHTML = '<p style="color:#737373; font-size:0.9rem;">Nenhum item cadastrado para esta obra ainda.</p>';
            return;
        }

        snapshot.forEach((docSnap) => {
            const item = docSnap.data();
            const id = docSnap.id;

            const miniatura = item.tipo === "video"
                ? `<div style="width:56px; height:56px; border-radius:6px; background:#1A1A1E; display:flex; align-items:center; justify-content:center; font-size:1.3rem;">▶</div>`
                : `<img src="${item.url}" style="width:56px; height:56px; object-fit:cover; border-radius:6px;">`;

            const row = document.createElement("div");
            row.style.cssText = "display:flex; gap:15px; align-items:center; background:#1A1A1E; border:1px solid #29292E; border-radius:6px; padding:12px; margin-bottom:10px;";
            row.innerHTML = `
                ${miniatura}
                <div style="flex-grow:1;">
                    <strong style="color:#FFF;">${item.titulo || '(sem título)'}</strong>
                    <p style="color:#8C8C8C; font-size:0.8rem;">${item.categoria} • Ordem ${item.ordem ?? 0}</p>
                </div>
                <button class="btn-editar-galeria" data-id="${id}" style="background:#29292E; color:#FFF; border:none; padding:6px 12px; margin-right:8px; border-radius:4px; cursor:pointer;">Editar</button>
                <button class="btn-excluir-galeria" data-id="${id}" style="background:#E50914; color:#FFF; border:none; padding:6px 12px; border-radius:4px; cursor:pointer;">Excluir</button>
            `;
            listaContainer.appendChild(row);
        });

        vincularEventosGaleria(livroId);
    });
}

function vincularEventosGaleria(livroId) {
    document.querySelectorAll(".btn-editar-galeria").forEach(btn => {
        btn.addEventListener("click", async (e) => {
            const id = e.target.getAttribute("data-id");
            const docSnap = await getDoc(doc(db, "livros", livroId, "galeria", id));
            if (!docSnap.exists()) return;

            const item = docSnap.data();
            idGaleriaEdicao = id;

            document.getElementById("titulo-galeria").value = item.titulo || "";
            document.getElementById("tipo-galeria").value = item.tipo;
            document.getElementById("categoria-galeria").value = item.categoria;
            document.getElementById("descricao-galeria").value = item.descricao || "";
            document.getElementById("ordem-galeria").value = item.ordem ?? 0;
            document.getElementById("arquivo-imagem-galeria").value = "";

            const ehImagem = item.tipo === "imagem";
            document.getElementById("campo-upload-imagem-galeria").style.display = ehImagem ? "flex" : "none";
            document.getElementById("campo-url-video-galeria").style.display = ehImagem ? "none" : "flex";

            if (ehImagem) {
                document.getElementById("url-imagem-galeria").value = item.url || "";
                if (item.url) {
                    document.getElementById("preview-imagem-galeria").src = item.url;
                    document.getElementById("preview-wrapper-galeria").style.display = "block";
                    document.getElementById("progresso-upload-galeria").innerText = "Imagem atual (envie um novo arquivo para substituir)";
                }
                document.getElementById("url-video-galeria").value = "";
            } else {
                document.getElementById("url-video-galeria").value = item.url || "";
                document.getElementById("preview-wrapper-galeria").style.display = "none";
            }

            document.getElementById("titulo-form-galeria").innerText = "Editar Item";
            document.getElementById("form-galeria").querySelector(".btn-submit").innerText = "Atualizar Item";
            document.getElementById("titulo-galeria").scrollIntoView({ behavior: "smooth" });
        });
    });

    document.querySelectorAll(".btn-excluir-galeria").forEach(btn => {
        btn.addEventListener("click", async (e) => {
            const id = e.target.getAttribute("data-id");
            if (confirm("Excluir este item da galeria?")) {
                await deleteDoc(doc(db, "livros", livroId, "galeria", id));
                if (idGaleriaEdicao === id) resetarFormularioGaleria();
            }
        });
    });
}

document.getElementById("form-galeria")?.addEventListener("submit", async (e) => {
    e.preventDefault();

    const livroId = document.getElementById("select-livro-galeria").value;
    if (!livroId) {
        alert("Selecione o livro ao qual este item pertence.");
        return;
    }

    const tipo = document.getElementById("tipo-galeria").value;
    const btnSubmit = e.target.querySelector(".btn-submit");
    btnSubmit.disabled = true;
    btnSubmit.innerText = "Salvando...";

    try {
        let urlFinal = "";

        if (tipo === "imagem") {
            const arquivoImagem = document.getElementById("arquivo-imagem-galeria").files[0];
            urlFinal = document.getElementById("url-imagem-galeria").value;

            if (arquivoImagem) {
                urlFinal = await uploadImagem(arquivoImagem, "galeria", "progresso-upload-galeria");
            }

            if (!urlFinal) {
                alert("Selecione uma imagem para adicionar.");
                btnSubmit.disabled = false;
                btnSubmit.innerText = idGaleriaEdicao ? "Atualizar Item" : "Adicionar";
                return;
            }
        } else {
            urlFinal = document.getElementById("url-video-galeria").value.trim();
            if (!urlFinal) {
                alert("Informe a URL do vídeo do YouTube.");
                btnSubmit.disabled = false;
                btnSubmit.innerText = idGaleriaEdicao ? "Atualizar Item" : "Adicionar";
                return;
            }
        }

        const dadosItem = {
            titulo: document.getElementById("titulo-galeria").value.trim(),
            tipo,
            categoria: document.getElementById("categoria-galeria").value,
            url: urlFinal,
            descricao: document.getElementById("descricao-galeria").value.trim(),
            ordem: parseInt(document.getElementById("ordem-galeria").value) || 0
        };

        if (idGaleriaEdicao) {
            await updateDoc(doc(db, "livros", livroId, "galeria", idGaleriaEdicao), dadosItem);
            alert("Item atualizado com sucesso!");
        } else {
            dadosItem.data_criacao = new Date().toISOString();
            await addDoc(collection(db, "livros", livroId, "galeria"), dadosItem);
            alert("Item adicionado à galeria!");
        }

        resetarFormularioGaleria();
    } catch (err) {
        console.error(err);
        alert("Erro ao salvar item da galeria.");
    } finally {
        btnSubmit.disabled = false;
        if (btnSubmit.innerText === "Salvando...") {
            btnSubmit.innerText = idGaleriaEdicao ? "Atualizar Item" : "Adicionar";
        }
    }
});

// =====================================================
// ORÁCULO DO AUTOR (mural de posts do autor)
// =====================================================

let idOraculoEdicao = null;
let livrosSelecionadosOraculo = new Set();

function inicializarDadosOraculo() {
    const checkboxPublicarAgora = document.getElementById("publicar-agora-oraculo");
    checkboxPublicarAgora?.addEventListener("change", (e) => {
        document.getElementById("campo-agendar-oraculo").style.display = e.target.checked ? "none" : "block";
    });

    document.getElementById("arquivo-imagem-oraculo")?.addEventListener("change", (e) => {
        if (e.target.files && e.target.files[0]) {
            document.getElementById("preview-imagem-oraculo").src = URL.createObjectURL(e.target.files[0]);
            document.getElementById("preview-wrapper-oraculo").style.display = "block";
            document.getElementById("progresso-upload-oraculo").innerText = "";
        }
    });

    onSnapshot(collection(db, "oraculo"), (snapshot) => {
        const posts = snapshot.docs
            .map(d => ({ id: d.id, ...d.data() }))
            .sort((a, b) => new Date(b.dataPublicacao) - new Date(a.dataPublicacao));

        renderizarListaOraculo(posts);
    });

    renderizarChipsLivrosOraculo();
}

// Reconstrói os chips de livros (chamado na inicialização e sempre que a lista de livros mudar)
function renderizarChipsLivrosOraculo() {
    const container = document.getElementById("chips-livros-oraculo");
    if (!container) return;

    container.innerHTML = "";

    if (livrosCache.length === 0) {
        container.innerHTML = '<p style="color:#737373; font-size:0.85rem;">Cadastre um livro primeiro.</p>';
        return;
    }

    livrosCache.forEach(livro => {
        const chip = document.createElement("button");
        chip.type = "button";
        const marcado = livrosSelecionadosOraculo.has(livro.id);
        chip.style.cssText = `background:${marcado ? '#E50914' : 'rgba(255,255,255,0.05)'}; border:1px solid ${marcado ? '#E50914' : 'rgba(255,255,255,0.15)'}; color:#FFF; padding:6px 14px; border-radius:20px; font-size:0.85rem; cursor:pointer;`;
        chip.innerText = livro.titulo;
        chip.onclick = () => {
            if (livrosSelecionadosOraculo.has(livro.id)) {
                livrosSelecionadosOraculo.delete(livro.id);
            } else {
                livrosSelecionadosOraculo.add(livro.id);
            }
            renderizarChipsLivrosOraculo();
        };
        container.appendChild(chip);
    });
}

function renderizarListaOraculo(posts) {
    const container = document.getElementById("lista-oraculo-posts");
    if (!container) return;

    container.innerHTML = "";

    if (posts.length === 0) {
        container.innerHTML = '<p style="color:#737373; font-size:0.85rem;">Nenhuma publicação ainda.</p>';
        return;
    }

    const agora = new Date();

    posts.forEach(post => {
        const agendado = new Date(post.dataPublicacao) > agora;
        const dataFormatada = new Date(post.dataPublicacao).toLocaleString("pt-BR", { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

        const row = document.createElement("div");
        row.style.cssText = "padding:12px; background:#1A1A1E; border:1px solid #29292E; border-radius:6px; margin-bottom:10px;";
        row.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:10px;">
                <div>
                    <strong style="color:#FFF;">${post.titulo || '(sem título)'}</strong>
                    <p style="color:#8C8C8C; font-size:0.8rem; margin-top:2px;">
                        ${post.tipo} • ${agendado ? 'Agendado para ' : 'Publicado em '}${dataFormatada}
                    </p>
                </div>
                <div style="display:flex; gap:8px; flex-shrink:0;">
                    <button class="btn-editar-oraculo" data-id="${post.id}" style="background:#29292E; color:#FFF; border:none; padding:6px 12px; border-radius:4px; cursor:pointer;">Editar</button>
                    <button class="btn-excluir-oraculo" data-id="${post.id}" style="background:#E50914; color:#FFF; border:none; padding:6px 12px; border-radius:4px; cursor:pointer;">Excluir</button>
                </div>
            </div>
        `;
        container.appendChild(row);
    });

    document.querySelectorAll(".btn-editar-oraculo").forEach(btn => {
        btn.addEventListener("click", () => carregarPostParaEdicao(btn.getAttribute("data-id"), posts));
    });

    document.querySelectorAll(".btn-excluir-oraculo").forEach(btn => {
        btn.addEventListener("click", async (e) => {
            const id = e.target.getAttribute("data-id");
            if (confirm("Excluir esta publicação do Oráculo?")) {
                await deleteDoc(doc(db, "oraculo", id));
                if (idOraculoEdicao === id) resetarFormularioOraculo();
            }
        });
    });
}

function carregarPostParaEdicao(id, posts) {
    const post = posts.find(p => p.id === id);
    if (!post) return;

    idOraculoEdicao = id;
    document.getElementById("titulo-oraculo").value = post.titulo || "";
    document.getElementById("tipo-oraculo").value = post.tipo;
    document.getElementById("conteudo-oraculo").value = post.conteudo;
    document.getElementById("url-imagem-oraculo").value = post.imagem || "";
    document.getElementById("arquivo-imagem-oraculo").value = "";

    if (post.imagem) {
        document.getElementById("preview-imagem-oraculo").src = post.imagem;
        document.getElementById("preview-wrapper-oraculo").style.display = "block";
        document.getElementById("progresso-upload-oraculo").innerText = "Imagem atual (envie um novo arquivo para substituir)";
    } else {
        document.getElementById("preview-wrapper-oraculo").style.display = "none";
    }

    livrosSelecionadosOraculo = new Set(post.livrosRelacionados || []);
    renderizarChipsLivrosOraculo();

    const jaPublicado = new Date(post.dataPublicacao) <= new Date();
    document.getElementById("publicar-agora-oraculo").checked = jaPublicado;
    document.getElementById("campo-agendar-oraculo").style.display = jaPublicado ? "none" : "block";
    if (!jaPublicado) {
        // Formata pro input datetime-local (precisa do formato AAAA-MM-DDTHH:mm)
        const d = new Date(post.dataPublicacao);
        const offset = d.getTimezoneOffset();
        const dLocal = new Date(d.getTime() - offset * 60000);
        document.getElementById("data-agendada-oraculo").value = dLocal.toISOString().slice(0, 16);
    }

    document.getElementById("titulo-form-oraculo").innerText = "Editar Publicação";
    document.getElementById("form-oraculo").querySelector(".btn-submit").innerText = "Atualizar Publicação";
    document.getElementById("titulo-oraculo").scrollIntoView({ behavior: "smooth" });
}

function resetarFormularioOraculo() {
    idOraculoEdicao = null;
    livrosSelecionadosOraculo = new Set();
    document.getElementById("form-oraculo").reset();
    document.getElementById("publicar-agora-oraculo").checked = true;
    document.getElementById("campo-agendar-oraculo").style.display = "none";
    document.getElementById("titulo-form-oraculo").innerText = "Nova Publicação";
    document.getElementById("form-oraculo").querySelector(".btn-submit").innerText = "Criar Publicação";
    document.getElementById("preview-wrapper-oraculo").style.display = "none";
    document.getElementById("url-imagem-oraculo").value = "";
    renderizarChipsLivrosOraculo();
}

document.getElementById("form-oraculo")?.addEventListener("submit", async (e) => {
    e.preventDefault();

    const btnSubmit = e.target.querySelector(".btn-submit");
    const arquivoImagem = document.getElementById("arquivo-imagem-oraculo").files[0];
    const publicarAgora = document.getElementById("publicar-agora-oraculo").checked;

    btnSubmit.disabled = true;
    btnSubmit.innerText = "Salvando...";

    try {
        let urlImagemFinal = document.getElementById("url-imagem-oraculo").value;
        if (arquivoImagem) {
            urlImagemFinal = await uploadImagem(arquivoImagem, "oraculo", "progresso-upload-oraculo");
        }

        let dataPublicacao;
        if (publicarAgora) {
            dataPublicacao = new Date().toISOString();
        } else {
            const valorData = document.getElementById("data-agendada-oraculo").value;
            if (!valorData) {
                alert("Escolha uma data para agendar a publicação.");
                btnSubmit.disabled = false;
                btnSubmit.innerText = idOraculoEdicao ? "Atualizar Publicação" : "Criar Publicação";
                return;
            }
            dataPublicacao = new Date(valorData).toISOString();
        }

        const dadosPost = {
            titulo: document.getElementById("titulo-oraculo").value.trim(),
            tipo: document.getElementById("tipo-oraculo").value,
            conteudo: document.getElementById("conteudo-oraculo").value.trim(),
            livrosRelacionados: Array.from(livrosSelecionadosOraculo),
            imagem: urlImagemFinal || "",
            dataPublicacao
        };

        if (idOraculoEdicao) {
            await updateDoc(doc(db, "oraculo", idOraculoEdicao), dadosPost);
            alert("Publicação atualizada com sucesso!");
        } else {
            dadosPost.data_criacao = new Date().toISOString();
            await addDoc(collection(db, "oraculo"), dadosPost);
            alert(publicarAgora ? "Publicação criada com sucesso!" : "Publicação agendada com sucesso!");
        }

        resetarFormularioOraculo();
    } catch (err) {
        console.error(err);
        alert("Erro ao salvar publicação.");
    } finally {
        btnSubmit.disabled = false;
        if (btnSubmit.innerText === "Salvando...") {
            btnSubmit.innerText = idOraculoEdicao ? "Atualizar Publicação" : "Criar Publicação";
        }
    }
});