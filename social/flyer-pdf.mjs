/**
 * AguaSens — Genera el flyer institucional en PDF A4 (2 carillas).
 *
 *   node flyer-pdf.mjs
 *
 * Alternativa al Ctrl+P del navegador: deja el archivo listo, con márgenes en
 * cero y fondos impresos, sin depender de la configuración del diálogo.
 */
import { chromium } from 'playwright';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(HERE, 'AguaSens-flyer.pdf');

const CHANNELS = ['msedge', 'chrome', undefined];

async function launch() {
  let lastError;
  for (const channel of CHANNELS) {
    try {
      return await chromium.launch(channel ? { channel } : {});
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError;
}

const browser = await launch();
const page = await browser.newPage();
await page.goto(pathToFileURL(path.join(HERE, 'flyer.html')).href, { waitUntil: 'networkidle' });
await page.evaluate(() => document.fonts.ready);

const carillas = await page.locator('.page').count();
await page.pdf({ path: OUT, format: 'A4', printBackground: true, margin: { top: 0, right: 0, bottom: 0, left: 0 } });
await browser.close();

console.log(`Listo: ${carillas} carillas A4 en ${OUT}`);
