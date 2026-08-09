/**
 * LoRa Link Calculator
 * ---------------------------------------------------------------------------
 * Modelo de propagación, de lo teórico a lo realista:
 *
 *   1. FSPL (espacio libre)                       → límite optimista absoluto
 *   2. Reflexión de suelo / two-ray (plane earth) → n=4 más allá de 4π·h₁·h₂/λ
 *   3. Difracción multi-obstáculo                 → ITU-R P.526 (filo de cuchillo
 *                                                   + construcción de Deygout)
 *   4. Clutter de sitio (dB) y de trayecto (m)    → ITU-R P.833 / P.1812
 *   5. Ruido ambiente + margen de implementación  → degrada la sensibilidad
 *   6. Calibración empírica con mediciones reales → ajuste log-distancia
 *
 * Pérdida total del trayecto:
 *   L = L_base(FSPL ⊕ two-ray) + L_difracción + L_clutter_sitio
 * o, en modo calibrado:
 *   L = A + 10·n·log₁₀(d) + L_difracción
 */

/**
 * 1. ANTENNA_PRESETS Array
 */
const ANTENNA_PRESETS = [
  // Omnidirectional
  { name: 'Rubber Duck / Whip', gain: 2, type: 'omni', desc: 'Stock, nodos portátiles' },
  { name: 'Dipolo ½ onda', gain: 2.15, type: 'omni', desc: 'DIY, referencia' },
  { name: 'Super J-Pole', gain: 3, type: 'omni', desc: 'DIY popular, Meshtastic' },
  { name: 'Ground Plane ¼ onda', gain: 3, type: 'omni', desc: 'Base sencilla' },
  { name: 'Signal Stick', gain: 3, type: 'omni', desc: 'Portátil de calidad' },
  { name: 'Collinear fibra de vidrio 3 dBi', gain: 3, type: 'omni', desc: 'Exterior, gateway' },
  { name: 'Collinear fibra de vidrio 5.8 dBi', gain: 5.8, type: 'omni', desc: 'Gateway estándar' },
  { name: 'Collinear fibra de vidrio 8 dBi', gain: 8, type: 'omni', desc: 'Rural, terreno plano' },
  { name: 'Collinear fibra de vidrio 12 dBi', gain: 12, type: 'omni', desc: 'Largo alcance' },
  // Directional
  { name: 'Moxon', gain: 6, type: 'dir', desc: 'DIY, compacta' },
  { name: 'Yagi 3 elementos', gain: 7, type: 'dir', desc: 'P2P corto' },
  { name: 'Panel / Patch', gain: 9, type: 'dir', desc: 'Sectorial' },
  { name: 'Yagi 6 elementos', gain: 11, type: 'dir', desc: 'P2P medio' },
  { name: 'Yagi 12 elementos', gain: 15, type: 'dir', desc: 'P2P largo' },
  { name: 'Parabólica / Grilla', gain: 20, type: 'dir', desc: 'Máximo alcance P2P' },
  // Custom
  { name: '🔧 Personalizada', gain: 0, type: 'custom', desc: 'Valor libre' },
];

/**
 * Límites regulatorios de duty cycle por banda (referencia).
 * 915 (AU915/US915) no usa duty estricto sino dwell-time máx. de 400 ms.
 */
const BAND_INFO = {
  433: { dutyLimit: 10, label: 'EU433 · 10%' },
  868: { dutyLimit: 1, label: 'EU868 · 1%' },
  915: { dutyLimit: null, dwellMs: 400, label: 'AU915/US915 · dwell 400 ms' },
};

/**
 * Pérdida por el entorno inmediato de cada extremo (dB).
 * Órdenes de magnitud de ITU-R P.1812 (clutter en terminales) y P.833.
 * Modela lo que el DEM no ve: arboleda, casas o paredes alrededor del mástil.
 */
const SITE_CLUTTER = [
  { name: 'Campo abierto / despejado', loss: 0 },
  { name: 'Rural, arbolado disperso', loss: 4 },
  { name: 'Suburbano, casas bajas', loss: 9 },
  { name: 'Bosque / arboleda densa', loss: 14 },
  { name: 'Urbano denso', loss: 18 },
  { name: 'Dentro de un edificio', loss: 22 },
];

/**
 * Cobertura a lo largo del trayecto: se suma como ALTURA al perfil del DEM.
 * El DEM de Open-Meteo (Copernicus ~90 m) es terreno desnudo: no trae árboles
 * ni edificios, y son justamente los que cortan un enlace de 915 MHz.
 */
const PATH_CLUTTER = [
  { name: 'Despejado (campo, agua)', height: 0 },
  { name: 'Cultivos / pastizal alto', height: 3 },
  { name: 'Arbolado disperso', height: 8 },
  { name: 'Edificación baja', height: 10 },
  { name: 'Bosque / monte cerrado', height: 15 },
  { name: 'Urbano denso', height: 20 },
];

/**
 * 2. LinkCalculator Object
 */
