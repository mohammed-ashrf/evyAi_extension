const elements = new Map();
let suppressFocusIn = false;

function safeSlice(str, maxLen) {
    if (str.length <= maxLen) return str;
    const cut = str.slice(0, maxLen);
    const lastGt = cut.lastIndexOf('>');
    return lastGt > 0 ? cut.slice(0, lastGt + 1) : cut;
}

document.addEventListener('focusout', (e) => {
    try {
        // if (!e.target.isContentEditable) return;
        chrome.runtime.sendMessage({type: 'FOCUS_OUT'}).catch(() => {});
    } catch {}
});

document.addEventListener('focusin', (e) => {
    try {
        if (suppressFocusIn) return;
        // if (!e.target.isContentEditable) return;
        const el = e.target;
        let id = el.dataset.ceId;
        if (!id) {
            id = crypto.randomUUID();
            el.dataset.ceId = id;
        }
        elements.set(id, el);
        if (elements.size > 20) elements.delete(elements.keys().next().value);

        let container = el.parentElement;
        for (let i = 0; i < 15 && container && container !== document.body; i++) {
            container = container.parentElement;
        }

        if (container) {
            chrome.runtime.sendMessage({
                type: 'ELEMENT_FOCUSED',
                elementId: id,
                pageUrl: location.href,
                hostname: location.hostname,
                editorHtml: safeSlice(el.outerHTML, 50000),
                containerHtml: safeSlice(container.outerHTML, 200000),
                containerText: container.innerText.slice(0, 100000)
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