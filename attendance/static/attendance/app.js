const EXPRESSIONS = {
  'Alegría': {accent:'#c18a16',ink:'#89600c',night:'#f2cc72',background:'#fff1cf',nightBackground:'#392e1c',emoji:'😊', color:'#fff1cf', description:'Una sonrisa que ilumina el momento.'},
  'Tristeza': {accent:'#578bd3',ink:'#3565a6',night:'#9bc2fa',background:'#e6effc',nightBackground:'#202e44',emoji:'😢', color:'#e6effc', description:'Una expresión de tristeza en este instante.'},
  'Enojo': {accent:'#d9716c',ink:'#aa4642',night:'#ffa8a1',background:'#fce5e3',nightBackground:'#40272c',emoji:'😠', color:'#fce5e3', description:'Un gesto intenso, lleno de expresión.'},
  'Sorpresa': {accent:'#db923c',ink:'#995b18',night:'#ffc27b',background:'#fff0dc',nightBackground:'#3d2d20',emoji:'😲', color:'#fff0dc', description:'¡Un instante que sorprende!'},
  'Miedo': {accent:'#9673d4',ink:'#7350b0',night:'#ceb0ff',background:'#ece8fb',nightBackground:'#322743',emoji:'😨', color:'#ece8fb', description:'Un gesto de alerta o temor.'},
  'Disgusto': {accent:'#7fa34d',ink:'#54732a',night:'#badb89',background:'#eaf3dc',nightBackground:'#2b3522',emoji:'🤢', color:'#eaf3dc', description:'Una expresión de desagrado.'},
  'Neutral': {accent:'#8293a6',ink:'#586b80',night:'#bdcddd',background:'#edf1f5',nightBackground:'#29323c',emoji:'😐', color:'#f0ebf8', description:'Un gesto sereno, sin expresión dominante.'}
};
const video = document.querySelector('#camera'), photo = document.querySelector('#photo');
const overlay = document.querySelector('#overlay'), ctx = overlay.getContext('2d');
const capture = document.createElement('canvas'), toggle = document.querySelector('#camera-toggle');
const input = document.querySelector('#image-input'), statusText = document.querySelector('#status');
const emoji = document.querySelector('#emotion-emoji'), visual = document.querySelector('#result-visual');
const mode = document.querySelector('#mode'), scoreRows = new Map();
const reactionGif = document.querySelector('#reaction-gif');
const reactionBadge = document.querySelector('#reaction-badge');
const gifStatus = document.querySelector('#gif-status');
const GIF_KEYS = {'Alegría':'alegria','Tristeza':'tristeza','Enojo':'enojo','Sorpresa':'sorpresa','Miedo':'miedo','Disgusto':'disgusto','Neutral':'neutral'};
const reactionSources = Object.fromEntries(Object.entries(GIF_KEYS).map(([emotion,key]) => [emotion,visual.getAttribute('data-gif-' + key)]));
function applyExpressionColors(element, expression) {
  for (const [property, key] of Object.entries({
    '--expression-accent':'accent', '--expression-ink':'ink',
    '--expression-night':'night', '--expression-bg':'background',
    '--expression-night-bg':'nightBackground'
  })) {
    if (expression?.[key]) element.style.setProperty(property,expression[key]);
    else element.style.removeProperty(property);
  }
}
let pendingEmotion = null, pendingCount = 0, activeGifEmotion = null;
const gifPreloads = Object.values(reactionSources).map(src => { const image = new Image(); image.src = src; return image; });
function clearReaction() {
  pendingEmotion = null; pendingCount = 0; activeGifEmotion = null;
  reactionGif.hidden = true; reactionGif.removeAttribute('src'); reactionGif.alt = '';
  reactionBadge.hidden = true; visual.classList.remove('has-gif');
  gifStatus.textContent = 'Tu GIF aparecerá al detectar un rostro.';
}
function updateReaction(emotion) {
  if (activeGifEmotion === emotion) return;
  activeGifEmotion = emotion;
  const src = reactionSources[emotion];
  if (!src) { clearReaction(); return; }
  reactionGif.hidden = true;
  reactionGif.alt = 'GIF de reacción: ' + emotion;
  gifStatus.textContent = 'Cargando tu reacción…';
  reactionGif.src = src;
}
reactionGif.addEventListener('load',() => {
  if (!activeGifEmotion) return;
  reactionGif.hidden = false; reactionBadge.hidden = false; visual.classList.add('has-gif');
  gifStatus.textContent = 'El GIF acompaña la expresión detectada.';
});
reactionGif.addEventListener('error',() => {
  reactionGif.hidden = true; reactionBadge.hidden = true; visual.classList.remove('has-gif');
  gifStatus.textContent = 'No se pudo cargar el GIF. Puedes seguir viendo el emoji.';
});

