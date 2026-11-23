import { PDFDocument, StandardFonts, rgb, type PDFFont } from 'pdf-lib';
import JSZip from 'jszip';

export interface GradebookExportDataset {
  /** Base filename without extension (auto-sanitized) */
  fileBaseName: string;
  /** Document title shown at top of PDF / Word */
  title: string;
  /** Secondary line (class, term, school year, etc.) */
  subtitle?: string;
  /** School / institution name */
  schoolName?: string;
  /** Short badges shown under the title (e.g. "Coeff 2", "Barème /20", "10 élèves") */
  metaBadges?: string[];
  /** Column headers */
  headers: string[];
  /** Table body rows (each row aligns with headers) */
  rows: string[][];
  /** Optional summary / class-average row rendered in bold highlight at the bottom */
  footerRow?: string[];
  /** Optional summary sentence under the table */
  summaryNote?: string;
  /** Zero-based index of the student name column (gets wider layout + left alignment) */
  nameColumnIndex?: number;
}

export function sanitizeExportFileName(raw: string): string {
  const cleaned = String(raw || 'Tableau_Moyennes')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
  return (cleaned || 'Tableau_Moyennes').slice(0, 110);
}

/**
 * Prépare un texte pour l'encodage WinAnsi utilisé par les polices standards PDF (Helvetica) :
 * conserve intégralement tous les accents français (À-ÿ, œ, Œ, €) tout en convertissant
 * proprement les symboles hors WinAnsi (×, →, •, —, guillemets typographiques...) afin
 * qu'aucune erreur d'encodage ne puisse jamais interrompre la génération PDF.
 */
export function sanitizeTextForPdfWinAnsi(text: unknown): string {
  const str = String(text ?? '')
    .replace(/\r?\n+/g, ' ')
    .replace(/\u00a0/g, ' ')
    .replace(/[’‘]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, '-')
    .replace(/…/g, '...')
    .replace(/→/g, '->')
    .replace(/←/g, '<-')
    .replace(/×/g, 'x')
    .replace(/•/g, '|')
    .replace(/≥/g, '>=')
    .replace(/≤/g, '<=');

  let out = '';
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    // ASCII imprimable + Latin-1 étendu (accents français) + € (0x20AC), œ (0x0153), Œ (0x0152), Ÿ (0x0178)
    if (
      (code >= 0x20 && code <= 0x7e) ||
      (code >= 0xa0 && code <= 0xff) ||
      code === 0x20ac ||
      code === 0x0152 ||
      code === 0x0153 ||
      code === 0x0178
    ) {
      out += str[i];
    }
  }
  return out.replace(/\s+/g, ' ').trim();
}

