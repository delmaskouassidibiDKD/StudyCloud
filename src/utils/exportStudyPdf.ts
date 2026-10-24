import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import html2canvas from 'html2canvas';

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
  // Rendu fidèle à l'identique de l'écran avec formules KaTeX réelles
  if (typeof document !== 'undefined') {
    const pageIds: string[] = [];
    const maxP = Math.max(doc.totalPages || 0, doc.pages?.length || 0, 10);
    for (let i = 1; i <= maxP; i++) {
      if (document.getElementById(`pdf-page-${i}`)) {
        pageIds.push(`pdf-page-${i}`);
      }
    }
    if (pageIds.length > 0) {
      try {
        await exportPagesToPdf(pageIds, doc.docTitle || 'Document_Etude');
        return;
      } catch (domErr) {
        console.warn('[exportStudyDocumentPdf] Capture DOM échouée, repli vers export PDF vectoriel:', domErr);
      }
    }
  }

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

// ============================================================================
// MOTEUR UNIVERSEL DE GÉNÉRATION PDF MULTI-PAGES AVEC PAGINATION DYNAMIQUE
// ============================================================================

export interface UniversalPdfItem {
  type: 'heading' | 'subheading' | 'text' | 'bullet' | 'box';
  text?: string;
  points?: string[];
  title?: string;
  color?: any;
  bgColor?: any;
  borderColor?: any;
}

