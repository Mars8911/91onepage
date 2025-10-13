// /js/main.js  — Overlay + API + 動態 manifest（單檔整合版）
document.addEventListener('DOMContentLoaded', () => {
  // ================================
  // 基本設定 & 工具
  // ================================
  const $  = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));

  // 後端路徑（若未在同網域，請自行加上完整域名）
  const API = {
    manifest: (code) => `/manifest.json?channelCode=${encodeURIComponent(code)}`,
    info:     (code) => `/pwa/channel/${encodeURIComponent(code)}`,
    install:  (code) => `/pwa/install/${encodeURIComponent(code)}`
  };

  // channelCode：URL -> localStorage -> 預設
  function getChannelCode() {
    const params = new URLSearchParams(location.search);
    const code = params.get("channelCode") || localStorage.getItem("channelCode") || "01031111453717";
    localStorage.setItem("channelCode", code);
    return code;
  }
  const channelCode = getChannelCode();

  // 平台偵測
  const ua = navigator.userAgent || '';
  const isAndroid = /Android/i.test(ua);
  const isIOS = /iPhone|iPad|iPod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isStandalone = window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;

  // ================================
  // 動態掛 manifest
  // ================================
  function attachManifestLink(code){
    const old = document.querySelector('link[rel="manifest"]');
    if (old) old.remove();
    const link = document.createElement('link');
    link.rel = 'manifest';
    link.href = API.manifest(code);
    document.head.appendChild(link);
  }
  attachManifestLink(channelCode);

  // ================================
  // Overlay（你的版本整合、去重 & 專案化）
  // ================================
  const overlay = document.getElementById(isIOS ? 'overlay-ios' : 'overlay-android');
  const other   = document.getElementById(isIOS ? 'overlay-android' : 'overlay-ios');

  if (other)   other.setAttribute('hidden','');
  if (overlay) overlay.removeAttribute('hidden');

  function initOverlay(overlayEl, offsets){
    if (!overlayEl) return;

    const sheet   = overlayEl.querySelector('.install-sheet');
    const handTop = overlayEl.querySelector('.hand-top');
    const handBot = overlayEl.querySelector('.hand-bottom');
    const b1 = overlayEl.querySelector('.step1-badge');
    const b2 = overlayEl.querySelector('.step2-badge');

    let visible = false;
    let justClosedAt = 0;
    const REOPEN_DELAY = 80;

    function open(){
      overlayEl.classList.add('show');
      overlayEl.setAttribute('aria-hidden','false');
      visible = true;
    }
    function close(){
      overlayEl.classList.remove('show');
      overlayEl.setAttribute('aria-hidden','true');
      visible = false;
      justClosedAt = performance.now();
    }

    // 初次顯示（僅在未安裝/非 standalone）
    if (!isStandalone) open();

    // 點黑幕關閉（點卡片不關）
    overlayEl.addEventListener('pointerup', e => { if (e.target === overlayEl){ e.stopPropagation(); close(); } });
    if (sheet) sheet.addEventListener('pointerup', e => e.stopPropagation());

    // 點頁面任意處再次開啟
    const reopen = e => {
      if (visible) return;
      if (performance.now() - justClosedAt < REOPEN_DELAY) return;
      if (overlayEl.contains(e.target)) return;
      if (isStandalone) return; // 已安裝就不再開
      open();
      relayout();
    };
    document.addEventListener('pointerup', reopen, true);

    // 手指對齊到徽章中心
    function centerHandOn(hand, badge, dy=0, dx=0){
      if (!hand || !badge || !sheet) return;
      const s = sheet.getBoundingClientRect();
      const r = badge.getBoundingClientRect();
      hand.style.left = (r.left + r.width/2  - s.left - hand.offsetWidth/2 + dx) + 'px';
      hand.style.top  = (r.top  + r.height/2 - s.top  - hand.offsetHeight/2 + dy) + 'px';
    }
    function relayout(){
      centerHandOn(handTop, b1, offsets?.top?.dy ?? 0,    offsets?.top?.dx ?? 0);
      centerHandOn(handBot, b2, offsets?.bottom?.dy ?? 0, offsets?.bottom?.dx ?? 0);
    }
    setTimeout(relayout, 100);
    window.addEventListener('resize', relayout);
  }

  // 啟用 overlay（使用你提供的偏移）
  initOverlay(
    overlay,
    isIOS
      ? { top:{dy:250,dx:0},  bottom:{dy:300,dx:100} }   // iOS 偏移
      : { top:{dy:20,dx:30},  bottom:{dy:40,dx:-40} }    // Android 偏移
  );

  // iOS 專用：輪播上/下兩個 guide GIF（若存在）
  (function rotateIOSGuides(){
    const ios = document.getElementById('overlay-ios');
    if (!ios) return;
    const g1 = ios.querySelector('#step-guide-1');
    const g2 = ios.querySelector('#step-guide-2');
    if (!g1 || !g2) return;
    let showTop = true;
    setInterval(() => {
      showTop = !showTop;
      g1.style.display = showTop ? 'block' : 'none';
      g2.style.display = showTop ? 'none'  : 'block';
    }, 2500);
  })();

  // ================================
  // A2HS 安裝流程 + 計數
  // ================================
  let deferredPrompt = null;
  const ctaBtn = $('.app-header .app-cta'); // 右側「Nhận」按鈕

  // Android：原生 beforeinstallprompt
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;

    if (ctaBtn) {
      ctaBtn.onclick = async () => {
        // 若已有原生安裝提示，直接呼叫；否則開啟教學遮罩
        if (deferredPrompt) {
          overlay && overlay.classList.remove('show'); // 關掉遮罩避免擋
          await deferredPrompt.prompt();
          await deferredPrompt.userChoice;
          deferredPrompt = null;
        } else {
          // 沒拿到事件（某些瀏覽器）→ 顯示對應遮罩
          if (!isIOS && overlay) overlay.classList.add('show');
        }
      };
    }
  });

  // iOS / 沒有 beforeinstallprompt：用 CTA 打開你的遮罩
  if (ctaBtn) {
    ctaBtn.addEventListener('click', () => {
      if (isStandalone) return;
      if (!deferredPrompt && overlay) overlay.classList.add('show');
    });
  }

  // 安裝成功 → 計數
  window.addEventListener('appinstalled', () => {
    fetch(API.install(channelCode)).catch(()=>{});
    if (overlay) overlay.classList.remove('show');
    console.log('PWA installed');
  });

  // ================================
  // Info API → 注入到你既有 DOM
  // ================================
  const els = {
    // Header
    appIcon:   $('.app-header .app-icon'),
    appTitle:  $('.app-header .app-title'),
    appSub:    $('.app-header .app-subtitle'),

    // Info 三欄
    infoRatingSmall: $('.app-info .col-4.app-info-item.border-end .small.text-muted'),
    infoRatingBig:   $('.app-info .col-4.app-info-item.border-end .fw-bold.fs-5'),
    infoStars:       $('.app-info .col-4.app-info-item.border-end .stars'),
    infoDevSmall:    $('.app-info .col-4.app-info-item:last-child .small'),

    // 橫向滑動截圖（取前三張塞到現有三個 <img>）
    scrollImgs: $$('.app-scroll .app-card img'),

    // 描述區
    descText: $('.app-desc p'),
    devLink:  $('.app-desc .dev-link'),

    // 右側評分區
    ratingBigRight:  $('.app-ratings .rating-big'),
    ratingSubRight:  $('.app-ratings .rating-sub'),
    ratingCountRight:$('.app-ratings .rating-count'),

    // 底部資訊
    infoAge:  $('.info-section .info-item:nth-child(3) .value'),
    infoProv: $('.info-section .info-item:nth-child(5) .value'),
  };

  function renderStars(score){
    const full = Math.max(0, Math.min(5, Math.round(Number(score||0))));
    return "★★★★★".slice(0, full) + "☆☆☆☆☆".slice(0, 5 - full);
  }

  async function loadAndRenderInfo(code){
    try{
      const res = await fetch(API.info(code));
      if (!res.ok) throw new Error(`info api HTTP ${res.status}`);
      const json = await res.json();
      if (json?.status !== 'success' || !json?.data) throw new Error('info api format error');
      const d = json.data;

      // Header
      if (els.appTitle) els.appTitle.textContent = d.title || '—';
      if (els.appSub)   els.appSub.textContent   = d.developer_name || '';
      if (els.appIcon && d.desktop_icon_url) els.appIcon.src = d.desktop_icon_url;

      // Info 左欄：評分/評論數
      const score = Number(d.score ?? 0) || 0;
      const reviewers = Number(d.number_of_reviewers ?? 0) || 0;
      if (els.infoRatingBig)   els.infoRatingBig.textContent = score.toFixed(1);
      if (els.infoRatingSmall) els.infoRatingSmall.textContent = `${reviewers.toLocaleString()} đánh giá`;
      if (els.infoStars)       els.infoStars.textContent = renderStars(score);

      // Info 右欄：開發商小字
      if (els.infoDevSmall) els.infoDevSmall.textContent = d.developer_name || '';

      // 橫向截圖
      const shots = Array.isArray(d.screenshots) ? d.screenshots.map(s => s.url).filter(Boolean) : [];
      els.scrollImgs.forEach((img, i) => { if (shots[i]) img.src = shots[i]; });

      // 描述/開發商連結
      if (els.descText) els.descText.textContent = d.introduction || els.descText.textContent;
      if (els.devLink)  els.devLink.textContent  = d.developer_name || els.devLink.textContent;

      // 右側評分區
      if (els.ratingBigRight)   els.ratingBigRight.textContent = score.toFixed(1);
      if (els.ratingSubRight)   els.ratingSubRight.textContent = `Đánh giá: ${Math.max(1, Math.min(5, Math.round(score)))}`;
      if (els.ratingCountRight) els.ratingCountRight.textContent = `${reviewers.toLocaleString()} đánh giá`;

      // 底部資訊
      if (els.infoAge)  els.infoAge.textContent  = d.suitable_age || els.infoAge.textContent;
      if (els.infoProv) els.infoProv.textContent = d.developer_name || els.infoProv.textContent;

      // 頁面標題
      if (d.title) document.title = d.title;

    }catch(err){
      console.error('load info failed:', err);
    }
  }
  loadAndRenderInfo(channelCode);
});
