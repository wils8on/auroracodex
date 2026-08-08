const ALLOWED_PROTOCOLS = new Set(["http:", "https:"]);

export function safeUrl(value, fallback = "") {
    if (!value) return fallback;
    try {
        const url = new URL(String(value), window.location.origin);
        return ALLOWED_PROTOCOLS.has(url.protocol) ? url.href : fallback;
    } catch { return fallback; }
}

export function escapeHtml(value) {
    const element = document.createElement("div");
    element.textContent = value == null ? "" : String(value);
    return element.innerHTML;
}

export function sanitizeRichHtml(value) {
    const template = document.createElement("template");
    template.innerHTML = value == null ? "" : String(value);
    const tags = new Set(["P", "BR", "STRONG", "B", "EM", "I", "U", "S", "BLOCKQUOTE", "UL", "OL", "LI", "H2", "H3", "H4", "A", "SPAN"]);
    for (const node of [...template.content.querySelectorAll("*")]) {
        if (!tags.has(node.tagName)) { node.replaceWith(...node.childNodes); continue; }
        const originalHref = node.tagName === "A" ? node.getAttribute("href") : "";
        for (const attr of [...node.attributes]) node.removeAttribute(attr.name);
        if (node.tagName === "A") {
            const href = safeUrl(originalHref);
            if (href) node.setAttribute("href", href);
            node.setAttribute("rel", "noopener noreferrer");
            node.setAttribute("target", "_blank");
        }
    }
    return template.innerHTML;
}