export async function buildMultiPagePdfDocument(options: {
  title: string;
  subtitle?: string;
  themeBadge?: string;
  overview?: string;
  items: UniversalPdfItem[];
  filename: string;
}): Promise<void> {
  const pdfDoc = await PDFDocument.create();
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);

  const pageWidth = 595.28; // A4 portrait width
  const pageHeight = 841.89; // A4 portrait height
  const marginX = 42;
  const contentWidth = pageWidth - marginX * 2;

  const pages: any[] = [];

  const createNewPage = (isCover = false) => {
    const page = pdfDoc.addPage([pageWidth, pageHeight]);
    pages.push(page);

    page.drawRectangle({
      x: 0,
      y: 0,
      width: pageWidth,
      height: pageHeight,
      color: rgb(1, 1, 1),
    });

    if (!isCover) {
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

      const safeRunningTitle = truncatePdfText(options.title, fontRegular, 8, contentWidth - 140);
      page.drawText(safeRunningTitle, {
        x: marginX + 75,
        y: pageHeight - 34,
        font: fontRegular,
        size: 8,
        color: rgb(0.45, 0.45, 0.45),
      });

      page.drawLine({
        start: { x: marginX, y: 44 },
        end: { x: marginX + contentWidth, y: 44 },
        thickness: 0.5,
        color: rgb(0.85, 0.85, 0.85),
      });

      page.drawText('Document certifie par StudyCloud - Plateforme Universitaire & Scolaire', {
        x: marginX,
        y: 28,
        font: fontRegular,
        size: 7.5,
        color: rgb(0.5, 0.5, 0.5),
      });
    }

    return page;
  };

  let currentPage = createNewPage(true);

  // Bandeau supérieur StudyCloud
  const headerBarHeight = 44;
  currentPage.drawRectangle({
    x: marginX,
    y: pageHeight - 48 - headerBarHeight,
    width: contentWidth,
    height: headerBarHeight,
    color: rgb(0.06, 0.41, 0.63),
  });

  currentPage.drawText('STUDYCLOUD', {
    x: marginX + 16,
    y: pageHeight - 48 - 24,
    font: fontBold,
    size: 13,
    color: rgb(0.98, 0.65, 0.20),
  });
  currentPage.drawText('DKD TECHNOLOGIES - DOCUMENT OFFICIEL D\'ETUDE', {
    x: marginX + 16,
    y: pageHeight - 48 - 36,
    font: fontBold,
    size: 7.5,
    color: rgb(0.90, 0.95, 0.98),
  });

  const dateStr = new Date().toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
  const dateFormatted = sanitizeForPdf(`Edition : ${dateStr}`);
  const dateWidth = fontRegular.widthOfTextAtSize(dateFormatted, 8);
  currentPage.drawText(dateFormatted, {
    x: marginX + contentWidth - dateWidth - 16,
    y: pageHeight - 48 - 26,
    font: fontRegular,
    size: 8,
    color: rgb(0.85, 0.92, 0.96),
  });

  let curY = pageHeight - 130;
  if (options.themeBadge) {
    const cleanBadge = sanitizeForPdf(options.themeBadge.toUpperCase());
    const badgeW = Math.min(contentWidth - 40, fontBold.widthOfTextAtSize(cleanBadge, 8.5) + 24);
    currentPage.drawRectangle({
      x: marginX + (contentWidth - badgeW) / 2,
      y: curY - 5,
      width: badgeW,
      height: 22,
      color: rgb(0.93, 0.95, 1.0),
      borderColor: rgb(0.5, 0.65, 0.95),
      borderWidth: 1,
    });
    currentPage.drawText(cleanBadge, {
      x: marginX + (contentWidth - badgeW) / 2 + 12,
      y: curY + 2,
      font: fontBold,
      size: 8.5,
      color: rgb(0.15, 0.25, 0.65),
    });
    curY -= 35;
  }

  const cleanTitle = sanitizeForPdf(options.title.toUpperCase());
  const titleLines = wrapPdfText(cleanTitle, fontBold, 16, contentWidth - 40);
  titleLines.forEach((tl) => {
    const tw = fontBold.widthOfTextAtSize(tl, 16);
    currentPage.drawText(tl, {
      x: marginX + (contentWidth - tw) / 2,
      y: curY,
      font: fontBold,
      size: 16,
      color: rgb(0.08, 0.1, 0.15),
    });
    curY -= 22;
  });

  if (options.subtitle) {
    const cleanSub = sanitizeForPdf(options.subtitle);
    const subLines = wrapPdfText(cleanSub, fontBold, 10, contentWidth - 60);
    subLines.forEach((sl) => {
      const sw = fontBold.widthOfTextAtSize(sl, 10);
      currentPage.drawText(sl, {
        x: marginX + (contentWidth - sw) / 2,
        y: curY,
        font: fontBold,
        size: 10,
        color: rgb(0.06, 0.41, 0.63),
      });
      curY -= 15;
    });
  }

  curY -= 10;

  if (options.overview) {
    const cleanOverview = sanitizeForPdf(options.overview);
    const overviewLines = wrapPdfText(cleanOverview, fontRegular, 8.5, contentWidth - 40);
    const boxHeight = Math.min(180, overviewLines.length * 12 + 40);

    currentPage.drawRectangle({
      x: marginX,
      y: curY - boxHeight,
      width: contentWidth,
      height: boxHeight,
      color: rgb(0.96, 0.97, 1.0),
      borderColor: rgb(0.80, 0.85, 0.95),
      borderWidth: 1,
    });

    currentPage.drawText('SYNTHESE GLOBALE & OBJECTIFS PEDAGOGIQUES :', {
      x: marginX + 16,
      y: curY - 18,
      font: fontBold,
      size: 8.5,
      color: rgb(0.12, 0.25, 0.60),
    });

    let oLineY = curY - 34;
    for (const ol of overviewLines) {
      if (oLineY < curY - boxHeight + 10) break;
      currentPage.drawText(ol, {
        x: marginX + 16,
        y: oLineY,
        font: fontRegular,
        size: 8.5,
        color: rgb(0.15, 0.18, 0.25),
      });
      oLineY -= 12;
    }

    curY -= boxHeight + 25;
  }

  for (const item of options.items) {
    if (item.type === 'heading') {
      const headingLines = wrapPdfText(sanitizeForPdf(item.text || ''), fontBold, 11, contentWidth - 25);
      const neededHeight = headingLines.length * 15 + 24;

      if (curY - neededHeight < 60) {
        currentPage = createNewPage();
        curY = pageHeight - 75;
      }

      const accentColor = item.color || rgb(0.06, 0.41, 0.63);

      currentPage.drawRectangle({
        x: marginX,
        y: curY - 2,
        width: 4,
        height: headingLines.length * 14 + 4,
        color: accentColor,
      });

      headingLines.forEach((hl) => {
        currentPage.drawText(hl, {
          x: marginX + 12,
          y: curY,
          font: fontBold,
          size: 11,
          color: rgb(0.08, 0.1, 0.15),
        });
        curY -= 15;
      });

      currentPage.drawLine({
        start: { x: marginX + 12, y: curY + 6 },
        end: { x: marginX + contentWidth, y: curY + 6 },
        thickness: 0.5,
        color: rgb(0.88, 0.88, 0.88),
      });

      curY -= 10;
    } else if (item.type === 'subheading') {
      const subLines = wrapPdfText(sanitizeForPdf(item.text || ''), fontBold, 9.5, contentWidth - 15);
      const neededHeight = subLines.length * 13 + 12;

      if (curY - neededHeight < 60) {
        currentPage = createNewPage();
        curY = pageHeight - 75;
      }

      subLines.forEach((sl) => {
        currentPage.drawText(sl, {
          x: marginX + 8,
          y: curY,
          font: fontBold,
          size: 9.5,
          color: rgb(0.15, 0.18, 0.25),
        });
        curY -= 13;
      });

      curY -= 4;
    } else if (item.type === 'text') {
      const textLines = wrapPdfText(sanitizeForPdf(item.text || ''), fontRegular, 8.5, contentWidth - 15);

      for (const line of textLines) {
        if (curY < 60) {
          currentPage = createNewPage();
          curY = pageHeight - 75;
        }

        currentPage.drawText(line, {
          x: marginX + 8,
          y: curY,
          font: fontRegular,
          size: 8.5,
          color: rgb(0.18, 0.20, 0.25),
        });
        curY -= 12;
      }

      curY -= 6;
    } else if (item.type === 'bullet') {
      const points = item.points || (item.text ? [item.text] : []);
      for (const pt of points) {
        const ptLines = wrapPdfText(sanitizeForPdf(pt), fontRegular, 8.5, contentWidth - 30);
        for (let i = 0; i < ptLines.length; i++) {
          if (curY < 60) {
            currentPage = createNewPage();
            curY = pageHeight - 75;
          }
          if (i === 0) {
            currentPage.drawText('-', {
              x: marginX + 14,
              y: curY,
              font: fontBold,
              size: 8.5,
              color: rgb(0.06, 0.41, 0.63),
            });
          }
          currentPage.drawText(ptLines[i], {
            x: marginX + 24,
            y: curY,
            font: fontRegular,
            size: 8.5,
            color: rgb(0.18, 0.20, 0.25),
          });
          curY -= 12;
        }
      }
      curY -= 4;
    } else if (item.type === 'box') {
      const boxTitle = item.title ? sanitizeForPdf(item.title) : '';
      const boxLines = wrapPdfText(sanitizeForPdf(item.text || ''), fontRegular, 8.5, contentWidth - 36);
      const points = (item.points || []).map((p) => wrapPdfText(sanitizeForPdf(p), fontRegular, 8.5, contentWidth - 48));

      let contentLineCount = boxLines.length;
      points.forEach((pArr) => {
        contentLineCount += pArr.length;
      });

      const boxHeight = (boxTitle ? 20 : 0) + contentLineCount * 12 + 20;

      if (curY - boxHeight < 60 && boxHeight < pageHeight - 120) {
        currentPage = createNewPage();
        curY = pageHeight - 75;
      }

      const bgColor = item.bgColor || rgb(0.97, 0.98, 1.0);
      const borderColor = item.borderColor || rgb(0.80, 0.86, 0.96);

      currentPage.drawRectangle({
        x: marginX + 4,
        y: curY - boxHeight,
        width: contentWidth - 8,
        height: boxHeight,
        color: bgColor,
        borderColor: borderColor,
        borderWidth: 1,
      });

      let bY = curY - 14;
      if (boxTitle) {
        currentPage.drawText(boxTitle, {
          x: marginX + 16,
          y: bY,
          font: fontBold,
          size: 9,
          color: rgb(0.1, 0.2, 0.5),
        });
        bY -= 15;
      }

      for (const line of boxLines) {
        currentPage.drawText(line, {
          x: marginX + 16,
          y: bY,
          font: fontRegular,
          size: 8.5,
          color: rgb(0.15, 0.18, 0.25),
        });
        bY -= 12;
      }

      for (const pArr of points) {
        for (let i = 0; i < pArr.length; i++) {
          if (i === 0) {
            currentPage.drawText('>', {
              x: marginX + 18,
              y: bY,
              font: fontBold,
              size: 8,
              color: rgb(0.1, 0.3, 0.6),
            });
          }
          currentPage.drawText(pArr[i], {
            x: marginX + 28,
            y: bY,
            font: fontRegular,
            size: 8.5,
            color: rgb(0.15, 0.18, 0.25),
          });
          bY -= 12;
        }
      }

      curY -= boxHeight + 12;
    }
  }

  const totalPagesCount = pages.length;
  pages.forEach((page, pIdx) => {
    const pageNumStr = `Page ${pIdx + 1} / ${totalPagesCount}`;
    page.drawText(pageNumStr, {
      x: marginX + contentWidth - 55,
      y: 28,
      font: fontBold,
      size: 7.5,
      color: rgb(0.3, 0.3, 0.3),
    });
  });

  const pdfBytes = await pdfDoc.save();
  const blob = new Blob([pdfBytes], { type: 'application/pdf' });
  const downloadUrl = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = downloadUrl;
  const safeFilename = options.filename.replace(/[^a-zA-Z0-9_\-]/g, '_').slice(0, 50) || 'StudyCloud_Document';
  link.download = `${safeFilename}.pdf`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  setTimeout(() => {
    URL.revokeObjectURL(downloadUrl);
  }, 2500);
}

