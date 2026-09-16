export interface SharedFile {
  id: string;
  name: string;
  size: number;
  type: string;
  url?: string; // object URL, data URL ou URL Cloudflare R2
  r2Key?: string;
  fileId?: string;
}

export interface SharedFolder {
  id: string;
  title: string;
  description: string;
  category: string;
  author: string;
  school?: string;
  country?: string;
  createdAt: string;
  files: SharedFile[];
  totalSize: number;
  downloadsCount: number;
  isPasswordProtected: boolean;
  password?: string;
  expiresAt?: string; // ISO date string or 'never'
  viewsCount: number;
  shareCode?: string;
  shareUrl?: string;
  qrCodeData?: string;
  isPublic?: boolean;
  allowDownload?: boolean;
}

export interface PublishedDocument {
  id: string;
  userId?: string;
  title: string;
  description?: string;
  school?: string;
  filiere?: string;
  matiereName?: string;
  level?: string;
  category?: string;
  authorName?: string;
  country?: string;
  infoMode?: 'all' | 'individual' | 'none';
  fileName: string;
  fileSize?: number;
  fileType?: string;
  r2Key?: string;
  fileUrl?: string;
  isPublic?: boolean;
  tagsJson?: string;
  downloadsCount?: number;
  viewsCount?: number;
  createdAt?: string;
  updatedAt?: string;
}

export type NavigationTab = 'folders' | 'upload' | 'shared' | 'library' | 'settings' | 'publish-file';

