import { safeUrl } from "./security.js";
import { closeAccessibleDialog, openAccessibleDialog } from "./dialog-accessibility.js";

export function extractYouTubeId(value) {
    if (!value) return "";
    try {
        const url = new URL(value);
        const host = url.hostname.replace(/^www\./, "");
        if (host === "youtu.be") return url.pathname.split("/").filter(Boolean)[0] || "";
        if (host === "youtube.com" || host === "m.youtube.com") {
            if (url.pathname === "/watch") return url.searchParams.get("v") || "";
            const parts = url.pathname.split("/").filter(Boolean);
            if (["embed", "shorts"].includes(parts[0])) return parts[1] || "";
        }
    } catch { return ""; }
    return "";
}

export function openMediaViewer(value, type, metadata = {}) {
    const overlay = document.createElement("div");
    overlay.style.cssText = "position:fixed; inset:0; background:rgba(0,0,0,0.92); z-index:10000; display:flex; align-items:center; justify-content:center; padding:20px;";
    overlay.dataset.dialogDisplay = "flex";

    const closeButton = document.createElement("button");
    closeButton.type = "button";
    closeButton.setAttribute("aria-label", "Fechar visualização");
    closeButton.textContent = "×";
    closeButton.style.cssText = "position:absolute; top:20px; right:20px; width:44px; height:44px; border:0; border-radius:50%; background:rgba(0,0,0,.65); color:#fff; font-size:2rem; cursor:pointer;";
    overlay.appendChild(closeButton);

    const watermark = document.createElement("div");
    watermark.textContent = "AURORA CODEX • CONTEÚDO PROTEGIDO";
    watermark.setAttribute("aria-hidden", "true");
    watermark.style.cssText = "position:absolute; inset:auto 5% 5%; z-index:2; pointer-events:none; color:rgba(255,255,255,.22); font-size:clamp(.65rem,1.5vw,1rem); font-weight:700; letter-spacing:.16em; text-align:center; transform:rotate(-5deg);";
    overlay.appendChild(watermark);
    overlay.addEventListener("contextmenu", event => event.preventDefault());
    overlay.addEventListener("dragstart", event => event.preventDefault());

    const content = document.createElement("figure");
    content.style.cssText = "width:min(94vw,1000px); max-height:90vh; display:flex; flex-direction:column; align-items:stretch; overflow:hidden; border:1px solid rgba(255,255,255,.12); border-radius:12px; background:#171220; box-shadow:0 24px 70px rgba(0,0,0,.65);";

    if (type === "video") {
        const videoId = extractYouTubeId(value);
        if (!videoId) return;
        const frame = document.createElement("iframe");
        frame.width = "800";
        frame.height = "450";
        frame.style.cssText = "max-width:90vw; max-height:80vh; border:none; border-radius:8px;";
        frame.src = `https://www.youtube.com/embed/${encodeURIComponent(videoId)}?autoplay=1`;
        frame.allow = "autoplay; encrypted-media";
        frame.allowFullscreen = true;
        frame.title = "Vídeo da galeria";
        frame.style.cssText = "width:100%; aspect-ratio:16/9; max-height:70vh; border:none; background:#000;";
        content.appendChild(frame);
    } else {
        const source = safeUrl(value);
        if (!source) return;
        const image = document.createElement("img");
        image.src = source;
        image.alt = "Imagem ampliada da galeria";
        image.style.cssText = "display:block; width:100%; max-height:70vh; object-fit:contain; background:#09070d;";
        content.appendChild(image);
    }

    const caption = document.createElement("figcaption");
    caption.style.cssText = "padding:20px 24px 24px;";
    const category = document.createElement("span");
    category.textContent = metadata.categoria || (type === "video" ? "Vídeo" : "Imagem");
    category.style.cssText = "display:block; margin-bottom:5px; color:#F97316; font-size:.72rem; font-weight:700; letter-spacing:.12em; text-transform:uppercase;";
    const title = document.createElement("h3");
    title.textContent = metadata.titulo || "Galeria da obra";
    title.style.cssText = "margin:0 0 8px; color:#FFF; font-family:Cinzel,serif; font-size:1.35rem;";
    const description = document.createElement("p");
    description.textContent = metadata.descricao || "";
    description.style.cssText = "margin:0; color:#B8B2C0; line-height:1.6;";
    caption.append(category, title);
    if (metadata.descricao) caption.appendChild(description);
    content.appendChild(caption);
    overlay.appendChild(content);

    const close = () => {
        closeAccessibleDialog(overlay);
    };
    closeButton.addEventListener("click", close);
    overlay.addEventListener("click", event => { if (event.target === overlay) close(); });
    document.body.appendChild(overlay);
    openAccessibleDialog(overlay, { initialFocus: closeButton, onClose: () => overlay.remove() });
}
