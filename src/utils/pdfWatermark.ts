import { PDFDocument } from 'pdf-lib';

/**
 * Convertit un SVG en ArrayBuffer (PNG) via un Canvas HTML5 à haute résolution (2x)
 */
async function generateLogoPngBuffer(): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    try {
      const svgWidth = 260;
      const svgHeight = 70;
      const svgString = `
        <svg width="${svgWidth}" height="${svgHeight}" viewBox="0 0 ${svgWidth} ${svgHeight}" xmlns="http://www.w3.org/2000/svg">
          <!-- Background sombre arrondi et fin -->
          <rect width="${svgWidth}" height="${svgHeight}" rx="12" fill="#1c1917" />
          <rect x="0.5" y="0.5" width="${svgWidth - 1}" height="${svgHeight - 1}" rx="11.5" fill="none" stroke="rgba(255,255,255,0.14)" stroke-width="1" />
          
          <!-- Icône ADN -->
          <g transform="translate(14, 15) scale(1.4)">
            <path d="M8 3C8 3 8 10 12 12C16 14 16 21 16 21" stroke="#F38020" stroke-width="2.5" stroke-linecap="round" fill="none"/>
            <path d="M16 3C16 3 16 10 12 12C8 14 8 21 8 21" stroke="#F38020" stroke-width="2.5" stroke-linecap="round" fill="none"/>
            <line x1="10" y1="6" x2="14" y2="6" stroke="#FFFFFF" stroke-width="1.5" stroke-linecap="round" />
            <line x1="10.5" y1="9" x2="13.5" y2="9" stroke="#FFFFFF" stroke-width="1.5" stroke-linecap="round" />
            <line x1="11" y1="12" x2="13" y2="12" stroke="#F38020" stroke-width="3" stroke-linecap="round" />
            <line x1="10.5" y1="15" x2="13.5" y2="15" stroke="#FFFFFF" stroke-width="1.5" stroke-linecap="round" />
            <line x1="10" y1="18" x2="14" y2="18" stroke="#FFFFFF" stroke-width="1.5" stroke-linecap="round" />
          </g>

          <!-- Texte StudyCloud -->
          <text x="62" y="37" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" font-weight="900" font-size="26" letter-spacing="-0.5">
            <tspan fill="#f97316">Study</tspan><tspan fill="#38bdf8">Cloud</tspan>
          </text>
          
          <!-- Texte DKD TECHNOLOGIES -->
          <text x="64" y="55" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" font-weight="800" font-size="11" fill="#fbbf24" letter-spacing="1">
            DKD TECHNOLOGIES
          </text>
        </svg>
      `;

      const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const img = new Image();
      
      img.onload = () => {
        // Rendu en résolution 2x pour un filigrane parfaitement net et sans flou
        const scaleFactor = 2;
        const canvas = document.createElement('canvas');
        canvas.width = svgWidth * scaleFactor;
        canvas.height = svgHeight * scaleFactor;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.scale(scaleFactor, scaleFactor);
          ctx.drawImage(img, 0, 0, svgWidth, svgHeight);
          canvas.toBlob((blobPng) => {
            if (blobPng) {
              blobPng.arrayBuffer().then(buffer => {
                URL.revokeObjectURL(url);
                resolve(buffer);
              }).catch(reject);
            } else {
              reject(new Error("Failed to create blob from canvas"));
            }
          }, 'image/png');
        } else {
          reject(new Error("Failed to get canvas context"));
        }
      };
      
      img.onerror = (e) => {
        URL.revokeObjectURL(url);
        reject(e);
      };
      
      img.src = url;
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Modifie le fichier PDF pour incruster le badge officiel StudyCloud avec une taille réduite et élégante.
 * Évite formellement tout double marquage si le fichier comporte déjà la signature StudyCloud.
 */