let stream = null, timer = null, generation = 0, starting = false, previousEmotion = null;
for (const [label, expression] of Object.entries(EXPRESSIONS)) {
  const row = document.createElement('div'); row.className = 'score-row';
  applyExpressionColors(row,expression);
  const name = document.createElement('span'); name.className = 'score-label'; name.textContent = expression.emoji + '  ' + label;
  const bar = document.createElement('progress'); bar.max = 100; bar.value = 0; bar.setAttribute('aria-label',label);
  const value = document.createElement('span'); value.className = 'score-value'; value.textContent = '—';
  row.append(name,bar,value); document.querySelector('#scores').append(row);
  scoreRows.set(label,{row,bar,value});
}
function message(text,error = false) { statusText.textContent = text; statusText.dataset.state = error ? 'error' : ''; }
function setMode(text,active = false) { mode.textContent = text; mode.dataset.active = String(active); }
function reset() {
  document.querySelector('#quality-hint').hidden = true;
  clearReaction();
  applyExpressionColors(document.querySelector('.result-card'),null);
  ctx.clearRect(0,0,overlay.width,overlay.height); previousEmotion = null;
  document.querySelector('#emotion').textContent = 'Sin detección';
  document.querySelector('#result-label').textContent = 'ESPERANDO TU PRIMER GESTO';
  document.querySelector('#emotion-description').textContent = 'Cada expresión tiene su propio encanto.';
  document.querySelector('#summary').textContent = 'Las puntuaciones aparecerán al detectar un rostro.';
  document.querySelector('#face-count').textContent = '0 rostros';
  emoji.textContent = '🙂'; emoji.setAttribute('aria-label','Esperando un rostro'); emoji.classList.remove('changed');
  visual.style.setProperty('--face-bg','#f3edfd'); visual.dataset.emotion = 'waiting';
  for (const {row,bar,value} of scoreRows.values()) { bar.value = 0; value.textContent = '—'; row.classList.remove('leading'); }
}
function stop() {
  generation++; clearTimeout(timer);
  if (stream) stream.getTracks().forEach(t => t.stop());
  stream = null; video.srcObject = null; toggle.textContent = 'Iniciar cámara'; setMode('En espera');
}
function placeholder() {
  video.hidden = true; photo.hidden = true;
  document.querySelector('#camera-placeholder').hidden = false;
  document.querySelector('.camera-frame').style.aspectRatio = '4 / 3';
}
function show(source) {
  video.hidden = source !== video; photo.hidden = source !== photo;
  document.querySelector('#camera-placeholder').hidden = true;
  const w = source === video ? video.videoWidth : photo.naturalWidth;
  const h = source === video ? video.videoHeight : photo.naturalHeight;
  document.querySelector('.camera-frame').style.aspectRatio = w + ' / ' + h;
}
function updateResult(main,count) {
  updateReaction(main.emotion);
  const expression = EXPRESSIONS[main.emotion] || {emoji:'🙂',color:'#f3edfd',description:'Explora tu expresión.'};
  applyExpressionColors(document.querySelector('.result-card'),expression);
  emoji.textContent = expression.emoji; emoji.setAttribute('aria-label',main.emotion);
  visual.style.setProperty('--face-bg',expression.color); visual.dataset.emotion = main.emotion;
  if (previousEmotion !== main.emotion) {
    emoji.classList.remove('changed'); void emoji.offsetWidth; emoji.classList.add('changed');
    previousEmotion = main.emotion;
  }
  document.querySelector('#result-label').textContent = 'EXPRESIÓN DETECTADA';
  document.querySelector('#emotion').textContent = main.emotion;
  document.querySelector('#emotion-description').textContent = expression.description;
  document.querySelector('#summary').textContent = main.confidence + '% de puntuación del modelo';
  document.querySelector('#face-count').textContent = count + (count === 1 ? ' rostro' : ' rostros');
  for (const [label,{row,bar,value}] of scoreRows) {
    const score = main.scores[label] ?? 0;
    bar.value = score; value.textContent = Math.round(score) + '%';
    row.classList.toggle('leading',label === main.emotion);
  }
}
async function analyze(source,token) {
  const w = source === video ? video.videoWidth : photo.naturalWidth;
  const h = source === video ? video.videoHeight : photo.naturalHeight;
  if (!w || !h) return;
  const scale = Math.min(1,960 / Math.max(w,h));
  capture.width = Math.round(w*scale); capture.height = Math.round(h*scale);
  capture.getContext('2d').drawImage(source,0,0,capture.width,capture.height);
  const blob = await new Promise(resolve => capture.toBlob(resolve,'image/jpeg',0.94));
  if (token !== generation) return;
  if (!blob) throw new Error('No se pudo capturar la imagen. Inténtalo otra vez.');
  const form = new FormData(); form.append('image',blob,'frame.jpg');
  const controller = new AbortController();
  const requestTimeout = setTimeout(() => controller.abort(),15000);
  let response;
  try {
    response = await fetch('/api/emotions/',{method:'POST',body:form,signal:controller.signal,headers:{'X-CSRFToken':document.querySelector('[name=csrfmiddlewaretoken]').value}});
  } catch (error) {
    if (error.name === 'AbortError') throw new Error('El análisis está tardando demasiado. Cierra otras pestañas que usen la cámara y vuelve a iniciarla.');
    throw error;
  } finally { clearTimeout(requestTimeout); }
  let data;
  try { data = await response.json(); } catch { throw new Error('El servidor no respondió correctamente. Inténtalo de nuevo.'); }
  if (token !== generation) return;
  if (!response.ok) throw new Error(data.error || 'No se pudo analizar la imagen.');
  overlay.width = data.width; overlay.height = data.height;
  for (const face of data.faces) {
    const [x,y,width,height] = face.box;
    ctx.strokeStyle = '#b9a2f4'; ctx.lineWidth = 3; ctx.strokeRect(x,y,width,height);
    ctx.font = 'bold 16px Segoe UI, sans-serif';
    const icon = EXPRESSIONS[face.emotion]?.emoji || '🙂';
    const text = icon + ' ' + face.emotion + ' · ' + face.confidence + '%';
    const labelWidth = ctx.measureText(text).width + 16;
    const left = Math.max(0,Math.min(x,data.width-labelWidth));
    const top = Math.max(26,y);
    ctx.fillStyle = '#35294e'; ctx.fillRect(left,top-26,labelWidth,26);
    ctx.fillStyle = '#fff'; ctx.fillText(text,left+8,top-7);
  }
  const main = [...data.faces].sort((a,b) => b.box[2]*b.box[3]-a.box[2]*a.box[3])[0];
  if (main) {
    if (pendingEmotion === main.emotion) pendingCount++;
    else { pendingEmotion = main.emotion; pendingCount = 1; }
    const ranked = Object.values(main.scores).sort((a,b) => b-a);
    const decisive = ranked[0] >= 70 && ranked[0] - ranked[1] >= 25;
    // Strong predictions react immediately; ambiguous changes need confirmation.
    if (source !== video || previousEmotion === null || previousEmotion === main.emotion || decisive || pendingCount >= 2) {
      updateResult(main,data.faces.length);
    }
  } else reset();
  const quality = document.querySelector('#quality-hint');
  quality.hidden = !main?.quality_hint;
  quality.textContent = main?.quality_hint || '';
  if (main) {
    const ranked = Object.entries(main.scores).sort((a,b) => b[1]-a[1]);
    const ambiguous = ranked.length > 1 && ranked[0][1] - ranked[1][1] < 15;
    message(main.quality_hint || (ambiguous
      ? 'El gesto es parecido a ' + ranked[0][0] + ' y ' + ranked[1][0] + '. Mantén la expresión un instante.'
      : 'Expresión lista. Prueba otro gesto y descubre qué cambia.'));
  } else message('Todavía no veo un rostro. Mira de frente y busca un poco más de luz.');
}
async function loop(token) {
  if (!stream || token !== generation) return;
  try { await analyze(video,token); }
  catch (error) { if (token === generation) { stop(); reset(); placeholder(); message(error.message,true); return; } }
  if (stream && token === generation) timer = setTimeout(() => loop(token),100);
}
toggle.addEventListener('click',async () => {
  if (starting) return;
  if (stream) { stop(); reset(); placeholder(); message('Cámara detenida. Vuelve cuando quieras.'); return; }
  starting = true; toggle.disabled = true; toggle.textContent = 'Conectando…';
  const token = ++generation;
  try {
    if (!navigator.mediaDevices?.getUserMedia) throw new Error('La cámara necesita localhost o una conexión HTTPS.');
    message('Acepta el permiso de cámara para comenzar.');
    const acquired = await navigator.mediaDevices.getUserMedia({video:{width:{ideal:1280},height:{ideal:720},facingMode:'user'},audio:false});
    if (token !== generation) { acquired.getTracks().forEach(t => t.stop()); return; }
    stream = acquired; video.srcObject = stream; await video.play();
    if (token !== generation) return;
    show(video); reset(); toggle.textContent = 'Detener cámara'; setMode('● En vivo',true);
    acquired.getVideoTracks()[0].addEventListener('ended',() => {
      if (token === generation) { stop(); reset(); placeholder(); message('La cámara se desconectó. Puedes volver a iniciarla.'); }
    });
    message('Buscando tu primer gesto…'); loop(token);
  } catch (error) {
    if (token === generation) {
      stop(); reset(); placeholder();
      const errors = {NotAllowedError:'Permite el acceso a la cámara en el navegador.',NotFoundError:'No se encontró una cámara. Puedes analizar una fotografía.',NotReadableError:'La cámara está ocupada. Cierra la otra aplicación e inténtalo de nuevo.'};
      message(errors[error.name] || error.message,true);
    }
  } finally { starting = false; toggle.disabled = false; }
});
document.querySelector('#upload-button').addEventListener('click',() => input.click());
input.addEventListener('change',async () => {
  const file = input.files[0]; if (!file) return;
  if (file.size > 2*1024*1024) { message('Selecciona una imagen de hasta 2 MB.',true); input.value = ''; return; }
  stop(); reset(); placeholder(); const token = generation;
  const url = URL.createObjectURL(file);
  try {
    photo.src = url; await photo.decode();
    if (token !== generation) return;
    show(photo); setMode('Analizando…',true); message('Un momento, estamos explorando la expresión…');
    await analyze(photo,token);
    if (token === generation) setMode('Fotografía');
  } catch (error) {
    if (token === generation) { setMode('Inténtalo de nuevo'); reset(); message(error.name === 'EncodingError' ? 'No pudimos leer esta imagen. Prueba con un JPG, PNG o WebP.' : error.message,true); }
  } finally { URL.revokeObjectURL(url); input.value = ''; }
});
window.addEventListener('pagehide',stop);
