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
  if (distancia_m <= 50) return 5 * factorClima;
  const visitas = (1 + 4 * Math.exp(-distancia_m / 600)) * factorClima;
  return Math.max(0.8, visitas);
};

const reduccionConsumoAguaPct = (distancia_m) => {
  if (distancia_m <= 100) return 0;
  if (distancia_m <= 250) return 5;
  if (distancia_m <= 400) return 10;
  if (distancia_m <= 600) return 18;
  if (distancia_m <= 800) return 25;
  if (distancia_m <= 1200) return 35;
  return 45;
};

// Estado UI
let bebederos = [{x: 0.5, y: 0.5}];

// DOM Helpers
const d = (id) => document.getElementById(id);
const v = (id) => parseFloat(d(id).value) || 0;
const fmt = (n, dec=0) => new Intl.NumberFormat('es-AR', { maximumFractionDigits: dec, minimumFractionDigits: dec }).format(n);
const fmtMoneyShort = (n) => {
  if (Math.abs(n) >= 1000000) return '$' + fmt(n/1000000, 1) + 'M';
  if (Math.abs(n) >= 1000) return '$' + fmt(n/1, 0);
  return '$' + fmt(n, 0);
};

// SVG Interaction
const svgMap = d('svg_map');
svgMap.addEventListener('click', (e) => {
  const rect = svgMap.getBoundingClientRect();
  const x = (e.clientX - rect.left) / rect.width;
  const y = (e.clientY - rect.top) / rect.height;
  if (x >= 0 && x <= 1 && y >= 0 && y <= 1) {
    bebederos.push({x, y});
    calculate();
  }
});

function removeBebedero(idx, e) {
  e.stopPropagation();
  bebederos.splice(idx, 1);
  calculate();
}

// Global scope for HTML onclick
window.setPos = function(type) {
  if(type===0) bebederos = [];
  if(type===1) bebederos = [{x:0.5,y:0.5}];
  if(type===2) bebederos = [{x:0.05,y:0.05}];
  if(type===3) bebederos = [{x:0.25,y:0.5},{x:0.75,y:0.5}];
  if(type===4) bebederos = [{x:0.25,y:0.25},{x:0.75,y:0.25},{x:0.25,y:0.75},{x:0.75,y:0.75}];
  calculate();
}

function heatColor(dist, maxD) {
  const t = Math.min(1, dist / Math.max(maxD, 1));
  if (t < 0.33) {
    const k = t / 0.33;
    return `rgba(25, 199, 163, ${0.20 + k*0.30})`;
  } else if (t < 0.66) {
    const k = (t - 0.33) / 0.33;
    return `rgba(255, 181, 71, ${0.40 + k*0.20})`;
  } else {
    const k = (t - 0.66) / 0.34;
    return `rgba(255, 107, 107, ${0.50 + k*0.40})`;
  }
}

function renderMap(largoLote, anchoLote, maxDistancia) {
  const grid = 16;
  let svg = '';
  
  // Heatmap rects
  for (let i = 0; i < grid; i++) {
    for (let j = 0; j < grid; j++) {
      const px = (i / (grid-1)) * largoLote;
      const py = (j / (grid-1)) * anchoLote;
      let minD = Infinity;
      bebederos.forEach(b => {
        const d = Math.sqrt(Math.pow(px - b.x*largoLote, 2) + Math.pow(py - b.y*anchoLote, 2));
        if (d < minD) minD = d;
      });
      const dVal = bebederos.length > 0 ? minD : 0;
      const cellW = 100 / grid;
      const cellH = 60 / grid;
      svg += `<rect x="${i*cellW}" y="${j*cellH}" width="${cellW+0.1}" height="${cellH+0.1}" fill="${heatColor(dVal, maxDistancia)}"></rect>`;
    }
  }

  // Grid lines
  for(let i=1; i<10; i++) svg += `<line x1="${i*10}" y1="0" x2="${i*10}" y2="60" stroke="#152238" stroke-width="0.05" opacity="0.1"></line>`;
  for(let i=1; i<6; i++) svg += `<line x1="0" y1="${i*10}" x2="100" y2="${i*10}" stroke="#152238" stroke-width="0.05" opacity="0.1"></line>`;

  // Bebederos
  bebederos.forEach((b, idx) => {
    svg += `<g ondblclick="removeBebedero(${idx}, event)" style="cursor: pointer;">
              <circle cx="${b.x*100}" cy="${b.y*60}" r="3.5" fill="var(--c-deep)" stroke="white" stroke-width="0.8"></circle>
              <circle cx="${b.x*100}" cy="${b.y*60}" r="1.5" fill="var(--c-accent)"></circle>
              <circle cx="${b.x*100}" cy="${b.y*60}" r="5.5" fill="none" stroke="var(--c-deep)" stroke-width="0.25" opacity="0.5"></circle>
            </g>`;
  });

  svgMap.innerHTML = svg;
}

