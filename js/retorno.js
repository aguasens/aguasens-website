/* ═══════════════════════════════════════════
   CALCULADORA DE RETORNO — ¿se paga solo?

   Principio: el productor carga SUS datos, no los nuestros. Todos los defaults
   son conservadores y, si con esos números el sistema no se paga, la
   herramienta lo dice. Un payback que a veces da negativo es lo que hace que
   el resto de los números sean creíbles.

   Lo que NO se cuenta acá, a propósito: AguaSens no acorta la caminata ni mueve
   bebederos. El beneficio sale de dos lados medibles: recorridas que se dejan
   de hacer, y el tiempo que se tarda en detectar una falla de agua.
   ═══════════════════════════════════════════ */

/* Precios de lista (US$) — deben coincidir con la sección Economía del home */
const PRECIOS = { fijo: 659, movil: 729, bomba: 529, molino: 639, gateway: 449 };
const SUSC_BASE = 29.99;   // incluye 1 nodo
const SUSC_EXTRA = 4.99;   // cada nodo adicional

/* Misma tabla que js/bebederos.js y js/caminata.js — no divergir entre herramientas */
const categorias = {
  'ternero':         { nombre: 'Ternero (150 kg)',            pesoProm: 150, gdp: 0.7 },
  'vaquillona':      { nombre: 'Vaquillona (250 kg)',         pesoProm: 250, gdp: 0.6 },
  'novillo_engorde': { nombre: 'Novillo engorde (350 kg)',    pesoProm: 350, gdp: 0.8 },
  'novillo_recria':  { nombre: 'Novillo recría (200 kg)',     pesoProm: 200, gdp: 0.6 },
  'vaca_seca':       { nombre: 'Vaca seca (450 kg)',          pesoProm: 450, gdp: 0 },
  'vaca_cria':       { nombre: 'Vaca cría lactante (450 kg)', pesoProm: 450, gdp: 0 },
  'vaca_lechera':    { nombre: 'Vaca lechera (600 kg)',       pesoProm: 600, gdp: 0 }
};

/* DOM helpers — misma forma que las otras dos calculadoras */
const d = (id) => document.getElementById(id);
const v = (id) => parseFloat(d(id).value) || 0;
const fmt = (n, dec = 0) => new Intl.NumberFormat('es-AR', { maximumFractionDigits: dec, minimumFractionDigits: dec }).format(n);
const money = (n) => 'US$ ' + fmt(Math.round(n));

