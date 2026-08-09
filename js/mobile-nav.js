function prepararMenuMobile(nav) {
    if (!nav || nav.dataset.mobileNavReady === "true") return;

    const navLeft = nav.querySelector(".nav-left");
    const navLinks = nav.querySelector(".nav-links");
    if (!navLeft || !navLinks) return;

    nav.id ||= "main-nav";

    let drawer = nav.querySelector(".nav-drawer");
    if (!drawer) {
        drawer = document.createElement("div");
        drawer.className = "nav-drawer";
        drawer.id = `${nav.id}-drawer`;
        navLeft.appendChild(drawer);
        drawer.appendChild(navLinks);
    }

    let navRight = nav.querySelector(".nav-right");
    if (!navRight) {
        navRight = document.createElement("div");
        navRight.className = "nav-right";
        nav.appendChild(navRight);
    }

    let actions = drawer.querySelector(".nav-actions");
    if (!actions) {
        actions = document.createElement("div");
        actions.className = "nav-actions";
        drawer.appendChild(actions);
    }

    const adminLink = nav.querySelector("#link-adm");
    const logoutButton = nav.querySelector("#btn-logout");
    if (adminLink && adminLink.parentElement !== actions) actions.appendChild(adminLink);
    if (logoutButton && logoutButton.parentElement !== actions) actions.appendChild(logoutButton);
    if (!actions.children.length) actions.remove();

    let toggle = nav.querySelector(".mobile-menu-toggle");
    if (!toggle) {
        toggle = document.createElement("button");
        toggle.className = "mobile-menu-toggle";
        toggle.type = "button";
        toggle.innerHTML = "<span></span><span></span><span></span>";
        navRight.appendChild(toggle);
    }

    drawer.id ||= `${nav.id}-drawer`;
    toggle.setAttribute("aria-controls", drawer.id);
    toggle.setAttribute("aria-expanded", "false");
    toggle.setAttribute("aria-label", "Abrir menu");

    const fechar = ({ devolverFoco = false } = {}) => {
        const estavaAberto = nav.classList.contains("mobile-open");
        nav.classList.remove("mobile-open");
        toggle.setAttribute("aria-expanded", "false");
        toggle.setAttribute("aria-label", "Abrir menu");
        if (devolverFoco && estavaAberto) toggle.focus();
    };

    toggle.addEventListener("click", () => {
        const aberto = nav.classList.toggle("mobile-open");
        toggle.setAttribute("aria-expanded", String(aberto));
        toggle.setAttribute("aria-label", aberto ? "Fechar menu" : "Abrir menu");
    });

    drawer.querySelectorAll("a").forEach(link => link.addEventListener("click", () => fechar()));
    document.addEventListener("keydown", event => {
        if (event.key === "Escape") fechar({ devolverFoco: true });
    });
    window.addEventListener("resize", () => {
        if (window.innerWidth > 768) fechar();
    });

    nav.dataset.mobileNavReady = "true";
}

document.querySelectorAll("nav.navbar").forEach(prepararMenuMobile);
import("./pwa.js?v=pwa-v1");
