import React, { useState, useEffect, useRef } from 'react';
import { Folder, Upload, Share2, BarChart3, Settings, BookOpen, LogOut, LayoutDashboard, UserCircle } from 'lucide-react';
import { DnaLogo } from './DnaLogo';
import { NavigationTab } from '../types';

interface SidebarProps {
  currentTab: NavigationTab;
  setTab: (tab: NavigationTab) => void;
  foldersCount: number;
  onOpenUpload: () => void;
  publishStatus?: { isPublishing: boolean; hasFiles: boolean; progress?: string } | null;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentTab, setTab, foldersCount, onOpenUpload, publishStatus }) => {
  const navItems: Array<{ id: NavigationTab; label: string; icon: any; highlight?: boolean; badge?: string | number }> = [
    { id: 'folders' as NavigationTab, label: 'Tableau de bord', icon: LayoutDashboard },
    { id: 'upload' as NavigationTab, label: 'Importer', icon: Upload, highlight: true },
    { id: 'shared' as NavigationTab, label: 'Liens Actifs', icon: Share2 },
    { id: 'library' as NavigationTab, label: 'Bibliothèque', icon: BookOpen },
    { id: 'settings' as NavigationTab, label: 'Profil', icon: UserCircle },
  ];

  return (
    <>
      {/* Desktop Sidebar - Couleur pure #1F4761 en Jour / #070a13 en Sombre */}
      <aside 
        className="hidden md:flex flex-col w-64 h-screen fixed top-0 left-0 overflow-y-auto px-3.5 py-6 pb-24 shrink-0 select-none z-40 border-r-2 border-[#153447] dark:border-[#1e293b] shadow-[2px_0px_5px_-2px_rgba(0,0,0,0.1)] transition-colors duration-300 sidebar-desktop"
      >
        {/* Brand Header - Logo et Nom de l'application bien visibles */}
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

        {/* Navigation links - Noms sur une seule ligne parfaitement lisibles */}
        <nav className="space-y-1.5 flex-1">
          <p className="text-[12px] font-black uppercase tracking-widest px-2 mb-2 sidebar-nav-heading">
            Navigation
          </p>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  setTab(item.id);
                }}
                className={`w-full flex items-center justify-between px-3 py-3 rounded-xl transition-all border-2 sidebar-nav-btn ${
                  isActive
                    ? 'active shadow-[3px_3px_0px_0px_rgba(0,0,0,0.2)]'
                    : 'border-transparent hover:bg-white/10 hover:border-white/20 dark:hover:bg-white/10 dark:hover:border-slate-700'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <Icon 
                    className={`w-5 h-5 shrink-0 stroke-[2.2] ${
                      isActive 
                        ? 'sidebar-nav-icon-active' 
                        : 'sidebar-nav-icon'
                    }`} 
                  />
                  <span className="font-black text-[15.5px] tracking-tight whitespace-nowrap sidebar-nav-text">
                    {item.label}
                  </span>
                </div>
                {item.badge !== undefined && (
                  <span className="text-xs px-2 py-0.5 bg-white border-2 border-black rounded-md font-mono font-black shadow-[1px_1px_0px_0px_#000000] text-black dark:bg-[#0f172a] dark:border-slate-600 dark:text-white dark:shadow-none">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </aside>

      {/* Bottom Navigation Bar - Solide Opaque Dark #070a13 */}
      <div 
        className="mobile-fixed-bottom bottom-nav bg-[#F5F1E9] dark:bg-[#070a13] border-t-3 border-stone-800 dark:border-[#1e293b] px-3 py-0 z-[99999] flex items-center justify-around shadow-[0px_-4px_10px_rgba(0,0,0,0.05)] md:!hidden transition-colors duration-300"
      >
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => {
                setTab(item.id);
              }}
              className={`flex flex-col items-center justify-center p-1 rounded-lg transition-all ${
                isActive ? 'text-orange-600 dark:text-orange-400 font-bold scale-110' : 'text-stone-600 dark:text-slate-400 hover:text-stone-900 dark:hover:text-white'
              }`}
            >
              <Icon className="w-5 h-5 md:w-6 md:h-6 mb-0" />
              <span className="text-[10px] md:text-xs leading-tight">{item.label.split(' ')[0]}</span>
            </button>
          );
        })}
      </div>
    </>
  );
};