function calculate() {
  const largoLote = Math.max(50, v('in_largo'));
  const anchoLote = Math.max(50, v('in_ancho'));
  const cantidadAnimales = v('in_animales');
  const cat = categorias[d('in_categoria').value];
  const clima = situacionesClima[d('in_clima').value];
  const diasEnLote = v('in_dias');
  const precioKgVivo = v('in_precio');
  const pendiente = v('in_pendiente');
  const factCamino = factoresCamino[d('in_camino').value].factor;

  const areaHa = (largoLote * anchoLote) / 10000;
  d('out_area').innerText = `${fmt(areaHa, 1)} ha`;
  d('out_bebederos_cant').innerText = bebederos.length;

  d('map_container').style.paddingBottom = `${Math.min(60, (anchoLote/largoLote)*100)}%`;

  if (bebederos.length === 0) {
    d('card_sin_bebederos').style.display = 'block';
    d('resultados_wrap').style.display = 'none';
    renderMap(largoLote, anchoLote, 1);
    d('out_max_d').innerText = '0';
    return;
  }

  d('card_sin_bebederos').style.display = 'none';
  d('resultados_wrap').style.display = 'block';

  // Distancias
  const grid = 30;
  let sumaDistancias = 0;
  let maxDistancia = 0;
  for (let i = 0; i < grid; i++) {
    for (let j = 0; j < grid; j++) {
      const px = (i / (grid-1)) * largoLote;
      const py = (j / (grid-1)) * anchoLote;
      let minD = Infinity;
      bebederos.forEach(b => {
        const bx = b.x * largoLote;
        const by = b.y * anchoLote;
        const d_m = Math.sqrt(Math.pow(px-bx, 2) + Math.pow(py-by, 2));
        if (d_m < minD) minD = d_m;
      });
      sumaDistancias += minD;
      if (minD > maxDistancia) maxDistancia = minD;
    }
  }
  const distanciaPromedio = sumaDistancias / (grid*grid);
  
  renderMap(largoLote, anchoLote, maxDistancia);

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
  const energiaPorKm = 0.00045 + (0.0067 * (elevacionPorKm / 1000));
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

  if (cat.gdpObjetivo > 0 && comidaExtraPct > 0) {
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
  if (distanciaPromedio < 200) rec = '✓ Distancia promedio óptima. Los animales acceden al agua sin esfuerzo significativo.';
  else if (distanciaPromedio < 400) rec = '⚠ Distancia dentro del límite recomendado (250m). Evaluar redistribución para reducir pérdidas marginales.';
  else if (distanciaPromedio < 700) rec = '⚠ Distancia excesiva. Caída de visitas y consumo de agua. Subdividir el lote o agregar puntos de agua.';
  else rec = '✗ Caminata crítica. Pérdida significativa de GDP por menor ingesta de agua y mayor gasto energético. Implementar aguadas distribuidas.';
  d('out_recomendacion').innerText = rec;

  // Actualizar referencias
  d('ref_clima_nombre').innerText = clima.nombre;
  d('ref_clima_factor').innerText = fmt(clima.factorVisitasBase, 1);
  d('ref_visitas').innerText = `${fmt(visitasPorDia, 1)}/día`;

  // Reactivate lucide icons if needed
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
