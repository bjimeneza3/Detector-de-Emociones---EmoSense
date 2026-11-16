(() => {
const states=[
['Alegría',[64,94,74,89,84,94],[116,94,126,89,136,94],[65,112,74,97,83,112],[117,112,126,97,135,112],[80,133,100,157,120,133,100,166,80,133]],
['Sorpresa',[64,88,74,81,84,88],[116,88,126,81,136,88],[69,109,74,98,79,109],[121,109,126,98,131,109],[90,139,100,119,110,139,100,161,90,139]],
['Tristeza',[64,96,74,96,84,88],[116,88,126,96,136,96],[65,113,74,118,83,111],[117,111,126,118,135,113],[84,144,100,128,116,144,100,135,84,144]],
['Enojo',[64,89,74,95,84,99],[116,99,126,95,136,89],[65,111,74,115,83,111],[117,111,126,115,135,111],[84,145,100,130,116,145,100,136,84,145]],
['Miedo',[64,92,74,84,84,85],[116,85,126,84,136,92],[67,111,74,98,81,111],[119,111,126,98,133,111],[85,143,100,126,115,143,100,153,85,143]],
['Disgusto',[64,96,74,86,84,94],[116,93,126,98,136,97],[65,112,74,108,83,112],[117,111,126,116,135,111],[83,143,100,135,117,139,100,147,83,143]],
['Coqueto',[64,93,74,88,84,93],[116,88,126,84,136,88],[65,110,74,117,83,110],[121,110,126,102,131,110],[83,140,100,151,119,132,100,158,83,140]],
['Neutral',[64,93,74,91,84,93],[116,93,126,91,136,93],[69,110,74,103,79,110],[121,110,126,103,131,110],[84,140,100,140,116,140,100,140,84,140]]
];
const logos = [...document.querySelectorAll('.emotion-logo')];
const features = ['browL', 'browR', 'eyeL', 'eyeR', 'mouth'];
const nodes = logos.map(logo => features.map(key => logo.querySelector(`[data-feature="${key}"]`)));
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
let index = 0, frame = 0, current = states[0].slice(1).map(a => a.slice());
function draw() {
  nodes.forEach((parts, i) => {
    if (logos[i].closest('[hidden]')) return;
    parts.forEach((part, j) => {
      const a = current[j];
      part.setAttribute('d', j === 4
        ? `M${a[0]} ${a[1]} Q${a[2]} ${a[3]} ${a[4]} ${a[5]} Q${a[6]} ${a[7]} ${a[8]} ${a[9]}Z`
        : `M${a[0]} ${a[1]} Q${a[2]} ${a[3]} ${a[4]} ${a[5]}`);
    });
  });
}
function change() {
  const from = current.map(a => a.slice());
  index = (index + 1) % states.length;
  const to = states[index].slice(1), start = performance.now();
  function animate(now) {
    const progress = Math.min(1, (now - start) / 460);
    const t = progress * progress * (3 - 2 * progress);
    current = from.map((a,j) => a.map((v,k) => v + (to[j][k] - v) * t));
    draw();
    if (progress < 1) frame = requestAnimationFrame(animate);
  }
  frame = requestAnimationFrame(animate);
}
setInterval(() => { if (!reduced.matches && !document.hidden) change(); }, 2200);
function reset() {
  cancelAnimationFrame(frame);
  index = 0;
  current = states[0].slice(1).map(a => a.slice());
  draw();
}
reduced.addEventListener('change', reset);
document.addEventListener('visibilitychange', () => { if (document.hidden) reset(); });
const loader = document.getElementById('page-loader');
function finishLoading() {
  document.documentElement.classList.remove('page-loading');
  if (loader) {
    loader.setAttribute('aria-hidden', 'true');
    window.setTimeout(() => { loader.hidden = true; }, reduced.matches ? 0 : 320);
  }
}
if (document.readyState === 'complete') finishLoading();
else window.addEventListener('load', finishLoading, {once:true});
window.addEventListener('pageshow', event => { if (event.persisted) finishLoading(); });
})();
