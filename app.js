// Talita Ribeiro — prévia conceitual (Bruno Luque).
// Camadas de motion:
//  Assinatura: faixa de luz dourada no hero (uma vez) + tambor giratório "Escolha seu cuidado".
//  Narrativa: hero → tambor (foto recua com a rolagem), trilho do atendimento, fotos do espaço em contra-paralaxe.
//  Interface: pressão dos botões, copiar com confirmação, CTA magnético, chips do contato, topo translúcido.
// Sem este arquivo (ou sem Motion) todo o conteúdo fica visível: os estados escondidos só existem com .motion-ready.

const root = document.documentElement;
const reduceMQ = matchMedia('(prefers-reduced-motion: reduce)');
const fineMQ = matchMedia('(hover: hover) and (pointer: fine)');
const wideMQ = matchMedia('(min-width: 901px)');
const reduce = reduceMQ.matches;
if (reduce) root.classList.add('reduce');

/* tokens de motion (espelham as variáveis CSS) */
const EASE_OUT = [0.23, 1, 0.32, 1];
const EASE_IN_OUT = [0.77, 0, 0.175, 1];
const DUR = { press: 0.12, small: 0.2, panel: 0.36, reveal: 1.1 };
const SPRING_DRUM = { stiffness: 190, damping: 24 };

const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const smooth = (t) => t * t * (3 - 2 * t);

/* ------------------------------------------------------------------ */
/* Topo translúcido                                                    */
/* ------------------------------------------------------------------ */
const top = $('[data-top]');
const onScrollTop = () => top.classList.toggle('is-solid', scrollY > 24);
addEventListener('scroll', onScrollTop, { passive: true }); onScrollTop();

/* ------------------------------------------------------------------ */
/* Rolagem contínua (Lenis) só na roda do mouse; toque nativo           */
/* ------------------------------------------------------------------ */
let lenis = null;
function startLenis() {
  if (reduce || !window.Lenis || lenis || !fineMQ.matches) return;
  lenis = new window.Lenis({ lerp: 0.09, smoothWheel: true, wheelMultiplier: 0.95 });
  const raf = (t) => { if (!lenis) return; lenis.raf(t); requestAnimationFrame(raf); };
  requestAnimationFrame(raf);
}
if (window.Lenis) startLenis(); else addEventListener('load', startLenis, { once: true });
reduceMQ.addEventListener('change', () => { if (reduceMQ.matches && lenis) { lenis.destroy(); lenis = null; } });

function scrollToY(y) {
  if (lenis) lenis.scrollTo(y, { duration: 1.1, easing: (t) => 1 - Math.pow(1 - t, 4) });
  else scrollTo({ top: y, behavior: reduce ? 'auto' : 'smooth' });
}
document.addEventListener('click', (e) => {
  const a = e.target.closest('a[href^="#"]');
  if (!a) return;
  const id = a.getAttribute('href');
  const target = id === '#inicio' ? null : $(id);
  if (id !== '#inicio' && !target) return;
  e.preventDefault();
  const y = target ? target.getBoundingClientRect().top + scrollY - (id === '#cuidados' ? 0 : top.offsetHeight) : 0;
  scrollToY(y);
  if (target) { target.setAttribute('tabindex', '-1'); target.focus({ preventScroll: true }); }
});

/* ------------------------------------------------------------------ */
/* Copiar mensagem (ix-copy-confirm)                                   */
/* ------------------------------------------------------------------ */
const live = $('[data-live]');
async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; } catch (_) { /* segue para o plano B */ }
  try {
    const ta = document.createElement('textarea');
    ta.value = text; ta.setAttribute('readonly', ''); ta.style.cssText = 'position:fixed;opacity:0;left:-9999px';
    document.body.appendChild(ta); ta.select();
    const ok = document.execCommand('copy'); ta.remove(); return ok;
  } catch (_) { return false; }
}
document.addEventListener('click', async (e) => {
  const b = e.target.closest('[data-copy]');
  if (!b) return;
  const text = b.dataset.copy;
  const ok = await copyText(text);
  window.__lastCopy = text; // usado pelo QA
  clearTimeout(b._t);
  if (ok) {
    b.classList.add('is-done');
    if (live) live.textContent = 'Mensagem copiada. Cole no WhatsApp da Talita.';
    b._t = setTimeout(() => b.classList.remove('is-done'), 2000);
  } else if (live) {
    live.textContent = `Não foi possível copiar. Mensagem: ${text}`;
  }
});

