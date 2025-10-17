// /js/main.js — 反轉 overlay + 動態 manifest + Info（修正版）
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
  const isAndroid    = /Android/i.test(ua);
  const isIOS        = /iPhone|iPad|iPod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isStandalone = window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
  const isDesktop    = window.matchMedia('(min-width: 768px)').matches;

  // ── 動態掛 manifest
  (function attachManifestLink(code){
    const old = document.querySelector('link[rel="manifest"]');
    if (old) old.remove();
    const link = document.createElement('link');
    link.rel = 'manifest';
    link.href = API.manifest(code);
    document.head.appendChild(link);
  })(channelCode);

  // ── 反轉規則
  // 桌機 or Android → 用 iOS overlay；iOS → 用 Android overlay
  const useIOSOverlay = isAndroid || isDesktop;

  // 先取兩個 overlay
  const iosEl = document.getElementById('overlay-ios');
  const andEl = document.getElementById('overlay-android');

  // 【關鍵 1】進場：兩個 overlay 都先重置為關閉狀態（顯示完全由 .show 控制）
  [iosEl, andEl].forEach(el => {
    if (!el) return;
    el.classList.remove('show');
    el.setAttribute('aria-hidden', 'true');
    el.removeAttribute('hidden');
  });

  // 這一輪實際使用的（已反轉）
  const overlay = useIOSOverlay ? iosEl : andEl;
  const other   = useIOSOverlay ? andEl : iosEl;

  // 【關鍵 2】另一個 overlay 直接禁用
  if (other) {
    other.classList.remove('show');
    other.setAttribute('aria-hidden', 'true');
    other.setAttribute('data-disabled-by-main', '1');
  }

  function initOverlay(el, offsets){
    if (!el) return;

    const sheet   = el.querySelector('.install-sheet');
    const handTop = el.querySelector('.hand-top');
    const handBot = el.querySelector('.hand-bottom');
    const b1      = el.querySelector('.step1-badge');
    const b2      = el.querySelector('.step2-badge');

  // ✅ 桌機→sessionStorage、手機→localStorage（避免手機切裝置吃到桌機紀錄）
  const STORE = isDesktop ? sessionStorage : localStorage;
  const DISMISS_KEY = 'overlayDismissed:v1';

  const wasDismissed   = STORE.getItem(DISMISS_KEY) === '1';
  const shouldSuppress = wasDismissed; // 桌機用 sessionStorage，所以重開瀏覽器就不會抑制

  // 手機避免吃到桌機紀錄（保留你原本邏輯）
  if (!isDesktop && localStorage.getItem(DISMISS_KEY) === '1' && STORE !== localStorage) {
    localStorage.removeItem(DISMISS_KEY);
  }
    let visible = false;
    let justClosedAt = 0;
    const REOPEN_DELAY = 80;

    // 支援 force 參數：手動開啟不受 shouldSuppress 限制
    const open = (force = false) => {
      if (!force && shouldSuppress) return;
      el.classList.add('show');
      el.removeAttribute('hidden');
      el.setAttribute('aria-hidden','false');
      visible = true;
      // console.log('[Overlay] open()', { force, shouldSuppress });
    };

    const close = () => {
      // console.log('[Overlay] 關閉 overlay');
      el.classList.remove('show');
      el.setAttribute('aria-hidden','true');
      el.setAttribute('hidden','');
      visible = false;
      justClosedAt = performance.now();
      if (isDesktop) localStorage.setItem(DISMISS_KEY, '1');
    };

    // 點黑幕關閉（點到 overlay 本體才關）
    el.addEventListener('pointerup', (e) => {
      if (e.target === el){
        e.stopPropagation();
        close();
      }
    });

    // 點白卡不關閉
    if (sheet) sheet.addEventListener('pointerup', (e) => e.stopPropagation());

    // 初次顯示（未安裝）：自動開只看 shouldSuppress
    if (!isStandalone && !shouldSuppress) open();

    // 手動重新開啟（點頁面空白處）
    const tryReopen = (src) => {
      if (visible) return;
      if (performance.now() - justClosedAt < REOPEN_DELAY) return;
      if (isStandalone) return;
      open(true);   // 強制開啟
      relayout();
    };

    document.addEventListener('pointerup', (e) => {
      if (el.contains(e.target)) return; // 點在 overlay 內的元素，不觸發重開
      tryReopen('document');
    }, true);

    // 也提供一個全域方法給 Console/CTA 呼叫
    window.reopenOverlay = () => open(true);

    // 對齊動畫手指
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

  // iOS 教學輪播：只有在「使用 iOS overlay」時啟動（也就是偵測到 Android 或桌機）
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
          // 統一走強制開
          window.reopenOverlay && window.reopenOverlay();
        }
      };
    }
  });

  if (ctaBtn) {
    ctaBtn.addEventListener('click', () => {
      if (isStandalone) return;
      if (!deferredPrompt) {
        window.reopenOverlay && window.reopenOverlay();
      }
    });
  }

  window.addEventListener('appinstalled', () => {
    fetch(API.install(channelCode)).catch(()=>{});
    overlay && overlay.classList.remove('show');
  });

  // ── Info API（照你原版）
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
