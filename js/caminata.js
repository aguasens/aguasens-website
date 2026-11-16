// Datos fijos
const categorias = {
  'ternero':         { nombre: 'Ternero (150 kg)',                  pesoProm: 150, gdpObjetivo: 0.7, consumoAguaBase: 18 },
  'vaquillona':      { nombre: 'Vaquillona (250 kg)',               pesoProm: 250, gdpObjetivo: 0.7, consumoAguaBase: 30 },
  'novillo_engorde': { nombre: 'Novillo engorde (350 kg)',          pesoProm: 350, gdpObjetivo: 0.9, consumoAguaBase: 45 },
  'novillo_recria':  { nombre: 'Novillo recría (200 kg)',           pesoProm: 200, gdpObjetivo: 0.6, consumoAguaBase: 25 },
  'vaca_seca':       { nombre: 'Vaca seca (450 kg)',                pesoProm: 450, gdpObjetivo: 0.0, consumoAguaBase: 50 },
  'vaca_cria':       { nombre: 'Vaca cría lactante (450 kg)',       pesoProm: 450, gdpObjetivo: 0.0, consumoAguaBase: 70 },
  'vaca_lechera':    { nombre: 'Vaca lechera (600 kg)',             pesoProm: 600, gdpObjetivo: 0.0, consumoAguaBase: 110 }
};

const situacionesClima = {
  'invierno':       { nombre: 'Invierno fresco (< 15 °C)',          factorVisitasBase: 0.6, factorConsumoAgua: 0.7 },
  'templado':       { nombre: 'Templado (15–25 °C)',                factorVisitasBase: 1.0, factorConsumoAgua: 1.0 },
  'verano_calido':  { nombre: 'Verano cálido (25–32 °C)',           factorVisitasBase: 1.4, factorConsumoAgua: 1.5 },
  'verano_extremo': { nombre: 'Verano extremo (> 32 °C)',           factorVisitasBase: 1.8, factorConsumoAgua: 2.0 }
};

const factoresCamino = {
  'firme':  { nombre: 'Firme/seco',         factor: 1.0 },
  'normal': { nombre: 'Normal',             factor: 1.15 },
  'barroso':{ nombre: 'Barroso/anegado',    factor: 1.5 },
  'arenoso':{ nombre: 'Arenoso/profundo',   factor: 1.35 }
};

const visitasSegunDistancia = (distancia_m, factorClima) => {
  const visitas = (1 + 4 * Math.exp(-distancia_m / 600)) * factorClima;
  return Math.max(0.8, visitas);
};

// Puntos de referencia (Ohio State / Pinheiro Machado): 250 m → 5 %, 500 m → ~18 %, 1000 m → ~35 %.
// Se interpola entre ellos: antes era una escalera y 249 m vs 251 m saltaba de 5 % a 10 %.
const REDUCCION_AGUA = [[100, 0], [250, 5], [500, 18], [800, 27], [1000, 35], [1500, 45]];
const reduccionConsumoAguaPct = (distancia_m) => {
  const T = REDUCCION_AGUA;
  if (distancia_m <= T[0][0]) return 0;
  for (let i = 1; i < T.length; i++) {
    if (distancia_m <= T[i][0]) {
      const [d0, r0] = T[i - 1], [d1, r1] = T[i];
      return r0 + (r1 - r0) * (distancia_m - d0) / (d1 - d0);
    }
  }
  return T[T.length - 1][1];
};

// Estado: el lote es un polígono [lat,lng] dibujado sobre el satélite; los bebederos, puntos [lat,lng].
// Arranca vacío: el usuario dibuja su lote.
let lote = [];
let bebederos = [];
let modo = 'lote';          // 'bebedero' | 'lote'
let borrador = [];              // vértices mientras se dibuja