/* ------------------------------------------------------------------ */
/* Compositor do contato                                               */
/* ------------------------------------------------------------------ */
const composer = $('[data-composer]');
const preview = $('[data-preview]');
const composerCopy = $('[data-copy-composer]');
function composeMsg(v) { return v ? `Olá, Talita! Vim pelo site e gostaria de conversar sobre ${v}.` : 'Olá, Talita! Vim pelo site e gostaria de entender qual cuidado combina comigo.'; }
function setComposer(v, animateIt = true) {
  const msg = composeMsg(v);
  composerCopy.dataset.copy = msg;
  composerCopy.classList.remove('is-done');
  if (animateIt && window.Motion && !reduce) {
    window.Motion.animate(preview, { opacity: [0.2, 1], transform: ['translateY(6px)', 'translateY(0px)'] }, { duration: DUR.small + 0.06, ease: EASE_OUT });
  }
  preview.textContent = msg;
}
composer.addEventListener('change', (e) => { if (e.target.name === 'cuidado') setComposer(e.target.value); });

/* ------------------------------------------------------------------ */
/* Cena assinatura: tambor "Escolha seu cuidado"                      */
/* ------------------------------------------------------------------ */
const choose = $('[data-choose]');
const cares = $$('.care', choose);
const N = cares.length;
const drumWrap = $('[data-drum-wrap]');
const drum = $('[data-drum]');
const cyl = $('[data-drum-cyl]');
const countEl = $('[data-count]');
const chooseRail = $('[data-choose-rail]');
const STEP = 24; // graus entre itens no cilindro
let R = 0, itemH = 64;
let items = [], ticks = [];
let active = -1;
let mode = 'static'; // 'pin' (desktop, rolagem) | 'wheel' (celular, toque) | 'static'

function buildDrum() {
  cares.forEach((c, i) => {
    const it = document.createElement('div');
    it.className = 'drum__item';
    it.id = `drum-opt-${i}`;
    it.setAttribute('role', 'option');
    it.setAttribute('aria-selected', 'false');
    it.setAttribute('aria-label', c.dataset.name);
    it.innerHTML = `<span class="n" aria-hidden="true">${String(i + 1).padStart(2, '0')}</span><span class="t"><span class="t-full">${c.dataset.name}</span><span class="t-short">${c.dataset.short}</span></span>`;
    it.addEventListener('click', () => go(i));
    cyl.appendChild(it); items.push(it);
  });
  // marcas de mostrador ao longo do cilindro (decorativas)
  for (let k = -6; k <= (N - 1) * 2 + 6; k++) {
    const t = document.createElement('span');
    t.className = 'drum__tick' + (k % 2 === 0 && k >= 0 && k <= (N - 1) * 2 ? ' is-major' : '');
    t.setAttribute('aria-hidden', 'true');
    t.dataset.a = String(k * STEP / 2);
    cyl.appendChild(t); ticks.push(t);
  }
}
function measure() {
  itemH = items[0]?.offsetHeight || 64;
  R = Math.round(itemH / (2 * Math.tan((STEP / 2) * Math.PI / 180)));
  items.forEach((it, i) => { it.style.transform = `rotateX(${-i * STEP}deg) translateZ(${R}px)`; });
  ticks.forEach((t) => { t.style.transform = `rotateX(${-t.dataset.a}deg) translateZ(${R}px)`; });
}

let drawn = -1;
function renderDrum(pos) {
  cyl.style.transform = `translateZ(${-R}px) rotateX(${pos * STEP}deg)`;
  for (let i = 0; i < N; i++) {
    const d = (i - pos) * STEP;
    const it = items[i];
    const vis = Math.abs(d) < 84;
    it.style.visibility = vis ? '' : 'hidden';
    if (vis) it.style.opacity = String(Math.pow(Math.cos(d * Math.PI / 180), 1.6).toFixed(3));
  }
  for (const t of ticks) {
    const d = +t.dataset.a - pos * STEP;
    t.style.visibility = Math.abs(d) < 84 ? '' : 'hidden';
  }
  const idx = clamp(Math.round(pos), 0, N - 1);
  if (idx !== drawn) { drawn = idx; setActive(idx); }
}

