// js/autor.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, collection, addDoc, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// Credenciais Oficiais do seu projeto
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

// Proteção da Página: Só Autores ou Admins podem usar este formulário
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = "../index.html";
    } else {
        const userDoc = await getDoc(doc(db, "usuarios", user.uid));
        if (!userDoc.exists() || (userDoc.data().perfil !== "autor" && userDoc.data().perfil !== "admin")) {
            alert("Acesso restrito a autores cadastrados.");
            window.location.href = "../dashboard.html";
        }
    }
});

// Captura o formulário e envia os dados para o Firestore
const form = document.getElementById("form-cadastrar-livro");
if (form) {
    form.addEventListener("submit", async (e) => {
        e.preventDefault(); // Impede a página de recarregar

        const titulo = document.getElementById("titulo").value;
        const universo = document.getElementById("universo").value;
        const urlCapa = document.getElementById("url-capa").value;
        const sinopse = document.getElementById("sinopse").value;

        try {
            // Salva na coleção "livros"
            await addDoc(collection(db, "livros"), {
                titulo: titulo,
                universo: universo,
                capa: urlCapa,
                sinopse: sinopse,
                data_criacao: new Date().toISOString()
            });

            alert(`"${titulo}" foi adicionado com sucesso ao catálogo!`);
            form.reset(); // Limpa as caixas de texto
            window.location.href = "../dashboard.html"; // Retorna para a home
        } catch (error) {
            console.error("Erro ao salvar o livro:", error);
            alert("Erro técnico ao salvar a obra. Verifique o console.");
        }
    });
}