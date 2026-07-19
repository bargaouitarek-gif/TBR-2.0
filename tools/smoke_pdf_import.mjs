import { chromium } from 'playwright';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import fs from 'node:fs/promises';

const pdf = await PDFDocument.create();
const pagePdf = pdf.addPage([595, 842]);
const font = await pdf.embedFont(StandardFonts.Helvetica);
const lines = [
  "PROCES VERBAL D'INSTALLATION 16/07/2026",
  "N CLIENT : 2212983",
  "Nom Prenom : JAMAL BOUAISS Date 16/07/2026",
  "SECURITE START PRO - ENGAGEMENT 36 MOIS",
  "200 HT DE REMISE SUR L'INSTALLATION",
  "6 MOIS D'ABONNEMENT - 50%",
  "PACK SECURITE INTEGRALE MISE EN FUITE - I1",
  "REMISE DE 50% SUR LE PACK I1",
  "PACK VOLUMETRIQUE - V4",
  "REMISE DE 50% SUR LE PACK V4"
];
let y = 790;
for (const line of lines) {
  pagePdf.drawText(line, { x: 40, y, size: 12, font });
  y -= 24;
}
const fixture = '/tmp/tbr-sample-pv.pdf';
await fs.writeFile(fixture, await pdf.save());

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1180, height: 1600 } });
const pageErrors = [];
page.on('pageerror', (error) => pageErrors.push(String(error)));
let failure = null;

try {
  await page.goto('http://127.0.0.1:4173', { waitUntil: 'domcontentloaded', timeout: 60000 });

  const later = page.getByRole('button', { name: 'Plus tard', exact: true });
  if (await later.isVisible({ timeout: 8000 }).catch(() => false)) await later.click();

  const saisie = page.getByText('Saisie', { exact: true }).last();
  await saisie.waitFor({ state: 'visible', timeout: 30000 });
  await saisie.click();

  await page.getByRole('button', { name: /Saisir à la main/i }).waitFor({ state: 'visible', timeout: 30000 });
  await page.getByRole('button', { name: /Importer un PDF/i }).waitFor({ state: 'visible', timeout: 20000 });

  await page.locator('#tbr-pdf-file').setInputFiles(fixture);
  await page.getByText('Fiche comprise par TBR').waitFor({ state: 'visible', timeout: 30000 });

  const reviewText = await page.locator('#tbr-sheet').innerText();
  for (const expected of ['2212983', 'FI200 START', 'Oui', '6MO5POSTART', 'I1 · Remise -50%', 'V4 · Remise -50%']) {
    if (!reviewText.includes(expected)) throw new Error(`Review missing: ${expected}\n${reviewText}`);
  }

  await page.getByRole('button', { name: 'VD', exact: true }).click();
  await page.getByRole('button', { name: /Préremplir la fiche/i }).click();
  await page.locator('#tbr-sale-form-top').waitFor({ state: 'visible', timeout: 20000 });

  const clientValue = await page.locator('input[placeholder="Ex: 2130198"]').inputValue();
  if (clientValue !== '2212983') throw new Error(`Wrong client value: ${clientValue}`);

  const promoValue = await page.locator('input[placeholder*="6MO5POSTART"]').inputValue();
  if (promoValue !== '6MO5POSTART') throw new Error(`Wrong promo value: ${promoValue}`);

  const bodyText = await page.locator('body').innerText();
  for (const expected of ['JAMAL BOUAISS', 'I1 — Intégrale 1', 'V4', 'FICHE PRÉREMPLIE — NE PAS ENREGISTRER']) {
    if (!bodyText.includes(expected)) throw new Error(`Prefill missing: ${expected}`);
  }

  if (pageErrors.length) throw new Error(`Page errors: ${pageErrors.join(' | ')}`);
  console.log('TBR PDF import smoke test passed');
} catch (error) {
  failure = error;
  await fs.writeFile('tbr-smoke-error.txt', String(error?.stack || error));
  console.error(error);
} finally {
  await page.screenshot({ path: 'tbr-pdf-smoke.png', fullPage: true }).catch(() => {});
  await browser.close();
}

if (failure) throw failure;
