(() => {
    const menu = document.querySelector(".navigation");
    const button = document.querySelector("[data-menu-toggle]");
    if (!menu || !button) return;

    function setOpen(open) {
        menu.classList.toggle("is-open", open);
        button.setAttribute("aria-expanded", String(open));
        button.setAttribute("aria-label", open ? "Close navigation menu" : "Open navigation menu");
    }

    button.addEventListener("click", () => {
        setOpen(button.getAttribute("aria-expanded") !== "true");
    });

    menu.addEventListener("click", event => {
        if (event.target.closest("a")) setOpen(false);
    });

    document.addEventListener("keydown", event => {
        if (event.key === "Escape" && button.getAttribute("aria-expanded") === "true") {
            setOpen(false);
            button.focus();
        }
    });

    document.addEventListener("click", event => {
        if (!event.target.closest(".header") && button.getAttribute("aria-expanded") === "true") {
            setOpen(false);
        }
    });

    const desktopLayout = window.matchMedia("(min-width: 701px)");
    if (desktopLayout.addEventListener) {
        desktopLayout.addEventListener("change", () => setOpen(false));
    } else {
        desktopLayout.addListener(() => setOpen(false));
    }
})();
