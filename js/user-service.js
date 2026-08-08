import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { db } from "./firebase.js";

export const APPROVED_PROFILES = Object.freeze(["leitor", "autor", "admin"]);

export async function loadUserProfile(uid) {
    if (!uid) return null;
    const snapshot = await getDoc(doc(db, "usuarios", uid));
    return snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null;
}

export function hasProfile(profile, allowedProfiles) {
    return Boolean(profile && allowedProfiles.includes(profile.perfil));
}
