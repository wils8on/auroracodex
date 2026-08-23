// js/autor.js
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { collection, addDoc, doc, getDoc, getDocs, setDoc, onSnapshot, deleteDoc, updateDoc, orderBy, query, arrayUnion, arrayRemove, writeBatch } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { auth, db } from "./firebase.js";
import { loadUserProfile, hasProfile } from "./user-service.js";
import { escapeHtml, safeUrl, sanitizeRichHtml } from "./security.js";
import { setButtonBusy, showToast } from "./feedback.js";
import { confirmAction } from "./dialog-accessibility.js?v=confirm-dialog-v1";
import { normalizeBookStatus } from "./book-status.js";

const LEGACY_OWNER_EMAIL = "wilsononole@gmail.com";
let usuarioAtual = null;

document.querySelectorAll('[id^="progresso-upload-"]').forEach(region => {
    region.setAttribute("role", "status");
    region.setAttribute("aria-live", "polite");
    region.setAttribute("aria-atomic", "true");
});
let perfilAtual = null;

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
    if (!arquivo?.type?.startsWith("image/") || arquivo.size > 10 * 1024 * 1024) {
        return Promise.reject(new Error("Envie uma imagem válida de até 10 MB."));
    }
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

// Upload genérico pro Cloudinary. Serve tanto pra imagens quanto pra áudio —
// o Cloudinary não tem um "resource_type" separado pra áudio, ele usa "video" pra isso.
function uploadArquivo(arquivo, pasta, idElementoProgresso, resourceType = "image") {
    const limite = resourceType === "video" ? 50 * 1024 * 1024 : 10 * 1024 * 1024;
    const tipoValido = resourceType === "video" ? arquivo?.type?.startsWith("audio/") : arquivo?.type?.startsWith("image/");
    if (!tipoValido || arquivo.size > limite) {
        return Promise.reject(new Error(resourceType === "video" ? "Envie um áudio válido de até 50 MB." : "Envie uma imagem válida de até 10 MB."));
    }
    const elementoProgresso = document.getElementById(idElementoProgresso);
    if (elementoProgresso) elementoProgresso.innerText = "Enviando arquivo...";

    const formData = new FormData();
    formData.append("file", arquivo);
    formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);
    formData.append("folder", pasta);

    const requisicao = fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/${resourceType}/upload`, {
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

    // Uploads de áudio podem demorar mais que imagens, então damos mais tempo
    const tempoLimite = resourceType === "video" ? 60000 : 30000;
    return comTimeout(requisicao, tempoLimite, "O upload demorou demais e foi cancelado. Verifique sua internet e tente de novo.");
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

    const inputCapaCapitulo = document.getElementById("arquivo-capa-capitulo");
    const previewCapaCapitulo = document.getElementById("preview-capa-capitulo");
    const wrapperCapaCapitulo = document.getElementById("preview-wrapper-capa-capitulo");

    if (inputCapaCapitulo) {
        inputCapaCapitulo.addEventListener("change", () => {
            if (inputCapaCapitulo.files && inputCapaCapitulo.files[0]) {
                previewCapaCapitulo.src = URL.createObjectURL(inputCapaCapitulo.files[0]);
                wrapperCapaCapitulo.style.display = "block";
                document.getElementById("progresso-upload-capa-capitulo").innerText = "";
            }
        });
    }

    // Alterna entre "Link" e "Upload de Áudio" pra trilha sonora do capítulo
    const tipoTrilha = document.getElementById("tipo-trilha-capitulo");
    if (tipoTrilha) {
        tipoTrilha.addEventListener("change", (e) => {
            const ehLink = e.target.value === "link";
            document.getElementById("campo-trilha-link").style.display = ehLink ? "block" : "none";
            document.getElementById("campo-trilha-upload").style.display = ehLink ? "none" : "block";
        });
    }
}

onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = "../index.html";
    } else {
        // Trava de segurança: só ADMIN ou AUTOR podem usar este painel
        const dadosPerfil = await loadUserProfile(user.uid);
        const perfil = dadosPerfil?.perfil || null;

        if (!hasProfile(dadosPerfil, ["autor", "admin"])) {
            showToast("Acesso restrito a autores e administradores.", "error");
            window.location.href = "../dashboard.html";
            return;
        }

        usuarioAtual = user;
        perfilAtual = perfil;

        if (perfil !== "admin") {
            document.querySelector('[onclick="alternarAba(\'aba-taxonomias\')"]')?.remove();
            document.querySelector('[onclick="alternarAba(\'aba-oraculo\')"]')?.remove();
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

let paginaAtualObras = 1;
const OBRAS_POR_PAGINA = 10;

function inicializarDadosAutor() {
    const livrosRef = collection(db, "livros");
    document.getElementById("busca-obras")?.addEventListener("input", () => {
        paginaAtualObras = 1;
        atualizarFiltroObras();
    });
    document.getElementById("pagina-obras-anterior")?.addEventListener("click", () => mudarPaginaObras(-1));
    document.getElementById("pagina-obras-proxima")?.addEventListener("click", () => mudarPaginaObras(1));
    
    onSnapshot(livrosRef, (snapshot) => {
        const tbody = document.getElementById("tabela-gerenciar-livros");
        const selectLivro = document.getElementById("select-livro-capitulo");
        const selectLivroPersonagem = document.getElementById("select-livro-personagem");
        const selectLivroGaleria = document.getElementById("select-livro-galeria");
        const livroCapituloSelecionado = selectLivro?.value || "";
        const livroPersonagemSelecionado = selectLivroPersonagem?.value || "";
        const livroGaleriaSelecionado = selectLivroGaleria?.value || "";

        if (tbody) tbody.innerHTML = "";
        if (selectLivro) selectLivro.innerHTML = '<option value="">Selecione a Obra...</option>';
        if (selectLivroPersonagem) selectLivroPersonagem.innerHTML = '<option value="">Selecione a Obra...</option>';
        if (selectLivroGaleria) selectLivroGaleria.innerHTML = '<option value="">Selecione a Obra...</option>';

        const obrasLegadas = [];
        snapshot.forEach((docSnap) => {
            const id = docSnap.id;
            const livro = docSnap.data();
            if (!livro.autorId && usuarioAtual?.email === LEGACY_OWNER_EMAIL) obrasLegadas.push(docSnap.ref);
            const podeGerenciar = perfilAtual === "admin" || livro.autorId === usuarioAtual?.uid || (!livro.autorId && usuarioAtual?.email === LEGACY_OWNER_EMAIL);
            if (!podeGerenciar) return;

            if (tbody) {
                const tr = document.createElement("tr");
                tr.dataset.search = normalizarBusca(`${livro.titulo || ""} ${livro.genero || ""} ${livro.status || ""}`);
                const capaSegura = safeUrl(livro.capa);
                tr.innerHTML = `
                    <td>${capaSegura ? `<img src="${capaSegura}" alt="Capa de ${escapeHtml(livro.titulo || "obra")}" style="width: 45px; height: 55px; object-fit: cover; border-radius: 4px;">` : '<span aria-label="Sem capa">—</span>'}</td>
                    <td><strong>${escapeHtml(livro.titulo || "Sem título")}</strong><br><span style="color:#737373; font-size:0.8rem;">${escapeHtml(livro.status || 'Pendente')}</span></td>
                    <td>${escapeHtml(livro.genero || 'Não informado')}</td>
                    <td style="text-align: right;">
                        <button class="btn-editar" data-id="${id}" style="background: #332C4D; color: #FFF; border: none; padding: 6px 12px; margin-right: 8px; border-radius: 4px; cursor: pointer;">Editar</button>
                        <button class="btn-excluir" data-id="${id}" style="background: #F97316; color: #FFF; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer;">Excluir</button>
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

        if (obrasLegadas.length && usuarioAtual?.uid) {
            const batch = writeBatch(db);
            obrasLegadas.forEach(ref => batch.update(ref, { autorId: usuarioAtual.uid, atualizadoEm: new Date().toISOString() }));
            batch.commit().catch(err => console.error("Erro ao atribuir obras legadas:", err));
        }

        livrosCache = snapshot.docs.map(d => ({ id: d.id, ...d.data() })).filter(livro =>
            perfilAtual === "admin" || livro.autorId === usuarioAtual?.uid || (!livro.autorId && usuarioAtual?.email === LEGACY_OWNER_EMAIL)
        );
        if (selectLivro && [...selectLivro.options].some(option => option.value === livroCapituloSelecionado)) selectLivro.value = livroCapituloSelecionado;
        if (selectLivroPersonagem && [...selectLivroPersonagem.options].some(option => option.value === livroPersonagemSelecionado)) {
            selectLivroPersonagem.value = livroPersonagemSelecionado;
            carregarCapitulosParaPersonagem(livroPersonagemSelecionado);
        }
        if (selectLivroGaleria && [...selectLivroGaleria.options].some(option => option.value === livroGaleriaSelecionado)) selectLivroGaleria.value = livroGaleriaSelecionado;
        atualizarUIUniversos();
        oferecerRecuperacaoRascunho();
        atualizarFiltroObras();

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
                document.getElementById("status-obra").value = normalizeBookStatus(livro.status);
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
            if (await confirmAction({ title: "Remover obra?", message: "A obra e todos os seus vínculos serão removidos. Esta ação não pode ser desfeita.", confirmLabel: "Remover obra" })) {
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
        showToast("Selecione uma imagem de capa.", "info");
        return;
    }

    // Captura as tags selecionadas no grid
    const tagsSelecionadas = [];
    document.querySelectorAll(".tag-checkbox:checked").forEach(cb => {
        tagsSelecionadas.push(cb.value);
    });

    setButtonBusy(btnSubmit, true, arquivoCapa ? "Enviando capa..." : "Salvando obra...");

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
            showToast("Configurações do livro atualizadas com sucesso!", "success");
            idLivroEdicao = null;
        } else {
            dados.autorId = usuarioAtual.uid;
            dados.criadoPor = usuarioAtual.uid;
            dados.data_criacao = new Date().toISOString();
            await addDoc(collection(db, "livros"), dados);
            showToast("Nova obra catalogada com sucesso!", "success");
        }

        setButtonBusy(btnSubmit, false);
        btnSubmit.innerText = "Salvar Livro";
        e.target.reset();
        document.querySelectorAll(".tag-checkbox").forEach(cb => cb.checked = false);
        document.getElementById("preview-wrapper-capa").style.display = "none";
        document.getElementById("universo-atual-label").innerText = "Nenhum — vincule na aba Universos";
    } catch (err) {
        console.error(err);
        showToast("Erro ao salvar a obra. Verifique sua conexão e tente novamente.", "error");
    } finally {
        setButtonBusy(btnSubmit, false);
    }
});

