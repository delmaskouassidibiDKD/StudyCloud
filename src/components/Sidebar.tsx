import React, { useState, useEffect, useRef } from 'react';
import { Folder, Upload, Share2, BarChart3, Settings, BookOpen, Sparkles, LogOut, LayoutDashboard, UserCircle } from 'lucide-react';
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
      {/* Desktop Sidebar - Couleur pure #FEC3B5 */}
      <aside 
        className="hidden md:flex flex-col w-64 h-screen fixed top-0 left-0 overflow-y-auto p-6 pb-24 shrink-0 select-none z-40 border-r-2 border-black shadow-[2px_0px_5px_-2px_rgba(0,0,0,0.1)] transition-colors duration-300"
        style={{ backgroundColor: '#FEC3B5' }}
      >
        {/* Brand Header - Logo et Nom de l'application bien visibles */}
        <div className="flex items-center gap-3 mb-8">
          <div className="w-12 h-12 bg-black rounded-2xl flex items-center justify-center border-2 border-black shadow-[3px_3px_0px_0px_#000000] shrink-0">
            <DnaLogo className="w-8 h-8" glow={true} />
          </div>
          <div className="notranslate flex flex-col justify-center">
            <h1 className="font-black tracking-tight text-[26px] leading-tight flex items-center select-none">
              <span className="font-black" style={{ color: '#ea580c' }}>Study</span>
              <span className="font-black" style={{ color: '#1d4ed8' }}>Cloud</span>
            </h1>
            <p className="text-[11px] font-black uppercase tracking-widest mt-0.5" style={{ color: '#000000', letterSpacing: '0.14em' }}>
              DKD TECHNOLOGIES
            </p>
          </div>
        </div>

        {/* Navigation links - Noms grands et en noir bien pur (#000000) */}
        <nav className="space-y-2 flex-1">
          <p className="text-[12px] font-black uppercase tracking-widest px-3 mb-2" style={{ color: '#000000' }}>Navigation</p>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  setTab(item.id);
                }}
                className={`w-full flex items-center justify-between px-4 py-3.5 rounded-xl transition-all border-2 ${
                  isActive
                    ? 'bg-white border-black shadow-[3px_3px_0px_0px_#000000]'
                    : 'border-transparent hover:bg-black/10 hover:border-black'
                }`}
                style={{ color: '#000000' }}
              >
                <div className="flex items-center gap-3.5">
                  <Icon 
                    className="w-6 h-6 stroke-[2.5]" 
                    style={{ color: '#000000' }} 
                  />
                  <span className="font-black text-[18px] tracking-tight" style={{ color: '#000000' }}>
                    {item.label}
                  </span>
                </div>
                {item.badge !== undefined && (
                  <span className="text-xs px-2 py-0.5 bg-white border-2 border-black rounded-md font-mono font-black shadow-[1px_1px_0px_0px_#000000]" style={{ color: '#000000' }}>
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Student Promo Card */}
        <div 
          className="border-2 border-black rounded-2xl p-4 mt-auto shadow-[3px_3px_0px_0px_#000000] transition-all"
          style={{ backgroundColor: '#FDB4A4' }}
        >
          <div className="flex items-center gap-2 mb-1 font-black text-xs" style={{ color: '#000000' }}>
            <Sparkles className="w-4 h-4 text-orange-600" />
            <span className="font-black" style={{ color: '#000000' }}>Version Étudiante 100% Gratuite</span>
          </div>
          <p className="text-xs leading-relaxed font-bold" style={{ color: '#000000' }}>
            Partagez vos dossiers de cours et TPs par lien direct en un clic, sans inscription pour vos camarades.
          </p>
        </div>
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