const LinkCalculator = {
  /** Longitud de onda (m) para una frecuencia en MHz. */
  lambda(freqMHz) { return 299.792458 / freqMHz; },

  /* ───────── Pérdida básica ───────── */

  // FSPL en dB. d en km, f en MHz.
  fspl(distanceKm, freqMHz) {
    if (distanceKm <= 0) return 0;
    return 20 * Math.log10(distanceKm) + 20 * Math.log10(freqMHz) + 32.45;
  },

  /**
   * Plane earth / two-ray. La onda directa y la reflejada en el suelo llegan
   * casi en contrafase, y la pérdida pasa a crecer con n=4 en vez de n=2:
   *   L = 40·log₁₀(d_m) − 20·log₁₀(h₁) − 20·log₁₀(h₂)
   * Es la razón principal por la que el alcance real es mucho menor que FSPL.
   */
  planeEarthLoss(distanceKm, h1, h2) {
    if (distanceKm <= 0 || h1 <= 0 || h2 <= 0) return -Infinity;
    return 40 * Math.log10(distanceKm * 1000) - 20 * Math.log10(h1) - 20 * Math.log10(h2);
  },

  /** Distancia de quiebre donde FSPL y two-ray se cruzan exactamente (km). */
  breakpointKm(h1, h2, freqMHz) {
    if (h1 <= 0 || h2 <= 0) return Infinity;
    return (4 * Math.PI * h1 * h2 / this.lambda(freqMHz)) / 1000;
  },

  /**
   * Pérdida básica combinada. `reflFactor` ∈ [0,1] pondera cuánta reflexión
   * especular sobrevive: 1 = suelo liso (agua, campo llano), 0 = terreno muy
   * irregular o boscoso, donde manda la difracción y no la reflexión.
   */
  basicPathLoss(distanceKm, h1, h2, reflFactor, freqMHz) {
    const fs = this.fspl(distanceKm, freqMHz);
    const pe = this.planeEarthLoss(distanceKm, h1, h2);
    if (!isFinite(pe)) return fs;
    return fs + reflFactor * Math.max(0, pe - fs);
  },

  /* ───────── Difracción ───────── */

  // Pérdida por difracción de filo de cuchillo (dB) según el parámetro ν (ITU-R P.526).
  //   ν ≤ −0.78 → 0 dB   (≈ 60% de la 1ra zona de Fresnel despejada)
  //   ν = 0     → 6 dB   (obstáculo rozando la LOS)
  //   ν > 0     → pérdida creciente
  knifeEdgeLoss(v) {
    if (v <= -0.78) return 0;
    const loss = 6.9 + 20 * Math.log10(Math.sqrt(Math.pow(v - 0.1, 2) + 1) + v - 0.1);
    return Math.max(loss, 0);
  },

  /** Parámetro ν de un punto del perfil respecto de la recta (i0 → i1). */
  _fresnelV(pts, i, i0, i1, h0, h1, lambda) {
    const d1 = pts[i].dm - pts[i0].dm;
    const d2 = pts[i1].dm - pts[i].dm;
    if (d1 <= 0 || d2 <= 0) return null;
    const los = h0 + (h1 - h0) * (d1 / (d1 + d2));
    const h = pts[i].hMetric - los;
    return h * Math.sqrt((2 * (d1 + d2)) / (lambda * d1 * d2));
  },

  /** Filo dominante (mayor ν) del subtramo i0..i1. */
  _worstEdge(pts, i0, i1, h0, h1, lambda) {
    let best = null;
    for (let i = i0 + 1; i < i1; i++) {
      const v = this._fresnelV(pts, i, i0, i1, h0, h1, lambda);
      if (v === null) continue;
      if (!best || v > best.v) best = { i, v };
    }
    return best;
  },

  /**
   * Difracción multi-obstáculo por construcción de Deygout limitada a 3 filos:
   *     L = J(ν₁) + T·(J(ν₂) + J(ν₃)),   T = 1 − e^(−J(ν₁)/6)
   *
   * El filo principal es el de mayor ν sobre todo el trayecto; los secundarios
   * son los dominantes de cada subtramo (Tx→principal y principal→Rx).
   *
   * T amortigua los filos secundarios cuando el principal apenas roza la LOS:
   * sin ese factor, el abultamiento terrestre de un trayecto casi despejado
   * generaba filos secundarios espurios y sobrestimaba la pérdida.
   *
   * Un único filo (como hacía la versión anterior) subestima siempre que hay
   * más de un cerro, o una loma seguida de arboleda.
   */
  diffractionLoss(geo, freqMHz) {
    const empty = { loss: 0, edge: null, vMax: -99, edges: 0 };
    if (!geo || !geo.pts || geo.pts.length < 3) return empty;

    const lambda = this.lambda(freqMHz);
    const pts = geo.pts;
    const n = pts.length;

    const main = this._worstEdge(pts, 0, n - 1, geo.hTx, geo.hRx, lambda);
    if (!main || main.v <= -0.78) return { ...empty, vMax: main ? main.v : -99 };

    const L1 = this.knifeEdgeLoss(main.v);
    const left = this._worstEdge(pts, 0, main.i, geo.hTx, pts[main.i].hMetric, lambda);
    const right = this._worstEdge(pts, main.i, n - 1, pts[main.i].hMetric, geo.hRx, lambda);
    const L2 = (left && left.v > -0.78) ? this.knifeEdgeLoss(left.v) : 0;
    const L3 = (right && right.v > -0.78) ? this.knifeEdgeLoss(right.v) : 0;

    const T = 1 - Math.exp(-L1 / 6);
    const loss = L1 + T * (L2 + L3);
    const edges = 1 + (L2 > 0 ? 1 : 0) + (L3 > 0 ? 1 : 0);

    // Más allá de ~60 dB la difracción deja de ser el mecanismo dominante
    // (entra dispersión troposférica); el enlace ya es inviable igual.
    return { loss: Math.min(loss, 60), edge: main, vMax: main.v, edges };
  },

  /**
   * Rugosidad del terreno: σ de los residuos respecto de la recta de regresión
   * del perfil. Un σ grande destruye el rayo reflejado en el suelo.
   */
  terrainRoughness(pts) {
    const n = pts.length;
    if (n < 3) return 0;
    let sx = 0, sy = 0, sxx = 0, sxy = 0;
    for (const p of pts) {
      sx += p.distKm; sy += p.ground;
      sxx += p.distKm * p.distKm; sxy += p.distKm * p.ground;
    }
    const den = n * sxx - sx * sx;
    const slope = den === 0 ? 0 : (n * sxy - sx * sy) / den;
    const intercept = (sy - slope * sx) / n;
    let acc = 0;
    for (const p of pts) {
      const r = p.ground - (slope * p.distKm + intercept);
      acc += r * r;
    }
    return Math.sqrt(acc / n);
  },

  /** Factor de reflexión de suelo. 'auto' lo deduce de la rugosidad. */
  reflectionFactor(mode, roughness, clutterHeight) {
    let f;
    if (mode === 'yes') f = 1;
    else if (mode === 'partial') f = 0.5;
    else if (mode === 'no') f = 0;
    else if (roughness === null || roughness === undefined) f = 0.5;
    else if (roughness <= 3) f = 1;
    else if (roughness >= 25) f = 0.15;
    else f = 1 - 0.85 * (roughness - 3) / 22;

    // Vegetación o edificación alta dispersan la reflexión especular.
    if (mode === 'auto' && clutterHeight > 5) f = Math.min(f, 0.35);
    return f;
  },

  /* ───────── Receptor ───────── */

  /**
   * Sensibilidad efectiva. `noiseExcess` suma el ruido ambiente de la banda ISM
   * (en zona urbana el piso real está bastante por encima del térmico) más el
   * margen de implementación del módulo respecto de su datasheet.
   */
  sensitivity(sf, bw, noiseExcess = 0) {
    const snrLimits = { 7: -7.5, 8: -10, 9: -12.5, 10: -15, 11: -17.5, 12: -20 };
    const snr = snrLimits[sf] !== undefined ? snrLimits[sf] : -20;
    const noiseFigure = 6; // dB, típico SX126x/127x
    return -174 + 10 * Math.log10(bw) + noiseFigure + snr + noiseExcess;
  },

  eirp(txPower, txGain, txCableLoss) {
    return txPower + txGain - txCableLoss;
  },

  // Potencia recibida REAL (el RSSI que debería reportar la radio).
  rxPower(eirp, rxGain, rxCableLoss, totalPathLoss) {
    return eirp + rxGain - rxCableLoss - totalPathLoss;
  },

  // Margen de enlace real = Prx − Sensibilidad.
  linkMargin(rxPower, sensitivity) {
    return rxPower - sensitivity;
  },

  dataRate(sf, bw, cr) {
    return sf * (bw / Math.pow(2, sf)) * (4 / cr);
  },

  // Time-on-Air (ms) según la fórmula de Semtech (LoRa).
  timeOnAir(sf, bw, cr, payload, preamble = 8, crc = 1, explicitHeader = true) {
    const tSym = Math.pow(2, sf) / bw; // s
    // Low Data Rate Optimize: se activa cuando el símbolo dura más de 16 ms.
    // Antes estaba cableado a (SF>=11 && BW==125k): da lo mismo en 125 kHz pero
    // falla en anchos angostos como 62.5 kHz, donde ya se activa desde SF10.
    const de = tSym > 0.016 ? 1 : 0;
    const ih = explicitHeader ? 0 : 1;
    const crCoef = cr - 4; // 5..8 → 1..4
    const numerator = 8 * payload - 4 * sf + 28 + 16 * crc - 20 * ih;
    const denominator = 4 * (sf - 2 * de);
    const payloadSymb = 8 + Math.max(Math.ceil(numerator / denominator) * (crCoef + 4), 0);
    const toa = (preamble + 4.25 + payloadSymb) * tSym; // s
    return toa * 1000; // ms
  },

  /* ───────── Geometría ───────── */

  // Radio de la 1ra zona de Fresnel (m). d en km, f en GHz.
  fresnelRadius(d1_km, d2_km, totalDist_km, freqGHz) {
    if (totalDist_km <= 0) return 0;
    return 17.32 * Math.sqrt((d1_km * d2_km) / (totalDist_km * freqGHz));
  },

  // Abultamiento terrestre con k=4/3 (m).
  earthCurvature(d1_km, d2_km) {
    const k = 4 / 3;
    const rEarth = 6371000;
    return (d1_km * d2_km * 1000000) / (2 * k * rEarth);
  },

  /* ───────── Estadística ───────── */

  erf(x) {
    const s = x < 0 ? -1 : 1;
    x = Math.abs(x);
    const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741,
          a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911;
    const t = 1 / (1 + p * x);
    const y = 1 - ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
    return s * y;
  },

  /**
   * Disponibilidad estimada: probabilidad de que el desvanecimiento por sombra
   * (log-normal, desvío σ) no se coma el margen disponible.
   */
  availability(margin, sigma) {
    if (!(sigma > 0)) return margin >= 0 ? 100 : 0;
    return 50 * (1 + this.erf(margin / (sigma * Math.SQRT2)));
  },

  /* ───────── Alcance ───────── */

  /**
   * Alcance realista sobre terreno plano y despejado, por bisección geométrica
   * usando el MISMO modelo del enlace actual (two-ray + clutter de sitio, o el
   * modelo calibrado si hay mediciones cargadas).
   */
  estimateRange(cfg) {
    const lossAt = (d) => cfg.calibrated
      ? cfg.calA + 10 * cfg.calN * Math.log10(d)
      : this.basicPathLoss(d, cfg.h1, cfg.h2, cfg.refl, cfg.freqMHz) + cfg.clutterDb;
    const f = (d) => cfg.eirp + cfg.rxGain - cfg.rxLoss - lossAt(d) - cfg.sens - cfg.reqMargin;

    let lo = 0.005, hi = 2000;
    if (f(lo) < 0) return 0;
    if (f(hi) > 0) return hi;
    for (let i = 0; i < 60; i++) {
      const mid = Math.sqrt(lo * hi);
      if (f(mid) > 0) lo = mid; else hi = mid;
    }
    return lo;
  },

  // Distancia máxima en espacio libre puro (el número "de folleto").
  maxDistance(txPower, txGain, txCableLoss, rxGain, rxCableLoss, sensitivity, requiredMargin, freqMHz) {
    const eirpVal = this.eirp(txPower, txGain, txCableLoss);
    const fsplMax = eirpVal + rxGain - rxCableLoss - requiredMargin - sensitivity;
    const log10d = (fsplMax - 20 * Math.log10(freqMHz) - 32.45) / 20;
    return Math.pow(10, log10d);
  }
};

/**
 * Mediciones de la prueba de alcance a campo (sierras, 915 MHz).
 * Nodo fijo en -37.313972, -59.159817 (198 m) · móvil a 3.49 y 8.07 km.
 *
 * Cada punto es la mediana de una corrida. La señal real se obtuvo con la
 * corrección de Semtech (RSSI + SNR, porque el SNR era negativo) y de ahí la
 * pérdida de trayecto:
 *     L = Ptx + G_tx + G_rx − señal,  con Ptx = 17 dBm
 *     G_tx = 2 dBi (whip del nodo fijo) · G_rx = 12 dBi (Yagi) o 3 dBi (J-Pole)
 *
 * Validación cruzada: las dos antenas dan la MISMA pérdida a igual distancia
 * (155.0 dB a 8.07 km; 144.2 vs 143.3 a 3.49 km), lo que confirma tanto la
 * corrección como la diferencia de ganancia supuesta.
 *
 * Si las ganancias reales fueran otras, las cuatro L se desplazan lo mismo:
 * el exponente n no cambia y el offset se cancela al predecir con la misma
 * configuración cargada en la app.
 */
const FIELD_CALIBRATION = {
  label: 'Prueba de alcance en sierras · 915 MHz · Ptx 17 dBm',
  points: [
    { d: 3.492, rssi: -111, snr: -2.2,  sig: -113.2, L: 144.2, note: 'Yagi · SF10/125k · PDR 100%' },
    { d: 3.491, rssi: -113, snr: -8.3,  sig: -121.3, L: 143.3, note: 'J-Pole · SF10/125k · PDR 100%' },
    { d: 8.071, rssi: -116, snr: -8.0,  sig: -124.0, L: 155.0, note: 'Yagi · SF12/62.5k · PDR 100%' },
    { d: 8.071, rssi: -117, snr: -16.0, sig: -133.0, L: 155.0, note: 'J-Pole · SF12/62.5k · PDR 100%' },
  ]
};

/**
 * 2b. Calibración con mediciones de campo
 * Ajusta  L = A + 10·n·log₁₀(d_km)  a RSSI medidos de verdad.
 * Cada punto guarda la pérdida de trayecto ya despejada
 * (L = EIRP + G_rx − L_rx − señal) para que cambiar la config después no
 * corrompa el ajuste.
 */