// ============================================================================
// EXPORT HTML FIDÈLE VERS PDF (RENDU À L'IDENTIQUE DES FORMULES KATEX & STYLES)
// ============================================================================

export interface HtmlToPdfOptions {
  filename?: string;
  orientation?: 'portrait' | 'landscape';
  marginPt?: number;
  scale?: number;
}

/**
 * Capture fidèlement un élément HTML (avec formules KaTeX réelles, polices, couleurs et mises en page à l'identique de l'écran)
 * et le convertit en document PDF multi-pages A4 avec découpage intelligent évitant de couper les formules en deux.
 */
export async function exportHtmlElementToPdf(
  elementOrId: string | HTMLElement,
  docTitle: string,
  options?: HtmlToPdfOptions
): Promise<void> {
  const target = typeof elementOrId === 'string' ? document.getElementById(elementOrId) : elementOrId;
  if (!target) {
    console.error(`[PDF Export] Élément "${elementOrId}" introuvable.`);
    throw new Error(`Élément "${elementOrId}" introuvable pour export.`);
  }

  // S'assurer que toutes les polices web (dont KaTeX) sont totalement chargées
  if (typeof document !== 'undefined' && document.fonts && document.fonts.ready) {
    try {
      await document.fonts.ready;
    } catch {
      // Ignorer si échec
    }
  }

  const orientation = options?.orientation || 'portrait';
  const isLandscape = orientation === 'landscape';
  const pageWidthPt = isLandscape ? 841.89 : 595.28;
  const pageHeightPt = isLandscape ? 595.28 : 841.89;
  const marginPt = options?.marginPt ?? 20;
  const usableWidthPt = pageWidthPt - 2 * marginPt;
  const usableHeightPt = pageHeightPt - 2 * marginPt;
  const aspect = usableHeightPt / usableWidthPt;

  // Capture de l'élément HTML rendu avec scale 1.8 pour un compromis parfait netteté / mémoire
  const canvas = await html2canvas(target, {
    scale: options?.scale || 1.8,
    useCORS: true,
    allowTaint: false,
    backgroundColor: '#ffffff',
    logging: false,
    scrollX: 0,
    scrollY: 0,
    windowWidth: target.scrollWidth || 1024,
    ignoreElements: (el) => {
      return (
        el.classList.contains('no-print') ||
        el.getAttribute('data-no-print') === 'true' ||
        (el.tagName.toLowerCase() === 'button' &&
          (el.textContent?.includes('Télécharger') || el.textContent?.includes('Copier')))
      );
    },
  });

  const canvasWidth = canvas.width;
  const canvasHeight = canvas.height;
  if (!canvasWidth || !canvasHeight) {
    throw new Error('Canvas invalide lors de la capture.');
  }

  const maxSliceHeightPx = Math.floor(canvasWidth * aspect);

  // Recherche des frontières d'éléments pour éviter de couper une formule ou une carte en deux
  const targetRect = target.getBoundingClientRect();
  const totalH = targetRect.height;
  const breakOffsets: number[] = [];

  if (totalH > 0 && canvasHeight > maxSliceHeightPx) {
    const blockNodes = target.querySelectorAll(
      'section, article, header, footer, h1, h2, h3, h4, table, tr, [class*="rounded"], [class*="border"], [class*="p-"], .katex-display'
    );
    blockNodes.forEach((node) => {
      const r = node.getBoundingClientRect();
      const topFromTarget = r.top - targetRect.top;
      if (topFromTarget > 25 && topFromTarget < totalH - 25) {
        const pxOnCanvas = Math.round((topFromTarget / totalH) * canvasHeight);
        breakOffsets.push(pxOnCanvas);
      }
    });
    breakOffsets.sort((a, b) => a - b);
  }

  // Calcul des découpages de pages
  const cuts: { startY: number; endY: number }[] = [];
  let currentY = 0;

  while (currentY < canvasHeight) {
    let nextCutY = currentY + maxSliceHeightPx;
    if (nextCutY >= canvasHeight) {
      nextCutY = canvasHeight;
    } else {
      const minAcceptable = nextCutY - maxSliceHeightPx * 0.22;
      let bestBreak = -1;
      for (let i = breakOffsets.length - 1; i >= 0; i--) {
        const b = breakOffsets[i];
        if (b <= nextCutY && b >= minAcceptable) {
          bestBreak = b;
          break;
        }
      }
      if (bestBreak > 0) {
        nextCutY = bestBreak;
      }
    }

    cuts.push({ startY: currentY, endY: nextCutY });
    currentY = nextCutY;
  }

  const pdfDoc = await PDFDocument.create();
  const totalPages = cuts.length;
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);

  for (let pIdx = 0; pIdx < totalPages; pIdx++) {
    const cut = cuts[pIdx];
    const sliceHeight = cut.endY - cut.startY;
    if (sliceHeight <= 0) continue;

    const sliceCanvas = document.createElement('canvas');
    sliceCanvas.width = canvasWidth;
    sliceCanvas.height = sliceHeight;
    const ctx = sliceCanvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, sliceCanvas.width, sliceCanvas.height);
      ctx.drawImage(
        canvas,
        0, cut.startY, canvasWidth, sliceHeight,
        0, 0, canvasWidth, sliceHeight
      );
    }

    const slicePng = sliceCanvas.toDataURL('image/png');
    const embeddedImg = await pdfDoc.embedPng(slicePng);

    const page = pdfDoc.addPage([pageWidthPt, pageHeightPt]);
    const drawWidthPt = usableWidthPt;
    const drawHeightPt = (sliceHeight / canvasWidth) * usableWidthPt;

    page.drawImage(embeddedImg, {
      x: marginPt,
      y: pageHeightPt - marginPt - drawHeightPt,
      width: drawWidthPt,
      height: drawHeightPt,
    });

    // Pied de page discret
    if (totalPages > 1) {
      page.drawText(`StudyCloud • Page ${pIdx + 1} / ${totalPages}`, {
        x: pageWidthPt - marginPt - 120,
        y: 8,
        size: 7.5,
        font: fontRegular,
        color: rgb(0.55, 0.55, 0.55),
      });
    }
  }

  const pdfBytes = await pdfDoc.save();
  const blob = new Blob([pdfBytes], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  const safeTitle = (options?.filename || docTitle || 'Document_StudyCloud').replace(/[^a-zA-Z0-9_-]/g, '_');
  link.download = `${safeTitle}.pdf`;
  document.body.appendChild(link);
  link.click();

  // Laisser le temps au navigateur d'initier le téléchargement avant de détruire le blob
  setTimeout(() => {
    try {
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch {
      // Ignorer
    }
  }, 4000);
}

/**
 * Capture plusieurs pages HTML A4 indépendantes et les assemble dans un PDF multi-pages A4
 */
export async function exportPagesToPdf(
  pageElementIds: string[],
  docTitle: string,
  filename?: string
): Promise<void> {
  if (typeof document !== 'undefined' && document.fonts && document.fonts.ready) {
    try {
      await document.fonts.ready;
    } catch {
      // Ignorer
    }
  }

  const pdfDoc = await PDFDocument.create();
  const pageWidthPt = 595.28;
  const pageHeightPt = 841.89;

  for (const pageId of pageElementIds) {
    const el = document.getElementById(pageId);
    if (!el) continue;

    const canvas = await html2canvas(el, {
      scale: 1.8,
      useCORS: true,
      allowTaint: false,
      backgroundColor: '#ffffff',
      logging: false,
    });

    const imgData = canvas.toDataURL('image/png');
    const embeddedImg = await pdfDoc.embedPng(imgData);
    const page = pdfDoc.addPage([pageWidthPt, pageHeightPt]);

    const drawAspect = canvas.height / canvas.width;
    const pageAspect = pageHeightPt / pageWidthPt;

    let drawWidth = pageWidthPt;
    let drawHeight = pageHeightPt;
    let drawX = 0;
    let drawY = 0;

    if (drawAspect > pageAspect) {
      drawWidth = pageHeightPt / drawAspect;
      drawX = (pageWidthPt - drawWidth) / 2;
    } else {
      drawHeight = pageWidthPt * drawAspect;
      drawY = (pageHeightPt - drawHeight) / 2;
    }

    page.drawImage(embeddedImg, {
      x: drawX,
      y: drawY,
      width: drawWidth,
      height: drawHeight,
    });
  }

  const pdfBytes = await pdfDoc.save();
  const blob = new Blob([pdfBytes], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  const safeName = (filename || docTitle || 'Document_StudyCloud').replace(/[^a-zA-Z0-9_-]/g, '_');
  link.download = `${safeName}.pdf`;
  document.body.appendChild(link);
  link.click();

  setTimeout(() => {
    try {
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch {
      // Ignorer
    }
  }, 4000);
}

// ============================================================================
// EXPORT SVG VERS PDF (POUR CARTES MENTALES & CONCEPTUELLES)
// ============================================================================

export async function exportSvgToPdf(svgElementId: string, docTitle: string): Promise<void> {
  const svgEl = document.getElementById(svgElementId) as SVGSVGElement | null;
  if (!svgEl) {
    throw new Error(`SVG element with id '${svgElementId}' not found.`);
  }

  if (typeof document !== 'undefined' && 'fonts' in document) {
    try {
      await (document as any).fonts.ready;
    } catch {
      // Continue
    }
  }

  const renderA4LandscapePdf = async (pngDataUrl: string, srcWidth: number, srcHeight: number) => {
    const pdfDoc = await PDFDocument.create();
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const pngImage = await pdfDoc.embedPng(pngDataUrl);

    const a4Width = 841.89; // Paysage A4
    const a4Height = 595.28;
    const margin = 28;

    const page = pdfDoc.addPage([a4Width, a4Height]);

    page.drawRectangle({
      x: 0,
      y: 0,
      width: a4Width,
      height: a4Height,
      color: rgb(1, 1, 1),
    });

    page.drawText('STUDYCLOUD • CARTE MENTALE & ARBORESCENCE OFFICIELLE', {
      x: margin,
      y: a4Height - 22,
      font: fontBold,
      size: 9,
      color: rgb(0.06, 0.41, 0.63),
    });

    const safeTitle = sanitizeForPdf(docTitle).slice(0, 60);
    page.drawText(safeTitle, {
      x: margin + 280,
      y: a4Height - 22,
      font: fontBold,
      size: 9,
      color: rgb(0.12, 0.15, 0.22),
    });

    const dateStr = new Date().toLocaleDateString('fr-FR');
    page.drawText(`Date : ${dateStr}`, {
      x: a4Width - margin - 75,
      y: a4Height - 22,
      font: fontRegular,
      size: 8,
      color: rgb(0.45, 0.45, 0.45),
    });

    page.drawLine({
      start: { x: margin, y: a4Height - 28 },
      end: { x: a4Width - margin, y: a4Height - 28 },
      thickness: 0.6,
      color: rgb(0.85, 0.85, 0.85),
    });

    const availWidth = a4Width - margin * 2;
    const availHeight = a4Height - margin * 2 - 25;

    const imgRatio = srcWidth / (srcHeight || 1);
    const availRatio = availWidth / availHeight;

    let renderW = availWidth;
    let renderH = availHeight;

    if (imgRatio > availRatio) {
      renderH = availWidth / imgRatio;
    } else {
      renderW = availHeight * imgRatio;
    }

    const posX = margin + (availWidth - renderW) / 2;
    const posY = margin + (availHeight - renderH) / 2;

    page.drawImage(pngImage, {
      x: posX,
      y: posY,
      width: renderW,
      height: renderH,
    });

    page.drawLine({
      start: { x: margin, y: 22 },
      end: { x: a4Width - margin, y: 22 },
      thickness: 0.5,
      color: rgb(0.85, 0.85, 0.85),
    });

    page.drawText('Document genere par StudyCloud - Espace de Creation Interactive', {
      x: margin,
      y: 12,
      font: fontRegular,
      size: 7.5,
      color: rgb(0.5, 0.5, 0.5),
    });

    const pdfBytes = await pdfDoc.save();
    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    const downloadUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = downloadUrl;
    const safeFilename = docTitle.replace(/[^a-zA-Z0-9_\-]/g, '_').slice(0, 45) || 'Carte_Mentale';
    link.download = `${safeFilename}.pdf`;
    document.body.appendChild(link);
    link.click();

    setTimeout(() => {
      try {
        document.body.removeChild(link);
        URL.revokeObjectURL(downloadUrl);
      } catch {
        // Ignorer
      }
    }, 4000);
  };

  try {
    const clone = svgEl.cloneNode(true) as SVGSVGElement;

    // Remplacement des foreignObject par des éléments <text> SVG purs pour empêcher Chrome de bloquer l'image
    const foreignObjects = Array.from(clone.querySelectorAll('foreignObject'));
    foreignObjects.forEach((fo) => {
      const x = parseFloat(fo.getAttribute('x') || '0');
      const y = parseFloat(fo.getAttribute('y') || '0');
      const w = parseFloat(fo.getAttribute('width') || '100');
      const h = parseFloat(fo.getAttribute('height') || '40');
      const rawText = (fo.textContent || '').trim().replace(/\s+/g, ' ');

      const textEl = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      textEl.setAttribute('x', String(x + w / 2));
      textEl.setAttribute('y', String(y + h / 2));
      textEl.setAttribute('text-anchor', 'middle');
      textEl.setAttribute('dominant-baseline', 'central');
      textEl.setAttribute('fill', '#0F172A');
      textEl.setAttribute('font-family', 'sans-serif');
      textEl.setAttribute('font-weight', '600');
      textEl.setAttribute('font-size', '12px');
      textEl.textContent = rawText.slice(0, 60);

      fo.parentNode?.replaceChild(textEl, fo);
    });

    let width = 1400;
    let height = 900;

    if (svgEl.viewBox?.baseVal && svgEl.viewBox.baseVal.width > 0 && svgEl.viewBox.baseVal.height > 0) {
      width = svgEl.viewBox.baseVal.width;
      height = svgEl.viewBox.baseVal.height;
    } else if (svgEl.clientWidth > 0 && svgEl.clientHeight > 0) {
      width = svgEl.clientWidth;
      height = svgEl.clientHeight;
    }

    clone.setAttribute('width', String(width));
    clone.setAttribute('height', String(height));
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    clone.style.backgroundColor = '#ffffff';

    const svgString = new XMLSerializer().serializeToString(clone);
    const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
    const svgUrl = URL.createObjectURL(svgBlob);

    await new Promise<void>((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';

      img.onload = async () => {
        try {
          const scale = 2;
          const canvas = document.createElement('canvas');
          canvas.width = Math.max(800, width * scale);
          canvas.height = Math.max(600, height * scale);
          const ctx = canvas.getContext('2d');
          if (!ctx) throw new Error('Cannot get canvas 2d context');

          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          URL.revokeObjectURL(svgUrl);

          const pngDataUrl = canvas.toDataURL('image/png');
          await renderA4LandscapePdf(pngDataUrl, width, height);
          resolve();
        } catch (err) {
          reject(err);
        }
      };

      img.onerror = () => {
        URL.revokeObjectURL(svgUrl);
        reject(new Error("Erreur de conversion de l'image SVG vers le Canvas"));
      };

      img.src = svgUrl;
    });
  } catch (svgErr) {
    console.warn('[exportSvgToPdf] Capture SVG directe échouée, repli vers export PDF vectoriel:', svgErr);
    await buildMultiPagePdfDocument({
      title: docTitle || 'Carte Mentale',
      subtitle: 'Arborescence & Cartographie Conceptuelle',
      themeBadge: 'CARTE MENTALE',
      items: [
        { type: 'heading', text: docTitle || 'Carte Mentale' },
        { type: 'text', text: 'Document officiel généré par StudyCloud.' },
      ],
      filename: `${docTitle || 'Carte_Mentale'}_Export`,
    });
  }
}

// ============================================================================
// EXPORT FICHE DE RÉSUMÉ (RESUME) VERS PDF
// ============================================================================

export async function exportResumePdf(summary: any): Promise<void> {
  // Rendu fidèle à l'identique de l'écran avec formules KaTeX réelles, couleurs et typographie
  if (typeof document !== 'undefined') {
    const el = document.getElementById('resume-document-content');
    if (el) {
      try {
        await exportHtmlElementToPdf(el, summary.title || 'Fiche_Resume');
        return;
      } catch (domErr) {
        console.warn('[exportResumePdf] Échec capture DOM, repli vers export PDF vectoriel:', domErr);
      }
    }
  }

  const items: UniversalPdfItem[] = [];

  if (Array.isArray(summary.sections) && summary.sections.length > 0) {
    items.push({
      type: 'heading',
      text: 'PILIERS CONCEPTUELS & DEVELOPPEMENTS PEDAGOGIQUES',
      color: rgb(0.25, 0.35, 0.85),
    });

    summary.sections.forEach((sec: any, idx: number) => {
      items.push({
        type: 'subheading',
        text: `${sec.number || idx + 1}. ${sec.heading || `Pilier ${idx + 1}`}`,
      });
      if (sec.body) {
        items.push({
          type: 'text',
          text: sec.body,
        });
      }
      if (Array.isArray(sec.points) && sec.points.length > 0) {
        items.push({
          type: 'bullet',
          points: sec.points,
        });
      }
    });
  }

  if (Array.isArray(summary.keyDefinitions) && summary.keyDefinitions.length > 0) {
    items.push({
      type: 'heading',
      text: 'I. NOTIONS FONDAMENTALES & DEFINITIONS',
      color: rgb(0.35, 0.25, 0.80),
    });

    summary.keyDefinitions.forEach((kd: any) => {
      items.push({
        type: 'box',
        title: kd.concept || 'Notion cle',
        text: kd.definition || '',
        points: kd.objective ? [`Objectif : ${kd.objective}`] : undefined,
        bgColor: rgb(0.96, 0.97, 1.0),
        borderColor: rgb(0.80, 0.85, 0.95),
      });
    });
  }

  if (Array.isArray(summary.formulas) && summary.formulas.length > 0) {
    items.push({
      type: 'heading',
      text: 'II. FORMULAIRE, LOIS & METHODES DE CALCUL',
      color: rgb(0.10, 0.45, 0.85),
    });

    summary.formulas.forEach((f: any, idx: number) => {
      let bodyText = `Formule : ${f.latex || ''}`;
      if (f.target_goal) bodyText += `\nObjectif : ${f.target_goal}`;
      if (f.variables) bodyText += `\nVariables & Unites : ${f.variables}`;
      if (f.when_to_use) bodyText += `\nConditions : ${f.when_to_use}`;
      if (f.exam_trap) bodyText += `\nPiege d'examen : ${f.exam_trap}`;

      items.push({
        type: 'box',
        title: `[#${idx + 1}] ${f.name || `Formule ${idx + 1}`}`,
        text: bodyText,
        points: Array.isArray(f.demonstration_steps) ? f.demonstration_steps : (f.how_to_derive ? [f.how_to_derive] : undefined),
        bgColor: rgb(0.95, 0.98, 1.0),
        borderColor: rgb(0.70, 0.82, 0.95),
      });
    });
  }

  if (summary.comparisonTable && Array.isArray(summary.comparisonTable.headers) && summary.comparisonTable.headers.length > 0) {
    items.push({
      type: 'heading',
      text: 'III. TABLEAU SYNTHETIQUE COMPARATIF',
      color: rgb(0.55, 0.20, 0.75),
    });

    items.push({
      type: 'subheading',
      text: summary.comparisonTable.headers.join('  |  '),
    });

    if (Array.isArray(summary.comparisonTable.rows)) {
      summary.comparisonTable.rows.forEach((row: any[]) => {
        items.push({
          type: 'bullet',
          text: Array.isArray(row) ? row.join('  |  ') : String(row),
        });
      });
    }
  }

  if (Array.isArray(summary.trapsAndTips) && summary.trapsAndTips.length > 0) {
    items.push({
      type: 'heading',
      text: 'IV. PIEGES A EVITER & ASTUCES METHODOLOGIQUES (NB)',
      color: rgb(0.85, 0.35, 0.15),
    });

    summary.trapsAndTips.forEach((tt: any) => {
      const isTrap = tt.type === 'trap' || /piege/i.test(tt.title || '');
      items.push({
        type: 'box',
        title: isTrap ? `[PIEGE CLASSIQUE] ${tt.title || ''}` : `[ASTUCE NB] ${tt.title || ''}`,
        text: tt.content || '',
        bgColor: isTrap ? rgb(1.0, 0.95, 0.95) : rgb(1.0, 0.98, 0.92),
        borderColor: isTrap ? rgb(0.95, 0.75, 0.75) : rgb(0.95, 0.85, 0.65),
      });
    });
  }

  if (summary.practicalExample && (summary.practicalExample.statement || summary.practicalExample.resolution_steps)) {
    items.push({
      type: 'heading',
      text: 'V. EXEMPLE PRATIQUE RESOLU PAS A PAS',
      color: rgb(0.10, 0.55, 0.35),
    });

    if (summary.practicalExample.statement) {
      items.push({
        type: 'subheading',
        text: "Enonce de l'exemple :",
      });
      items.push({
        type: 'text',
        text: summary.practicalExample.statement,
      });
    }

    if (Array.isArray(summary.practicalExample.resolution_steps) && summary.practicalExample.resolution_steps.length > 0) {
      items.push({
        type: 'subheading',
        text: 'Resolution methodique etape par etape :',
      });
      items.push({
        type: 'bullet',
        points: summary.practicalExample.resolution_steps,
      });
    }
  }

  await buildMultiPagePdfDocument({
    title: summary.title || 'Fiche de Synthese',
    subtitle: summary.theme ? `THEME : ${summary.theme}` : 'Support de Cours et Masterclass Pedagogique',
    themeBadge: summary.theme || 'SYNTHESE DU COURS',
    overview: summary.overview,
    items,
    filename: `${summary.title || 'Fiche'}_Resume`,
  });
}

// ============================================================================
// EXPORT EXERCICES ÉCRITS VERS PDF
// ============================================================================

export async function exportExercicesPdf(data: {
  title: string;
  context?: string;
  questions: any[];
  answers?: Record<string, string[]>;
  correction?: any;
  gradingResult?: any;
  isSubmitted?: boolean;
}): Promise<void> {
  // Rendu fidèle à l'identique de l'écran avec formules KaTeX réelles
  if (typeof document !== 'undefined') {
    const el = document.getElementById('exercices-printable-sheet') || document.getElementById('module-exercices-ecrits');
    if (el) {
      try {
        await exportHtmlElementToPdf(el, data.title || 'Exercice_Copie');
        return;
      } catch (domErr) {
        console.warn('[exportExercicesPdf] Échec capture DOM, repli vers export PDF vectoriel:', domErr);
      }
    }
  }

  const items: UniversalPdfItem[] = [];

  if (data.context) {
    items.push({
      type: 'heading',
      text: 'ENONCE GENERAL & CONTEXTE DU PROBLEME',
      color: rgb(0.15, 0.45, 0.75),
    });
    items.push({
      type: 'text',
      text: data.context,
    });
  }

  items.push({
    type: 'heading',
    text: 'QUESTIONS & TRAVAIL DE L\'ELEVE',
    color: rgb(0.20, 0.35, 0.70),
  });

  data.questions.forEach((q: any) => {
    items.push({
      type: 'subheading',
      text: `Question ${q.number || ''} (${q.points || 2.5} points) : ${q.text || ''}`,
    });

    const userLines = (data.answers?.[q.id] || []).filter((l: string) => l && l.trim().length > 0);
    if (userLines.length > 0) {
      items.push({
        type: 'box',
        title: 'Reponse de l\'etudiant :',
        text: userLines.join('\n'),
        bgColor: rgb(0.97, 0.98, 1.0),
        borderColor: rgb(0.80, 0.85, 0.95),
      });
    } else {
      items.push({
        type: 'text',
        text: '[Aucune reponse saisie par l\'etudiant]',
      });
    }

    if (data.isSubmitted && q.sampleAnswer) {
      const qScore = data.gradingResult?.questionsFeedback?.[q.id]?.score;
      const qComment = data.gradingResult?.questionsFeedback?.[q.id]?.comment;

      let corrTitle = 'Corrige officiel pas a pas :';
      if (qScore !== undefined) {
        corrTitle = `Note : ${qScore} / ${q.points || 2.5} pts • Corrige officiel :`;
      }

      let corrText = q.sampleAnswer;
      if (qComment) {
        corrText = `Appreciation : ${qComment}\n\nDemonstration :\n${q.sampleAnswer}`;
      }

      items.push({
        type: 'box',
        title: corrTitle,
        text: corrText,
        bgColor: rgb(0.95, 0.99, 0.96),
        borderColor: rgb(0.75, 0.90, 0.78),
      });
    }
  });

  if (data.isSubmitted && data.correction) {
    items.push({
      type: 'heading',
      text: 'METHODOLOGIE GLOBALE DE RESOLUTION',
      color: rgb(0.10, 0.55, 0.35),
    });

    if (data.correction.steps) {
      items.push({
        type: 'text',
        text: data.correction.steps,
      });
    }

    if (Array.isArray(data.correction.examples) && data.correction.examples.length > 0) {
      items.push({
        type: 'subheading',
        text: 'Exemples d\'application concrets :',
      });
      items.push({
        type: 'bullet',
        points: data.correction.examples,
      });
    }
  }

  let sub = "Série d'Exercices Écrits d'Application";
  if (data.isSubmitted && data.gradingResult) {
    sub = `COPIE NOTEE : ${data.gradingResult.scoreTotal ?? 0} / 20 POINTS • ${data.gradingResult.feedbackGlobal || ''}`;
  }

  await buildMultiPagePdfDocument({
    title: data.title || 'Exercices Ecrits',
    subtitle: sub,
    themeBadge: 'EXERCICES ECRITS',
    overview: data.context ? `Etude approfondie et mise en application directe du cours.` : undefined,
    items,
    filename: `${data.title || 'Exercices'}_Ecrits_Copie`,
  });
}

// ============================================================================
// EXPORT DEVOIR COMPLET EXAMEN VERS PDF
// ============================================================================

export async function exportDevoirCompletPdf(data: {
  title: string;
  discipline?: string;
  durationSeconds?: number;
  sections: any[];
  openAnswers?: any;
  choiceAnswers?: any;
  booleanAnswers?: any;
  gradingResult?: any;
  isSubmitted?: boolean;
}): Promise<void> {
  // Rendu fidèle à l'identique de l'écran avec formules KaTeX réelles
  if (typeof document !== 'undefined') {
    const el = document.getElementById('exam-printable-full-content') ||
      document.getElementById('exam-sheet-page-1') ||
      document.querySelector('[id^="exam-sheet-page"]') ||
      document.getElementById('module-devoir-complet');
    if (el) {
      try {
        await exportHtmlElementToPdf(el as HTMLElement, data.title || 'Devoir_Examen');
        return;
      } catch (domErr) {
        console.warn('[exportDevoirCompletPdf] Échec capture DOM, repli vers export PDF vectoriel:', domErr);
      }
    }
  }

  const items: UniversalPdfItem[] = [];

  const durationMin = Math.round((data.durationSeconds || 7200) / 60);

  data.sections.forEach((sec: any, sIdx: number) => {
    items.push({
      type: 'heading',
      text: sec.title || `EXERCICE ${sIdx + 1}`,
      color: sIdx === 0 ? rgb(0.15, 0.45, 0.75) : sIdx === 1 ? rgb(0.55, 0.20, 0.75) : rgb(0.85, 0.35, 0.15),
    });

    if (sec.problem_statement) {
      items.push({
        type: 'subheading',
        text: 'Enonce du Probleme :',
      });
      items.push({
        type: 'text',
        text: sec.problem_statement,
      });
    }

    if (Array.isArray(sec.questions)) {
      sec.questions.forEach((q: any) => {
        const qTitle = `${q.number || ''} ${q.texte || q.question || ''} (${q.points || 1} pts)`;
        items.push({
          type: 'subheading',
          text: qTitle,
        });

        if (q.type === 'open') {
          const lines = (data.openAnswers?.[q.id] || []).filter((l: string) => l && l.trim().length > 0);
          items.push({
            type: 'box',
            title: 'Reponse de l\'etudiant :',
            text: lines.length > 0 ? lines.join('\n') : '[Aucune reponse redigee]',
            bgColor: rgb(0.97, 0.98, 1.0),
            borderColor: rgb(0.80, 0.85, 0.95),
          });

          if (data.isSubmitted && q.sampleAnswer) {
            items.push({
              type: 'box',
              title: 'Corrige modele pas a pas :',
              text: q.sampleAnswer,
              bgColor: rgb(0.95, 0.99, 0.96),
              borderColor: rgb(0.75, 0.90, 0.78),
            });
          }
        } else if (q.type === 'multiple_choice') {
          const userChoice = data.choiceAnswers?.[q.id];
          const optLines = (q.options || []).map((opt: string, optIdx: number) => {
            const isUser = userChoice === optIdx;
            return `${isUser ? '[X]' : '[ ]'} Choix ${String.fromCharCode(65 + optIdx)} : ${opt}`;
          });

          items.push({
            type: 'bullet',
            points: optLines,
          });

          if (data.isSubmitted) {
            items.push({
              type: 'box',
              title: `Reponse correcte : Choix ${String.fromCharCode(65 + (q.correctIndex || 0))}`,
              text: q.explanation || 'Justification analytique du choix retenu.',
              bgColor: userChoice === q.correctIndex ? rgb(0.95, 0.99, 0.96) : rgb(1.0, 0.95, 0.95),
              borderColor: userChoice === q.correctIndex ? rgb(0.75, 0.90, 0.78) : rgb(0.95, 0.75, 0.75),
            });
          }
        } else if (q.type === 'true_false') {
          const userVal = data.booleanAnswers?.[q.id];
          const userStr = userVal === true ? 'VRAI' : userVal === false ? 'FAUX' : 'Non repondu';
          items.push({
            type: 'text',
            text: `Votre reponse : ${userStr}`,
          });

          if (data.isSubmitted) {
            const expectedStr = q.correctValue ? 'VRAI' : 'FAUX';
            items.push({
              type: 'box',
              title: `Reponse attendue : ${expectedStr}`,
              text: q.explanation || 'Justification scientifique.',
              bgColor: userVal === q.correctValue ? rgb(0.95, 0.99, 0.96) : rgb(1.0, 0.95, 0.95),
              borderColor: userVal === q.correctValue ? rgb(0.75, 0.90, 0.78) : rgb(0.95, 0.75, 0.75),
            });
          }
        }
      });
    }
  });

  let sub = `Duree : ${durationMin} minutes • Epreuve sur 20 points (Exercices I, II, III)`;
  if (data.isSubmitted && data.gradingResult) {
    sub = `NOTE OFFICIELLE : ${data.gradingResult.total ?? 0} / 20 POINTS • ${data.gradingResult.appreciation || ''}`;
  }

  await buildMultiPagePdfDocument({
    title: data.title || 'Devoir Complet Examen',
    subtitle: sub,
    themeBadge: data.discipline ? `EXAMEN - ${data.discipline.toUpperCase()}` : 'EXAMEN OFFICIEL',
    overview: `Sujet d'examen d'evaluation globale comprenant trois exercices independants (Probleme analytique 8 pts, QCM 6 pts, Vrai ou Faux 6 pts).`,
    items,
    filename: `${data.title || 'Devoir'}_Examen_Copie`,
  });
}

// ============================================================================
// EXPORT QUESTIONNAIRE TEST VERS PDF
// ============================================================================

export async function exportQuestionnaireTestPdf(data: {
  title: string;
  questions: any[];
  userAnswers?: Record<number, number>;
  score?: number;
  isSubmitted?: boolean;
}): Promise<void> {
  // Rendu fidèle à l'identique de l'écran avec formules KaTeX réelles
  if (typeof document !== 'undefined') {
    const el = document.getElementById('questionnaire-test-results-panel') || document.getElementById('module-questionnaire-test');
    if (el) {
      try {
        await exportHtmlElementToPdf(el, data.title || 'Questionnaire_Test');
        return;
      } catch (domErr) {
        console.warn('[exportQuestionnaireTestPdf] Échec capture DOM, repli vers export PDF vectoriel:', domErr);
      }
    }
  }

  const items: UniversalPdfItem[] = [];

  data.questions.forEach((q: any, qIdx: number) => {
    items.push({
      type: 'subheading',
      text: `Question ${qIdx + 1} : ${q.question || ''}`,
    });

    const userChoice = data.userAnswers?.[qIdx];
    const optLines = (q.options || []).map((opt: string, optIdx: number) => {
      const isUser = userChoice === optIdx;
      return `${isUser ? '[X]' : '[ ]'} ${String.fromCharCode(65 + optIdx)}. ${opt}`;
    });

    items.push({
      type: 'bullet',
      points: optLines,
    });

    if (data.isSubmitted) {
      const isCorrect = userChoice === q.correctIndex;
      items.push({
        type: 'box',
        title: isCorrect ? 'Reponse Correcte (+1 pt)' : `Reponse Attendue : Option ${String.fromCharCode(65 + (q.correctIndex || 0))}`,
        text: q.explanation || '',
        bgColor: isCorrect ? rgb(0.95, 0.99, 0.96) : rgb(1.0, 0.95, 0.95),
        borderColor: isCorrect ? rgb(0.75, 0.90, 0.78) : rgb(0.95, 0.75, 0.75),
      });
    }
  });

  const sub = data.isSubmitted && data.score !== undefined
    ? `SCORE OBTENU : ${data.score} / ${data.questions.length} (${Math.round((data.score / data.questions.length) * 100)}%)`
    : `Questionnaire Test QCM • ${data.questions.length} questions`;

  await buildMultiPagePdfDocument({
    title: data.title || 'Questionnaire Test QCM',
    subtitle: sub,
    themeBadge: 'TEST QCM',
    items,
    filename: `${data.title || 'Questionnaire'}_Test`,
  });
}