/* mola do tambor: posição contínua com velocidade preservada (interrompível) */
const sp = { x: 0, v: 0, target: 0, raf: 0, last: 0 };
function springTick(t) {
  const dt = Math.min(0.032, (t - (sp.last || t)) / 1000 || 0.016); sp.last = t;
  const f = -SPRING_DRUM.stiffness * (sp.x - sp.target) - SPRING_DRUM.damping * sp.v;
  sp.v += f * dt; sp.x += sp.v * dt;
  if (Math.abs(sp.x - sp.target) < 0.0008 && Math.abs(sp.v) < 0.002) { sp.x = sp.target; sp.v = 0; }
  renderDrum(sp.x);
  if (sp.x !== sp.target || sp.v !== 0) sp.raf = requestAnimationFrame(springTick);
  else { sp.raf = 0; sp.last = 0; }
}
function springTo(target) {
  sp.target = target;
  if (!sp.raf) sp.raf = requestAnimationFrame(springTick);
}
function springSet(x) { sp.x = x; sp.target = x; sp.v = 0; renderDrum(x); }

/* painel: troca do cuidado em destaque */
let animateFn = null;
function setActive(i) {
  if (i === active) return;
  const prev = active; active = i;
  const dir = prev < 0 ? 1 : Math.sign(i - prev) || 1;
  items.forEach((it, k) => { const on = k === i; it.classList.toggle('is-active', on); it.setAttribute('aria-selected', String(on)); });
  drum.setAttribute('aria-activedescendant', `drum-opt-${i}`);
  countEl.textContent = String(i + 1).padStart(2, '0');
  cares.forEach((c, k) => {
    const on = k === i;
    c.classList.toggle('is-active', on);
    if (on) c.removeAttribute('inert'); else c.setAttribute('inert', '');
    c.setAttribute('aria-hidden', String(!on));
  });
  const next = cares[i];
  // sincroniza o compositor do contato com o cuidado escolhido
  const radios = $$('input[name="cuidado"]');
  const want = next.dataset.name.toLowerCase();
  const r = radios.find((x) => x.value === want);
  if (r && !r.checked) { r.checked = true; setComposer(r.value, false); }

  if (!animateFn || prev < 0) return;
  const old = cares[prev];
  old.classList.add('is-leaving');
  animateFn(old, { opacity: [1, 0], transform: ['translateY(0px)', `translateY(${-14 * dir}px)`] }, { duration: DUR.small, ease: EASE_OUT })
    .then(() => { old.classList.remove('is-leaving'); old.style.opacity = ''; old.style.transform = ''; });
  const img = $('.care__photo', next);
  const body = $('.care__body', next);
  const from = dir > 0 ? 'inset(100% 0% 0% 0%)' : 'inset(0% 0% 100% 0%)';
  animateFn(next, { opacity: [0, 1] }, { duration: DUR.small, ease: EASE_OUT });
  animateFn(img, { clipPath: [from, 'inset(0% 0% 0% 0%)'] }, { duration: DUR.panel + 0.14, ease: EASE_IN_OUT });
  animateFn($('img', img), { transform: ['scale(1.12)', 'scale(1)'] }, { duration: DUR.panel + 0.5, ease: EASE_OUT });
  animateFn(body, { opacity: [0, 1], transform: [`translateY(${18 * dir}px)`, 'translateY(0px)'] }, { duration: DUR.panel, delay: 0.06, ease: EASE_OUT });
}

/* posição de rolagem correspondente a cada item (modo desktop) */
function yForIndex(i) {
  const rect = choose.getBoundingClientRect();
  const topY = rect.top + scrollY;
  const range = choose.offsetHeight - innerHeight;
  return topY + range * (i / (N - 1));
}
function go(i) {
  i = clamp(i, 0, N - 1);
  if (mode === 'pin') scrollToY(yForIndex(i));
  else springTo(i);
}

/* detentes: segura cada item por parte do percurso (ix-sheet-detents / ix-quantity-roll) */
function detent(p) {
  const raw = clamp(p) * (N - 1);
  const base = Math.min(Math.floor(raw), N - 2);
  const f = raw - base;
  return base + smooth(clamp((f - 0.26) / 0.48));
}

function setupKeys() {
  drum.addEventListener('keydown', (e) => {
    const k = e.key;
    let to = null;
    if (k === 'ArrowDown' || k === 'ArrowRight') to = active + 1;
    else if (k === 'ArrowUp' || k === 'ArrowLeft') to = active - 1;
    else if (k === 'Home') to = 0;
    else if (k === 'End') to = N - 1;
    if (to === null) return;
    e.preventDefault();
    go(to);
  });
  $('[data-drum-prev]').addEventListener('click', () => go(active - 1));
  $('[data-drum-next]').addEventListener('click', () => go(active + 1));
}