const Calibration = {
  STORAGE_KEY: 'lora-calib-v1',
  points: [],
  fit: null,
  enabled: false,

  seeded: false,

  load() {
    let stored = null;
    try {
      const raw = localStorage.getItem(this.STORAGE_KEY);
      if (raw) stored = JSON.parse(raw);
    } catch (e) {
      console.warn('No se pudo leer la calibración guardada:', e);
    }

    if (stored) {
      this.points = Array.isArray(stored.points) ? stored.points : [];
      this.enabled = !!stored.enabled;
      this.seeded = !!stored.seeded;
    }

    // Primer arranque: se precargan las mediciones de campo. `seeded` queda
    // marcado para siempre, así que si después las borrás no vuelven solas
    // (se pueden restaurar a mano con el botón).
    if (!this.seeded) {
      this.seedFieldData();
      this.enabled = true;
      this.save();
    }

    this.recompute();
  },

  /** Repone las mediciones de campo de referencia (reemplaza las actuales). */
  seedFieldData() {
    this.points = FIELD_CALIBRATION.points.map(p => ({ ...p }));
    this.seeded = true;
    this.recompute();
    this.save();
  },

  save() {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify({
        points: this.points, enabled: this.enabled, seeded: this.seeded
      }));
    } catch (e) {
      console.warn('No se pudo guardar la calibración:', e);
    }
  },

  /**
   * Potencia real de señal a partir del RSSI del paquete.
   *
   * En LoRa se demodula muy por debajo del ruido. Cuando el SNR es negativo, el
   * RSSI que reporta el SX127x está dominado por el ruido del canal y satura:
   * la potencia real de la señal es RSSI + SNR (corrección de Semtech).
   *
   * Sin esta corrección dos antenas con 8 dB de diferencia de ganancia pueden
   * reportar el mismo RSSI (p. ej. −116 vs −117 dBm) y la calibración sale mal
   * por más de 15 dB.
   */
  signalFromRssi(rssi, snr) {
    if (!isFinite(snr)) return rssi;
    return rssi + Math.min(0, snr);
  },

  add(distKm, rssi, snr, linkConstant, note) {
    // Un NaN acá contaminaría el ajuste de forma permanente (queda persistido).
    if (!(distKm > 0) || !isFinite(rssi) || !isFinite(linkConstant)) return false;
    const sig = this.signalFromRssi(rssi, snr);
    this.points.push({
      d: distKm, rssi,
      snr: isFinite(snr) ? snr : null,
      sig,
      L: linkConstant - sig,
      note: note || ''
    });
    this.points.sort((a, b) => a.d - b.d);
    this.recompute();
    this.save();
    return true;
  },

  remove(idx) {
    this.points.splice(idx, 1);
    this.recompute();
    this.save();
  },

  clear() {
    this.points = [];
    this.recompute();
    this.save();
  },

  /** Mínimos cuadrados sobre (log₁₀ d, L). */
  recompute() {
    const pts = this.points;
    if (pts.length === 0) { this.fit = null; return; }

    const DEFAULT_N = 3.5; // exponente típico de terreno mixto en UHF

    if (pts.length === 1) {
      this.fit = {
        n: DEFAULT_N,
        A: pts[0].L - 10 * DEFAULT_N * Math.log10(pts[0].d),
        rmse: null, count: 1, assumedN: true
      };
      return;
    }

    const N = pts.length;
    let sx = 0, sy = 0, sxx = 0, sxy = 0;
    for (const p of pts) {
      const x = Math.log10(p.d);
      sx += x; sy += p.L; sxx += x * x; sxy += x * p.L;
    }
    const den = N * sxx - sx * sx;

    // Todas las mediciones a la misma distancia: sólo se puede ajustar el offset.
    if (Math.abs(den) < 1e-9) {
      this.fit = {
        n: DEFAULT_N,
        A: (sy / N) - 10 * DEFAULT_N * Math.log10(pts[0].d),
        rmse: null, count: N, assumedN: true
      };
      return;
    }

    const rawN = ((N * sxy - sx * sy) / den) / 10;
    let n = Math.min(6, Math.max(1.6, rawN));
    let A;
    if (n !== rawN) {
      A = (sy - 10 * n * sx) / N;   // n fuera de rango físico: se fija y se reajusta el offset
    } else {
      A = (sy - 10 * n * sx) / N;
    }

    let acc = 0;
    for (const p of pts) {
      const pred = A + 10 * n * Math.log10(p.d);
      acc += Math.pow(p.L - pred, 2);
    }

    this.fit = { n, A, rmse: Math.sqrt(acc / N), count: N, assumedN: n !== rawN };
  },

  isUsable() { return this.enabled && this.fit !== null; },

  /** σ de sombra: el error real del ajuste si es significativo, si no 8 dB. */
  sigma() {
    if (this.fit && this.fit.rmse !== null && this.fit.rmse > 1) return this.fit.rmse;
    return 8;
  }
};

/**
 * 3. MapManager Class
 */
class MapManager {
  constructor(mapId) {
    this.map = L.map(mapId).setView([-34.6, -58.4], 10);

    const osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap'
    });

    const esri = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      maxZoom: 19,
      attribution: 'Tiles &copy; Esri'
    });

    osm.addTo(this.map);
    L.control.layers({ "OpenStreetMap": osm, "Satélite (ESRI)": esri }).addTo(this.map);

    const txIcon = L.divIcon({
      className: 'custom-marker',
      html: '<div style="background-color: #ff4757; width: 16px; height: 16px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 4px rgba(0,0,0,0.5);"></div><div style="margin-top: 4px; font-weight: bold; text-shadow: 1px 1px 2px black; color: #fff;">Tx</div>',
      iconSize: [20, 40],
      iconAnchor: [10, 10]
    });

    const rxIcon = L.divIcon({
      className: 'custom-marker',
      html: '<div style="background-color: #00b4d8; width: 16px; height: 16px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 4px rgba(0,0,0,0.5);"></div><div style="margin-top: 4px; font-weight: bold; text-shadow: 1px 1px 2px black; color: #fff;">Rx</div>',
      iconSize: [20, 40],
      iconAnchor: [10, 10]
    });

    this.icons = { tx: txIcon, rx: rxIcon };

    // El mapa arranca VACÍO: los marcadores se colocan con clic, escribiendo
    // coordenadas o con el botón de posición actual.
    this.txMarker = null;
    this.rxMarker = null;
    this.locationMarker = null;
    this.accuracyCircle = null;

    this.polyline = L.polyline([], {
      color: '#00e5a0',
      dashArray: '5, 10',
      weight: 3
    }).addTo(this.map);

    this.onChangedCallback = null;

    this.nextClick = 'tx';
    this.map.on('click', (e) => {
      this.setMarkerPosition(this.nextClick, e.latlng.lat, e.latlng.lng);
    });
  }

  onMarkersChanged(callback) {
    this.onChangedCallback = callback;
  }

  hasBoth() { return !!(this.txMarker && this.rxMarker); }

  /** Cuál marcador se colocará en el próximo clic / uso del GPS. */
  pending() { return this.nextClick; }

  getDistance() {
    if (!this.hasBoth()) return 0;
    return this.txMarker.getLatLng().distanceTo(this.rxMarker.getLatLng()) / 1000;
  }

  getTxLatLng() { return this.txMarker ? this.txMarker.getLatLng() : null; }
  getRxLatLng() { return this.rxMarker ? this.rxMarker.getLatLng() : null; }

  setMarkerPosition(which, lat, lng) {
    if (!isFinite(lat) || !isFinite(lng)) return;
    const latlng = L.latLng(lat, lng);
    const key = which === 'tx' ? 'txMarker' : 'rxMarker';

    if (!this[key]) {
      this[key] = L.marker(latlng, { draggable: true, icon: this.icons[which] }).addTo(this.map);
      const notify = () => {
        this.updateLine();
        if (this.onChangedCallback) this.onChangedCallback();
      };
      this[key].on('drag', notify);
      this[key].on('dragend', notify);
    } else {
      this[key].setLatLng(latlng);
    }

    // Alterna al otro extremo, salvo que el otro siga vacío.
    this.nextClick = which === 'tx' ? 'rx' : 'tx';
    if (this.nextClick === 'rx' && this.rxMarker && !this.txMarker) this.nextClick = 'tx';
    if (this.nextClick === 'tx' && this.txMarker && !this.rxMarker) this.nextClick = 'rx';

    this.updateLine();
    if (this.onChangedCallback) this.onChangedCallback();
  }

  /** Punto azul + círculo de precisión de la posición GPS. */
  showCurrentLocation(lat, lng, accuracyM) {
    const latlng = L.latLng(lat, lng);
    if (!this.locationMarker) {
      this.locationMarker = L.circleMarker(latlng, {
        radius: 6, color: '#ffffff', weight: 2,
        fillColor: '#2f80ed', fillOpacity: 1
      }).addTo(this.map);
      this.locationMarker.bindTooltip('Tu posición');
    } else {
      this.locationMarker.setLatLng(latlng);
    }

    if (accuracyM > 0) {
      if (!this.accuracyCircle) {
        this.accuracyCircle = L.circle(latlng, {
          radius: accuracyM, color: '#2f80ed', weight: 1,
          fillColor: '#2f80ed', fillOpacity: 0.12
        }).addTo(this.map);
      } else {
        this.accuracyCircle.setLatLng(latlng).setRadius(accuracyM);
      }
    }
  }

  centerOn(lat, lng, zoom) {
    this.map.setView([lat, lng], zoom || Math.max(this.map.getZoom(), 14));
  }

  updateLine() {
    this.polyline.setLatLngs(this.hasBoth()
      ? [this.txMarker.getLatLng(), this.rxMarker.getLatLng()]
      : []);
  }

  fitBounds() {
    if (!this.hasBoth()) return;
    const bounds = L.latLngBounds(this.txMarker.getLatLng(), this.rxMarker.getLatLng());
    this.map.fitBounds(bounds, { padding: [50, 50] });
  }
}

/**
 * 4. ElevationService Class
 * Resolución adaptativa a la distancia y sin inventar terreno: si la API falla,
 * devuelve ok:false y el análisis de terreno se omite (antes se rellenaba con
 * 0 m, lo que dibujaba un trayecto perfectamente despejado que no existe).
 */
class ElevationService {
  constructor() {
    this.timer = null;
    this.pendingResolve = null;
    this.cache = new Map();
    this.seq = 0;
  }

