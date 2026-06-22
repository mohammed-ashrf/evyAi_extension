chrome.runtime.onInstalled.addListener(() => {
    chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
});

chrome.runtime.onMessage.addListener((msg, sender) => {
    if (sender.tab) {
        chrome.runtime.sendMessage(msg).catch(() => {});
    } else {
        chrome.tabs.query({ active: true, currentWindow: true }).then(tabs => {
            if (tabs[0]?.id) {
                chrome.tabs.sendMessage(tabs[0].id, msg).catch(() => {});
            }
        });
    }
});
