// /js/api.js
(function (global) {
    "use strict";
  
    // 你的後端網域
    const API_BASE = "https://qqwb2demo-phpapi.winbet.gold";
  
    const API = {
      info:    (code) => `${API_BASE}/pwa/channel/${encodeURIComponent(code)}/`,
      install: (code) => `${API_BASE}/pwa/install/${encodeURIComponent(code)}`
    };
  
    // URL -> localStorage -> 預設
    function getChannelCode(defaultCode = "01031111453717") {
      const params = new URLSearchParams(location.search);
      const code =
        params.get("channelCode") ||
        localStorage.getItem("channelCode") ||
        defaultCode;
      localStorage.setItem("channelCode", code);
      return code;
    }
  
    async function fetchChannelInfo(code) {
      const res = await fetch(API.info(code), { credentials: "omit" });
      if (!res.ok) throw new Error(`info api HTTP ${res.status}`);
      const json = await res.json();
      if (json?.status !== "success" || !json?.data) {
        throw new Error("info api format error");
      }
      return json.data; // 直接回傳 data
    }
  
    async function reportInstalled(code) {
      try { await fetch(API.install(code), { method: "POST" }); } catch (_) {}
    }
  
    global.PWAApi = {
      API_BASE,
      API,
      getChannelCode,
      fetchChannelInfo,
      reportInstalled,
    };
  })(window);
  