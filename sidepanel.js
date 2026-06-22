const iframe = document.getElementById('app');

chrome.runtime.onMessage.addListener((msg) => {
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
