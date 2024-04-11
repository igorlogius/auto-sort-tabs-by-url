/* global browser */

let enabled = false;
let timerIds = new Map();

async function getFromStorage(type, id, fallback) {
  let tmp = await browser.storage.local.get(id);
  return typeof tmp[id] === type ? tmp[id] : fallback;
}

async function setToStorage(id, value) {
  let obj = {};
  obj[id] = value;
  return browser.storage.local.set(obj);
}

async function sortTabs(winId) {
  const tmp = (await browser.tabs.query({ windowId: winId }))
    .sort((a, b) => {
      return a.url.localeCompare(b.url);
    })
    .map((t) => t.id);
  browser.tabs.move(tmp, { windowId: winId, index: -1 });
  timerIds.delete(winId);
}

function delayedSort(winId) {
  if (enabled) {
    if (timerIds.has(winId)) {
      clearTimeout(timerIds.get(winId));
    }
    timerIds.set(winId, setTimeout(sortTabs.bind(null, winId), 3000));
  }
}

async function onTabUpdated(tabId, changeInfo, tabInfo) {
  if (changeInfo.url) {
    delayedSort(tabInfo.windowId);
  }
}

async function onTabMoved(tabId, moveInfo) {
  delayedSort(moveInfo.windowId);
}

function onBAClicked(tab) {
  if (enabled) {
    enabled = false;
    browser.browserAction.setBadgeText({ text: "OFF" });
    browser.browserAction.setBadgeBackgroundColor({ color: "red" });
  } else {
    enabled = true;
    browser.browserAction.setBadgeText({ text: "ON" });
    browser.browserAction.setBadgeBackgroundColor({ color: "green" });
    delayedSort(tab.windowId);
  }
  setToStorage("enabled", enabled);
}

// restore icon status
(async () => {
  //
  enabled = await getFromStorage("boolean", "enabled", false);
  if (enabled) {
    browser.browserAction.setBadgeText({ text: "ON" });
    browser.browserAction.setBadgeBackgroundColor({ color: "green" });
    (await browser.windows.getAll({ populate: false, windowTypes: ["normal"] }))
      .map((w) => w.id)
      .forEach((wid) => {
        delayedSort(wid);
      });
  } else {
    browser.browserAction.setBadgeText({ text: "OFF" });
    browser.browserAction.setBadgeBackgroundColor({ color: "red" });
  }

  //
  browser.tabs.onUpdated.addListener(onTabUpdated, { properties: ["url"] });
  browser.browserAction.onClicked.addListener(onBAClicked);
  browser.tabs.onMoved.addListener(onTabMoved);
})();
