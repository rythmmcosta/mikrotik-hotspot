import anime from 'animejs/lib/anime.es.js';

const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export function pageEnter(container, selector = '.card, .stat-card, .page-header, .table-card') {
    if (reduced) return;
    const els = container ? container.querySelectorAll(selector) : document.querySelectorAll(selector);
    if (!els.length) return;
    anime({
        targets: els,
        opacity: [0, 1],
        translateY: [24, 0],
        duration: 420,
        delay: anime.stagger(60, { start: 80 }),
        easing: 'easeOutCubic',
    });
}

export function counterUp(el, target, duration = 900) {
    if (reduced) { if (el) el.textContent = target; return; }
    if (!el) return;
    const isDecimal = String(target).includes('.');
    anime({
        targets: { val: 0 },
        val: [0, target],
        duration,
        easing: 'easeOutQuart',
        update(anim) {
            const v = anim.animations[0].currentValue;
            el.textContent = isDecimal ? v.toFixed(1) : Math.round(v).toLocaleString();
        },
    });
}

export function rowsIn(tbody) {
    if (reduced || !tbody) return;
    const rows = tbody.querySelectorAll('tr');
    if (!rows.length) return;
    anime({
        targets: rows,
        opacity: [0, 1],
        translateX: [-12, 0],
        duration: 320,
        delay: anime.stagger(35, { start: 60 }),
        easing: 'easeOutQuad',
    });
}

export function shake(el) {
    if (reduced || !el) return;
    anime({
        targets: el,
        translateX: [0, -8, 8, -6, 6, -3, 3, 0],
        duration: 520,
        easing: 'easeInOutSine',
    });
}

export function pulse(el) {
    if (reduced || !el) return;
    anime({
        targets: el,
        scale: [1, 1.18, 1],
        duration: 420,
        easing: 'easeInOutQuad',
    });
}

export function fadeIn(el, duration = 280) {
    if (!el) return;
    if (reduced) { el.style.opacity = 1; return; }
    anime({ targets: el, opacity: [0, 1], duration, easing: 'easeOutQuad' });
}
