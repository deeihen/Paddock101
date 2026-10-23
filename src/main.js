import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';
import Lenis from 'lenis';
import { createScene, KEYFRAMES, flatten } from './scene.js';
import { simulate, LAPS } from './tower.js';

gsap.registerPlugin(ScrollTrigger, SplitText);

const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const world = createScene(document.getElementById('gl'), { reduceMotion });

// ---------- smooth scroll ----------
if (!reduceMotion) {
  const lenis = new Lenis({ lerp: 0.09 });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((t) => lenis.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);
  document.querySelectorAll('a[href^="#"]').forEach((a) =>
    a.addEventListener('click', (e) => {
      e.preventDefault();
      lenis.scrollTo(a.getAttribute('href') === '#top' ? 0 : a.getAttribute('href'));
    }),
  );
}

// ---------- 3D camera path: each [data-cam] stop owns the stretch where it scrolls into view ----------
// Pose is computed from scroll position (not chained tweens), so jumps and nav links always land right.
const stops = [...document.querySelectorAll('[data-cam]')];
const frames = stops.map((el) => flatten(KEYFRAMES[el.dataset.cam]));
const legs = stops.map((el) => ScrollTrigger.create({ trigger: el, start: 'top 90%', end: 'top 30%' }));
function syncCamera() {
  let i = 0;
  for (let k = 1; k < legs.length; k++) if (legs[k].progress > 0) i = k;
  const a = frames[Math.max(i - 1, 0)], b = frames[i], t = i ? legs[i].progress : 1;
  for (const key in b) world.target[key] = a[key] + (b[key] - a[key]) * t;
}
gsap.ticker.add(syncCamera); // after ScrollTrigger has updated progress this tick

// ---------- HUD + nav ----------
const hudLabel = document.querySelector('.hud__label');
const hudBar = document.querySelector('.hud__bar i');
const navLinks = [...document.querySelectorAll('.nav__links a')];
const chapters = [...document.querySelectorAll('[data-chapter]')];
let current;
ScrollTrigger.create({
  start: 0, end: 'max',
  onUpdate: (self) => {
    gsap.set(hudBar, { scaleX: self.progress });
    // last chapter whose top has passed mid-screen; rects stay correct through pin spacers
    const sec = chapters.findLast((s) => s.getBoundingClientRect().top < innerHeight / 2);
    if (sec === current) return;
    current = sec;
    hudLabel.textContent = sec?.dataset.chapter ?? 'CH.00 — START';
    const id = ['flags', 'timing'].includes(sec?.id) ? 'racecraft' : sec?.id;
    navLinks.forEach((a) => a.classList.toggle('is-active', a.hash === `#${id}`));
  },
});

// ---------- tyres ----------
const TYRE_COPY = {
  soft: 'Soft (red): the most grip but the shortest life. Teams use it for qualifying and short stints.',
  medium: 'Medium (yellow): the all-rounder, and the most common race tyre.',
  hard: 'Hard (white): slower but durable. It suits long stints and one-stop races.',
  inter: 'Intermediate (green): for a damp track or light rain.',
  wet: 'Full wet (blue): for heavy rain. Deep grooves clear the standing water.',
};
const chips = [...document.querySelectorAll('.chip')];
chips.forEach((chip) =>
  chip.addEventListener('click', () => {
    chips.forEach((c) => c.setAttribute('aria-pressed', String(c === chip)));
    world.setCompound(chip.dataset.compound);
    document.querySelector('.tyre-desc').textContent = TYRE_COPY[chip.dataset.compound];
  }),
);

