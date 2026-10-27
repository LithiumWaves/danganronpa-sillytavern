// Chat watch: a debugging aid for "a reply is generated but never shows up".
// SillyTavern drops a reply when the chat array is emptied while the reply is
// being saved (a reload, a chat switch, a clear). While the watch is on, every
// way that can happen during a reply is traced to the console with its call
// stack, so the culprit names itself. Off by default; /dgwatch on|off.

const TAG = "[Dangan][Watch]";
const CONTEXT_FUNCTIONS = ["clearChat", "reloadCurrentChat", "openGroupChat", "openCharacterChat", "deleteLastMessage", "printMessages", "saveChat"];

export function installChatWatch({ eventSource, event_types, isEnabled }) {
    let generating = null; // { type, startedAt, length, speaker }
    let watchedChat = null;

    const on = () => Boolean(isEnabled?.());
    const ctx = () => window.SillyTavern?.getContext?.();

    function describe() {
        const c = ctx();
        const chat = c?.chat;
        return {
            generating: generating ? { ...generating, ms: Date.now() - generating.startedAt } : null,
            chatLength: Array.isArray(chat) ? chat.length : null,
            sameChatArray: chat === watchedChat,
            groupId: c?.groupId ?? null,
            chatId: c?.chatId ?? c?.getCurrentChatId?.() ?? null,
        };
    }

    function trace(what, extra = {}) {
        if (!on()) return;
        console.groupCollapsed?.(`${TAG} ${what}${generating ? " — DURING A REPLY" : ""}`);
        console.log(TAG, { ...describe(), ...extra });
        console.trace(`${TAG} ${what}`);
        console.groupEnd?.();
    }

    // Removing messages from the live chat array (getGroupChat and others
    // empty it with splice).
    function watchChatArray() {
        const chat = ctx()?.chat;
        if (!Array.isArray(chat) || chat === watchedChat) return;
        watchedChat = chat;
        if (chat.__danganWatched) return;
        Object.defineProperty(chat, "__danganWatched", { value: true });
        const original = chat.splice;
        Object.defineProperty(chat, "splice", {
            configurable: true,
            writable: true,
            value: function (...args) {
                const removing = args.length > 1 ? Number(args[1]) || 0 : this.length - (Number(args[0]) || 0);
                if (removing > 0) trace(`chat.splice removed ${removing} message(s)`, { args: args.slice(0, 2), lengthBefore: this.length });
                return original.apply(this, args);
            },
        });
    }

    // The context functions that can empty or reload the chat, as called by
    // any extension (ours included) through getContext().
    const st = window.SillyTavern;
    if (st?.getContext && !st.getContext.__danganWatched) {
        const originalGetContext = st.getContext;
        const wrapped = function (...args) {
            const c = originalGetContext.apply(this, args);
            if (!on() || !c) return c;
            for (const name of CONTEXT_FUNCTIONS) {
                const fn = c[name];
                if (typeof fn !== "function" || fn.__danganWatched) continue;
                const watchedFn = function (...fnArgs) {
                    trace(`getContext().${name}() called`);
                    return fn.apply(this, fnArgs);
                };
                watchedFn.__danganWatched = true;
                c[name] = watchedFn;
            }
            return c;
        };
        wrapped.__danganWatched = true;
        st.getContext = wrapped;
    }

    eventSource.on(event_types.GENERATION_STARTED, (type, _options, dryRun) => {
        if (dryRun || !on()) return;
        watchChatArray();
        generating = { type, startedAt: Date.now(), length: ctx()?.chat?.length ?? null, speaker: generating?.speaker || "" };
        console.log(`${TAG} reply started`, describe());
    });
    if (event_types.GROUP_MEMBER_DRAFTED) {
        eventSource.on(event_types.GROUP_MEMBER_DRAFTED, (chId) => {
            if (!on()) return;
            const name = ctx()?.characters?.[chId]?.name || String(chId);
            generating = { ...(generating || { startedAt: Date.now() }), speaker: name };
            console.log(`${TAG} group member drafted: ${name}`);
        });
    }
    for (const done of [event_types.GENERATION_ENDED, event_types.GENERATION_STOPPED]) {
        if (!done) continue;
        eventSource.on(done, () => {
            if (!on()) return;
            console.log(`${TAG} reply finished (${done})`, describe());
            generating = null;
        });
    }
    for (const changed of [event_types.CHAT_CHANGED, event_types.CHAT_LOADED]) {
        if (!changed) continue;
        eventSource.on(changed, () => {
            trace(`${changed} fired`);
            watchChatArray();
        });
    }
    if (event_types.MESSAGE_RECEIVED) {
        eventSource.on(event_types.MESSAGE_RECEIVED, (mesId, type) => {
            if (!on()) return;
            const chat = ctx()?.chat;
            const ok = Array.isArray(chat) && chat[mesId] !== undefined;
            console.log(`${TAG} MESSAGE_RECEIVED #${mesId} (${type}) — message ${ok ? "present" : "MISSING from chat"}`, describe());
        });
    }

    return { trace };
}
