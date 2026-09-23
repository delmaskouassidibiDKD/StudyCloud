import { SharedFolder } from '../types';

export const INITIAL_FOLDERS: SharedFolder[] = [
  {
    id: 'folder-s3-algo',
    title: 'Algorithmique & Structures de Données - S3',
    description: 'Cours, TDs corrigés, codes sources TP et rapport de projet C++.',
    category: 'Informatique',
    author: 'Thomas Diallo',
    school: 'Université Paris-Saclay',
    createdAt: new Date(Date.now() - 2 * 86400000).toISOString(),
    files: [
      { id: 'f1', name: 'Cours_01_Pointeurs_Listes.pdf', size: 2450000, type: 'application/pdf' },
      { id: 'f2', name: 'TD2_Arbres_Binaires.docx', size: 850000, type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' },
      { id: 'f3', name: 'TP3_Code_Source_Arbres.zip', size: 450000, type: 'application/zip' },
      { id: 'f4', name: 'Schema_Arbre_Binaire_Memoire.png', size: 1800000, type: 'image/png', url: 'https://images.unsplash.com/photo-1516116216624-53e697fedbea?auto=format&fit=crop&w=800&q=80' }
    ],
    totalSize: 6950000,
    downloadsCount: 38,
    isPasswordProtected: true,
    viewsCount: 124
  },
  {
    id: 'folder-droit-const',
    title: 'Droit Constitutionnel - Semestre 1',
    description: 'Fiches de révision, tableau comparatif et notes de cours.',
    category: 'Droit',
    author: 'Sarah Kouassi',
    school: 'Université Félix Houphouët-Boigny',
    createdAt: new Date(Date.now() - 5 * 86400000).toISOString(),
    files: [
      { id: 'f5', name: 'Fiche_Revision_Institutions.pdf', size: 3100000, type: 'application/pdf' },
      { id: 'f6', name: 'Tableau_Comparatif_Constitutions.xlsx', size: 1450000, type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
      { id: 'f7', name: 'Notes_Amphi_Semestre1.txt', size: 120000, type: 'text/plain' },
      { id: 'f8', name: 'Presentation_Ve_Republique.pptx', size: 4100000, type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' }
    ],
    totalSize: 8770000,
    downloadsCount: 74,
    isPasswordProtected: true,
    password: 'droit',
    viewsCount: 215
  },
  {
    id: 'folder-medecine-anat',
    title: 'Anatomie Humaine - Appareil Locomoteur',
    description: 'Planches anatomiques PDF, synthèse myologie et archives ZIP.',
    category: 'Médecine',
    author: 'Dr. Marc N\'Guessan',
    school: 'École Polytechnique',
    createdAt: new Date(Date.now() - 10 * 86400000).toISOString(),
    files: [
      { id: 'f9', name: 'Planches_Membre_Superieur.pdf', size: 14200000, type: 'application/pdf' },
      { id: 'f10', name: 'Fiche_Synthese_Myologie.docx', size: 1250000, type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' },
      { id: 'f11', name: 'Atlas_Osteologie_3D.zip', size: 28500000, type: 'application/zip' }
    ],
    totalSize: 43950000,
    downloadsCount: 129,
    isPasswordProtected: true,
    viewsCount: 430
  }
];

export const CATEGORIES = [
  'Tous',
  'Informatique',
  'Droit',
  'Médecine',
  'Économie & Gestion',
  'Sciences & Ingénierie',
  'Langues & Littérature',
  'Autres'
];

