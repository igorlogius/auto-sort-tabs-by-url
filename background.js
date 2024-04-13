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
  timerIds.set(winId, setTimeout(sortTabs.bind(null, winId), 3000));
}

async function onTabUpdated(tabId, changeInfo, tabInfo) {
  if (changeInfo.url) {
    delayedSort(tabInfo.windowId);
  }
}

async function onTabMoved(tabId, moveInfo) {
  delayedSort(moveInfo.windowId);
}

function onBAClicked(tab, info) {
  if (enabled) {
    enabled = false;
    browser.browserAction.setBadgeText({ text: "OFF" });
    browser.browserAction.setBadgeBackgroundColor({ color: "red" });
    browser.tabs.onUpdated.removeListener(onTabUpdated);
    browser.tabs.onMoved.removeListener(onTabMoved);
  } else {
    enabled = true;
    browser.browserAction.setBadgeText({ text: "ON" });
    browser.browserAction.setBadgeBackgroundColor({ color: "green" });
    delayedSort(tab.windowId);
    browser.tabs.onUpdated.addListener(onTabUpdated, { properties: ["url"] });
    browser.tabs.onMoved.addListener(onTabMoved);
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
    sortAllWindows();
    browser.tabs.onUpdated.addListener(onTabUpdated, { properties: ["url"] });
    browser.tabs.onMoved.addListener(onTabMoved);
  } else {
    browser.browserAction.setBadgeText({ text: "OFF" });
    browser.browserAction.setBadgeBackgroundColor({ color: "red" });
  }

  //
  browser.browserAction.onClicked.addListener(onBAClicked);
})();

browser.menus.create({
  title: "Sort Tabs (Current Window)",
  contexts: ["browser_action"],
  onclick: (tab) => {
    sortThisWindow();
  },
});

browser.menus.create({
  title: "Sort Tabs (All Windows)",
  contexts: ["browser_action"],
  onclick: (tab) => {
    sortAllWindows();
  },
});

async function sortAllWindows() {
  (await browser.windows.getAll({ populate: false, windowTypes: ["normal"] }))
    .map((w) => w.id)
    .forEach((wid) => {
      delayedSort(wid);
    });
}

async function sortThisWindow() {
  const cwin = await browser.windows.getCurrent({
    populate: false,
    //windowTypes: ["normal"],
  });
  delayedSort(cwin.id);
}

browser.commands.onCommand.addListener(async (cmd) => {
  if (cmd === "sortThisWindow") {
    sortFocusedWindow();
  } else if (cmd === "sortAllWindows") {
    sortAllWindows();
  }
});
