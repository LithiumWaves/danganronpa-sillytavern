// The School Regulations list (Truth tab → RULES), in the Case File editor's
// style. Each change is saved at once through the api; index.js keeps the
// rules per save and tells the AI about them.

import { pushSkippable } from "../core/skip/skipRegistry.js";
import { RULE_SEVERITY, addRule, createDefaultRules, editRule, normalizeRules, removeRule, setRuleSeverity } from "../core/rules/schoolRules.js";

const STYLE_ID = "dangan-srv-style";
const ROOT_ID = "dangan-srv";

// The look comes from styles/systems/dossier/dossier.css; this is layout only.
const CSS = `
#${ROOT_ID} .srv-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
#${ROOT_ID} .srv-rule { display: grid; grid-template-columns: 52px 1fr; gap: 12px; align-items: start; }
#${ROOT_ID} .srv-rule .dgn-num { padding-top: 6px; }
#${ROOT_ID} .srv-rule textarea { min-height: 0; }
#${ROOT_ID} .srv-rule.is-grave { border-left-color: #b3003f; background: linear-gradient(90deg, rgba(179, 0, 63, 0.22), rgba(255, 255, 255, 0.02)); }
#${ROOT_ID} .srv-rule.is-grave .dgn-num { color: #ff4d7a; }
#${ROOT_ID} .srv-bar { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin-top: 8px; }
#${ROOT_ID} .srv-meta { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; flex: 1 1 auto; min-width: 0; }
#${ROOT_ID} .srv-actions { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; margin-left: auto; }
#${ROOT_ID} .srv-report {
    display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin-top: 8px; padding: 8px 10px;
    background: rgba(0, 0, 0, 0.35); border-left: 2px solid var(--dgn-gold);
    font: 600 12px "Rajdhani", sans-serif; letter-spacing: 0.14em; color: var(--dgn-gold);
}
#${ROOT_ID} .srv-report select { width: auto; flex: 1 1 140px; padding: 4px 8px; font-size: 14px; }
#${ROOT_ID} .srv-add { display: grid; grid-template-columns: 1fr auto; gap: 10px; align-items: stretch; }
#${ROOT_ID} .srv-add textarea { min-height: 2.6em; }
@media (max-width: 600px) {
    #${ROOT_ID} .srv-rule { grid-template-columns: 34px 1fr; }
    #${ROOT_ID} .srv-rule .dgn-num { font-size: 20px; }
}
`;

const SOURCE_TAGS = { monokuma: "ADDED BY MONOKUMA", custom: "ADDED BY YOU" };

function ensureStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = CSS;
    document.head.appendChild(style);
}

