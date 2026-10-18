import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

export interface StudyDocSection {
  heading: string;
  body: string;
  points?: string[];
}

export interface StudyDocPage {
  pageNumber: number;
  title: string;
  sections: StudyDocSection[];
}

export interface StudyDocumentData {
  docTitle: string;
  docSubtitle: string;
  objective: string;
  pages: StudyDocPage[];
  totalPages: number;
}

/**
 * Nettoie et formate les formules LaTeX et caractères pour un rendu PDF propre en police standard WinAnsi
 */
function sanitizeForPdf(str: string): string {
  if (!str) return '';
  return str
    .replace(/\\dfrac\{([^}]+)\}\{([^}]+)\}/g, '($1) / ($2)')
    .replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, '($1) / ($2)')
    .replace(/\\boxed\{([^}]+)\}/g, '[$1]')
    .replace(/\\underline\{([^}]+)\}/g, '$1')
    .replace(/\\omega_0/g, 'w0')
    .replace(/\\omega/g, 'w')
    .replace(/\\pi/g, 'pi')
    .replace(/\\tau/g, 'tau')
    .replace(/\\Omega_0/g, 'Omega_0')
    .replace(/\\Omega/g, 'Ohm')
    .replace(/\\Delta/g, 'Delta')
    .replace(/\\leq/g, '<=')
    .replace(/\\geq/g, '>=')
    .replace(/\\neq/g, '!=')
    .replace(/\\approx/g, '~=')
    .replace(/\\times/g, ' x ')
    .replace(/\\cdot/g, ' . ')
    .replace(/\\sqrt\{([^}]+)\}/g, 'sqrt($1)')
    .replace(/\$\$/g, '')
    .replace(/\$/g, '')
    .replace(/\\/g, '')
    .split('')
    .filter((c) => {
      const code = c.charCodeAt(0);
      return (
        (code >= 32 && code <= 126) ||
        (code >= 160 && code <= 255) ||
        [8364, 338, 339, 352, 353, 376, 381, 382, 8211, 8212, 8216, 8217, 8220, 8221, 8226, 8230].includes(code)
      );
    })
    .join('');
}

/**
 * Découpe un texte en lignes ne dépassant pas la largeur max spécifiée
 */
function wrapPdfText(text: string, font: any, fontSize: number, maxWidth: number): string[] {
  if (!text) return [];
  const lines: string[] = [];
  const paragraphs = text.split('\n');

  for (const para of paragraphs) {
    const trimmed = para.trim();
    if (!trimmed) {
      lines.push('');
      continue;
    }
    const words = trimmed.split(/\s+/);
    let currentLine = '';

    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      const width = font.widthOfTextAtSize(testLine, fontSize);
      if (width <= maxWidth) {
        currentLine = testLine;
      } else {
        if (currentLine) lines.push(currentLine);
        currentLine = word;
      }
    }
    if (currentLine) lines.push(currentLine);
  }
  return lines;
}

/**
 * Tronque une ligne avec ellipse si nécessaire
 */
function truncatePdfText(text: string, font: any, fontSize: number, maxWidth: number): string {
  let clean = sanitizeForPdf(text);
  if (!clean) return '';
  if (font.widthOfTextAtSize(clean, fontSize) <= maxWidth) {
    return clean;
  }
  while (clean.length > 1 && font.widthOfTextAtSize(clean + '...', fontSize) > maxWidth) {
    clean = clean.slice(0, -1);
  }
  return clean + '...';
}

/**
 * Génère et télécharge un document PDF officiel d'étude au format standardisé A4
 */
