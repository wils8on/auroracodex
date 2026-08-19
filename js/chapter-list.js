export function renderChapterList({ container, chapters, bookId, background = "#2f2f2f", hoverBackground = "#3c3c3c" }) {
    if (!container) return;
    container.replaceChildren();
    const agora = Date.now();
    const visible = chapters.filter(chapter => chapter.status !== "rascunho" && (
        chapter.status !== "agendado" || (chapter.data_agendamento && new Date(chapter.data_agendamento).getTime() <= agora)
    ));
    if (!visible.length) {
        const empty = document.createElement("p");
        empty.style.color = "#737373";
        empty.textContent = "Nenhum capítulo publicado para esta obra ainda.";
        container.appendChild(empty);
        return;
    }
    visible.forEach(chapter => {
        const item = document.createElement("div");
        item.style.cssText = `background:${background}; padding:16px; border-radius:4px; display:flex; justify-content:space-between; align-items:center; cursor:pointer; transition:background 0.2s;`;
        item.tabIndex = 0;
        item.setAttribute("role", "link");
        const description = document.createElement("div");
        const number = document.createElement("span");
        number.style.cssText = "color:#F97316; font-weight:600; margin-right:10px;";
        number.textContent = `Episódio ${chapter.numero}`;
        const title = document.createElement("strong");
        title.style.color = "#FFF";
        title.textContent = chapter.titulo || "Sem título";
        description.append(number, title);
        const action = document.createElement("span");
        action.style.cssText = "color:#8C8C8C; font-size:0.85rem;";
        action.textContent = "Ler Agora →";
        item.append(description, action);
        const open = event => {
            event.stopPropagation();
            window.location.href = `ler.html?livroId=${encodeURIComponent(bookId)}&capituloId=${encodeURIComponent(chapter.id)}`;
        };
        item.addEventListener("click", open);
        item.addEventListener("keydown", event => { if (event.key === "Enter" || event.key === " ") open(event); });
        item.addEventListener("mouseenter", () => { item.style.background = hoverBackground; });
        item.addEventListener("mouseleave", () => { item.style.background = background; });
        container.appendChild(item);
    });
}