// =====================================================
// CRUD DE CAPÍTULOS
// =====================================================

let idCapituloEdicao = null;
let unsubscribeCapitulos = null;
let rascunhoRecuperado = false;
let temporizadorRascunho = null;

function chaveRascunhoCapitulo() {
    return usuarioAtual?.uid ? `aurora-codex:rascunho-capitulo:${usuarioAtual.uid}` : null;
}

function normalizarBusca(value) {
    return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function atualizarFiltroObras() {
    const tbody = document.getElementById("tabela-gerenciar-livros");
    const contador = document.getElementById("contador-obras");
    const estado = document.getElementById("estado-filtro-obras");
    if (!tbody) return;
    const termo = normalizarBusca(document.getElementById("busca-obras")?.value.trim());
    const rows = [...tbody.querySelectorAll("tr[data-search]")];
    const filtradas = rows.filter(row => !termo || row.dataset.search.includes(termo));
    const totalPaginas = Math.max(1, Math.ceil(filtradas.length / OBRAS_POR_PAGINA));
    paginaAtualObras = Math.min(Math.max(1, paginaAtualObras), totalPaginas);
    const inicio = (paginaAtualObras - 1) * OBRAS_POR_PAGINA;
    const fim = Math.min(inicio + OBRAS_POR_PAGINA, filtradas.length);
    const pagina = new Set(filtradas.slice(inicio, fim));
    rows.forEach(row => { row.hidden = !pagina.has(row); });

    if (contador) contador.textContent = filtradas.length
        ? `Exibindo ${inicio + 1}–${fim} de ${filtradas.length} obra${filtradas.length === 1 ? "" : "s"}`
        : `0 de ${rows.length} obras`;
    if (estado) {
        estado.hidden = filtradas.length > 0;
        estado.textContent = rows.length === 0 ? "Nenhuma obra cadastrada ainda." : "Nenhuma obra corresponde a esta busca.";
    }
    const anterior = document.getElementById("pagina-obras-anterior");
    const proxima = document.getElementById("pagina-obras-proxima");
    const statusPagina = document.getElementById("pagina-obras-status");
    if (anterior) anterior.disabled = paginaAtualObras <= 1 || filtradas.length === 0;
    if (proxima) proxima.disabled = paginaAtualObras >= totalPaginas || filtradas.length === 0;
    if (statusPagina) statusPagina.textContent = filtradas.length ? `Página ${paginaAtualObras} de ${totalPaginas}` : "Sem páginas";
}

function mudarPaginaObras(delta) {
    paginaAtualObras += delta;
    atualizarFiltroObras();
}

function atualizarStatusRascunho(message) {
    const status = document.getElementById("status-rascunho-local");
    if (status) status.textContent = message;
}

function lerRascunhoLocal() {
    const chave = chaveRascunhoCapitulo();
    if (!chave) return null;
    try { return JSON.parse(localStorage.getItem(chave) || "null"); } catch { return null; }
}

function limparRascunhoLocal() {
    window.clearTimeout(temporizadorRascunho);
    const chave = chaveRascunhoCapitulo();
    if (chave) localStorage.removeItem(chave);
    atualizarStatusRascunho("Rascunho local limpo.");
}

function salvarRascunhoLocal() {
    const chave = chaveRascunhoCapitulo();
    const editor = document.getElementById("conteudo-capitulo");
    if (!chave || !editor) return;
    const conteudo = editor.innerHTML.trim();
    const titulo = document.getElementById("titulo-capitulo")?.value.trim() || "";
    if (!conteudo && !titulo) return;
    const dadosRascunho = {
        livroId: document.getElementById("select-livro-capitulo")?.value || "",
        capituloId: idCapituloEdicao,
        numero: document.getElementById("numero-capitulo")?.value || "",
        titulo,
        status: document.getElementById("status-capitulo")?.value || "publicado",
        dataAgendamento: document.getElementById("data-agendamento-capitulo")?.value || "",
        corCena: document.getElementById("cor-cena-capitulo")?.value || "#f97316",
        conteudo,
        salvoEm: new Date().toISOString()
    };
    try {
        localStorage.setItem(chave, JSON.stringify(dadosRascunho));
    } catch {
        atualizarStatusRascunho("Não foi possível salvar o rascunho neste navegador.");
        return;
    }
    const horario = new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    atualizarStatusRascunho(`Rascunho salvo neste navegador às ${horario}.`);
}

function agendarRascunhoLocal() {
    window.clearTimeout(temporizadorRascunho);
    atualizarStatusRascunho("Salvando rascunho local...");
    temporizadorRascunho = window.setTimeout(salvarRascunhoLocal, 700);
}

async function oferecerRecuperacaoRascunho() {
    if (rascunhoRecuperado) return;
    rascunhoRecuperado = true;
    const rascunho = lerRascunhoLocal();
    if (!rascunho?.conteudo && !rascunho?.titulo) return;
    const recuperar = await confirmAction({
        title: "Recuperar rascunho local?",
        message: "Há um capítulo não salvo neste navegador. Você pode recuperá-lo agora ou mantê-lo para depois.",
        confirmLabel: "Recuperar rascunho",
        cancelLabel: "Agora não"
    });
    if (!recuperar) {
        atualizarStatusRascunho("Rascunho mantido neste navegador para recuperação posterior.");
        return;
    }

    const selectLivro = document.getElementById("select-livro-capitulo");
    if (rascunho.livroId && [...selectLivro.options].some(option => option.value === rascunho.livroId)) {
        selectLivro.value = rascunho.livroId;
        carregarCapitulosDaObra(rascunho.livroId);
    }
    idCapituloEdicao = rascunho.capituloId || null;
    document.getElementById("numero-capitulo").value = rascunho.numero || "";
    document.getElementById("titulo-capitulo").value = rascunho.titulo || "";
    document.getElementById("status-capitulo").value = rascunho.status || "publicado";
    document.getElementById("data-agendamento-capitulo").value = rascunho.dataAgendamento || "";
    atualizarCampoAgendamento();
    document.getElementById("cor-cena-capitulo").value = rascunho.corCena || "#f97316";
    document.getElementById("conteudo-capitulo").innerHTML = rascunho.conteudo || "";
    const texto = document.getElementById("conteudo-capitulo").innerText.trim();
    document.getElementById("contador-palavras").innerText = texto ? texto.split(/\s+/).length : 0;
    const botaoSalvar = document.getElementById("btn-submit-capitulo");
    botaoSalvar.innerText = idCapituloEdicao
        ? (rascunho.status === "rascunho" ? "Atualizar Rascunho" : "Atualizar Capítulo")
        : (rascunho.status === "rascunho" ? "Salvar Rascunho" : "Publicar Capítulo");
    document.getElementById("btn-cancelar-edicao-capitulo").style.display = idCapituloEdicao ? "inline-block" : "none";
    atualizarRotuloObraEditor();
    atualizarStatusRascunho("Rascunho recuperado. Salve o capítulo para confirmar as alterações.");
    document.querySelector('[onclick="alternarAba(\'aba-capitulos\')"]')?.click();
}

function inicializarDadosCapitulos() {
    const selectLivro = document.getElementById("select-livro-capitulo");
    if (!selectLivro) return;

    selectLivro.addEventListener("change", () => {
        resetarFormularioCapitulo(); // evita salvar edição de um capítulo de outra obra por engano
        carregarCapitulosDaObra(selectLivro.value);
        atualizarRotuloObraEditor();
    });

    document.getElementById("form-cadastrar-capitulo")?.addEventListener("input", agendarRascunhoLocal);
    window.addEventListener("pagehide", salvarRascunhoLocal);

    document.getElementById("btn-cancelar-edicao-capitulo")?.addEventListener("click", async () => {
        const descartar = await confirmAction({ title: "Descartar alterações?", message: "O texto não salvo deste capítulo será removido deste navegador.", confirmLabel: "Descartar alterações" });
        if (!descartar) return;
        limparRascunhoLocal();
        resetarFormularioCapitulo();
    });

    document.getElementById("status-capitulo")?.addEventListener("change", (e) => {
        const btn = document.getElementById("btn-submit-capitulo");
        if (!btn) return;
        const editando = !!idCapituloEdicao;
        atualizarCampoAgendamento();
        if (e.target.value === "rascunho") {
            btn.innerText = editando ? "Atualizar Rascunho" : "Salvar Rascunho";
        } else if (e.target.value === "agendado") {
            btn.innerText = editando ? "Atualizar Agendamento" : "Agendar Publicação";
        } else {
            btn.innerText = editando ? "Atualizar Capítulo" : "Publicar Capítulo";
        }
    });
    document.getElementById("data-agendamento-capitulo")?.addEventListener("change", event => {
        const status = document.getElementById("status-capitulo");
        if (!status) return;
        status.value = event.target.value ? "agendado" : "rascunho";
        status.dispatchEvent(new Event("change"));
    });
    atualizarCampoAgendamento();
}

function atualizarCampoAgendamento() {
    const grupo = document.getElementById("grupo-agendamento-capitulo");
    const campo = document.getElementById("data-agendamento-capitulo");
    const agendado = document.getElementById("status-capitulo")?.value === "agendado";
    if (grupo) grupo.hidden = false;
    if (campo) campo.required = agendado;
}

function isoParaDataLocal(valor) {
    const data = valor ? new Date(valor) : null;
    if (!data || Number.isNaN(data.getTime())) return "";
    const local = new Date(data.getTime() - data.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 16);
}

// Mostra o nome da obra selecionada no topo do editor (estilo "estúdio")
function atualizarRotuloObraEditor() {
    const label = document.getElementById("editor-obra-label");
    const select = document.getElementById("select-livro-capitulo");
    if (!label || !select) return;

    const opcaoSelecionada = select.options[select.selectedIndex];
    label.innerText = (opcaoSelecionada && opcaoSelecionada.value) ? opcaoSelecionada.text : "Selecione a obra abaixo";
}

function resetarFormularioCapitulo() {
    idCapituloEdicao = null;
    const form = document.getElementById("form-cadastrar-capitulo");
    if (form) {
        const idLivroAtual = document.getElementById("select-livro-capitulo").value;
        form.reset();
        document.getElementById("select-livro-capitulo").value = idLivroAtual;

        const editor = document.getElementById("conteudo-capitulo");
        if (editor) editor.innerHTML = "";

        const capaInput = document.getElementById("capa-capitulo");
        if (capaInput) capaInput.value = "";
        const wrapperCapaCapitulo = document.getElementById("preview-wrapper-capa-capitulo");
        if (wrapperCapaCapitulo) wrapperCapaCapitulo.style.display = "none";
        const progressoCapaCapitulo = document.getElementById("progresso-upload-capa-capitulo");
        if (progressoCapaCapitulo) progressoCapaCapitulo.innerText = "";

        const tipoTrilha = document.getElementById("tipo-trilha-capitulo");
        if (tipoTrilha) tipoTrilha.value = "link";
        const campoTrilhaLink = document.getElementById("campo-trilha-link");
        const campoTrilhaUpload = document.getElementById("campo-trilha-upload");
        if (campoTrilhaLink) campoTrilhaLink.style.display = "block";
        if (campoTrilhaUpload) campoTrilhaUpload.style.display = "none";
        const trilhaUploadInput = document.getElementById("trilha-sonora-upload");
        if (trilhaUploadInput) trilhaUploadInput.value = "";
        const progressoTrilha = document.getElementById("progresso-upload-trilha");
        if (progressoTrilha) progressoTrilha.innerText = "";

        const corInput = document.getElementById("cor-cena-capitulo");
        if (corInput) corInput.value = "#f97316";

        const statusSelect = document.getElementById("status-capitulo");
        if (statusSelect) statusSelect.value = "publicado";
        const dataAgendamento = document.getElementById("data-agendamento-capitulo");
        if (dataAgendamento) dataAgendamento.value = "";
        atualizarCampoAgendamento();

        form.querySelector(".btn-submit").innerText = "Publicar Capítulo";
        document.getElementById("contador-palavras").innerText = "0";

        const btnCancelar = document.getElementById("btn-cancelar-edicao-capitulo");
        if (btnCancelar) btnCancelar.style.display = "none";

        atualizarRotuloObraEditor();
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

        const agendadosVencidos = snapshot.docs.filter(registro => {
            const capitulo = registro.data();
            return capitulo.status === "agendado" && capitulo.data_agendamento && new Date(capitulo.data_agendamento).getTime() <= Date.now();
        });
        if (agendadosVencidos.length) {
            const batch = writeBatch(db);
            agendadosVencidos.forEach(registro => batch.update(registro.ref, { status: "publicado", data_publicacao: new Date().toISOString() }));
            batch.commit().catch(erro => console.error("Erro ao concluir publicações programadas:", erro));
        }

        if (snapshot.empty) {
            listaContainer.innerHTML = '<p style="color:#737373; font-size:0.9rem;">Nenhum capítulo publicado para esta obra ainda.</p>';
            return;
        }

        snapshot.forEach((docSnap) => {
            const cap = docSnap.data();
            const id = docSnap.id;

            const item = document.createElement("div");
            item.style.cssText = "display:flex; justify-content:space-between; align-items:center; background:#1E1A30; border:1px solid #332C4D; border-radius:6px; padding:12px 15px; margin-bottom:10px;";
            item.innerHTML = `
                <div>
                    <span style="color:#F97316; font-weight:600; margin-right:10px;">Cap. ${cap.numero}</span>
                    <strong style="color:#FFF;">${cap.titulo}</strong>
                    ${cap.status === 'rascunho' ? '<span class="badge-rascunho-capitulo">Rascunho</span>' : ''}
                    ${cap.status === 'agendado' ? `<span class="badge-rascunho-capitulo">Agendado para ${new Date(cap.data_agendamento).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</span>` : ''}
                </div>
                <div>
                    <button class="btn-editar-capitulo" data-id="${id}" style="background:#332C4D; color:#FFF; border:none; padding:6px 12px; margin-right:8px; border-radius:4px; cursor:pointer;">Editar</button>
                    <button class="btn-excluir-capitulo" data-id="${id}" style="background:#F97316; color:#FFF; border:none; padding:6px 12px; border-radius:4px; cursor:pointer;">Excluir</button>
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
                document.getElementById("cor-cena-capitulo").value = cap.corCena || "#f97316";
                document.getElementById("status-capitulo").value = ["rascunho", "agendado"].includes(cap.status) ? cap.status : "publicado";
                document.getElementById("data-agendamento-capitulo").value = isoParaDataLocal(cap.data_agendamento);
                atualizarCampoAgendamento();

                // Capa do capítulo: guarda a URL já existente e mostra o preview
                document.getElementById("capa-capitulo").value = cap.capa || "";
                document.getElementById("arquivo-capa-capitulo").value = "";
                const wrapperCapaCapitulo = document.getElementById("preview-wrapper-capa-capitulo");
                if (cap.capa) {
                    document.getElementById("preview-capa-capitulo").src = cap.capa;
                    wrapperCapaCapitulo.style.display = "block";
                    document.getElementById("progresso-upload-capa-capitulo").innerText = "Imagem atual (envie um novo arquivo para substituir)";
                } else {
                    wrapperCapaCapitulo.style.display = "none";
                }

                // Trilha sonora: detecta se é um áudio que fizemos upload (Cloudinary) ou um link externo
                const trilhaAtual = cap.trilhaSonora || "";
                const ehUploadProprio = trilhaAtual.includes("res.cloudinary.com");
                document.getElementById("tipo-trilha-capitulo").value = ehUploadProprio ? "upload" : "link";
                document.getElementById("campo-trilha-link").style.display = ehUploadProprio ? "none" : "block";
                document.getElementById("campo-trilha-upload").style.display = ehUploadProprio ? "block" : "none";
                document.getElementById("trilha-sonora").value = ehUploadProprio ? "" : trilhaAtual;
                document.getElementById("trilha-sonora-upload").value = ehUploadProprio ? trilhaAtual : "";
                document.getElementById("arquivo-trilha-capitulo").value = "";
                document.getElementById("progresso-upload-trilha").innerText = ehUploadProprio ? "Áudio atual (envie um novo arquivo para substituir)" : "";

                // Conteúdo pode ter sido salvo como HTML (editor rico) ou como texto puro (capítulos antigos)
                const editor = document.getElementById("conteudo-capitulo");
                const conteudoBruto = cap.conteudo || "";
                const pareceHtml = /<\/?[a-z][\s\S]*>/i.test(conteudoBruto);
                editor.innerHTML = pareceHtml
                    ? conteudoBruto
                    : conteudoBruto.split(/\r?\n/).map(l => l.trim() === "" ? "" : `<p>${l}</p>`).join("");

                const textoPlano = (editor.innerText || "").trim();
                document.getElementById("contador-palavras").innerText = textoPlano === "" ? 0 : textoPlano.split(/\s+/).length;

                document.getElementById("form-cadastrar-capitulo").querySelector(".btn-submit").innerText = cap.status === "rascunho"
                    ? "Atualizar Rascunho"
                    : cap.status === "agendado" ? "Atualizar Agendamento" : "Atualizar Capítulo";
                const btnCancelar = document.getElementById("btn-cancelar-edicao-capitulo");
                if (btnCancelar) btnCancelar.style.display = "inline-block";

                document.getElementById("titulo-capitulo").scrollIntoView({ behavior: "smooth" });
            }
        });
    });

    document.querySelectorAll(".btn-excluir-capitulo").forEach(btn => {
        btn.addEventListener("click", async (e) => {
            const id = e.target.getAttribute("data-id");
            if (await confirmAction({ title: "Excluir capítulo?", message: "O capítulo será excluído permanentemente. Esta ação não pode ser desfeita.", confirmLabel: "Excluir capítulo" })) {
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
        showToast("Selecione a obra à qual este capítulo pertence.", "info");
        return;
    }

    const editorConteudo = document.getElementById("conteudo-capitulo");
    const conteudoHtml = editorConteudo ? editorConteudo.innerHTML.trim() : "";

    if (!conteudoHtml) {
        showToast("Escreva o conteúdo do capítulo antes de salvar.", "info");
        return;
    }

    const btnSubmit = e.target.querySelector(".btn-submit");
    setButtonBusy(btnSubmit, true, "Salvando capítulo...");

    try {
        // 1) Capa do capítulo: só faz upload se um novo arquivo foi escolhido
        let urlCapaFinal = document.getElementById("capa-capitulo").value || "";
        const arquivoCapaCapitulo = document.getElementById("arquivo-capa-capitulo").files[0];
        if (arquivoCapaCapitulo) {
            urlCapaFinal = await uploadArquivo(arquivoCapaCapitulo, "capitulos", "progresso-upload-capa-capitulo", "image");
        }

        // 2) Trilha sonora: link digitado OU arquivo de áudio enviado
        const tipoTrilha = document.getElementById("tipo-trilha-capitulo").value;
        let trilhaFinal = "";
        if (tipoTrilha === "upload") {
            trilhaFinal = document.getElementById("trilha-sonora-upload").value || "";
            const arquivoTrilha = document.getElementById("arquivo-trilha-capitulo").files[0];
            if (arquivoTrilha) {
                trilhaFinal = await uploadArquivo(arquivoTrilha, "trilhas", "progresso-upload-trilha", "video");
            }
        } else {
            trilhaFinal = document.getElementById("trilha-sonora").value || "";
        }

        const statusCapitulo = document.getElementById("status-capitulo").value || "publicado";
        const dataAgendamentoLocal = document.getElementById("data-agendamento-capitulo")?.value || "";
        if (statusCapitulo === "agendado" && new Date(dataAgendamentoLocal).getTime() <= Date.now()) {
            throw new Error("Escolha uma data futura para o agendamento.");
        }

        const capituloDados = {
            numero: parseFloat(document.getElementById("numero-capitulo").value),
            titulo: document.getElementById("titulo-capitulo").value,
            trilhaSonora: trilhaFinal,
            capa: urlCapaFinal,
            corCena: document.getElementById("cor-cena-capitulo").value || "#f97316",
            status: statusCapitulo,
            data_agendamento: statusCapitulo === "agendado" ? new Date(dataAgendamentoLocal).toISOString() : null,
            conteudo: sanitizeRichHtml(conteudoHtml)
        };

        if (idCapituloEdicao) {
            await updateDoc(doc(db, "livros", idLivro, "capitulos", idCapituloEdicao), capituloDados);
            showToast(`Capítulo ${capituloDados.numero} atualizado com sucesso!`, "success");
        } else {
            capituloDados.data_publicacao = statusCapitulo === "agendado" ? null : new Date().toISOString();
            await addDoc(collection(db, "livros", idLivro, "capitulos"), capituloDados);
            showToast(statusCapitulo === "agendado" ? `Capítulo ${capituloDados.numero} agendado com sucesso!` : `Capítulo ${capituloDados.numero} publicado no Codex!`, "success");
        }
        limparRascunhoLocal();
        resetarFormularioCapitulo();
    } catch (err) {
        console.error(err);
        showToast("Erro ao salvar capítulo. " + (err && err.message ? err.message : ""), "error", 6500);
    } finally {
        setButtonBusy(btnSubmit, false);
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
        carregarCapitulosParaPersonagem(selectLivroPersonagem.value);
    });
}

async function carregarCapitulosParaPersonagem(livroId, selecionados = []) {
    const container = document.getElementById("capitulos-personagem");
    if (!container) return;
    container.replaceChildren();
    if (!livroId) return;
    const estado = document.createElement("p");
    estado.className = "chapter-appearance-empty";
    estado.textContent = "Carregando capítulos...";
    container.appendChild(estado);
    try {
        const snapshot = await getDocs(collection(db, "livros", livroId, "capitulos"));
        const capitulos = snapshot.docs
            .map(registro => ({ id: registro.id, ...registro.data() }))
            .sort((a, b) => Number(a.numero || 0) - Number(b.numero || 0));
        container.replaceChildren();
        if (!capitulos.length) {
            estado.textContent = "Esta obra ainda não possui capítulos cadastrados.";
            container.appendChild(estado);
            return;
        }
        capitulos.forEach(capitulo => {
            const label = document.createElement("label");
            label.className = "chapter-appearance-option";
            const checkbox = document.createElement("input");
            checkbox.type = "checkbox";
            checkbox.name = "capitulos-personagem";
            checkbox.value = capitulo.id;
            checkbox.dataset.numero = String(capitulo.numero ?? "");
            checkbox.checked = selecionados.includes(capitulo.id);
            const texto = document.createElement("span");
            texto.textContent = `Capítulo ${capitulo.numero || "?"} — ${capitulo.titulo || "Sem título"}`;
            label.append(checkbox, texto);
            container.appendChild(label);
        });
    } catch (erro) {
        console.error("Erro ao carregar capítulos do personagem:", erro);
        estado.textContent = "Não foi possível carregar os capítulos. Tente selecionar a obra novamente.";
        container.replaceChildren(estado);
    }
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
            card.style.cssText = "display:flex; gap:15px; align-items:center; background:#1E1A30; border:1px solid #332C4D; border-radius:6px; padding:12px; margin-bottom:10px;";
            card.innerHTML = `
                <img src="${p.foto || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?q=80&w=100'}" style="width:48px; height:48px; object-fit:cover; border-radius:4px;">
                <div style="flex-grow:1;">
                    <strong style="color:#FFF;">${p.nome}</strong>
                    <p style="color:#8C8C8C; font-size:0.8rem;">${p.papel || p.funcao || 'Sem papel definido'}${p.primeiraAparicao ? ' • ' + p.primeiraAparicao : ''}${Array.isArray(p.capitulosAparicao) ? ` • ${p.capitulosAparicao.length} capítulo(s)` : ''}</p>
                </div>
                <button class="btn-editar-personagem" data-id="${id}" style="background:#332C4D; color:#FFF; border:none; padding:6px 12px; margin-right:8px; border-radius:4px; cursor:pointer;">Editar</button>
                <button class="btn-excluir-personagem" data-id="${id}" style="background:#F97316; color:#FFF; border:none; padding:6px 12px; border-radius:4px; cursor:pointer;">Excluir</button>
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
                await carregarCapitulosParaPersonagem(livroId, Array.isArray(p.capitulosAparicao) ? p.capitulosAparicao : []);
                document.getElementById("url-avatar-personagem").value = p.foto || "";
                document.getElementById("arquivo-avatar-personagem").value = "";
                if (p.foto) {
                    document.getElementById("preview-avatar-personagem").src = p.foto;
                    document.getElementById("preview-wrapper-personagem").style.display = "block";
                    document.getElementById("progresso-upload-personagem").innerText = "Foto atual (envie um novo arquivo para substituir)";
                }
                document.getElementById("descricao-personagem").value = p.descricao;
                document.getElementById("subtitulo-personagem").value = p.subtitulo || "";
                document.getElementById("dados-personagem").value = p.dados || "";
                document.getElementById("citacao-personagem").value = p.citacao || "";
                document.getElementById("tracos-personagem").value = Array.isArray(p.tracos) ? p.tracos.join("\n") : (p.tracos || "");
                document.getElementById("segredos-personagem").value = Array.isArray(p.segredos) ? p.segredos.join("\n") : (p.segredos || "");
                document.getElementById("manias-personagem").value = p.manias || "";

                document.getElementById("form-cadastrar-personagem").querySelector(".btn-submit").innerText = "Atualizar Personagem";
                document.getElementById("nome-personagem").scrollIntoView({ behavior: "smooth" });
            }
        });
    });

    document.querySelectorAll(".btn-excluir-personagem").forEach(btn => {
        btn.addEventListener("click", async (e) => {
            const id = e.target.getAttribute("data-id");
            if (await confirmAction({ title: "Remover personagem?", message: "O personagem será removido desta obra.", confirmLabel: "Remover personagem" })) {
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
        showToast("Selecione a obra à qual este personagem pertence.", "info");
        return;
    }

    const btnSubmit = e.target.querySelector(".btn-submit");
    const arquivoFoto = document.getElementById("arquivo-avatar-personagem").files[0];

    setButtonBusy(btnSubmit, true, arquivoFoto ? "Enviando imagem..." : "Salvando personagem...");

    try {
        let urlFotoFinal = document.getElementById("url-avatar-personagem").value;

        if (arquivoFoto) {
            urlFotoFinal = await uploadImagem(arquivoFoto, "personagens", "progresso-upload-personagem");
        }

        const opcoesSelecionadas = [...document.querySelectorAll('input[name="capitulos-personagem"]:checked')];
        const capitulosAparicao = opcoesSelecionadas.map(option => option.value);
        if (!capitulosAparicao.length) throw new Error("Selecione ao menos um capítulo em que o personagem aparece.");
        const primeiraOpcao = [...opcoesSelecionadas].sort((a, b) => Number(a.dataset.numero) - Number(b.dataset.numero))[0];
        const primeiraAparicaoInformada = document.getElementById("primeira-aparicao-personagem").value.trim();
        const primeiraAparicao = primeiraAparicaoInformada || `Capítulo ${primeiraOpcao?.dataset.numero || ""}`;

        const dadosPersonagem = {
            nome: document.getElementById("nome-personagem").value,
            papel: document.getElementById("papel-personagem").value,
            primeiraAparicao,
            capitulosAparicao,
            foto: urlFotoFinal,
            descricao: document.getElementById("descricao-personagem").value,
            subtitulo: document.getElementById("subtitulo-personagem").value.trim(),
            dados: document.getElementById("dados-personagem").value.trim(),
            citacao: document.getElementById("citacao-personagem").value.trim(),
            tracos: document.getElementById("tracos-personagem").value.split(/\r?\n/).map(item => item.trim()).filter(Boolean),
            segredos: document.getElementById("segredos-personagem").value.split(/\r?\n/).map(item => item.trim()).filter(Boolean),
            manias: document.getElementById("manias-personagem").value.trim()
        };

        if (idPersonagemEdicao) {
            await updateDoc(doc(db, "livros", livroId, "personagens", idPersonagemEdicao), dadosPersonagem);
            showToast("Personagem atualizado com sucesso!", "success");
            idPersonagemEdicao = null;
            setButtonBusy(btnSubmit, false);
            btnSubmit.innerText = "Adicionar ao Códice";
        } else {
            await addDoc(collection(db, "livros", livroId, "personagens"), dadosPersonagem);
            showToast("Personagem adicionado ao Códice!", "success");
        }
        e.target.reset();
        document.getElementById("select-livro-personagem").value = livroId; // mantém a obra selecionada
        await carregarCapitulosParaPersonagem(livroId);
        document.getElementById("preview-wrapper-personagem").style.display = "none";
    } catch (err) {
        console.error(err);
        showToast(`Erro ao salvar personagem: ${err?.message || "tente novamente"}.`, "error", 6500);
    } finally {
        setButtonBusy(btnSubmit, false);
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
            if (perfilAtual === "admin") await setDoc(catalogoRef, CATALOGO_PADRAO);
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
        row.style.cssText = "display:flex; justify-content:space-between; align-items:center; padding:10px 14px; background:#1E1A30; border:1px solid #332C4D; border-radius:6px; margin-bottom:8px;";
        row.innerHTML = `
            <span style="color:#FFF; font-size:0.9rem;">${item}</span>
            <button type="button" style="background:transparent; border:none; color:#F97316; font-size:1.2rem; line-height:1; cursor:pointer; padding:0 4px;" title="Remover">&times;</button>
        `;
        row.querySelector("button").addEventListener("click", () => aoRemover(item));
        container.appendChild(row);
    });
}

async function removerGenero(nome) {
    if (!await confirmAction({ title: "Remover gênero?", message: `O gênero “${nome}” deixará de aparecer na lista de opções.`, confirmLabel: "Remover gênero" })) return;
    await updateDoc(doc(db, "configuracoes", "catalogo"), { generos: arrayRemove(nome) });
}

async function removerTag(nome) {
    if (!await confirmAction({ title: "Remover tag?", message: `A tag “${nome}” deixará de aparecer na lista de opções.`, confirmLabel: "Remover tag" })) return;
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
        const legados = snapshot.docs.filter(d => !d.data().criadoPor && usuarioAtual?.email === LEGACY_OWNER_EMAIL);
        universosCache = snapshot.docs.map(d => ({ id: d.id, ...d.data() })).filter(universo =>
            perfilAtual === "admin" || universo.criadoPor === usuarioAtual?.uid || (!universo.criadoPor && usuarioAtual?.email === LEGACY_OWNER_EMAIL)
        );
        if (legados.length && usuarioAtual?.uid) {
            const batch = writeBatch(db);
            legados.forEach(item => batch.update(item.ref, { criadoPor: usuarioAtual.uid, atualizadoEm: new Date().toISOString() }));
            batch.commit().catch(err => console.error("Erro ao atribuir universos legados:", err));
        }
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
        row.style.cssText = "display:flex; align-items:center; gap:12px; padding:12px; background:#1E1A30; border:1px solid #332C4D; border-radius:6px; margin-bottom:10px;";
        row.innerHTML = `
            <div style="width:40px; height:40px; border-radius:6px; background-color:${u.corTema || '#7c3aed'}; background-image:${u.capa ? `url('${u.capa}')` : 'none'}; background-size:cover; background-position:center; flex-shrink:0;"></div>
            <div style="flex-grow:1;">
                <strong style="color:#FFF;">${u.nome}</strong>
                <p style="color:#8C8C8C; font-size:0.8rem;">${qtdLivros} livro(s)</p>
            </div>
            <button type="button" class="btn-editar-universo" data-id="${u.id}" style="background:#332C4D; color:#FFF; border:none; padding:6px 12px; border-radius:4px; cursor:pointer;">Editar</button>
            <button type="button" class="btn-excluir-universo" data-id="${u.id}" style="background:#F97316; color:#FFF; border:none; padding:6px 12px; border-radius:4px; cursor:pointer;">Excluir</button>
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
    if (!await confirmAction({ title: "Excluir universo?", message: "Os livros vinculados não serão apagados, mas perderão a conexão com este universo.", confirmLabel: "Excluir universo" })) return;

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

    setButtonBusy(btnSubmit, true, arquivoCapa ? "Enviando capa..." : "Salvando universo...");

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
            dadosUniverso.criadoPor = usuarioAtual.uid;
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

        showToast(idUniversoEdicao ? "Universo atualizado com sucesso!" : "Universo criado com sucesso!", "success");
        setButtonBusy(btnSubmit, false);
        resetarFormularioUniverso();
    } catch (err) {
        console.error(err);
        showToast("Erro ao salvar universo.", "error");
    } finally {
        setButtonBusy(btnSubmit, false);
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

    unsubscribeGaleria = onSnapshot(galeriaRef, (snapshot) => {
        listaContainer.innerHTML = "";

        if (snapshot.empty) {
            listaContainer.innerHTML = '<p style="color:#737373; font-size:0.9rem;">Nenhum item cadastrado para esta obra ainda.</p>';
            return;
        }

        const registros = [...snapshot.docs].sort((a, b) => Number(a.data().ordem ?? 0) - Number(b.data().ordem ?? 0));
        registros.forEach((docSnap) => {
            const item = docSnap.data();
            const id = docSnap.id;

            const miniatura = item.tipo === "video"
                ? `<div style="width:56px; height:56px; border-radius:6px; background:#1E1A30; display:flex; align-items:center; justify-content:center; font-size:1.3rem;">▶</div>`
                : `<img src="${item.url}" style="width:56px; height:56px; object-fit:cover; border-radius:6px;">`;

            const row = document.createElement("div");
            row.style.cssText = "display:flex; gap:15px; align-items:center; background:#1E1A30; border:1px solid #332C4D; border-radius:6px; padding:12px; margin-bottom:10px;";
            row.innerHTML = `
                ${miniatura}
                <div style="flex-grow:1;">
                    <strong style="color:#FFF;">${item.titulo || '(sem título)'}</strong>
                    <p style="color:#8C8C8C; font-size:0.8rem;">${item.categoria} • Ordem ${item.ordem ?? 0}</p>
                </div>
                <button class="btn-editar-galeria" data-id="${id}" style="background:#332C4D; color:#FFF; border:none; padding:6px 12px; margin-right:8px; border-radius:4px; cursor:pointer;">Editar</button>
                <button class="btn-excluir-galeria" data-id="${id}" style="background:#F97316; color:#FFF; border:none; padding:6px 12px; border-radius:4px; cursor:pointer;">Excluir</button>
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
            if (await confirmAction({ title: "Excluir item da galeria?", message: "O item será removido permanentemente desta obra.", confirmLabel: "Excluir item" })) {
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
        showToast("Selecione o livro ao qual este item pertence.", "info");
        return;
    }

    const tipo = document.getElementById("tipo-galeria").value;
    const btnSubmit = e.target.querySelector(".btn-submit");
    setButtonBusy(btnSubmit, true, tipo === "imagem" ? "Salvando imagem..." : "Salvando vídeo...");

    try {
        let urlFinal = "";

        if (tipo === "imagem") {
            const arquivoImagem = document.getElementById("arquivo-imagem-galeria").files[0];
            urlFinal = document.getElementById("url-imagem-galeria").value;

            if (arquivoImagem) {
                urlFinal = await uploadImagem(arquivoImagem, "galeria", "progresso-upload-galeria");
            }

            if (!urlFinal) {
                showToast("Selecione uma imagem para adicionar.", "info");
                return;
            }
        } else {
            urlFinal = document.getElementById("url-video-galeria").value.trim();
            if (!urlFinal) {
                showToast("Informe a URL do vídeo do YouTube.", "info");
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
            showToast("Item atualizado com sucesso!", "success");
        } else {
            dadosItem.data_criacao = new Date().toISOString();
            await addDoc(collection(db, "livros", livroId, "galeria"), dadosItem);
            showToast("Item adicionado à galeria!", "success");
        }

        resetarFormularioGaleria();
    } catch (err) {
        console.error(err);
        showToast("Erro ao salvar item da galeria.", "error");
    } finally {
        setButtonBusy(btnSubmit, false);
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
        chip.style.cssText = `background:${marcado ? '#F97316' : 'rgba(255,255,255,0.05)'}; border:1px solid ${marcado ? '#F97316' : 'rgba(255,255,255,0.15)'}; color:#FFF; padding:6px 14px; border-radius:20px; font-size:0.85rem; cursor:pointer;`;
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
        row.style.cssText = "padding:12px; background:#1E1A30; border:1px solid #332C4D; border-radius:6px; margin-bottom:10px;";
        row.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:10px;">
                <div>
                    <strong style="color:#FFF;">${post.titulo || '(sem título)'}</strong>
                    <p style="color:#8C8C8C; font-size:0.8rem; margin-top:2px;">
                        ${post.tipo} • ${agendado ? 'Agendado para ' : 'Publicado em '}${dataFormatada}
                    </p>
                </div>
                <div style="display:flex; gap:8px; flex-shrink:0;">
                    <button class="btn-editar-oraculo" data-id="${post.id}" style="background:#332C4D; color:#FFF; border:none; padding:6px 12px; border-radius:4px; cursor:pointer;">Editar</button>
                    <button class="btn-excluir-oraculo" data-id="${post.id}" style="background:#F97316; color:#FFF; border:none; padding:6px 12px; border-radius:4px; cursor:pointer;">Excluir</button>
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
            if (await confirmAction({ title: "Excluir publicação?", message: "A publicação será removida permanentemente do Oráculo.", confirmLabel: "Excluir publicação" })) {
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

    setButtonBusy(btnSubmit, true, arquivoImagem ? "Enviando imagem..." : "Salvando publicação...");

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
                showToast("Escolha uma data para agendar a publicação.", "info");
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
            showToast("Publicação atualizada com sucesso!", "success");
        } else {
            dadosPost.data_criacao = new Date().toISOString();
            await addDoc(collection(db, "oraculo"), dadosPost);
            showToast(publicarAgora ? "Publicação criada com sucesso!" : "Publicação agendada com sucesso!", "success");
        }

        setButtonBusy(btnSubmit, false);
        resetarFormularioOraculo();
    } catch (err) {
        console.error(err);
        showToast("Erro ao salvar publicação.", "error");
    } finally {
        setButtonBusy(btnSubmit, false);
    }
});
