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
  if (timerIds.has(winId)) {
    clearTimeout(timerIds.get(winId));
  }
  timerIds.set(winId, setTimeout(sortTabs.bind(null, winId), 1500));
}

async function onTabUpdated(tabId, changeInfo, tabInfo) {
  if (changeInfo.url) {
    delayedSort(tabInfo.windowId);
  }
}

async function sortFocusedWindow() {
  const cwin = await browser.windows.getCurrent({
    populate: false,
  });
  delayedSort(cwin.id);
}

function setBadgeOFF() {
  browser.browserAction.setBadgeText({ text: "OFF" });
  browser.browserAction.setBadgeBackgroundColor({ color: "red" });
}

function setBadgeON() {
  browser.browserAction.setBadgeText({ text: "ON" });
  browser.browserAction.setBadgeBackgroundColor({ color: "green" });
}

function onBAClicked(tab, info) {
  if (enabled) {
    enabled = false;
    setBadgeOFF();
    browser.tabs.onUpdated.removeListener(onTabUpdated);
  } else {
    enabled = true;
    setBadgeON();
    browser.tabs.onUpdated.addListener(onTabUpdated, { properties: ["url"] });
    delayedSort(tab.windowId);
  }
  setToStorage("enabled", enabled);
}

// init/restore
(async () => {
  enabled = await getFromStorage("boolean", "enabled", false);
  if (enabled) {
    setBadgeON();
    sortFocusedWindow();
    browser.tabs.onUpdated.addListener(onTabUpdated, { properties: ["url"] });
  } else {
    setBadgeOFF();
  }
  browser.browserAction.onClicked.addListener(onBAClicked);
})();
