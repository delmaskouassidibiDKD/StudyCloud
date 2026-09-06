export interface SharedFile {
  id: string;
  name: string;
  size: number;
  type: string;
  url?: string; // object URL or data URL
}

export interface SharedFolder {
  id: string;
  title: string;
  description: string;
  category: string;
  author: string;
  school?: string;
  createdAt: string;
  files: SharedFile[];
  totalSize: number;
  downloadsCount: number;
  isPasswordProtected: boolean;
  password?: string;
  expiresAt?: string; // ISO date string or 'never'
  viewsCount: number;
}

export type NavigationTab = 'folders' | 'upload' | 'shared' | 'library' | 'settings' | 'publish-file';
