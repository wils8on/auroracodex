import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { db } from "./firebase.js";

export function progressId(uid, bookId) {
    return `${uid}_${bookId}`;
}

export async function loadBookProgress(uid, bookId) {
    const snapshot = await getDoc(doc(db, "progresso_leitura", progressId(uid, bookId)));
    return snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null;
}

export async function saveFavorite(user, bookId, favorite) {
    await setDoc(doc(db, "progresso_leitura", progressId(user.uid, bookId)), {
        uid: user.uid,
        emailUsuario: user.email || "",
        nomeUsuario: user.displayName || "",
        livroId: bookId,
        favorito: favorite
    }, { merge: true });
}

export async function bindFavoriteButton({ button, user, bookId, render }) {
    if (!button || !user) return;

    let favorite = false;
    try {
        favorite = (await loadBookProgress(user.uid, bookId))?.favorito === true;
    } catch (error) {
        console.error("Erro ao verificar favorito:", error);
    }

    render(button, favorite);
    button.onclick = async event => {
        event.stopPropagation();
        const previous = favorite;
        favorite = !favorite;
        render(button, favorite);
        try {
            await saveFavorite(user, bookId, favorite);
        } catch (error) {
            favorite = previous;
            render(button, favorite);
            console.error("Erro ao favoritar:", error);
        }
    };
}