/* arraste vertical do tambor (celular e mouse, fora do modo preso) */
function setupDrag() {
  let start = null;
  drum.addEventListener('pointerdown', (e) => {
    if (mode !== 'wheel') return;
    start = { y: e.clientY, pos: sp.x, t: performance.now(), lastY: e.clientY, lastT: performance.now(), vel: 0, moved: false };
    drum.setPointerCapture(e.pointerId);
    cancelAnimationFrame(sp.raf); sp.raf = 0; sp.last = 0;
  });
  drum.addEventListener('pointermove', (e) => {
    if (!start) return;
    const now = performance.now();
    const dy = e.clientY - start.y;
    if (Math.abs(dy) > 4) start.moved = true;
    let pos = start.pos - dy / itemH;
    if (pos < 0) pos = pos * 0.35; // resistência elástica nas pontas
    if (pos > N - 1) pos = N - 1 + (pos - (N - 1)) * 0.35;
    const dt = Math.max(1, now - start.lastT);
    start.vel = -(e.clientY - start.lastY) / itemH / (dt / 1000);
    start.lastY = e.clientY; start.lastT = now;
    sp.x = pos; sp.target = pos; sp.v = 0;
    renderDrum(pos);
  });
  const end = () => {
    if (!start) return;
    const moved = start.moved; const vel = start.vel; start = null;
    drum._dragged = moved;
    setTimeout(() => { drum._dragged = false; }, 0);
    if (!moved) { // toque simples: deixa o clique do item agir
      springTo(Math.round(sp.x)); return;
    }
    sp.v = clamp(vel, -12, 12);
    springTo(clamp(Math.round(sp.x + sp.v * 0.12), 0, N - 1));
  };
  drum.addEventListener('pointerup', end);
  drum.addEventListener('pointercancel', end);
  // clique de item só quando não houve arraste
  drum.addEventListener('click', (e) => { if (drum._dragged) e.stopPropagation(); }, true);
}

/* ------------------------------------------------------------------ */
/* Motion: coreografia                                                 */
/* ------------------------------------------------------------------ */
const M = window.Motion || null;
if (!M) console.warn('Motion indisponível; página segue estática.');

