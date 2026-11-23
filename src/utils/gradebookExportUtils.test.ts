import test from 'node:test';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import { PDFDocument } from 'pdf-lib';
import {
  buildGradebookClipboardPayloads,
  buildGradebookDocxBytes,
  buildGradebookPdfBytes,
  sanitizeExportFileName,
  sanitizeTextForPdfWinAnsi,
  type GradebookExportDataset,
} from './gradebookExportUtils';

const sampleDataset: GradebookExportDataset = {
  fileBaseName: 'Releve_Notes_Mathématiques_BTS 2 • Groupe 2',
  title: 'RELEVÉ DE NOTES — MATHÉMATIQUES',
  subtitle: 'BTS 2 • GROUPE 2 ELECTROTECHNIQUE • Trimestre 1 • 2026 - 2027',
  schoolName: 'CME',
  metaBadges: ['Coeff 2', 'Barème /20', '10 élèves', 'Taux de réussite : 90 %'],
  headers: ['Rang', 'Nom & Prénom', 'NOTE 1 (/20)', 'NOTE 2 (/20)', 'NOTE 3 (/20)', 'Moyenne (/20)', 'Mention'],
  rows: [
    ['1er', 'KOUASSI Aya Mariam', '16.5/20', '19/20', '17/20', '17.50/20', 'Très bien'],
    ['2e', "N'GUESSAN Affoué Clarisse", '15/20', '16/20', '15.5/20', '15.50/20', 'Bien'],
    ['3e', 'BÉDIÉ Jean-Marc', '14/20', '13.5/20', '14.5/20', '14.00/20', 'Bien'],
  ],
  footerRow: ['', 'MOYENNE DE LA CLASSE', '', '', '', '15.67/20', 'Réussite : 100 %'],
  summaryNote: 'Moyenne de la classe : 15.67/20 • 3/3 élèves au-dessus de la moyenne',
  nameColumnIndex: 1,
};

test('sanitizeExportFileName et sanitizeTextForPdfWinAnsi préservent les accents français et neutralisent les symboles hors WinAnsi', () => {
  assert.equal(
    sanitizeExportFileName('Relevé Notes • Mathématiques (BTS 2) / T1'),
    'Releve_Notes_Mathematiques_BTS_2_T1'
  );
  const winAnsi = sanitizeTextForPdfWinAnsi('BÉDIÉ • Moy. × Coeff → Très bien — « 16,5/20 » 🚀');
  assert.ok(winAnsi.includes('BÉDIÉ'));
  assert.ok(winAnsi.includes('Très bien'));
  assert.ok(winAnsi.includes('x'));
  assert.ok(winAnsi.includes('->'));
  assert.ok(!winAnsi.includes('🚀'));
});

test('buildGradebookPdfBytes génère un vrai PDF vectoriel valide (multi-pages + paysage auto)', async () => {
  const manyRows = Array.from({ length: 48 }, (_, i) => [
    `${i + 1}e`,
    `ÉLÈVE Test N°${i + 1} — KOUASSI`,
    '15/20',
    '16/20',
    '14.5/20',
    '15.17/20',
    'Bien',
  ]);
  const bytes = await buildGradebookPdfBytes({
    ...sampleDataset,
    rows: manyRows,
  });

  assert.ok(bytes.byteLength > 1500);
  assert.equal(Buffer.from(bytes.slice(0, 5)).toString('ascii'), '%PDF-');

  const loaded = await PDFDocument.load(bytes);
  assert.ok(loaded.getPageCount() >= 2, '48 lignes doivent paginer automatiquement sur 2+ pages');
  const firstPage = loaded.getPage(0);
  // 7 colonnes -> paysage A4 (largeur > hauteur)
  assert.ok(firstPage.getWidth() > firstPage.getHeight());
});

test('buildGradebookDocxBytes génère un vrai document Word (.docx OOXML) valide avec accents et tableau structuré', async () => {
  const bytes = await buildGradebookDocxBytes(sampleDataset);
  assert.ok(bytes.byteLength > 800);
  // Signature ZIP PK\x03\x04
  assert.equal(bytes[0], 0x50);
  assert.equal(bytes[1], 0x4b);

  const zip = await JSZip.loadAsync(bytes);
  assert.ok(zip.file('[Content_Types].xml'));
  assert.ok(zip.file('_rels/.rels'));
  assert.ok(zip.file('word/styles.xml'));
  const docXmlFile = zip.file('word/document.xml');
  assert.ok(docXmlFile);

  const docXml = await docXmlFile.async('string');
  assert.ok(docXml.includes('RELEVÉ DE NOTES — MATHÉMATIQUES'));
  assert.ok(docXml.includes('KOUASSI Aya Mariam'));
  assert.ok(docXml.includes('N&apos;GUESSAN Affoué Clarisse'));
  assert.ok(docXml.includes('MOYENNE DE LA CLASSE'));
  assert.ok(docXml.includes('<w:tblHeader/>'));
  assert.ok(docXml.includes('w:orient="landscape"'));
});

test('buildGradebookClipboardPayloads produit du TSV (Excel) et du HTML échappé (Word/Docs)', () => {
  const { plainTsv, html } = buildGradebookClipboardPayloads({
    ...sampleDataset,
    rows: [['1er', '<script>alert(1)</script> KOUASSI', '15/20', '16/20', '17/20', '16.00/20', 'Très bien']],
  });

  const tsvLines = plainTsv.split('\n');
  assert.equal(tsvLines.length, 3); // header + 1 student + footer
  assert.ok(tsvLines[0].includes('Nom & Prénom\tNOTE 1 (/20)'));
  assert.ok(tsvLines[2].includes('MOYENNE DE LA CLASSE'));

  assert.ok(html.includes('<table'));
  assert.ok(!html.includes('<script>'), 'Tout HTML dangereux doit être échappé');
  assert.ok(html.includes('&lt;script&gt;'));
});
