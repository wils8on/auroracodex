let installPrompt = null;

const isStandalone = () => window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
const isAppleMobile = () => /iphone|ipad|ipod/i.test(navigator.userAgent);
const isMobileDevice = () => window.matchMedia("(max-width: 768px), (pointer: coarse)").matches;

function mostrarOrientacaoInstalacao() {
    document.getElementById("pwa-install-guide")?.remove();
    const overlay = document.createElement("div");
    overlay.id = "pwa-install-guide";
    overlay.className = "pwa-install-guide";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-labelledby", "pwa-install-title");
    const instrucao = isAppleMobile()
        ? "Toque em Compartilhar e escolha Adicionar à Tela de Início."
        : "Abra o menu do navegador e escolha Instalar aplicativo ou Adicionar à tela inicial.";
    overlay.innerHTML = `
        <div class="pwa-install-card">
            <span class="pwa-install-mark" aria-hidden="true">AC</span>
            <h2 id="pwa-install-title">Instalar Aurora Codex</h2>
            <p>${instrucao}</p>
            <button type="button">Entendi</button>
        </div>`;
    document.body.appendChild(overlay);
    const close = () => overlay.remove();
    overlay.querySelector("button")?.addEventListener("click", close);
    overlay.addEventListener("click", event => { if (event.target === overlay) close(); });
    document.addEventListener("keydown", event => { if (event.key === "Escape") close(); }, { once: true });
    overlay.querySelector("button")?.focus();
}

async function instalarPwa() {
    if (!installPrompt) {
        mostrarOrientacaoInstalacao();
        return;
    }
    installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    installPrompt = null;
    if (choice.outcome === "accepted") document.querySelector(".pwa-install-button")?.remove();
}

function adicionarBotaoInstalacao() {
    if (isStandalone() || document.querySelector(".pwa-install-button")) return;
    const drawer = document.querySelector(".nav-drawer");
    if (!drawer) return;
    let actions = drawer.querySelector(".nav-actions");
    if (!actions) {
        actions = document.createElement("div");
        actions.className = "nav-actions";
        drawer.appendChild(actions);
    }
    const button = document.createElement("button");
    button.type = "button";
    button.className = "pwa-install-button";
    button.innerHTML = '<span aria-hidden="true">↓</span> Instalar aplicativo';
    button.addEventListener("click", instalarPwa);
    actions.prepend(button);
}

window.addEventListener("beforeinstallprompt", event => {
    event.preventDefault();
    installPrompt = event;
    adicionarBotaoInstalacao();
});

window.addEventListener("appinstalled", () => {
    installPrompt = null;
    document.querySelector(".pwa-install-button")?.remove();
});

if (isMobileDevice()) adicionarBotaoInstalacao();

if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost" || location.hostname === "127.0.0.1")) {
    const serviceWorkerUrl = new URL("../service-worker.js", import.meta.url);
    const serviceWorkerScope = new URL("../", import.meta.url).pathname;
    window.addEventListener("load", () => navigator.serviceWorker.register(serviceWorkerUrl, { scope: serviceWorkerScope }).catch(error => {
        console.warn("Não foi possível ativar o modo aplicativo.", error);
    }));
}
