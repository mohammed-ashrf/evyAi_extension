const iframe = document.getElementById('app');
let panelFocused = true;

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
    if (msg.type === 'ELEMENT_FOCUSED') {
        panelFocused = true;
    }
    const isBlockable = msg.type === 'FOCUS_OUT' || msg.type === 'CLEAR_CONTEXT';
    const blocked = isBlockable && panelFocused;
    console.log('[sidepanel] msg.type:', msg.type, 'panelFocused:', panelFocused, 'blocked:', blocked);
    if (blocked) return;
    iframe.contentWindow.postMessage({ source: 'extension', ...msg }, '*');
});

window.addEventListener('message', (e) => {
    if (e.source !== iframe.contentWindow) return;
    if (e.data.type === 'GET_INITIAL_CONTEXT') {
        console.log('[sidepanel] GET_INITIAL_CONTEXT requesting from background');
        chrome.runtime.sendMessage(e.data).then((response) => {
            console.log('[sidepanel] GET_INITIAL_CONTEXT response:', response ? 'has data' : 'null');
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
