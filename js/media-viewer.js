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

export function openMediaViewer(value, type) {
    const overlay = document.createElement("div");
    overlay.style.cssText = "position:fixed; inset:0; background:rgba(0,0,0,0.92); z-index:10000; display:flex; align-items:center; justify-content:center; padding:20px;";
    overlay.dataset.dialogDisplay = "flex";

    const closeButton = document.createElement("button");
    closeButton.type = "button";
    closeButton.setAttribute("aria-label", "Fechar visualização");
    closeButton.textContent = "×";
    closeButton.style.cssText = "position:absolute; top:20px; right:20px; width:44px; height:44px; border:0; border-radius:50%; background:rgba(0,0,0,.65); color:#fff; font-size:2rem; cursor:pointer;";
    overlay.appendChild(closeButton);

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
        overlay.appendChild(frame);
    } else {
        const source = safeUrl(value);
        if (!source) return;
        const image = document.createElement("img");
        image.src = source;
        image.alt = "Imagem ampliada da galeria";
        image.style.cssText = "max-width:90vw; max-height:85vh; border-radius:8px; box-shadow:0 20px 60px rgba(0,0,0,0.6);";
        overlay.appendChild(image);
    }

    const close = () => {
        closeAccessibleDialog(overlay);
    };
    closeButton.addEventListener("click", close);
    overlay.addEventListener("click", event => { if (event.target === overlay) close(); });
    document.body.appendChild(overlay);
    openAccessibleDialog(overlay, { initialFocus: closeButton, onClose: () => overlay.remove() });
}
