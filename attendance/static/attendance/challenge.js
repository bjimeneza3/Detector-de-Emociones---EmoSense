(() => {
  const anatomy = 'https://www.ncbi.nlm.nih.gov/books/NBK595468/table/ch17.Tab1/';
  const context = 'https://pmc.ncbi.nlm.nih.gov/articles/PMC6640856/';
  const rounds = [
    {emotion:'Neutral',key:'neutral',emoji:'😐',title:'Relaja tu rostro',hint:'Deja descansar las cejas y la mandíbula. Junta los labios suavemente, sin apretarlos.',fact:'Un rostro en reposo no significa que la persona no sienta nada. La expresión por sí sola no permite saber su estado emocional.',source:context},
    {emotion:'Alegría',key:'alegria',emoji:'😊',title:'¡Haz una cara de alegría!',hint:'Sonríe y eleva las mejillas. Deja que los ojos acompañen la sonrisa.',fact:'En algunas sonrisas participan tanto los músculos que elevan las comisuras como los que rodean los ojos.',source:anatomy},
    {emotion:'Sorpresa',key:'sorpresa',emoji:'😲',title:'¡Sorpréndete!',hint:'Levanta las cejas, abre los ojos y forma una pequeña «O» con la boca.',fact:'En el gesto típico de sorpresa pueden combinarse cejas elevadas, párpados superiores levantados y mandíbula abierta.',source:anatomy},
    {emotion:'Tristeza',key:'tristeza',emoji:'😢',title:'Imita un gesto de tristeza',hint:'Eleva un poco la parte interior de las cejas y baja las comisuras de los labios.',fact:'La parte interior de las cejas puede elevarse en el gesto típico de tristeza. Las cejas también aportan información a una expresión.',source:anatomy},
    {emotion:'Disgusto',key:'disgusto',emoji:'🤢',title:'¿Y ese olor? ¡Haz una cara de disgusto!',hint:'Arruga suavemente la nariz y eleva un poco el labio superior.',fact:'Arrugar la nariz y levantar el labio superior son movimientos distintos que pueden aparecer juntos en un gesto de disgusto.',source:anatomy},
    {emotion:'Miedo',key:'miedo',emoji:'😨',title:'Imita un gesto de miedo',hint:'Eleva y acerca las cejas, abre los ojos y estira un poco los labios hacia los lados.',fact:'Miedo y sorpresa comparten movimientos como elevar las cejas y los párpados. En el gesto típico de miedo también puede aparecer tensión en los labios.',source:anatomy},
    {emotion:'Enojo',key:'enojo',emoji:'😠',title:'El último reto: ¡cara de enojo!',hint:'Junta y baja ligeramente las cejas. Aprieta suavemente los labios y mira al frente.',fact:'El ceño fruncido utiliza músculos que acercan y bajan las cejas. Ese movimiento no demuestra, por sí solo, que alguien esté enfadado.',source:anatomy}
  ];
  const $ = id => document.getElementById(id);
  const video = $('challenge-video'), toggle = $('challenge-camera-toggle');
  const canvas = document.createElement('canvas');
  const gif = $('challenge-gif');
  let index = 0, streak = 0, phase = 'attempt', stream = null, starting = false;
  let token = 0, timer = null, controller = null, confettiTimer = null;
  const results = [];
  function status(text) { $('challenge-status').textContent = text; }
  function clearConfetti() { clearTimeout(confettiTimer); $('challenge-confetti').replaceChildren(); }
  function celebrate() {
    clearConfetti();
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const colors = ['#7760d9','#dba548','#70bfa0','#e58ab5'];
    for (let i=0;i<45;i++) {
      const piece = document.createElement('i');
      piece.style.setProperty('--left',Math.random()*100+'%');
      piece.style.setProperty('--drift',(Math.random()-.5)*180+'px');
      piece.style.setProperty('--delay',Math.random()*.25+'s');
      piece.style.setProperty('--confetti-color',colors[i%colors.length]);
      $('challenge-confetti').append(piece);
    }
    confettiTimer = setTimeout(clearConfetti,2300);
  }
  function stopCamera() {
    token++; clearTimeout(timer); controller?.abort(); controller = null;
    if (stream) stream.getTracks().forEach(track => track.stop());
    stream = null; video.srcObject = null; video.hidden = true;
    $('challenge-placeholder').hidden = false;
    toggle.textContent = 'Iniciar cámara'; streak = 0;
  }
  function renderRound() {
    streak = 0; clearConfetti();
    $('mission').hidden = phase !== 'attempt';
    $('celebration').hidden = true;
    $('challenge-summary').hidden = phase !== 'summary';
    $('round-label').textContent = phase === 'summary' ? 'Recorrido completado' : `Reto ${index+1} de ${rounds.length}`;
    $('round-progress').value = index;
    if (phase === 'summary') {
      stopCamera();
      const achieved = results.filter(r => r === 'completed').length;
      $('summary-count').textContent = `${achieved} retos logrados · ${rounds.length-achieved} omitidos. ¡Gracias por jugar!`;
      $('summary-list').replaceChildren();
      rounds.forEach((round,i) => {
        const item = document.createElement('li');
        item.textContent = `${round.emoji} ${round.emotion} · ${results[i] === 'completed' ? 'Logrado ✓' : 'Omitido'}`;
        $('summary-list').append(item);
      });
      toggle.disabled = true; status('Recorrido terminado. Puedes volver a jugar.');
      gif.removeAttribute('src');
      return;
    }
    const round = rounds[index];
    $('mission-title').textContent = round.title;
    $('mission-emoji').textContent = round.emoji;
    $('mission-hint').textContent = round.hint;
    $('match-status').textContent = 'Buscamos dos detecciones seguidas de ' + round.emotion.toLowerCase() + '.';
    toggle.disabled = false;
    status(stream ? 'Imita el gesto y mantenlo unos segundos.' : 'Activa la cámara cuando estés listo.');
  }
  function win() {
    if (phase !== 'attempt') return;
    phase = 'won'; results[index] = 'completed';
    const round = rounds[index];
    $('mission').hidden = true; $('celebration').hidden = false;
    $('success-title').textContent = round.emotion + ' · ¡Reto completado!';
    $('curiosity').textContent = round.fact;
    $('gif-fallback').textContent = round.emoji; $('gif-fallback').hidden = false;
    $('gif-error').hidden = true; gif.hidden = true;
    gif.alt = 'GIF de celebración: ' + round.emotion;
    gif.src = $('challenge-gif-sources').dataset[round.key];
    $('round-progress').value = index+1;
    $('next-round').textContent = index === rounds.length-1 ? 'Ver mi resumen →' : 'Siguiente reto →';
    status('¡Lo lograste! Disfruta del GIF y descubre la curiosidad.');
    celebrate();
  }
  function evaluate(faces) {
    if (phase !== 'attempt') return;
    const main = [...faces].sort((a,b) => b.box[2]*b.box[3]-a.box[2]*a.box[3])[0];
    if (!main) {
      streak = 0; $('match-status').textContent = 'Todavía no vemos tu rostro. Mira de frente y busca buena luz.'; return;
    }
    if (main.emotion === rounds[index].emotion) {
      streak++;
      if (streak >= 2) win();
      else $('match-status').textContent = '¡Vas bien! Mantén ese gesto un instante más. (1 de 2)';
    } else {
      streak = 0;
      $('match-status').textContent = `El modelo ve ${main.emotion.toLowerCase()}. Sigue intentando ${rounds[index].emotion.toLowerCase()}.`;
    }
  }
  async function loop(runToken) {
    if (!stream || runToken !== token || phase !== 'attempt') return;
    if (document.hidden) { streak = 0; timer = setTimeout(() => loop(runToken),500); return; }
    const roundIndex = index;
    try {
      if (!video.videoWidth || video.readyState < 2) { timer = setTimeout(() => loop(runToken),200); return; }
      const scale = Math.min(1,960/Math.max(video.videoWidth,video.videoHeight));
      canvas.width = Math.round(video.videoWidth*scale); canvas.height = Math.round(video.videoHeight*scale);
      canvas.getContext('2d').drawImage(video,0,0,canvas.width,canvas.height);
      const blob = await new Promise(resolve => canvas.toBlob(resolve,'image/jpeg',.94));
      if (runToken !== token || roundIndex !== index || phase !== 'attempt') return;
      if (!blob) throw new Error('No pudimos leer la cámara. Vuelve a iniciarla.');
      const form = new FormData(); form.append('image',blob,'reto.jpg');
      controller = new AbortController();
      const requestController = controller;
      const timeout = setTimeout(() => requestController.abort(),15000);
      let response, data;
      try {
        response = await fetch('/api/emotions/',{method:'POST',body:form,signal:requestController.signal,
          headers:{'X-CSRFToken':document.querySelector('[name=csrfmiddlewaretoken]').value}});
        data = await response.json();
      } finally { clearTimeout(timeout); if (controller === requestController) controller = null; }
      if (runToken !== token || roundIndex !== index || phase !== 'attempt') return;
      if (!response.ok) throw new Error(data.error || 'No se pudo analizar la expresión.');
      evaluate(data.faces);
    } catch (error) {
      if (runToken !== token || roundIndex !== index) return;
      stopCamera();
      status(error.name === 'AbortError' ? 'El análisis tardó demasiado. Vuelve a iniciar la cámara.' : error.message || 'No se pudo analizar el gesto.');
      return;
    }
    if (runToken === token && stream && phase === 'attempt') timer = setTimeout(() => loop(runToken),150);
  }
  toggle.addEventListener('click',async () => {
    if (starting) return;
    if (stream) { stopCamera(); status('Cámara detenida. Tu progreso se mantiene.'); return; }
    starting = true; toggle.disabled = true;
    const runToken = ++token;
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('La cámara necesita localhost o una conexión HTTPS.');
      status('Permite el acceso a la cámara para comenzar.');
      const acquired = await navigator.mediaDevices.getUserMedia({video:{width:{ideal:1280},height:{ideal:720},facingMode:'user'},audio:false});
      if (runToken !== token) { acquired.getTracks().forEach(t => t.stop()); return; }
      stream = acquired; video.srcObject = stream; await video.play();
      if (runToken !== token) return;
      video.hidden = false; $('challenge-placeholder').hidden = true; toggle.textContent = 'Detener cámara';
      acquired.getVideoTracks()[0].addEventListener('ended',() => { if (stream === acquired) { stopCamera(); status('La cámara se desconectó. Puedes volver a iniciarla.'); } });
      status(phase === 'won' ? 'Tu reto está completado. Pulsa Siguiente reto para continuar.' : 'Imita la expresión y mantenla unos segundos.');
      loop(runToken);
    } catch (error) {
      if (runToken === token) {
        stopCamera();
        const errors = {NotAllowedError:'Permite el acceso a la cámara en tu navegador.',NotFoundError:'No se encontró una cámara.',NotReadableError:'La cámara está ocupada. Cierra la otra aplicación e inténtalo de nuevo.'};
        status(errors[error.name] || error.message);
      }
    } finally { starting = false; toggle.disabled = phase === 'summary'; }
  });
  function advance(skipped) {
    if (starting || (skipped ? phase !== 'attempt' : phase !== 'won')) return;
    if (skipped) results[index] = 'skipped';
    token++; controller?.abort(); clearTimeout(timer);
    index++; phase = index === rounds.length ? 'summary' : 'attempt';
    renderRound();
    if (stream && phase === 'attempt') loop(token);
  }
  $('skip-round').addEventListener('click',() => advance(true));
  $('next-round').addEventListener('click',() => advance(false));
  $('restart-challenge').addEventListener('click',() => {
    stopCamera(); index = 0; results.length = 0; phase = 'attempt'; renderRound();
  });
  gif.addEventListener('load',() => { if (phase === 'won') { gif.hidden = false; $('gif-fallback').hidden = true; } });
  gif.addEventListener('error',() => { gif.hidden = true; $('gif-fallback').hidden = false; $('gif-error').hidden = false; });
  document.addEventListener('visibilitychange',() => { streak = 0; });
  window.addEventListener('pagehide',() => { stopCamera(); clearConfetti(); });
  renderRound();
})();
