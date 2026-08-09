import { after, before, beforeEach, describe, test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment
} from "@firebase/rules-unit-testing";
import { addDoc, collection, deleteDoc, doc, getDoc, getDocs, setDoc, updateDoc } from "firebase/firestore";

const projectId = "aurora-codex-rules-test";
let env;

before(async () => {
  env = await initializeTestEnvironment({
    projectId,
    firestore: { rules: await readFile("firestore.rules", "utf8") }
  });
});

after(async () => env?.cleanup());
beforeEach(async () => env.clearFirestore());

async function seed() {
  await env.withSecurityRulesDisabled(async context => {
    const db = context.firestore();
    await setDoc(doc(db, "usuarios/admin"), { perfil: "admin", email: "admin@example.com" });
    await setDoc(doc(db, "usuarios/autor1"), { perfil: "autor", email: "autor1@example.com" });
    await setDoc(doc(db, "usuarios/autor2"), { perfil: "autor", email: "autor2@example.com" });
    await setDoc(doc(db, "usuarios/leitor1"), { perfil: "leitor", email: "leitor1@example.com" });
    await setDoc(doc(db, "usuarios/leitor2"), { perfil: "leitor", email: "leitor2@example.com" });
    await setDoc(doc(db, "livros/livro1"), { titulo: "Livro", autorId: "autor1" });
    await setDoc(doc(db, "livros/livro1/capitulos/cap1"), { titulo: "Capítulo", curtidasUids: [] });
    await setDoc(doc(db, "progresso_leitura/leitor1_livro1"), { uid: "leitor1", livroId: "livro1" });
  });
}

function dbFor(uid, email = `${uid}@example.com`) {
  return env.authenticatedContext(uid, { email }).firestore();
}

describe("perfis", () => {
  test("novo usuário cria somente o próprio perfil pendente", async () => {
    const db = dbFor("novo");
    await assertSucceeds(setDoc(doc(db, "usuarios/novo"), { perfil: "pendente" }));
    await assertFails(setDoc(doc(db, "usuarios/outro"), { perfil: "pendente" }));
  });

  test("leitor não promove a si mesmo e admin pode alterar perfil", async () => {
    await seed();
    await assertFails(updateDoc(doc(dbFor("leitor1"), "usuarios/leitor1"), { perfil: "admin" }));
    await assertSucceeds(updateDoc(doc(dbFor("admin"), "usuarios/leitor1"), { perfil: "autor" }));
  });
});

describe("propriedade editorial", () => {
  test("autor altera somente a própria obra", async () => {
    await seed();
    await assertSucceeds(updateDoc(doc(dbFor("autor1"), "livros/livro1"), { titulo: "Minha edição" }));
    await assertFails(updateDoc(doc(dbFor("autor2"), "livros/livro1"), { titulo: "Invasão" }));
  });

  test("proprietário legado assume obra sem autorId", async () => {
    await seed();
    await env.withSecurityRulesDisabled(async context => setDoc(doc(context.firestore(), "livros/legado"), { titulo: "Legado" }));
    const legacyDb = dbFor("wilson", "wilsononole@gmail.com");
    await env.withSecurityRulesDisabled(async context => setDoc(doc(context.firestore(), "usuarios/wilson"), { perfil: "autor" }));
    await assertSucceeds(updateDoc(doc(legacyDb, "livros/legado"), { autorId: "wilson" }));
    await assertFails(updateDoc(doc(dbFor("autor2"), "livros/legado"), { autorId: "autor2" }));
  });
});

describe("leitura e atividade", () => {
  test("usuário lê apenas o próprio progresso; admin lê todos", async () => {
    await seed();
    const ref = "progresso_leitura/leitor1_livro1";
    await assertSucceeds(getDoc(doc(dbFor("leitor1"), ref)));
    await assertFails(getDoc(doc(dbFor("leitor2"), ref)));
    await assertSucceeds(getDoc(doc(dbFor("admin"), ref)));
  });

  test("leitor altera somente a própria curtida", async () => {
    await seed();
    const ref = doc(dbFor("leitor1"), "livros/livro1/capitulos/cap1");
    await assertSucceeds(updateDoc(ref, { curtidasUids: ["leitor1"] }));
    await assertFails(updateDoc(ref, { curtidasUids: ["leitor2"] }));
    await assertFails(updateDoc(ref, { titulo: "Alterado" }));
  });

  test("leitor aprovado publica comentario proprio dentro dos limites", async () => {
    await seed();
    const ref = collection(dbFor("leitor1"), "livros/livro1/capitulos/cap1/comentarios");
    await assertSucceeds(addDoc(ref, { uid: "leitor1", nome: "Leitor", foto: "", texto: "Gostei do capitulo.", criadoEm: new Date().toISOString() }));
    await assertFails(addDoc(ref, { uid: "leitor2", nome: "Leitor", foto: "", texto: "Identidade falsa", criadoEm: new Date().toISOString() }));
    await assertFails(addDoc(ref, { uid: "leitor1", nome: "Leitor", foto: "", texto: "x".repeat(1001), criadoEm: new Date().toISOString() }));
    await assertSucceeds(getDocs(ref));
  });

  test("autor do comentario e admin podem excluir; outro leitor nao pode", async () => {
    await seed();
    await env.withSecurityRulesDisabled(async context => {
      await setDoc(doc(context.firestore(), "livros/livro1/capitulos/cap1/comentarios/com1"), { uid: "leitor1", nome: "Leitor", foto: "", texto: "Comentario", criadoEm: new Date().toISOString() });
      await setDoc(doc(context.firestore(), "livros/livro1/capitulos/cap1/comentarios/com2"), { uid: "leitor2", nome: "Leitor", foto: "", texto: "Comentario", criadoEm: new Date().toISOString() });
    });
    await assertFails(deleteDoc(doc(dbFor("leitor2"), "livros/livro1/capitulos/cap1/comentarios/com1")));
    await assertSucceeds(deleteDoc(doc(dbFor("leitor1"), "livros/livro1/capitulos/cap1/comentarios/com1")));
    await assertSucceeds(deleteDoc(doc(dbFor("admin"), "livros/livro1/capitulos/cap1/comentarios/com2")));
  });
});
