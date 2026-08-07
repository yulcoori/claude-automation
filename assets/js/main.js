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

// Hero slideshow
const heroSlides = document.querySelectorAll('.hero-slide');
const heroDots = document.getElementById('heroDots');
if (heroSlides.length > 1 && heroDots) {
  let idx = 0;
  let timer = null;

  heroSlides.forEach((_, i) => {
    const dot = document.createElement('button');
    dot.type = 'button';
    dot.setAttribute('aria-label', `${i + 1}번 슬라이드 보기`);
    if (i === 0) dot.classList.add('on');
    dot.addEventListener('click', () => { show(i); restart(); });
    heroDots.appendChild(dot);
  });
  const dots = heroDots.querySelectorAll('button');

  function show(n) {
    idx = n;
    heroSlides.forEach((s, i) => s.classList.toggle('is-active', i === n));
    dots.forEach((d, i) => d.classList.toggle('on', i === n));
  }
  function next() { show((idx + 1) % heroSlides.length); }
  function restart() {
    clearInterval(timer);
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      timer = setInterval(next, 5000);
    }
  }
  restart();
}
