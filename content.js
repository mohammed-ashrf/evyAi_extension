const elements = new Map();
const ELEMENT_LIMIT = 10;
let lastElementId = null;
let focusOutTimer = null;
let suppressFocusIn = false;

function trimMap() {
    if (elements.size <= ELEMENT_LIMIT) return;
    const iter = elements.keys();
    while (elements.size > ELEMENT_LIMIT) {
        const { value, done } = iter.next();
        if (done) break;
        if ( value !== lastElementId) {
            elements.delete(value);
        }
    }
}

document.addEventListener('focusout', (e) => {
    try {
        const el = e.target;
        if (el.getAttribute('contenteditable') !== 'true' || el.getAttribute('role') !== 'textbox') return;
        if (!el.dataset.ceId) return;

        chrome.runtime.sendMessage({type: 'FOCUS_OUT'}).catch(() => {});
        if (focusOutTimer) clearTimeout(focusOutTimer);
        focusOutTimer = setTimeout(() => {
            chrome.runtime.sendMessage({type: 'CLEAR_CONTEXT'}).catch(() => {});
        }, 2000);
    } catch {}
});

document.addEventListener('focusin', (e) => {
    try {
        if (suppressFocusIn) return;
        if (focusOutTimer) { 
            clearTimeout(focusOutTimer);
            focusOutTimer = null;
        }
        const el = e.target;
        if (el.getAttribute('contenteditable') !== 'true' || el.getAttribute('role') !== 'textbox') return;


        let id = el.dataset.ceId;
        if (!id) {
            id = crypto.randomUUID();
            el.dataset.ceId = id;
        }
        lastElementId = id;
        elements.set(id, el);
        trimMap();

        const container = el.closest('[role="listitem"]');

        if (container) {
            chrome.runtime.sendMessage({
                type: 'ELEMENT_FOCUSED',
                elementId: id,
                pageUrl: location.href,
                hostname: location.hostname,
                containerHtml: container.outerHTML.slice(0, 10000),
                containerText: container.innerText.slice(0, 5000)
            });
        }
    } catch {}
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    try {
        if (msg.type === 'INSERT_TEXT') {
            const el = elements.get(msg.elementId);
            if (!el) { sendResponse({ error: 'Element not found' }); return; }
            suppressFocusIn = true;
            el.focus();
            el.textContent = '';
            document.execCommand('insertText', false, msg.text);
            el.dispatchEvent(new Event('input', { bubbles: true }));
            suppressFocusIn = false;
            sendResponse({ success: true });
        }
    } catch {}
});

new MutationObserver(() => {
    for (const [id, el] of elements) {
        if (!document.contains(el)) elements.delete(id);
    }
}).observe(document.body, { childList: true, subtree: true });