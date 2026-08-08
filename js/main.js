/* ═══════════════════════════════════════════
   AGUADAS MÓVILES INTELIGENTES — Main JS
   ═══════════════════════════════════════════ */

document.addEventListener('DOMContentLoaded', () => {

  /* ─── HEADER SCROLL ─── */
  const header = document.querySelector('.header');
  const onScroll = () => {
    header.classList.toggle('header--scrolled', window.scrollY > 40);
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* ─── HAMBURGER MENU ─── */
  const hamburger = document.querySelector('.hamburger');
  const mobileNav = document.querySelector('.mobile-nav');
  if (hamburger && mobileNav) {
    hamburger.addEventListener('click', () => {
      hamburger.classList.toggle('open');
      mobileNav.classList.toggle('open');
      document.body.style.overflow = mobileNav.classList.contains('open') ? 'hidden' : '';
    });
    mobileNav.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => {
        hamburger.classList.remove('open');
        mobileNav.classList.remove('open');
        document.body.style.overflow = '';
      });
    });
  }

  /* ─── SMOOTH SCROLL ─── */
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', e => {
      const target = document.querySelector(anchor.getAttribute('href'));
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth' });
      }
    });
  });

  /* ─── REVEAL ON SCROLL ─── */
  const reveals = document.querySelectorAll('.reveal');
  if (reveals.length) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
    reveals.forEach(el => observer.observe(el));
  }

  /* ─── ACTIVE NAV HIGHLIGHT ─── */
  const sections = document.querySelectorAll('section[id]');
  const navLinks = document.querySelectorAll('.nav a[href^="#"]');
  const highlightNav = () => {
    let scrollY = window.scrollY + 120;
    sections.forEach(sec => {
      const top = sec.offsetTop;
      const height = sec.offsetHeight;
      const id = sec.getAttribute('id');
      if (scrollY >= top && scrollY < top + height) {
        navLinks.forEach(l => l.classList.remove('active'));
        const active = document.querySelector(`.nav a[href="#${id}"]`);
        if (active) active.classList.add('active');
      }
    });
  };
  window.addEventListener('scroll', highlightNav, { passive: true });



  /* ─── COUNTER ANIMATION ─── */
  const counters = document.querySelectorAll('[data-count]');
  if (counters.length) {
    const countObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const el = entry.target;
          const target = el.getAttribute('data-count');
          const isNumber = !isNaN(parseFloat(target));
          if (isNumber) {
            const end = parseFloat(target);
            const duration = 1200;
            const start = performance.now();
            const step = (now) => {
              const progress = Math.min((now - start) / duration, 1);
              const eased = 1 - Math.pow(1 - progress, 3);
              const current = eased * end;
              el.textContent = Number.isInteger(end) ? Math.round(current) : current.toFixed(1).replace('.', ',');
              if (progress < 1) requestAnimationFrame(step);
            };
            requestAnimationFrame(step);
          } else {
            el.textContent = target;
          }
          countObserver.unobserve(el);
        }
      });
    }, { threshold: 0.5 });
    counters.forEach(el => countObserver.observe(el));
  }

});
