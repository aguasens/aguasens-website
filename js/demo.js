/* ═══════════════════════════════════════════
   SIMULADOR DE LA APP AGUASENS
   Todo es local: no hay backend, no se toca la base real. El campo, los
   nodos y los valores son inventados; la presentación (pines, colores,
   fichas) copia la de la PWA para que se vea como la app de verdad.
   ═══════════════════════════════════════════ */
(() => {
  'use strict';

  /* ─── Reloj simulado ─────────────────────────
     1 segundo real = MIN_POR_SEG minutos de campo. Cada nodo reporta cada
     INTERVALO minutos simulados, desfasados entre sí. */
  const MIN_POR_SEG = 2;
  const INTERVALO = 5;
  const SIN_REPORTE_MIN = 30;   // a partir de acá el nodo se pinta gris y avisa

  const COLORES = { green: '#16a34a', yellow: '#eab308', orange: '#ea580c', red: '#ef4444', gray: '#94a3b8', blue: '#0ea5e9' };
  const RANGO = { gray: 0, blue: 0, green: 1, yellow: 2, orange: 3, red: 4 };

  /* ─── Pin con el logo (copia de pinIcon en PWA/src/lib/status.js) ─── */
  const PIN_PATHS = [
    'm 88.76027,265.00456 c -1.856997,-0.3127 -3.948057,-1.3687 -5.290524,-2.67174 -2.0452,-1.98513 -12.216012,-19.4998 -18.494354,-31.84825 C 59.39417,219.50725 56.25683,212.0141 54.61751,205.74603 c -1.868735,-7.14524 -1.007461,-15.39193 2.34859,-22.48772 5.17442,-10.94042 14.796352,-18.42823 26.753759,-20.81984 3.523491,-0.70473 10.434035,-0.63124 14.082864,0.14977 4.891077,1.0469 9.024037,2.79502 13.179317,5.57444 6.90964,4.62178 12.48118,12.17545 14.73763,19.98067 1.65171,5.71341 1.91245,11.17058 0.77584,16.23833 -2.32131,10.34997 -10.92595,28.2486 -24.44032,50.83862 -3.212427,5.36975 -4.107221,6.66771 -5.224502,7.57849 -2.229636,1.81755 -5.335219,2.66635 -8.070418,2.20577 z m 6.162585,-54.73175 c 3.712004,-1.17456 7.013725,-4.04517 8.706285,-7.56948 1.63032,-3.3947 1.99734,-6.45518 1.1866,-9.8946 -1.51394,-6.42261 -7.003892,-10.99396 -13.616317,-11.33798 -2.929998,-0.15243 -4.827137,0.24193 -7.59466,1.57873 -3.513643,1.6972 -6.659538,5.73222 -7.608794,9.75925 -2.229359,9.45764 5.301516,18.59406 14.939052,18.124 1.23712,-0.0603 3.031303,-0.35725 3.987834,-0.65992 z',
    'm 80.748563,280.71957 c -18.971879,-1.47013 -31.256972,-5.72311 -34.28217,-11.86816 -0.753522,-1.53062 -0.824336,-1.88189 -0.731105,-3.62664 0.135519,-2.53611 0.916521,-4.06647 3.093152,-6.06096 1.932553,-1.77083 5.676367,-3.73627 9.445671,-4.95882 3.104226,-1.00683 8.676372,-2.28163 9.145062,-2.09221 0.417254,0.16863 4.331991,6.77197 4.132797,6.97116 -0.07197,0.072 -1.852722,0.47882 -3.957232,0.90412 -4.18115,0.84496 -8.589723,2.19412 -10.820448,3.31141 -1.666632,0.83475 -3.145517,1.8969 -3.145517,2.25915 0,0.44033 2.682974,1.98743 5.159374,2.97508 7.284991,2.90545 18.384165,4.46243 31.749999,4.45386 11.886134,-0.008 21.555364,-1.20505 29.236454,-3.62062 2.56756,-0.80745 5.58291,-2.21096 6.74546,-3.13968 0.77345,-0.61789 0.78081,-0.6457 0.30909,-1.16695 -1.44528,-1.59702 -7.40556,-3.81797 -13.61218,-5.07225 -2.10451,-0.4253 -3.88614,-0.83302 -3.95917,-0.90605 -0.073,-0.073 0.76445,-1.65577 1.86108,-3.5172 1.44345,-2.45013 2.15031,-3.40825 2.56059,-3.47078 0.31169,-0.0475 2.30914,0.34966 4.43878,0.88259 11.39758,2.85217 17.0013,7.00146 17.00197,12.58913 8.8e-4,7.33118 -10.12903,12.30679 -29.8977,14.68515 -3.40538,0.4097 -20.90927,0.74489 -24.473957,0.46867 z',
    'm 80.010808,297 c -20.549491,-1.12073 -38.602258,-5.66811 -48.762623,-12.28301 -2.523708,-1.64306 -6.182417,-5.50832 -7.187896,-7.59368 -2.511179,-5.2082 -1.433365,-10.46665 3.081408,-15.03362 2.157581,-2.18253 6.297768,-5.07503 7.989751,-5.58196 1.409527,-0.42231 2.859568,0.0328 3.907653,1.22654 1.061659,1.20916 1.286283,2.4703 0.70915,3.98151 -0.401085,1.05022 -0.773129,1.39157 -3.426,3.14335 -5.001852,3.30289 -6.562495,5.82241 -5.280266,8.52451 2.815424,5.93307 16.381888,11.50386 34.64078,14.22454 8.563482,1.27601 13.420961,1.58801 24.723089,1.58801 10.956106,0 15.989826,-0.3043 23.944786,-1.4475 18.38832,-2.64258 32.23907,-8.22652 35.30308,-14.23248 1.02274,-2.00474 0.48153,-3.84433 -1.7925,-6.09282 -1.21885,-1.20515 -1.92167,-1.72046 -4.83882,-3.5478 -1.1996,-0.75144 -1.58039,-1.16858 -1.94981,-2.1359 -0.58663,-1.53605 -0.36756,-2.78952 0.70001,-4.00542 1.04809,-1.19371 2.49813,-1.64885 3.90766,-1.22654 1.69239,0.50705 5.83432,3.40094 7.96106,5.56224 3.79128,3.85288 5.19896,8.07734 4.0989,12.30076 -0.72538,2.78492 -1.70288,4.38626 -4.23038,6.93024 -1.31016,1.31871 -3.08601,2.85592 -3.94632,3.41602 -13.72569,8.9361 -41.3784,13.81957 -69.552712,12.28301 z'
  ];
  const PIN_W = 135.36754, PIN_H = 135.32695;
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  function pinIcon(color, label) {
    const paths = PIN_PATHS.map((d) => '<path fill="' + color + '" d="' + d + '"/>').join('');
    const glyph = '<g transform="translate(-22.735921,-161.95306)">' + paths + '</g>';
    const FS = 44, PAD = 16, GAP = 6;
    const textW = label.length * FS * 0.55;
    const chipW = textW + PAD * 2, chipH = FS * 1.62;
    const chipX = PIN_W + GAP, chipY = (PIN_H - chipH) / 2;
    const total = chipX + chipW;
    const chip = '<rect x="' + chipX + '" y="' + chipY + '" width="' + chipW + '" height="' + chipH + '" rx="6" fill="#000" fill-opacity="0.62" stroke="' + color + '" stroke-width="4"/>'
      + '<text x="' + (chipX + PAD) + '" y="' + (chipY + chipH / 2) + '" font-family="system-ui,-apple-system,Segoe UI,Roboto,sans-serif" font-size="' + FS + '" font-weight="600" fill="#fff" dominant-baseline="central" textLength="' + textW + '" lengthAdjust="spacingAndGlyphs">' + esc(label) + '</text>';
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + total + ' ' + PIN_H + '">' + glyph + chip + '</svg>';
    const h = 30, w = total / PIN_H * h;
    return L.icon({
      iconUrl: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg),
      iconSize: [w, h], iconAnchor: [(PIN_W / 2) / PIN_H * h, h / 2],
      className: color === COLORES.red ? 'pin-alerta' : ''
    });
  }

  /* ─── Utilidades ─── */
  const $ = (s) => document.querySelector(s);
  const ruido = (a) => (Math.random() * 2 - 1) * a;
  const lim = (v, a, b) => Math.max(a, Math.min(b, v));
  const fmt = (v, d = 0) => Number(v).toLocaleString('es-AR', { minimumFractionDigits: d, maximumFractionDigits: d });
  const thi = (t, hr) => (1.8 * t + 32) - (0.55 - 0.0055 * hr) * (1.8 * t - 26);

  /* ─── El campo ficticio ─── */
  const CENTRO = [-36.6075, -61.0480];
  const GATEWAY = [-36.6058, -61.0512];

  const MODELOS = {
    fijo: 'Nodo Fijo', movil: 'Nodo Móvil', bombaRed: 'Nodo Bomba Red',
    bombaSolar: 'Nodo Bomba Solar', molino: 'Nodo Molino'
  };

  let nodos, simMin, escenario, avisosAbiertos;

  function estadoInicial() {
    simMin = 0;
    escenario = null;
    avisosAbiertos = {};
    nodos = [
      { id: 1, nombre: 'Tanque australiano', modelo: 'fijo', lote: 'Casco', pos: [-36.6012, -61.0418],
        nivel: 72, altoM: 1.8, capL: 45000, tAgua: 18.6, tAire: 24, hr: 55, bat: 12.62, rssi: -78, snr: 10, rx: -72, consumo: [] },
      { id: 2, nombre: 'Bebedero Lote 4', modelo: 'movil', lote: 'Lote 4', pos: [-36.6172, -61.0330],
        nivel: 66, altoM: 0.6, capL: 4000, tAgua: 19.4, tAire: 24.5, hr: 52, bat: 12.48, rssi: -97, snr: 4, rx: -91, consumo: [] },
      { id: 3, nombre: 'Bomba casco', modelo: 'bombaRed', lote: 'Casco', pos: [-36.6098, -61.0560],
        marcha: false, corriente: 0, caudal: 0, horasHoy: 2.6, arranques: 4, volHoy: 9.4, bat: 12.71, rssi: -64, snr: 12, rx: -60 },
      { id: 4, nombre: 'Bomba solar Lote 7', modelo: 'bombaSolar', lote: 'Lote 7', pos: [-36.5958, -61.0275],
        marcha: true, panelV: 98, potencia: 285, caudal: 17.5, horasHoy: 3.1, arranques: 3, whHoy: 860, bat: 12.55, rssi: -101, snr: 2, rx: -95 },
      { id: 5, nombre: 'Molino del bajo', modelo: 'molino', lote: 'Lote 2', pos: [-36.6195, -61.0610],
        golpes: 9, caudal: 8.2, horasHoy: 5.4, volHoy: 2.7, bat: 12.66, rssi: -94, snr: 5, rx: -88 },
    ];
    nodos.forEach((n, i) => {
      n.ultimo = -(i * 1);         // reportaron hace 0..4 min
      n.offset = i;                // desfase de los reportes
      n.historia = historiaInicial(n);
      n.callado = false;
    });
  }

  /* 7 días de historia (un punto por hora) para el gráfico de tendencia. */
  function historiaInicial(n) {
    const pts = [];
    for (let h = -168; h <= 0; h++) {
      const hora = ((h % 24) + 24 + 14) % 24;          // "ahora" son las 14 h
      const sol = Math.max(0, Math.sin((hora - 6) / 12 * Math.PI));
      let v;
      switch (n.modelo) {
        case 'fijo':   v = 70 + 12 * Math.sin(h / 9) + ruido(2); break;
        case 'movil':  v = 64 + 4 * Math.sin(h / 5) + ruido(2); break;
        case 'bombaRed': v = (Math.sin(h / 9) < -0.3) ? 7.6 + ruido(0.3) : 0; break;
        case 'bombaSolar': v = sol > 0.15 ? 300 * sol + ruido(25) : 0; break;
        case 'molino': v = lim(8 + 4 * Math.sin(h / 7) + ruido(2), 0, 14); break;
      }
      pts.push(Math.max(0, v));
    }
    return pts;
  }

  /* ─── Estado / semáforo de cada métrica ─── */
  function evalNivel(p) {
    if (p < 20) return { lvl: 'red', txt: 'Crítico' };
    if (p < 50) return { lvl: 'yellow', txt: 'Bajo' };
    return { lvl: 'green', txt: 'Lleno' };
  }
  function evalThi(v) {
    if (v >= 84) return { lvl: 'red', txt: 'Emergencia' };
    if (v >= 79) return { lvl: 'orange', txt: 'Peligro' };
    if (v >= 74) return { lvl: 'yellow', txt: 'Alerta' };
    return { lvl: 'green', txt: 'Normal' };
  }
  function evalTagua(t) {
    if (t > 30) return { lvl: 'red', txt: 'Crítica' };
    if (t > 20) return { lvl: 'yellow', txt: 'Precaución' };
    if (t < 10) return { lvl: 'blue', txt: 'Muy fría' };
    return { lvl: 'green', txt: 'Óptima' };
  }
  function evalSolar(n) {
    if (n.panelV >= 100 && n.potencia < 150) return { lvl: 'red', txt: 'Rinde poco' };
    return n.marcha ? { lvl: 'green', txt: 'Bombeando' } : { lvl: 'blue', txt: 'Parada' };
  }
  function evalBomba(n) {
    if (n.marcha && n.corriente > 2 && n.caudal < 1) return { lvl: 'red', txt: 'Sin caudal' };
    return n.marcha ? { lvl: 'green', txt: 'En marcha' } : { lvl: 'blue', txt: 'Parada' };
  }

  function edad(n) { return Math.max(0, simMin - n.ultimo); }

  function estadoNodo(n) {
    if (edad(n) >= SIN_REPORTE_MIN) return { lvl: 'gray', txt: 'Sin reportar' };
    const ev = [];
    if (n.modelo === 'fijo' || n.modelo === 'movil') {
      ev.push(evalNivel(n.nivel), evalThi(thi(n.tAire, n.hr)));
      const ta = evalTagua(n.tAgua); if (ta.lvl === 'red') ev.push(ta);
    }
    if (n.modelo === 'bombaRed') ev.push(evalBomba(n));
    if (n.modelo === 'bombaSolar') ev.push(evalSolar(n));
    if (n.modelo === 'molino') ev.push(n.golpes > 0 ? { lvl: 'green', txt: 'Funcionando' } : { lvl: 'yellow', txt: 'Quieto' });
    let peor = { lvl: 'green', txt: 'Ok' };
    ev.forEach((e) => { if (RANGO[e.lvl] > RANGO[peor.lvl]) peor = e; });
    if (peor.lvl === 'green') peor = { lvl: 'green', txt: 'Ok' };
    return peor;
  }

  /* ─── Un reporte de un nodo: evolución de los valores ─── */
  function reportar(n) {
    if (n.callado) return;
    const tanque = nodos[0];
    const bomba = nodos[2];
    switch (n.modelo) {
      case 'fijo': {
        const perdida = escenario && escenario.id === 'tanque';
        if (perdida && !escenario.resolviendo) n.nivel = Math.max(8, n.nivel - 10);
        else if (perdida) n.nivel = Math.min(70, n.nivel + 12);
        else if (n.nivel < 50) n.nivel += 6;
        else n.nivel = lim(n.nivel - 0.6 + (bomba.marcha && bomba.caudal > 1 ? 2.2 : 0) + ruido(0.2), 0, 100);
        n.tAgua = lim(n.tAgua + ruido(0.15), 15, 22);
        n.tAire = lim(n.tAire + ruido(0.3), 20, 28); n.hr = lim(n.hr + ruido(1), 40, 70);
        break;
      }
      case 'movil': {
        if (escenario && escenario.id === 'bebedero' && !escenario.resolviendo) n.nivel = Math.max(9, n.nivel - 11);
        else if (escenario && escenario.id === 'bebedero' && escenario.resolviendo) n.nivel = Math.min(66, n.nivel + 14);
        else n.nivel = n.nivel < 58 ? n.nivel + 9 : lim(n.nivel + ruido(1.2), 58, 72);
        if (escenario && escenario.id === 'calor' && !escenario.resolviendo) { n.tAire = Math.min(34.5, n.tAire + 2.5); n.hr = Math.max(44, n.hr - 2); }
        else if (escenario && escenario.id === 'calor') { n.tAire = Math.max(24, n.tAire - 3); n.hr = Math.min(55, n.hr + 2); }
        else { n.tAire = lim(n.tAire + ruido(0.3), 21, 27); n.hr = lim(n.hr + ruido(1), 45, 65); }
        n.tAgua = lim(n.tAgua + (n.tAire > 30 ? 0.4 : ruido(0.15)), 15, 27);
        break;
      }
      case 'bombaRed': {
        const enSeco = escenario && escenario.id === 'bomba' && !escenario.resolviendo;
        const antes = n.marcha;
        if (enSeco) n.marcha = true;
        else if (tanque.nivel < 60) n.marcha = true;
        else if (tanque.nivel > 85) n.marcha = false;
        if (n.marcha && !antes) n.arranques++;
        n.corriente = n.marcha ? (enSeco ? 6.1 + ruido(0.2) : 7.6 + ruido(0.25)) : 0;
        n.caudal = n.marcha && !enSeco ? 42 + ruido(1.5) : 0;
        if (n.marcha) { n.horasHoy += INTERVALO / 60; n.volHoy += n.caudal * INTERVALO / 1000; }
        break;
      }
      case 'bombaSolar': {
        const floja = escenario && escenario.id === 'solar';
        if (floja && !escenario.resolviendo) {
          n.potencia = Math.max(105 + ruido(8), n.potencia * 0.6);
          n.panelV = lim(103 + ruido(0.8), 101, 105);          // casi en vacío: la bomba no toma la potencia
          n.caudal = Math.max(0, n.potencia / 16.5 - 2.5 + ruido(0.3));
        } else {
          n.potencia = n.potencia < 230 ? 275 + ruido(12) : lim(n.potencia + ruido(18), 230, 330);
          n.panelV = lim(96 + ruido(2), 92, 99);
          n.caudal = n.potencia / 16.5 + ruido(0.4);
        }
        n.horasHoy += INTERVALO / 60; n.whHoy += n.potencia * INTERVALO / 60;
        break;
      }
      case 'molino': {
        n.golpes = lim(n.golpes + ruido(1.2), 5, 13);
        n.caudal = n.golpes * 0.9 + ruido(0.3);
        n.horasHoy += INTERVALO / 60; n.volHoy += n.caudal * INTERVALO / 1000;
        break;
      }
    }
    n.bat = lim(n.bat + ruido(0.01), 12.3, 12.9);
    n.ultimo = simMin;
    // un punto nuevo al gráfico cada reporte (se corre la ventana)
    const v = { fijo: n.nivel, movil: n.nivel, bombaRed: n.corriente, bombaSolar: n.potencia, molino: n.golpes }[n.modelo];
    n.historia.push(v); n.historia.shift();
  }

  /* ─── Avisos (lo que llegaría por Telegram) ─── */
  function revisarAvisos() {
    nodos.forEach((n) => {
      const st = estadoNodo(n);
      const clave = n.id;
      const abierto = avisosAbiertos[clave];
      const grave = st.lvl === 'red' || st.lvl === 'orange' || st.lvl === 'gray';
      if (grave && !abierto) {
        avisosAbiertos[clave] = st.lvl;
        notificar(n, textoAviso(n, st));
        escenarioAvisado();
      } else if (!grave && abierto) {
        delete avisosAbiertos[clave];
        notificar(n, '✅ <b>' + esc(n.nombre) + '</b> — Resuelto: ' + textoResuelto(n));
        escenarioResuelto();
      }
    });
  }
  function textoAviso(n, st) {
    const nom = '<b>' + esc(n.nombre) + '</b>';
    if (st.lvl === 'gray') return '⚪ ' + nom + ' — No reporta desde hace ' + edad(n) + ' min. Puede ser el equipo o la señal: revisalo en la próxima recorrida.';
    if (n.modelo === 'fijo' && evalNivel(n.nivel).lvl === 'red') return '🔴 ' + nom + ' — Nivel crítico: ' + fmt(n.nivel) + ' %. Sigue bajando aunque la bomba está en marcha: posible pérdida o rotura.';
    if (n.modelo === 'bombaSolar') return '🔴 ' + nom + ' — Con pleno sol rinde menos de la mitad de lo normal (' + fmt(n.potencia) + ' W; lo habitual son ~290 W). Posible pozo bajo, bomba gastada o trabada.';
    if (n.modelo === 'movil' && evalNivel(n.nivel).lvl === 'red') return '🔴 ' + nom + ' — Nivel crítico: ' + fmt(n.nivel) + ' %. El bebedero se está quedando sin agua.';
    if (n.modelo === 'movil' && evalThi(thi(n.tAire, n.hr)).lvl !== 'green') return '🟠 ' + nom + ' — Estrés por calor: THI ' + fmt(thi(n.tAire, n.hr)) + ' (' + st.txt.toLowerCase() + '). Asegurá sombra y agua.';
    if (n.modelo === 'bombaRed') return '🔴 ' + nom + ' — Consume ' + fmt(n.corriente, 1) + ' A pero no pasa agua. Posible marcha en seco u obstrucción.';
    return '🔴 ' + nom + ' — ' + st.txt;
  }
  function textoResuelto(n) {
    if (n.modelo === 'movil') return 'nivel ' + fmt(n.nivel) + ' %, THI ' + fmt(thi(n.tAire, n.hr)) + '.';
    if (n.modelo === 'bombaRed') return n.caudal > 1 ? 'vuelve a pasar agua (' + fmt(n.caudal) + ' L/min).' : 'la bomba volvió a funcionar normalmente.';
    if (n.modelo === 'molino') return 'volvió a reportar.';
    if (n.modelo === 'fijo') return 'el nivel se recupera (' + fmt(n.nivel) + ' %).';
    if (n.modelo === 'bombaSolar') return 'vuelve a rendir normal (' + fmt(n.potencia) + ' W, ' + fmt(n.caudal, 1) + ' L/min).';
    return 'valores normales.';
  }

  function notificar(n, html) {
    const cont = $('#notifs');
    const el = document.createElement('div');
    el.className = 'notif';
    el.innerHTML = '<div class="notif__ico"><i data-lucide="send"></i></div><div>'
      + '<div class="notif__cab"><b>AguaSens Alertas</b><span>ahora</span></div>'
      + '<div class="notif__txt">' + html + '</div></div>';
    el.addEventListener('click', () => { quitar(el); abrirFicha(n.id); });
    cont.prepend(el);
    while (cont.children.length > 2) cont.lastChild.remove();
    lucide.createIcons();
    setTimeout(() => quitar(el), 7000);
  }
  function quitar(el) {
    if (!el.isConnected || el.classList.contains('saliendo')) return;
    el.classList.add('saliendo');
    setTimeout(() => el.remove(), 300);
  }

  /* ─── Mapa ─── */
  let mapa, marcadores = {};
  function iniciarMapa() {
    mapa = L.map('map', { zoomControl: false, attributionControl: true }).setView(CENTRO, 14);
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      attribution: 'Imágenes &copy; Esri', maxZoom: 18
    }).addTo(mapa);
    L.marker(GATEWAY, {
      icon: L.divIcon({ className: '', html: '<div class="gw-marker" title="Gateway"><i data-lucide="radio-tower"></i></div>', iconSize: [30, 30], iconAnchor: [15, 15] }),
      keyboard: false
    }).addTo(mapa).bindTooltip('Gateway (casco)', { direction: 'top', offset: [0, -14] });
    nodos.forEach((n) => {
      const m = L.marker(n.pos, { title: n.nombre }).addTo(mapa);
      m.on('click', () => abrirFicha(n.id));
      marcadores[n.id] = m;
    });
    encuadrar();
  }
  function encuadrar() {
    const b = L.latLngBounds(nodos.map((n) => n.pos).concat([GATEWAY]));
    mapa.fitBounds(b, { paddingTopLeft: [20, 110], paddingBottomRight: [120, 30] });
  }
  const colorPin = {};
  function pintarPines() {
    nodos.forEach((n) => {
      const c = COLORES[estadoNodo(n).lvl === 'blue' ? 'green' : estadoNodo(n).lvl];
      if (colorPin[n.id] !== c) { marcadores[n.id].setIcon(pinIcon(c, n.nombre)); colorPin[n.id] = c; }
    });
  }

  /* ─── Ficha del nodo ─── */
  let fichaAbierta = null;   // id del nodo, 'lista' o null

  function tile(lbl, val, unidad, ev, extra) {
    return '<div class="tile t-' + ev.lvl + '"><div class="tile__lbl">' + lbl + '</div>'
      + '<div class="tile__val">' + val + (unidad ? '<small>' + unidad + '</small>' : '') + '</div>'
      + (extra ? '<div class="tile__extra">' + extra + '</div>' : '')
      + '<div class="tile__est">' + ev.txt + '</div></div>';
  }
  const fila = (a, b) => '<li><span>' + a + '</span><span>' + b + '</span></li>';
  const hace = (n) => { const e = edad(n); return e < 1 ? 'Reportó recién' : 'Reportó hace ' + e + ' min'; };
  const senal = (n) => fila('Señal LoRa ↑ (gw oye nodo)', n.rssi + ' dBm') + fila('Señal LoRa ↓ (nodo oye gw)', n.rx + ' dBm · SNR ' + n.snr);

  function grafico(datos, unidad, dec) {
    const W = 340, H = 120, PL = 30, PR = 6, PT = 8, PB = 18;
    const max = Math.max(...datos) * 1.1 || 1, min = 0;
    const x = (i) => PL + i / (datos.length - 1) * (W - PL - PR);
    const y = (v) => PT + (1 - (v - min) / (max - min)) * (H - PT - PB);
    const pts = datos.map((v, i) => x(i).toFixed(1) + ',' + y(v).toFixed(1)).join(' ');
    let ejes = '';
    for (let d = 0; d <= 7; d++) {
      const xi = x(d / 7 * (datos.length - 1));
      ejes += '<line x1="' + xi + '" y1="' + PT + '" x2="' + xi + '" y2="' + (H - PB) + '" stroke="#e2e8f0"/>';
      if (d < 7) ejes += '<text x="' + (xi + 2) + '" y="' + (H - 5) + '">' + (d === 0 ? '−7 d' : '−' + (7 - d)) + '</text>';
    }
    ejes += '<text x="0" y="' + (PT + 8) + '">' + fmt(max, dec) + '</text><text x="0" y="' + (H - PB) + '">0</text>';
    return '<svg class="grafico" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none" role="img" aria-label="Tendencia de 7 días en ' + unidad + '">'
      + ejes + '<polyline fill="none" stroke="#2c5aa0" stroke-width="1.6" points="' + pts + '"/></svg>';
  }

  function htmlFicha(n) {
    const st = estadoNodo(n);
    let tiles = '', filas = '', extra = '';
    const bat = fila('Batería', fmt(n.bat, 2) + ' V');
    switch (n.modelo) {
      case 'fijo':
      case 'movil': {
        const cm = n.nivel / 100 * n.altoM * 100, litros = n.nivel / 100 * n.capL;
        const t = thi(n.tAire, n.hr);
        tiles = tile('Nivel', fmt(n.nivel), '%', evalNivel(n.nivel), '↕ ' + fmt(cm) + ' cm · ' + fmt(litros) + ' L')
          + tile('Temp agua', fmt(n.tAgua, 1), '°C', evalTagua(n.tAgua))
          + tile('THI aire', fmt(t), '', evalThi(t), fmt(n.tAire, 1) + ' °C · ' + fmt(n.hr) + ' %');
        filas = bat + senal(n) + fila('Intervalo', '15 min')
          + fila('Ubicación', n.pos[0].toFixed(5) + ', ' + n.pos[1].toFixed(5) + (n.modelo === 'movil' ? ' · GPS' : ''));
        const d = n.modelo === 'fijo' ? 1 : 0.18;
        extra = '<div class="bloque-t">Consumo</div><div class="tiles">'
          + tile('24 h', fmt(6200 * d), ' L', { lvl: 'gray', txt: '' })
          + tile('7 días', fmt(41800 * d), ' L', { lvl: 'gray', txt: '' })
          + tile('30 días', fmt(179 * d, 1), ' m³', { lvl: 'gray', txt: '' }) + '</div>'
          + '<p class="ficha__nota">Sumamos las bajadas del nivel; las subidas se consideran recargas.</p>'
          + '<div class="bloque-t">Tendencia · nivel (%)</div>' + grafico(n.historia, '%', 0);
        break;
      }
      case 'bombaRed': {
        tiles = tile('Estado', n.marcha ? 'ON' : 'OFF', '', evalBomba(n))
          + tile('Caudal', fmt(n.caudal), 'L/min', n.marcha ? (n.caudal < 1 ? { lvl: 'red', txt: 'Sin agua' } : { lvl: 'green', txt: 'Ok' }) : { lvl: 'gray', txt: '—' })
          + tile('Corriente', fmt(n.corriente, 1), 'A', n.marcha ? { lvl: 'green', txt: 'Ok' } : { lvl: 'gray', txt: '—' });
        filas = fila('Horas de bombeo hoy', fmt(n.horasHoy, 1) + ' h') + fila('Arranques hoy', n.arranques)
          + fila('Volumen hoy', fmt(n.volHoy, 1) + ' m³') + bat + senal(n);
        extra = '<div class="bloque-t">Tendencia · corriente (A)</div>' + grafico(n.historia, 'A', 1);
        break;
      }
      case 'bombaSolar': {
        const es = evalSolar(n);
        tiles = tile('Potencia', fmt(n.potencia), 'W', es)
          + tile('Caudal', fmt(n.caudal, 1), 'L/min', es.lvl === 'red' ? { lvl: 'red', txt: 'Bajo' } : { lvl: 'green', txt: 'Ok' })
          + tile('Panel', fmt(n.panelV), 'V', { lvl: 'green', txt: 'Con sol' });
        filas = fila('Corriente del panel', fmt(n.potencia / n.panelV, 2) + ' A') + fila('Energía hoy', fmt(n.whHoy) + ' Wh')
          + fila('Horas de bombeo hoy', fmt(n.horasHoy, 1) + ' h') + fila('Arranques hoy', n.arranques) + bat + senal(n);
        extra = '<div class="bloque-t">Tendencia · potencia (W)</div>' + grafico(n.historia, 'W', 0);
        break;
      }
      case 'molino': {
        tiles = tile('Golpes', fmt(n.golpes), '/min', n.golpes > 0 ? { lvl: 'green', txt: 'Funcionando' } : { lvl: 'yellow', txt: 'Quieto' })
          + tile('Caudal', fmt(n.caudal, 1), 'L/min', { lvl: 'green', txt: 'Ok' })
          + tile('Hoy', fmt(n.volHoy, 1), 'm³', { lvl: 'gray', txt: fmt(n.horasHoy, 1) + ' h activo' });
        filas = bat + senal(n) + fila('Intervalo', '15 min');
        extra = '<div class="bloque-t">Tendencia · golpes por minuto</div>' + grafico(n.historia, 'golpes/min', 0);
        break;
      }
    }
    const aviso = st.lvl === 'gray'
      ? '<p class="d-estado alerta" style="margin:0 0 12px">Este equipo no reporta desde hace ' + edad(n) + ' min. Los valores son los del último reporte.</p>' : '';
    return '<div class="ficha__cab"><div><h2 class="ficha__titulo">' + esc(n.nombre) + '</h2>'
      + '<p class="ficha__sub">' + MODELOS[n.modelo] + ' · ' + n.lote + ' · ' + hace(n) + '</p></div>'
      + '<button type="button" class="ficha__cerrar" data-cerrar aria-label="Cerrar"><i data-lucide="x"></i></button></div>'
      + aviso + '<div class="tiles">' + tiles + '</div><ul class="filas">' + filas + '</ul>' + extra;
  }

  function htmlLista() {
    const items = nodos.map((n) => {
      const st = estadoNodo(n);
      const lvl = st.lvl === 'blue' ? 'green' : st.lvl;
      return '<li><button type="button" data-nodo="' + n.id + '"><span class="lista__punto" style="background:' + COLORES[lvl] + '"></span>'
        + '<span><span class="lista__nom">' + esc(n.nombre) + '</span><span class="lista__mod">' + MODELOS[n.modelo] + ' · ' + hace(n).replace('Reportó ', '') + '</span></span>'
        + '<span class="chip chip-' + lvl + '">' + st.txt + '</span></button></li>';
    }).join('');
    return '<div class="ficha__cab"><div><h2 class="ficha__titulo">Nodos</h2><p class="ficha__sub">Estancia La Demo · 5 nodos · 1 gateway</p></div>'
      + '<button type="button" class="ficha__cerrar" data-cerrar aria-label="Cerrar"><i data-lucide="x"></i></button></div>'
      + '<ul class="lista">' + items + '</ul>';
  }

  function renderSheet() {
    if (fichaAbierta == null) return;
    const body = $('#sheet-body');
    const scroll = $('#sheet').scrollTop;
    body.innerHTML = fichaAbierta === 'lista' ? htmlLista() : htmlFicha(nodos.find((n) => n.id === fichaAbierta));
    lucide.createIcons();
    $('#sheet').scrollTop = scroll;
  }
  function abrirFicha(id) {
    fichaAbierta = id;
    $('#sheet').hidden = false; $('#scrim').hidden = false;
    $('#sheet').scrollTop = 0;
    renderSheet();
    if (id !== 'lista') {
      const n = nodos.find((x) => x.id === id);
      mapa.panTo(n.pos);
    }
  }
  function cerrarFicha() {
    fichaAbierta = null;
    $('#sheet').hidden = true; $('#scrim').hidden = true;
  }

  /* ─── Escenarios ─── */
  const TEXTOS = {
    tanque: { espera: 'El tanque australiano está perdiendo agua… mirá su pin: la bomba del casco arranca, pero no alcanza.', alerta: 'Llegó el aviso. Tocalo para abrir la ficha del tanque.', resolver: 'Reparar la pérdida' },
    solar: { espera: 'Hay pleno sol, pero la bomba solar empieza a rendir menos…', alerta: 'Llegó el aviso: con buen sol la bomba rinde menos de la mitad de lo normal.', resolver: 'Arreglar la bomba' },
    bebedero: { espera: 'El bebedero se está vaciando… mirá el pin del Bebedero Lote 4.', alerta: 'Llegó el aviso. Tocalo para abrir la ficha del bebedero.', resolver: 'Reponer el agua' },
    bomba: { espera: 'La bomba arranca pero no pasa agua…', alerta: 'Llegó el aviso: la bomba consume corriente y el caudal es cero.', resolver: 'Destrabar la bomba' },
    calor: { espera: 'Sube la temperatura en el Lote 4…', alerta: 'Llegó el aviso de estrés por calor del rodeo.', resolver: 'Que baje el calor' },
    sinreporte: { espera: 'El molino dejó de reportar. Esperá: el sistema avisa cuando pasan 30 minutos sin datos.', alerta: 'Llegó el aviso: un equipo sin reportar también es una alerta.', resolver: 'Que vuelva a reportar' },
  };
  function iniciarEscenario(id) {
    escenario = { id, resolviendo: false, avisado: false };
    if (id === 'sinreporte') nodos[4].callado = true;
    if (id === 'bomba') nodos[2].ultimo = simMin - INTERVALO;   // que reporte ya
    actualizarBotones();
    estado(TEXTOS[id].espera, 'espera');
    if (window.matchMedia('(max-width: 900px)').matches) $('#app').scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
  function resolverEscenario() {
    if (!escenario) return;
    escenario.resolviendo = true;
    if (escenario.id === 'sinreporte') { nodos[4].callado = false; reportar(nodos[4]); }
    estado('Resolviendo… esperá el aviso de "Resuelto".', 'espera');
    actualizarBotones();
  }
  function escenarioAvisado() {
    if (escenario && !escenario.avisado) { escenario.avisado = true; estado(TEXTOS[escenario.id].alerta, 'alerta'); actualizarBotones(); }
  }
  function escenarioResuelto() {
    if (escenario && escenario.resolviendo) {
      escenario = null;
      estado('Listo: el sistema avisó que se resolvió. Probá otra situación.', '');
      actualizarBotones();
    }
  }
  function estado(txt, clase) { const e = $('#estado'); e.textContent = txt; e.className = 'd-estado' + (clase ? ' ' + clase : ''); }
  function actualizarBotones() {
    document.querySelectorAll('.d-esc').forEach((b) => {
      const id = b.dataset.esc;
      const esEste = escenario && escenario.id === id;
      b.classList.toggle('activo', !!esEste && !escenario.avisado);
      b.classList.toggle('resolver', !!esEste && escenario.avisado && !escenario.resolviendo);
      b.disabled = !!escenario && (!esEste || !escenario.avisado || escenario.resolviendo);
      const small = b.querySelector('small');
      if (!small.dataset.orig) small.dataset.orig = small.textContent;
      small.textContent = esEste && escenario.avisado && !escenario.resolviendo ? '→ ' + TEXTOS[id].resolver : small.dataset.orig;
    });
  }

  /* ─── Bucle ─── */
  function tick() {
    simMin += MIN_POR_SEG;
    nodos.forEach((n) => {
      if ((simMin + n.offset) % INTERVALO < MIN_POR_SEG || simMin - n.ultimo >= INTERVALO) reportar(n);
    });
    revisarAvisos();
    pintarPines();
    renderSheet();
  }

  /* ─── Arranque ─── */
  document.addEventListener('DOMContentLoaded', () => {
    estadoInicial();
    iniciarMapa();
    pintarPines();
    lucide.createIcons();

    $('#btn-lista').addEventListener('click', () => abrirFicha('lista'));
    $('#btn-centrar').addEventListener('click', () => { cerrarFicha(); encuadrar(); });
    $('#btn-refresh').addEventListener('click', (e) => {
      const b = e.currentTarget; b.classList.remove('girando'); void b.offsetWidth; b.classList.add('girando');
    });
    $('#scrim').addEventListener('click', cerrarFicha);
    $('#sheet').addEventListener('click', (e) => {
      if (e.target.closest('[data-cerrar]')) cerrarFicha();
      const item = e.target.closest('[data-nodo]');
      if (item) abrirFicha(Number(item.dataset.nodo));
    });
    $('#escenarios').addEventListener('click', (e) => {
      const b = e.target.closest('.d-esc'); if (!b || b.disabled) return;
      if (escenario && escenario.id === b.dataset.esc) resolverEscenario();
      else if (!escenario) iniciarEscenario(b.dataset.esc);
    });
    $('#reset').addEventListener('click', () => {
      estadoInicial(); cerrarFicha(); $('#notifs').innerHTML = '';
      Object.keys(colorPin).forEach((k) => delete colorPin[k]);
      pintarPines(); actualizarBotones(); estado('Todo funcionando normalmente.', '');
    });
    window.addEventListener('resize', () => mapa.invalidateSize());
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') cerrarFicha(); });

    setInterval(tick, 1000);
  });
})();
