/**
 * AguaSens — Exportador de carruseles a PNG 1080×1350 listos para Instagram.
 *
 *   npm i -D playwright        (o: npx playwright@latest install chromium)
 *   node export-png.mjs
 *
 * Usa el Edge/Chrome ya instalado en el sistema si está disponible, así evita
 * descargar Chromium. Genera png/post-N-nombre-01.png, -02.png, …
 */
import { chromium } from 'playwright';
import { mkdir, readdir } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(HERE, 'png');

const WIDTH = 1080;
const HEIGHT = 1350;
const SCALE = 1; // 1 = 1080×1350 exactos. Poné 2 si querés el doble de resolución.

// Canales a probar, en orden. El último (undefined) usa el Chromium de Playwright.
const CHANNELS = ['msedge', 'chrome', undefined];

async function launch() {
  let lastError;
  for (const channel of CHANNELS) {
    try {
      const browser = await chromium.launch(channel ? { channel } : {});
      console.log(`Navegador: ${channel ?? 'chromium (Playwright)'}`);
      return browser;
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError;
}

async function main() {
  const posts = (await readdir(HERE))
    .filter((f) => /^post-.*\.html$/.test(f))
    .sort();

  if (posts.length === 0) {
    console.error('No se encontró ningún archivo post-*.html en esta carpeta.');
    process.exit(1);
  }

  await mkdir(OUT, { recursive: true });

  const browser = await launch();
  const context = await browser.newContext({
    viewport: { width: WIDTH, height: HEIGHT },
    deviceScaleFactor: SCALE,
  });
  const page = await context.newPage();

  let total = 0;

  for (const file of posts) {
    const name = file.replace(/\.html$/, '');
    await page.goto(pathToFileURL(path.join(HERE, file)).href, { waitUntil: 'networkidle' });

    // Saca el cromo de previsualización y desactiva el zoom responsive
    await page.evaluate(() => document.body.classList.add('export-mode'));
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(400);

    const slides = await page.locator('.slide').all();
    for (const [i, slide] of slides.entries()) {
      const n = String(i + 1).padStart(2, '0');
      const out = path.join(OUT, `${name}-${n}.png`);
      await slide.screenshot({ path: out });
      total++;
    }
    console.log(`  ${file} → ${slides.length} slides`);
  }

  await browser.close();
  console.log(`\nListo: ${total} PNG de ${WIDTH}×${HEIGHT} px en ${OUT}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
