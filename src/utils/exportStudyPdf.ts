import { PDFDocument, StandardFonts, rgb, type PDFFont } from 'pdf-lib';
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
 * Nettoie récursivement les formules LaTeX (fractions imbriquées, symboles grecs, etc.)
 */
function cleanLatexMathString(text: string): string {
  if (!text) return '';
  let str = text;

  // Résolution récursive des fractions (\dfrac & \frac) jusqu'à 8 niveaux d'imbrication
  let prev = '';
  let depth = 0;
  while (depth < 8 && str !== prev) {
    prev = str;
    str = str
      .replace(/j\s*\\(?:dfrac|frac)/g, 'j * \\dfrac')
      .replace(/\\(?:dfrac|frac)\s*\{([^{}]+)\}\s*\{([^{}]+)\}/g, '($1) / ($2)')
      .replace(/\\(?:sqrt)\s*\{([^{}]+)\}/g, 'sqrt($1)')
      .replace(/\\(?:boxed|underline|textbf|textit|mathrm|mathbf|text|operatorname)\s*\{([^{}]+)\}/g, '$1');
    depth++;
  }

  // Remplacement des symboles grecs, flèches et opérateurs récurrents
  str = str
    .replace(/\\(?:implies|Rightarrow)/g, ' => ')
    .replace(/\\(?:iff|Leftrightarrow)/g, ' <=> ')
    .replace(/\\(?:to|rightarrow)/g, ' -> ')
    .replace(/\\(?:varepsillon|varepsilon|epsilon)/g, 'epsilon')
    .replace(/\\in\b/g, ' in ')
    .replace(/\\omega_0/g, 'w0')
    .replace(/\\omega/g, 'w')
    .replace(/\\Omega_0/g, 'Omega_0')
    .replace(/\\Omega/g, 'Ohm')
    .replace(/\\Delta/g, 'Delta')
    .replace(/\\pi/g, 'pi')
    .replace(/\\tau/g, 'tau')
    .replace(/\\theta/g, 'theta')
    .replace(/\\alpha/g, 'alpha')
    .replace(/\\beta/g, 'beta')
    .replace(/\\gamma/g, 'gamma')
    .replace(/\\lambda/g, 'lambda')
    .replace(/\\mu/g, 'micro')
    .replace(/\\sigma/g, 'sigma')
    .replace(/\\phi/g, 'phi')
    .replace(/\\Phi/g, 'Phi')
    .replace(/\\leq/g, '<=')
    .replace(/\\geq/g, '>=')
    .replace(/\\neq/g, '!=')
    .replace(/\\approx/g, '~=')
    .replace(/\\times/g, ' x ')
    .replace(/\\cdot/g, ' * ')
    .replace(/\\pm/g, '+/-')
    .replace(/\\mp/g, '-+')
    .replace(/\\infty/g, 'inf')
    .replace(/\\partial/g, 'd')
    .replace(/\\left\(/g, '(')
    .replace(/\\right\)/g, ')')
    .replace(/\\left\[/g, '[')
    .replace(/\\right\]/g, ']')
    .replace(/\\left\{/g, '{')
    .replace(/\\right\}/g, '}')
    .replace(/\\left\|/g, '|')
    .replace(/\\right\|/g, '|')
    .replace(/\\left\./g, '')
    .replace(/\\right\./g, '')
    .replace(/\\quad/g, '  ')
    .replace(/\\qquad/g, '    ')
    .replace(/\bto\s+infty\b/gi, ' -> inf')
    .replace(/\bto\s+0\b/gi, ' -> 0')
    .replace(/\binfty\b/gi, 'inf')
    .replace(/_\{([^{}]+)\}/g, '_$1')
    .replace(/\^\{([^{}]+)\}/g, '^$1')
    .replace(/\$\$/g, '')
    .replace(/\$/g, '')
    .replace(/\\[a-zA-Z]+/g, '')
    .replace(/[{}]/g, '');

  return str;
}

/**
 * Nettoie et formate les formules LaTeX et caractères pour un rendu PDF propre en police standard WinAnsi
 */
