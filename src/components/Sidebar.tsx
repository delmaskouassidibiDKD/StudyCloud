import React, { useState, useEffect, useRef } from 'react';
import { Folder, Upload, Share2, BarChart3, Settings, BookOpen, Sparkles, LogOut, LayoutDashboard } from 'lucide-react';
import { DnaLogo } from './DnaLogo';
import { NavigationTab } from '../types';

interface SidebarProps {
  currentTab: NavigationTab;
  setTab: (tab: NavigationTab) => void;
  foldersCount: number;
  onOpenUpload: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentTab, setTab, foldersCount, onOpenUpload }) => {
  const navItems: Array<{ id: NavigationTab; label: string; icon: any; highlight?: boolean; badge?: string | number }> = [
    { id: 'folders' as NavigationTab, label: 'Tableau de bord', icon: LayoutDashboard },
    { id: 'upload' as NavigationTab, label: 'Importer', icon: Upload, highlight: true },
    { id: 'shared' as NavigationTab, label: 'Liens Actifs', icon: Share2 },
    { id: 'library' as NavigationTab, label: 'Bibliothèque', icon: BookOpen },
    { id: 'settings' as NavigationTab, label: 'Paramètres', icon: Settings },
  ];

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-64 h-screen fixed top-0 left-0 overflow-y-auto bg-[#F5F1E9] p-6 pb-24 shrink-0 select-none z-40 border-r-2 border-stone-800 shadow-[2px_0px_5px_-2px_rgba(0,0,0,0.1)]">
        {/* Brand Header */}
        <div className="flex items-center gap-2 mb-8">
          <DnaLogo className="w-8 h-8 drop-shadow-[0_0_2px_rgba(0,0,0,1)]" glow={true} />
          <div className="notranslate">
            <h1 className="font-extrabold tracking-tight text-2xl leading-tight">
              <span className="text-orange-600">Study</span>
              <span className="text-blue-600">Cloud</span>
            </h1>
            <p className="text-[9px] text-orange-400/90 font-bold uppercase tracking-widest mt-0.5">DKD Technologies</p>
          </div>
        </div>



        {/* Navigation links */}
        <nav className="space-y-2 flex-1">
          <p className="text-[11px] font-bold uppercase tracking-wider text-stone-500 px-3 mb-2">Navigation</p>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  setTab(item.id);
                }}
                className={`w-full flex items-center justify-between px-4 py-3.5 rounded-xl font-bold text-base transition-all border-2 ${
                  isActive
                    ? 'bg-orange-100 border-stone-800 text-stone-900 shadow-[3px_3px_0px_0px_#1c1917]'
                    : 'border-transparent text-stone-600 hover:bg-[#EBE5DA] hover:border-stone-800 hover:text-stone-900'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`w-5 h-5 ${isActive ? 'text-orange-600' : 'text-stone-500'}`} />
                  <span>{item.label}</span>
                </div>
                {item.badge !== undefined && (
                  <span className="text-xs px-2 py-0.5 bg-stone-200 border border-stone-800 rounded-md font-mono text-stone-800">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Student Promo Card */}
        <div className="bg-[#EBE5DA] border-2 border-stone-800 rounded-xl p-4 mt-auto shadow-[3px_3px_0px_0px_#1c1917]">
          <div className="flex items-center gap-2 text-orange-600 mb-1 font-bold text-xs">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Version Étudiante 100% Gratuite</span>
          </div>
          <p className="text-xs text-stone-600 leading-relaxed">
            Partagez vos dossiers de cours et TPs par lien direct en un clic, sans inscription pour vos camarades.
          </p>
        </div>
      </aside>

      {/* Bottom Navigation Bar */}
      <div 
        className="mobile-fixed-bottom bottom-nav bg-[#F5F1E9] border-t-3 border-stone-800 px-3 py-0 z-[99999] flex items-center justify-around shadow-[0px_-4px_10px_rgba(0,0,0,0.05)] md:!hidden"
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
                isActive ? 'text-orange-600 font-bold scale-110' : 'text-stone-600 hover:text-stone-900'
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
