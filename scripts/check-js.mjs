import { readdir } from "node:fs/promises";
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
    const result = spawnSync(process.execPath, ["--check", file], {
        encoding: "utf8"
    });

    if (result.status !== 0) {
        process.stderr.write(result.stderr || result.stdout);
        process.exit(result.status || 1);
    }
}

console.log(`Sintaxe validada em ${files.length} arquivos JavaScript.`);
