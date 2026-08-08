import { escapeHtml } from "./security.js";

let toastRegion;

function getToastRegion() {
    if (toastRegion?.isConnected) return toastRegion;

    toastRegion = document.createElement("div");
    toastRegion.className = "toast-region";
    toastRegion.setAttribute("aria-live", "polite");
    toastRegion.setAttribute("aria-atomic", "true");
    document.body.appendChild(toastRegion);
    return toastRegion;
}

export function showToast(message, type = "info", duration = 4000) {
    const toast = document.createElement("div");
    toast.className = `toast toast-${type}`;
    toast.setAttribute("role", type === "error" ? "alert" : "status");
    toast.innerHTML = `<span>${escapeHtml(message)}</span><button type="button" aria-label="Fechar notificação">&times;</button>`;

    const remove = () => {
        toast.classList.add("toast-leaving");
        window.setTimeout(() => toast.remove(), 180);
    };

    toast.querySelector("button").addEventListener("click", remove);
    getToastRegion().appendChild(toast);
    if (duration > 0) window.setTimeout(remove, duration);
    return toast;
}

export function renderContentState(container, { type = "loading", title, message }) {
    if (!container) return;
    const icon = type === "loading" ? '<span class="state-spinner" aria-hidden="true"></span>' : "";
    container.innerHTML = `
        <div class="content-state content-state-${type}" role="${type === "error" ? "alert" : "status"}">
            ${icon}
            <strong>${escapeHtml(title || (type === "loading" ? "Carregando" : "Não foi possível carregar"))}</strong>
            ${message ? `<p>${escapeHtml(message)}</p>` : ""}
        </div>
    `;
}

export function setButtonBusy(button, busy, busyText = "Processando...") {
    if (!button) return;
    if (busy) {
        button.dataset.labelOriginal = button.innerHTML;
        button.disabled = true;
        button.setAttribute("aria-busy", "true");
        button.textContent = busyText;
        return;
    }

    button.disabled = false;
    button.removeAttribute("aria-busy");
    if (button.dataset.labelOriginal) {
        button.innerHTML = button.dataset.labelOriginal;
        delete button.dataset.labelOriginal;
    }
}
