const iframe = document.getElementById('app');

chrome.runtime.onMessage.addListener((msg) => {
    iframe.contentWindow.postMessage({ source: 'extension', ...msg }, '*');
});

window.addEventListener('message', (e) => {
    if (e.source !== iframe.contentWindow) return;
    chrome.runtime.sendMessage(e.data);
});
