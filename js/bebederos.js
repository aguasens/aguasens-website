// Datos fijos
const categorias = {
  'ternero':         { nombre: 'Ternero (150 kg)',                  consumoBase: 18,  cmPor10: 25,  pesoProm: 150, gdp: 0.7 },
  'vaquillona':      { nombre: 'Vaquillona (250 kg)',               consumoBase: 30,  cmPor10: 30,  pesoProm: 250, gdp: 0.6 },
  'novillo_engorde': { nombre: 'Novillo engorde (350 kg)',          consumoBase: 45,  cmPor10: 30,  pesoProm: 350, gdp: 0.8 },
  'vaca_seca':       { nombre: 'Vaca seca (450 kg)',                consumoBase: 50,  cmPor10: 35,  pesoProm: 450, gdp: 0   },
  'vaca_cria':       { nombre: 'Vaca cría lactante (450 kg)',       consumoBase: 70,  cmPor10: 40,  pesoProm: 450, gdp: 0   },
  'vaca_lechera':    { nombre: 'Vaca lechera (600 kg)',             consumoBase: 110, cmPor10: 50,  pesoProm: 600, gdp: 0   },
  'toro':            { nombre: 'Toro (800 kg)',                     consumoBase: 65,  cmPor10: 50,  pesoProm: 800, gdp: 0   }
};

const sistemas = {
  'pastoreo_ext':  { nombre: 'Pastoreo extensivo',                  pctSimultaneo: 0.20, factorCm: 1.20, descripcion: 'Animales gregarios, alta demanda pico' },
  'pastoreo_rot':  { nombre: 'Pastoreo rotativo (agua en parcela)', pctSimultaneo: 0.08, factorCm: 0.90, descripcion: 'Acceso individual, baja concurrencia' },
  'feedlot':       { nombre: 'Feedlot / corral',                    pctSimultaneo: 0.15, factorCm: 1.00, descripcion: 'Estándar bibliográfico (Bavera, NRC)' },
  'tambo':         { nombre: 'Tambo / vacas lechería',              pctSimultaneo: 0.30, factorCm: 1.30, descripcion: 'Pico post-ordeño muy fuerte' }
};

const factoresTemp = {
  'frio':     { nombre: 'Frío (< 10 °C)',         factor: 0.75, factorMortalidad: 0.5 },
  'templado': { nombre: 'Templado (10–22 °C)',    factor: 1.00, factorMortalidad: 1.0 },
  'calido':   { nombre: 'Cálido (22–30 °C)',      factor: 1.50, factorMortalidad: 2.0 },
  'extremo':  { nombre: 'Extremo (> 30 °C)',      factor: 2.00, factorMortalidad: 4.0 }
};

const factoresPastura = {
  'verde_humeda':   { nombre: 'Verdeo / pastura húmeda',  factor: 0.85 },
  'mixta':          { nombre: 'Pastura mixta',            factor: 1.00 },
  'seca_henificada':{ nombre: 'Seca / heno / silo',       factor: 1.30 }
};

const horizontes = {
  'mensual': { nombre: 'Mes',         dias: 30,  factor: 1/12 },
  'ciclo':   { nombre: 'Ciclo',       dias: 90,  factor: 90/365 },
  'anual':   { nombre: 'Año',         dias: 365, factor: 1 }
};

const riesgoConfig = {
  'optimo':  { color: 'var(--c-accent)', bg: 'bg-accent-10', border: 'border-accent', label: 'ÓPTIMO', icon: 'check-circle-2' },
  'limite':  { color: 'var(--c-warning)', bg: 'bg-warning-10', border: 'border-warning', label: 'AL LÍMITE', icon: 'alert-triangle' },
  'critico': { color: '#ff8c42', bg: 'bg-orange-10', border: 'border-orange', label: 'CRÍTICO', icon: 'alert-triangle' },
  'severo':  { color: 'var(--c-danger)', bg: 'bg-danger-10', border: 'border-danger', label: 'SEVERO', icon: 'alert-triangle' }
};

// Estado UI
let tipoBebedero = 'rectangular';
let horizonte = 'anual';

// DOM Elements
const d = (id) => document.getElementById(id);