function calculate() {
  /* ── Entradas ────────────────────────────────────────────────────────── */
  const nAguadas  = Math.max(1, v('in_aguadas'));
  const recSem    = Math.max(0.25, v('in_recorridas_sem'));
  const km        = v('in_km');
  const costoKm   = v('in_costo_km');
  const horas     = v('in_horas');
  const costoHora = v('in_costo_hora');
  const pctEvit   = Math.min(100, Math.max(0, v('in_pct_evitadas')));

  const eventos   = v('in_eventos');
  const animAfect = v('in_animales_afectados');
  const cat       = categorias[d('in_categoria').value];
  const muertos   = v('in_muertos');
  const reparac   = v('in_reparaciones');
  const precioKg  = v('in_precio');

  const nFijo   = v('in_n_fijo');
  const nMovil  = v('in_n_movil');
  const nBomba  = v('in_n_bomba');
  const nMolino = v('in_n_molino');
  const nGw     = v('in_gateway');
  const nNodos  = nFijo + nMovil + nBomba + nMolino;

  const vidaUtil    = Math.max(1, v('in_vida_util'));
  const costoBat    = v('in_costo_bateria');
  const vidaBat     = Math.max(1, v('in_vida_bateria'));
  const instalacion = v('in_instalacion');

  /* ── 1. Recorridas que se dejan de hacer ─────────────────────────────── */
  const recAnio           = recSem * 52;
  const costoPorRecorrida = km * costoKm + horas * costoHora;
  const costoRecorridas   = recAnio * costoPorRecorrida;
  const ahorroRecorridas  = costoRecorridas * pctEvit / 100;

  /* ── 2. Tiempo de detección: la variable que sí depende del sensor ───── */
  /* Sin sistema te enterás, en promedio, a la mitad de la ventana entre recorridas. */
  const intervaloH   = (7 / recSem) * 24;
  const detSin       = intervaloH / 2;
  const detCon       = 0.25;                       // 15 min
  const horasGanadas = Math.max(0, detSin - detCon);
  /* Conservador: un día sin agua cuesta el día de ganancia + un día de recuperación. */
  const kgPorEvento  = (horasGanadas / 24) * 2 * cat.gdp * animAfect;
  const ahorroFallas = eventos * kgPorEvento * precioKg;

  /* ── 3. Lo que ya le pasó el último año ──────────────────────────────── */
  const ahorroMortandad = muertos * cat.pesoProm * precioKg;
  const ahorroReparac   = reparac;

  const beneficio = ahorroRecorridas + ahorroFallas + ahorroMortandad + ahorroReparac;

  /* ── 4. Costo anual del sistema ──────────────────────────────────────── */
  const equipos = nFijo * PRECIOS.fijo + nMovil * PRECIOS.movil +
                  nBomba * PRECIOS.bomba + nMolino * PRECIOS.molino +
                  nGw * PRECIOS.gateway;
  const suscAnual  = (SUSC_BASE + SUSC_EXTRA * Math.max(0, nNodos - 1)) * 12;
  const amortiz    = (equipos + instalacion) / vidaUtil;
  const baterias   = (costoBat * nNodos) / vidaBat;   // la gel no dura la vida útil del equipo
  const costoAnual = amortiz + baterias + suscAnual;

  const neto = beneficio - costoAnual;
  /* Para repagar el capital sólo sirve lo que sobra después de los costos recurrentes */
  const flujoMensual = (beneficio - suscAnual - baterias) / 12;
  const paybackMeses = flujoMensual > 0 ? (equipos + instalacion) / flujoMensual : Infinity;
  const paybackOk    = isFinite(paybackMeses) && paybackMeses <= vidaUtil * 12;

  /* ── Salida: tiempo de detección ─────────────────────────────────────── */
  d('out_det_sin').innerText = detSin >= 48 ? fmt(detSin / 24, 1) + ' días' : fmt(detSin, 0) + ' h';
  d('out_det_cadencia').innerText = 'Recorriendo ' + fmt(recSem, 1) + ' vez/semana';

  /* ── Salida: métricas principales ────────────────────────────────────── */
  d('out_beneficio').innerText = fmt(Math.round(beneficio));
  d('out_costo').innerText     = fmt(Math.round(costoAnual));
  d('out_neto').innerText      = fmt(Math.round(neto));
  d('metric_neto').className   = 'metric-card color-' + (neto > 0 ? 'accent' : 'danger');
  d('out_neto').className      = 'metric-value text-' + (neto > 0 ? 'accent' : 'danger');
  d('out_costo_aguada').innerText = money(costoAnual / nAguadas) + '/año por aguada';

  if (isFinite(paybackMeses) && paybackMeses > 0) {
    d('out_payback').innerText = fmt(paybackMeses, 0);
    d('out_payback_unit').innerText = 'meses';
  } else {
    d('out_payback').innerText = '—';
    d('out_payback_unit').innerText = '';
  }
  d('metric_payback').className = 'metric-card color-' + (paybackOk ? 'accent' : 'danger');
  d('out_payback').className    = 'metric-value text-' + (paybackOk ? 'accent' : 'danger');

  /* ── Desglose del beneficio ──────────────────────────────────────────── */
  const partes = [
    ['recorridas', ahorroRecorridas],
    ['fallas',     ahorroFallas],
    ['mortandad',  ahorroMortandad],
    ['reparac',    ahorroReparac]
  ];
  partes.forEach(function (par) {
    const pct = beneficio > 0 ? (par[1] / beneficio) * 100 : 0;
    d('out_desg_' + par[0]).innerText = money(par[1]);
    d('bar_desg_' + par[0]).style.width = pct + '%';
  });
  d('out_kg_evento').innerText = fmt(kgPorEvento, 0) + ' kg';

  /* ── Costos, en detalle ──────────────────────────────────────────────── */
  d('out_equipos').innerText    = money(equipos);
  d('out_nodos_cant').innerText = fmt(nNodos, 0) + (nNodos === 1 ? ' nodo' : ' nodos') + ' + ' + fmt(nGw, 0) + ' gateway';
  d('out_amortiz').innerText    = money(amortiz);
  d('out_baterias').innerText   = money(baterias);
  d('out_susc').innerText       = money(suscAnual);
  d('out_susc_mes').innerText   = money(suscAnual / 12) + '/mes';

  /* ── Veredicto honesto ───────────────────────────────────────────────── */
  const card = d('card_veredicto');
  let clase, color, titulo, detalle;

  if (beneficio <= 0) {
    clase = 'bg-warning-10'; color = 'var(--c-warning)';
    titulo = 'Faltan tus datos';
    detalle = 'Cargá cuántas recorridas hacés y qué te pasó el último año. Sin eso no hay número que mostrar.';
  } else if (neto <= 0) {
    clase = 'bg-danger-10'; color = 'var(--c-danger)';
    titulo = 'Con estos números no se justifica';
    detalle = 'El sistema cuesta ' + money(costoAnual) + ' por año y te ahorraría ' + money(beneficio) +
              '. Conviene a partir de más aguadas, más recorridas evitadas o un historial de fallas más pesado.';
  } else if (paybackMeses <= 12) {
    clase = 'bg-accent-10'; color = 'var(--c-accent)';
    titulo = 'Se paga en el primer año';
    detalle = 'Recuperás la inversión en ' + fmt(paybackMeses, 0) + ' meses y después deja ' +
              money(neto) + ' por año.';
  } else if (paybackOk) {
    clase = 'bg-accent-10'; color = 'var(--c-accent)';
    titulo = 'Se paga dentro de la vida útil';
    detalle = 'Recuperás la inversión en ' + fmt(paybackMeses, 0) + ' meses, sobre una vida útil de ' +
              fmt(vidaUtil, 0) + ' años. Neto: ' + money(neto) + ' por año.';
  } else {
    clase = 'bg-orange-10'; color = '#ff8c42';
    titulo = 'El repago es más largo que la vida útil';
    detalle = 'Con estos números tarda ' + fmt(paybackMeses, 0) + ' meses en repagarse, y los equipos se amortizan en ' +
              fmt(vidaUtil * 12, 0) + '. Revisá el % de recorridas evitadas o el historial de fallas.';
  }
  card.className = 'risk-card ' + clase;
  card.style.borderColor = color;
  d('lbl_veredicto').style.color = color;
  d('lbl_veredicto').innerText = titulo;
  d('txt_veredicto').innerText = detalle;

  /* ── Recomendación ───────────────────────────────────────────────────── */
  let rec;
  if (cat.gdp === 0 && eventos > 0) {
    rec = 'Elegiste una categoría sin ganancia de peso objetivo (cría o lechería), así que las fallas sólo suman por ' +
          'mortandad y reparaciones. El impacto reproductivo del estrés hídrico es real pero no se monetiza acá: ' +
          'el número que ves es un piso, no un techo.';
  } else if (beneficio > 0 && ahorroRecorridas > beneficio * 0.7) {
    rec = 'Casi todo el retorno viene de recorridas evitadas. Es el ahorro más seguro, pero también el más fácil de ' +
          'discutir: al campo se va igual. Si tuviste fallas de agua el último año, cargalas — ahí está el grueso del valor.';
  } else if (beneficio > 0 && ahorroFallas > beneficio * 0.5) {
    rec = 'El retorno se apoya en detectar las fallas a tiempo. Tu número clave es que hoy te enterás, en promedio, ' +
          fmt(detSin, 0) + ' horas después de que el agua falló. Esa es la ventana que el sistema cierra.';
  } else if (beneficio > 0) {
    rec = 'El retorno está repartido entre recorridas, fallas y pérdidas ya ocurridas. Ese es el caso más sólido para ' +
          'presentar: no depende de un solo supuesto.';
  } else {
    rec = 'Empezá por las recorridas: cuántas hacés por semana, cuántos km y cuántas horas te lleva cada una.';
  }
  d('out_recomendacion').innerText = rec;

  if (window.lucide) lucide.createIcons();
}

/* Bind */
document.querySelectorAll('.calc-input').forEach(el => {
  el.addEventListener('input', calculate);
  el.addEventListener('change', calculate);
});

window.addEventListener('DOMContentLoaded', calculate);
