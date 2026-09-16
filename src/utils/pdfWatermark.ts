import { PDFDocument } from 'pdf-lib';

/**
 * Convertit un SVG en ArrayBuffer (PNG) via un Canvas HTML5 (fonctionne uniquement dans le navigateur)
 */
async function generateLogoPngBuffer(): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    try {
      // SVG du logo avec le texte
      const svgString = `
        <svg width="220" height="60" viewBox="0 0 220 60" xmlns="http://www.w3.org/2000/svg">
          <!-- Background sombre pour faire ressortir les couleurs comme sur l'image 2 -->
          <rect width="220" height="60" rx="8" fill="#1c1917" />
          
          <!-- Icône ADN -->
          <g transform="translate(10, 15) scale(1.2)">
            <path d="M8 3C8 3 8 10 12 12C16 14 16 21 16 21" stroke="#F38020" stroke-width="2.5" stroke-linecap="round" fill="none"/>
            <path d="M16 3C16 3 16 10 12 12C8 14 8 21 8 21" stroke="#F38020" stroke-width="2.5" stroke-linecap="round" fill="none"/>
            <line x1="10" y1="6" x2="14" y2="6" stroke="#FFFFFF" stroke-width="1.5" stroke-linecap="round" />
            <line x1="10.5" y1="9" x2="13.5" y2="9" stroke="#FFFFFF" stroke-width="1.5" stroke-linecap="round" />
            <line x1="11" y1="12" x2="13" y2="12" stroke="#F38020" stroke-width="3" stroke-linecap="round" />
            <line x1="10.5" y1="15" x2="13.5" y2="15" stroke="#FFFFFF" stroke-width="1.5" stroke-linecap="round" />
            <line x1="10" y1="18" x2="14" y2="18" stroke="#FFFFFF" stroke-width="1.5" stroke-linecap="round" />
          </g>

          <!-- Texte StudyCloud -->
          <text x="50" y="32" font-family="system-ui, -apple-system, sans-serif" font-weight="900" font-size="24" letter-spacing="-0.5">
            <tspan fill="#f97316">Study</tspan><tspan fill="#3b82f6">Cloud</tspan>
          </text>
          
          <!-- Texte DKD TECHNOLOGIES -->
          <text x="52" y="48" font-family="system-ui, -apple-system, sans-serif" font-weight="bold" font-size="10" fill="#fbbf24" letter-spacing="1">
            DKD TECHNOLOGIES
          </text>
        </svg>
      `;

      const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const img = new Image();
      
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = 220;
        canvas.height = 60;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0);
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
 * Modifie le fichier PDF pour allonger la page et incruster le logo StudyCloud
 */
export async function watermarkPDF(file: File): Promise<File> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const pdfDoc = await PDFDocument.load(arrayBuffer);
    
    // Générer le logo en PNG (pour conserver les couleurs exactes, la police et le style SVG)
    const logoPngBuffer = await generateLogoPngBuffer();
    const logoImage = await pdfDoc.embedPng(logoPngBuffer);
    const logoDims = logoImage.scale(0.8); // Ajuster la taille (ex: largeur ~176, hauteur ~48)

    const pages = pdfDoc.getPages();
    
    // Ajouter 60 points en haut de chaque page et dessiner le logo
    const marginToAdd = 60; 

    for (const page of pages) {
      const { width, height } = page.getSize();
      
      // En PDF, l'origine (0,0) est en bas à gauche.
      // Augmenter la hauteur crée de l'espace Vierge EN HAUT.
      // Le contenu existant reste à sa position Y d'origine par rapport au bas.
      page.setSize(width, height + marginToAdd);
      
      // Calculer la position X (en haut à droite) et Y (dans la nouvelle marge supérieure)
      const xPos = width - logoDims.width - 20; // 20 points de marge à droite
      const yPos = height + (marginToAdd - logoDims.height) / 2; // Centré verticalement dans la nouvelle marge
      
      // Dessiner le logo
      page.drawImage(logoImage, {
        x: xPos,
        y: yPos,
        width: logoDims.width,
        height: logoDims.height,
      });
    }

    // Sauvegarder le PDF modifié
    const modifiedPdfBytes = await pdfDoc.save();
    
    // Retourner un nouveau fichier (remplacement)
    return new File([modifiedPdfBytes], file.name, { type: file.type });
  } catch (error) {
    console.error("Erreur lors de l'incrustation du filigrane:", error);
    // En cas d'erreur (PDF protégé, corrompu, etc.), on retourne le fichier original pour ne pas bloquer l'upload
    return file;
  }
}