export async function exportStudyDocumentPdf(doc: StudyDocumentData): Promise<void> {
  const pdfDoc = await PDFDocument.create();
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);

  const pageWidth = 595.28; // Largeur A4 en points
  const pageHeight = 841.89; // Hauteur A4 en points
  const marginX = 42;
  const contentWidth = pageWidth - marginX * 2;

  // ============================================================================
  // PAGE 1 : COUVERTURE OFFICIELLE D'ÉTUDE
  // ============================================================================
  const coverPage = pdfDoc.addPage([pageWidth, pageHeight]);

  // Fond blanc doux
  coverPage.drawRectangle({
    x: 0,
    y: 0,
    width: pageWidth,
    height: pageHeight,
    color: rgb(0.985, 0.985, 0.98),
  });

  // Bandeau supérieur StudyCloud
  const headerBarHeight = 44;
  coverPage.drawRectangle({
    x: marginX,
    y: pageHeight - 48 - headerBarHeight,
    width: contentWidth,
    height: headerBarHeight,
    color: rgb(0.06, 0.41, 0.63), // #0F69A1 Bleu StudyCloud
  });

  coverPage.drawText('STUDYCLOUD', {
    x: marginX + 16,
    y: pageHeight - 48 - 24,
    font: fontBold,
    size: 13,
    color: rgb(0.98, 0.65, 0.20),
  });
  coverPage.drawText('DKD TECHNOLOGIES - DOCUMENT OFFICIEL D\'ETUDE', {
    x: marginX + 16,
    y: pageHeight - 48 - 36,
    font: fontBold,
    size: 7.5,
    color: rgb(0.90, 0.95, 0.98),
  });

  // Date dans le bandeau
  const dateStr = new Date().toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
  const dateFormatted = sanitizeForPdf(`Edition : ${dateStr}`);
  const dateWidth = fontRegular.widthOfTextAtSize(dateFormatted, 8);
  coverPage.drawText(dateFormatted, {
    x: marginX + contentWidth - dateWidth - 16,
    y: pageHeight - 48 - 26,
    font: fontRegular,
    size: 8,
    color: rgb(0.85, 0.92, 0.96),
  });

  // Badge officiel
  const badgeY = pageHeight - 160;
  coverPage.drawRectangle({
    x: marginX + (contentWidth - 190) / 2,
    y: badgeY,
    width: 190,
    height: 22,
    color: rgb(1, 0.94, 0.88),
    borderColor: rgb(0.98, 0.65, 0.20),
    borderWidth: 1,
  });
  const badgeText = 'DOCUMENT D\'ETUDE OFFICIEL';
  const badgeWidth = fontBold.widthOfTextAtSize(badgeText, 8.5);
  coverPage.drawText(badgeText, {
    x: marginX + (contentWidth - badgeWidth) / 2,
    y: badgeY + 6.5,
    font: fontBold,
    size: 8.5,
    color: rgb(0.78, 0.35, 0.05),
  });

  // Titre principal
  const safeTitle = sanitizeForPdf(doc.docTitle.toUpperCase());
  const titleLines = wrapPdfText(safeTitle, fontBold, 17, contentWidth - 40);
  let titleY = badgeY - 50;
  titleLines.forEach((tl) => {
    const tw = fontBold.widthOfTextAtSize(tl, 17);
    coverPage.drawText(tl, {
      x: marginX + (contentWidth - tw) / 2,
      y: titleY,
      font: fontBold,
      size: 17,
      color: rgb(0.1, 0.12, 0.18),
    });
    titleY -= 24;
  });

  // Sous-titre
  const safeSubtitle = sanitizeForPdf(doc.docSubtitle);
  const subLines = wrapPdfText(safeSubtitle, fontBold, 11, contentWidth - 60);
  let subY = titleY - 10;
  subLines.forEach((sl) => {
    const sw = fontBold.widthOfTextAtSize(sl, 11);
    coverPage.drawText(sl, {
      x: marginX + (contentWidth - sw) / 2,
      y: subY,
      font: fontBold,
      size: 11,
      color: rgb(0.06, 0.41, 0.63),
    });
    subY -= 16;
  });

  // Boîte Objectif Pédagogique
  const objBoxY = Math.max(220, subY - 130);
  coverPage.drawRectangle({
    x: marginX + 16,
    y: objBoxY,
    width: contentWidth - 32,
    height: 95,
    color: rgb(0.94, 0.97, 1.0),
    borderColor: rgb(0.70, 0.82, 0.95),
    borderWidth: 1,
  });

  coverPage.drawText('OBJECTIF PEDAGOGIQUE DU DOCUMENT :', {
    x: marginX + 30,
    y: objBoxY + 74,
    font: fontBold,
    size: 8.5,
    color: rgb(0.06, 0.35, 0.55),
  });

  const safeObj = sanitizeForPdf(doc.objective);
  const objLines = wrapPdfText(safeObj, fontRegular, 8.5, contentWidth - 60).slice(0, 4);
  let objLineY = objBoxY + 54;
  objLines.forEach((ol) => {
    coverPage.drawText(ol, {
      x: marginX + 30,
      y: objLineY,
      font: fontRegular,
      size: 8.5,
      color: rgb(0.18, 0.22, 0.28),
    });
    objLineY -= 13;
  });

  // Métadonnées d'identification apprenant
  const metaY = objBoxY - 55;
  coverPage.drawText('Apprenant : Espace de Travail Personnel', {
    x: marginX + 30,
    y: metaY,
    font: fontRegular,
    size: 8.5,
    color: rgb(0.35, 0.35, 0.35),
  });
  coverPage.drawText(`Annee Academique : ${new Date().getFullYear()} - ${new Date().getFullYear() + 1}`, {
    x: marginX + 30,
    y: metaY - 16,
    font: fontRegular,
    size: 8.5,
    color: rgb(0.35, 0.35, 0.35),
  });

  // Footer Cover Page
  coverPage.drawLine({
    start: { x: marginX, y: 44 },
    end: { x: marginX + contentWidth, y: 44 },
    thickness: 0.5,
    color: rgb(0.8, 0.8, 0.8),
  });
  coverPage.drawText('Document certifie par StudyCloud - Plateforme Universitaire & Scolaire', {
    x: marginX,
    y: 28,
    font: fontRegular,
    size: 7.5,
    color: rgb(0.5, 0.5, 0.5),
  });
  coverPage.drawText(`Page 1 / ${doc.totalPages}`, {
    x: marginX + contentWidth - 55,
    y: 28,
    font: fontBold,
    size: 7.5,
    color: rgb(0.3, 0.3, 0.3),
  });

  // ============================================================================
  // PAGES SUIVANTES : CHAPITRES ET SECTIONS DÉTAILLÉES
  // ============================================================================
  doc.pages.forEach((p) => {
    const page = pdfDoc.addPage([pageWidth, pageHeight]);

    // Fond blanc net
    page.drawRectangle({
      x: 0,
      y: 0,
      width: pageWidth,
      height: pageHeight,
      color: rgb(1, 1, 1),
    });

    // En-tête de page discret
    page.drawLine({
      start: { x: marginX, y: pageHeight - 42 },
      end: { x: marginX + contentWidth, y: pageHeight - 42 },
      thickness: 0.6,
      color: rgb(0.85, 0.85, 0.85),
    });

    page.drawText('STUDYCLOUD', {
      x: marginX,
      y: pageHeight - 34,
      font: fontBold,
      size: 8.5,
      color: rgb(0.06, 0.41, 0.63),
    });

    const runningTitle = truncatePdfText(safeTitle, fontRegular, 8, contentWidth - 130);
    page.drawText(runningTitle, {
      x: marginX + 75,
      y: pageHeight - 34,
      font: fontRegular,
      size: 8,
      color: rgb(0.45, 0.45, 0.45),
    });

    page.drawText(`Page ${p.pageNumber}`, {
      x: marginX + contentWidth - 45,
      y: pageHeight - 34,
      font: fontBold,
      size: 8,
      color: rgb(0.92, 0.45, 0.08),
    });

    // Titre principal de la page / chapitre
    let curY = pageHeight - 72;
    const safePageTitle = sanitizeForPdf(p.title);
    page.drawText(safePageTitle, {
      x: marginX,
      y: curY,
      font: fontBold,
      size: 13,
      color: rgb(0.1, 0.12, 0.18),
    });
    curY -= 6;

    page.drawLine({
      start: { x: marginX, y: curY },
      end: { x: marginX + contentWidth, y: curY },
      thickness: 1.2,
      color: rgb(0.1, 0.12, 0.18),
    });
    curY -= 18;

    // Sections du chapitre
    p.sections.forEach((sec) => {
      if (curY < 100) return; // Évite les débordements sur le pied de page

      // Puce rectangle colorée
      page.drawRectangle({
        x: marginX,
        y: curY - 1,
        width: 3.5,
        height: 11,
        color: rgb(0.95, 0.45, 0.1),
      });

      // Titre de section
      const safeHeading = sanitizeForPdf(sec.heading);
      page.drawText(safeHeading, {
        x: marginX + 9,
        y: curY,
        font: fontBold,
        size: 9.5,
        color: rgb(0.12, 0.15, 0.22),
      });
      curY -= 15;

      // Corps du texte
      const safeBody = sanitizeForPdf(sec.body);
      const bodyLines = wrapPdfText(safeBody, fontRegular, 8.5, contentWidth - 12);
      bodyLines.forEach((bl) => {
        if (curY < 56) return;
        page.drawText(bl, {
          x: marginX + 9,
          y: curY,
          font: fontRegular,
          size: 8.5,
          color: rgb(0.22, 0.25, 0.30),
        });
        curY -= 12;
      });

      // Puces de détails si présentes
      if (sec.points && sec.points.length > 0) {
        sec.points.forEach((pt) => {
          if (curY < 56) return;
          const safePt = sanitizeForPdf(pt);
          const ptLines = wrapPdfText(safePt, fontRegular, 8.5, contentWidth - 30);
          ptLines.forEach((pl, plIdx) => {
            if (curY < 56) return;
            if (plIdx === 0) {
              page.drawText('-', {
                x: marginX + 16,
                y: curY,
                font: fontBold,
                size: 8.5,
                color: rgb(0.95, 0.45, 0.1),
              });
            }
            page.drawText(pl, {
              x: marginX + 26,
              y: curY,
              font: fontRegular,
              size: 8.5,
              color: rgb(0.22, 0.25, 0.30),
            });
            curY -= 12;
          });
        });
      }

      curY -= 12; // Espace entre deux sections
    });

    // Pied de page
    page.drawLine({
      start: { x: marginX, y: 44 },
      end: { x: marginX + contentWidth, y: 44 },
      thickness: 0.5,
      color: rgb(0.85, 0.85, 0.85),
    });

    page.drawText(`${runningTitle} - Page ${p.pageNumber}`, {
      x: marginX,
      y: 28,
      font: fontRegular,
      size: 7.5,
      color: rgb(0.5, 0.5, 0.5),
    });

    page.drawText(`${p.pageNumber} / ${doc.totalPages}`, {
      x: marginX + contentWidth - 45,
      y: 28,
      font: fontBold,
      size: 7.5,
      color: rgb(0.3, 0.3, 0.3),
    });
  });

  // Sauvegarde des octets PDF binaires
  const pdfBytes = await pdfDoc.save();
  const blob = new Blob([pdfBytes], { type: 'application/pdf' });
  const downloadUrl = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = downloadUrl;
  const safeFilename = doc.docTitle.replace(/[^a-zA-Z0-9_\-]/g, '_').slice(0, 40) || 'Document_Etude_StudyCloud';
  link.download = `${safeFilename}.pdf`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  setTimeout(() => {
    URL.revokeObjectURL(downloadUrl);
  }, 2500);
}
