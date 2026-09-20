import { createInstruments } from './instruments.js';

const root = document.documentElement;
const motionPreference = matchMedia('(prefers-reduced-motion: reduce)');
const motionButton = document.getElementById('motion-toggle');
let motion = !motionPreference.matches;
let userMotionChoice = false;
let instruments;

// Content remains visible if enhancement is unavailable.
const revealObserver = new IntersectionObserver(entries => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('seen');
      revealObserver.unobserve(entry.target);
    }
  });
}, { threshold: .06, rootMargin: '0px 0px 20px 0px' });
document.querySelectorAll('.reveal').forEach(element => revealObserver.observe(element));
root.classList.add('enhanced');

function setMotion(enabled) {
  motion = enabled;
  root.classList.toggle('motion-on', motion);
  root.classList.toggle('motion-off', !motion);
  motionButton.textContent = motion ? 'Pause motion' : 'Resume motion';
  motionButton.setAttribute('aria-pressed', String(!motion));
  instruments?.setMotion(motion);
}
motionButton.addEventListener('click', () => { userMotionChoice = true; setMotion(!motion); });
motionPreference.addEventListener('change', () => { if (!userMotionChoice) setMotion(!motionPreference.matches); });
setMotion(motion);
try { instruments = createInstruments(); instruments.setMotion(motion); }
catch (error) { console.warn('Optional visual enhancement unavailable:', error.message); }

function select(button, attribute) {
  document.querySelectorAll(`[${attribute}]`).forEach(item => item.setAttribute('aria-pressed', String(item === button)));
}

document.querySelectorAll('[data-signal]').forEach(button => button.addEventListener('click', () => {
  const model = button.dataset.signal === 'model';
  select(button, 'data-signal');
  document.getElementById('signal-value').textContent = model ? '450×' : '91.7%';
  document.getElementById('signal-description').textContent = model ? 'fewer wrist-posture false alarms' : 'wrist-posture false alarms in the naive baseline';
  instruments?.setSignal(button.dataset.signal);
}));

const rates = { Grok: 35.9, Claude: 14.0, ChatGPT: 13.7, Gemini: 9.0 };
document.querySelectorAll('[data-platform]').forEach(button => button.addEventListener('click', () => {
  const platform = button.dataset.platform;
  select(button, 'data-platform');
  document.getElementById('privacy-value').textContent = `${rates[platform].toFixed(1)}%`;
  document.getElementById('privacy-platform').textContent = platform;
  instruments?.setPrivacy(rates[platform]);
}));

document.querySelectorAll('[data-forecast]').forEach(button => button.addEventListener('click', () => {
  const prognosis = button.dataset.forecast === 'prognosis';
  select(button, 'data-forecast');
  const value = document.getElementById('forecast-value');
  value.replaceChildren(document.createTextNode(prognosis ? '5 ' : '20'));
  const unit = document.createElement('small');
  unit.textContent = prognosis ? 'weeks' : '%';
  value.append(unit);
  document.getElementById('forecast-description').textContent = prognosis ? 'ahead of a potential dengue outbreak' : 'lower prediction error across 10 regional zones';
  document.getElementById('terrain-label').textContent = prognosis ? 'Prognosis / India' : 'Harvard research / Colombia';
  document.getElementById('forecast-context').textContent = prognosis
    ? 'I founded Prognosis and led a seven-person team. The platform was adopted by public-health agencies across three Indian states.'
    : 'In a separate Harvard collaboration, I led a ten-person team improving dengue prediction with better satellite data across ten zones in Colombia.';
  instruments?.setForecast(button.dataset.forecast);
}));

const dialog = document.getElementById('story-dialog');
const dialogContent = document.getElementById('dialog-content');
let previousOverflow = '';
document.querySelectorAll('[data-story]').forEach(button => button.addEventListener('click', () => {
  const template = document.getElementById(`story-${button.dataset.story}`);
  if (!template) return;
  dialogContent.replaceChildren(template.content.cloneNode(true));
  previousOverflow = document.body.style.overflow;
  document.body.style.overflow = 'hidden';
  dialog.showModal();
  dialog.scrollTop = 0;
  instruments?.setSuspended(true);
}));
dialog.querySelector('.dialog-close').addEventListener('click', () => dialog.close());
dialog.addEventListener('keydown', event => {
  if (event.key !== 'Tab') return;
  const focusable = [...dialog.querySelectorAll('button, a[href], input, select, textarea, [tabindex]:not([tabindex="-1"])')]
    .filter(element => !element.disabled && element.getClientRects().length);
  const first = focusable[0];
  const last = focusable.at(-1);
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
});
dialog.addEventListener('click', event => {
  const rect = dialog.getBoundingClientRect();
  if (event.target === dialog && (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom)) dialog.close();
});
dialog.addEventListener('close', () => {
  document.body.style.overflow = previousOverflow;
  instruments?.setSuspended(false);
});

const rail = document.querySelector('.page-rail');
const railLinks = [...rail.querySelectorAll('a')];
const chapters = railLinks.map(link => document.querySelector(link.getAttribute('href')));
const hero = document.querySelector('.hero');
let scrollQueued = false;
function updateChapter() {
  scrollQueued = false;
  if (motion) hero.style.setProperty('--hero-progress', Math.min(1, scrollY / hero.offsetHeight));
  let current = 0;
  chapters.forEach((section, index) => { if (section.getBoundingClientRect().top <= innerHeight * .5) current = index; });
  railLinks.forEach((link, index) => link.setAttribute('aria-current', String(index === current)));
  rail.classList.toggle('visible', scrollY > innerHeight * .7);
}
addEventListener('scroll', () => { if (!scrollQueued) { scrollQueued = true; requestAnimationFrame(updateChapter); } }, { passive: true });
addEventListener('resize', updateChapter, { passive: true });
updateChapter();
