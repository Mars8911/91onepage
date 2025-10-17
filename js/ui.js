// /js/ui.js
(function (global) {
  "use strict";

  // 小工具
  const nl2br = (s = "") => String(s).replace(/\r?\n/g, "<br>");
  const clampStar = (x) => Math.max(1, Math.min(5, Math.round(Number(x || 0))));
  const renderStars = (score) => {
    const n = clampStar(score);
    return "★★★★★".slice(0, n) + "☆☆☆☆☆".slice(0, 5 - n);
  };

  // 平台偵測
  const ua = navigator.userAgent || "";
  let isAndroid = /Android/i.test(ua);
  let isIOS =
    /iPhone|iPad|iPod/i.test(ua) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const isStandalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    window.navigator.standalone === true;

  // 依你的 HTML 結構抓 DOM
  const els = {
    // Header
    appIcon: document.querySelector(".app-header .app-icon"),
    appTitle: document.querySelector(".app-header .app-title"),
    appSub: document.querySelector(".app-header .app-subtitle"),
    ctaBtn: document.querySelector(".app-header .app-cta"),

    // Info（第一欄：評分/評論數/星星）
    infoRatingSmall: document.querySelector(
      ".app-info .col-4.app-info-item.border-end .small.text-muted"
    ),
    infoRatingBig: document.querySelector(
      ".app-info .col-4.app-info-item.border-end .fw-bold.fs-5"
    ),
    infoStars: document.querySelector(
      ".app-info .col-4.app-info-item.border-end .stars"
    ),

    // 第三欄的開發商小字
    infoDevSmall: document.querySelector(
      ".app-info .col-4.app-info-item:last-child .small"
    ),

    // 橫向截圖（前三張）
    scrollImgs: Array.from(
      document.querySelectorAll(".app-scroll .app-card img")
    ),

    // 描述/開發商
    descText: document.querySelector(".app-desc p"),
    devLink: document.querySelector(".app-desc .dev-link"),

    // 右側評分
    ratingBigRight: document.querySelector(".app-ratings .rating-big"),
    ratingSubRight: document.querySelector(".app-ratings .rating-sub"),
    ratingCountRight: document.querySelector(".app-ratings .rating-count"),

    // 最底 Information 區
    infoAge: document.querySelector(".info-section .info-item:nth-child(2) .value"),
    infoProv: document.querySelector(".info-section .info-item:nth-child(3) .value"),

    // Overlays
    overlayIOS: document.getElementById("overlay-ios"),
    overlayAndroid: document.getElementById("overlay-android"),
  };

  // ===== 僅供「黑幕 overlay」反轉平台用：把 iOS/Android 對調 =====
  function overlayPlatform() {
    // 偵測到 Android → 使用 iOS overlay；偵測到 iOS → 使用 Android overlay
    return { isIOS: isAndroid, isAndroid: isIOS };
  }

  // 將 API data → 塞入你的畫面
  function renderInfo(d) {
    // Header
    if (els.appTitle) els.appTitle.textContent = d.title || "—";
    if (els.appSub) els.appSub.textContent = d.developer_name || "";
    if (els.appIcon && d.desktop_icon_url) els.appIcon.src = d.desktop_icon_url;

    // 評分/評論
    const score = Number(d.score ?? 0) || 0;
    const reviewers = Number(d.number_of_reviewers ?? 0) || 0;
    if (els.infoRatingBig) els.infoRatingBig.textContent = score.toFixed(1);
    if (els.infoRatingSmall)
      els.infoRatingSmall.textContent = `${reviewers.toLocaleString()} đánh giá`;
    if (els.infoStars) els.infoStars.textContent = renderStars(score);

    // 第三欄開發商小字
    if (els.infoDevSmall) els.infoDevSmall.textContent = d.developer_name || "";

    // 截圖（前三張）
    const shots = Array.isArray(d.screenshots)
      ? d.screenshots.map((s) => s?.url).filter(Boolean)
      : [];
    els.scrollImgs.forEach((img, i) => { if (shots[i]) img.src = shots[i]; });

    // 描述（保留換行）
    if (els.descText)
      els.descText.innerHTML = d.introduction ? nl2br(d.introduction) : (els.descText.innerHTML || "");

    // 介紹區的開發商連結文字
    if (els.devLink) els.devLink.textContent = d.developer_name || els.devLink.textContent;

    // 中段評分區
    if (els.ratingBigRight)   els.ratingBigRight.textContent   = score.toFixed(1);
    if (els.ratingSubRight)   els.ratingSubRight.textContent   = `Đánh giá: ${clampStar(score)}`;
    if (els.ratingCountRight) els.ratingCountRight.textContent = `${reviewers.toLocaleString()} đánh giá`;

    // 最底資訊
    if (els.infoAge)  els.infoAge.textContent  = d.suitable_age || els.infoAge.textContent;
    if (els.infoProv) els.infoProv.textContent = d.developer_name || els.infoProv.textContent;

    // 網頁標題
    if (d.title) document.title = d.title;
  }

  // Overlay（純樣式互動）— 只在這裡反轉平台
  function initOverlay() {
    const plat = overlayPlatform(); // ← 使用對調後的平台
    const overlay = plat.isIOS ? els.overlayIOS : els.overlayAndroid;
    const other   = plat.isIOS ? els.overlayAndroid : els.overlayIOS;

    if (other)   other.setAttribute("hidden", "");
    if (overlay) overlay.removeAttribute("hidden");
    if (!overlay) return;

    const sheet   = overlay.querySelector(".install-sheet");
    const handTop = overlay.querySelector(".hand-top");
    const handBot = overlay.querySelector(".hand-bottom");
    const b1      = overlay.querySelector(".step1-badge");
    const b2      = overlay.querySelector(".step2-badge");

    let visible = false;
    let justClosedAt = 0;
    const REOPEN_DELAY = 80;

    const open  = () => { overlay.classList.add("show");  overlay.setAttribute("aria-hidden","false"); visible = true; };
    const close = () => { overlay.classList.remove("show");overlay.setAttribute("aria-hidden","true");  visible = false; justClosedAt = performance.now(); };

    if (!isStandalone) open();

    overlay.addEventListener("pointerup", (e) => { if (e.target === overlay){ e.stopPropagation(); close(); } });
    if (sheet) sheet.addEventListener("pointerup", (e) => e.stopPropagation());

    const reopen = (e) => {
      if (visible) return;
      if (performance.now() - justClosedAt < REOPEN_DELAY) return;
      if (overlay.contains(e.target)) return;
      if (isStandalone) return;
      open(); relayout();
    };
    document.addEventListener("pointerup", reopen, true);

    const centerHandOn = (hand, badge, dy=0, dx=0) => {
      if (!hand || !badge || !sheet) return;
      const s = sheet.getBoundingClientRect();
      const r = badge.getBoundingClientRect();
      hand.style.left = (r.left + r.width/2  - s.left - hand.offsetWidth/2 + dx) + "px";
      hand.style.top  = (r.top  + r.height/2 - s.top  - hand.offsetHeight/2 + dy) + "px";
    };

    function relayout(){
      const offsets = plat.isIOS
        ? { top:{dy:250,dx:0}, bottom:{dy:300,dx:100} }   // 原 iOS 位移，現在用於「偵測到 Android」時
        : { top:{dy:20,dx:30},  bottom:{dy:40,dx:-40} };  // 原 Android 位移，現在用於「偵測到 iOS」時
      centerHandOn(handTop, b1, offsets.top.dy,    offsets.top.dx);
      centerHandOn(handBot, b2, offsets.bottom.dy, offsets.bottom.dx);
    }
    setTimeout(relayout, 100);
    window.addEventListener("resize", relayout);

    // 注意：這裡用 plat.isIOS（對調後的 iOS 規則）
    if (plat.isIOS) {
      const g1 = overlay.querySelector("#step-guide-1");
      const g2 = overlay.querySelector("#step-guide-2");
      if (g1 && g2) {
        let showTop = true;
        setInterval(() => {
          showTop = !showTop;
          g1.style.display = showTop ? "block" : "none";
          g2.style.display = showTop ? "none"  : "block";
        }, 2500);
      }
    }

    // 除錯資訊
    console.log("[overlay] detected:", { isIOS, isAndroid }, "use overlay:", plat.isIOS ? "#overlay-ios" : "#overlay-android");
  }

  // A2HS 安裝流程 — 只在這裡反轉 overlay 的選擇
  function initA2HS(channelCode, onInstalled) {
    const plat = overlayPlatform(); // ← 使用對調後的平台
    let deferredPrompt = null;

    window.addEventListener("beforeinstallprompt", (e) => {
      e.preventDefault();
      deferredPrompt = e;

      if (els.ctaBtn) {
        els.ctaBtn.onclick = async () => {
          if (deferredPrompt) {
            (plat.isIOS ? els.overlayIOS : els.overlayAndroid)?.classList?.remove?.("show");
            await deferredPrompt.prompt();
            await deferredPrompt.userChoice;
            deferredPrompt = null;
          } else {
            const overlay = plat.isIOS ? els.overlayIOS : els.overlayAndroid;
            overlay && overlay.classList.add("show");
          }
        };
      }
    });

    // iOS 或沒拿到 beforeinstallprompt：直接開教學
    if (els.ctaBtn) {
      els.ctaBtn.addEventListener("click", () => {
        if (isStandalone) return;
        if (!deferredPrompt) {
          const overlay = plat.isIOS ? els.overlayIOS : els.overlayAndroid;
          overlay && overlay.classList.add("show");
        }
      });
    }

    // 安裝完成
    window.addEventListener("appinstalled", () => {
      onInstalled && onInstalled(channelCode);
      const ov = plat.isIOS ? els.overlayIOS : els.overlayAndroid;
      ov && ov.classList.remove("show");
      console.log("PWA installed");
    });
  }

  // 匯出
  global.PWAUi = {
    isAndroid,
    isIOS,
    isStandalone,
    renderInfo,
    initOverlay,
    initA2HS,
  };
})(window);
