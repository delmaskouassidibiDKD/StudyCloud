import { PDFDocument, StandardFonts, rgb, RGB } from 'pdf-lib';

export interface ScheduleExportSlot {
  subject: string;
  room?: string;
  note?: string;
  color?: string;
}

export interface ExportScheduleOptions {
  days: string[];
  hours: string[];
  scheduleData: Record<string, ScheduleExportSlot>;
  title?: string;
}

/**
 * Nettoie le texte pour éviter toute erreur d'encodage avec StandardFonts (WinAnsi)
 */
function sanitizeText(str: string): string {
  if (!str) return '';
  return str.split('').filter((c) => {
    const code = c.charCodeAt(0);
    return (
      (code >= 32 && code <= 126) ||
      (code >= 160 && code <= 255) ||
      [8364, 338, 339, 352, 353, 376, 381, 382, 8211, 8212, 8216, 8217, 8220, 8221, 8226, 8230].includes(code)
    );
  }).join('');
}

/**
 * Tronque le texte de manière propre avec points de suspension s'il dépasse la largeur max
 */
function truncateText(
  text: string,
  font: any,
  fontSize: number,
  maxWidth: number
): string {
  let clean = sanitizeText(text);
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
 * Détermine la couleur de fond et bordure selon la classe ou nom de couleur
 */
function getSlotColors(colorStr?: string): {
  bg: RGB;
  border: RGB;
  title: RGB;
  subtitle: RGB;
} {
  const c = (colorStr || '').toLowerCase();

  // Vert pastel (emerald / green)
  if (c.includes('emerald') || c.includes('green') || c.includes('vert')) {
    return {
      bg: rgb(0.88, 0.96, 0.91),
      border: rgb(0.55, 0.82, 0.65),
      title: rgb(0.08, 0.35, 0.20),
      subtitle: rgb(0.20, 0.45, 0.28),
    };
  }

  // Bleu pastel (sky / blue)
  if (c.includes('sky') || c.includes('blue') || c.includes('bleu')) {
    return {
      bg: rgb(0.90, 0.95, 0.99),
      border: rgb(0.55, 0.78, 0.94),
      title: rgb(0.08, 0.32, 0.54),
      subtitle: rgb(0.20, 0.40, 0.60),
    };
  }

  // Jaune / Ambre pastel (amber / yellow)
  if (c.includes('amber') || c.includes('yellow') || c.includes('jaune')) {
    return {
      bg: rgb(0.99, 0.96, 0.88),
      border: rgb(0.92, 0.78, 0.40),
      title: rgb(0.50, 0.32, 0.05),
      subtitle: rgb(0.55, 0.38, 0.12),
    };
  }

  // Rose pastel (rose / pink)
  if (c.includes('rose') || c.includes('pink') || c.includes('rouge')) {
    return {
      bg: rgb(0.99, 0.91, 0.93),
      border: rgb(0.94, 0.62, 0.72),
      title: rgb(0.58, 0.15, 0.26),
      subtitle: rgb(0.62, 0.25, 0.35),
    };
  }

  // Violet pastel (purple / violet)
  if (c.includes('purple') || c.includes('violet') || c.includes('indigo')) {
    return {
      bg: rgb(0.95, 0.91, 0.98),
      border: rgb(0.78, 0.62, 0.92),
      title: rgb(0.38, 0.16, 0.58),
      subtitle: rgb(0.45, 0.25, 0.65),
    };
  }

  // Neutre par défaut
  return {
    bg: rgb(0.95, 0.95, 0.96),
    border: rgb(0.78, 0.78, 0.82),
    title: rgb(0.18, 0.20, 0.25),
    subtitle: rgb(0.35, 0.38, 0.42),
  };
}

/**
 * Exporte l'emploi du temps complet en document PDF professionnel au format A4 Paysage
 */
export async function exportScheduleToPdf(options: ExportScheduleOptions): Promise<void> {
  const { days, hours, scheduleData, title = 'Mon emploi du temps' } = options;

  if (!days || days.length === 0 || !hours || hours.length === 0) {
    throw new Error('Données d\'emploi du temps insuffisantes pour l\'exportation.');
  }

  const pdfDoc = await PDFDocument.create();
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontOblique = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);

  // Dimensions format A4 Paysage standard
  const pageWidth = 841.89;
  const pageHeight = 595.28;
  const marginX = 30;
  const marginTop = 26;
  const marginBottom = 24;

  const contentWidth = pageWidth - marginX * 2;
  const headerHeight = 44;
  const tableTopY = pageHeight - marginTop - headerHeight - 12;
  const dayHeaderHeight = 22;

  // Calcul du nombre de lignes par page pour conserver une lisibilité maximale
  // Si le tableau a jusqu'à 10 heures, tout tient élégamment sur 1 page
  // Si > 10 heures, on pagine proprement par tranches de 8 à 10 heures
  const maxHoursPerPage = hours.length <= 11 ? hours.length : 9;
  const totalPages = Math.ceil(hours.length / maxHoursPerPage);

  const timeColWidth = 80;
  const dayColWidth = (contentWidth - timeColWidth) / days.length;

  for (let pageIndex = 0; pageIndex < totalPages; pageIndex++) {
    const pageHours = hours.slice(
      pageIndex * maxHoursPerPage,
      (pageIndex + 1) * maxHoursPerPage
    );

    const availableHeight = tableTopY - dayHeaderHeight - marginBottom - 18;
    const rowHeight = Math.max(28, Math.min(52, availableHeight / pageHours.length));

    const page = pdfDoc.addPage([pageWidth, pageHeight]);

    // Fond blanc cassé doux
    page.drawRectangle({
      x: 0,
      y: 0,
      width: pageWidth,
      height: pageHeight,
      color: rgb(0.985, 0.985, 0.98),
    });

    // 1. Bandeau supérieur (Header Card)
    page.drawRectangle({
      x: marginX,
      y: pageHeight - marginTop - headerHeight,
      width: contentWidth,
      height: headerHeight,
      color: rgb(0.18, 0.29, 0.24), // #2D4A3E Vert forêt StudyCloud
    });

    // Logo StudyCloud + DKD
    page.drawText('STUDYCLOUD', {
      x: marginX + 16,
      y: pageHeight - marginTop - 20,
      font: fontBold,
      size: 13,
      color: rgb(0.98, 0.65, 0.20),
    });
    page.drawText('DKD TECHNOLOGIES', {
      x: marginX + 16,
      y: pageHeight - marginTop - 33,
      font: fontBold,
      size: 7.5,
      color: rgb(0.90, 0.90, 0.90),
    });

    // Titre principal centré
    const titleText = sanitizeText(title.toUpperCase());
    const titleWidth = fontBold.widthOfTextAtSize(titleText, 14);
    page.drawText(titleText, {
      x: marginX + (contentWidth - titleWidth) / 2,
      y: pageHeight - marginTop - 26,
      font: fontBold,
      size: 14,
      color: rgb(1, 1, 1),
    });

    // Date et badge
    const dateFormatted = new Date().toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
    const dateText = sanitizeText(`Date: ${dateFormatted}`);
    page.drawText(dateText, {
      x: marginX + contentWidth - 165,
      y: pageHeight - marginTop - 26,
      font: fontRegular,
      size: 8.5,
      color: rgb(0.85, 0.92, 0.88),
    });

    // 2. En-tête des Jours
    page.drawRectangle({
      x: marginX,
      y: tableTopY - dayHeaderHeight,
      width: contentWidth,
      height: dayHeaderHeight,
      color: rgb(0.24, 0.36, 0.30),
    });

    // Label Colonne Heures
    page.drawText('HORAIRES', {
      x: marginX + 14,
      y: tableTopY - dayHeaderHeight + 7,
      font: fontBold,
      size: 8.5,
      color: rgb(1, 1, 1),
    });

    // Labels Jours
    days.forEach((day, dIdx) => {
      const colX = marginX + timeColWidth + dIdx * dayColWidth;
      const dayText = truncateText(day.toUpperCase(), fontBold, 8.5, dayColWidth - 8);
      const textWidth = fontBold.widthOfTextAtSize(dayText, 8.5);
      page.drawText(dayText, {
        x: colX + Math.max(4, (dayColWidth - textWidth) / 2),
        y: tableTopY - dayHeaderHeight + 7,
        font: fontBold,
        size: 8.5,
        color: rgb(1, 1, 1),
      });
    });

    // 3. Rendu des lignes et des cellules
    let currentY = tableTopY - dayHeaderHeight;

    pageHours.forEach((hourSlot) => {
      currentY -= rowHeight;

      // Cellule horaire
      page.drawRectangle({
        x: marginX,
        y: currentY,
        width: timeColWidth,
        height: rowHeight,
        color: rgb(0.94, 0.93, 0.90),
        borderColor: rgb(0.78, 0.76, 0.72),
        borderWidth: 0.5,
      });

      const cleanHour = sanitizeText(hourSlot);
      const hText = truncateText(cleanHour, fontBold, 8, timeColWidth - 8);
      const hTextW = fontBold.widthOfTextAtSize(hText, 8);
      page.drawText(hText, {
        x: marginX + Math.max(4, (timeColWidth - hTextW) / 2),
        y: currentY + rowHeight / 2 - 3.5,
        font: fontBold,
        size: 8,
        color: rgb(0.18, 0.22, 0.20),
      });

      // Cellules des jours pour ce créneau
      days.forEach((day, dIdx) => {
        const colX = marginX + timeColWidth + dIdx * dayColWidth;
        const slot = scheduleData[`${day}_${hourSlot}`];

        if (slot && slot.subject && slot.subject.trim()) {
          const colors = getSlotColors(slot.color);

          // Carte avec bordure et fond pastel
          page.drawRectangle({
            x: colX + 1.5,
            y: currentY + 1.5,
            width: dayColWidth - 3,
            height: rowHeight - 3,
            color: colors.bg,
            borderColor: colors.border,
            borderWidth: 0.8,
          });

          // Matière (titre principal en gras)
          const subjText = truncateText(slot.subject, fontBold, 8.5, dayColWidth - 8);
          page.drawText(subjText, {
            x: colX + 5,
            y: currentY + rowHeight - 13,
            font: fontBold,
            size: 8.5,
            color: colors.title,
          });

          // Salle (si renseignée)
          if (slot.room && slot.room.trim() && rowHeight >= 36) {
            const roomText = truncateText(`Salle: ${slot.room.trim()}`, fontRegular, 7, dayColWidth - 8);
            page.drawText(roomText, {
              x: colX + 5,
              y: currentY + rowHeight - 23,
              font: fontRegular,
              size: 7,
              color: colors.subtitle,
            });
          }

          // Remarque ou Professeur (si renseigné)
          if (slot.note && slot.note.trim() && rowHeight >= 46) {
            const noteText = truncateText(slot.note.trim(), fontOblique, 6.5, dayColWidth - 8);
            page.drawText(noteText, {
              x: colX + 5,
              y: currentY + 6,
              font: fontOblique,
              size: 6.5,
              color: colors.subtitle,
            });
          }
        } else {
          // Case libre quadrillée
          page.drawRectangle({
            x: colX,
            y: currentY,
            width: dayColWidth,
            height: rowHeight,
            color: rgb(1, 1, 1),
            borderColor: rgb(0.86, 0.85, 0.83),
            borderWidth: 0.5,
          });
        }
      });
    });

    // 4. Pied de page discret (Footer)
    const footerY = 12;
    page.drawLine({
      start: { x: marginX, y: footerY + 14 },
      end: { x: marginX + contentWidth, y: footerY + 14 },
      thickness: 0.5,
      color: rgb(0.80, 0.80, 0.80),
    });

    page.drawText('StudyCloud - Plateforme d\'apprentissage et de reussite scolaire', {
      x: marginX,
      y: footerY + 3,
      font: fontRegular,
      size: 7.5,
      color: rgb(0.45, 0.50, 0.48),
    });

    const pageCountText = `Page ${pageIndex + 1} / ${totalPages}`;
    const pageCountWidth = fontRegular.widthOfTextAtSize(pageCountText, 7.5);
    page.drawText(pageCountText, {
      x: marginX + contentWidth - pageCountWidth,
      y: footerY + 3,
      font: fontRegular,
      size: 7.5,
      color: rgb(0.45, 0.50, 0.48),
    });
  }

  // Sauvegarder et déclencher le téléchargement côté navigateur
  const pdfBytes = await pdfDoc.save();
  const blob = new Blob([pdfBytes], { type: 'application/pdf' });
  const downloadUrl = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = downloadUrl;
  link.download = `Emploi_du_temps_StudyCloud_${new Date().toISOString().slice(0, 10)}.pdf`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  setTimeout(() => {
    URL.revokeObjectURL(downloadUrl);
  }, 2000);
}
