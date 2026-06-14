#!/usr/bin/env node
// Lit une feuille d'un classeur .ods (OpenDocument Spreadsheet) et la dump en
// tableau de lignes / colonnes, SANS dépendance externe (zip + zlib intégrés).
//
// Usage :
//   node scripts/read-ods-sheet.mjs <fichier.ods> [nomFeuille] [--json]
//
//   - sans nomFeuille : liste les feuilles du classeur.
//   - avec nomFeuille  : affiche les lignes (colonnes A, B, C… alignées).
//   - --json           : sortie JSON (lignes = tableaux de cellules).
//
// Pourquoi un script maison : le classeur source de ce projet
// (assets/decks/Villainous Template_Jules.ods) a une feuille par vilain ; la
// position des colonnes porte le sens (A=nb cartes, C=nom, D=coût…). Voir
// assets/decks/LISEZ-MOI-decks.md pour la convention de colonnes.

import { readFileSync } from 'node:fs';
import { inflateRawSync } from 'node:zlib';

// --- Mini lecteur ZIP : extrait un fichier via le central directory ---------
function readZipEntry(buf, wantedName) {
  // Localise l'End Of Central Directory (signature 0x06054b50) en fin de fichier.
  let eocd = -1;
  for (let i = buf.length - 22; i >= 0; i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('ZIP invalide : EOCD introuvable');
  const cdCount = buf.readUInt16LE(eocd + 10);
  let off = buf.readUInt32LE(eocd + 16);

  for (let n = 0; n < cdCount; n++) {
    if (buf.readUInt32LE(off) !== 0x02014b50) throw new Error('Central dir corrompu');
    const method = buf.readUInt16LE(off + 10);
    const compSize = buf.readUInt32LE(off + 20);
    const nameLen = buf.readUInt16LE(off + 28);
    const extraLen = buf.readUInt16LE(off + 30);
    const commentLen = buf.readUInt16LE(off + 32);
    const localOff = buf.readUInt32LE(off + 42);
    const name = buf.toString('utf8', off + 46, off + 46 + nameLen);

    if (name === wantedName) {
      // Saute l'en-tête local (taille variable) pour atteindre les données.
      const lhNameLen = buf.readUInt16LE(localOff + 26);
      const lhExtraLen = buf.readUInt16LE(localOff + 28);
      const dataStart = localOff + 30 + lhNameLen + lhExtraLen;
      const raw = buf.subarray(dataStart, dataStart + compSize);
      return method === 0 ? raw : inflateRawSync(raw);
    }
    off += 46 + nameLen + extraLen + commentLen;
  }
  throw new Error(`Entrée "${wantedName}" absente du ZIP`);
}

// --- Décodage XML minimal : entités usuelles --------------------------------
function decodeEntities(s) {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&amp;/g, '&'); // en dernier
}

// Texte d'une cellule : concatène les <text:p>, saute de ligne entre eux.
function cellText(cellXml) {
  const paras = [];
  const re = /<text:p\b[^>]*>([\s\S]*?)<\/text:p>|<text:p\b[^>]*\/>/g;
  let m;
  while ((m = re.exec(cellXml))) {
    let inner = m[1] ?? '';
    inner = inner
      .replace(/<text:line-break\s*\/>/g, '\n')
      .replace(/<text:s\s+text:c="(\d+)"\s*\/>/g, (_, c) => ' '.repeat(+c))
      .replace(/<text:s\s*\/>/g, ' ')
      .replace(/<[^>]+>/g, ''); // retire le balisage résiduel (spans…)
    paras.push(decodeEntities(inner));
  }
  return paras.join('\n').trim();
}

function listSheets(xml) {
  const re = /<table:table\b[^>]*\btable:name="([^"]*)"/g;
  const names = [];
  let m;
  while ((m = re.exec(xml))) names.push(decodeEntities(m[1]));
  return names;
}

function extractSheet(xml, sheetName) {
  // Isole le bloc <table:table … name="X"> … </table:table>.
  const startRe = new RegExp(
    `<table:table\\b[^>]*\\btable:name="${sheetName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"[^>]*>`
  );
  const sm = startRe.exec(xml);
  if (!sm) throw new Error(`Feuille "${sheetName}" introuvable`);
  const from = sm.index + sm[0].length;
  const to = xml.indexOf('</table:table>', from);
  const body = xml.slice(from, to);

  const rows = [];
  const rowRe = /<table:table-row\b([^>]*)>([\s\S]*?)<\/table:table-row>/g;
  let rm;
  while ((rm = rowRe.exec(body))) {
    const rowAttrs = rm[1];
    const rowRepeat = +(/table:number-rows-repeated="(\d+)"/.exec(rowAttrs)?.[1] ?? 1);
    const cells = [];
    const cellRe =
      /<table:table-cell\b([^>]*?)(\/>|>([\s\S]*?)<\/table:table-cell>)|<table:covered-table-cell\b([^>]*?)(\/>|>[\s\S]*?<\/table:covered-table-cell>)/g;
    let cm;
    while ((cm = cellRe.exec(rm[2]))) {
      const attrs = cm[1] ?? cm[4] ?? '';
      const inner = cm[3] ?? '';
      const repeat = +(/table:number-columns-repeated="(\d+)"/.exec(attrs)?.[1] ?? 1);
      const text = inner ? cellText(inner) : '';
      // Évite de gonfler la ligne avec des milliers de cellules vides finales.
      const capped = Math.min(repeat, 200);
      for (let i = 0; i < capped; i++) cells.push(text);
    }
    // Retire les cellules vides en fin de ligne (padding ODS).
    while (cells.length && cells[cells.length - 1] === '') cells.pop();
    const rowCapped = Math.min(rowRepeat, 1000);
    for (let r = 0; r < rowCapped; r++) rows.push([...cells]);
  }
  // Retire les lignes vides finales.
  while (rows.length && rows[rows.length - 1].length === 0) rows.pop();
  return rows;
}

// --- Main -------------------------------------------------------------------
const [, , file, sheet, ...rest] = process.argv;
if (!file) {
  console.error('Usage : node scripts/read-ods-sheet.mjs <fichier.ods> [feuille] [--json]');
  process.exit(1);
}
const asJson = rest.includes('--json') || sheet === '--json';
const sheetName = sheet && sheet !== '--json' ? sheet : null;

const buf = readFileSync(file);
const xml = readZipEntry(buf, 'content.xml').toString('utf8');

if (!sheetName) {
  const names = listSheets(xml);
  if (asJson) console.log(JSON.stringify(names, null, 2));
  else {
    console.log(`Feuilles (${names.length}) :`);
    for (const n of names) console.log('  - ' + n);
  }
  process.exit(0);
}

const rows = extractSheet(xml, sheetName);
if (asJson) {
  console.log(JSON.stringify(rows, null, 2));
} else {
  const colLetter = (i) => {
    let s = '';
    i++;
    while (i > 0) { const r = (i - 1) % 26; s = String.fromCharCode(65 + r) + s; i = Math.floor((i - 1) / 26); }
    return s;
  };
  rows.forEach((row, idx) => {
    if (row.length === 0) { console.log(`L${idx + 1}: (vide)`); return; }
    const parts = row.map((c, ci) => `${colLetter(ci)}=${JSON.stringify(c)}`);
    console.log(`L${idx + 1}: ${parts.join(' | ')}`);
  });
}
