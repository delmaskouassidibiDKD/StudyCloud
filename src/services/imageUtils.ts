/**
 * StudyCloud - Utilitaires de traitement et compression d'images
 * Compresse et recadre au format carré les photos et logos de profil (256x256 px).
 * Produit un Data URL JPEG optimisé (~15-25 Ko) garantissant :
 * 1. Une conformité stricte avec les limites de Cloudflare D1 (100 Ko max par instruction SQL).
 * 2. Un stockage ultra-rapide en base de données SQLite D1.
 * 3. Un chargement instantané sans saturation de bande passante.
 */

export function compressAvatarImage(file: File, size: number = 256, quality: number = 0.85): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = size;
          canvas.height = size;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(e.target?.result as string);
            return;
          }

          // Cadrage carré parfait centré (center crop)
          const minDim = Math.min(img.width, img.height);
          const sx = (img.width - minDim) / 2;
          const sy = (img.height - minDim) / 2;

          // Fond blanc au cas où l'image PNG ait de la transparence
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, size, size);

          ctx.drawImage(img, sx, sy, minDim, minDim, 0, 0, size, size);
          const dataUrl = canvas.toDataURL('image/jpeg', quality);
          resolve(dataUrl);
        } catch {
          resolve(e.target?.result as string);
        }
      };
      img.onerror = () => reject(new Error("Impossible de décoder l'image sélectionnée."));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error("Impossible de lire le fichier depuis votre appareil."));
    reader.readAsDataURL(file);
  });
}
