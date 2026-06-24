let focusTimer = null;
chrome.runtime.onInstalled.addListener(() => {
    chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (sender.tab) {
        if (msg.type === 'ELEMENT_FOCUSED') {
            if (focusTimer) { clearTimeout(focusTimer); focusTimer = null; }
            chrome.storage.session.set({ lastContext: msg, lastFocusState: 'focused' }).catch(() => {});
        }
        if (msg.type === 'FOCUS_OUT') {
            chrome.storage.session.set({ lastFocusState: 'defocused' }).catch(() => {});
            if (focusTimer) clearTimeout(focusTimer);
            focusTimer = setTimeout(() => {
                chrome.storage.session.remove(['lastContext', 'lastFocusState']).catch(() => {});
                chrome.runtime.sendMessage({type: 'CLEAR_CONTEXT'}).catch(() => {});
            }, 2000);
        }
        if (msg.type === 'CLEAR_CONTEXT') {
            chrome.storage.session.remove(['lastContext', 'lastFocusState']).catch(() => {});
        }
        chrome.runtime.sendMessage(msg).catch(() => {});
    } else {
        if (msg.type === 'GET_INITIAL_CONTEXT') {
            chrome.storage.session.get(['lastContext', 'lastFocusState']).then((data) => {
                if (data.lastContext) {
                    sendResponse({ ...data.lastContext, _focused: data.lastFocusState === 'focused' });
                } else {
                    sendResponse(null);
                }
            }).catch(() => {
                sendResponse(null);
            });
            return true;
        }
        chrome.tabs.query({ active: true, currentWindow: true }).then(tabs => {
            if (tabs[0]?.id) {
                chrome.tabs.sendMessage(tabs[0].id, msg).catch(() => {});
            }
        });
    }
});
