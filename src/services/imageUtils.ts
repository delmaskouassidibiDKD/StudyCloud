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

/**
 * Génère un avatar élégant et déterministe à partir de l'email ou du nom de l'utilisateur.
 * Format SVG Data URL carré (128x128 px) au format officiel StudyCloud :
 * - Fonctionne 100% hors-ligne (aucun appel réseau externe)
 * - Léger (~250 octets) et directement stockable dans Cloudflare D1
 * - Couleur agréable dérivée du hash de l'email
 * - Initiales nettes et centrées
 */
export function getAvatarFromEmail(email?: string | null, name?: string | null): string {
  const cleanEmail = (email || '').trim().toLowerCase();
  const cleanName = (name || '').trim();

  let initials = 'SC';
  if (cleanName) {
    const parts = cleanName.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      initials = (parts[0][0] + parts[1][0]).toUpperCase();
    } else {
      initials = cleanName.slice(0, 2).toUpperCase();
    }
  } else if (cleanEmail) {
    const local = cleanEmail.split('@')[0].replace(/[^a-zA-Z0-9]/g, '');
    initials = local.slice(0, 2).toUpperCase() || 'SC';
  }

  // Palette de couleurs soignées et modernes (accordées avec la charte StudyCloud)
  const colors = [
    '#EA580C', // Orange StudyCloud
    '#0284C7', // Sky Blue
    '#059669', // Emerald Green
    '#7C3AED', // Violet
    '#D97706', // Amber
    '#0D9488', // Teal
    '#DC2626', // Red
    '#4F46E5', // Indigo
  ];

  let hash = 0;
  const seed = cleanEmail || cleanName || 'studycloud';
  for (let i = 0; i < seed.length; i++) {
    hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  }
  const color = colors[Math.abs(hash) % colors.length];

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128">
  <rect width="128" height="128" rx="28" fill="${color}"/>
  <text x="50%" y="54%" dominant-baseline="middle" text-anchor="middle" fill="#FFFFFF" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" font-size="${initials.length > 1 ? '48' : '58'}" font-weight="700" letter-spacing="1">${initials}</text>
</svg>`;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