function escapeXml(text: unknown): string {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function escapeHtml(text: unknown): string {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function truncateTextToFitWidth(
  text: string,
  font: PDFFont,
  fontSize: number,
  maxWidth: number
): string {
  const clean = sanitizeTextForPdfWinAnsi(text);
  if (!clean) return '';
  if (font.widthOfTextAtSize(clean, fontSize) <= maxWidth) return clean;
  const ellipsis = '...';
  let end = clean.length;
  while (end > 1) {
    const candidate = `${clean.slice(0, end).trimEnd()}${ellipsis}`;
    if (font.widthOfTextAtSize(candidate, fontSize) <= maxWidth) {
      return candidate;
    }
    end -= 1;
  }
  return clean.slice(0, 1);
}

function computeColumnWeights(headers: string[], nameColumnIndex?: number): number[] {
  return headers.map((h, idx) => {
    const norm = h
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
    if (idx === nameColumnIndex || norm.includes('nom')) return 2.85;
    if (norm === 'rang' || norm === '#') return 0.72;
    if (norm.includes('matricule')) return 1.3;
    if (norm.includes('mention') || norm.includes('decision')) return 1.45;
    if (norm.includes('moyenne') || norm.includes('total')) return 1.25;
    return 1.0;
  });
}

function triggerBlobDownload(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

/**
 * Génère un fichier PDF vectoriel haute netteté (.pdf) avec pagination automatique,
 * orientation paysage/portrait adaptée au nombre de colonnes et en-têtes répétés par page.
 */
export async function buildGradebookPdfBytes(
  dataset: GradebookExportDataset
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const colCount = Math.max(1, dataset.headers.length);
  const isLandscape = colCount >= 6;
  const pageW = isLandscape ? 841.89 : 595.28;
  const pageH = isLandscape ? 595.28 : 841.89;
  const marginX = 28;
  const marginTop = 28;
  const marginBottom = 34;
  const contentW = pageW - marginX * 2;

  const weights = computeColumnWeights(dataset.headers, dataset.nameColumnIndex);
  const totalWeight = weights.reduce((acc, w) => acc + w, 0) || colCount;
  const colWidths = weights.map((w) => (w / totalWeight) * contentW);

  const headerFontSize = colCount > 12 ? 6.5 : colCount > 9 ? 7.2 : 8.2;
  const cellFontSize = colCount > 12 ? 6.8 : colCount > 9 ? 7.6 : 8.5;
  const headerRowH = 24;
  const bodyRowH = 19;

  const dateLabel = new Date().toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

  const allBodyRows: Array<{ cells: string[]; isFooter: boolean }> = dataset.rows.map((r) => ({
    cells: dataset.headers.map((_, idx) => String(r[idx] ?? '')),
    isFooter: false,
  }));
  if (dataset.footerRow && dataset.footerRow.length > 0) {
    allBodyRows.push({
      cells: dataset.headers.map((_, idx) => String(dataset.footerRow?.[idx] ?? '')),
      isFooter: true,
    });
  }

  const pages: Array<ReturnType<typeof pdfDoc.addPage>> = [];

  const drawPageChromeAndTableHeader = (isFirstPage: boolean): { page: ReturnType<typeof pdfDoc.addPage>; cursorY: number } => {
    const page = pdfDoc.addPage([pageW, pageH]);
    pages.push(page);
    let cursorY = pageH - marginTop;

    if (isFirstPage) {
      // Bandeau officiel en-tête bleu marine
      const bannerH = dataset.metaBadges && dataset.metaBadges.length > 0 ? 54 : 44;
      page.drawRectangle({
        x: marginX,
        y: cursorY - bannerH,
        width: contentW,
        height: bannerH,
        color: rgb(0.08, 0.17, 0.32),
      });

      const titleText = sanitizeTextForPdfWinAnsi(dataset.title || 'RELEVÉ DE MOYENNES');
      page.drawText(truncateTextToFitWidth(titleText, fontBold, 12.5, contentW - 110), {
        x: marginX + 12,
        y: cursorY - 19,
        size: 12.5,
        font: fontBold,
        color: rgb(1, 1, 1),
      });

      const dateStr = sanitizeTextForPdfWinAnsi(`Édité le ${dateLabel}`);
      const dateW = fontRegular.widthOfTextAtSize(dateStr, 8);
      page.drawText(dateStr, {
        x: marginX + contentW - dateW - 12,
        y: cursorY - 18,
        size: 8,
        font: fontRegular,
        color: rgb(0.78, 0.86, 0.96),
      });

      const subParts = [dataset.schoolName, dataset.subtitle].filter(Boolean).join('  |  ');
      if (subParts) {
        page.drawText(truncateTextToFitWidth(subParts, fontRegular, 8.5, contentW - 24), {
          x: marginX + 12,
          y: cursorY - 33,
          size: 8.5,
          font: fontRegular,
          color: rgb(0.84, 0.9, 0.98),
        });
      }

      if (dataset.metaBadges && dataset.metaBadges.length > 0) {
        const badgeLine = sanitizeTextForPdfWinAnsi(dataset.metaBadges.join('   |   '));
        page.drawText(truncateTextToFitWidth(badgeLine, fontBold, 7.6, contentW - 24), {
          x: marginX + 12,
          y: cursorY - 46,
          size: 7.6,
          font: fontBold,
          color: rgb(0.56, 0.82, 0.98),
        });
      }

      cursorY -= bannerH + 10;
    } else {
      const contTitle = sanitizeTextForPdfWinAnsi(`${dataset.title} (suite)`);
      page.drawText(truncateTextToFitWidth(contTitle, fontBold, 9.5, contentW), {
        x: marginX,
        y: cursorY - 12,
        size: 9.5,
        font: fontBold,
        color: rgb(0.12, 0.2, 0.34),
      });
      cursorY -= 20;
    }

    // Ligne d'en-tête du tableau
    page.drawRectangle({
      x: marginX,
      y: cursorY - headerRowH,
      width: contentW,
      height: headerRowH,
      color: rgb(0.13, 0.22, 0.36),
    });

    let colX = marginX;
    for (let c = 0; c < colCount; c++) {
      const colW = colWidths[c];
      const label = truncateTextToFitWidth(
        dataset.headers[c] || '',
        fontBold,
        headerFontSize,
        Math.max(8, colW - 6)
      );
      const isNameCol = c === dataset.nameColumnIndex;
      const textW = fontBold.widthOfTextAtSize(label, headerFontSize);
      const tx = isNameCol ? colX + 4 : colX + Math.max(2, (colW - textW) / 2);
      page.drawText(label, {
        x: tx,
        y: cursorY - headerRowH / 2 - headerFontSize / 3,
        size: headerFontSize,
        font: fontBold,
        color: rgb(1, 1, 1),
      });

      // Séparateur vertical subtil
      if (c > 0) {
        page.drawLine({
          start: { x: colX, y: cursorY },
          end: { x: colX, y: cursorY - headerRowH },
          thickness: 0.4,
          color: rgb(0.32, 0.43, 0.58),
        });
      }
      colX += colW;
    }

    cursorY -= headerRowH;
    return { page, cursorY };
  };

  let { page: currentPage, cursorY } = drawPageChromeAndTableHeader(true);

  for (let rIdx = 0; rIdx < allBodyRows.length; rIdx++) {
    const rowObj = allBodyRows[rIdx];
    const neededH = rowObj.isFooter ? bodyRowH + 2 : bodyRowH;

    if (cursorY - neededH < marginBottom + 16) {
      const next = drawPageChromeAndTableHeader(false);
      currentPage = next.page;
      cursorY = next.cursorY;
    }

    const bgColor = rowObj.isFooter
      ? rgb(0.91, 0.95, 0.99)
      : rIdx % 2 === 1
      ? rgb(0.97, 0.98, 0.99)
      : rgb(1, 1, 1);

    currentPage.drawRectangle({
      x: marginX,
      y: cursorY - neededH,
      width: contentW,
      height: neededH,
      color: bgColor,
      borderColor: rgb(0.82, 0.86, 0.91),
      borderWidth: 0.45,
    });

    let colX = marginX;
    for (let c = 0; c < colCount; c++) {
      const colW = colWidths[c];
      const cellVal = rowObj.cells[c] || '';
      const isNameCol = c === dataset.nameColumnIndex;
      const isHighlightCol = rowObj.isFooter || c === 0 || c >= colCount - 2;
      const activeFont = isHighlightCol ? fontBold : fontRegular;
      const fitted = truncateTextToFitWidth(
        cellVal,
        activeFont,
        cellFontSize,
        Math.max(8, colW - 6)
      );
      const textW = activeFont.widthOfTextAtSize(fitted, cellFontSize);
      const tx = isNameCol ? colX + 4 : colX + Math.max(2, (colW - textW) / 2);

      currentPage.drawText(fitted, {
        x: tx,
        y: cursorY - neededH / 2 - cellFontSize / 3,
        size: cellFontSize,
        font: activeFont,
        color: rowObj.isFooter ? rgb(0.08, 0.2, 0.42) : rgb(0.11, 0.15, 0.23),
      });

      if (c > 0) {
        currentPage.drawLine({
          start: { x: colX, y: cursorY },
          end: { x: colX, y: cursorY - neededH },
          thickness: 0.35,
          color: rgb(0.84, 0.87, 0.91),
        });
      }
      colX += colW;
    }

    cursorY -= neededH;
  }

  if (dataset.summaryNote) {
    if (cursorY - 22 < marginBottom) {
      const next = drawPageChromeAndTableHeader(false);
      currentPage = next.page;
      cursorY = next.cursorY;
    }
    const noteStr = truncateTextToFitWidth(dataset.summaryNote, fontBold, 8.2, contentW);
    currentPage.drawText(noteStr, {
      x: marginX,
      y: cursorY - 15,
      size: 8.2,
      font: fontBold,
      color: rgb(0.14, 0.24, 0.39),
    });
  }

  // Numérotation de pages en pied de page
  const totalPages = pages.length;
  pages.forEach((p, idx) => {
    const footLeft = sanitizeTextForPdfWinAnsi('Généré par StudyCloud • Application Moyennes');
    const footRight = `Page ${idx + 1} / ${totalPages}`;
    const rightW = fontRegular.widthOfTextAtSize(footRight, 7.5);
    p.drawText(footLeft, {
      x: marginX,
      y: 14,
      size: 7.5,
      font: fontRegular,
      color: rgb(0.45, 0.5, 0.58),
    });
    p.drawText(footRight, {
      x: pageW - marginX - rightW,
      y: 14,
      size: 7.5,
      font: fontRegular,
      color: rgb(0.45, 0.5, 0.58),
    });
  });

  return pdfDoc.save();
}

export async function exportGradebookToPdf(dataset: GradebookExportDataset): Promise<void> {
  const bytes = await buildGradebookPdfBytes(dataset);
  const blob = new Blob([bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer], {
    type: 'application/pdf',
  });
  triggerBlobDownload(blob, `${sanitizeExportFileName(dataset.fileBaseName)}.pdf`);
}

/**
 * Génère un document Microsoft Word authentique (.docx / Office Open XML)
 * compatible nativement avec Word, Google Docs et LibreOffice sans aucun avertissement.
 */
export async function buildGradebookDocxBytes(
  dataset: GradebookExportDataset
): Promise<Uint8Array> {
  const colCount = Math.max(1, dataset.headers.length);
  const isLandscape = colCount >= 6;
  // Dimensions A4 en twips (1 pt = 20 twips)
  const pgW = isLandscape ? 16838 : 11906;
  const pgH = isLandscape ? 11906 : 16838;
  const marginTwips = 720; // 0.5 inch
  const usableTwips = pgW - marginTwips * 2;

  const weights = computeColumnWeights(dataset.headers, dataset.nameColumnIndex);
  const totalWeight = weights.reduce((acc, w) => acc + w, 0) || colCount;
  const colWidthsTwips = weights.map((w) => Math.max(480, Math.round((w / totalWeight) * usableTwips)));
  const cellFontHalfPt = colCount > 12 ? 14 : colCount > 9 ? 16 : 18; // 7pt / 8pt / 9pt
  const headerFontHalfPt = colCount > 12 ? 14 : 16;

  const dateLabel = new Date().toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

  const buildCellXml = (
    text: string,
    widthTwips: number,
    opts: { bold?: boolean; fill?: string; color?: string; align?: 'left' | 'center'; fontHalfPt: number }
  ): string => {
    const jc = opts.align === 'left' ? 'left' : 'center';
    const shd = opts.fill ? `<w:shd w:val="clear" w:color="auto" w:fill="${opts.fill}"/>` : '';
    const colorXml = opts.color ? `<w:color w:val="${opts.color}"/>` : '';
    const boldXml = opts.bold ? '<w:b/>' : '';
    return `<w:tc>
      <w:tcPr>
        <w:tcW w:w="${widthTwips}" w:type="dxa"/>
        ${shd}
        <w:vAlign w:val="center"/>
        <w:tcMar>
          <w:top w:w="70" w:type="dxa"/>
          <w:bottom w:w="70" w:type="dxa"/>
          <w:left w:w="80" w:type="dxa"/>
          <w:right w:w="80" w:type="dxa"/>
        </w:tcMar>
      </w:tcPr>
      <w:p>
        <w:pPr><w:spacing w:before="0" w:after="0"/><w:jc w:val="${jc}"/></w:pPr>
        <w:r>
          <w:rPr>
            <w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/>
            ${boldXml}
            ${colorXml}
            <w:sz w:val="${opts.fontHalfPt}"/>
            <w:szCs w:val="${opts.fontHalfPt}"/>
          </w:rPr>
          <w:t xml:space="preserve">${escapeXml(text)}</w:t>
        </w:r>
      </w:p>
    </w:tc>`;
  };

  const gridColsXml = colWidthsTwips.map((w) => `<w:gridCol w:w="${w}"/>`).join('');

  const headerRowXml = `<w:tr>
    <w:trPr><w:tblHeader/><w:cantSplit/></w:trPr>
    ${dataset.headers
      .map((h, idx) =>
        buildCellXml(h, colWidthsTwips[idx], {
          bold: true,
          fill: '1E3A5F',
          color: 'FFFFFF',
          align: idx === dataset.nameColumnIndex ? 'left' : 'center',
          fontHalfPt: headerFontHalfPt,
        })
      )
      .join('')}
  </w:tr>`;

  const bodyRowsXml = dataset.rows
    .map((r, rIdx) => {
      const fill = rIdx % 2 === 1 ? 'F8FAFC' : 'FFFFFF';
      return `<w:tr>
        <w:trPr><w:cantSplit/></w:trPr>
        ${dataset.headers
          .map((_, idx) =>
            buildCellXml(String(r[idx] ?? ''), colWidthsTwips[idx], {
              bold: idx === 0 || idx >= colCount - 2,
              fill,
              color: '1E293B',
              align: idx === dataset.nameColumnIndex ? 'left' : 'center',
              fontHalfPt: cellFontHalfPt,
            })
          )
          .join('')}
      </w:tr>`;
    })
    .join('');

  const footerRowXml =
    dataset.footerRow && dataset.footerRow.length > 0
      ? `<w:tr>
          <w:trPr><w:cantSplit/></w:trPr>
          ${dataset.headers
            .map((_, idx) =>
              buildCellXml(String(dataset.footerRow?.[idx] ?? ''), colWidthsTwips[idx], {
                bold: true,
                fill: 'DBEAFE',
                color: '1E3A8A',
                align: idx === dataset.nameColumnIndex ? 'left' : 'center',
                fontHalfPt: cellFontHalfPt,
              })
            )
            .join('')}
        </w:tr>`
      : '';

  const subtitleParts = [dataset.schoolName, dataset.subtitle].filter(Boolean).join(' • ');
  const badgesLine =
    dataset.metaBadges && dataset.metaBadges.length > 0
      ? `${dataset.metaBadges.join('  •  ')}  •  Édité le ${dateLabel}`
      : `Édité le ${dateLabel}`;

  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p>
      <w:pPr><w:spacing w:before="0" w:after="60"/></w:pPr>
      <w:r>
        <w:rPr>
          <w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/>
          <w:b/>
          <w:color w:val="1E3A5F"/>
          <w:sz w:val="28"/>
        </w:rPr>
        <w:t>${escapeXml(dataset.title || 'RELEVÉ DE MOYENNES')}</w:t>
      </w:r>
    </w:p>
    ${
      subtitleParts
        ? `<w:p>
      <w:pPr><w:spacing w:before="0" w:after="40"/></w:pPr>
      <w:r>
        <w:rPr>
          <w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/>
          <w:color w:val="475569"/>
          <w:sz w:val="20"/>
        </w:rPr>
        <w:t>${escapeXml(subtitleParts)}</w:t>
      </w:r>
    </w:p>`
        : ''
    }
    <w:p>
      <w:pPr><w:spacing w:before="0" w:after="160"/></w:pPr>
      <w:r>
        <w:rPr>
          <w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/>
          <w:b/>
          <w:color w:val="2563EB"/>
          <w:sz w:val="18"/>
        </w:rPr>
        <w:t>${escapeXml(badgesLine)}</w:t>
      </w:r>
    </w:p>
    <w:tbl>
      <w:tblPr>
        <w:tblW w:w="${usableTwips}" w:type="dxa"/>
        <w:tblLayout w:type="fixed"/>
        <w:tblBorders>
          <w:top w:val="single" w:sz="6" w:space="0" w:color="CBD5E1"/>
          <w:left w:val="single" w:sz="6" w:space="0" w:color="CBD5E1"/>
          <w:bottom w:val="single" w:sz="6" w:space="0" w:color="CBD5E1"/>
          <w:right w:val="single" w:sz="6" w:space="0" w:color="CBD5E1"/>
          <w:insideH w:val="single" w:sz="4" w:space="0" w:color="CBD5E1"/>
          <w:insideV w:val="single" w:sz="4" w:space="0" w:color="CBD5E1"/>
        </w:tblBorders>
      </w:tblPr>
      <w:tblGrid>${gridColsXml}</w:tblGrid>
      ${headerRowXml}
      ${bodyRowsXml}
      ${footerRowXml}
    </w:tbl>
    ${
      dataset.summaryNote
        ? `<w:p>
      <w:pPr><w:spacing w:before="140" w:after="40"/></w:pPr>
      <w:r>
        <w:rPr>
          <w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/>
          <w:b/>
          <w:color w:val="1E3A5F"/>
          <w:sz w:val="18"/>
        </w:rPr>
        <w:t>${escapeXml(dataset.summaryNote)}</w:t>
      </w:r>
    </w:p>`
        : ''
    }
    <w:p>
      <w:pPr><w:spacing w:before="120" w:after="0"/></w:pPr>
      <w:r>
        <w:rPr>
          <w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/>
          <w:i/>
          <w:color w:val="94A3B8"/>
          <w:sz w:val="16"/>
        </w:rPr>
        <w:t>Généré par StudyCloud • Application Moyennes</w:t>
      </w:r>
    </w:p>
    <w:sectPr>
      <w:pgSz w:w="${pgW}" w:h="${pgH}"${isLandscape ? ' w:orient="landscape"' : ''}/>
      <w:pgMar w:top="${marginTwips}" w:right="${marginTwips}" w:bottom="${marginTwips}" w:left="${marginTwips}" w:header="400" w:footer="400" w:gutter="0"/>
    </w:sectPr>
  </w:body>
</w:document>`;

  const contentTypesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
</Types>`;

  const relsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

  const docRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;

  const stylesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:docDefaults>
    <w:rPrDefault>
      <w:rPr>
        <w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/>
        <w:sz w:val="20"/>
      </w:rPr>
    </w:rPrDefault>
  </w:docDefaults>
</w:styles>`;

  const zip = new JSZip();
  zip.file('[Content_Types].xml', contentTypesXml);
  zip.file('_rels/.rels', relsXml);
  zip.file('word/_rels/document.xml.rels', docRelsXml);
  zip.file('word/styles.xml', stylesXml);
  zip.file('word/document.xml', documentXml);

  return zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
}

export async function exportGradebookToWord(dataset: GradebookExportDataset): Promise<void> {
  const bytes = await buildGradebookDocxBytes(dataset);
  const blob = new Blob([bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer], {
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  });
  triggerBlobDownload(blob, `${sanitizeExportFileName(dataset.fileBaseName)}.docx`);
}

/**
 * Construit les formats presse-papiers TSV (pour Excel/Sheets) et HTML stylé (pour Word/Docs/Mail).
 */
export function buildGradebookClipboardPayloads(dataset: GradebookExportDataset): {
  plainTsv: string;
  html: string;
} {
  const sanitizeTsvCell = (v: unknown) =>
    String(v ?? '')
      .replace(/\t+/g, ' ')
      .replace(/\r?\n+/g, ' ')
      .trim();

  const lines: string[] = [
    dataset.headers.map(sanitizeTsvCell).join('\t'),
    ...dataset.rows.map((r) => dataset.headers.map((_, idx) => sanitizeTsvCell(r[idx])).join('\t')),
  ];
  if (dataset.footerRow && dataset.footerRow.length > 0) {
    lines.push(dataset.headers.map((_, idx) => sanitizeTsvCell(dataset.footerRow?.[idx])).join('\t'));
  }
  const plainTsv = lines.join('\n');

  const ths = dataset.headers
    .map(
      (h, idx) =>
        `<th style="border:1px solid #cbd5e1;padding:6px 10px;background:#1e3a5f;color:#ffffff;font-weight:700;text-align:${
          idx === dataset.nameColumnIndex ? 'left' : 'center'
        };">${escapeHtml(h)}</th>`
    )
    .join('');

  const trs = dataset.rows
    .map((r, rIdx) => {
      const bg = rIdx % 2 === 1 ? '#f8fafc' : '#ffffff';
      const tds = dataset.headers
        .map(
          (_, idx) =>
            `<td style="border:1px solid #cbd5e1;padding:5px 9px;background:${bg};color:#0f172a;text-align:${
              idx === dataset.nameColumnIndex ? 'left' : 'center'
            };">${escapeHtml(r[idx] ?? '')}</td>`
        )
        .join('');
      return `<tr>${tds}</tr>`;
    })
    .join('');

  const footerTr =
    dataset.footerRow && dataset.footerRow.length > 0
      ? `<tr>${dataset.headers
          .map(
            (_, idx) =>
              `<td style="border:1px solid #cbd5e1;padding:6px 9px;background:#dbeafe;color:#1e3a8a;font-weight:700;text-align:${
                idx === dataset.nameColumnIndex ? 'left' : 'center'
              };">${escapeHtml(dataset.footerRow?.[idx] ?? '')}</td>`
          )
          .join('')}</tr>`
      : '';

  const html = `<div style="font-family:Calibri,Arial,sans-serif;">
  <div style="font-size:14px;font-weight:700;color:#1e3a5f;margin-bottom:4px;">${escapeHtml(dataset.title)}</div>
  ${
    dataset.subtitle
      ? `<div style="font-size:11px;color:#475569;margin-bottom:8px;">${escapeHtml(
          [dataset.schoolName, dataset.subtitle].filter(Boolean).join(' • ')
        )}</div>`
      : ''
  }
  <table style="border-collapse:collapse;font-size:12px;width:100%;">
    <thead><tr>${ths}</tr></thead>
    <tbody>${trs}${footerTr}</tbody>
  </table>
</div>`;

  return { plainTsv, html };
}

export async function copyGradebookToClipboard(dataset: GradebookExportDataset): Promise<boolean> {
  const { plainTsv, html } = buildGradebookClipboardPayloads(dataset);
  try {
    if (
      typeof navigator !== 'undefined' &&
      navigator.clipboard &&
      typeof navigator.clipboard.write === 'function' &&
      typeof ClipboardItem !== 'undefined'
    ) {
      await navigator.clipboard.write([
        new ClipboardItem({
          'text/html': new Blob([html], { type: 'text/html' }),
          'text/plain': new Blob([plainTsv], { type: 'text/plain' }),
        }),
      ]);
      return true;
    }
  } catch {
    // Repli sur texte brut TSV
  }

  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(plainTsv);
      return true;
    }
  } catch {}

  try {
    const ta = document.createElement('textarea');
    ta.value = plainTsv;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}
