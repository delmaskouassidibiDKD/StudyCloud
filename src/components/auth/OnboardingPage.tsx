import React, { useState } from 'react';
import { Building2, GraduationCap, Globe, User, ChevronRight, CheckCircle2, AlertCircle, BookOpen, Phone, FileText, Camera } from 'lucide-react';
import { StudyCloudAPI } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { DnaLogo } from '../DnaLogo';

const COUNTRIES = [
  "Côte d'Ivoire", 'Sénégal', 'Mali', 'Burkina Faso', 'Guinée', 'Cameroun',
  'Gabon', 'Congo', "République démocratique du Congo", 'Madagascar', 'Bénin',
  'Togo', 'Niger', 'Tchad', 'Mauritanie', 'Maroc', 'Algérie', 'Tunisie',
  'France', 'Belgique', 'Canada', 'Autre',
];

const LEVELS = [
  'Lycée / Terminale', 'BTS 1', 'BTS 2', 'Licence 1', 'Licence 2', 'Licence 3',
  'Master 1', 'Master 2', 'Doctorat', 'Formation professionnelle', 'Autre',
];

export function OnboardingPage() {
  const { user, token, updateProfile } = useAuth();

  const [step, setStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Step 1 fields
  const [name, setName] = useState(user?.name || '');
  const [country, setCountry] = useState(user?.country || "Côte d'Ivoire");
  const [phone, setPhone] = useState(user?.phone || '');
  const [avatarUrl, setAvatarUrl] = useState(user?.avatar_url || '');

  // Step 2 fields
  const [school, setSchool] = useState(user?.school || '');
  const [filiere, setFiliere] = useState(user?.filiere || '');
  const [level, setLevel] = useState(user?.level || '');
  const [bio, setBio] = useState(user?.bio || '');

  const handleStep1 = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!name.trim()) { setError('Le nom complet est requis.'); return; }
    if (!country) { setError('Le pays est requis.'); return; }
    setStep(2);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!school.trim()) { setError("Le nom de l'école est requis."); return; }
    if (!filiere.trim()) { setError('La filière est requise.'); return; }

    setIsLoading(true);
    try {
      const res: any = await StudyCloudAPI.completeOnboarding(token!, {
        name: name.trim(),
        school: school.trim(),
        filiere: filiere.trim(),
        level,
        country,
        phone: phone.trim(),
        bio: bio.trim(),
        avatarUrl: avatarUrl.trim() || undefined,
      });
      if (res.success && res.data) {
        updateProfile(res.data);
      } else {
        setError(res.error || "Erreur lors de l'enregistrement.");
      }
    } catch (err: any) {
      setError(err.message || 'Impossible de joindre le serveur.');
    } finally {
      setIsLoading(false);
    }
  };

  const inputClass = `w-full px-4 py-3 rounded-xl text-sm font-medium text-white placeholder-white/30 outline-none focus:ring-2 focus:ring-orange-500/50 transition-all`;
  const inputStyle = { background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)' };

  return (
    <div
      className="fixed inset-0 z-[99997] flex flex-col items-center justify-center overflow-auto py-8 px-4"
      style={{ background: 'linear-gradient(135deg, #0f0c29 0%, #1a1a3e 40%, #24243e 70%, #0f2027 100%)' }}
    >
      {/* Background orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[20%] w-[400px] h-[400px] rounded-full opacity-15 blur-[80px] animate-pulse"
          style={{ background: 'radial-gradient(circle, #10B981 0%, transparent 70%)' }} />
        <div className="absolute bottom-[-5%] right-[10%] w-[350px] h-[350px] rounded-full opacity-10 blur-[80px]"
          style={{ background: 'radial-gradient(circle, #EA580C 0%, transparent 70%)' }} />
      </div>

      <div
        className="relative z-10 w-full max-w-2xl md:max-w-3xl p-6 sm:p-8 md:p-10 rounded-3xl"
        style={{
          background: 'rgba(255,255,255,0.06)',
          backdropFilter: 'blur(24px)',
          border: '1px solid rgba(255,255,255,0.12)',
          boxShadow: '0 32px 80px rgba(0,0,0,0.5)',
        }}
      >
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <DnaLogo className="w-8 h-8 drop-shadow-[0_0_2px_rgba(0,0,0,1)] shrink-0" glow={true} />
          <div>
            <div className="flex items-center gap-1.5 notranslate leading-none mb-1">
              <span className="text-base font-extrabold tracking-tight">
                <span className="text-orange-500">Study</span>
                <span className="text-blue-500">Cloud</span>
              </span>
              <span className="text-[7px] text-amber-400 font-bold uppercase tracking-widest">
                DKD TECHNOLOGIES
              </span>
            </div>
            <h2 className="text-sm font-black text-white leading-tight">Complétez votre profil obligatoire</h2>
            <p className="text-[11px] text-white/40 font-medium">Étape {step} sur 2 · Informations base de données</p>
          </div>
        </div>

        {/* Progress bar */}
        <div className="w-full h-1.5 rounded-full mb-7" style={{ background: 'rgba(255,255,255,0.08)' }}>
          <div
            className="h-1.5 rounded-full transition-all duration-500"
            style={{
              width: step === 1 ? '50%' : '100%',
              background: 'linear-gradient(90deg, #EA580C, #F97316)',
              boxShadow: '0 0 10px rgba(234,88,12,0.5)',
            }}
          />
        </div>

        {/* ── STEP 1 : Identité ── */}
        {step === 1 && (
          <form onSubmit={handleStep1} className="space-y-4">
            <div>
              <p className="text-xs font-bold text-orange-400 uppercase tracking-widest mb-4">Votre identité</p>

              {/* Nom */}
              <label className="text-xs font-bold text-white/60 mb-1.5 block">Nom complet *</label>
              <div className="relative mb-3.5">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                <input
                  id="onboard-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex : Konan Alexandre"
                  required
                  className={`${inputClass} pl-10`}
                  style={inputStyle}
                />
              </div>

              {/* Pays & Téléphone en 2 colonnes */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 mb-3.5">
                <div>
                  <label className="text-xs font-bold text-white/60 mb-1.5 block">Pays *</label>
                  <div className="relative">
                    <Globe className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30 pointer-events-none z-10" />
                    <select
                      id="onboard-country"
                      value={country}
                      onChange={(e) => setCountry(e.target.value)}
                      required
                      className={`${inputClass} pl-10 cursor-pointer`}
                      style={{ ...inputStyle, WebkitAppearance: 'none' }}
                    >
                      {COUNTRIES.map((c) => (
                        <option key={c} value={c} style={{ background: '#1a1a3e', color: 'white' }}>{c}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-white/60 mb-1.5 block">Numéro de téléphone</label>
                  <div className="relative">
                    <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                    <input
                      id="onboard-phone"
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+225 07 00 00 00 00"
                      className={`${inputClass} pl-10`}
                      style={inputStyle}
                    />
                  </div>
                </div>
              </div>

              {/* Photo de profil */}
              <label className="text-xs font-bold text-white/60 mb-1.5 block">Photo de profil (URL)</label>
              <div className="relative">
                <Camera className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                <input
                  id="onboard-avatar"
                  type="url"
                  value={avatarUrl}
                  onChange={(e) => setAvatarUrl(e.target.value)}
                  placeholder="https://..."
                  className={`${inputClass} pl-10`}
                  style={inputStyle}
                />
              </div>
            </div>

            {error && (
              <div className="p-3 rounded-xl flex items-start gap-2"
                style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)' }}>
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                <p className="text-xs text-red-300 font-medium">{error}</p>
              </div>
            )}

            <button
              id="onboard-next-btn"
              type="submit"
              className="w-full py-3.5 rounded-2xl font-extrabold text-white text-sm flex items-center justify-center gap-2 transition-all hover:scale-[1.01] active:scale-[0.99] cursor-pointer mt-2"
              style={{ background: 'linear-gradient(135deg, #EA580C, #F97316)', boxShadow: '0 6px 24px rgba(234,88,12,0.4)' }}
            >
              Continuer
              <ChevronRight className="w-4 h-4" />
            </button>
          </form>
        )}

        {/* ── STEP 2 : Établissement ── */}
        {step === 2 && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <p className="text-xs font-bold text-emerald-400 uppercase tracking-widest mb-4">Votre établissement</p>

              {/* École & Filière en 2 colonnes */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 mb-3.5">
                <div>
                  <label className="text-xs font-bold text-white/60 mb-1.5 block">École / Université *</label>
                  <div className="relative">
                    <Building2 className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                    <input
                      id="onboard-school"
                      type="text"
                      value={school}
                      onChange={(e) => setSchool(e.target.value)}
                      placeholder="Ex : CME, INPHB, Univ. FHB..."
                      required
                      className={`${inputClass} pl-10`}
                      style={inputStyle}
                      autoFocus
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-white/60 mb-1.5 block">Filière / Spécialité *</label>
                  <div className="relative">
                    <GraduationCap className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                    <input
                      id="onboard-filiere"
                      type="text"
                      value={filiere}
                      onChange={(e) => setFiliere(e.target.value)}
                      placeholder="Ex : Informatique, Électrotech..."
                      required
                      className={`${inputClass} pl-10`}
                      style={inputStyle}
                    />
                  </div>
                </div>
              </div>

              {/* Niveau */}
              <label className="text-xs font-bold text-white/60 mb-1.5 block">Niveau d'études *</label>
              <div className="relative mb-3.5">
                <BookOpen className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30 pointer-events-none z-10" />
                <select
                  id="onboard-level"
                  value={level}
                  onChange={(e) => setLevel(e.target.value)}
                  required
                  className={`${inputClass} pl-10 cursor-pointer`}
                  style={{ ...inputStyle, WebkitAppearance: 'none' }}
                >
                  <option value="" style={{ background: '#1a1a3e', color: '#aaa' }}>Choisir un niveau...</option>
                  {LEVELS.map((l) => (
                    <option key={l} value={l} style={{ background: '#1a1a3e', color: 'white' }}>{l}</option>
                  ))}
                </select>
              </div>

              {/* Bio */}
              <label className="text-xs font-bold text-white/60 mb-1.5 block">Bio courte (optionnel)</label>
              <div className="relative">
                <FileText className="absolute left-3.5 top-3.5 w-4 h-4 text-white/30" />
                <textarea
                  id="onboard-bio"
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Quelques mots sur vous..."
                  rows={2}
                  className={`${inputClass} pl-10 resize-none`}
                  style={inputStyle}
                />
              </div>
            </div>

            {error && (
              <div className="p-3 rounded-xl flex items-start gap-2"
                style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)' }}>
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                <p className="text-xs text-red-300 font-medium">{error}</p>
              </div>
            )}

            <div className="flex gap-2.5 mt-2">
              <button
                type="button"
                onClick={() => { setStep(1); setError(null); }}
                className="flex-none px-4 py-3.5 rounded-2xl font-bold text-sm text-white/60 hover:text-white transition-all cursor-pointer"
                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
              >
                Retour
              </button>
              <button
                id="onboard-submit-btn"
                type="submit"
                disabled={isLoading}
                className="flex-1 py-3.5 rounded-2xl font-extrabold text-white text-sm flex items-center justify-center gap-2 transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
                style={{
                  background: isLoading ? 'rgba(16,185,129,0.4)' : 'linear-gradient(135deg, #059669, #10B981)',
                  boxShadow: isLoading ? 'none' : '0 6px 24px rgba(16,185,129,0.35)',
                }}
              >
                {isLoading ? (
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                ) : (
                  <CheckCircle2 className="w-4 h-4" />
                )}
                {isLoading ? 'Enregistrement...' : 'Terminer et accéder à StudyCloud'}
              </button>
            </div>
          </form>
        )}

        {/* Footnote */}
        <p className="text-[11px] text-white/25 font-medium text-center mt-5 leading-relaxed">
          Ces informations permettent d'identifier vos documents partagés et de personnaliser votre expérience.
        </p>
      </div>
    </div>
  );
}
