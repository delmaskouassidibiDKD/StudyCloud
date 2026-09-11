import React, { useState } from 'react';
import { BookOpen, Users, Globe, Sparkles, ArrowRight, Shield } from 'lucide-react';

interface WelcomeOverlayProps {
  onConnect: () => void;
}

const features = [
  { icon: BookOpen, label: 'Organisez vos cours & documents', color: 'text-orange-400' },
  { icon: Users, label: 'Partagez avec vos camarades', color: 'text-emerald-400' },
  { icon: Globe, label: 'Accédez aux ressources publiques', color: 'text-blue-400' },
  { icon: Sparkles, label: 'Assistant IA Delmas intégré', color: 'text-purple-400' },
];

export function WelcomeOverlay({ onConnect }: WelcomeOverlayProps) {
  const [isExiting, setIsExiting] = useState(false);

  const handleConnect = () => {
    setIsExiting(true);
    setTimeout(() => onConnect(), 300);
  };

  return (
    <div
      className={`fixed inset-0 z-[99999] flex flex-col items-center justify-center overflow-hidden transition-all duration-300 ${
        isExiting ? 'opacity-0 scale-105' : 'opacity-100 scale-100'
      }`}
      style={{
        background: 'linear-gradient(135deg, #0f0c29 0%, #1a1a3e 40%, #24243e 70%, #0f2027 100%)',
      }}
    >
      {/* Animated background orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div
          className="absolute top-[-10%] left-[-5%] w-[500px] h-[500px] rounded-full opacity-20 blur-[80px] animate-pulse"
          style={{ background: 'radial-gradient(circle, #EA580C 0%, transparent 70%)' }}
        />
        <div
          className="absolute bottom-[-10%] right-[-5%] w-[400px] h-[400px] rounded-full opacity-15 blur-[80px] animate-pulse"
          style={{ background: 'radial-gradient(circle, #7C3AED 0%, transparent 70%)', animationDelay: '1.5s' }}
        />
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full opacity-10 blur-[100px]"
          style={{ background: 'radial-gradient(circle, #0EA5E9 0%, transparent 70%)' }}
        />
      </div>

      {/* Grid pattern overlay */}
      <div
        className="absolute inset-0 opacity-5 pointer-events-none"
        style={{
          backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
          backgroundSize: '40px 40px',
        }}
      />

      {/* Main card */}
      <div className="relative z-10 flex flex-col items-center max-w-md w-full mx-4 px-8 py-10 text-center"
        style={{
          background: 'rgba(255,255,255,0.05)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: '24px',
          boxShadow: '0 32px 80px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.1)',
        }}
      >
        {/* Logo */}
        <div className="mb-6 flex flex-col items-center gap-3">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg"
            style={{ background: 'linear-gradient(135deg, #EA580C, #F97316)', boxShadow: '0 8px 32px rgba(234,88,12,0.4)' }}
          >
            <BookOpen className="w-8 h-8 text-white" strokeWidth={2.5} />
          </div>
          <div>
            <h1 className="text-2xl font-black text-white tracking-tight leading-tight">
              Study<span style={{ color: '#F97316' }}>Cloud</span>
            </h1>
            <p className="text-xs text-white/50 font-medium mt-0.5">by DKD Technologies</p>
          </div>
        </div>

        {/* Headline */}
        <h2 className="text-xl font-extrabold text-white leading-snug mb-2">
          Votre plateforme d'études<br />
          <span style={{ color: '#F97316' }}>connectée & intelligente</span>
        </h2>
        <p className="text-sm text-white/60 font-medium mb-8 leading-relaxed">
          Organisez vos cours, collaborez avec vos camarades et boostez vos révisions avec l'IA.
        </p>

        {/* Features list */}
        <div className="w-full space-y-2.5 mb-8">
          {features.map(({ icon: Icon, label, color }, i) => (
            <div
              key={i}
              className="flex items-center gap-3 px-4 py-2.5 rounded-xl text-left"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.07)' }}
            >
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0`}
                style={{ background: 'rgba(255,255,255,0.08)' }}>
                <Icon className={`w-3.5 h-3.5 ${color}`} />
              </div>
              <span className="text-sm text-white/80 font-medium">{label}</span>
            </div>
          ))}
        </div>

        {/* CTA Button */}
        <button
          id="welcome-connect-btn"
          type="button"
          onClick={handleConnect}
          className="w-full py-3.5 px-6 rounded-2xl font-extrabold text-white text-sm flex items-center justify-center gap-2.5 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] cursor-pointer group"
          style={{
            background: 'linear-gradient(135deg, #EA580C 0%, #F97316 50%, #FB923C 100%)',
            boxShadow: '0 8px 32px rgba(234,88,12,0.4), 0 1px 0 rgba(255,255,255,0.2) inset',
          }}
        >
          <Shield className="w-4 h-4" />
          Se connecter pour continuer
          <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
        </button>

        {/* Footnote */}
        <p className="text-[11px] text-white/30 font-medium mt-5 leading-relaxed">
          🔒 Vos données sont sécurisées et associées à votre compte unique.
          <br />
          Connexion rapide via Google ou Email.
        </p>
      </div>

      {/* Version badge */}
      <div className="absolute bottom-4 left-0 right-0 flex justify-center pointer-events-none">
        <span className="text-[10px] text-white/20 font-medium">StudyCloud v1.0 · Cloudflare Workers · D1 · R2</span>
      </div>
    </div>
  );
}
