import React from 'react';
import { 
  Upload, 
  Share2, 
  BookOpen, 
  LayoutDashboard, 
  UserCircle, 
  Sparkles, 
  HardDrive 
} from 'lucide-react';
import { DnaLogo } from './DnaLogo';
import { NavigationTab } from '../types';

interface SidebarProps {
  currentTab: NavigationTab;
  setTab: (tab: NavigationTab) => void;
  foldersCount: number;
  onOpenUpload: () => void;
  publishStatus?: { isPublishing: boolean; hasFiles: boolean; progress?: string } | null;
}

interface NavItemConfig {
  id: NavigationTab;
  label: string;
  icon: any;
  badge?: string | number;
  highlight?: boolean;
  specialGlow?: boolean;
  // Halo lumineux doux et paisible derrière l'icône (inspiré des images 2, 3 et 4)
  aura: string;
  activeBg: string;
  activeBorder: string;
  activeShadow: string;
  accentColor: string;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentTab, setTab, foldersCount, onOpenUpload, publishStatus }) => {
  const desktopNavItems: NavItemConfig[] = [
    { 
      id: 'folders' as NavigationTab, 
      label: 'Tableau de bord', 
      icon: LayoutDashboard,
      // Bleu saphir céleste doux et apaisant (Image 4)
      aura: 'radial-gradient(circle, rgba(56, 189, 248, 0.75) 0%, rgba(37, 99, 235, 0.35) 45%, transparent 72%)',
      activeBg: 'linear-gradient(90deg, rgba(56, 189, 248, 0.16) 0%, rgba(37, 99, 235, 0.08) 100%)',
      activeBorder: 'rgba(56, 189, 248, 0.45)',
      activeShadow: '0 0 24px -2px rgba(56, 189, 248, 0.35), inset 0 1px 1px rgba(255, 255, 255, 0.25)',
      accentColor: '#38bdf8'
    },
    { 
      id: 'upload' as NavigationTab, 
      label: 'Partager', 
      icon: Upload, 
      highlight: true,
      // Ambre doré chaleureux et paisible
      aura: 'radial-gradient(circle, rgba(251, 146, 60, 0.75) 0%, rgba(234, 88, 12, 0.35) 45%, transparent 72%)',
      activeBg: 'linear-gradient(90deg, rgba(251, 146, 60, 0.16) 0%, rgba(234, 88, 12, 0.08) 100%)',
      activeBorder: 'rgba(251, 146, 60, 0.45)',
      activeShadow: '0 0 24px -2px rgba(251, 146, 60, 0.35), inset 0 1px 1px rgba(255, 255, 255, 0.25)',
      accentColor: '#fb923c'
    },
    { 
      id: 'shared' as NavigationTab, 
      label: 'Liens Actifs', 
      icon: Share2,
      // Violet doux / lilas apaisant (Image 2)
      aura: 'radial-gradient(circle, rgba(168, 85, 247, 0.75) 0%, rgba(126, 34, 206, 0.35) 45%, transparent 72%)',
      activeBg: 'linear-gradient(90deg, rgba(168, 85, 247, 0.16) 0%, rgba(126, 34, 206, 0.08) 100%)',
      activeBorder: 'rgba(168, 85, 247, 0.45)',
      activeShadow: '0 0 24px -2px rgba(168, 85, 247, 0.35), inset 0 1px 1px rgba(255, 255, 255, 0.25)',
      accentColor: '#a855f7'
    },
    { 
      id: 'library' as NavigationTab, 
      label: 'Bibliothèque', 
      icon: BookOpen,
      // Vert émeraude / jade serein
      aura: 'radial-gradient(circle, rgba(52, 211, 153, 0.75) 0%, rgba(16, 185, 129, 0.35) 45%, transparent 72%)',
      activeBg: 'linear-gradient(90deg, rgba(52, 211, 153, 0.16) 0%, rgba(16, 185, 129, 0.08) 100%)',
      activeBorder: 'rgba(52, 211, 153, 0.45)',
      activeShadow: '0 0 24px -2px rgba(52, 211, 153, 0.35), inset 0 1px 1px rgba(255, 255, 255, 0.25)',
      accentColor: '#34d399'
    },
    { 
      id: 'settings' as NavigationTab, 
      label: 'Profil', 
      icon: UserCircle,
      // Indigo royal doux et élégant
      aura: 'radial-gradient(circle, rgba(129, 140, 248, 0.75) 0%, rgba(99, 102, 241, 0.35) 45%, transparent 72%)',
      activeBg: 'linear-gradient(90deg, rgba(129, 140, 248, 0.16) 0%, rgba(99, 102, 241, 0.08) 100%)',
      activeBorder: 'rgba(129, 140, 248, 0.45)',
      activeShadow: '0 0 24px -2px rgba(129, 140, 248, 0.35), inset 0 1px 1px rgba(255, 255, 255, 0.25)',
      accentColor: '#818cf8'
    },
    { 
      id: 'storage-menu' as NavigationTab, 
      label: 'Mon stockage', 
      icon: HardDrive, 
      specialGlow: true,
      // Cyan / bleu lagon cristallin
      aura: 'radial-gradient(circle, rgba(34, 211, 238, 0.75) 0%, rgba(6, 182, 212, 0.35) 45%, transparent 72%)',
      activeBg: 'linear-gradient(90deg, rgba(34, 211, 238, 0.16) 0%, rgba(6, 182, 212, 0.08) 100%)',
      activeBorder: 'rgba(34, 211, 238, 0.45)',
      activeShadow: '0 0 24px -2px rgba(34, 211, 238, 0.35), inset 0 1px 1px rgba(255, 255, 255, 0.25)',
      accentColor: '#22d3ee'
    },
    { 
      id: 'ai-subscriptions' as NavigationTab, 
      label: 'Crédits IA', 
      icon: Sparkles, 
      specialGlow: true,
      // Aurore céleste rose-magenta doux (Image 2)
      aura: 'radial-gradient(circle, rgba(236, 72, 153, 0.75) 0%, rgba(147, 51, 234, 0.35) 45%, transparent 72%)',
      activeBg: 'linear-gradient(90deg, rgba(236, 72, 153, 0.16) 0%, rgba(147, 51, 234, 0.08) 100%)',
      activeBorder: 'rgba(236, 72, 153, 0.45)',
      activeShadow: '0 0 24px -2px rgba(236, 72, 153, 0.35), inset 0 1px 1px rgba(255, 255, 255, 0.25)',
      accentColor: '#ec4899'
    },
  ];

  const mobileNavItems: NavItemConfig[] = [
    { 
      id: 'folders' as NavigationTab, 
      label: 'Accueil', 
      icon: LayoutDashboard,
      aura: 'radial-gradient(circle, rgba(56, 189, 248, 0.8) 0%, rgba(37, 99, 235, 0.4) 45%, transparent 72%)',
      activeBg: 'rgba(56, 189, 248, 0.15)',
      activeBorder: 'rgba(56, 189, 248, 0.4)',
      activeShadow: '0 0 15px rgba(56, 189, 248, 0.3)',
      accentColor: '#38bdf8'
    },
    { 
      id: 'upload' as NavigationTab, 
      label: 'Partager', 
      icon: Upload,
      aura: 'radial-gradient(circle, rgba(251, 146, 60, 0.8) 0%, rgba(234, 88, 12, 0.4) 45%, transparent 72%)',
      activeBg: 'rgba(251, 146, 60, 0.15)',
      activeBorder: 'rgba(251, 146, 60, 0.4)',
      activeShadow: '0 0 15px rgba(251, 146, 60, 0.3)',
      accentColor: '#fb923c'
    },
    { 
      id: 'shared' as NavigationTab, 
      label: 'Liens', 
      icon: Share2,
      aura: 'radial-gradient(circle, rgba(168, 85, 247, 0.8) 0%, rgba(126, 34, 206, 0.4) 45%, transparent 72%)',
      activeBg: 'rgba(168, 85, 247, 0.15)',
      activeBorder: 'rgba(168, 85, 247, 0.4)',
      activeShadow: '0 0 15px rgba(168, 85, 247, 0.3)',
      accentColor: '#a855f7'
    },
    { 
      id: 'library' as NavigationTab, 
      label: 'Bibliothèque', 
      icon: BookOpen,
      aura: 'radial-gradient(circle, rgba(52, 211, 153, 0.8) 0%, rgba(16, 185, 129, 0.4) 45%, transparent 72%)',
      activeBg: 'rgba(52, 211, 153, 0.15)',
      activeBorder: 'rgba(52, 211, 153, 0.4)',
      activeShadow: '0 0 15px rgba(52, 211, 153, 0.3)',
      accentColor: '#34d399'
    },
    { 
      id: 'settings' as NavigationTab, 
      label: 'Profil', 
      icon: UserCircle,
      aura: 'radial-gradient(circle, rgba(129, 140, 248, 0.8) 0%, rgba(99, 102, 241, 0.4) 45%, transparent 72%)',
      activeBg: 'rgba(129, 140, 248, 0.15)',
      activeBorder: 'rgba(129, 140, 248, 0.4)',
      activeShadow: '0 0 15px rgba(129, 140, 248, 0.3)',
      accentColor: '#818cf8'
    },
  ];

  return (
    <>
      {/* Desktop Sidebar - Couleur pure #1F4761 en Jour / #070a13 en Sombre */}
      <aside 
        className="hidden md:flex flex-col w-64 h-screen fixed top-0 left-0 overflow-y-auto px-3.5 py-6 pb-24 shrink-0 select-none z-40 border-r-2 border-[#153447] dark:border-[#1e293b] shadow-[2px_0px_5px_-2px_rgba(0,0,0,0.1)] transition-colors duration-300 sidebar-desktop"
      >
        {/* Brand Header - Logo et Nom de l'application */}
        <div className="flex items-center gap-2.5 px-1.5 mb-7">
          <DnaLogo className="w-9 h-9 shrink-0 drop-shadow-[0_0_2px_rgba(0,0,0,0.9)]" glow={true} />
          <div className="notranslate flex flex-col justify-center">
            <h1 className="font-black tracking-tight text-[26px] leading-tight flex items-center select-none">
              <span className="font-black text-orange-500">Study</span>
              <span className="font-black text-sky-400 dark:text-blue-400">Cloud</span>
            </h1>
            <p className="text-[11px] font-black uppercase tracking-widest mt-0.5 sidebar-brand-tagline" style={{ letterSpacing: '0.14em', color: '#f59e0b' }}>
              DKD TECHNOLOGIES
            </p>
          </div>
        </div>

        {/* Navigation links avec halo lumineux doux et paisible sur sélection */}
        <nav className="space-y-2 flex-1">
          <p className="text-[12px] font-black uppercase tracking-widest px-2 mb-2 sidebar-nav-heading">
            Navigation
          </p>
          {desktopNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;

            const buttonInner = (
              <button
                type="button"
                onClick={() => setTab(item.id)}
                className={`group w-full flex items-center justify-between px-3.5 py-3 rounded-2xl transition-all duration-300 relative overflow-hidden cursor-pointer select-none border sidebar-nav-btn ${
                  isActive 
                    ? 'active backdrop-blur-md' 
                    : 'border-transparent hover:bg-white/[0.06] hover:border-white/10'
                }`}
                style={{
                  background: isActive ? item.activeBg : undefined,
                  borderColor: isActive ? item.activeBorder : 'transparent',
                  boxShadow: isActive ? item.activeShadow : undefined,
                }}
              >
                {/* Lueur d'ambiance d'arrière-plan du bouton entier quand actif */}
                {isActive && (
                  <div 
                    className="absolute inset-0 pointer-events-none opacity-40 blur-xl"
                    style={{ background: item.aura }}
                  />
                )}

                <div className="flex items-center gap-3 min-w-0 relative z-10">
                  {/* Conteneur d'icône avec le halo doux et paisible (Images 2, 3, 4) */}
                  <div className="relative flex items-center justify-center w-8 h-8 shrink-0">
                    {isActive && (
                      <div 
                        className="absolute inset-0 w-11 h-11 -left-1.5 -top-1.5 rounded-full pointer-events-none filter blur-sm transition-all duration-500 animate-aura-pulse"
                        style={{
                          background: item.aura,
                        }}
                      />
                    )}
                    <Icon 
                      className={`relative z-10 w-5 h-5 shrink-0 stroke-[2.3] transition-all duration-300 ${
                        isActive 
                          ? 'text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.9)] scale-105' 
                          : 'text-slate-300 group-hover:text-white group-hover:scale-105'
                      }`} 
                    />
                  </div>

                  <span className={`font-black text-[15.5px] tracking-tight whitespace-nowrap transition-colors duration-200 sidebar-nav-text ${
                    isActive 
                      ? 'text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.4)]' 
                      : 'text-slate-200 group-hover:text-white'
                  }`}>
                    {item.label}
                  </span>
                </div>

                {item.badge !== undefined && (
                  <span className="relative z-10 text-xs px-2 py-0.5 bg-white/20 backdrop-blur-md border border-white/30 rounded-md font-mono font-black text-white shadow-sm">
                    {item.badge}
                  </span>
                )}
              </button>
            );

            if (item.specialGlow) {
              return (
                <div key={item.id} className="rotating-orange-blue-border my-1.5 rounded-2xl p-[1.5px]">
                  {buttonInner}
                </div>
              );
            }

            return (
              <div key={item.id} className="relative">
                {buttonInner}
              </div>
            );
          })}
        </nav>
      </aside>

      {/* Bottom Navigation Bar Mobile avec halo lumineux doux sur l'icône active */}
      <div 
        className="mobile-fixed-bottom bottom-nav bg-[#070a13]/95 backdrop-blur-xl border-t border-white/10 px-2 py-1 z-[99999] flex items-center justify-around shadow-[0px_-4px_20px_rgba(0,0,0,0.5)] md:!hidden transition-colors duration-300"
      >
        {mobileNavItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => {
                setTab(item.id);
              }}
              className="relative flex flex-col items-center justify-center py-1 px-3 rounded-xl transition-all cursor-pointer"
            >
              <div className="relative flex items-center justify-center w-7 h-7">
                {isActive && (
                  <div 
                    className="absolute inset-0 w-9 h-9 -left-1 -top-1 rounded-full pointer-events-none filter blur-sm transition-all duration-300 animate-aura-pulse"
                    style={{
                      background: item.aura,
                    }}
                  />
                )}
                <Icon className={`relative z-10 w-5 h-5 transition-transform duration-300 ${
                  isActive ? 'text-white scale-110 drop-shadow-[0_0_6px_rgba(255,255,255,0.9)]' : 'text-slate-400 hover:text-white'
                }`} />
              </div>
              <span className={`text-[10px] font-bold mt-0.5 leading-tight transition-colors ${
                isActive ? 'text-white drop-shadow-[0_0_4px_rgba(255,255,255,0.5)]' : 'text-slate-400'
              }`}>
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </>
  );
};
