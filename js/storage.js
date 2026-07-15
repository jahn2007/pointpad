(function () {
  "use strict";

  const config = window.SCOREKEEPER_CONFIG;

  function load() {
    try {
      const raw = window.localStorage.getItem(config.storage.key);
      return raw ? JSON.parse(raw) : null;
    } catch (error) {
      console.warn("无法读取本地对局数据：", error);
      return null;
    }
  }

  function save(state) {
    try {
      window.localStorage.setItem(config.storage.key, JSON.stringify(state));
      return true;
    } catch (error) {
      console.warn("无法保存本地对局数据：", error);
      return false;
    }
  }

  function clear() {
    try {
      window.localStorage.removeItem(config.storage.key);
      return true;
    } catch (error) {
      console.warn("无法清除本地对局数据：", error);
      return false;
    }
  }

  window.ScoreStore = { load, save, clear };
})();
