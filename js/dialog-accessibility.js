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