if (M && !reduce) {
  const { animate, scroll, inView, stagger } = M;
  animateFn = (...a) => animate(...a);
  root.classList.add('motion-ready');

  /* hero: títulos em máscara de linha (line-mask), foto revelada, faixa de luz uma vez */
  animate('.hero__title .line > span', { transform: ['translateY(108%)', 'translateY(0%)'] }, { duration: 1.05, delay: stagger(0.1, { startDelay: 0.1 }), ease: EASE_OUT });
  animate('.hero__lead, .talita, .hero__actions, .hero__place', { opacity: [0, 1], transform: ['translateY(12px)', 'translateY(0px)'] }, { duration: 0.8, delay: stagger(0.08, { startDelay: 0.45 }), ease: EASE_OUT });
  animate('.hero__frame', { clipPath: ['inset(100% 0% 0% 0%)', 'inset(0% 0% 0% 0%)'] }, { duration: 1.25, delay: 0.15, ease: EASE_IN_OUT });
  animate('.hero__frame img', { transform: ['scale(1.16)', 'scale(1)'] }, { duration: 1.9, delay: 0.15, ease: EASE_OUT });
  setTimeout(() => $('.hero__art').classList.add('frame-in'), 900);
  const light = $('[data-hero-light]');
  animate(light, { opacity: [0, 1, 1, 0], transform: ['translateX(-38%)', 'translateX(-10%)', 'translateX(16%)', 'translateX(40%)'] },
    { duration: 2.6, delay: 1.25, ease: 'linear', times: [0, 0.18, 0.82, 1] });

  /* hero → tambor: a foto recua e escurece enquanto a cena chega */
  const heroFrame = $('[data-hero-frame]');
  scroll((p) => {
    heroFrame.style.transform = `translateY(${(p * 70).toFixed(1)}px) scale(${(1 - p * 0.06).toFixed(4)})`;
    heroFrame.style.filter = `brightness(${(1 - p * 0.45).toFixed(3)})`;
  }, { target: $('.hero'), offset: ['start start', 'end start'] });

  /* magnetic: CTA de destaque, só com ponteiro fino */
  if (fineMQ.matches) {
    $$('[data-magnetic]').forEach((b) => {
      b.addEventListener('pointermove', (e) => {
        const r = b.getBoundingClientRect();
        const x = (e.clientX - r.left - r.width / 2) * 0.18, y = (e.clientY - r.top - r.height / 2) * 0.28;
        animate(b, { transform: `translate(${x}px, ${y}px)` }, { type: 'spring', stiffness: 260, damping: 18, mass: 0.6 });
      });
      b.addEventListener('pointerleave', () => animate(b, { transform: 'translate(0px, 0px)' }, { type: 'spring', stiffness: 220, damping: 14 }));
    });
  }

  /* tambor */
  buildDrum();
  drumWrap.hidden = false;
  $('[data-hint]').textContent = wideMQ.matches
    ? 'Role a página, use as setas do teclado ou clique num nome para girar o seletor.'
    : 'Arraste o seletor ou use as setas para conhecer cada cuidado.';
  measure();
  setupKeys();
  setupDrag();

  let stopScroll = null;
  function applyMode() {
    const want = wideMQ.matches ? 'pin' : 'wheel';
    if (want === mode) return;
    mode = want;
    choose.classList.toggle('is-pin', mode === 'pin');
    drum.style.touchAction = mode === 'wheel' ? 'none' : '';
    $('[data-hint]').textContent = mode === 'pin'
      ? 'Role a página, use as setas do teclado ou clique num nome para girar o seletor.'
      : 'Arraste o seletor ou use as setas para conhecer cada cuidado.';
    if (stopScroll) { stopScroll(); stopScroll = null; }
    requestAnimationFrame(() => {
      measure();
      if (mode === 'pin') {
        stopScroll = scroll((p) => {
          springTo(detent(p));
          if (chooseRail) chooseRail.style.transform = `scaleX(${p.toFixed(4)})`;
        }, { target: choose, offset: ['start start', 'end end'] });
      } else {
        springSet(clamp(Math.round(sp.x), 0, N - 1));
      }
    });
  }
  springSet(0);
  setActive(0);
  applyMode();
  wideMQ.addEventListener('change', applyMode);
  addEventListener('resize', () => { measure(); renderDrum(sp.x); }, { passive: true });

  /* atendimento: trilho dourado conduz os passos */
  const steps = $$('.step');
  const rail = $('[data-rail]');
  scroll((p) => {
    rail.style.transform = `scaleY(${p.toFixed(4)})`;
    steps.forEach((s, i) => s.classList.toggle('is-lit', p >= (i === 0 ? 0.02 : i / (steps.length - 1) - 0.04)));
  }, { target: $('[data-steps]'), offset: ['start 72%', 'end 55%'] });
  const pPhoto = $('[data-process-photo]');
  inView(pPhoto.parentElement, () => {
    animate($('img', pPhoto), { clipPath: ['inset(0% 50% 0% 50%)', 'inset(0% 0% 0% 0%)'] }, { duration: 1.1, ease: EASE_IN_OUT });
  }, { amount: 0.4 });
  $('img', pPhoto).style.clipPath = 'inset(0% 50% 0% 50%)';

  /* espaço: fotos em contra-paralaxe (desktop) e títulos em máscara */
  if (wideMQ.matches) {
    $$('[data-par]').forEach((f) => {
      const k = +f.dataset.par;
      scroll((p) => { f.style.transform = `translateY(${((p - 0.5) * 90 * k).toFixed(1)}px)`; }, { target: f, offset: ['start end', 'end start'] });
    });
  }
  $$('.process .h2, .space .h2, .contact__title').forEach((h) => {
    h.style.clipPath = 'inset(0% 0% 100% 0%)'; h.style.transform = 'translateY(24px)';
    // observa o pai: o recorte do próprio título zera a interseção
    inView(h.parentElement, () => {
      animate(h, { clipPath: ['inset(0% 0% 100% 0%)', 'inset(0% 0% -20% 0%)'], transform: ['translateY(24px)', 'translateY(0px)'] }, { duration: 1, ease: EASE_OUT })
        .then(() => { h.style.clipPath = 'none'; });
    }, { amount: 0.2 });
  });
} else {
  /* movimento reduzido ou sem Motion: lista estática com todos os painéis */
  cares.forEach((c) => c.classList.add('is-active'));
}
