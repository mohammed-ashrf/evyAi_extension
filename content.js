// --- Constants ---
const IFRAME_INJECT_DELAYS = [300, 1500];
const MAX_ELEMENTS = 20;
const THREAD_WRAPPER_DEPTH = 7;
const CONTAINER_DEPTH = 13;
const DM_HTML_MAX = 200000;
const DM_MSG_HTML_MAX = 500000;
const EDITOR_HTML_MAX = 50000;
const CONTAINER_HTML_MAX = 200000;
const CONTAINER_TEXT_MAX = 100000;

// --- State ---
const elements = new Map();
let suppressFocusIn = false;

// --- Helpers ---
function safeSlice(str, maxLen) {
    if (str.length <= maxLen) return str;
    const cut = str.slice(0, maxLen);
    const lastGt = cut.lastIndexOf('>');
    return lastGt > 0 ? cut.slice(0, lastGt + 1) : cut;
}

function safeSliceEnd(str, maxLen) {
    if (str.length <= maxLen) return str;
    const cut = str.slice(-maxLen);
    const firstGt = cut.indexOf('>');
    return firstGt >= 0 ? cut.slice(firstGt) : cut;
}

function attachIframeListeners(iframe) {
    try {
        const doc = iframe.contentDocument || iframe.contentWindow?.document;
        if (!doc || !doc.body) return;
        doc.addEventListener('focusin', (e) => {
            try {
                const target = e.composedPath()[0];
                if (target && target.isContentEditable) {
                    handleFocus(target, 'iframe_focusin');
                }
            } catch (err) {}
        }, { capture: true });
        doc.addEventListener('focusout', (e) => {
            try {
                if (e.target && e.target.isContentEditable) {
                    chrome.runtime.sendMessage({type: 'FOCUS_OUT'}).catch(() => {});
                }
            } catch (err) {}
        });
        const ae = doc.activeElement;
        if (ae && ae.isContentEditable) {
            handleFocus(ae, 'iframe_activeelement');
        }
    } catch (e) {}
}

function setupIframeListeners(iframe) {
    if (iframe.dataset.ceListened) return;
    iframe.dataset.ceListened = '1';
    attachIframeListeners(iframe);
    iframe.addEventListener('load', () => attachIframeListeners(iframe));
}

function injectIframeListeners() {
    try {
        const iframes = document.querySelectorAll('iframe');
        iframes.forEach(setupIframeListeners);
    } catch (e) {}
}

function handleFocus(el, source) {
    if (suppressFocusIn) return;
    if (!el.isContentEditable) return;
    let id = el.dataset.ceId;
    if (!id) {
        id = crypto.randomUUID();
        el.dataset.ceId = id;
    }
    elements.set(id, el);
    if (elements.size > MAX_ELEMENTS) elements.delete(elements.keys().next().value);

    let dmHtml = '';
    let dmMessagesHtml = '';
    if (location.href.includes('/messaging/thread/')) {
        let threadWrapper = el.parentElement;
        for (let i = 0; i < THREAD_WRAPPER_DEPTH && threadWrapper && threadWrapper !== document.body; i++) {
            threadWrapper = threadWrapper.parentElement;
        }
        if (threadWrapper && threadWrapper !== document.body) {
            dmHtml = safeSlice(threadWrapper.outerHTML, DM_HTML_MAX);
            dmMessagesHtml = safeSliceEnd(threadWrapper.outerHTML, DM_MSG_HTML_MAX);
        }
    }

    let container = el.parentElement;
    for (let i = 0; i < CONTAINER_DEPTH && container && container !== document.body; i++) {
        container = container.parentElement;
    }

    if (container) {
        try {
            chrome.runtime.sendMessage({
                type: 'ELEMENT_FOCUSED',
                elementId: id,
                pageUrl: location.href,
                hostname: location.hostname,
                dmHtml: dmHtml,
                dmMessagesHtml: dmMessagesHtml,
                editorHtml: safeSlice(el.outerHTML, EDITOR_HTML_MAX),
                containerHtml: safeSlice(container.outerHTML, CONTAINER_HTML_MAX),
                containerText: container.innerText.slice(0, CONTAINER_TEXT_MAX)
            });
        } catch (e) {}
    }
}

// --- URL Tracking ---
let lastUrl = location.href;
if (location.href.includes('/messaging/thread/')) {
    IFRAME_INJECT_DELAYS.forEach(ms => setTimeout(injectIframeListeners, ms));
}

const nav = window.navigation;
if (nav) {
    nav.addEventListener('navigate', (e) => {
        try {
            const newUrl = e.destination?.url;
            if (newUrl && newUrl !== lastUrl) {
                lastUrl = newUrl;
                chrome.runtime.sendMessage({type: 'URL_CHANGED', pageUrl: newUrl}).catch(() => {});
                if (newUrl.includes('/messaging/thread/')) {
                    IFRAME_INJECT_DELAYS.forEach(ms => setTimeout(injectIframeListeners, ms));
                }
            }
        } catch (e) {}
    });
}

window.addEventListener('popstate', () => {
    if (location.href !== lastUrl) {
        lastUrl = location.href;
        chrome.runtime.sendMessage({type: 'URL_CHANGED', pageUrl: location.href}).catch(() => {});
    }
});

// --- Focus Detection ---
document.addEventListener('focusout', (e) => {
    try {
        if (!e.target.isContentEditable) return;
        chrome.runtime.sendMessage({type: 'FOCUS_OUT'}).catch(() => {});
    } catch {}
});

document.addEventListener('focusin', (e) => {
    try {
        const path = e.composedPath();
        const target = path[0];
        handleFocus(target, 'document_capture');
    } catch (err) {}
}, { capture: true });

// --- Observers ---
new MutationObserver((mutations) => {
    try {
        for (const m of mutations) {
            for (const node of m.addedNodes) {
                if (node.nodeType === 1 && node.tagName === 'IFRAME') {
                    setupIframeListeners(node);
                }
            }
        }
    } catch (err) {}
}).observe(document.body, { childList: true, subtree: true });

new MutationObserver(() => {
    for (const [id, el] of elements) {
        if (!el.isConnected) elements.delete(id);
    }
}).observe(document.body, { childList: true, subtree: true });

// --- Message Handlers ---
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    try {
        if (msg.type === 'INSERT_TEXT') {
            const el = elements.get(msg.elementId);
            if (!el) { sendResponse({ error: 'Element not found' }); return; }
            suppressFocusIn = true;
            el.focus();
            const doc = el.ownerDocument;
            doc.execCommand('insertText', false, msg.text);
            suppressFocusIn = false;
            sendResponse({ success: true });
        }
    } catch {}
});