// api: { getRules() → rules, setRules(rules), confirm({title, message, confirmLabel}) → Promise<bool>, getChapter(),
//        getPeople() → [names] (the player first), reportBreak(name, number) → Promise }
export function openSchoolRulesView(api) {
    ensureStyle();
    document.getElementById(ROOT_ID)?.remove();

    const root = document.createElement("div");
    root.id = ROOT_ID;
    root.className = "dgn-sheet";
    root.setAttribute("role", "dialog");
    root.setAttribute("aria-label", "School Regulations");
    root.innerHTML = `<div class="dgn-sheet-stripes"></div><div class="srv-window dgn-sheet-window is-medium">
        <div class="srv-head dgn-sheet-head"><div class="srv-title dgn-sheet-title">SCHOOL REGULATIONS</div><div class="srv-count dgn-sheet-tag"></div><button type="button" class="srv-close dgn-sheet-close">CLOSE</button></div>
        <div class="srv-body dgn-sheet-body">
            <p class="srv-note dgn-note">The AI knows these rules: characters follow them and Monokuma enforces them. He can add new ones in the story, and breaking one brings him in. LIGHT rules get a scolding; GRAVE ones are punished by death, you included (you're asked first). If the story missed a violation, report it with BROKEN….</p>
            <ol class="srv-list"></ol>
            <div class="srv-add"><textarea class="srv-new" rows="1" placeholder="A new regulation…"></textarea><button type="button" class="srv-primary srv-add-btn">ADD</button></div>
        </div>
        <div class="srv-foot dgn-sheet-foot"><button type="button" class="srv-danger srv-reset">RESET TO DEFAULTS</button></div>
    </div>`;
    document.body.appendChild(root);

    const list = root.querySelector(".srv-list");
    const close = () => {
        release();
        root.remove();
    };
    const release = pushSkippable({ kind: "minigame", skip: () => close() });
    const save = (rules) => {
        api.setRules(normalizeRules(rules));
        render();
    };

    // Each rule's box grows to show all of it.
    const fit = (el) => {
        el.style.height = "auto";
        el.style.height = `${el.scrollHeight + 2}px`;
    };

    function render() {
        const rules = normalizeRules(api.getRules());
        list.replaceChildren();
        if (!rules.length) {
            const empty = document.createElement("li");
            empty.className = "srv-empty dgn-empty";
            empty.textContent = "No regulations. Anything goes… for now.";
            list.appendChild(empty);
        }
        const graveCount = rules.filter((r) => r.severity === RULE_SEVERITY.GRAVE).length;
        root.querySelector(".srv-count").textContent = rules.length ? `${rules.length} RULES${graveCount ? ` · ${graveCount} GRAVE` : ""}` : "";
        rules.forEach((rule, i) => {
            const grave = rule.severity === RULE_SEVERITY.GRAVE;
            const li = document.createElement("li");
            li.className = `srv-rule dgn-row${grave ? " is-grave" : ""}`;
            li.dataset.id = rule.id;
            const num = document.createElement("div");
            num.className = "srv-num dgn-num";
            num.textContent = String(i + 1).padStart(2, "0");
            const cell = document.createElement("div");
            const text = document.createElement("textarea");
            text.rows = 1;
            text.value = rule.text;
            text.addEventListener("change", () => save(editRule(api.getRules(), rule.id, text.value)));
            text.addEventListener("input", () => fit(text));
            cell.appendChild(text);
            const meta = document.createElement("div");
            meta.className = "srv-meta";
            if (grave) meta.insertAdjacentHTML("beforeend", `<span class="dgn-stamp is-small">PUNISHED BY DEATH</span>`);
            if (SOURCE_TAGS[rule.source]) {
                const tag = document.createElement("span");
                tag.className = `srv-tag dgn-chip${rule.source === "monokuma" ? " is-pink" : ""}`;
                tag.textContent = `${SOURCE_TAGS[rule.source]}${rule.chapter ? ` · CHAPTER ${rule.chapter}` : ""}`;
                meta.appendChild(tag);
            }
            const actions = document.createElement("div");
            actions.className = "srv-actions";
            // LIGHT / GRAVE, a two-way switch.
            const sev = document.createElement("div");
            sev.className = "dgn-switch";
            sev.title = "LIGHT: breaking it gets a scolding. GRAVE: it's punished by death.";
            for (const level of [RULE_SEVERITY.LIGHT, RULE_SEVERITY.GRAVE]) {
                const b = document.createElement("button");
                b.type = "button";
                b.textContent = level.toUpperCase();
                const on = (level === RULE_SEVERITY.GRAVE) === grave;
                b.className = `${on ? "is-on" : ""}${level === RULE_SEVERITY.GRAVE ? " is-grave" : ""}`.trim();
                b.setAttribute("aria-pressed", String(on));
                if (!on) b.addEventListener("click", () => save(setRuleSeverity(api.getRules(), rule.id, level)));
                sev.appendChild(b);
            }
            actions.appendChild(sev);
            // BROKEN…: report a violation the AI didn't mark.
            if (api.reportBreak) {
                const broken = document.createElement("button");
                broken.type = "button";
                broken.className = "is-small";
                broken.textContent = "BROKEN…";
                broken.title = "Someone broke this rule and the story didn't catch it: report it to Monokuma.";
                broken.addEventListener("click", () => {
                    cell.querySelector(".srv-report")?.remove();
                    const row = document.createElement("div");
                    row.className = "srv-report";
                    const pick = document.createElement("select");
                    for (const name of api.getPeople?.() || []) {
                        const o = document.createElement("option");
                        o.value = name;
                        o.textContent = name;
                        pick.appendChild(o);
                    }
                    const ok = document.createElement("button");
                    ok.type = "button";
                    ok.className = "srv-primary is-small";
                    ok.textContent = "REPORT";
                    const cancel = document.createElement("button");
                    cancel.type = "button";
                    cancel.className = "is-small";
                    cancel.textContent = "CANCEL";
                    cancel.addEventListener("click", () => row.remove());
                    ok.addEventListener("click", async () => {
                        if (!pick.value) return;
                        close();
                        await api.reportBreak(pick.value, i + 1);
                    });
                    row.append(document.createTextNode("Who broke it?"), pick, ok, cancel);
                    cell.appendChild(row);
                });
                actions.appendChild(broken);
            }
            const del = document.createElement("button");
            del.type = "button";
            del.className = "srv-danger is-small";
            del.textContent = "DELETE";
            del.addEventListener("click", () => save(removeRule(api.getRules(), rule.id)));
            actions.appendChild(del);
            const bar = document.createElement("div");
            bar.className = "srv-bar";
            bar.append(meta, actions);
            cell.appendChild(bar);
            li.append(num, cell);
            list.appendChild(li);
        });
        list.querySelectorAll("textarea").forEach(fit);
    }

    const input = root.querySelector(".srv-new");
    const add = () => {
        if (!input.value.trim()) return;
        save(addRule(api.getRules(), input.value, { source: "custom", chapter: api.getChapter?.() || 0 }));
        input.value = "";
    };
    root.querySelector(".srv-add-btn").addEventListener("click", add);
    input.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); add(); }
    });
    root.querySelector(".srv-reset").addEventListener("click", async () => {
        const ok = await api.confirm({ title: "RESET THE REGULATIONS?", message: "The list goes back to the default rules. Rules Monokuma or you added are removed.", confirmLabel: "RESET" });
        if (ok) save(createDefaultRules());
    });
    root.querySelector(".srv-close").addEventListener("click", close);
    root.addEventListener("click", (e) => { if (e.target === root) close(); });

    render();
    return { close, refresh: render };
}
