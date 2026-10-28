// The School Regulations list (Truth tab → RULES), in the Case File editor's
// style. Each change is saved at once through the api; index.js keeps the
// rules per save and tells the AI about them.

import { pushSkippable } from "../core/skip/skipRegistry.js";
import { RULE_SEVERITY, addRule, createDefaultRules, editRule, normalizeRules, removeRule, setRuleSeverity } from "../core/rules/schoolRules.js";

const STYLE_ID = "dangan-srv-style";
const ROOT_ID = "dangan-srv";

const CSS = `
#${ROOT_ID} {
    position: fixed; inset: 0; z-index: 100040;
    display: flex; align-items: center; justify-content: center; padding: 16px; box-sizing: border-box;
    background: rgba(6, 2, 12, 0.78); font-family: inherit; color: #f1e6f7;
}
#${ROOT_ID} .srv-window {
    width: min(760px, 100%); max-height: calc(100vh - 32px); display: flex; flex-direction: column;
    background: radial-gradient(ellipse at 50% 0%, rgba(46, 12, 58, 0.98), rgba(10, 4, 16, 0.99));
    border: 1px solid rgba(255, 46, 196, 0.5); border-radius: 10px;
    box-shadow: 0 20px 60px rgba(0,0,0,0.6), 0 0 18px rgba(255, 46, 196, 0.15);
}
#${ROOT_ID} .srv-head { display: flex; align-items: center; gap: 12px; padding: 12px 16px; border-bottom: 1px solid rgba(255, 46, 196, 0.35); }
#${ROOT_ID} .srv-title { font-size: 1.15rem; letter-spacing: 0.12em; color: #ff2ec4; flex: 1; }
#${ROOT_ID} .srv-body { overflow: auto; padding: 14px 16px; }
#${ROOT_ID} .srv-note { font-size: 0.8rem; color: #bfa9cc; margin: 0 0 10px; line-height: 1.45; }
#${ROOT_ID} .srv-list { list-style: none; margin: 0; padding: 0; }
#${ROOT_ID} .srv-rule {
    display: grid; grid-template-columns: 2.2em 1fr auto; gap: 8px; align-items: start;
    padding: 8px; margin-bottom: 6px; background: rgba(255, 255, 255, 0.03); border-radius: 4px;
}
#${ROOT_ID} .srv-num { color: #ff2ec4; font-weight: 700; padding-top: 5px; text-align: right; }
#${ROOT_ID} .srv-tag { display: inline-block; margin-top: 4px; font-size: 0.68rem; letter-spacing: 0.1em; color: #ffd23f; }
#${ROOT_ID} .srv-actions { display: flex; gap: 6px; }
#${ROOT_ID} button.srv-grave { border-color: #ff1f8e; color: #fff; background: rgba(255, 31, 142, 0.35); }
#${ROOT_ID} .srv-report { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; margin-top: 6px; font-size: 0.75rem; color: #d9c4e6; }
#${ROOT_ID} .srv-report select { background: rgba(0, 0, 0, 0.45); color: #fff; border: 1px solid rgba(255, 182, 222, 0.35); border-radius: 4px; font: inherit; font-size: 0.8rem; padding: 3px 6px; }
#${ROOT_ID} .srv-empty { text-align: center; padding: 18px; color: #bfa9cc; }
#${ROOT_ID} .srv-add { display: grid; grid-template-columns: 1fr auto; gap: 8px; margin-top: 10px; }
#${ROOT_ID} .srv-foot { display: flex; flex-wrap: wrap; gap: 8px; padding: 12px 16px; justify-content: flex-end; border-top: 1px solid rgba(255, 46, 196, 0.35); }
#${ROOT_ID} button {
    background: transparent; color: #f1e6f7; border: 1px solid rgba(255, 182, 222, 0.6);
    font: inherit; font-size: 0.8rem; letter-spacing: 0.08em; padding: 6px 12px; cursor: pointer; border-radius: 4px;
}
#${ROOT_ID} button:hover { background: rgba(255, 46, 196, 0.18); }
#${ROOT_ID} button.srv-primary { border-color: #ff2ec4; color: #fff; background: rgba(255, 46, 196, 0.32); }
#${ROOT_ID} button.srv-danger { border-color: rgba(255, 80, 80, 0.7); color: #ff8a8a; }
#${ROOT_ID} textarea {
    background: rgba(0, 0, 0, 0.45); color: #fff; border: 1px solid rgba(255, 182, 222, 0.35); border-radius: 4px;
    font: inherit; font-size: 0.9rem; padding: 5px 7px; width: 100%; box-sizing: border-box; resize: vertical; min-height: 2.4em;
}
@media (max-width: 600px) {
    #${ROOT_ID} { padding: 0; }
    #${ROOT_ID} .srv-window { max-height: 100vh; height: 100vh; border-radius: 0; }
    #${ROOT_ID} .srv-rule { grid-template-columns: 1.8em 1fr; }
    #${ROOT_ID} .srv-actions { grid-column: 2; }
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
    root.setAttribute("role", "dialog");
    root.setAttribute("aria-label", "School Regulations");
    root.innerHTML = `<div class="srv-window">
        <div class="srv-head"><div class="srv-title">SCHOOL REGULATIONS</div><button type="button" class="srv-close">CLOSE</button></div>
        <div class="srv-body">
            <p class="srv-note">The AI knows these rules: characters follow them and Monokuma enforces them. He can add new ones in the story, and breaking one brings him in. LIGHT rules get a scolding; GRAVE ones are punished by death, you included (you're asked first). If the story missed a violation, report it with BROKEN….</p>
            <ol class="srv-list"></ol>
            <div class="srv-add"><textarea class="srv-new" rows="1" placeholder="A new regulation…"></textarea><button type="button" class="srv-primary srv-add-btn">ADD</button></div>
        </div>
        <div class="srv-foot"><button type="button" class="srv-danger srv-reset">RESET TO DEFAULTS</button></div>
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
            empty.className = "srv-empty";
            empty.textContent = "No regulations. Anything goes… for now.";
            list.appendChild(empty);
        }
        rules.forEach((rule, i) => {
            const li = document.createElement("li");
            li.className = "srv-rule";
            li.dataset.id = rule.id;
            const num = document.createElement("div");
            num.className = "srv-num";
            num.textContent = `${i + 1}.`;
            const cell = document.createElement("div");
            const text = document.createElement("textarea");
            text.rows = 1;
            text.value = rule.text;
            text.addEventListener("change", () => save(editRule(api.getRules(), rule.id, text.value)));
            text.addEventListener("input", () => fit(text));
            cell.appendChild(text);
            if (SOURCE_TAGS[rule.source]) {
                const tag = document.createElement("span");
                tag.className = "srv-tag";
                tag.textContent = `${SOURCE_TAGS[rule.source]}${rule.chapter ? ` · CHAPTER ${rule.chapter}` : ""}`;
                cell.appendChild(tag);
            }
            const actions = document.createElement("div");
            actions.className = "srv-actions";
            const sev = document.createElement("button");
            sev.type = "button";
            const grave = rule.severity === RULE_SEVERITY.GRAVE;
            sev.className = grave ? "srv-grave" : "";
            sev.textContent = grave ? "GRAVE" : "LIGHT";
            sev.title = grave ? "Breaking it is punished by death. Click to make it light." : "Breaking it gets a scolding. Click to make it grave (punished by death).";
            sev.addEventListener("click", () => save(setRuleSeverity(api.getRules(), rule.id, grave ? RULE_SEVERITY.LIGHT : RULE_SEVERITY.GRAVE)));
            actions.appendChild(sev);
            // BROKEN…: report a violation the AI didn't mark.
            if (api.reportBreak) {
                const broken = document.createElement("button");
                broken.type = "button";
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
                    ok.className = "srv-primary";
                    ok.textContent = "REPORT";
                    const cancel = document.createElement("button");
                    cancel.type = "button";
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
            del.className = "srv-danger";
            del.textContent = "DELETE";
            del.addEventListener("click", () => save(removeRule(api.getRules(), rule.id)));
            actions.appendChild(del);
            li.append(num, cell, actions);
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
