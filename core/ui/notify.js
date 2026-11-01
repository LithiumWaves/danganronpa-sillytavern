// Themed toasts for things the extension did on its own, with an optional
// action button (usually UNDO). Newest toast sits at the bottom of the stack.

const STACK_ID = "dangan-notify-stack";
const MAX_VISIBLE = 4;

function ensureStack() {
    let stack = document.getElementById(STACK_ID);
    if (!stack) {
        stack = document.createElement("div");
        stack.id = STACK_ID;
        stack.setAttribute("role", "status");
        stack.setAttribute("aria-live", "polite");
        document.body.appendChild(stack);
    }
    return stack;
}

export function notify({ title = "", message = "", tone = "info", actionLabel = "", onAction = null, durationMs = 6000 } = {}) {
    const stack = ensureStack();

    const toast = document.createElement("div");
    toast.className = `dangan-notify dangan-notify-${tone}`;

    const body = document.createElement("div");
    body.className = "dangan-notify-body";
    if (title) {
        const titleEl = document.createElement("div");
        titleEl.className = "dangan-notify-title";
        titleEl.textContent = title;
        body.appendChild(titleEl);
    }
    if (message) {
        const messageEl = document.createElement("div");
        messageEl.className = "dangan-notify-message";
        messageEl.textContent = message;
        body.appendChild(messageEl);
    }
    toast.appendChild(body);

    let timer = null;
    let closed = false;
    const close = () => {
        if (closed) return;
        closed = true;
        if (timer) clearTimeout(timer);
        toast.classList.add("leaving");
        setTimeout(() => toast.remove(), 220);
    };

    if (actionLabel && typeof onAction === "function") {
        const actionBtn = document.createElement("button");
        actionBtn.type = "button";
        actionBtn.className = "dangan-notify-action";
        actionBtn.textContent = actionLabel;
        actionBtn.addEventListener("click", (event) => {
            event.stopPropagation();
            close();
            onAction();
        });
        toast.appendChild(actionBtn);
    }

    const closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.className = "dangan-notify-close";
    closeBtn.setAttribute("aria-label", "Dismiss");
    closeBtn.textContent = "×";
    closeBtn.addEventListener("click", (event) => {
        event.stopPropagation();
        close();
    });
    toast.appendChild(closeBtn);

    stack.appendChild(toast);
    while (stack.children.length > MAX_VISIBLE) stack.firstElementChild.remove();

    // Hovering keeps the toast up so there's time to press UNDO.
    const arm = () => {
        if (durationMs > 0) timer = setTimeout(close, durationMs);
    };
    toast.addEventListener("mouseenter", () => { if (timer) clearTimeout(timer); });
    toast.addEventListener("mouseleave", arm);
    arm();

    return { close };
}
