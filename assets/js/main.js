document.getElementById('year').textContent = new Date().getFullYear();

// Mobile nav toggle
const menuBtn = document.getElementById('menuBtn');
const navMobile = document.getElementById('navMobile');
menuBtn.addEventListener('click', () => {
  navMobile.classList.toggle('open');
});
navMobile.querySelectorAll('a').forEach(a => {
  a.addEventListener('click', () => navMobile.classList.remove('open'));
});

// Reveal on scroll
const revealEls = document.querySelectorAll('.reveal');
const io = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('in');
      io.unobserve(entry.target);
    }
  });
}, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
revealEls.forEach(el => io.observe(el));

// Product category tabs (jump + filter)
const tabs = document.querySelectorAll('#productTabs .tab-btn');
const groups = document.querySelectorAll('#productGrid .product-group');
tabs.forEach(tab => {
  tab.addEventListener('click', () => {
    tabs.forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    const target = tab.dataset.tab;
    groups.forEach(group => {
      const match = target === 'all' || group.dataset.tab === target;
      group.classList.toggle('hidden', !match);
    });
    if (target !== 'all') {
      const visible = document.querySelector(`.product-group[data-tab="${target}"]`);
      if (visible) visible.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });
});

// FAQ accordion
document.querySelectorAll('.accordion-item').forEach(item => {
  const q = item.querySelector('.accordion-q');
  const a = item.querySelector('.accordion-a');
  const setHeight = () => { a.style.maxHeight = item.classList.contains('open') ? a.scrollHeight + 'px' : '0px'; };
  setHeight();
  q.addEventListener('click', () => {
    document.querySelectorAll('.accordion-item').forEach(other => {
      if (other !== item) {
        other.classList.remove('open');
        other.querySelector('.accordion-a').style.maxHeight = '0px';
      }
    });
    item.classList.toggle('open');
    setHeight();
  });
});

// Back to top
const toTop = document.getElementById('toTop');
window.addEventListener('scroll', () => {
  toTop.classList.toggle('show', window.scrollY > 480);
});
toTop.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));

const qmTop = document.getElementById('qmTop');
if (qmTop) qmTop.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));

// Hero stat count-up
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const statEls = document.querySelectorAll('[data-count-to]');
if (statEls.length) {
  const statIO = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      const el = entry.target;
      const target = parseInt(el.dataset.countTo, 10);
      const suffix = el.dataset.suffix || '';
      statIO.unobserve(el);
      if (prefersReducedMotion) {
        el.textContent = target + suffix;
        return;
      }
      const duration = 1100;
      const start = performance.now();
      const tick = (now) => {
        const p = Math.min((now - start) / duration, 1);
        const eased = 1 - Math.pow(1 - p, 3);
        el.textContent = Math.round(target * eased) + suffix;
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
  }, { threshold: 0.4 });
  statEls.forEach(el => statIO.observe(el));
}

// Load the embedded map only if Google is actually reachable, so the
// address fallback stays visible on offline/blocked networks instead of
// being covered by a broken frame.
const mapFrame = document.getElementById('mapFrame');
if (mapFrame && mapFrame.dataset.src) {
  const probe = new Image();
  let settled = false;
  const ok = () => {
    if (settled) return;
    settled = true;
    mapFrame.src = mapFrame.dataset.src;
    mapFrame.classList.add('ready');
  };
  const fail = () => { settled = true; };
  probe.onload = ok;
  probe.onerror = fail;
  setTimeout(fail, 4000);
  probe.src = 'https://maps.gstatic.com/mapfiles/api-3/images/spotlight-poi2.png?_=' + Date.now();
}

// Notice popup on first visit (with "hide for today" preference)
const popup = document.getElementById('noticePopup');
if (popup) {
  const STORE_KEY = 'sls_notice_hidden_until';
  const todayKey = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };
  const readPref = () => {
    try { return localStorage.getItem(STORE_KEY); } catch (e) { return null; }
  };
  const writePref = (v) => {
    try { localStorage.setItem(STORE_KEY, v); } catch (e) { /* private mode */ }
  };

  const todayBox = document.getElementById('popupToday');
  let lastFocus = null;

  const openPopup = () => {
    lastFocus = document.activeElement;
    popup.hidden = false;
    document.body.style.overflow = 'hidden';
    requestAnimationFrame(() => popup.classList.add('show'));
    const closeBtn = document.getElementById('popupClose');
    if (closeBtn) closeBtn.focus({ preventScroll: true });
    document.addEventListener('keydown', onKey);
  };

  const closePopup = () => {
    if (todayBox && todayBox.checked) writePref(todayKey());
    popup.classList.remove('show');
    document.body.style.overflow = '';
    document.removeEventListener('keydown', onKey);
    const done = () => { popup.hidden = true; };
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) done();
    else setTimeout(done, 260);
    if (lastFocus && typeof lastFocus.focus === 'function') lastFocus.focus({ preventScroll: true });
  };

  function onKey(e) {
    if (e.key === 'Escape') closePopup();
  }

  ['popupClose', 'popupClose2', 'popupGo'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('click', closePopup);
  });
  popup.addEventListener('click', (e) => {
    if (e.target === popup) closePopup();
  });

  if (readPref() !== todayKey()) {
    setTimeout(openPopup, 600);
  }
}
