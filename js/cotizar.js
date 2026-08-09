/* ═══════════════════════════════════════════
   COTIZAR — mapa satelital + formulario de presupuesto
   ═══════════════════════════════════════════ */

const QUOTE_ENDPOINT = 'https://fotmwptcuqvemfgrygjr.supabase.co/functions/v1/quote_request';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZvdG13cHRjdXF2ZW1mZ3J5Z2pyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk0OTA4ODEsImV4cCI6MjA5NTA2Njg4MX0.Mbb7jVL4ydGj0cGvEn-9I_UJSmC6I7FNfvcgIkvyTXA';
const WHATSAPP_NUMBER = '5491168452098';

document.addEventListener('DOMContentLoaded', () => {

  /* ─── Mapa base (satelital Esri, sin API key) ─── */
  const map = L.map('map', { zoomControl: true }).setView([-34.6, -64.0], 5);

  L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    attribution: 'Tiles &copy; Esri',
    maxZoom: 19,
  }).addTo(map);
  L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}', {
    maxZoom: 19, opacity: 0.9,
  }).addTo(map);

  /* ─── Estado de pines ─── */
  let mode = null; // 'aguada' | 'internet' | null
  const points = { aguada: [], internet: [] };

  function makeIcon(type) {
    const emoji = type === 'aguada' ? '💧' : '📶';
    return L.divIcon({
      className: '',
      html: `<div class="pin pin--${type}"><div class="pin__dot"><span>${emoji}</span></div></div>`,
      iconSize: [30, 42], iconAnchor: [15, 38],
    });
  }

  function addPoint(type, latlng) {
    const marker = L.marker(latlng, { icon: makeIcon(type), draggable: true }).addTo(map);
    const entry = { marker, lat: latlng.lat, lng: latlng.lng };
    marker.on('dragend', () => {
      const p = marker.getLatLng();
      entry.lat = p.lat; entry.lng = p.lng;
    });
    marker.on('dblclick', () => removePoint(type, entry));
    points[type].push(entry);
    renderList();
  }

  function removePoint(type, entry) {
    map.removeLayer(entry.marker);
    points[type] = points[type].filter((e) => e !== entry);
    renderList();
  }

  function renderList() {
    const el = document.getElementById('points-summary');
    const groups = [
      { key: 'aguada', label: `💧 Aguadas a monitorear (${points.aguada.length})` },
      { key: 'internet', label: `📶 Puntos con señal (${points.internet.length})` },
    ];
    let html = '';
    let any = false;
    groups.forEach((g) => {
      if (points[g.key].length === 0) return;
      any = true;
      html += `<div class="points-group__label">${g.label}</div>`;
      points[g.key].forEach((entry, i) => {
        html += `<div class="point-row"><span>#${i + 1} — ${entry.lat.toFixed(5)}, ${entry.lng.toFixed(5)}</span>
          <button type="button" data-type="${g.key}" data-idx="${i}" aria-label="Quitar"><i data-lucide="x"></i></button></div>`;
      });
    });
    el.innerHTML = any ? html : '<div class="points-empty">Todavía no marcaste ningún punto en el mapa.</div>';
    if (window.lucide) lucide.createIcons();
    el.querySelectorAll('button[data-type]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const type = btn.dataset.type;
        const idx = Number(btn.dataset.idx);
        removePoint(type, points[type][idx]);
      });
    });
  }
  renderList();

  map.on('click', (e) => {
    if (!mode) return;
    addPoint(mode, e.latlng);
  });

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
  let searchTimer = null;

  async function runSearch(q) {
    if (!q || q.length < 3) { searchResults.classList.remove('open'); return; }
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&limit=5&countrycodes=ar&q=${encodeURIComponent(q)}`;
      const res = await fetch(url, { headers: { 'Accept-Language': 'es' } });
      const data = await res.json();
      if (!data.length) { searchResults.innerHTML = '<div>Sin resultados</div>'; searchResults.classList.add('open'); return; }
      searchResults.innerHTML = data.map((r, i) =>
        `<div data-i="${i}">${r.display_name}</div>`).join('');
      searchResults.classList.add('open');
      searchResults.querySelectorAll('div[data-i]').forEach((div) => {
        div.addEventListener('click', () => {
          const r = data[Number(div.dataset.i)];
          map.flyTo([Number(r.lat), Number(r.lon)], 14);
          searchResults.classList.remove('open');
        });
      });
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

  /* ─── Envío del formulario ─── */
  const form = document.getElementById('quote-form');
  const msgEl = document.getElementById('form-msg');
  const submitBtn = document.getElementById('submit-btn');

  function waLink(name, phone, email, comment) {
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

    const payload = {
      name, phone, email, comment, website: honeypot,
      aguadaPoints: points.aguada.map((p) => ({ lat: p.lat, lng: p.lng })),
      internetPoints: points.internet.map((p) => ({ lat: p.lat, lng: p.lng })),
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
          <a class="btn btn--primary" target="_blank" href="${waLink(name, phone, email, comment)}">
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