function sanitizeForPdf(str: string): string {
  if (!str) return '';
  const cleaned = cleanLatexMathString(str);
  return cleaned
    .split('')
    .filter((c) => {
      const code = c.charCodeAt(0);
      return (
        code === 10 ||
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
function wrapPdfText(text: string, font: PDFFont | any, fontSize: number, maxWidth: number): string[] {
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
      let width = 0;
      try {
        width = font.widthOfTextAtSize(testLine, fontSize);
      } catch {
        width = testLine.length * fontSize * 0.6;
      }
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
function truncatePdfText(text: string, font: PDFFont | any, fontSize: number, maxWidth: number): string {
  let clean = sanitizeForPdf(text);
  if (!clean) return '';
  try {
    if (font.widthOfTextAtSize(clean, fontSize) <= maxWidth) {
      return clean;
    }
    while (clean.length > 1 && font.widthOfTextAtSize(clean + '...', fontSize) > maxWidth) {
      clean = clean.slice(0, -1);
    }
    return clean + '...';
  } catch {
    return clean.slice(0, Math.max(1, Math.floor(maxWidth / (fontSize * 0.6)))) + '...';
  }
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
/**
 * Prépare et normalise un document cloné pour html2canvas :
 * - Largeur standardisée A4 pour un affichage optimal "en grand et en détails"
 * - Élimination absolue des barres de défilement (scrollbars) et épanouissement des formules
 * - Nettoyage des filtres SVG incompatibles
 * - Conversion de toutes les couleurs modernes (oklch, oklab, color()) en RGB standard compatible avec le moteur de rendu
 */
function prepareClonedDocForHtml2Canvas(clonedDoc: Document, targetEl?: HTMLElement | null): void {
  try {
    const style = clonedDoc.createElement('style');
    style.textContent = `
      * {
        scrollbar-width: none !important;
        -ms-overflow-style: none !important;
      }
      *::-webkit-scrollbar {
        display: none !important;
        width: 0 !important;
        height: 0 !important;
      }
      .overflow-x-auto, .overflow-y-auto, [class*="overflow-"] {
        overflow: visible !important;
      }
      .katex-display {
        overflow: visible !important;
        overflow-x: visible !important;
        overflow-y: visible !important;
        margin: 0.5em 0 !important;
      }
    `;
    clonedDoc.head?.appendChild(style);
  } catch {}

  try {
    if (targetEl) {
      targetEl.style.position = 'static';
      targetEl.style.left = '0';
      targetEl.style.top = '0';
      targetEl.style.zIndex = '1';
      targetEl.style.display = 'block';
      targetEl.style.visibility = 'visible';
      targetEl.style.opacity = '1';
      targetEl.style.width = '860px';
      targetEl.style.maxWidth = '860px';
      targetEl.style.margin = '0 auto';
      targetEl.style.overflow = 'visible';

      // Ajustement des formules KaTeX trop larges dans le document cloné
      const mathDisplays = targetEl.querySelectorAll<HTMLElement>('.katex-display');
      mathDisplays.forEach((m) => {
        m.style.overflow = 'visible';
        if (m.scrollWidth > 800) {
          const ratio = Math.min(1, 800 / m.scrollWidth);
          if (ratio < 0.98) {
            m.style.transform = `scale(${ratio})`;
            m.style.transformOrigin = 'center center';
          }
        }
      });
    }
  } catch {}

  try {
    const filters = clonedDoc.querySelectorAll('filter');
    filters.forEach((f) => f.remove());
    const filteredEls = clonedDoc.querySelectorAll('[filter]');
    filteredEls.forEach((el) => el.removeAttribute('filter'));
  } catch {}

  try {
    const canvas = clonedDoc.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    const ctx = canvas.getContext('2d');

    const toRgb = (val: string): string => {
      if (!val) return val;
      const lower = val.toLowerCase();
      if (
        !lower.includes('oklch') &&
        !lower.includes('oklab') &&
        !lower.includes('color(') &&
        !lower.includes('lch(') &&
        !lower.includes('lab(')
      ) {
        return val;
      }
      if (!ctx) return '#000000';
      try {
        ctx.fillStyle = '#000000';
        ctx.fillStyle = val;
        return ctx.fillStyle || '#000000';
      } catch {
        return '#000000';
      }
    };

    const rootEl = targetEl || clonedDoc.body;
    if (rootEl) {
      const allEls = [rootEl, ...Array.from(rootEl.querySelectorAll('*'))];
      for (const node of allEls) {
        const el = node as HTMLElement;
        if (!el || !el.style) continue;
        try {
          const cs = window.getComputedStyle(el);
          if (cs.color && (cs.color.includes('ok') || cs.color.includes('color('))) {
            el.style.color = toRgb(cs.color);
          }
          if (cs.backgroundColor && (cs.backgroundColor.includes('ok') || cs.backgroundColor.includes('color('))) {
            el.style.backgroundColor = toRgb(cs.backgroundColor);
          }
          if (cs.borderColor && (cs.borderColor.includes('ok') || cs.borderColor.includes('color('))) {
            el.style.borderColor = toRgb(cs.borderColor);
          }
        } catch {}
      }
    }
  } catch (colorErr) {
    console.warn('[PDF Export] Normalisation couleurs:', colorErr);
  }
}

/**
 * Capture haute fidélité d'un élément DOM en canvas HTML via html2canvas local optimisé.
 * Sans aucun appel réseau bloquant, avec exécution rapide et empreinte mémoire maîtrisée.
 */
async function captureDomElementToCanvas(
  target: HTMLElement,
  options?: {
    scale?: number;
    backgroundColor?: string;
  }
): Promise<HTMLCanvasElement> {
  if (typeof document !== 'undefined' && 'fonts' in document) {
    try {
      await (document as any).fonts.ready;
    } catch {
      // Continuer
    }
  }

  const filterFn = (node: HTMLElement) => {
    if (!node || !node.tagName) return true;
    const tag = node.tagName.toLowerCase();
    if (tag === 'button') {
      const txt = (node.textContent || '').trim();
      if (
        txt.includes('Télécharger') ||
        txt.includes('Copier') ||
        txt.includes('Imprimer') ||
        txt.includes('Recommencer')
      ) {
        return false;
      }
    }
    if (
      node.classList &&
      (node.classList.contains('no-print') ||
        node.getAttribute('data-no-print') === 'true')
    ) {
      return false;
    }
    return true;
  };

  const scale = options?.scale || 1.6;
  const bg = options?.backgroundColor || '#ffffff';

  // html2canvas direct et 100% local (ne freeze jamais le navigateur)
  const canvas = await html2canvas(target, {
    scale: Math.min(scale, 1.6),
    useCORS: true,
    allowTaint: false,
    backgroundColor: bg,
    logging: false,
    scrollX: 0,
    scrollY: 0,
    windowWidth: 860,
    onclone: (clonedDoc) => {
      const clonedTarget =
        (target.id ? clonedDoc.getElementById(target.id) : null) ||
        (clonedDoc.body.firstElementChild as HTMLElement);
      prepareClonedDocForHtml2Canvas(clonedDoc, clonedTarget);
    },
    ignoreElements: (el) => !filterFn(el as HTMLElement),
  });

  return canvas;
}

/**
 * Capture fidèlement un élément HTML (avec formules KaTeX réelles, polices, couleurs et cartes)
 * et le convertit en document PDF multi-pages A4 sans AUCUNE coupure de texte ni de titre,
 * sans barres de défilement et avec respiration non-bloquante du navigateur.
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

  const orientation = options?.orientation || 'portrait';
  const isLandscape = orientation === 'landscape';
  const pageWidthPt = isLandscape ? 841.89 : 595.28;
  const pageHeightPt = isLandscape ? 595.28 : 841.89;
  const marginPt = options?.marginPt ?? 24;
  const footerHeightPt = 24;
  const usableWidthPt = pageWidthPt - 2 * marginPt;
  const usableHeightPt = pageHeightPt - 2 * marginPt - footerHeightPt;
  const aspect = usableHeightPt / usableWidthPt;

  // 1. Repérage préalable des titres et en-têtes dans le DOM
  const targetRect = target.getBoundingClientRect();
  const rawHeadingBoxes: { topRel: number; bottomRel: number }[] = [];
  if (targetRect.height > 0) {
    try {
      const headingEls = target.querySelectorAll('h1, h2, h3, h4, header, [class*="heading"]');
      headingEls.forEach((h) => {
        const hr = (h as HTMLElement).getBoundingClientRect();
        if (hr.height > 0) {
          rawHeadingBoxes.push({
            topRel: (hr.top - targetRect.top) / targetRect.height,
            bottomRel: (hr.bottom - targetRect.top) / targetRect.height,
          });
        }
      });
    } catch (err) {
      console.warn('[PDF Export] Repérage titres DOM:', err);
    }
  }

  // 2. Capture rapide via html2canvas local
  const canvas = await captureDomElementToCanvas(target, {
    scale: options?.scale || 1.6,
    backgroundColor: '#ffffff',
  });

  const canvasWidth = canvas.width;
  const canvasHeight = canvas.height;
  if (!canvasWidth || !canvasHeight) {
    throw new Error('Canvas invalide lors de la capture.');
  }

  const maxSliceHeightPx = Math.floor(canvasWidth * aspect);
  const headingZones = rawHeadingBoxes.map((hb) => ({
    top: Math.round(hb.topRel * canvasHeight),
    bottom: Math.round(hb.bottomRel * canvasHeight),
  }));

  const ctx = canvas.getContext('2d', { willReadFrequently: true });

  // 3. Découpage intelligent au pixel près : détection des lignes blanches horizontales
  // ZÉRO coupure de texte, ZÉRO coupure de formules mathématiques, progression absolue garantie
  const cuts: { startY: number; endY: number }[] = [];
  let currentY = 0;
  const minStep = Math.max(180, Math.floor(maxSliceHeightPx * 0.40));

  while (currentY < canvasHeight) {
    const targetCutY = currentY + maxSliceHeightPx;
    if (targetCutY >= canvasHeight) {
      cuts.push({ startY: currentY, endY: canvasHeight });
      break;
    }

    // Fenêtre de recherche du meilleur saut de page naturel (entre 55% et 100% de la hauteur autorisée)
    const windowMaxY = Math.min(canvasHeight - 1, targetCutY - 4);
    const windowMinY = currentY + Math.floor(maxSliceHeightPx * 0.55);

    let bestCutY = -1;

    if (ctx && windowMaxY > windowMinY) {
      const windowH = windowMaxY - windowMinY + 1;
      const imgData = ctx.getImageData(0, windowMinY, canvasWidth, windowH).data;

      const leftMargin = Math.floor(canvasWidth * 0.05);
      const rightMargin = Math.floor(canvasWidth * 0.95);

      const isWhitespaceRow: boolean[] = new Array(windowH);
      const darkCountPerRow: number[] = new Array(windowH);

      for (let row = 0; row < windowH; row++) {
        let darkPixels = 0;
        const rowOffset = row * canvasWidth * 4;

        // Échantillonnage ultra-rapide par pas de 8 pixels avec rupture anticipée dès 3 pixels d'encre
        for (let x = leftMargin; x < rightMargin; x += 8) {
          const pxIdx = rowOffset + x * 4;
          const a = imgData[pxIdx + 3];
          if (a > 60) {
            const r = imgData[pxIdx];
            const g = imgData[pxIdx + 1];
            const b = imgData[pxIdx + 2];
            // Détection d'encre (texte, formule mathématique, bordure)
            if (r < 220 || g < 220 || b < 220) {
              darkPixels++;
              if (darkPixels > 2) {
                // Dès 3 pixels sombres, la ligne contient du contenu et ne peut être coupée
                break;
              }
            }
          }
        }

        darkCountPerRow[row] = darkPixels;
        // Ligne blanche garantie si 0 ou au maximum 1 pixel sombre résiduel (anti-aliasing)
        isWhitespaceRow[row] = darkPixels <= 1;
      }

      // Détection des bandes continues d'espace blanc
      interface WhitespaceBand {
        height: number;
        canvasMidY: number;
      }
      const bands: WhitespaceBand[] = [];
      let inBand = false;
      let bandStart = 0;

      for (let row = 0; row < windowH; row++) {
        if (isWhitespaceRow[row]) {
          if (!inBand) {
            inBand = true;
            bandStart = row;
          }
        } else {
          if (inBand) {
            inBand = false;
            bands.push({
              height: row - bandStart,
              canvasMidY: windowMinY + Math.floor((bandStart + row - 1) / 2),
            });
          }
        }
      }
      if (inBand) {
        bands.push({
          height: windowH - bandStart,
          canvasMidY: windowMinY + Math.floor((bandStart + windowH - 1) / 2),
        });
      }

      // Fonction évitant de couper à l'intérieur d'un titre ou juste en-dessous (titre orphelin)
      const isBadForHeading = (cutY: number): boolean => {
        for (const hz of headingZones) {
          if (cutY >= hz.top - 4 && cutY <= hz.bottom + 65) {
            return true;
          }
        }
        return false;
      };

      // 1ère Priorité : Grand espace blanc entre cartes/sections (>= 14px)
      for (let i = bands.length - 1; i >= 0; i--) {
        const b = bands[i];
        if (b.height >= 14 && !isBadForHeading(b.canvasMidY)) {
          bestCutY = b.canvasMidY;
          break;
        }
      }

      // 2ème Priorité : Espace blanc moyen entre paragraphes/points/formules (>= 6px)
      if (bestCutY === -1) {
        for (let i = bands.length - 1; i >= 0; i--) {
          const b = bands[i];
          if (b.height >= 6 && !isBadForHeading(b.canvasMidY)) {
            bestCutY = b.canvasMidY;
            break;
          }
        }
      }

      // 3ème Priorité : Espace blanc interligne (>= 2px)
      if (bestCutY === -1) {
        for (let i = bands.length - 1; i >= 0; i--) {
          const b = bands[i];
          if (b.height >= 2 && !isBadForHeading(b.canvasMidY)) {
            bestCutY = b.canvasMidY;
            break;
          }
        }
      }

      // 4ème Priorité : Tout espace blanc valide
      if (bestCutY === -1) {
        for (let i = bands.length - 1; i >= 0; i--) {
          const b = bands[i];
          if (b.height >= 2) {
            bestCutY = b.canvasMidY;
            break;
          }
        }
      }

      // 5ème Priorité : Ligne avec le moins absolu de pixels sombres
      if (bestCutY === -1) {
        let minDark = Infinity;
        let minRow = windowH - 1;
        for (let row = windowH - 1; row >= 0; row--) {
          if (darkCountPerRow[row] < minDark) {
            minDark = darkCountPerRow[row];
            minRow = row;
          }
        }
        bestCutY = windowMinY + minRow;
      }
    }

    // Protection anti-titre orphelin : si le saut touche un titre, couper avant le titre
    if (bestCutY > 0) {
      for (const hz of headingZones) {
        if (bestCutY >= hz.top - 4 && bestCutY <= hz.bottom + 65) {
          const candidateCut = hz.top - 8;
          if (candidateCut >= currentY + minStep && candidateCut <= targetCutY) {
            bestCutY = candidateCut;
          }
          break;
        }
      }
    }

    // GARANTIE ABSOLUE DE PROGRESSION (Évite tout blocage, boucle infinie ou retour en arrière)
    if (bestCutY < currentY + minStep || bestCutY > targetCutY) {
      bestCutY = targetCutY;
    }

    cuts.push({ startY: currentY, endY: bestCutY });
    currentY = bestCutY;
  }

  // 4. Génération du document PDF avec respiration de l'event loop (anti-freeze)
  const pdfDoc = await PDFDocument.create();
  const totalPages = cuts.length;
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  for (let pIdx = 0; pIdx < totalPages; pIdx++) {
    // Laisser respirer l'interface du navigateur pour ne JAMAIS déclencher "Page ne répondant pas"
    await new Promise((resolve) => setTimeout(resolve, 20));

    const cut = cuts[pIdx];
    const sliceHeight = cut.endY - cut.startY;
    if (sliceHeight <= 0) continue;

    const sliceCanvas = document.createElement('canvas');
    sliceCanvas.width = canvasWidth;
    sliceCanvas.height = sliceHeight;
    const sCtx = sliceCanvas.getContext('2d');
    if (sCtx) {
      sCtx.fillStyle = '#ffffff';
      sCtx.fillRect(0, 0, sliceCanvas.width, sliceCanvas.height);
      sCtx.drawImage(
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

    // Ligne séparatrice de pied de page discret et officiel
    page.drawLine({
      start: { x: marginPt, y: 22 },
      end: { x: pageWidthPt - marginPt, y: 22 },
      thickness: 0.5,
      color: rgb(0.85, 0.85, 0.85),
    });

    // Mention officielle à gauche
    page.drawText('StudyCloud • Document Officiel d\'Étude — Plateforme Universitaire & Scolaire', {
      x: marginPt,
      y: 11,
      size: 7.2,
      font: fontRegular,
      color: rgb(0.48, 0.48, 0.48),
    });

    // Pagination officielle à droite
    const pageNumText = `Page ${pIdx + 1} / ${totalPages}`;
    const pageNumWidth = fontBold.widthOfTextAtSize(pageNumText, 7.5);
    page.drawText(pageNumText, {
      x: pageWidthPt - marginPt - pageNumWidth,
      y: 11,
      size: 7.5,
      font: fontBold,
      color: rgb(0.22, 0.22, 0.22),
    });
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

    await new Promise((resolve) => setTimeout(resolve, 20));

    const canvas = await captureDomElementToCanvas(el, { scale: 1.6 });

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
  const svgEl = document.getElementById(svgElementId) as unknown as SVGSVGElement | null;
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

export async function exportResumePdf(summary: any, targetElement?: HTMLElement | null): Promise<void> {
  // Rendu fidèle à l'identique de l'écran avec formules KaTeX réelles, couleurs et typographie
  if (typeof document !== 'undefined') {
    const el =
      targetElement ||
      document.getElementById('resume-document-content') ||
      document.querySelector('#resume-document-content') ||
      document.getElementById('module-resume');
    if (el) {
      try {
        await exportHtmlElementToPdf(el as HTMLElement, summary.title || 'Fiche_Resume');
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
          text: cleanLatexMathString(sec.body),
        });
      }
      if (Array.isArray(sec.points) && sec.points.length > 0) {
        items.push({
          type: 'bullet',
          points: sec.points.map((p: string) => cleanLatexMathString(p)),
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
        text: cleanLatexMathString(kd.definition || ''),
        points: kd.objective ? [`Objectif : ${cleanLatexMathString(kd.objective)}`] : undefined,
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
      const cleanFormula = cleanLatexMathString(f.latex || '');
      let bodyText = `Formule : ${cleanFormula}`;
      if (f.target_goal) bodyText += `\n\nObjectif : ${cleanLatexMathString(f.target_goal)}`;
      if (f.variables) bodyText += `\n\nVariables & Unites : ${cleanLatexMathString(f.variables)}`;
      if (f.when_to_use) bodyText += `\n\nConditions : ${cleanLatexMathString(f.when_to_use)}`;
      if (f.exam_trap) bodyText += `\n\nPiege d'examen : ${cleanLatexMathString(f.exam_trap)}`;

      items.push({
        type: 'box',
        title: `[#${idx + 1}] ${f.name || `Formule ${idx + 1}`}`,
        text: bodyText,
        points: Array.isArray(f.demonstration_steps)
          ? f.demonstration_steps.map((s: string) => cleanLatexMathString(s))
          : (f.how_to_derive ? [cleanLatexMathString(f.how_to_derive)] : undefined),
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

