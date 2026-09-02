const dialogStates = new WeakMap();

const focusableSelector = [
    "a[href]", "button:not([disabled])", "input:not([disabled])",
    "select:not([disabled])", "textarea:not([disabled])",
    '[tabindex]:not([tabindex="-1"])'
].join(",");

export function makeActivatable(element, action, label) {
    if (!element) return;
    element.setAttribute("role", "button");
    element.tabIndex = 0;
    if (label) element.setAttribute("aria-label", label);
    element.addEventListener("click", action);
    element.addEventListener("keydown", event => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        action(event);
    });
}

export function bindDialogCloseButton(dialog) {
    const button = dialog?.querySelector('button[onclick="fecharModal()"]');
    if (!button) return;
    button.removeAttribute("onclick");
    button.type = "button";
    button.setAttribute("aria-label", "Fechar detalhes da obra");
    button.addEventListener("click", () => closeAccessibleDialog(dialog));
    dialog.addEventListener("click", event => {
        if (event.target === dialog) closeAccessibleDialog(dialog);
    });
}

export function confirmAction({
    title = "Confirmar ação",
    message,
    confirmLabel = "Confirmar",
    cancelLabel = "Cancelar"
}) {
    return new Promise(resolve => {
        const overlay = document.createElement("div");
        overlay.className = "confirm-overlay";
        overlay.dataset.dialogDisplay = "flex";

        const panel = document.createElement("div");
        panel.className = "confirm-dialog";
        const heading = document.createElement("h2");
        heading.textContent = title;
        const description = document.createElement("p");
        description.textContent = message || "Esta ação precisa da sua confirmação.";
        const actions = document.createElement("div");
        actions.className = "confirm-dialog-actions";
        const cancelButton = document.createElement("button");
        cancelButton.type = "button";
        cancelButton.className = "confirm-cancel";
        cancelButton.textContent = cancelLabel;
        const confirmButton = document.createElement("button");
        confirmButton.type = "button";
        confirmButton.className = "confirm-danger";
        confirmButton.textContent = confirmLabel;

        actions.append(cancelButton, confirmButton);
        panel.append(heading, description, actions);
        overlay.appendChild(panel);
        document.body.appendChild(overlay);

        let settled = false;
        const finish = value => {
            if (settled) return;
            settled = true;
            closeAccessibleDialog(overlay);
            overlay.remove();
            resolve(value);
        };

        cancelButton.addEventListener("click", () => finish(false));
        confirmButton.addEventListener("click", () => finish(true));
        overlay.addEventListener("click", event => {
            if (event.target === overlay) finish(false);
        });
        openAccessibleDialog(overlay, { initialFocus: cancelButton, onClose: () => finish(false) });
    });
}

export function openAccessibleDialog(dialog, { initialFocus, onClose } = {}) {
    if (!dialog) return;
    closeAccessibleDialog(dialog, { restoreFocus: false });

    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("aria-modal", "true");
    dialog.tabIndex = -1;
    dialog.style.display = dialog.dataset.dialogDisplay || "block";
    document.body.style.overflow = "hidden";

    const onKeyDown = event => {
        if (event.key === "Escape") {
            event.preventDefault();
            closeAccessibleDialog(dialog);
            return;
        }
        if (event.key !== "Tab") return;
        const focusable = [...dialog.querySelectorAll(focusableSelector)]
            .filter(item => item instanceof HTMLElement && item.offsetParent !== null);
        if (!focusable.length) {
            event.preventDefault();
            dialog.focus();
            return;
        }
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first.focus();
        }
    };

    dialogStates.set(dialog, { opener, onKeyDown, onClose });
    document.addEventListener("keydown", onKeyDown);
    requestAnimationFrame(() => (initialFocus || dialog.querySelector(focusableSelector) || dialog).focus());
}

export function closeAccessibleDialog(dialog, { restoreFocus = true } = {}) {
    if (!dialog) return;
    const state = dialogStates.get(dialog);
    if (state) document.removeEventListener("keydown", state.onKeyDown);
    dialogStates.delete(dialog);
    dialog.style.display = "none";
    document.body.style.overflow = "";
    state?.onClose?.();
    if (restoreFocus && state?.opener?.isConnected) state.opener.focus();
}
