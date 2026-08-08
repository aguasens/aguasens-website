# Carruseles de Instagram — AguaSens

Cinco carruseles armados con el contenido y el sistema visual del sitio.
Lienzo: **1080 × 1350 px (4:5)**, el formato que más pantalla ocupa en el feed.

| Archivo | Tema | Slides |
|---|---|---|
| `post-1-nodos.html` | Los cuatro nodos del sistema | 7 |
| `post-2-como-funciona.html` | Cómo funciona, en 3 pasos | 6 |
| `post-3-beneficios.html` | Todo lo que resuelve + tradicional vs AguaSens | 7 |
| `post-4-agua-critica.html` | El agua, el nutriente más crítico (datos con fuentes) | 7 |
| `post-5-sensores-app.html` | Los 8 sensores y la app | 8 |
| `post-6-sistema-completo.html` | **El sistema completo — pensado para pauta paga** | 10 |

El post 6 se explica solo: arranca del problema, presenta la marca desde cero y
cierra en WhatsApp. Es el que conviene usar como anuncio; los otros cinco son
para el feed orgánico.

`captions.md` tiene el pie de foto y los hashtags de cada post, listos para pegar.

---

## Flyer institucional A4

`flyer.html` — **2 carillas A4** (210 × 297 mm) que cuentan qué es AguaSens y
cómo funciona. Mismo contenido que el carrusel 6 pero en formato imprimible,
para entregar en mano, mandar por mail o dejar en una expo.

- **Carilla 1:** hero, qué es AguaSens (nodos + gateway + app), los cuatro
  nodos con lo que mide cada uno, y la base común a todos.
- **Carilla 2:** cómo funciona en 3 pasos, la app con la captura real y las
  8 variables, los datos duros con fuentes, y el bloque de contacto.

Exportar por navegador: `Ctrl` + `P` → **Guardar como PDF** → Tamaño **A4** →
Márgenes **Ninguno** → Escala **100 %** → tildar **Gráficos de fondo**.

O directamente, sin tocar el diálogo de impresión:

```
node flyer-pdf.mjs
```

Genera `AguaSens-flyer.pdf` con las 2 carillas exactas. Los estilos están en
`flyer.css` (aparte de `carrusel.css`, porque la escala tipográfica de impresión
es distinta a la de Instagram).

Si agregás contenido, ojo: cada `.page` mide 297 mm fijos y lo que sobra se
recorta. Después de editar, volvé a correr `node flyer-pdf.mjs` y verificá que
sigan siendo 2 páginas y que el bloque de contacto entre entero.

---

## Ver los carruseles

Doble clic en cualquier `post-*.html`. Se abre en el navegador con los slides
apilados y una barra arriba con las instrucciones. Esa barra y los rótulos
"SLIDE N" **no** salen ni en el PDF ni en los PNG.

## Opción A — Exportar a PDF

En Chrome o Edge: `Ctrl` + `P` y configurar así:

- Destino: **Guardar como PDF**
- Márgenes: **Ninguno**
- Escala: **100 %**
- Tildar **Gráficos de fondo** ← imprescindible, si no salen los slides en blanco

Cada slide sale como una página en proporción 4:5. Después podés exportar las
páginas a imagen desde cualquier visor de PDF.

## Opción B — Exportar a PNG exactos (recomendado)

Genera un PNG de 1080 × 1350 px por slide, listo para subir sin recortar.
Requiere Node (ya instalado) y Playwright (ya instalado en esta carpeta):

```
node export-png.mjs
```

Los archivos quedan en `png/`, numerados en orden: `post-1-nodos-01.png`,
`post-1-nodos-02.png`, etc. Subilos a Instagram en ese orden.

Si querés el doble de resolución (2160 × 2700, útil si después vas a recortar),
cambiá `const SCALE = 1` por `const SCALE = 2` en `export-png.mjs`.

---

## Editar el contenido

- **Textos:** están directamente en cada `post-*.html`, en castellano y en
  orden de slides. Cada slide es un `<section class="slide">`.
- **Colores, tipografías y componentes:** `carrusel.css`. Los tokens son los
  mismos de `../css/styles.css` (navy `#152238`, azul `#3472B5`, acento
  `#5a9bd5`, crema `#f0f4f8`; Playfair Display / Barlow / Barlow Condensed).
- **Iconos:** `icons.js`, un sprite SVG compartido por los cinco archivos.
- **Fotos:** salen de `../img/`. No hay copias duplicadas.

Si agregás o sacás slides, los puntos de progreso del pie se recalculan solos
(`pips.js`).

Los precios de venta **no** aparecen en ningún slide: la idea es que la consulta
llegue por WhatsApp.

---

## Notas

- Las tipografías se cargan desde Google Fonts, así que la primera vez que abrís
  un archivo necesitás conexión. Después quedan en la caché del navegador.
- Esta carpeta **no está enlazada desde el sitio** ni figura en `sitemap.xml`.
  Si subís el sitio por FTP, podés excluirla — y en particular excluí
  `node_modules/` (17 MB de la herramienta de exportación, no hace falta en el
  servidor). Borrar `node_modules/` sólo rompe `export-png.mjs`; los HTML y la
  exportación a PDF siguen funcionando igual.