  /** ~1 muestra cada 125 m, acotado a [64, 400] puntos. */
  static pointCount(distKm) {
    return Math.min(400, Math.max(64, Math.round(distKm * 8)));
  }

  /**
   * Devuelve { ok, points, error } o `null` si la petición quedó obsoleta
   * porque llegó otra más nueva (el llamador debe descartarla).
   */
  fetchProfile(txLatLng, rxLatLng) {
    const myId = ++this.seq;
    return new Promise((resolve) => {
      clearTimeout(this.timer);
      // Resuelve la petición anterior que todavía no arrancó, para no dejar
      // promesas colgadas para siempre.
      if (this.pendingResolve) this.pendingResolve(null);
      this.pendingResolve = resolve;

      this.timer = setTimeout(async () => {
        this.pendingResolve = null;
        const result = await this._load(txLatLng, rxLatLng);
        resolve(myId === this.seq ? result : null);
      }, 400);
    });
  }

  async _load(txLatLng, rxLatLng) {
    const distKm = txLatLng.distanceTo(rxLatLng) / 1000;
    const numPoints = ElevationService.pointCount(distKm);
    const cacheKey = `${txLatLng.lat.toFixed(4)},${txLatLng.lng.toFixed(4)}-${rxLatLng.lat.toFixed(4)},${rxLatLng.lng.toFixed(4)}-${numPoints}`;
    if (this.cache.has(cacheKey)) return this.cache.get(cacheKey);

    const lats = [], lons = [];
    for (let i = 0; i < numPoints; i++) {
      const t = i / (numPoints - 1);
      lats.push(txLatLng.lat + t * (rxLatLng.lat - txLatLng.lat));
      lons.push(txLatLng.lng + t * (rxLatLng.lng - txLatLng.lng));
    }

    try {
      // La API acepta hasta 100 coordenadas por request.
      const CHUNK = 100;
      const elevations = [];
      for (let start = 0; start < numPoints; start += CHUNK) {
        const la = lats.slice(start, start + CHUNK).join(',');
        const lo = lons.slice(start, start + CHUNK).join(',');
        const res = await fetch(`https://api.open-meteo.com/v1/elevation?latitude=${la}&longitude=${lo}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (!data.elevation) throw new Error('respuesta sin elevaciones');
        elevations.push(...data.elevation);
      }
      if (elevations.length !== numPoints) throw new Error('cantidad de puntos inesperada');

      const points = elevations.map((ele, idx) => {
        const pointLatLng = L.latLng(lats[idx], lons[idx]);
        return {
          lat: lats[idx],
          lon: lons[idx],
          elevation: (ele === null || ele === undefined) ? 0 : ele,
          distance: txLatLng.distanceTo(pointLatLng) / 1000
        };
      });

      const result = { ok: true, points, error: null };
      this.cache.set(cacheKey, result);
      return result;

    } catch (err) {
      console.warn('Elevation fetch failed:', err);
      return { ok: false, points: null, error: err.message || String(err) };
    }
  }
}

/**
 * 4b. Geometría del trayecto
 * Perfil efectivo = terreno + abultamiento terrestre + clutter.
 * Es el mismo objeto que consumen la difracción y el gráfico, así que lo que
 * se ve dibujado es exactamente lo que se calcula.
 */
function buildGeometry(rawPoints, txHeight, rxHeight, pathClutterHeight) {
  const n = rawPoints.length;
  if (n < 2) return null;
  const totalKm = rawPoints[n - 1].distance;
  if (!(totalKm > 0)) return null;

  const pts = rawPoints.map((p, i) => {
    const d1 = p.distance;
    const curv = LinkCalculator.earthCurvature(d1, totalKm - d1);
    const isEnd = (i === 0 || i === n - 1);
    const clutter = isEnd ? 0 : pathClutterHeight;  // los extremos los cubre el clutter de sitio
    const ground = p.elevation + curv;
    return {
      distKm: d1,
      dm: d1 * 1000,
      terrain: p.elevation,
      ground,
      clutter,
      h: ground + clutter
    };
  });

  // Mediana de 3 sobre la superficie efectiva para las MÉTRICAS: elimina picos
  // espurios aislados del DEM sin achatar las lomas reales (a diferencia de una
  // media móvil, que borraba justamente los filos que cortan el enlace).
  for (let i = 0; i < pts.length; i++) {
    if (i === 0 || i === pts.length - 1) { pts[i].hMetric = pts[i].h; continue; }
    const a = [pts[i - 1].h, pts[i].h, pts[i + 1].h].sort((x, y) => x - y);
    pts[i].hMetric = a[1];
  }

  return {
    pts,
    totalKm,
    hTx: pts[0].ground + txHeight,
    hRx: pts[n - 1].ground + rxHeight
  };
}

/**
 * 5. ProfileChart Class (canvas HiDPI)
 */
class ProfileChart {
  constructor(canvasId, tooltipId) {
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas.getContext('2d');
    this.tooltip = document.getElementById(tooltipId);

    this.geo = null;
    this.diff = null;
    this.freqGHz = 0.915;
    this.renderedPoints = [];

    // dimensiones en px CSS
    this.w = 0;
    this.h = 0;

    window.addEventListener('resize', () => this.resize());
    this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
    this.canvas.addEventListener('mouseleave', () => { if (this.tooltip) this.tooltip.style.display = 'none'; });
  }

  // Ajusta el buffer al tamaño CSS × devicePixelRatio para nitidez.
  syncSize() {
    const rect = this.canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    this.w = rect.width || 800;
    this.h = rect.height || 360;
    this.canvas.width = Math.round(this.w * dpr);
    this.canvas.height = Math.round(this.h * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  resize() {
    if (!this.canvas) return;
    this.syncSize();
    if (this.geo) this.render(this.geo, this.diff, this.freqGHz);
  }

  clear(message) {
    this.syncSize();
    this.ctx.clearRect(0, 0, this.w, this.h);
    this.geo = null;
    this.renderedPoints = [];
    if (message) {
      this.ctx.fillStyle = '#8a99a8';
      this.ctx.font = '14px Inter, sans-serif';
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      this.ctx.fillText(message, this.w / 2, this.h / 2);
    }
  }

  render(geo, diff, freqGHz) {
    this.geo = geo;
    this.diff = diff;
    this.freqGHz = freqGHz;

    this.syncSize();

    const cw = this.w;
    const ch = this.h;
    const ctx = this.ctx;

    ctx.clearRect(0, 0, cw, ch);

    if (!geo || geo.pts.length === 0) {
      return { minClearancePercent: 100, hasObstruction: false };
    }

    const pts = geo.pts;
    const nPts = pts.length;
    const totalDist = geo.totalKm;

    const padding = { left: 60, bottom: 40, top: 30, right: 20 };
    const chartW = cw - padding.left - padding.right;
    const chartH = ch - padding.top - padding.bottom;

    let minElev = Infinity;
    let maxElev = -Infinity;
    for (const p of pts) {
      minElev = Math.min(minElev, p.ground);
      maxElev = Math.max(maxElev, p.h);
    }
    maxElev = Math.max(maxElev, geo.hTx, geo.hRx);

    const elevRange = Math.max(10, maxElev - minElev);
    const yMin = minElev - elevRange * 0.1;
    const yMax = maxElev + elevRange * 0.2;
    const yRange = yMax - yMin;

    const getX = (dist) => padding.left + (totalDist > 0 ? (dist / totalDist) * chartW : 0);
    const getY = (elev) => padding.top + chartH - ((elev - yMin) / yRange) * chartH;

    // Grid
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 4]);
    ctx.beginPath();
    for (let i = 0; i <= 5; i++) {
      const y = padding.top + (i / 5) * chartH;
      ctx.moveTo(padding.left, y);
      ctx.lineTo(cw - padding.right, y);
      const x = padding.left + (i / 5) * chartW;
      ctx.moveTo(x, padding.top);
      ctx.lineTo(x, ch - padding.bottom);
    }
    ctx.stroke();
    ctx.setLineDash([]);

    // Y labels
    ctx.fillStyle = '#8a99a8';
    ctx.font = '12px Inter, sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    for (let i = 0; i <= 5; i++) {
      const elev = yMax - (i / 5) * yRange;
      ctx.fillText(Math.round(elev) + ' m', padding.left - 10, padding.top + (i / 5) * chartH);
    }

    // X labels
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    for (let i = 0; i <= 5; i++) {
      const dist = (i / 5) * totalDist;
      ctx.fillText(dist.toFixed(1) + ' km', padding.left + (i / 5) * chartW, ch - padding.bottom + 10);
    }

    // Clutter (vegetación / edificación) sobre el terreno
    if (pts.some(p => p.clutter > 0)) {
      ctx.beginPath();
      ctx.moveTo(getX(pts[0].distKm), getY(pts[0].ground));
      for (const p of pts) ctx.lineTo(getX(p.distKm), getY(p.h));
      for (let i = nPts - 1; i >= 0; i--) ctx.lineTo(getX(pts[i].distKm), getY(pts[i].ground));
      ctx.closePath();
      ctx.fillStyle = 'rgba(122, 165, 90, 0.38)';
      ctx.fill();
    }

    // Terreno
    ctx.beginPath();
    ctx.moveTo(getX(pts[0].distKm), ch - padding.bottom);
    for (const p of pts) ctx.lineTo(getX(p.distKm), getY(p.ground));
    ctx.lineTo(getX(pts[nPts - 1].distKm), ch - padding.bottom);
    ctx.closePath();

    const grad = ctx.createLinearGradient(0, padding.top, 0, ch - padding.bottom);
    grad.addColorStop(0, '#4a6741');
    grad.addColorStop(1, 'rgba(74, 103, 65, 0.1)');
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.strokeStyle = '#4a6741';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Fresnel al 60% + métricas de despeje
    let hasObstruction = false;
    let minClearancePercent = Infinity;
    const topPath = [], bottomPath = [];
    this.renderedPoints = [];

    for (let i = 0; i < nPts; i++) {
      const p = pts[i];
      const t = p.distKm / totalDist;
      const losElev = geo.hTx + t * (geo.hRx - geo.hTx);
      const r = LinkCalculator.fresnelRadius(p.distKm, totalDist - p.distKm, totalDist, freqGHz);
      const r60 = r * 0.6;

      topPath.push({ x: getX(p.distKm), y: getY(losElev + r60) });
      bottomPath.push({ x: getX(p.distKm), y: getY(losElev - r60) });

      const clearance = losElev - p.hMetric;
      const clearancePercent = r > 0 ? (clearance / r) * 100 : 100;

      if (i > 0 && i < nPts - 1) {
        if (clearancePercent < minClearancePercent) minClearancePercent = clearancePercent;
        if (p.hMetric > losElev - r60) hasObstruction = true;
      }

      this.renderedPoints.push({
        x: getX(p.distKm), y: getY(p.h),
        dist: p.distKm, elev: p.terrain, clutter: p.clutter,
        los: losElev, r, clearancePercent
      });
    }
    if (!isFinite(minClearancePercent)) minClearancePercent = 100;

    ctx.beginPath();
    ctx.moveTo(topPath[0].x, topPath[0].y);
    for (let i = 1; i < topPath.length; i++) ctx.lineTo(topPath[i].x, topPath[i].y);
    for (let i = bottomPath.length - 1; i >= 0; i--) ctx.lineTo(bottomPath[i].x, bottomPath[i].y);
    ctx.closePath();
    ctx.fillStyle = 'rgba(0, 180, 216, 0.3)';
    ctx.fill();
    ctx.strokeStyle = '#00b4d8';
    ctx.lineWidth = 1;
    ctx.stroke();

    // LOS
    ctx.beginPath();
    ctx.moveTo(getX(0), getY(geo.hTx));
    ctx.lineTo(getX(totalDist), getY(geo.hRx));
    ctx.strokeStyle = '#00e5a0';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    ctx.stroke();
    ctx.setLineDash([]);

    // Torres
    const drawTower = (x, yBase, yTop, color) => {
      ctx.beginPath();
      ctx.moveTo(x, yBase);
      ctx.lineTo(x, yTop);
      ctx.strokeStyle = color;
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(x, yTop, 4, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
    };

    drawTower(getX(0), getY(pts[0].ground), getY(geo.hTx), '#ff4757');
    drawTower(getX(totalDist), getY(pts[nPts - 1].ground), getY(geo.hRx), '#00b4d8');

    // Marcas de obstrucción (mismo criterio que la métrica)
    ctx.fillStyle = '#ff4757';
    for (let i = 1; i < nPts - 1; i++) {
      const rp = this.renderedPoints[i];
      if (rp.clearancePercent < 60) {
        ctx.beginPath();
        ctx.arc(rp.x, rp.y, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Obstáculo dominante de la difracción (filo principal de Deygout)
    if (diff && diff.edge) {
      const p = pts[diff.edge.i];
      const x = getX(p.distKm);
      const y = getY(p.h);
      ctx.beginPath();
      ctx.arc(x, y, 6, 0, Math.PI * 2);
      ctx.strokeStyle = '#ffa502';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x, padding.top + 14);
      ctx.strokeStyle = 'rgba(255, 165, 2, 0.5)';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = '#ffa502';
      ctx.font = '11px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(`−${diff.loss.toFixed(1)} dB`, x, padding.top);
    }

    return { minClearancePercent, hasObstruction };
  }

  handleMouseMove(e) {
    if (!this.renderedPoints || this.renderedPoints.length === 0 || !this.tooltip) return;

    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;

    let closest = this.renderedPoints[0];
    let minD = Infinity;
    for (const p of this.renderedPoints) {
      const d = Math.abs(p.x - x);
      if (d < minD) { minD = d; closest = p; }
    }

    if (minD < 30) {
      this.tooltip.style.display = 'block';
      this.tooltip.style.left = (e.clientX + 15) + 'px';
      this.tooltip.style.top = (e.clientY + 15) + 'px';
      this.tooltip.innerHTML = `
        <strong>Dist:</strong> ${closest.dist.toFixed(2)} km<br>
        <strong>Terreno:</strong> ${Math.round(closest.elev)} m${closest.clutter > 0 ? ` <span style="opacity:.7">(+${closest.clutter} m clutter)</span>` : ''}<br>
        <strong>LOS:</strong> ${Math.round(closest.los)} m<br>
        <strong>Radio Fresnel:</strong> ${closest.r.toFixed(1)} m<br>
        <strong>Despeje:</strong> ${closest.clearancePercent.toFixed(1)}%
      `;
    } else {
      this.tooltip.style.display = 'none';
    }
  }
}

/**
 * 6. UIController & Init
 */
document.addEventListener('DOMContentLoaded', () => {
  const $ = (id) => document.getElementById(id);
  const els = {
    txLat: $('txLat'), txLon: $('txLon'), rxLat: $('rxLat'), rxLon: $('rxLon'),
    btnUpdateMap: $('btnUpdateMap'), mapDistanceValue: $('mapDistanceValue'),
    btnMyLocation: $('btnMyLocation'), geoStatus: $('geoStatus'),

    txPower: $('txPower'), txPowerVal: $('txPowerVal'),
    txAntennaSelect: $('txAntennaSelect'), txGain: $('txGain'),
    txCableLoss: $('txCableLoss'), txCableLossVal: $('txCableLossVal'),
    txHeight: $('txHeight'), txHeightVal: $('txHeightVal'),
    txSiteClutter: $('txSiteClutter'),

    rxAntennaSelect: $('rxAntennaSelect'), rxGain: $('rxGain'),
    rxCableLoss: $('rxCableLoss'), rxCableLossVal: $('rxCableLossVal'),
    rxHeight: $('rxHeight'), rxHeightVal: $('rxHeightVal'),
    rxSiteClutter: $('rxSiteClutter'),

    pathClutter: $('pathClutter'), groundRefl: $('groundRefl'), reflInfo: $('reflInfo'),
    noiseExcess: $('noiseExcess'), noiseExcessVal: $('noiseExcessVal'),

    bandSelect: $('bandSelect'),
    sfSelector: $('sfSelector'), bwSelector: $('bwSelector'),
    codingRate: $('codingRate'),
    extraMargin: $('extraMargin'), extraMarginVal: $('extraMarginVal'),

    payload: $('payload'), payloadVal: $('payloadVal'),
    txInterval: $('txInterval'), txIntervalVal: $('txIntervalVal'),
    preamble: $('preamble'), preambleVal: $('preambleVal'),

    profileStatus: $('profileStatus'),

    resPathLoss: $('resPathLoss'), resLossBreakdown: $('resLossBreakdown'),
    resFSPL: $('resFSPL'), resEIRP: $('resEIRP'), resRxPower: $('resRxPower'),
    resMargin: $('resMargin'), resMarginDesc: $('resMarginDesc'), marginBar: $('marginBar'),
    resSensitivity: $('resSensitivity'), resSensDesc: $('resSensDesc'),
    resDataRate: $('resDataRate'),
    resRange: $('resRange'), resRangeDesc: $('resRangeDesc'),
    resMaxDist: $('resMaxDist'),
    resFresnel: $('resFresnel'), resDiffraction: $('resDiffraction'), resDiffDesc: $('resDiffDesc'),
    resAvailability: $('resAvailability'), resAvailDesc: $('resAvailDesc'),
    resToA: $('resToA'), resDuty: $('resDuty'), dutyLimitDesc: $('dutyLimitDesc'),

    lightRed: $('lightRed'), lightYellow: $('lightYellow'), lightGreen: $('lightGreen'),
    evalTitle: $('evalTitle'), evalDesc: $('evalDesc'),

    calibDist: $('calibDist'), calibRssi: $('calibRssi'), calibSnr: $('calibSnr'),
    calibNote: $('calibNote'), calibAdd: $('calibAdd'),
    calibUseMap: $('calibUseMap'), calibTableBody: $('calibTableBody'),
    calibEmpty: $('calibEmpty'), calibSummary: $('calibSummary'),
    calibUse: $('calibUse'), calibClear: $('calibClear'), calibBadge: $('calibBadge'),
    calibRestore: $('calibRestore'),

    badgeFreq: document.querySelector('.badge-freq'),

    btnToggleFormulas: $('btnToggleFormulas'), formulasContent: $('formulasContent')
  };

  // ── Antenas ──
  const populateAntennas = (selectEl, defaultIdx) => {
    const omniGroup = selectEl.querySelector('optgroup[label*="Omnidireccionales"]');
    const dirGroup = selectEl.querySelector('optgroup[label*="Direccionales"]');
    const customGroup = selectEl.querySelector('optgroup[label*="Personalizada"]');

    ANTENNA_PRESETS.forEach((ant, idx) => {
      const opt = document.createElement('option');
      opt.value = idx;
      opt.textContent = `${ant.name} (${ant.gain} dBi)`;
      if (ant.type === 'omni' && omniGroup) omniGroup.appendChild(opt);
      else if (ant.type === 'dir' && dirGroup) dirGroup.appendChild(opt);
      else if (customGroup) customGroup.appendChild(opt);
    });
    selectEl.value = defaultIdx;
  };

  const populateList = (selectEl, list, labelFn, defaultIdx) => {
    if (!selectEl) return;
    list.forEach((item, idx) => {
      const opt = document.createElement('option');
      opt.value = idx;
      opt.textContent = labelFn(item);
      selectEl.appendChild(opt);
    });
    selectEl.value = defaultIdx;
  };

  if (els.txAntennaSelect) populateAntennas(els.txAntennaSelect, 0);
  if (els.rxAntennaSelect) populateAntennas(els.rxAntennaSelect, 6);

  if (els.txGain) { els.txGain.value = ANTENNA_PRESETS[0].gain; els.txGain.disabled = true; }
  if (els.rxGain) { els.rxGain.value = ANTENNA_PRESETS[6].gain; els.rxGain.disabled = true; }

  populateList(els.txSiteClutter, SITE_CLUTTER, (c) => `${c.name} (+${c.loss} dB)`, 0);
  populateList(els.rxSiteClutter, SITE_CLUTTER, (c) => `${c.name} (+${c.loss} dB)`, 0);
  populateList(els.pathClutter, PATH_CLUTTER, (c) => c.height ? `${c.name} · ${c.height} m` : c.name, 0);

  const handleAntennaChange = (selectEl, gainInput) => {
    const preset = ANTENNA_PRESETS[selectEl.value];
    if (preset.type === 'custom') {
      gainInput.disabled = false;
    } else {
      gainInput.disabled = true;
      gainInput.value = preset.gain;
    }
    recalculate();
  };

  if (els.txAntennaSelect) els.txAntennaSelect.addEventListener('change', () => handleAntennaChange(els.txAntennaSelect, els.txGain));
  if (els.rxAntennaSelect) els.rxAntennaSelect.addEventListener('change', () => handleAntennaChange(els.rxAntennaSelect, els.rxGain));

  // ── Sliders ──
  const syncSlider = (slider, span) => {
    if (slider && span) {
      slider.addEventListener('input', () => {
        span.textContent = slider.value;
        recalculate();
      });
    }
  };

  syncSlider(els.txPower, els.txPowerVal);
  syncSlider(els.txCableLoss, els.txCableLossVal);
  syncSlider(els.txHeight, els.txHeightVal);
  syncSlider(els.rxCableLoss, els.rxCableLossVal);
  syncSlider(els.rxHeight, els.rxHeightVal);
  syncSlider(els.extraMargin, els.extraMarginVal);
  syncSlider(els.noiseExcess, els.noiseExcessVal);
  syncSlider(els.payload, els.payloadVal);
  syncSlider(els.txInterval, els.txIntervalVal);
  syncSlider(els.preamble, els.preambleVal);

  if (els.txGain) els.txGain.addEventListener('input', () => recalculate());
  if (els.rxGain) els.rxGain.addEventListener('input', () => recalculate());
  [els.codingRate, els.txSiteClutter, els.rxSiteClutter, els.pathClutter, els.groundRefl]
    .forEach(el => el && el.addEventListener('change', () => recalculate()));

  // ── Banda / frecuencia ──
  let currentFreqMHz = 915;
  if (els.bandSelect) {
    els.bandSelect.addEventListener('change', () => {
      currentFreqMHz = parseInt(els.bandSelect.value, 10);
      if (els.badgeFreq) els.badgeFreq.textContent = `${currentFreqMHz} MHz`;
      recalculate();
    });
  }

  // ── SF / BW ──
  let currentSF = 10;
  let currentBW = 125000;

  if (els.sfSelector) {
    els.sfSelector.addEventListener('click', (e) => {
      if (e.target.tagName === 'BUTTON') {
        Array.from(els.sfSelector.children).forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        currentSF = parseInt(e.target.dataset.sf, 10);
        recalculate();
      }
    });
  }

  if (els.bwSelector) {
    els.bwSelector.addEventListener('click', (e) => {
      if (e.target.tagName === 'BUTTON') {
        Array.from(els.bwSelector.children).forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        currentBW = parseInt(e.target.dataset.bw, 10);
        recalculate();
      }
    });
  }

  if (els.btnToggleFormulas) {
    els.btnToggleFormulas.addEventListener('click', () => {
      els.formulasContent.classList.toggle('expanded');
      const expanded = els.formulasContent.classList.contains('expanded');
      els.btnToggleFormulas.setAttribute('aria-expanded', expanded);
      els.btnToggleFormulas.textContent = expanded ? '▲' : '▼';
    });
  }

  const mapManager = new MapManager('map');
  const eleService = new ElevationService();
  const profileChart = new ProfileChart('profileChart', 'chartTooltip');

  let rawProfile = null;    // último perfil válido de la API
  let profileError = null;  // motivo del último fallo

  /** Refleja en el botón de GPS cuál extremo se colocará al presionarlo. */
  const updateLocationButton = () => {
    if (!els.btnMyLocation) return;
    const next = mapManager.pending() === 'tx' ? 'Tx' : 'Rx';
    els.btnMyLocation.innerHTML = `📍 Mi ubicación <span class="btn-hint">→ ${next}</span>`;
    els.btnMyLocation.title = `Coloca el marcador ${next} en tu posición actual (GPS)`;
  };

  mapManager.onMarkersChanged(() => {
    // Sólo se reflejan los marcadores que existen: si un extremo todavía no
    // está colocado hay que respetar lo que el usuario esté tipeando, o
    // colocar Tx borraría las coordenadas de Rx recién escritas.
    const tx = mapManager.getTxLatLng();
    const rx = mapManager.getRxLatLng();
    if (tx) {
      if (els.txLat) els.txLat.value = tx.lat.toFixed(4);
      if (els.txLon) els.txLon.value = tx.lng.toFixed(4);
    }
    if (rx) {
      if (els.rxLat) els.rxLat.value = rx.lat.toFixed(4);
      if (els.rxLon) els.rxLon.value = rx.lng.toFixed(4);
    }
    if (els.mapDistanceValue) {
      els.mapDistanceValue.textContent = mapManager.hasBoth()
        ? mapManager.getDistance().toFixed(2) : '—';
    }
    updateLocationButton();
    recalculate();
    if (mapManager.hasBoth() && mapManager.getDistance() > 0) updateProfile();
  });

  if (els.btnUpdateMap) {
    els.btnUpdateMap.addEventListener('click', () => {
      mapManager.setMarkerPosition('tx', parseFloat(els.txLat.value), parseFloat(els.txLon.value));
      mapManager.setMarkerPosition('rx', parseFloat(els.rxLat.value), parseFloat(els.rxLon.value));
      mapManager.fitBounds();
    });
  }

  /* ── Geolocalización ── */

  const setGeoStatus = (text, state) => {
    if (!els.geoStatus) return;
    els.geoStatus.textContent = text || '';
    els.geoStatus.classList.toggle('geo-error', state === 'error');
  };

  /**
   * Los navegadores sólo dan geolocalización en contexto seguro. Si abrís el
   * index.html haciendo doble clic (file://) el GPS queda bloqueado siempre,
   * y el mensaje genérico de "permiso denegado" despista.
   */
  const isInsecureContext = () => {
    try {
      if (typeof window.isSecureContext === 'boolean') return !window.isSecureContext;
      return window.location && window.location.protocol === 'file:';
    } catch (e) { return false; }
  };

  const geoErrorText = (err) => {
    let base;
    if (!err) base = 'no se pudo obtener la ubicación';
    else if (err.code === 1) base = 'permiso de ubicación denegado';
    else if (err.code === 2) base = 'posición no disponible';
    else if (err.code === 3) base = 'tiempo de espera agotado';
    else base = err.message || 'error de geolocalización';
    if (isInsecureContext()) {
      base += ' — el navegador bloquea el GPS en páginas abiertas como archivo (file://); servila desde http://localhost';
    }
    return base;
  };

  /** Pide la posición actual. `place` indica si además coloca un marcador. */
  const locate = (place) => {
    if (!navigator.geolocation) {
      setGeoStatus('Este navegador no soporta geolocalización', 'error');
      return;
    }
    if (els.btnMyLocation) els.btnMyLocation.disabled = true;
    setGeoStatus('Obteniendo tu posición…');

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (els.btnMyLocation) els.btnMyLocation.disabled = false;
        const { latitude, longitude, accuracy } = pos.coords;
        mapManager.showCurrentLocation(latitude, longitude, accuracy);
        mapManager.centerOn(latitude, longitude);
        const acc = accuracy >= 1000 ? `${(accuracy / 1000).toFixed(1)} km` : `${Math.round(accuracy)} m`;
        if (place) {
          const which = mapManager.pending();
          mapManager.setMarkerPosition(which, latitude, longitude);
          setGeoStatus(`${which === 'tx' ? 'Tx' : 'Rx'} colocado en tu posición (±${acc})`);
        } else {
          setGeoStatus(`Posición actual (±${acc})`);
        }
      },
      (err) => {
        if (els.btnMyLocation) els.btnMyLocation.disabled = false;
        setGeoStatus(geoErrorText(err) + ' — colocá los marcadores tocando el mapa', 'error');
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 }
    );
  };

  if (els.btnMyLocation) els.btnMyLocation.addEventListener('click', () => locate(true));

  const setStatus = (text, state) => {
    if (!els.profileStatus) return;
    els.profileStatus.classList.toggle('loading', state === 'loading');
    els.profileStatus.classList.toggle('warn', state === 'warn');
    const t = els.profileStatus.querySelector('.status-text');
    if (t) t.textContent = text;
  };

  async function updateProfile() {
    setStatus('Obteniendo perfil de terreno...', 'loading');
    const result = await eleService.fetchProfile(mapManager.getTxLatLng(), mapManager.getRxLatLng());
    if (result === null) return; // petición superada por otra más reciente

    if (result.ok) {
      rawProfile = result.points;
      profileError = null;
      setStatus(`Perfil actualizado · ${result.points.length} muestras`, 'ok');
    } else {
      rawProfile = null;
      profileError = result.error;
      setStatus(`API de elevación no disponible (${result.error}) — sin análisis de terreno`, 'warn');
    }
    requestAnimationFrame(() => recalculate());
  }

  // ── Helpers ──
  /** Lectura numérica tolerante: un campo vacío o inválido no rompe el cálculo. */
  const num = (el, fallback) => (el && isFinite(parseFloat(el.value))) ? parseFloat(el.value) : fallback;

  const setValClass = (el, level) => {
    if (!el) return;
    el.classList.remove('val-good', 'val-warn', 'val-bad');
    if (level) el.classList.add(`val-${level}`);
  };

  // ── Calibración ──
  Calibration.load();
  if (els.calibUse) els.calibUse.checked = Calibration.enabled;

  const linkConstant = () =>
    LinkCalculator.eirp(num(els.txPower, 20), num(els.txGain, 2), num(els.txCableLoss, 0.5))
    + num(els.rxGain, 5.8) - num(els.rxCableLoss, 0.5);

  const renderCalibration = () => {
    if (!els.calibTableBody) return;
    els.calibTableBody.innerHTML = '';
    Calibration.points.forEach((p, idx) => {
      const sig = (p.sig !== undefined && p.sig !== null) ? p.sig : p.rssi;
      const corrected = Math.abs(sig - p.rssi) > 0.05;
      const esc = (s) => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
      const tr = document.createElement('tr');
      tr.innerHTML =
        `<td>${p.d.toFixed(2)}</td>` +
        `<td>${p.rssi.toFixed(0)}</td>` +
        `<td>${(p.snr === null || p.snr === undefined) ? '—' : p.snr.toFixed(1)}</td>` +
        `<td${corrected ? ' class="calib-corrected" title="RSSI + SNR: con SNR negativo el RSSI está dominado por el ruido"' : ''}>${sig.toFixed(1)}</td>` +
        `<td>${p.L.toFixed(1)}</td>` +
        `<td class="calib-note-cell">${esc(p.note || '')}</td>` +
        `<td><button class="calib-del" data-idx="${idx}" title="Eliminar medición">✕</button></td>`;
      els.calibTableBody.appendChild(tr);
    });

    if (els.calibEmpty) els.calibEmpty.style.display = Calibration.points.length ? 'none' : 'block';

    const fit = Calibration.fit;
    if (els.calibSummary) {
      if (!fit) {
        els.calibSummary.innerHTML =
          'Sin mediciones cargadas. Con <strong>2 o más puntos a distancias distintas</strong> se ajusta el exponente de propagación real de tu terreno.';
      } else {
        const rmse = fit.rmse === null ? '—' : `${fit.rmse.toFixed(1)} dB`;
        els.calibSummary.innerHTML =
          `<code>L = ${fit.A.toFixed(1)} + ${(10 * fit.n).toFixed(1)}·log₁₀(d<sub>km</sub>)</code><br>` +
          `Exponente <strong>n = ${fit.n.toFixed(2)}</strong>${fit.assumedN ? ' <em>(asumido, faltan datos)</em>' : ''} · ` +
          `error RMS ${rmse} · ${fit.count} ${fit.count > 1 ? 'mediciones' : 'medición'}` +
          (fit.rmse !== null && fit.rmse > 1 ? ` · σ de sombra ${fit.rmse.toFixed(1)} dB` : '');
      }
    }
    if (els.calibBadge) els.calibBadge.style.display = Calibration.isUsable() ? 'inline-flex' : 'none';
  };

  if (els.calibAdd) {
    els.calibAdd.addEventListener('click', () => {
      const d = parseFloat(els.calibDist.value);
      const rssi = parseFloat(els.calibRssi.value);
      const snr = parseFloat(els.calibSnr ? els.calibSnr.value : '');
      if (!(d > 0) || !isFinite(rssi)) {
        alert('Cargá una distancia en km (> 0) y un RSSI en dBm (por ejemplo −112).');
        return;
      }
      Calibration.add(d, rssi, snr, linkConstant(), els.calibNote ? els.calibNote.value.trim() : '');
      els.calibDist.value = '';
      els.calibRssi.value = '';
      if (els.calibSnr) els.calibSnr.value = '';
      if (els.calibNote) els.calibNote.value = '';
      renderCalibration();
      recalculate();
    });
  }

  if (els.calibUseMap) {
    els.calibUseMap.addEventListener('click', () => {
      const d = mapManager.getDistance();
      if (!(d > 0)) {
        alert('Todavía no hay un enlace en el mapa: colocá los dos extremos primero.');
        return;
      }
      els.calibDist.value = d.toFixed(2);
      if (els.calibRssi) els.calibRssi.focus();
    });
  }

  if (els.calibTableBody) {
    els.calibTableBody.addEventListener('click', (e) => {
      const btn = e.target.closest('.calib-del');
      if (!btn) return;
      Calibration.remove(parseInt(btn.dataset.idx, 10));
      renderCalibration();
      recalculate();
    });
  }

  if (els.calibUse) {
    els.calibUse.addEventListener('change', () => {
      Calibration.enabled = els.calibUse.checked;
      Calibration.save();
      renderCalibration();
      recalculate();
    });
  }

  if (els.calibClear) {
    els.calibClear.addEventListener('click', () => {
      if (!Calibration.points.length) return;
      if (!confirm('¿Borrar todas las mediciones de calibración?')) return;
      Calibration.clear();
      renderCalibration();
      recalculate();
    });
  }

  if (els.calibRestore) {
    els.calibRestore.addEventListener('click', () => {
      if (Calibration.points.length &&
          !confirm('Esto reemplaza las mediciones actuales por las de la prueba de campo. ¿Continuar?')) return;
      Calibration.seedFieldData();
      renderCalibration();
      recalculate();
    });
  }

  /* ═══════════ Cálculo principal ═══════════ */

  /** Estado vacío: todavía no hay un enlace que calcular. */
  function showEmptyState() {
    const ids = ['resPathLoss', 'resLossBreakdown', 'resFSPL', 'resEIRP', 'resRxPower', 'resMargin',
                 'resMarginDesc', 'resSensitivity', 'resSensDesc', 'resDataRate', 'resRange',
                 'resRangeDesc', 'resMaxDist', 'resFresnel', 'resDiffraction', 'resDiffDesc',
                 'resAvailability', 'resAvailDesc', 'resToA', 'resDuty'];
    for (const id of ids) if (els[id]) els[id].textContent = '—';
    if (els.mapDistanceValue) els.mapDistanceValue.textContent = '—';
    ['resMargin', 'resAvailability', 'resDiffraction', 'resFresnel', 'resDuty']
      .forEach(id => setValClass(els[id], null));
    if (els.marginBar) els.marginBar.style.width = '0%';

    ['lightRed', 'lightYellow', 'lightGreen'].forEach(id => els[id] && els[id].classList.remove('active'));
    if (els.evalTitle) {
      els.evalTitle.textContent = 'Definí el enlace';
      els.evalTitle.style.color = 'var(--text-secondary)';
    }
    const both = mapManager.hasBoth();
    if (els.evalDesc) {
      const pend = mapManager.pending() === 'tx' ? 'transmisor (Tx)' : 'receptor (Rx)';
      els.evalDesc.textContent = both
        ? 'Los dos extremos están en el mismo punto: separalos para calcular el enlace.'
        : (mapManager.getTxLatLng() || mapManager.getRxLatLng())
          ? `Falta el ${pend}: tocá el mapa, cargá las coordenadas o usá "Mi ubicación".`
          : 'Colocá los dos extremos: tocá el mapa, cargá las coordenadas o usá "Mi ubicación".';
    }
    profileChart.clear(both
      ? 'Los dos extremos coinciden'
      : 'Colocá los dos extremos del enlace para ver el perfil');
  }

  function recalculate() {
    if (!mapManager.hasBoth()) { showEmptyState(); return; }

    const d_km = mapManager.getDistance();
    if (!(d_km > 0)) { showEmptyState(); return; }

    const txP = num(els.txPower, 20);
    const txG = num(els.txGain, 2);
    const txL = num(els.txCableLoss, 0.5);
    const txH = num(els.txHeight, 3);

    const rxG = num(els.rxGain, 5.8);
    const rxL = num(els.rxCableLoss, 0.5);
    const rxH = num(els.rxHeight, 10);

    const cr = num(els.codingRate, 5);
    const marginReq = num(els.extraMargin, 10);
    const noiseExcess = num(els.noiseExcess, 3);

    const payload = Math.round(num(els.payload, 20));
    const interval = num(els.txInterval, 60);
    const preamble = Math.round(num(els.preamble, 8));

    const siteTx = SITE_CLUTTER[num(els.txSiteClutter, 0)] || SITE_CLUTTER[0];
    const siteRx = SITE_CLUTTER[num(els.rxSiteClutter, 0)] || SITE_CLUTTER[0];
    const clutterDb = siteTx.loss + siteRx.loss;
    const pathClutterH = (PATH_CLUTTER[num(els.pathClutter, 0)] || PATH_CLUTTER[0]).height;

    const freqGHz = currentFreqMHz / 1000;

    // ── Geometría del terreno ──
    const geo = rawProfile ? buildGeometry(rawProfile, txH, rxH, pathClutterH) : null;
    const roughness = geo ? LinkCalculator.terrainRoughness(geo.pts) : null;
    const reflMode = els.groundRefl ? els.groundRefl.value : 'auto';
    const refl = LinkCalculator.reflectionFactor(reflMode, roughness, pathClutterH);

    if (els.reflInfo) {
      els.reflInfo.textContent = roughness === null
        ? `factor ${refl.toFixed(2)} · sin perfil de terreno`
        : `factor ${refl.toFixed(2)} · rugosidad σ = ${roughness.toFixed(1)} m`;
    }

    // ── Difracción ──
    const diff = geo
      ? LinkCalculator.diffractionLoss(geo, currentFreqMHz)
      : { loss: 0, edge: null, vMax: -99, edges: 0 };

    // ── Pérdidas del trayecto ──
    //
    // La reflexión de suelo (two-ray) y la difracción describen el MISMO
    // obstáculo — el terreno metiéndose en la primera zona de Fresnel — sólo
    // que con dos mecanismos distintos. Sumarlas contaría dos veces lo mismo:
    // sobre terreno llano con antenas bajas ambas darían ~15 dB y el resultado
    // sería el doble de lo real. Se toma la que domine.
    const fspl = LinkCalculator.fspl(d_km, currentFreqMHz);
    const calibrated = Calibration.isUsable();

    let groundExcess, clutterApplied;
    if (calibrated) {
      // El ajuste empírico ya incluye el terreno y el entorno donde se midió.
      groundExcess = Math.max(0, (Calibration.fit.A + 10 * Calibration.fit.n * Math.log10(d_km)) - fspl);
      clutterApplied = 0;
    } else {
      groundExcess = LinkCalculator.basicPathLoss(d_km, txH, rxH, refl, currentFreqMHz) - fspl;
      clutterApplied = clutterDb;
    }

    const excessLoss = Math.max(groundExcess, diff.loss);
    const diffDominates = diff.loss > groundExcess;
    const totalLoss = fspl + excessLoss + clutterApplied;

    // ── Presupuesto de enlace ──
    const eirp = LinkCalculator.eirp(txP, txG, txL);
    const sens = LinkCalculator.sensitivity(currentSF, currentBW, noiseExcess);
    const rxPower = LinkCalculator.rxPower(eirp, rxG, rxL, totalLoss);  // RSSI estimado
    const margin = LinkCalculator.linkMargin(rxPower, sens);
    const dr = LinkCalculator.dataRate(currentSF, currentBW, cr);

    const sigma = Calibration.sigma();
    const avail = LinkCalculator.availability(margin, sigma);

    // El alcance se informa "sobre terreno llano", así que en modo automático
    // debe usar el factor de reflexión de un terreno llano (rugosidad 0), no el
    // del trayecto actual: si no, pararse sobre un cerro inflaba el alcance.
    const reflFlat = LinkCalculator.reflectionFactor(reflMode, 0, pathClutterH);

    const range = LinkCalculator.estimateRange({
      eirp, rxGain: rxG, rxLoss: rxL, sens, reqMargin: marginReq,
      h1: txH, h2: rxH, refl: reflFlat, clutterDb, freqMHz: currentFreqMHz,
      calibrated,
      calA: calibrated ? Calibration.fit.A : 0,
      calN: calibrated ? Calibration.fit.n : 0
    });
    const maxD = LinkCalculator.maxDistance(txP, txG, txL, rxG, rxL, sens, marginReq, currentFreqMHz);
    const breakpoint = LinkCalculator.breakpointKm(txH, rxH, currentFreqMHz);

    // ── Time-on-Air / duty ──
    const toaMs = LinkCalculator.timeOnAir(currentSF, currentBW, cr, payload, preamble);
    const duty = interval > 0 ? (toaMs / (interval * 1000)) * 100 : 0;
    const band = BAND_INFO[currentFreqMHz] || {};

    // ── Gráfico de perfil ──
    let minClearance = null;
    if (geo) {
      const res = profileChart.render(geo, diff, freqGHz);
      minClearance = res.minClearancePercent;
    } else {
      profileChart.clear(profileError
        ? 'Sin datos de terreno — mové los marcadores para reintentar'
        : 'Coloque los marcadores en el mapa');
    }

    // ── Salida ──
    const set = (el, v) => { if (el) el.textContent = v; };

    set(els.resPathLoss, totalLoss.toFixed(1));
    if (els.resLossBreakdown) {
      const parts = [`FSPL ${fspl.toFixed(1)}`];
      if (excessLoss > 0.05) {
        if (diffDominates) parts.push(`difracción +${excessLoss.toFixed(1)}`);
        else if (calibrated) parts.push(`calibrado n=${Calibration.fit.n.toFixed(2)} +${excessLoss.toFixed(1)}`);
        else parts.push(`suelo +${excessLoss.toFixed(1)}`);
      }
      if (clutterApplied > 0) parts.push(`entorno +${clutterApplied.toFixed(0)}`);
      els.resLossBreakdown.textContent = parts.join(' · ') + ' dB';
    }

    set(els.resFSPL, fspl.toFixed(1));
    set(els.resEIRP, eirp.toFixed(1));
    set(els.resRxPower, rxPower.toFixed(1));
    set(els.resSensitivity, sens.toFixed(1));
    set(els.resSensDesc, `SF${currentSF} · ${(currentBW / 1000)} kHz · ruido +${noiseExcess} dB`);
    set(els.resDataRate, (dr / 1000).toFixed(2));
    set(els.resRange, range >= 2000 ? '>2000' : range.toFixed(1));
    set(els.resRangeDesc, calibrated
      ? `modelo calibrado · margen ${marginReq} dB`
      : `terreno llano · quiebre ${breakpoint < 0.01 ? '<0.01' : breakpoint.toFixed(2)} km`);
    set(els.resMaxDist, isFinite(maxD) ? maxD.toFixed(1) : '—');
    set(els.resToA, toaMs.toFixed(1));
    set(els.resDuty, duty.toFixed(2));
    set(els.resAvailability, avail >= 99.95 ? '>99.9' : avail.toFixed(1));
    set(els.resAvailDesc, `σ sombra ${sigma.toFixed(1)} dB${calibrated ? ' (medido)' : ' (estimado)'}`);

    set(els.resDiffraction, geo ? diff.loss.toFixed(1) : '—');
    if (els.resDiffDesc) {
      if (!geo) els.resDiffDesc.textContent = 'sin perfil de terreno';
      else if (!diff.edge) els.resDiffDesc.textContent = '1ra zona de Fresnel despejada';
      else if (!diffDominates) els.resDiffDesc.textContent =
        `menor que la reflexión de suelo (${groundExcess.toFixed(1)} dB): no se suma`;
      else els.resDiffDesc.textContent =
        `${diff.edges} filo${diff.edges > 1 ? 's' : ''} · principal a ${geo.pts[diff.edge.i].distKm.toFixed(1)} km`;
    }

    set(els.resFresnel, minClearance === null ? '—'
      : minClearance > 100 ? '>100'
      : minClearance < -100 ? '<-100'   // obstáculo varios radios de Fresnel por encima de la LOS
      : minClearance.toFixed(1));
    set(els.resMargin, margin.toFixed(1));

    // Duty: límite contextual + estado
    let dutyOver = false;
    if (els.dutyLimitDesc) {
      if (band.dutyLimit != null) {
        dutyOver = duty > band.dutyLimit;
        els.dutyLimitDesc.textContent = `Límite ${band.label}`;
      } else if (band.dwellMs != null) {
        dutyOver = toaMs > band.dwellMs;
        els.dutyLimitDesc.textContent = dutyOver
          ? `⚠ ToA > ${band.dwellMs} ms (dwell)`
          : `Sin duty (dwell ${band.dwellMs} ms)`;
      }
    }
    setValClass(els.resDuty, dutyOver ? 'bad' : 'good');

    const marginOK = margin >= marginReq;   // reserva suficiente
    const marginAlive = margin >= 0;        // enlace en pie

    setValClass(els.resMargin, marginOK ? 'good' : (marginAlive ? 'warn' : 'bad'));
    setValClass(els.resAvailability, avail >= 95 ? 'good' : (avail >= 70 ? 'warn' : 'bad'));
    setValClass(els.resDiffraction, !geo ? null : (diff.loss > 10 ? 'bad' : (diff.loss > 3 ? 'warn' : 'good')));
    setValClass(els.resFresnel, minClearance === null ? null
      : (minClearance >= 60 ? 'good' : (minClearance >= 20 ? 'warn' : 'bad')));

    if (els.resMarginDesc) {
      els.resMarginDesc.textContent = `Prx ${rxPower.toFixed(1)} − Sens ${sens.toFixed(1)} dBm`;
    }

    // ── Barra de margen (referencia = margen requerido) ──
    if (els.marginBar) {
      const denom = Math.max(marginReq * 2, 10);
      const marginPercent = Math.max(2, Math.min(100, (margin / denom) * 100));
      els.marginBar.style.width = marginPercent + '%';
      els.marginBar.style.backgroundColor = marginOK ? 'var(--primary)' : (marginAlive ? 'var(--warning)' : 'var(--error)');
    }

    // ── Evaluación / semáforo ──
    if (els.lightRed) {
      els.lightRed.classList.remove('active');
      els.lightYellow.classList.remove('active');
      els.lightGreen.classList.remove('active');

      const notes = [];
      if (!geo) notes.push('sin datos de terreno (la difracción no está evaluada)');
      if (excessLoss > 0.5) {
        if (diffDominates) notes.push(`${excessLoss.toFixed(1)} dB de difracción por el terreno`);
        else if (calibrated) notes.push(`${excessLoss.toFixed(1)} dB de exceso sobre espacio libre según tus mediciones`);
        else notes.push(`${excessLoss.toFixed(1)} dB por reflexión de suelo`);
      }
      if (clutterApplied > 0) notes.push(`${clutterApplied} dB por el entorno de los sitios`);
      if (calibrated) notes.push(`modelo calibrado con ${Calibration.fit.count} ${Calibration.fit.count > 1 ? 'mediciones' : 'medición'}`);
      const noteStr = notes.length ? ` Incluye ${notes.join(', ')}.` : '';

      if (marginOK) {
        els.lightGreen.classList.add('active');
        els.evalTitle.textContent = 'Enlace Aceptable';
        els.evalTitle.style.color = 'var(--primary)';
        els.evalDesc.textContent =
          `Margen de ${margin.toFixed(1)} dB (≥ ${marginReq} dB requerido), RSSI estimado ${rxPower.toFixed(1)} dBm. ` +
          `Disponibilidad estimada ${avail.toFixed(1)}%.${noteStr}` +
          (dutyOver ? ' Ojo: el duty cycle excede el límite de la banda.' : '');
      } else if (marginAlive) {
        els.lightYellow.classList.add('active');
        els.evalTitle.textContent = 'Enlace Regular';
        els.evalTitle.style.color = 'var(--warning)';
        els.evalDesc.textContent =
          `Enlace en pie pero con poca reserva: ${margin.toFixed(1)} dB (< ${marginReq} dB requerido), ` +
          `disponibilidad ~${avail.toFixed(0)}%. Esperá pérdida de paquetes.${noteStr}` +
          (dutyOver ? ' Además, el duty cycle excede el límite de la banda.' : '');
      } else {
        els.lightRed.classList.add('active');
        els.evalTitle.textContent = 'Enlace Malo';
        els.evalTitle.style.color = 'var(--error)';
        els.evalDesc.textContent =
          `Margen negativo (${margin.toFixed(1)} dB): el RSSI estimado (${rxPower.toFixed(1)} dBm) queda por debajo de ` +
          `la sensibilidad (${sens.toFixed(1)} dBm).${noteStr}`;
      }
    }
  }

  // ── Arranque ──
  if (els.badgeFreq) els.badgeFreq.textContent = `${currentFreqMHz} MHz`;
  renderCalibration();
  updateLocationButton();
  requestAnimationFrame(() => {
    profileChart.syncSize();
    recalculate();        // estado vacío: todavía no hay marcadores
    locate(false);        // centra el mapa en tu posición, sin colocar nada
  });
});