export async function watermarkPDF(file: File): Promise<File> {
  try {
    // 0. Protection mémoire immédiate pour la session en cours
    if ((file as any).__sc_watermarked) {
      console.log('[watermarkPDF] Fichier déjà marqué en mémoire dans cette session.');
      return file;
    }

    const arrayBuffer = await file.arrayBuffer();
    
    // 1. Détection par scan binaire des en-têtes et métadonnées brutes du document
    const uint8 = new Uint8Array(arrayBuffer);
    const headChunk = new TextDecoder('latin1').decode(uint8.subarray(0, Math.min(uint8.length, 16000)));
    const tailChunk = new TextDecoder('latin1').decode(uint8.subarray(Math.max(0, uint8.length - 16000)));
    const rawBinary = headChunk + ' ' + tailChunk;

    if (
      rawBinary.includes('StudyCloud_Watermarked') ||
      rawBinary.includes('DKD_Technologies_Watermark') ||
      rawBinary.includes('StudyCloud (DKD Technologies)')
    ) {
      console.log('[watermarkPDF] Document PDF déjà marqué par StudyCloud (signature brute détectée). Marquage omis.');
      (file as any).__sc_watermarked = true;
      return file;
    }

    const pdfDoc = await PDFDocument.load(arrayBuffer);

    // 2. Détection par métadonnées du document PDF
    const keywords = pdfDoc.getKeywords() || [];
    const producer = pdfDoc.getProducer() || '';
    const subject = pdfDoc.getSubject() || '';
    const creator = pdfDoc.getCreator() || '';
    const title = pdfDoc.getTitle() || '';

    const isAlreadyMarked =
      keywords.includes('StudyCloud_Watermarked') ||
      keywords.includes('DKD_Technologies_Watermark') ||
      keywords.some((k) => k.toLowerCase().includes('studycloud')) ||
      producer.includes('StudyCloud') ||
      subject === 'StudyCloud_Watermarked' ||
      creator.includes('StudyCloud') ||
      title.includes('StudyCloud_Watermarked');

    if (isAlreadyMarked) {
      console.log('[watermarkPDF] Document PDF déjà filigrané par StudyCloud. Marquage omis pour éviter les doublons.');
      (file as any).__sc_watermarked = true;
      return file;
    }
    
    // 3. Générer le logo en PNG haute résolution
    const logoPngBuffer = await generateLogoPngBuffer();
    const logoImage = await pdfDoc.embedPng(logoPngBuffer);
    
    // TAILLE RÉDUITE ET DISCRÈTE (au lieu des 176x48 imposants de la version précédente)
    const targetWidth = 108; // Largeur compacte (~18% de la largeur A4)
    const targetHeight = (targetWidth * 70) / 260; // ~29 pt
    const marginToAdd = 35; // Marge discrète en haut (35 pt au lieu de 60 pt)

    const pages = pdfDoc.getPages();

    for (const page of pages) {
      const { width, height } = page.getSize();
      
      // Augmenter légèrement la hauteur en haut pour ne pas empiéter sur le contenu du document
      page.setSize(width, height + marginToAdd);
      
      // Positionnement discret en haut à droite
      const xPos = width - targetWidth - 14; // 14 pt du bord droit
      const yPos = height + (marginToAdd - targetHeight) / 2; // Parfaitement centré dans la bande
      
      page.drawImage(logoImage, {
        x: xPos,
        y: yPos,
        width: targetWidth,
        height: targetHeight,
      });
    }

    // 4. Inscrire la signature officielle indélébile dans les métadonnées pour bloquer tout futur double marquage
    pdfDoc.setKeywords([...keywords, 'StudyCloud_Watermarked', 'DKD_Technologies_Watermark']);
    pdfDoc.setProducer('StudyCloud (DKD Technologies)');
    pdfDoc.setSubject('StudyCloud_Watermarked');
    pdfDoc.setCreator('StudyCloud by DKD Technologies');

    // Sauvegarder le PDF modifié
    const modifiedPdfBytes = await pdfDoc.save();
    
    // Retourner le nouveau fichier marqué
    const resultFile = new File([modifiedPdfBytes], file.name, { type: file.type });
    (resultFile as any).__sc_watermarked = true;
    return resultFile;
  } catch (error) {
    console.error("Erreur lors de l'incrustation du filigrane:", error);
    return file;
  }
}
