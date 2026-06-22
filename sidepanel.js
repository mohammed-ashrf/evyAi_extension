const iframe = document.getElementById('app');
let panelFocused = false;

window.addEventListener('focus', () => {
    panelFocused = true;
    chrome.storage.session.set({ lastFocusState: 'focused' }).catch(() => {});
});

iframe.addEventListener('mouseenter', () => {
    panelFocused = true;
    chrome.storage.session.set({ lastFocusState: 'focused' }).catch(() => {});
});

iframe.addEventListener('mouseleave', () => {
    panelFocused = false;
});

chrome.runtime.onMessage.addListener((msg) => {
    if ((msg.type === 'FOCUS_OUT' || msg.type === 'CLEAR_CONTEXT') && panelFocused) return;
    iframe.contentWindow.postMessage({ source: 'extension', ...msg }, '*');
});

window.addEventListener('message', (e) => {
    if (e.source !== iframe.contentWindow) return;
    if (e.data.type === 'GET_INITIAL_CONTEXT') {
        chrome.runtime.sendMessage(e.data).then((response) => {
            iframe.contentWindow.postMessage({
                source: 'extension',
                id: e.data.id,
                ...response
            }, '*');
        });
        return;
    }
    chrome.runtime.sendMessage(e.data).catch(() => {});
});