// DOM Helpers
const d = (id) => document.getElementById(id);
const v = (id) => parseFloat(d(id).value) || 0;
const fmt = (n, dec=0) => new Intl.NumberFormat('es-AR', { maximumFractionDigits: dec, minimumFractionDigits: dec }).format(n);
const fmtMoneyShort = (n) => {
  if (Math.abs(n) >= 1000000) return '$' + fmt(n/1000000, 1) + 'M';
  if (Math.abs(n) >= 1000) return '$' + fmt(n/1, 0);
  return '$' + fmt(n, 0);
};

/* ─── Geometría: plano local en metros alrededor del lote ─── */
function plano(ref) {
  const kx = 111320 * Math.cos(ref[0] * Math.PI / 180), ky = 110540;
  return {
    a: (p) => [(p[1] - ref[1]) * kx, (p[0] - ref[0]) * ky],
    ll: (x, y) => [ref[0] + y / ky, ref[1] + x / kx],
  };
}
function dentro(x, y, poli) {
  let r = false;
  for (let i = 0, j = poli.length - 1; i < poli.length; j = i++) {
    const [xi, yi] = poli[i], [xj, yj] = poli[j];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) r = !r;
  }
  return r;
}
function areaM2(poli) {
  let s = 0;
  for (let i = 0, j = poli.length - 1; i < poli.length; j = i++) s += poli[j][0] * poli[i][1] - poli[i][0] * poli[j][1];
  return Math.abs(s) / 2;
}
// Celdas dentro del lote (centro de cada una) con su distancia al bebedero más cercano
function celdasDelLote() {
  const P = plano(lote[0]), poli = lote.map(P.a);
  const xs = poli.map(p => p[0]), ys = poli.map(p => p[1]);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  const area = areaM2(poli);
  const lado = Math.max(4, Math.sqrt(area / 1100));
  const beb = bebederos.map(P.a), celdas = [];
  for (let x = x0 + lado / 2; x < x1; x += lado)
    for (let y = y0 + lado / 2; y < y1; y += lado) {
      if (!dentro(x, y, poli)) continue;
      let min = Infinity;
      for (const b of beb) { const dd = Math.hypot(x - b[0], y - b[1]); if (dd < min) min = dd; }
      celdas.push({ x, y, d: min });
    }
  return { P, poli, area, lado, celdas };
}

/* ─── Mapa satelital ─── */
const mapa = L.map('lote_map', { doubleClickZoom: false, zoomSnap: 0.25, maxZoom: 18 });
L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
  attribution: 'Tiles &copy; Esri', maxZoom: 18, maxNativeZoom: 17,   // en el campo no hay foto más allá de z17 ("Map data not yet available")
}).addTo(mapa);
// rutas y caminos, para ubicar el campo
L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}', {
  maxZoom: 18, opacity: 0.85,
}).addTo(mapa);
L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}', {
  maxZoom: 18, opacity: 0.9,
}).addTo(mapa);
const lienzo = L.canvas({ padding: 0.3 });
const capaCalor = L.layerGroup().addTo(mapa);
const capaLote = L.layerGroup().addTo(mapa);
const capaBeb = L.layerGroup().addTo(mapa);
mapa.setView([-35.6, -61.0], 6);   // región pampeana; el usuario busca su campo

const iconoVertice = (primero) => L.divIcon({ className: '', html: `<div class="lote-vertice${primero ? ' lote-vertice--primero' : ''}"></div>`, iconSize: [16, 16], iconAnchor: [8, 8] });
const iconoBeb = L.divIcon({ className: '', html: '<div class="lote-beb"><span></span></div>', iconSize: [30, 30], iconAnchor: [15, 15] });

