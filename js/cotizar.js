/* ═══════════════════════════════════════════
   COTIZAR — mapa satelital + enlaces aguada→gateway + formulario de presupuesto
   ═══════════════════════════════════════════ */

const QUOTE_ENDPOINT = 'https://fotmwptcuqvemfgrygjr.supabase.co/functions/v1/quote_request';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZvdG13cHRjdXF2ZW1mZ3J5Z2pyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk0OTA4ODEsImV4cCI6MjA5NTA2Njg4MX0.Mbb7jVL4ydGj0cGvEn-9I_UJSmC6I7FNfvcgIkvyTXA';
const WHATSAPP_NUMBER = '5491168452098';

/* Supuestos del enlace (se muestran en la página y viajan con la consulta) */
const ALTURA_NODO_M = 2;        // antena del nodo sobre el suelo
const ALTURA_GATEWAY_M = 6;     // antena del gateway en un mástil
const FRECUENCIA_GHZ = 0.915;   // LoRa, banda de 915 MHz
const K_TIERRA = 4 / 3;         // radio terrestre efectivo (refracción normal)
const R_TIERRA_M = 6371000;
const MUESTRAS = 41;            // puntos del perfil por enlace (el DEM es de ~90 m)
const DISTANCIA_LARGA_M = 8000; // a partir de acá se sugiere evaluar un repetidor

const fmt = (n, dec = 0) => new Intl.NumberFormat('es-AR', { maximumFractionDigits: dec, minimumFractionDigits: dec }).format(n);
const fmtDist = (m) => (m < 1000 ? `${fmt(m)} m` : `${fmt(m / 1000, m < 10000 ? 2 : 1)} km`);

function distanciaM(a, b) {      // haversine
  const r = Math.PI / 180, dLat = (b.lat - a.lat) * r, dLng = (b.lng - a.lng) * r;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLng / 2) ** 2;
  return 2 * R_TIERRA_M * Math.asin(Math.sqrt(h));
}

/* Perfil del terreno: elevaciones de Open-Meteo (Copernicus DEM 90 m), con caché por enlace */
const cacheElev = new Map();
const claveEnlace = (a, b) => [a.lat, a.lng, b.lat, b.lng].map((v) => v.toFixed(5)).join(',');