// ---------- motion that only exists without reduced-motion ----------
if (!reduceMotion) {
  // hero: chars flip up on load, then fly back into depth as you scroll away
  const split = new SplitText('.hero__title', { type: 'chars', charsClass: 'char' });
  gsap.from(split.chars, { yPercent: 110, rotateX: -90, opacity: 0, duration: 1.4, ease: 'expo.out', stagger: 0.035, delay: 0.15 });
  gsap.from('.hero .eyebrow, .hero__sub, .hero .cta', { y: 24, opacity: 0, filter: 'blur(6px)', duration: 1, ease: 'expo.out', stagger: 0.08, delay: 0.6 });
  // fromTo: a plain .to would record the chars mid-intro (invisible) as its start state
  gsap.fromTo(split.chars, { z: 0, rotateY: 0, opacity: 1 }, {
    immediateRender: false,
    z: (i) => 200 + (i % 5) * 120,
    rotateY: (i) => (i % 2 ? 25 : -25),
    opacity: 0,
    ease: 'none',
    stagger: { each: 0.02, from: 'center' },
    scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom 20%', scrub: 1 },
  });

  // start lights: pinned, five columns light one by one, then all go out together
  const lightsTl = gsap.timeline({ scrollTrigger: { trigger: '.lights', start: 'top top', end: '+=160%', pin: true, scrub: true } });
  gsap.utils.toArray('.light').forEach((col, i) => lightsTl.to(col.querySelectorAll('i'), { '--on': 1, duration: 0.12, ease: 'none' }, i * 0.3));
  lightsTl.to('.light i', { '--on': 0, duration: 0.04, ease: 'none' }, 1.9).to('.lights__caption', { opacity: 0, duration: 0.1 }, 1.9).to({}, { duration: 0.3 });
  gsap.from('.launch__text', { scale: 0.55, opacity: 0, rotateX: -50, transformPerspective: 900, ease: 'none', scrollTrigger: { trigger: '.launch', start: 'top 85%', end: 'top 25%', scrub: 1 } });

  // stat bands slide with scroll and lean into the scroll speed
  gsap.utils.toArray('.band').forEach((band, i) => {
    const track = band.querySelector('.band__track');
    const lean = gsap.quickTo(track, 'skewX', { duration: 0.5, ease: 'power3' });
    gsap.fromTo(track, { xPercent: i % 2 ? -50 : 0 }, {
      xPercent: i % 2 ? 0 : -50, ease: 'none',
      scrollTrigger: { trigger: band, start: 'top bottom', end: 'bottom top', scrub: true, onUpdate: (self) => lean(gsap.utils.clamp(-14, 14, self.getVelocity() / -250)) },
    });
  });

  // chapter numbers swing up from the floor plane
  gsap.utils.toArray('.chapter__num').forEach((el) =>
    gsap.from(el, { rotateX: -80, opacity: 0, y: 60, ease: 'none', scrollTrigger: { trigger: el, start: 'top 95%', end: 'top 45%', scrub: 1 } }),
  );

  // cards tilt in from below like panels hinged at their base
  gsap.utils.toArray('.step .card, .flags__intro').forEach((el) =>
    gsap.from(el, { rotateX: 22, y: 120, opacity: 0, ease: 'none', scrollTrigger: { trigger: el, start: 'top 100%', end: 'top 60%', scrub: 1 } }),
  );

  // points bars fill once
  gsap.from('.points i', {
    scaleX: 0, duration: 1.1, ease: 'expo.out', stagger: 0.05,
    scrollTrigger: { trigger: '.points', start: 'top 75%', once: true },
  });

  // flags: pinned horizontal run, cards rotate into face-on as they cross the viewport
  const trackEl = document.querySelector('.flags__track');
  const distance = () => trackEl.scrollWidth - innerWidth;
  const run = gsap.to(trackEl, {
    x: () => -distance(),
    ease: 'none',
    scrollTrigger: { trigger: '.flags', start: 'top top', end: () => `+=${distance()}`, pin: true, scrub: 1, invalidateOnRefresh: true },
  });
  gsap.utils.toArray('.flag').forEach((f) =>
    gsap.fromTo(f, { rotateY: -40, z: -200, opacity: 0.3 }, {
      rotateY: 0, z: 0, opacity: 1, ease: 'none',
      scrollTrigger: { trigger: f, containerAnimation: run, start: 'left 100%', end: 'left 55%', scrub: true },
    }),
  );

  // history spine draws as you read
  const fill = Object.assign(document.createElement('i'), { className: 'timeline__fill' });
  document.querySelector('.timeline').prepend(fill);
  gsap.to(fill, { scaleY: 1, ease: 'none', scrollTrigger: { trigger: '.timeline', start: 'top 70%', end: 'bottom 60%', scrub: 1 } });
  gsap.utils.toArray('.timeline li, .legends li').forEach((li) =>
    gsap.from(li, { x: -30, opacity: 0, duration: 0.8, ease: 'expo.out', scrollTrigger: { trigger: li, start: 'top 85%', once: true } }),
  );

  // finish title rises out of the page
  gsap.from('.finish__title', { rotateX: -60, y: 100, opacity: 0, transformPerspective: 900, transformOrigin: '50% 100%', ease: 'none', scrollTrigger: { trigger: '.finish', start: 'top 90%', end: 'top 30%', scrub: 1 } });
}