// Escala fija: verde hasta 100 m, amarillo en 250 m (la distancia máxima recomendada), rojo desde 500 m.
const ESCALA = [[0, [25, 199, 163]], [100, [25, 199, 163]], [250, [255, 196, 71]], [500, [255, 80, 80]]];
function heatColor(dist) {
  let c = ESCALA[ESCALA.length - 1][1];
  for (let i = 1; i < ESCALA.length; i++) {
    if (dist <= ESCALA[i][0]) {
      const [d0, c0] = ESCALA[i - 1], [d1, c1] = ESCALA[i], t = (dist - d0) / (d1 - d0);
      c = c0.map((v, k) => Math.round(v + (c1[k] - v) * t));
      break;
    }
  }
  return [`rgb(${c.join(',')})`, 0.5];
}

let poligonoLote = null;
function dibujarLote() {
  capaLote.clearLayers(); poligonoLote = null;
  if (modo === 'lote') {
    if (borrador.length > 1) L.polyline(borrador, { color: '#fff', weight: 2.5, dashArray: '6 6', interactive: false }).addTo(capaLote);
    borrador.forEach((p, i) => {
      const m = L.marker(p, { icon: iconoVertice(i === 0), zIndexOffset: 1000 }).addTo(capaLote);
      if (i === 0) m.on('click', (e) => { L.DomEvent.stop(e); if (borrador.length >= 3) cerrarLote(); });
    });
    return;
  }
  if (lote.length < 3) return;
  poligonoLote = L.polygon(lote, { color: '#fff', weight: 2.5, fill: false, interactive: false }).addTo(capaLote);
  lote.forEach((p, i) => {
    const m = L.marker(p, { icon: iconoVertice(false), draggable: true, zIndexOffset: 500 }).addTo(capaLote);
    m.on('drag', (e) => { const q = e.target.getLatLng(); lote[i] = [q.lat, q.lng]; if (poligonoLote) poligonoLote.setLatLngs(lote); programar(); });
    m.on('dragend', () => calculate());
  });
}

function dibujarBebederos() {
  capaBeb.clearLayers();
  bebederos.forEach((p, i) => {
    const m = L.marker(p, { icon: iconoBeb, draggable: true, zIndexOffset: 2000 }).addTo(capaBeb);
    m.on('drag', (e) => { const q = e.target.getLatLng(); bebederos[i] = [q.lat, q.lng]; programar(); });
    m.on('dragend', () => calculate());
    const quitar = document.createElement('button');
    quitar.type = 'button'; quitar.className = 'lote-quitar'; quitar.textContent = 'Quitar bebedero';
    quitar.addEventListener('click', () => { bebederos.splice(i, 1); mapa.closePopup(); dibujarBebederos(); calculate(); });
    m.bindPopup(quitar, { closeButton: false, offset: [0, -10] });
  });
}

function dibujarCalor(info) {
  capaCalor.clearLayers();
  if (!info || !bebederos.length) return;
  const h = info.lado / 2;
  for (const c of info.celdas) {
    const [col, op] = heatColor(c.d);
    L.rectangle([info.P.ll(c.x - h, c.y - h), info.P.ll(c.x + h, c.y + h)],
      { renderer: lienzo, stroke: false, fillColor: col, fillOpacity: op, interactive: false }).addTo(capaCalor);
  }
}

// Mientras se arrastra algo, recalcular a lo sumo una vez por cuadro
let enCola = false;
function programar() { if (enCola) return; enCola = true; requestAnimationFrame(() => { enCola = false; calculate(); }); }