function setTipo(tipo) {
  tipoBebedero = tipo;
  d('btn_rect').classList.toggle('active', tipo === 'rectangular');
  d('btn_circ').classList.toggle('active', tipo === 'circular');
  d('cfg_rect').style.display = tipo === 'rectangular' ? 'block' : 'none';
  d('cfg_circ').style.display = tipo === 'circular' ? 'block' : 'none';
  calculate();
}

function setHor(hor) {
  horizonte = hor;
  d('btn_hor_mensual').classList.toggle('active', hor === 'mensual');
  d('btn_hor_ciclo').classList.toggle('active', hor === 'ciclo');
  d('btn_hor_anual').classList.toggle('active', hor === 'anual');
  calculate();
}

// Helpers
const fmt = (n, dec=0) => new Intl.NumberFormat('es-AR', { maximumFractionDigits: dec, minimumFractionDigits: dec }).format(n);
const fmtMoneyShort = (n) => {
  if (n >= 1000000) return 'US$ ' + fmt(n/1000000, 1) + 'M';
  if (n >= 1000) return 'US$ ' + fmt(n/1, 0);
  return 'US$ ' + fmt(n, 0);
};

// SVG render
function renderSVG(largo, ancho, diametro, acceso, animalesQueEntran) {
  const W = 320, H = 180, cx = W/2, cy = H/2;
  let svg = `<svg viewBox="0 0 ${W} ${H}" style="width:100%;">`;
  
  const cant = Math.min(animalesQueEntran, 26);
  const animales = [];

  if (tipoBebedero === 'circular') {
    const r = Math.min(W, H) * 0.30;
    const cantC = Math.min(animalesQueEntran, 24);
    for(let i=0; i<cantC; i++) {
      const ang = (i / cantC) * Math.PI * 2;
      animales.push({ x: cx + Math.cos(ang) * (r + 18), y: cy + Math.sin(ang) * (r + 18) });
    }
    animales.forEach(a => {
      svg += `<g><circle cx="${a.x}" cy="${a.y}" r="7" fill="var(--c-primary)" opacity="0.85" /><circle cx="${a.x-2}" cy="${a.y-2}" r="1.5" fill="white" /></g>`;
    });
    svg += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="#aac8eb" stroke="var(--c-deep)" stroke-width="2.5" />`;
    svg += `<circle cx="${cx}" cy="${cy}" r="${r-5}" fill="none" stroke="var(--c-deep)" stroke-width="0.8" opacity="0.4" stroke-dasharray="3 4" />`;
    svg += `<text x="${cx}" y="${cy+5}" text-anchor="middle" font-size="13" font-family="Barlow" fill="var(--c-deep)" font-weight="700">⌀ ${diametro} m</text>`;
    svg += `<text x="${cx}" y="${H-8}" text-anchor="middle" font-size="9" font-family="monospace" fill="var(--c-muted)">${(Math.PI*diametro).toFixed(2)} m borde</text>`;
  } else {
    const aspect = largo / Math.max(ancho, 0.1);
    const maxW = 220, maxH = 70;
    let bw = maxW, bh = maxW / aspect;
    if (bh > maxH) { bh = maxH; bw = maxH * aspect; }
    const bx = (W - bw) / 2, by = (H - bh) / 2;
    
    if (acceso === 'un_lado_largo') {
      for (let i=0; i<cant; i++) animales.push({ x: bx + (bw/(cant+1))*(i+1), y: by - 13 });
    } else if (acceso === 'dos_lados_largos') {
      const mitad = Math.ceil(cant/2);
      for (let i=0; i<mitad; i++) animales.push({ x: bx + (bw/(mitad+1))*(i+1), y: by - 13 });
      for (let i=0; i<cant-mitad; i++) animales.push({ x: bx + (bw/(cant-mitad+1))*(i+1), y: by + bh + 13 });
    } else {
      const cuarto = Math.ceil(cant/4);
      for (let i=0; i<cuarto; i++) {
        animales.push({ x: bx + (bw/(cuarto+1))*(i+1), y: by - 13 });
        animales.push({ x: bx + (bw/(cuarto+1))*(i+1), y: by + bh + 13 });
      }
      for (let i=0; i<Math.ceil(cuarto/2); i++) {
        animales.push({ x: bx - 13, y: by + (bh/(Math.ceil(cuarto/2)+1))*(i+1) });
        animales.push({ x: bx + bw + 13, y: by + (bh/(Math.ceil(cuarto/2)+1))*(i+1) });
      }
    }

    animales.forEach(a => {
      svg += `<g><circle cx="${a.x}" cy="${a.y}" r="6.5" fill="var(--c-primary)" opacity="0.85" /><circle cx="${a.x-1.5}" cy="${a.y-1.5}" r="1.2" fill="white" /></g>`;
    });
    svg += `<rect x="${bx}" y="${by}" width="${bw}" height="${bh}" rx="4" fill="#aac8eb" stroke="var(--c-deep)" stroke-width="2.5" />`;
    svg += `<rect x="${bx+3}" y="${by+3}" width="${bw-6}" height="${bh-6}" rx="2" fill="none" stroke="var(--c-deep)" stroke-width="0.8" opacity="0.3" stroke-dasharray="3 4" />`;
    svg += `<text x="${bx + bw/2}" y="${by + bh/2 + 5}" text-anchor="middle" font-size="12" font-family="Barlow" fill="var(--c-deep)" font-weight="700">${largo} × ${ancho} m</text>`;
    svg += `<text x="${bx + bw/2}" y="${H-5}" text-anchor="middle" font-size="9" font-family="monospace" fill="var(--c-muted)">${largo} m largo</text>`;
  }
  
  svg += `</svg>`;
  d('svg_wrap').innerHTML = svg;
}

function calculate() {
  const v = (id) => parseFloat(d(id).value) || 0;
  
  const cantidadAnimales = v('in_animales');
  const cat = categorias[d('in_categoria').value];
  const sis = sistemas[d('in_sistema').value];
  const fT = factoresTemp[d('in_clima').value];
  const fP = factoresPastura[d('in_dieta').value];
  
  const largo = v('in_largo');
  const ancho = v('in_ancho');
  const diametro = v('in_diametro');
  const acceso = d('in_acceso').value;
  const caudalReposicion = v('in_caudal');
  const precioKgVivo = v('in_precio');
  const hor = horizontes[horizonte];

  d('desc_sistema').innerText = sis.descripcion;

  // ===== CONSUMO Y CAUDAL =====
  const consumoIndividual = cat.consumoBase * fT.factor * fP.factor;
  const consumoTotalDiario = consumoIndividual * cantidadAnimales;
  const ventanaPicoHoras = 4;
  const consumoEnVentanaPico = consumoTotalDiario * 0.60;
  const consumoPromedioHoraPico = consumoEnVentanaPico / ventanaPicoHoras;
  
  // ===== FRENTE ÚTIL Y VOLUMEN BEBEDERO =====
  let perimetroDisponible = 0;
  if (tipoBebedero === 'rectangular') {
    if (acceso === 'un_lado_largo') perimetroDisponible = largo;
    else if (acceso === 'dos_lados_largos') perimetroDisponible = 2 * largo;
    else perimetroDisponible = 2 * (largo + ancho);
  } else {
    perimetroDisponible = Math.PI * diametro;
  }

  const cmTotalNecesario = (cantidadAnimales / 10) * cat.cmPor10 * sis.factorCm;
  const espacioLinealNecesarioM = cmTotalNecesario / 100;
  const anchoAnimalCm = 60;
  const animalesQueEntran = Math.floor((perimetroDisponible * 100) / anchoAnimalCm);
  const cobertura = (perimetroDisponible / Math.max(espacioLinealNecesarioM, 0.01)) * 100;
  
  let volumenBebedero = tipoBebedero === 'rectangular' 
    ? largo * ancho * 0.4 * 1000 
    : Math.PI * Math.pow(diametro/2, 2) * 0.4 * 1000;

  // ===== ANÁLISIS HIDRÁULICO =====
  const aporteCaudalEnPico = caudalReposicion * 60 * ventanaPicoHoras;
  const suministroTotalEnPico = aporteCaudalEnPico + volumenBebedero;
  const balancePico = suministroTotalEnPico - consumoEnVentanaPico;
  const cubreCaudal = balancePico >= 0;
  
  const minutosRecuperacion = volumenBebedero / Math.max(caudalReposicion, 0.1);

  // ===== DIAGNÓSTICO DE COBERTURA =====
  let nivelRiesgo = 'optimo';
  if (cobertura < 100) nivelRiesgo = 'limite';
  if (cobertura < 75)  nivelRiesgo = 'critico';
  if (cobertura < 50)  nivelRiesgo = 'severo';
  
  // ===== DIAGNÓSTICO DE CAUDAL =====
  let nivelCaudal = 'ok';
  const ratioBalance = suministroTotalEnPico / Math.max(consumoEnVentanaPico, 1);
  if (ratioBalance < 1.0)  nivelCaudal = 'limite';
  if (ratioBalance < 0.85) nivelCaudal = 'critico';
  if (ratioBalance < 0.7)  nivelCaudal = 'severo';
  const recuperacionLenta = minutosRecuperacion > 120;

  // ===== ANÁLISIS ECONÓMICO =====
  const niveles = ['optimo', 'limite', 'critico', 'severo'];
  const nivelCaudalEquiv = nivelCaudal === 'ok' ? 'optimo' : nivelCaudal;
  const idxRiesgo = Math.max(niveles.indexOf(nivelRiesgo), niveles.indexOf(nivelCaudalEquiv));
  const nivelCombinado = niveles[idxRiesgo];
  
  let reduccionConsumoMS = 0;
  if (nivelCombinado === 'limite')  reduccionConsumoMS = 0.04;
  if (nivelCombinado === 'critico') reduccionConsumoMS = 0.10;
  if (nivelCombinado === 'severo')  reduccionConsumoMS = 0.18;
  
  const gdpAfectado = cat.gdp * reduccionConsumoMS;
  const kgPerdidosTotalHorizonte = gdpAfectado * cantidadAnimales * hor.dias;
  const arsPerdidosGDPHorizonte = kgPerdidosTotalHorizonte * precioKgVivo;
  
  let tasaMortalidadAnualBase = 0.015;
  if (d('in_sistema').value === 'pastoreo_ext' || d('in_sistema').value === 'pastoreo_rot') tasaMortalidadAnualBase = 0.005;
  if (d('in_sistema').value === 'tambo') tasaMortalidadAnualBase = 0.025;
  
  let factorMortalidadAgua = 1.0;
  if (nivelCombinado === 'limite')  factorMortalidadAgua = 1.3;
  if (nivelCombinado === 'critico') factorMortalidadAgua = 2.0;
  if (nivelCombinado === 'severo')  factorMortalidadAgua = 3.5;
  
  const tasaMortalidadAjustada = tasaMortalidadAnualBase * factorMortalidadAgua * fT.factorMortalidad;
  const animalesMuertosTotalHorizonte = cantidadAnimales * tasaMortalidadAjustada * hor.factor;
  const animalesMuertosBaseHorizonte = cantidadAnimales * tasaMortalidadAnualBase * hor.factor;
  const animalesMuertosAdicionalesHorizonte = Math.max(0, animalesMuertosTotalHorizonte - animalesMuertosBaseHorizonte);
  const valorAnimal = cat.pesoProm * precioKgVivo;
  const costoMortalidadHorizonte = animalesMuertosAdicionalesHorizonte * valorAnimal;
  
  let riesgoEventoExtremoPct = 0;
  if (nivelCombinado === 'limite')  riesgoEventoExtremoPct = 0.5;
  if (nivelCombinado === 'critico') riesgoEventoExtremoPct = 1.5;
  if (nivelCombinado === 'severo')  riesgoEventoExtremoPct = 4.0;
  if (d('in_clima').value === 'extremo') riesgoEventoExtremoPct *= 2.0;
  
  const perdidaTotalHorizonte = arsPerdidosGDPHorizonte + costoMortalidadHorizonte;

  // ======== UPDATE DOM ========
  
  // Cobertura Card
  const rConf = riesgoConfig[nivelRiesgo];
  d('card_cobertura').className = `risk-card ${rConf.bg}`;
  d('card_cobertura').style.borderColor = rConf.color;
  d('icon_cobertura').setAttribute('data-lucide', rConf.icon);
  d('lbl_cobertura').style.color = rConf.color;
  d('lbl_cobertura').innerText = rConf.label;
  d('val_cobertura').style.color = rConf.color;
  d('val_cobertura').innerText = cobertura > 999 ? '+999' : fmt(cobertura);
  d('sub_cobertura').innerText = cobertura >= 100 ? 'del frente útil mínimo' : 'del frente útil necesario';
  d('bar_cobertura').style.width = Math.min(100, cobertura) + '%';
  d('bar_cobertura').style.background = rConf.color;
  
  d('warn_sobredimension').style.display = cobertura > 200 ? 'block' : 'none';
  if(cobertura > 200) d('warn_sobredimension').innerHTML = `ℹ Bebedero ampliamente sobredimensionado. Capacidad ociosa = ${fmt(cobertura - 100)}% por encima del mínimo.`;

  // Caudal Card
  if (nivelCaudal !== 'ok' || recuperacionLenta) {
    d('card_caudal').style.display = 'block';
    let cBg = 'bg-warning-10', cCol = 'var(--c-warning)';
    if (nivelCaudal === 'critico') { cBg = 'bg-orange-10'; cCol = '#ff8c42'; }
    if (nivelCaudal === 'severo') { cBg = 'bg-danger-10'; cCol = 'var(--c-danger)'; }
    d('card_caudal').className = `risk-card ${cBg}`;
    d('card_caudal').style.borderColor = cCol;
    d('icon_caudal').setAttribute('data-lucide', 'alert-triangle');
    d('icon_caudal').style.color = cCol;
    d('lbl_caudal').style.color = cCol;
    d('lbl_caudal').innerText = nivelCaudal !== 'ok' ? `Balance hídrico ${nivelCaudal==='severo'?'severamente':''} insuficiente` : 'Recuperación lenta';
    d('txt_caudal_desc').innerHTML = `Demanda en pico (4h): <b>${fmt(consumoEnVentanaPico)} L</b> · Disponible: <b>${fmt(suministroTotalEnPico)} L</b>`;
    let recTxt = '';
    if (nivelCaudal === 'limite') recTxt = '⚠ El sistema apenas cubre el pico. En días calurosos puede quedar al borde.';
    else if (nivelCaudal === 'critico') recTxt = '⚠ El bebedero se vaciará durante el pico. Aumentar caudal O ampliar bebedero.';
    else if (nivelCaudal === 'severo') recTxt = '✗ Riesgo serio de deshidratación. Instalar tanque pulmón o subdividir el rodeo.';
    else if (recuperacionLenta) recTxt = '⚠ Balance pico cubierto, pero tarda >2 hs en rellenarse.';
    d('txt_caudal_recom').innerText = recTxt;
  } else {
    d('card_caudal').style.display = 'none';
  }

  // Metrics
  d('out_consumo_tot').innerText = fmt(consumoTotalDiario);
  d('out_consumo_ind').innerText = `${fmt(consumoIndividual)} L/animal`;
  
  d('out_balance').innerText = fmt((suministroTotalEnPico / Math.max(consumoEnVentanaPico, 1)) * 100);
  d('out_balance').className = `metric-value text-${cubreCaudal ? 'accent' : 'danger'}`;
  d('out_balance_sub').innerText = cubreCaudal ? '✓ suministro OK' : '✗ déficit en pico';
  d('metric_balance').className = `metric-card color-${cubreCaudal ? 'accent' : 'danger'}`;

  d('out_frente').innerText = fmt(perimetroDisponible, 2);
  d('out_frente_req').innerText = `Necesario: ${fmt(espacioLinealNecesarioM, 2)} m`;
  
  d('out_recup').innerText = fmt(minutosRecuperacion);
  let cRec = minutosRecuperacion <= 60 ? 'accent' : minutosRecuperacion <= 120 ? 'warning' : 'danger';
  d('out_recup').className = `metric-value text-${cRec}`;
  d('out_recup_vol').innerText = `Vol: ${fmt(volumenBebedero)} L`;
  d('metric_recup').className = `metric-card color-${cRec}`;

  // Económico
  if (perdidaTotalHorizonte > 0) {
    d('card_eco').style.display = 'block';
    d('lbl_hor_eco').innerText = `POR ${hor.nombre.toUpperCase()}`;
    d('out_perdida_total').innerText = fmtMoneyShort(perdidaTotalHorizonte);
    
    if (kgPerdidosTotalHorizonte > 0) {
      d('row_eco_gdp').style.display = 'flex';
      d('out_eco_gdp_sub').innerText = `-${fmt(reduccionConsumoMS*100)}% consumo MS · ${fmt(kgPerdidosTotalHorizonte)} kg total`;
      d('out_eco_gdp_val').innerText = fmtMoneyShort(arsPerdidosGDPHorizonte);
    } else d('row_eco_gdp').style.display = 'none';

    if (animalesMuertosAdicionalesHorizonte > 0) {
      d('row_eco_mort').style.display = 'flex';
      d('out_eco_mort_sub').innerText = `${fmt(animalesMuertosAdicionalesHorizonte, 1)} animales extra vs óptimo`;
      d('out_eco_mort_val').innerText = fmtMoneyShort(costoMortalidadHorizonte);
    } else d('row_eco_mort').style.display = 'none';
  } else {
    d('card_eco').style.display = 'none';
  }

  // Mortalidad
  d('out_mort_tasa').innerText = fmt(tasaMortalidadAjustada*100, 2);
  d('out_mort_tasa').className = `text-2xl font-bold ${tasaMortalidadAjustada > 0.04 ? 'text-danger' : tasaMortalidadAjustada > 0.025 ? 'text-warning' : 'text-accent'}`;
  d('out_mort_base').innerText = `Base: ${fmt(tasaMortalidadAnualBase*100, 1)}% · ${sis.nombre.split(' ')[0]}`;
  
  d('lbl_mort_hor').innerText = `Muertes / ${hor.nombre.toLowerCase()}`;
  d('out_mort_cant').innerText = fmt(animalesMuertosTotalHorizonte, 1);
  d('out_mort_extra').innerText = `+${fmt(animalesMuertosAdicionalesHorizonte, 1)} vs óptimo`;

  d('bar_mort').style.width = Math.min(100, (tasaMortalidadAjustada / 0.06) * 100) + '%';
  d('bar_mort').style.background = tasaMortalidadAjustada > 0.04 ? 'var(--c-danger)' : tasaMortalidadAjustada > 0.025 ? 'var(--c-warning)' : 'var(--c-accent)';

  if (riesgoEventoExtremoPct > 0) {
    d('warn_mort_extremo').style.display = 'block';
    d('out_mort_ext_txt').innerHTML = `Hasta <b class="text-danger">${fmt(riesgoEventoExtremoPct, 1)}%</b> del rodeo (≈ ${fmt(cantidadAnimales * riesgoEventoExtremoPct/100)} animales) podría perderse en una ola de calor sin agua.`;
  } else {
    d('warn_mort_extremo').style.display = 'none';
  }

  // Recomendación
  let rec = '';
  if (cobertura >= 100 && cubreCaudal && !recuperacionLenta) rec = '✓ El bebedero está correctamente dimensionado. Recomendamos monitoreo IoT para detectar fallas de suministro en tiempo real.';
  else if (cobertura >= 100 && cubreCaudal && recuperacionLenta) rec = '✓ Cobertura y balance pico OK. La recuperación del bebedero es lenta (>2h): considerar mayor caudal de cañería.';
  else if (cobertura >= 100 && !cubreCaudal) rec = '⚠ Frente útil suficiente, pero balance deficitario en pico. Aumentar caudal de cañería o instalar un tanque pulmón.';
  else if (cobertura >= 75 && cubreCaudal) rec = '⚠ Frente útil al límite. Los animales subordinados pueden no acceder. Considerar ampliar el bebedero.';
  else if (cobertura >= 75 && !cubreCaudal) rec = '⚠ Frente útil al límite Y balance deficitario. Ampliar el bebedero ayuda en ambos frentes.';
  else rec = '✗ Frente útil insuficiente. Los animales subordinados no acceden al agua, generando pérdidas significativas. Ampliación inmediata requerida.';
  d('out_recomendacion').innerText = rec;

  renderSVG(largo, ancho, diametro, acceso, animalesQueEntran);
  if (window.lucide) lucide.createIcons();
}

// Bind events
document.querySelectorAll('.calc-input').forEach(el => {
  el.addEventListener('input', calculate);
  el.addEventListener('change', calculate);
});

// Init
window.addEventListener('DOMContentLoaded', () => {
  calculate();
});
