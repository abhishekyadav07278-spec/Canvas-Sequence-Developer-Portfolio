(function () {
  'use strict';

  const TOTAL_FRAMES = 55;
  const canvas = document.getElementById('sequence-canvas');
  if (!canvas) return;

  const ctx = canvas.getContext('2d', { alpha: false });

  const images = new Array(TOTAL_FRAMES);
  let lastRenderedFrame = -1;
  let currentProgress = 0;
  let targetProgress = 0;
  let initialized = false;
  let lenisInstance = null;

  // Frame URL generator
  function getFrameUrl(index) {
    const pad = String(index).padStart(3, '0');
    return `./sequence/frame_${pad}.jpg`;
  }

  // Preload all frames efficiently
  function preloadImages() {
    // 1. Prioritize frame 0 for instant initial display
    const firstImg = new Image();
    firstImg.src = getFrameUrl(0);
    images[0] = firstImg;

    firstImg.onload = () => {
      if (lastRenderedFrame === -1) {
        drawFrame(0, true);
      }
    };

    if (firstImg.decode) {
      firstImg.decode().catch(() => {});
    }

    // 2. Preload remaining frames concurrently
    for (let i = 1; i < TOTAL_FRAMES; i++) {
      const img = new Image();
      img.src = getFrameUrl(i);
      images[i] = img;

      if (img.decode) {
        img.decode().catch(() => {});
      }
    }
  }

  // Retrieve the best loaded frame available
  function getBestFrame(index) {
    if (images[index] && images[index].complete && images[index].naturalWidth > 0) {
      return { img: images[index], isExact: true };
    }
    // Search backward first, then forward for nearest frame
    for (let offset = 1; offset < TOTAL_FRAMES; offset++) {
      const prev = index - offset;
      if (prev >= 0 && images[prev] && images[prev].complete && images[prev].naturalWidth > 0) {
        return { img: images[prev], isExact: false };
      }
      const next = index + offset;
      if (next < TOTAL_FRAMES && images[next] && images[next].complete && images[next].naturalWidth > 0) {
        return { img: images[next], isExact: false };
      }
    }
    return null;
  }

  // Draw frame with responsive object-fit: cover
  function drawFrame(index, force = false) {
    if (!force && index === lastRenderedFrame) return;

    const result = getBestFrame(index);
    if (!result || !result.img) return;

    const img = result.img;
    const w = canvas.width;
    const h = canvas.height;
    const imgW = img.naturalWidth || 592;
    const imgH = img.naturalHeight || 368;

    const scale = Math.max(w / imgW, h / imgH);
    const drawW = imgW * scale;
    const drawH = imgH * scale;
    const drawX = (w - drawW) / 2;
    const drawY = (h - drawH) / 2;

    ctx.drawImage(img, drawX, drawY, drawW, drawH);

    if (result.isExact) {
      lastRenderedFrame = index;
    }
  }

  // Resize canvas according to Device Pixel Ratio
  function resizeCanvas() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = window.innerWidth;
    const h = window.innerHeight;

    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    if (lastRenderedFrame >= 0) {
      drawFrame(lastRenderedFrame, true);
    } else {
      drawFrame(0, true);
    }
  }

  // Calculate current scroll progress (0.0 to 1.0)
  function getScrollProgress() {
    const scrollY = lenisInstance && typeof lenisInstance.scroll === 'number'
      ? lenisInstance.scroll
      : (window.pageYOffset || document.documentElement.scrollTop || window.scrollY || 0);

    const docHeight = Math.max(
      document.body.scrollHeight || 0,
      document.documentElement.scrollHeight || 0,
      document.body.offsetHeight || 0,
      document.documentElement.offsetHeight || 0,
      document.body.clientHeight || 0,
      document.documentElement.clientHeight || 0
    );

    const winHeight = window.innerHeight || document.documentElement.clientHeight || 1;
    const maxScroll = docHeight - winHeight;

    if (maxScroll <= 0) return 0;
    const progress = scrollY / maxScroll;
    return Math.min(1, Math.max(0, isNaN(progress) ? 0 : progress));
  }

  // Animation Loop with fluid momentum damping (LERP)
  function loop() {
    targetProgress = getScrollProgress();

    // Smooth inertia interpolation
    currentProgress += (targetProgress - currentProgress) * 0.095;

    // Snap tiny differences to eliminate idle jitter
    if (Math.abs(targetProgress - currentProgress) < 0.0001) {
      currentProgress = targetProgress;
    }

    const targetFrame = Math.min(
      TOTAL_FRAMES - 1,
      Math.max(0, Math.round(currentProgress * (TOTAL_FRAMES - 1)))
    );

    if (targetFrame !== lastRenderedFrame) {
      drawFrame(targetFrame);
    }

    requestAnimationFrame(loop);
  }

  // Initialize Lenis Smooth Scrolling
  function initLenis() {
    if (typeof window.Lenis !== 'undefined') {
      lenisInstance = new window.Lenis({
        duration: 1.2,
        easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
        smoothWheel: true,
        wheelMultiplier: 1.0,
        touchMultiplier: 1.5,
      });

      window.lenis = lenisInstance;

      function raf(time) {
        lenisInstance.raf(time);
        requestAnimationFrame(raf);
      }
      requestAnimationFrame(raf);
    }
  }

  // Interactive UI setup (smooth anchors, active nav, mobile menu, modal)
  function setupUIInteractions() {
    // 1. Smooth anchor navigation with Lenis support
    const navAnchors = document.querySelectorAll('a[href^="#"]');
    navAnchors.forEach((anchor) => {
      anchor.addEventListener('click', function (e) {
        const targetId = this.getAttribute('href');
        if (!targetId || targetId === '#') return;

        const targetElem = document.querySelector(targetId);
        if (targetElem) {
          e.preventDefault();

          // Close mobile menu if open
          const navMenu = document.getElementById('nav-menu');
          const mobileToggle = document.getElementById('mobile-toggle');
          if (navMenu && navMenu.classList.contains('open')) {
            navMenu.classList.remove('open');
            if (mobileToggle) mobileToggle.setAttribute('aria-expanded', 'false');
          }

          if (lenisInstance) {
            lenisInstance.scrollTo(targetElem, { offset: -30 });
          } else {
            targetElem.scrollIntoView({ behavior: 'smooth' });
          }
        }
      });
    });

    // 2. Mobile navigation toggle
    const mobileToggle = document.getElementById('mobile-toggle');
    const navMenu = document.getElementById('nav-menu');
    if (mobileToggle && navMenu) {
      mobileToggle.addEventListener('click', () => {
        const isOpen = navMenu.classList.toggle('open');
        mobileToggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
      });
    }

    // 3. Active Nav Link on Scroll (Intersection Observer)
    const sections = document.querySelectorAll('section[id]');
    const navLinks = document.querySelectorAll('.nav-link');

    const observerOptions = {
      root: null,
      rootMargin: '-20% 0px -60% 0px',
      threshold: 0,
    };

    const sectionObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const id = entry.target.getAttribute('id');
          navLinks.forEach((link) => {
            if (link.getAttribute('href') === `#${id}`) {
              link.classList.add('active');
            } else {
              link.classList.remove('active');
            }
          });
        }
      });
    }, observerOptions);

    sections.forEach((section) => sectionObserver.observe(section));

    // 4. Resume Modal
    const resumeBtn = document.getElementById('resume-btn');
    const resumeModal = document.getElementById('resume-modal');
    const modalCloseBtn = document.getElementById('modal-close-btn');
    const modalDismissBtn = document.getElementById('modal-dismiss-btn');

    function openModal() {
      if (resumeModal) {
        resumeModal.classList.add('active');
        resumeModal.setAttribute('aria-hidden', 'false');
      }
    }

    function closeModal() {
      if (resumeModal) {
        resumeModal.classList.remove('active');
        resumeModal.setAttribute('aria-hidden', 'true');
      }
    }

    if (resumeBtn) resumeBtn.addEventListener('click', openModal);
    if (modalCloseBtn) modalCloseBtn.addEventListener('click', closeModal);
    if (modalDismissBtn) modalDismissBtn.addEventListener('click', closeModal);

    if (resumeModal) {
      resumeModal.addEventListener('click', (e) => {
        if (e.target === resumeModal) {
          closeModal();
        }
      });
    }

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && resumeModal && resumeModal.classList.contains('active')) {
        closeModal();
      }
    });
  }

  // Idempotent initialization
  function init() {
    if (initialized) return;
    initialized = true;

    resizeCanvas();
    preloadImages();
    initLenis();
    setupUIInteractions();
    requestAnimationFrame(loop);
  }

  window.addEventListener('resize', () => {
    resizeCanvas();
    if (lenisInstance && typeof lenisInstance.resize === 'function') {
      lenisInstance.resize();
    }
  }, { passive: true });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