/* ─── Modos: dibujar el lote o marcar bebederos ─── */
const AYUDA = {
  bebedero: 'Tocá el mapa para agregar un bebedero. Arrastralo para moverlo, o tocalo para quitarlo. Las esquinas blancas del lote también se pueden mover.',
  lote: 'Buscá tu campo y acercate. Después tocá cada esquina del lote siguiendo el alambrado; para terminar, tocá el primer punto o "Cerrar lote".',
};
function setModo(m) {
  modo = m;
  d('m_lote').classList.toggle('activo', m === 'lote');
  d('m_beb').classList.toggle('activo', m === 'bebedero');
  d('lote_dibujo').hidden = m !== 'lote';
  d('lote_ayuda_txt').textContent = AYUDA[m];
  d('lote_map').classList.toggle('dibujando', m === 'lote');
  // mientras se dibuja, el calor y los bebederos del lote anterior estorban: se esconden
  [capaCalor, capaBeb].forEach(c => m === 'lote' ? mapa.removeLayer(c) : mapa.addLayer(c));
  if (m === 'lote') actualizarBorrador(); else dibujarLote();
}
function actualizarBorrador() {
  const n = borrador.length;
  d('lote_dibujo_txt').textContent = n === 0 ? (mapa.getZoom() < 13 ? 'Buscá tu campo y acercate' : 'Tocá la primera esquina') : `${n} esquina${n > 1 ? 's' : ''} marcada${n > 1 ? 's' : ''}`;
  d('lote_cerrar').disabled = n < 3;
  dibujarLote();
}
function cerrarLote() {
  lote = borrador.slice(); borrador = [];
  // los bebederos del lote anterior que quedan lejos del nuevo se descartan
  // (se conservan los de adentro y los que están sobre el alambrado, hasta 30 m afuera)
  const P = plano(lote[0]), poli = lote.map(P.a);
  const xs = poli.map(q => q[0]), ys = poli.map(q => q[1]);
  bebederos = bebederos.filter((b) => {
    const [x, y] = P.a(b);
    return dentro(x, y, poli) || (x > Math.min(...xs) - 30 && x < Math.max(...xs) + 30 && y > Math.min(...ys) - 30 && y < Math.max(...ys) + 30);
  });
  setModo('bebedero');
  mapa.fitBounds(lote, { padding: [30, 30], maxZoom: 17 });
  dibujarBebederos(); calculate();
}
d('m_lote').addEventListener('click', () => { borrador = []; setModo('lote'); });
d('m_beb').addEventListener('click', () => { borrador = []; setModo('bebedero'); });
d('lote_cerrar').addEventListener('click', cerrarLote);
d('lote_cancelar').addEventListener('click', () => { borrador = []; setModo('bebedero'); });
d('m_loc').addEventListener('click', () => {
  if (!navigator.geolocation) return;
  navigator.geolocation.getCurrentPosition((pos) => mapa.flyTo([pos.coords.latitude, pos.coords.longitude], 15), () => {}, { enableHighAccuracy: true, timeout: 10000 });
});

mapa.on('zoomend', () => { if (modo === 'lote' && !borrador.length) actualizarBorrador(); });
mapa.on('click', (e) => {
  const p = [e.latlng.lat, e.latlng.lng];
  if (modo === 'lote') {
    if (mapa.getZoom() < 13) {
      d('lote_dibujo_txt').textContent = 'Acercate más a tu campo para dibujar (buscalo arriba o usá el zoom)';
      return;
    }
    borrador.push(p); actualizarBorrador(); return;
  }
  bebederos.push(p); dibujarBebederos(); calculate();
});

