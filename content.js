const elements = new Map();

document.addEventListener('focusin', (e) => {
    try {
        const el = e.target;
        if (el.getAttribute('contenteditable') !== 'true' || el.getAttribute('role') !== 'textbox') return;

        const id = crypto.randomUUID();
        el.dataset.ceId = id;
        elements.set(id, el);

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
            el.focus();
            el.textContent = '';
            document.execCommand('insertText', false, msg.text);
            el.dispatchEvent(new Event('input', { bubbles: true }));
            sendResponse({ success: true });
        }
    } catch {}
});

new MutationObserver(() => {
    for (const [id, el] of elements) {
        if (!document.contains(el)) elements.delete(id);
    }
}).observe(document.body, { childList: true, subtree: true });