async function cargarPerfiles(enlaces) {
  const faltan = enlaces.filter((e) => !cacheElev.has(e.clave));
  if (!faltan.length) return;
  const pedidos = [];            // { clave, i } por coordenada
  const lats = [], lngs = [];
  faltan.forEach((e) => {
    for (let i = 0; i < MUESTRAS; i++) {
      const t = i / (MUESTRAS - 1);
      lats.push((e.a.lat + (e.b.lat - e.a.lat) * t).toFixed(5));
      lngs.push((e.a.lng + (e.b.lng - e.a.lng) * t).toFixed(5));
      pedidos.push(e.clave);
    }
  });
  const resultado = new Map(faltan.map((e) => [e.clave, []]));
  for (let k = 0; k < lats.length; k += 100) {
    const url = `https://api.open-meteo.com/v1/elevation?latitude=${lats.slice(k, k + 100).join(',')}&longitude=${lngs.slice(k, k + 100).join(',')}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('elevacion');
    const { elevation } = await res.json();
    elevation.forEach((z, j) => resultado.get(pedidos[k + j]).push(z));
  }
  resultado.forEach((perfil, clave) => cacheElev.set(clave, perfil));
}

/* Línea de vista: antena a antena, con curvatura terrestre y 1ª zona de Fresnel */
function analizarEnlace(e) {
  const perfil = cacheElev.get(e.clave);
  e.perfil = perfil || null;
  if (!perfil) return e;
  const D = e.distancia;
  const hA = perfil[0] + ALTURA_NODO_M, hB = perfil[perfil.length - 1] + ALTURA_GATEWAY_M;
  let despejeMin = Infinity, fresnelMin = Infinity;
  const suelo = [];              // terreno + abultamiento de la Tierra, para el gráfico
  perfil.forEach((z, i) => {
    const d1 = D * i / (perfil.length - 1), d2 = D - d1;
    const bulto = (d1 * d2) / (2 * K_TIERRA * R_TIERRA_M);
    const terreno = z + bulto;
    suelo.push(terreno);
    if (i === 0 || i === perfil.length - 1) return;
    const vista = hA + (hB - hA) * d1 / D;
    const despeje = vista - terreno;
    const f1 = 17.32 * Math.sqrt((d1 / 1000) * (d2 / 1000) / (FRECUENCIA_GHZ * D / 1000));
    despejeMin = Math.min(despejeMin, despeje);
    fresnelMin = Math.min(fresnelMin, despeje / f1);
  });
  e.suelo = suelo;
  e.elevA = perfil[0];
  e.elevB = perfil[perfil.length - 1];
  e.desnivel = e.elevB - e.elevA;
  e.despejeMin = Number.isFinite(despejeMin) ? despejeMin : 0;
  e.fresnelPct = Number.isFinite(fresnelMin) ? fresnelMin * 100 : 100;
  e.estado = e.despejeMin < 0 ? 'obstruido' : e.fresnelPct < 60 ? 'parcial' : 'despejado';
  return e;
}

const ESTADOS = {
  despejado: { txt: 'Línea de vista despejada', color: '#4ade80' },
  parcial: { txt: 'Despeje justo (Fresnel < 60 %)', color: '#fbbf24' },
  obstruido: { txt: 'El terreno corta la línea', color: '#f87171' },
  pendiente: { txt: 'Calculando perfil…', color: '#ffffff' },
  sindatos: { txt: 'Sin datos de elevación', color: '#ffffff' },
};

function graficoPerfil(e) {
  const W = 300, H = 92, padY = 10;
  const ys = e.suelo.concat([e.elevA + ALTURA_NODO_M, e.elevB + ALTURA_GATEWAY_M]);
  let zMin = Math.min(...ys), zMax = Math.max(...ys);
  if (zMax - zMin < 10) { const m = (zMax + zMin) / 2; zMin = m - 5; zMax = m + 5; }
  const pad = (zMax - zMin) * 0.15; zMin -= pad; zMax += pad;
  const X = (i) => (i / (e.suelo.length - 1)) * W;
  const Y = (z) => padY + (1 - (z - zMin) / (zMax - zMin)) * (H - 2 * padY);
  const terreno = e.suelo.map((z, i) => `${X(i).toFixed(1)},${Y(z).toFixed(1)}`).join(' ');
  const yA = Y(e.elevA + ALTURA_NODO_M), yB = Y(e.elevB + ALTURA_GATEWAY_M);
  const col = ESTADOS[e.estado].color;
  return `<svg class="perfil" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img"
      aria-label="Perfil de elevación entre la aguada y el gateway">
    <polygon points="0,${H} ${terreno} ${W},${H}" fill="#cbb994" opacity=".55"/>
    <polyline points="${terreno}" fill="none" stroke="#8a7655" stroke-width="1.5" vector-effect="non-scaling-stroke"/>
    <line x1="0" y1="${yA}" x2="${W}" y2="${yB}" stroke="${col === '#ffffff' ? '#2c5aa0' : col}" stroke-width="2" stroke-dasharray="6 5" vector-effect="non-scaling-stroke"/>
    <line x1="0" y1="${Y(e.elevA)}" x2="0" y2="${yA}" stroke="#2c5aa0" stroke-width="4"/>
    <line x1="${W}" y1="${Y(e.elevB)}" x2="${W}" y2="${yB}" stroke="#217821" stroke-width="4"/>
  </svg>
  <div class="perfil__ejes"><span>💧 ${fmt(e.elevA)} msnm</span><span>${fmtDist(e.distancia)}</span><span>📶 ${fmt(e.elevB)} msnm</span></div>`;
}

document.addEventListener('DOMContentLoaded', () => {

  /* ─── Mapa base (satelital Esri, sin API key) ─── */
  const map = L.map('map', { zoomControl: true, doubleClickZoom: false, maxZoom: 18 }).setView([-34.6, -64.0], 5);
  L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    attribution: 'Tiles &copy; Esri &middot; Elevación: Open-Meteo / Copernicus', maxZoom: 18, maxNativeZoom: 17,   // en el campo no hay foto más allá de z17 ("Map data not yet available")
  }).addTo(map);
  // rutas y caminos, para ubicar el campo
L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}', {
  maxZoom: 18, opacity: 0.85,
}).addTo(map);
L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}', {
    maxZoom: 18, opacity: 0.9,
  }).addTo(map);
  const capaEnlaces = L.layerGroup().addTo(map);

  /* ─── Estado de pines ─── */
  let mode = null; // 'aguada' | 'internet' | null
  const points = { aguada: [], internet: [] };
  let enlaces = [];

  function makeIcon(type, n) {
    const emoji = type === 'aguada' ? '💧' : '📶';
    return L.divIcon({
      className: '',
      html: `<div class="pin pin--${type}"><div class="pin__dot"><span>${emoji}</span></div><b class="pin__n">${n}</b></div>`,
      iconSize: [30, 42], iconAnchor: [15, 38],
    });
  }

  function addPoint(type, latlng) {
    const marker = L.marker(latlng, { icon: makeIcon(type, points[type].length + 1), draggable: true }).addTo(map);
    const entry = { marker, lat: latlng.lat, lng: latlng.lng };
    marker.on('drag', () => { const p = marker.getLatLng(); entry.lat = p.lat; entry.lng = p.lng; dibujarLineas(); });
    marker.on('dragend', () => actualizar());
    marker.on('dblclick', () => removePoint(type, entry));
    points[type].push(entry);
    actualizar();
  }

  function removePoint(type, entry) {
    map.removeLayer(entry.marker);
    points[type] = points[type].filter((e) => e !== entry);
    points[type].forEach((e, i) => e.marker.setIcon(makeIcon(type, i + 1)));   // renumerar
    actualizar();
  }

  /* Cada aguada se une al punto con señal más cercano: ahí iría el gateway */
  function armarEnlaces() {
    if (!points.internet.length) return [];
    return points.aguada.map((a, i) => {
      let mejor = 0, dMin = Infinity;
      points.internet.forEach((g, j) => { const dd = distanciaM(a, g); if (dd < dMin) { dMin = dd; mejor = j; } });
      const g = points.internet[mejor];
      const e = { aguada: i + 1, senal: mejor + 1, a: { lat: a.lat, lng: a.lng }, b: { lat: g.lat, lng: g.lng }, distancia: dMin };
      e.clave = claveEnlace(e.a, e.b);
      return e;
    });
  }

  function dibujarLineas() {
    capaEnlaces.clearLayers();
    armarEnlaces().forEach((e) => {
      const previo = enlaces.find((x) => x.clave === e.clave);
      const col = ESTADOS[previo?.estado || 'pendiente'].color;
      const tramo = [[e.a.lat, e.a.lng], [e.b.lat, e.b.lng]];
      L.polyline(tramo, { color: '#0b1220', weight: 5, opacity: 0.45, interactive: false }).addTo(capaEnlaces);
      L.polyline(tramo, { color: col, weight: 2.5, dashArray: '8 8', interactive: false }).addTo(capaEnlaces)
        .bindTooltip(fmtDist(e.distancia), { permanent: true, direction: 'center', className: 'enlace-etiqueta' });
    });
  }

  let pedidoActual = 0;
  async function actualizar() {
    enlaces = armarEnlaces().map((e) => analizarEnlace(e));
    dibujarLineas();
    renderPanel();
    const yo = ++pedidoActual;
    if (enlaces.some((e) => !e.perfil)) {
      try {
        await cargarPerfiles(enlaces);
      } catch {
        if (yo !== pedidoActual) return;
        enlaces.forEach((e) => { if (!e.perfil) e.estado = 'sindatos'; });
        renderPanel(); dibujarLineas(); return;
      }
      if (yo !== pedidoActual) return;   // el usuario movió algo mientras tanto
      enlaces = enlaces.map((e) => analizarEnlace(e));
      dibujarLineas();
      renderPanel();
    }
  }

  /* ─── Panel "Tu instalación": puntos + métricas de cada enlace ─── */
  function renderPanel() {
    const el = document.getElementById('instalacion');
    const nA = points.aguada.length, nI = points.internet.length;
    document.getElementById('inst-cuentas').innerHTML =
      `<span><b>${nA}</b> aguada${nA === 1 ? '' : 's'}</span><span><b>${nI}</b> punto${nI === 1 ? '' : 's'} con señal</span>`;

    if (!nA && !nI) {
      el.innerHTML = '<div class="points-empty">Todavía no marcaste ningún punto en el mapa. Marcá tus aguadas y dónde tenés señal de internet para el Gateway.</div>';
      return;
    }
    let html = '';
    if (!nI) html += '<div class="inst-aviso"><i data-lucide="wifi-off"></i>Marcá también un punto con señal (WiFi o datos) para calcular la distancia de cada aguada al Gateway.</div>';
    if (!nA) html += '<div class="inst-aviso"><i data-lucide="droplet"></i>Marcá las aguadas que querés monitorear.</div>';

    if (enlaces.length) {
      html += '<div class="enlaces">';
      enlaces.forEach((e) => {
        const est = ESTADOS[e.estado || 'pendiente'];
        const conPerfil = e.perfil && e.suelo;
        html += `<article class="enlace enlace--${e.estado || 'pendiente'}">
          <header class="enlace__cab">
            <span class="enlace__titulo">💧 Aguada ${e.aguada} <i data-lucide="move-right"></i> 📶 Gateway ${e.senal}</span>
            <span class="enlace__dist">${fmtDist(e.distancia)}</span>
          </header>
          ${conPerfil ? graficoPerfil(e) : `<div class="perfil perfil--vacio">${est.txt}</div>`}
          ${conPerfil ? `<dl class="enlace__datos">
            <div><dt>Desnivel</dt><dd>${e.desnivel >= 0 ? '+' : ''}${fmt(e.desnivel)} m</dd></div>
            <div><dt>Despeje mínimo</dt><dd>${fmt(e.despejeMin, 1)} m</dd></div>
            <div><dt>Zona de Fresnel libre</dt><dd>${fmt(Math.max(0, Math.min(100, e.fresnelPct)))} %</dd></div>
          </dl>
          <p class="enlace__estado"><span style="background:${est.color}"></span>${est.txt}${e.distancia > DISTANCIA_LARGA_M ? ' · distancia larga: puede requerir repetidor' : ''}</p>` : ''}
        </article>`;
      });
      html += '</div>';
      html += `<p class="inst-nota"><i data-lucide="info"></i>Perfil según el modelo de superficie Copernicus (celdas de 90 m), con curvatura terrestre.
        Supone antena del nodo a ${ALTURA_NODO_M} m y del Gateway a ${ALTURA_GATEWAY_M} m. Es una estimación: montes y
        construcciones aparecen sólo en parte, así que el enlace real lo confirmamos en la visita.</p>`;
    }

    // listado de puntos para quitarlos
    html += '<div class="inst-puntos">';
    [['aguada', '💧 Aguadas'], ['internet', '📶 Puntos con señal']].forEach(([k, label]) => {
      if (!points[k].length) return;
      html += `<div class="points-group__label">${label}</div>`;
      points[k].forEach((p, i) => {
        html += `<div class="point-row"><span>#${i + 1} — ${p.lat.toFixed(5)}, ${p.lng.toFixed(5)}</span>
          <button type="button" data-type="${k}" data-idx="${i}" aria-label="Quitar"><i data-lucide="x"></i></button></div>`;
      });
    });
    html += '</div>';
    el.innerHTML = html;
    if (window.lucide) lucide.createIcons();
    el.querySelectorAll('button[data-type]').forEach((btn) => {
      btn.addEventListener('click', () => removePoint(btn.dataset.type, points[btn.dataset.type][Number(btn.dataset.idx)]));
    });
  }
  renderPanel();

  map.on('click', (e) => { if (mode) addPoint(mode, e.latlng); });

  /* ─── Botones de modo ─── */
  const btnAguada = document.getElementById('mode-aguada');
  const btnInternet = document.getElementById('mode-internet');
  function setMode(next) {
    mode = mode === next ? null : next;
    btnAguada.classList.toggle('active--aguada', mode === 'aguada');
    btnInternet.classList.toggle('active--internet', mode === 'internet');
    map.getContainer().style.cursor = mode ? 'crosshair' : '';
  }
  btnAguada.addEventListener('click', () => setMode('aguada'));
  btnInternet.addEventListener('click', () => setMode('internet'));

  /* ─── Mi ubicación ─── */
  document.getElementById('btn-locate').addEventListener('click', () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => map.flyTo([pos.coords.latitude, pos.coords.longitude], 14),
      () => { /* silencioso: el usuario puede buscar o navegar manualmente */ },
    );
  });

  /* ─── Buscador de lugares (Nominatim/OSM) ─── */
  const searchInput = document.getElementById('map-search-input');
  const searchResults = document.getElementById('map-search-results');
  let searchTimer = null, vuelta = 0;

  async function runSearch(q) {
    clearTimeout(searchTimer);
    const yo = ++vuelta;   // una respuesta vieja no reabre la lista
    if (!q || q.length < 3) { searchResults.classList.remove('open'); return; }
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&limit=5&countrycodes=ar&q=${encodeURIComponent(q)}`;
      const res = await fetch(url, { headers: { 'Accept-Language': 'es' } });
      const data = await res.json();
      if (yo !== vuelta) return;
      if (!data.length) { searchResults.innerHTML = '<div>Sin resultados</div>'; searchResults.classList.add('open'); return; }
      searchResults.innerHTML = '';
      data.forEach((r) => {
        const div = document.createElement('div'); div.textContent = r.display_name;
        div.addEventListener('click', () => { vuelta++; clearTimeout(searchTimer); map.flyTo([Number(r.lat), Number(r.lon)], 14); searchResults.classList.remove('open'); });
        searchResults.appendChild(div);
      });
      searchResults.classList.add('open');
    } catch { /* sin conexión al geocoder: el usuario puede navegar el mapa a mano */ }
  }
  searchInput.addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => runSearch(searchInput.value.trim()), 450);
  });
  document.getElementById('map-search-btn').addEventListener('click', () => runSearch(searchInput.value.trim()));
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.map-search')) searchResults.classList.remove('open');
  });

  /* ─── Métricas que viajan con la consulta ─── */
  function enlacesParaEnviar() {
    return enlaces.map((e) => ({
      aguada: e.aguada,
      gateway: e.senal,
      distancia_m: Math.round(e.distancia),
      elev_aguada_m: e.perfil ? Math.round(e.elevA) : null,
      elev_gateway_m: e.perfil ? Math.round(e.elevB) : null,
      desnivel_m: e.perfil ? Math.round(e.desnivel) : null,
      despeje_min_m: e.perfil ? Math.round(e.despejeMin * 10) / 10 : null,
      fresnel_libre_pct: e.perfil ? Math.round(Math.max(0, Math.min(100, e.fresnelPct))) : null,
      estado: e.estado || 'sindatos',
      perfil_m: e.perfil ? e.perfil.map((z) => Math.round(z)) : null,
    }));
  }
  const lineaEnlace = (x) => `Aguada ${x.aguada} → Gateway ${x.gateway}: ${fmtDist(x.distancia_m)}` +
    (x.desnivel_m !== null ? `, desnivel ${x.desnivel_m >= 0 ? '+' : ''}${x.desnivel_m} m, despeje mín. ${fmt(x.despeje_min_m, 1)} m, Fresnel libre ${x.fresnel_libre_pct} % (${ESTADOS[x.estado].txt})` : '');

  /* ─── Envío del formulario ─── */
  const form = document.getElementById('quote-form');
  const msgEl = document.getElementById('form-msg');
  const submitBtn = document.getElementById('submit-btn');

  function waLink(name, phone, email, comment, links) {
    const lines = [
      `Hola, quiero pedir un presupuesto para AguaSens.`,
      `Nombre: ${name}`,
      phone ? `Teléfono: ${phone}` : null,
      email ? `Email: ${email}` : null,
      comment ? `Comentario: ${comment}` : null,
      '',
      `Aguadas a monitorear: ${points.aguada.length}`,
      ...points.aguada.map((p, i) => `  ${i + 1}. https://www.google.com/maps?q=${p.lat.toFixed(6)},${p.lng.toFixed(6)}`),
      `Puntos con señal: ${points.internet.length}`,
      ...points.internet.map((p, i) => `  ${i + 1}. https://www.google.com/maps?q=${p.lat.toFixed(6)},${p.lng.toFixed(6)}`),
      links.length ? '' : null,
      ...links.map((x) => `  ${lineaEnlace(x)}`),
    ].filter((l) => l !== null).join('\n');
    return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(lines)}`;
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    msgEl.textContent = '';
    msgEl.className = 'form-msg';

    const name = document.getElementById('f-name').value.trim();
    const phone = document.getElementById('f-phone').value.trim();
    const email = document.getElementById('f-email').value.trim();
    const comment = document.getElementById('f-comment').value.trim();
    const honeypot = document.getElementById('f-website').value;

    if (!name) {
      msgEl.textContent = 'Falta tu nombre.'; msgEl.classList.add('form-msg--error'); return;
    }
    if (!phone && !email) {
      msgEl.textContent = 'Dejanos un teléfono o un email para contactarte.'; msgEl.classList.add('form-msg--error'); return;
    }
    if (points.aguada.length === 0) {
      msgEl.textContent = 'Marcá en el mapa al menos una aguada a monitorear.'; msgEl.classList.add('form-msg--error'); return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = 'Enviando…';

    // si el perfil todavía se está calculando, se espera un momento para mandarlo completo
    try { await cargarPerfiles(enlaces); enlaces = enlaces.map((x) => analizarEnlace(x)); } catch { /* va sin perfil */ }
    const links = enlacesParaEnviar();

    const payload = {
      name, phone, email, comment, website: honeypot,
      aguadaPoints: points.aguada.map((p) => ({ lat: p.lat, lng: p.lng })),
      internetPoints: points.internet.map((p) => ({ lat: p.lat, lng: p.lng })),
      links,
      linkAssumptions: { nodeAntennaM: ALTURA_NODO_M, gatewayAntennaM: ALTURA_GATEWAY_M, freqGHz: FRECUENCIA_GHZ, dem: 'Copernicus 90 m (Open-Meteo)' },
    };

    try {
      const res = await fetch(QUOTE_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('bad status');

      document.getElementById('form-panel-body').innerHTML = `
        <div class="success-box">
          <i data-lucide="check-circle-2"></i>
          <h3>¡Listo, recibimos tu consulta!</h3>
          <p>Te vamos a contactar a la brevedad. Si querés, mandanos también un WhatsApp directo con los mismos datos.</p>
          <a class="btn btn--primary" target="_blank" href="${waLink(name, phone, email, comment, links)}">
            <i data-lucide="message-circle" style="width:18px;height:18px;"></i> Enviar también por WhatsApp
          </a>
        </div>`;
      if (window.lucide) lucide.createIcons();
    } catch {
      msgEl.textContent = 'No pudimos enviar la consulta. Probá de nuevo o escribinos directo por WhatsApp/email.';
      msgEl.classList.add('form-msg--error');
      submitBtn.disabled = false;
      submitBtn.textContent = 'Enviar consulta';
    }
  });

});