/* ─── Buscador (Nominatim/OSM, igual que el mapa de instalación) ─── */
(() => {
  const inp = d('lote_buscar'), res = d('lote_buscar_res'); let t = null, vuelta = 0;
  async function buscar(q) {
    clearTimeout(t);
    const yo = ++vuelta;   // una respuesta vieja no reabre la lista
    if (!q || q.length < 3) { res.classList.remove('open'); return; }
    try {
      const r = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=5&countrycodes=ar&q=${encodeURIComponent(q)}`, { headers: { 'Accept-Language': 'es' } });
      const data = await r.json();
      if (yo !== vuelta) return;
      res.innerHTML = data.length ? '' : '<div>Sin resultados</div>';
      data.forEach((it) => {
        const div = document.createElement('div'); div.textContent = it.display_name;
        div.addEventListener('click', () => { vuelta++; clearTimeout(t); mapa.flyTo([+it.lat, +it.lon], 15); res.classList.remove('open'); });
        res.appendChild(div);
      });
      res.classList.add('open');
    } catch { /* sin geocoder: se navega a mano */ }
  }
  inp.addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => buscar(inp.value.trim()), 450); });
  inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); buscar(inp.value.trim()); } });
  d('lote_buscar_btn').addEventListener('click', () => buscar(inp.value.trim()));
  document.addEventListener('click', (e) => { if (!e.target.closest('.lote-buscar')) res.classList.remove('open'); });
})();

// Ubicaciones automáticas, relativas al lote dibujado (si un punto cae afuera, se corre hacia el centro)
window.setPos = function(type) {
  if (type === 0) { bebederos = []; dibujarBebederos(); calculate(); return; }
  if (lote.length < 3) return;
  const P = plano(lote[0]), poli = lote.map(P.a);
  const xs = poli.map(p => p[0]), ys = poli.map(p => p[1]);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  const ancho = x1 - x0, alto = y1 - y0;
  let cx = 0, cy = 0; poli.forEach(p => { cx += p[0]; cy += p[1]; }); cx /= poli.length; cy /= poli.length;
  if (!dentro(cx, cy, poli)) { cx = x0 + ancho / 2; cy = y0 + alto / 2; }
  const largoEnX = ancho >= alto;
  let fr = [];
  if (type === 1) fr = [null];
  if (type === 3) fr = largoEnX ? [[.25, .5], [.75, .5]] : [[.5, .25], [.5, .75]];
  if (type === 4) fr = [[.25, .25], [.75, .25], [.25, .75], [.75, .75]];
  bebederos = fr.map((f) => {
    let x = f ? x0 + f[0] * ancho : cx, y = f ? y0 + f[1] * alto : cy;
    for (let k = 0; k < 20 && !dentro(x, y, poli); k++) { x += (cx - x) * 0.25; y += (cy - y) * 0.25; }
    return P.ll(x, y);
  });
  dibujarBebederos(); calculate();
};

function calculate() {
  const cantidadAnimales = v('in_animales');
  const cat = categorias[d('in_categoria').value];
  const clima = situacionesClima[d('in_clima').value];
  const diasEnLote = v('in_dias');
  const precioKgVivo = v('in_precio');
  const pendiente = v('in_pendiente');
  const factCamino = factoresCamino[d('in_camino').value].factor;

  const hayLote = lote.length >= 3;
  const info = hayLote ? celdasDelLote() : null;
  const areaHa = info ? info.area / 10000 : 0;
  d('out_area').innerText = `${fmt(areaHa, 1)} ha`;
  d('out_bebederos_cant').innerText = bebederos.length;

  if (!hayLote || !bebederos.length || !info.celdas.length) {
    d('sin_titulo').innerText = hayLote ? 'Ahora marcá los bebederos' : 'Empezá dibujando tu lote';
    d('sin_txt').innerText = hayLote ? 'Tocá en el mapa dónde está (o dónde iría) el bebedero.' : 'Buscá tu campo en el mapa y marcá las esquinas del lote.';
    d('card_sin_bebederos').style.display = 'block';
    d('resultados_wrap').style.display = 'none';
    dibujarCalor(null);
    d('out_max_d').innerText = '0';
    return;
  }

  d('card_sin_bebederos').style.display = 'none';
  d('resultados_wrap').style.display = 'block';

  // Distancias: de cada punto del lote al bebedero más cercano
  let sumaDistancias = 0, maxDistancia = 0;
  for (const c of info.celdas) { sumaDistancias += c.d; if (c.d > maxDistancia) maxDistancia = c.d; }
  const distanciaPromedio = sumaDistancias / info.celdas.length;

  dibujarCalor(info);

  // Visitas y Caminata
  const visitasPorDia = visitasSegunDistancia(distanciaPromedio, clima.factorVisitasBase);
  const caminataDiariaKm = (distanciaPromedio * 2 * visitasPorDia / 1000) * factCamino;

  // UI Updates básicos
  d('out_max_d').innerText = fmt(maxDistancia, 0);
  d('out_hint_visitas').innerText = fmt(visitasPorDia, 1);
  d('out_dist_prom').innerText = fmt(distanciaPromedio, 0);
  d('out_dist_max').innerText = fmt(maxDistancia, 0);
  d('metric_max_dist').className = `metric-card color-${maxDistancia > 500 ? 'warning' : 'info'}`;
  d('out_visitas').innerText = fmt(visitasPorDia, 1);
  d('out_caminata').innerText = fmt(caminataDiariaKm, 2);
  d('metric_caminata').className = `metric-card color-${caminataDiariaKm > 2 ? 'warning' : 'accent'}`;

  // Agua
  const consumoAguaIdeal = cat.consumoAguaBase * clima.factorConsumoAgua;
  const reduccionAguaPct = reduccionConsumoAguaPct(distanciaPromedio);
  const consumoAguaReal = consumoAguaIdeal * (1 - reduccionAguaPct/100);

  if (reduccionAguaPct > 0) {
    d('card_agua').style.display = 'block';
    d('out_agua_pct').innerText = fmt(reduccionAguaPct, 0);
    d('out_agua_ideal').innerText = `${fmt(consumoAguaIdeal, 0)} L/día`;
    d('out_agua_real').innerText = `${fmt(consumoAguaReal, 0)} L/día`;
  } else {
    d('card_agua').style.display = 'none';
  }

  // Energía y Pérdidas
  const elevacionPorKm = pendiente / 100 * 1000;
  const energiaPorKm = 0.00045 + (0.0067 * (elevacionPorKm / 1000) * 0.5);   // la mitad del camino es subida
  const energiaCaminataMcalAnimalDia = caminataDiariaKm * cat.pesoProm * energiaPorKm;
  const kgPerdidosEnergiaCaminata = energiaCaminataMcalAnimalDia / 6.5; // 6.5 Mcal = 1kg GDP
  
  const reduccionConsumoMSPct = reduccionAguaPct * 0.7;
  const kgPerdidosPorReduccionMS = cat.gdpObjetivo * reduccionConsumoMSPct / 100;
  
  const horasCaminando = caminataDiariaKm / 3;
  const reduccionMSPorTiempo = Math.min(15, horasCaminando * 5);
  const kgPerdidosPorTiempo = cat.gdpObjetivo * reduccionMSPorTiempo / 100;

  const kgPerdidosPorAnimalDia = cat.gdpObjetivo > 0 ? kgPerdidosEnergiaCaminata + kgPerdidosPorReduccionMS + kgPerdidosPorTiempo : 0;
  const gdpReducido = Math.max(0, cat.gdpObjetivo - kgPerdidosPorAnimalDia);
  
  const kgPerdidosTotalPeriodo = kgPerdidosPorAnimalDia * cantidadAnimales * diasEnLote;
  const arsPerdidosPeriodo = kgPerdidosTotalPeriodo * precioKgVivo;

  const consumoMSBasal = cat.pesoProm * 0.025;
  const kgMSExtraPorAnimalDia = (energiaCaminataMcalAnimalDia + (cat.gdpObjetivo > 0 ? (kgPerdidosPorReduccionMS + kgPerdidosPorTiempo) * 6.5 : 0)) / 2.5;
  const comidaExtraPct = (kgMSExtraPorAnimalDia / consumoMSBasal) * 100;

  if (comidaExtraPct > 0.05) {
    d('card_comida').style.display = 'block';
    d('out_comida_pct').innerText = `${fmt(comidaExtraPct, 1)}%`;
    d('out_ms_basal').innerText = `${fmt(consumoMSBasal, 1)} kg/día`;
    d('out_ms_extra').innerText = `+${fmt(kgMSExtraPorAnimalDia, 2)} kg/día`;
  } else {
    d('card_comida').style.display = 'none';
  }

  if (kgPerdidosTotalPeriodo > 0) {
    d('card_eco_caminata').style.display = 'block';
    d('lbl_hor_caminata').innerText = `Impacto económico · ${diasEnLote} días`;
    d('out_gdp_esp').innerText = `${fmt(cat.gdpObjetivo*1000, 0)} g`;
    d('out_gdp_real').innerText = `→ ${fmt(gdpReducido*1000, 0)} g/día`;
    d('out_gdp_perdido').innerText = `-${fmt(kgPerdidosPorAnimalDia*1000, 0)} g/día por animal`;
    d('out_eco_kg').innerText = `${fmt(kgPerdidosTotalPeriodo, 0)} kg`;
    d('out_eco_pesos').innerText = fmtMoneyShort(arsPerdidosPeriodo);
  } else {
    d('card_eco_caminata').style.display = 'none';
  }

  // Desglose
  if (cat.gdpObjetivo > 0 && kgPerdidosPorAnimalDia > 0) {
    d('card_desglose').style.display = 'block';
    const pctEnergia = (kgPerdidosEnergiaCaminata/kgPerdidosPorAnimalDia)*100;
    const pctAgua = (kgPerdidosPorReduccionMS/kgPerdidosPorAnimalDia)*100;
    const pctTiempo = (kgPerdidosPorTiempo/kgPerdidosPorAnimalDia)*100;

    d('out_desg_energia_val').innerText = fmt(kgPerdidosEnergiaCaminata*1000, 0);
    d('out_desg_energia_pct').innerText = fmt(pctEnergia, 0);
    d('bar_desg_energia').style.width = `${pctEnergia}%`;

    d('out_desg_agua_val').innerText = fmt(kgPerdidosPorReduccionMS*1000, 0);
    d('out_desg_agua_pct').innerText = fmt(pctAgua, 0);
    d('bar_desg_agua').style.width = `${pctAgua}%`;

    d('out_desg_tiempo_val').innerText = fmt(kgPerdidosPorTiempo*1000, 0);
    d('out_desg_tiempo_pct').innerText = fmt(pctTiempo, 0);
    d('bar_desg_tiempo').style.width = `${pctTiempo}%`;
  } else {
    d('card_desglose').style.display = 'none';
  }

  let rec = '';
  if (distanciaPromedio < 150) rec = '✓ Distancia promedio óptima. Los animales acceden al agua sin esfuerzo significativo.';
  else if (distanciaPromedio <= 250) rec = '✓ Distancia dentro del límite recomendado (250 m). Pérdidas chicas; revisá las zonas amarillas o rojas del mapa.';
  else if (distanciaPromedio < 400) rec = '⚠ Distancia por encima de los 250 m recomendados. Evaluar redistribuir o sumar un bebedero para reducir pérdidas.';
  else if (distanciaPromedio < 700) rec = '⚠ Distancia excesiva. Caída de visitas y consumo de agua. Subdividir el lote o agregar puntos de agua.';
  else rec = '✗ Caminata crítica. Pérdida significativa de GDP por menor ingesta de agua y mayor gasto energético. Implementar aguadas distribuidas.';
  d('out_recomendacion').innerText = rec;

  // Actualizar referencias
  d('ref_clima_nombre').innerText = clima.nombre;
  d('ref_clima_factor').innerText = fmt(clima.factorVisitasBase, 1);
  d('ref_visitas').innerText = `${fmt(visitasPorDia, 1)}/día`;

}

// Bind events
document.querySelectorAll('.calc-input').forEach(el => {
  el.addEventListener('input', calculate);
  el.addEventListener('change', calculate);
});

// Init
window.addEventListener('DOMContentLoaded', () => {
  setModo('lote');
  calculate();
});
