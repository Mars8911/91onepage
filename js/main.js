// /js/main.js — 強制反轉 overlay + 動態 manifest + Info
document.addEventListener('DOMContentLoaded', () => {
  const $  = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));

  const API = {
    manifest: (code) => `/manifest.json?channelCode=${encodeURIComponent(code)}`,
    info:     (code) => `/pwa/channel/${encodeURIComponent(code)}`,
    install:  (code) => `/pwa/install/${encodeURIComponent(code)}`
  };

  function getChannelCode() {
    const params = new URLSearchParams(location.search);
    const code = params.get("channelCode") || localStorage.getItem("channelCode") || "01031111453717";
    localStorage.setItem("channelCode", code);
    return code;
  }
  const channelCode = getChannelCode();

  // ── 平台偵測
  const ua = navigator.userAgent || '';
  const isAndroid   = /Android/i.test(ua);
  const isIOS       = /iPhone|iPad|iPod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isStandalone = window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;

  // ── 動態掛 manifest
  (function attachManifestLink(code){
    const old = document.querySelector('link[rel="manifest"]');
    if (old) old.remove();
    const link = document.createElement('link');
    link.rel = 'manifest';
    link.href = API.manifest(code);
    document.head.appendChild(link);
  })(channelCode);

  // ── 反轉規則：偵測 Android → 用 iOS overlay；偵測 iOS → 用 Android overlay
  const useIOSOverlay = isAndroid;

  // 先取兩個 overlay
  const iosEl  = document.getElementById('overlay-ios');
  const andEl  = document.getElementById('overlay-android');

  // 【關鍵 1】先把兩個 overlay 統一清成關閉狀態，避免其它腳本殘留
  [iosEl, andEl].forEach(el => {
    if (!el) return;
    el.classList.remove('show');
    el.setAttribute('aria-hidden', 'true');
    el.removeAttribute('hidden');     // 讓顯示全由 .show 控制（CSS 有 .install-overlay{display:none} & .show{display:block}）
  });

  // 這一輪要使用的 overlay（已反轉）
  const overlay = useIOSOverlay ? iosEl : andEl;
  const other   = useIOSOverlay ? andEl : iosEl;

  // console.log('[Overlay Switch]',
  //   { isIOS, isAndroid, useIOSOverlay, chosen: overlay?.id, other: other?.id, isStandalone }
  // );

  // 【關鍵 2】另一個 overlay 直接「硬禁止」
  if (other) {
    other.classList.remove('show');
    other.setAttribute('aria-hidden', 'true');
    other.setAttribute('data-disabled-by-main', '1'); // 標記，方便查問題
  }

  function initOverlay(el, offsets){
    if (!el) return;

    const sheet   = el.querySelector('.install-sheet');
    const handTop = el.querySelector('.hand-top');
    const handBot = el.querySelector('.hand-bottom');
    const b1      = el.querySelector('.step1-badge');
    const b2      = el.querySelector('.step2-badge');

    // ✅ 新增：桌機判斷 & 關閉記錄
  const isDesktop = window.matchMedia('(min-width: 768px)').matches;
  const DISMISS_KEY = 'overlayDismissed';
  const wasDismissed = localStorage.getItem(DISMISS_KEY) === '1'

    let visible = false;
    let justClosedAt = 0;
    const REOPEN_DELAY = 80;

    const open  = () => { el.classList.add('show'); el.setAttribute('aria-hidden','false'); visible = true; };
    const close = () => { el.classList.remove('show'); el.setAttribute('aria-hidden','true');  visible = false; justClosedAt = performance.now(); };

    // 初次顯示（未安裝）
    if (!isStandalone) open();

    el.addEventListener('pointerup', (e) => { if (e.target === el){ e.stopPropagation(); close(); } });
    if (sheet) sheet.addEventListener('pointerup', (e) => e.stopPropagation());

    const reopen = (e) => {
      if (visible) return;
      if (performance.now() - justClosedAt < REOPEN_DELAY) return;
      if (el.contains(e.target)) return;
      if (isStandalone) return;
      open(); relayout();
    };
    document.addEventListener('pointerup', reopen, true);

    const centerHandOn = (hand, badge, dy=0, dx=0) => {
      if (!hand || !badge || !sheet) return;
      const s = sheet.getBoundingClientRect();
      const r = badge.getBoundingClientRect();
      hand.style.left = (r.left + r.width/2  - s.left - hand.offsetWidth/2 + dx) + 'px';
      hand.style.top  = (r.top  + r.height/2 - s.top  - hand.offsetHeight/2 + dy) + 'px';
    };

    function relayout(){
      centerHandOn(handTop, b1, offsets?.top?.dy ?? 0,    offsets?.top?.dx ?? 0);
      centerHandOn(handBot, b2, offsets?.bottom?.dy ?? 0, offsets?.bottom?.dx ?? 0);
    }
    setTimeout(relayout, 100);
    window.addEventListener('resize', relayout);
  }

  // 依「反轉後」的 overlay 套對應偏移
  initOverlay(
    overlay,
    useIOSOverlay
      ? { top:{dy:250,dx:0},  bottom:{dy:300,dx:100} }   // iOS 規格偏移（現在用在 Android 裝置）
      : { top:{dy:20,dx:30},  bottom:{dy:40,dx:-40} }    // Android 規格偏移（現在用在 iOS 裝置）
  );

  // iOS 教學輪播：只有在「使用 iOS overlay」時啟動（也就是偵測到 Android）
  (function rotateIOSGuides(){
    if (!useIOSOverlay) return;
    const el = iosEl;
    if (!el) return;
    const g1 = el.querySelector('#step-guide-1');
    const g2 = el.querySelector('#step-guide-2');
    if (!g1 || !g2) return;
    let showTop = true;
    setInterval(() => {
      showTop = !showTop;
      g1.style.display = showTop ? 'block' : 'none';
      g2.style.display = showTop ? 'none'  : 'block';
    }, 2500);
  })();

  // ── A2HS（所有顯示/關閉都只碰「反轉後」overlay）
  let deferredPrompt = null;
  const ctaBtn = $('.app-header .app-cta');

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;

    if (ctaBtn) {
      ctaBtn.onclick = async () => {
        if (deferredPrompt) {
          overlay && overlay.classList.remove('show');
          await deferredPrompt.prompt();
          await deferredPrompt.userChoice;
          deferredPrompt = null;
        } else {
          overlay && overlay.classList.add('show');
        }
      };
    }
  });

  if (ctaBtn) {
    ctaBtn.addEventListener('click', () => {
      if (isStandalone) return;
      if (!deferredPrompt) overlay && overlay.classList.add('show');
    });
  }

  window.addEventListener('appinstalled', () => {
    fetch(API.install(channelCode)).catch(()=>{});
    overlay && overlay.classList.remove('show');
    // console.log('PWA installed');
  });

  // ── Info API：以下與你原版相同（略過不動） ─────────────────────────
  const els = {
    appIcon:   $('.app-header .app-icon'),
    appTitle:  $('.app-header .app-title'),
    appSub:    $('.app-header .app-subtitle'),

    infoRatingSmall: $('.app-info .col-4.app-info-item.border-end .small.text-muted'),
    infoRatingBig:   $('.app-info .col-4.app-info-item.border-end .fw-bold.fs-5'),
    infoStars:       $('.app-info .col-4.app-info-item.border-end .stars'),
    infoDevSmall:    $('.app-info .col-4.app-info-item:last-child .small'),

    scrollImgs: $$('.app-scroll .app-card img'),

    descText: $('.app-desc p'),
    devLink:  $('.app-desc .dev-link'),

    ratingBigRight:  $('.app-ratings .rating-big'),
    ratingSubRight:  $('.app-ratings .rating-sub'),
    ratingCountRight:$('.app-ratings .rating-count'),

    infoAge:  $('.info-section .info-item:nth-child(3) .value'),
    infoProv: $('.info-section .info-item:nth-child(5) .value'),
  };

  function renderStars(score){
    const full = Math.max(1, Math.min(5, Math.round(Number(score||0))));
    return "★★★★★".slice(0, full) + "☆☆☆☆☆".slice(0, 5 - full);
  }

  (async function loadAndRenderInfo(code){
    try{
      const res = await fetch(API.info(code));
      if (!res.ok) throw new Error(`info api HTTP ${res.status}`);
      const json = await res.json();
      if (json?.status !== 'success' || !json?.data) throw new Error('info api format error');
      const d = json.data;

      if (els.appTitle) els.appTitle.textContent = d.title || '—';
      if (els.appSub)   els.appSub.textContent   = d.developer_name || '';
      if (els.appIcon && d.desktop_icon_url) els.appIcon.src = d.desktop_icon_url;

      const score = Number(d.score ?? 0) || 0;
      const reviewers = Number(d.number_of_reviewers ?? 0) || 0;
      if (els.infoRatingBig)   els.infoRatingBig.textContent = score.toFixed(1);
      if (els.infoRatingSmall) els.infoRatingSmall.textContent = `${reviewers.toLocaleString()} đánh giá`;
      if (els.infoStars)       els.infoStars.textContent = renderStars(score);

      if (els.infoDevSmall) els.infoDevSmall.textContent = d.developer_name || '';

      const shots = Array.isArray(d.screenshots) ? d.screenshots.map(s => s?.url).filter(Boolean) : [];
      els.scrollImgs.forEach((img, i) => { if (shots[i]) img.src = shots[i]; });

      if (els.descText) els.descText.textContent = d.introduction || els.descText.textContent;
      if (els.devLink)  els.devLink.textContent  = d.developer_name || els.devLink.textContent;

      if (els.ratingBigRight)   els.ratingBigRight.textContent = score.toFixed(1);
      if (els.ratingSubRight)   els.ratingSubRight.textContent = `Đánh giá: ${Math.max(1, Math.min(5, Math.round(score)))}`;
      if (els.ratingCountRight) els.ratingCountRight.textContent = `${reviewers.toLocaleString()} đánh giá`;

      if (els.infoAge)  els.infoAge.textContent  = d.suitable_age || els.infoAge.textContent;
      if (els.infoProv) els.infoProv.textContent = d.developer_name || els.infoProv.textContent;

      if (d.title) document.title = d.title;

    }catch(err){
      // console.error('load info failed:', err);
    }
  })(channelCode);
});
