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

// Product tabs filter
const tabs = document.querySelectorAll('#productTabs .tab-btn');
const cards = document.querySelectorAll('#productGrid .product-card');
tabs.forEach(tab => {
  tab.addEventListener('click', () => {
    tabs.forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    const target = tab.dataset.tab;
    cards.forEach(card => {
      const match = target === 'all' || card.dataset.tab === target;
      card.classList.toggle('hidden', !match);
    });
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
