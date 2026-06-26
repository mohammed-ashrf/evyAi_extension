let focusTimer = null;
chrome.runtime.onInstalled.addListener(() => {
    chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (sender.tab) {
        console.log('[background] from tab msg.type:', msg.type, 'pageUrl:', msg.pageUrl?.slice(0,60), 'dmHtml len:', msg.dmHtml?.length);
        if (msg.type === 'ELEMENT_FOCUSED') {
            if (focusTimer) { clearTimeout(focusTimer); focusTimer = null; }
            chrome.storage.session.set({ lastContext: msg, lastFocusState: 'focused' }).catch(() => {});
        }
        if (msg.type === 'FOCUS_OUT') {
            chrome.storage.session.set({ lastFocusState: 'defocused' }).catch(() => {});
            if (focusTimer) clearTimeout(focusTimer);
            focusTimer = setTimeout(() => {
                console.log('[background] CLEAR_CONTEXT timer fired');
                chrome.storage.session.remove(['lastContext', 'lastFocusState']).catch(() => {});
                chrome.runtime.sendMessage({type: 'CLEAR_CONTEXT'}).catch(() => {});
            }, 2000);
        }
        if (msg.type === 'CLEAR_CONTEXT') {
            chrome.storage.session.remove(['lastContext', 'lastFocusState']).catch(() => {});
        }
        if (msg.type === 'URL_CHANGED') {
            if (focusTimer) { clearTimeout(focusTimer); focusTimer = null; }
        }
        chrome.runtime.sendMessage(msg).catch(() => {});
    } else {
        if (msg.type === 'GET_INITIAL_CONTEXT') {
            chrome.storage.session.get(['lastContext', 'lastFocusState']).then((data) => {
                if (data.lastContext) {
                    const resp = { ...data.lastContext, _focused: data.lastFocusState === 'focused' };
                    console.log('[background] GET_INITIAL_CONTEXT returning pageUrl:', resp.pageUrl?.slice(0,60), '_focused:', resp._focused);
                    sendResponse(resp);
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
