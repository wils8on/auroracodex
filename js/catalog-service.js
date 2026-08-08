import { collection, getDocs, onSnapshot, orderBy, query } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { db } from "./firebase.js";

function mapSnapshot(snapshot) {
    return snapshot.docs.map(item => ({ id: item.id, ...item.data() }));
}

export function subscribeBooks(callback, onError = console.error) {
    return onSnapshot(collection(db, "livros"), snapshot => callback(mapSnapshot(snapshot)), onError);
}

export function subscribeUniverses(callback, onError = console.error) {
    return onSnapshot(collection(db, "universos"), snapshot => callback(mapSnapshot(snapshot)), onError);
}

export function subscribeOraclePosts(callback, onError = console.error) {
    return onSnapshot(collection(db, "oraculo"), snapshot => callback(mapSnapshot(snapshot)), onError);
}

export async function loadBookChapters(bookId) {
    return mapSnapshot(await getDocs(query(collection(db, "livros", bookId, "capitulos"), orderBy("numero", "asc"))));
}

export async function loadBookCharacters(bookId) {
    return mapSnapshot(await getDocs(collection(db, "livros", bookId, "personagens")));
}

export async function loadBookGallery(bookId) {
    return mapSnapshot(await getDocs(query(collection(db, "livros", bookId, "galeria"), orderBy("ordem", "asc"))));
}