// ---------- timing tower: pinned; scroll plays a simulated race lap by lap ----------
const race = simulate();
const screen = document.querySelector('.bt-wrap');
const rowsEl = screen.querySelector('.bt__rows');
const rcEl = screen.querySelector('.rc');
const flEl = screen.querySelector('.flpop');
const TYRE_COLOR = { S: '#ff3b30', M: '#ffd400', H: '#f4f4f4' };
const MODE_LABEL = { interval: 'Interval', leader: 'Leader', tyre: 'Tyre', pits: 'Pit stops' };
const fmtLap = (t) => `${Math.floor(t / 60)}:${(t % 60).toFixed(3).padStart(6, '0')}`;
const rowEls = Object.fromEntries(race[1].rows.map((r) => {
  const li = document.createElement('li');
  li.className = 'bt__row';
  li.style.setProperty('--team', r.color);
  li.title = `${r.name} · ${r.team}`;
  li.innerHTML = `<span class="bt__pos"></span><span class="bt__team"></span><span class="bt__code">${r.code}<i class="bt__fl"></i></span><span class="bt__val"></span><span class="bt__tyre"></span>`;
  rowsEl.append(li);
  return [r.code, li];
}));
const callouts = [...document.querySelectorAll('.callout')];
let shownLap = 0;

function value(r, mode, lap) {
  if (r.out) return 'OUT';
  if (r.flags.some(([k]) => k === 'pit')) return '<span class="tag tag--pit">PIT</span>';
  if (r.pos === 1) return MODE_LABEL[mode];
  if (mode === 'tyre') return `${r.age} L`;
  if (mode === 'pits') return `${r.pits} ${r.pits === 1 ? 'STOP' : 'STOPS'}`;
  if (mode === 'leader') return r.lapped ? `+${r.lapped} LAP` : `+${r.gap.toFixed(3)}`;
  const pts = lap === LAPS && r.flags.find(([k]) => k === 'pts');
  if (pts) return `<span class="tag tag--pts">${pts[1]}</span>`;
  return r.overtake ? `<span class="tag tag--ovt">OVT</span> +${r.interval.toFixed(3)}` : `+${r.interval.toFixed(3)}`;
}

function renderLap(lap) {
  if (lap === shownLap) return;
  shownLap = lap;
  const { rows, status, fastest, message } = race[lap];
  const active = callouts.findLast((c) => +c.dataset.from <= lap);
  callouts.forEach((c) => c.classList.toggle('is-active', c === active));
  const mode = active.dataset.mode;
  Object.assign(screen.dataset, { focus: active.dataset.focus, mode, status });
  screen.querySelector('.bt__lap b').textContent = lap;
  const rowH = rowsEl.firstElementChild.getBoundingClientRect().height; // offsetHeight rounds and drifts over 22 rows

  for (const r of rows) {
    const li = rowEls[r.code];
    li.querySelector('.bt__pos').textContent = r.pos;
    li.querySelector('.bt__val').innerHTML = value(r, mode, lap);
    const tyre = li.querySelector('.bt__tyre');
    tyre.textContent = r.comp;
    tyre.style.setProperty('--c', TYRE_COLOR[r.comp]);
    li.classList.toggle('is-out', r.out);
    li.classList.toggle('is-leader', r.pos === 1);
    li.classList.toggle('is-fl', fastest?.code === r.code);
    gsap.to(li, { y: (r.pos - 1) * rowH, duration: reduceMotion ? 0 : 0.55, ease: 'power3.out', overwrite: 'auto' });
  }

  // pop-ups only re-mount when their content changes, so the entry animation plays once per message
  rcEl.hidden = !message;
  if (message && rcEl.dataset.msg !== message) {
    rcEl.dataset.msg = message;
    rcEl.querySelector('.rc__msg').textContent = message;
    rcEl.style.animation = 'none';
    void rcEl.offsetWidth; // reflow so the CSS entry animation restarts
    rcEl.style.animation = '';
  }
  const flFresh = fastest && lap - fastest.lap <= 2;
  flEl.hidden = !flFresh;
  if (flFresh) {
    flEl.querySelector('.flpop__drv').textContent = fastest.code;
    flEl.querySelector('.flpop__time').textContent = fmtLap(fastest.time);
  }
}
renderLap(1);

ScrollTrigger.create({
  trigger: '.timing', start: 'top top', end: '+=650%', pin: true,
  onUpdate: (self) => renderLap(1 + Math.round(self.progress * (LAPS - 1))),
  onRefresh: () => { const lap = shownLap; shownLap = 0; renderLap(lap || 1); },
});
if (!reduceMotion) {
  gsap.fromTo('.bt-wrap', { rotateY: 22, rotateX: 12, z: -260, opacity: 0 }, {
    rotateY: -4, rotateX: 2, z: 0, opacity: 1, ease: 'none',
    scrollTrigger: { trigger: '.timing', start: 'top 95%', end: 'top top', scrub: 1 },
  });
}

if (reduceMotion) gsap.set('.light i', { '--on': 1 });

// pins add spacing, so recompute triggers in page order once everything exists
ScrollTrigger.sort();
document.fonts.ready.then(() => ScrollTrigger.refresh());
