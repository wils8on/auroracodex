import { readFile, readdir } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";
import process from "node:process";

const roots = ["js"];
const files = [];

for (const root of roots) {
    const entries = await readdir(root, { withFileTypes: true });
    for (const entry of entries) {
        if (entry.isFile() && entry.name.endsWith(".js")) {
            files.push(path.join(root, entry.name));
        }
    }
}

for (const file of files.sort()) {
    const source = await readFile(file, "utf8");
    const result = spawnSync(process.execPath, ["--check", file], {
        encoding: "utf8"
    });

    if (result.status !== 0) {
        process.stderr.write(result.stderr || result.stdout);
        process.exit(result.status || 1);
    }

    const firestoreImport = source.match(/import\s*\{([^}]*)\}\s*from\s*["'][^"']*firebase-firestore\.js["']/);
    if (firestoreImport) {
        const imported = new Set(firestoreImport[1].split(",").map(name => name.trim()).filter(Boolean));
        const firestoreFunctions = [
            "addDoc", "arrayRemove", "arrayUnion", "collection", "deleteDoc", "doc",
            "getDoc", "getDocs", "limit", "onSnapshot", "orderBy", "query", "setDoc",
            "startAfter", "updateDoc", "where", "writeBatch"
        ];
        const missing = firestoreFunctions.filter(name => new RegExp(`\\b${name}\\s*\\(`).test(source) && !imported.has(name));
        if (missing.length) {
            console.error(`${file}: função(ões) do Firestore usada(s) sem importação: ${missing.join(", ")}`);
            process.exit(1);
        }
    }
}

console.log(`Sintaxe validada em ${files.length} arquivos JavaScript.`);
