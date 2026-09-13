import React, { useState, useEffect } from 'react';
import { Play, Pause, RotateCcw, X, Clock, Bell, Sparkles, BookmarkPlus, BookmarkCheck, Trash2 } from 'lucide-react';
import { StudyCloudAPI } from '../services/api';

export interface TimerPreset {
  id: string;
  duration_seconds: number;
  hours: number;
  minutes: number;
  seconds: number;
  label: string;
}

interface StudyTimerModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId?: string;
  timerLeft: number;
  setTimerLeft: (v: number | ((prev: number) => number)) => void;
  timerDuration: number;
  setTimerDuration: (v: number) => void;
  timerRunning: boolean;
  setTimerRunning: (v: boolean) => void;
  customHours: number;
  setCustomHours: (v: number) => void;
  customMinutes: number;
  setCustomMinutes: (v: number) => void;
  customSeconds: number;
  setCustomSeconds: (v: number) => void;
  timerFinishedAlert: boolean;
  setTimerFinishedAlert: (v: boolean) => void;
}

export const formatTimerDisplay = (totalSec: number) => {
  const hrs = Math.floor(totalSec / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;
  if (hrs > 0) {
    return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
};

export const StudyTimerModal: React.FC<StudyTimerModalProps> = ({
  isOpen,
  onClose,
  userId,
  timerLeft,
  setTimerLeft,
  timerDuration,
  setTimerDuration,
  timerRunning,
  setTimerRunning,
  customHours,
  setCustomHours,
  customMinutes,
  setCustomMinutes,
  customSeconds,
  setCustomSeconds,
  timerFinishedAlert,
  setTimerFinishedAlert
}) => {
  const effectiveUserId = userId || localStorage.getItem('unifolder_user_id') || 'default-user';
  const [savedPresets, setSavedPresets] = useState<TimerPreset[]>(() => {
    try {
      const raw = localStorage.getItem(`unifolder_timer_presets_${effectiveUserId}`);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });
  const [isSaving, setIsSaving] = useState(false);
  const [feedbackToast, setFeedbackToast] = useState<string | null>(null);

  const showFeedback = (msg: string) => {
    setFeedbackToast(msg);
    setTimeout(() => setFeedbackToast(null), 3000);
  };

  // Chargement des presets sauvegardés depuis D1
  useEffect(() => {
    if (!isOpen || !effectiveUserId) return;
    StudyCloudAPI.getTimerPresets(effectiveUserId)
      .then((res) => {
        if (res.success && Array.isArray(res.data)) {
          const mapped: TimerPreset[] = res.data.map((row: any) => ({
            id: row.id,
            duration_seconds: row.duration_seconds,
            hours: row.hours || Math.floor(row.duration_seconds / 3600),
            minutes: row.minutes || Math.floor((row.duration_seconds % 3600) / 60),
            seconds: row.seconds || (row.duration_seconds % 60),
            label: row.label || formatTimerDisplay(row.duration_seconds),
          }));
          setSavedPresets(mapped);
          localStorage.setItem(`unifolder_timer_presets_${effectiveUserId}`, JSON.stringify(mapped));
        }
      })
      .catch((err) => {
        console.warn('Erreur chargement presets D1:', err);
      });
  }, [isOpen, effectiveUserId]);

  if (!isOpen) return null;

  const applyCustomTime = (h: number, m: number, s: number) => {
    const validH = Math.max(0, Math.min(99, h));
    const validM = Math.max(0, Math.min(59, m));
    const validS = Math.max(0, Math.min(59, s));

    setCustomHours(validH);
    setCustomMinutes(validM);
    setCustomSeconds(validS);

    const total = validH * 3600 + validM * 60 + validS;
    setTimerDuration(total);
    setTimerLeft(total);
    setTimerRunning(false);
    setTimerFinishedAlert(false);
  };

  const handleStartTimerPreset = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    setCustomHours(h);
    setCustomMinutes(m);
    setCustomSeconds(s);

    setTimerDuration(seconds);
    setTimerLeft(seconds);
    setTimerRunning(true);
    setTimerFinishedAlert(false);
  };

  const handleSaveCurrentDuration = async () => {
    const total = customHours * 3600 + customMinutes * 60 + customSeconds;
    if (total <= 0) {
      showFeedback('Veuillez définir une durée supérieure à 0.');
      return;
    }
    const already = savedPresets.find(p => p.duration_seconds === total);
    if (already) {
      showFeedback('Cette durée est déjà enregistrée dans vos raccourcis !');
      return;
    }

    const id = 'preset-' + Date.now();
    const label = `${String(customHours).padStart(2, '0')}:${String(customMinutes).padStart(2, '0')}:${String(customSeconds).padStart(2, '0')}`;
    const newPreset: TimerPreset = {
      id,
      duration_seconds: total,
      hours: customHours,
      minutes: customMinutes,
      seconds: customSeconds,
      label,
    };

    const nextPresets = [...savedPresets, newPreset];
    setSavedPresets(nextPresets);
    localStorage.setItem(`unifolder_timer_presets_${effectiveUserId}`, JSON.stringify(nextPresets));
    showFeedback('⭐ Durée enregistrée avec succès !');

    setIsSaving(true);
    try {
      await StudyCloudAPI.saveTimerPreset({
        id,
        userId: effectiveUserId,
        durationSeconds: total,
        hours: customHours,
        minutes: customMinutes,
        seconds: customSeconds,
        label,
      });
    } catch (err) {
      console.warn('Erreur sauvegarde preset D1:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeletePreset = async (presetId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const nextPresets = savedPresets.filter(p => p.id !== presetId);
    setSavedPresets(nextPresets);
    localStorage.setItem(`unifolder_timer_presets_${effectiveUserId}`, JSON.stringify(nextPresets));
    showFeedback('Durée supprimée.');

    try {
      await StudyCloudAPI.deleteTimerPreset(presetId);
    } catch (err) {
      console.warn('Erreur suppression preset D1:', err);
    }
  };

  return (
    <div 
      className="fixed inset-0 z-[100000] bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn"
      onClick={onClose}
    >
      <div 
        className="bg-[#FDFBF7] border-3 border-stone-800 rounded-3xl max-w-lg w-full p-6 shadow-[6px_6px_0px_0px_#1c1917] space-y-6 relative select-none"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b-2 border-stone-200 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-orange-100 border-2 border-stone-800 flex items-center justify-center text-orange-600 shadow-[2px_2px_0px_0px_#1c1917]">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-stone-950 flex items-center gap-2">
                Minuteur d'étude
                {timerRunning && (
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
                )}
              </h3>
              <p className="text-xs text-stone-500 font-medium">Gérez votre temps et vos sessions de travail</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl border-2 border-stone-800 bg-white hover:bg-stone-100 text-stone-700 shadow-[1px_1px_0px_0px_#1c1917] active:translate-x-0.5 active:translate-y-0.5 transition-all cursor-pointer"
            title="Fermer (le minuteur continue en arrière-plan)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Alert when timer finishes */}
        {timerFinishedAlert && (
          <div className="bg-red-500 text-white p-3 rounded-2xl border-2 border-stone-900 shadow-[3px_3px_0px_0px_#1c1917] flex items-center justify-between animate-bounce">
            <div className="flex items-center gap-2">
              <Bell className="w-5 h-5 animate-spin" />
              <span className="font-bold text-xs sm:text-sm">Temps écoulé ! Session d'étude terminée.</span>
            </div>
            <button
              onClick={() => setTimerFinishedAlert(false)}
              className="bg-white text-red-600 px-2 py-0.5 rounded-lg text-xs font-bold border border-stone-900 shadow-[1px_1px_0px_0px_#1c1917]"
            >
              OK
            </button>
          </div>
        )}

        {/* Timer Core Box: Either Digital Dial Inputs OR Giant Countdown Display */}
        {!timerRunning && timerLeft === timerDuration && !timerFinishedAlert ? (
          <div className="bg-stone-900 p-6 rounded-3xl border-3 border-stone-900 shadow-[4px_4px_0px_0px_#1c1917] flex flex-col items-center">
            <h4 className="text-xs font-bold text-stone-400 uppercase tracking-widest mb-4">
              Définir la durée du minuteur
            </h4>

            <div className="flex items-center justify-center gap-3 w-full max-w-xs">
              {/* Heures Column */}
              <div className="flex flex-col items-center flex-1 min-w-[65px]">
                <span className="text-[10px] font-bold text-stone-400 mb-1.5 uppercase tracking-wider">Heures</span>
                <button
                  type="button"
                  onClick={() => applyCustomTime(customHours + 1, customMinutes, customSeconds)}
                  className="w-full max-w-[60px] py-1 bg-stone-800 hover:bg-stone-700 text-amber-400 font-extrabold text-base rounded-t-xl border-t border-x border-stone-700 cursor-pointer transition-colors active:bg-stone-700"
                >
                  +
                </button>
                <input
                  type="number"
                  min={0}
                  max={99}
                  value={customHours}
                  onChange={(e) => applyCustomTime(parseInt(e.target.value) || 0, customMinutes, customSeconds)}
                  className="w-full max-w-[60px] py-1.5 bg-stone-950 border-2 border-stone-700 text-center font-mono font-bold text-2xl text-[#F7C858] focus:outline-none focus:border-amber-400"
                />
                <button
                  type="button"
                  onClick={() => applyCustomTime(customHours - 1, customMinutes, customSeconds)}
                  className="w-full max-w-[60px] py-1 bg-stone-800 hover:bg-stone-700 text-amber-400 font-extrabold text-base rounded-b-xl border-b border-x border-stone-700 cursor-pointer transition-colors active:bg-stone-700"
                >
                  -
                </button>
              </div>

              <span className="text-2xl font-mono font-bold text-stone-500 pt-4">:</span>

              {/* Minutes Column */}
              <div className="flex flex-col items-center flex-1 min-w-[65px]">
                <span className="text-[10px] font-bold text-stone-400 mb-1.5 uppercase tracking-wider">Minutes</span>
                <button
                  type="button"
                  onClick={() => applyCustomTime(customHours, customMinutes + 1, customSeconds)}
                  className="w-full max-w-[60px] py-1 bg-stone-800 hover:bg-stone-700 text-amber-400 font-extrabold text-base rounded-t-xl border-t border-x border-stone-700 cursor-pointer transition-colors active:bg-stone-700"
                >
                  +
                </button>
                <input
                  type="number"
                  min={0}
                  max={59}
                  value={customMinutes}
                  onChange={(e) => applyCustomTime(customHours, parseInt(e.target.value) || 0, customSeconds)}
                  className="w-full max-w-[60px] py-1.5 bg-stone-950 border-2 border-stone-700 text-center font-mono font-bold text-2xl text-[#F7C858] focus:outline-none focus:border-amber-400"
                />
                <button
                  type="button"
                  onClick={() => applyCustomTime(customHours, customMinutes - 1, customSeconds)}
                  className="w-full max-w-[60px] py-1 bg-stone-800 hover:bg-stone-700 text-amber-400 font-extrabold text-base rounded-b-xl border-b border-x border-stone-700 cursor-pointer transition-colors active:bg-stone-700"
                >
                  -
                </button>
              </div>

              <span className="text-2xl font-mono font-bold text-stone-500 pt-4">:</span>

              {/* Secondes Column */}
              <div className="flex flex-col items-center flex-1 min-w-[65px]">
                <span className="text-[10px] font-bold text-stone-400 mb-1.5 uppercase tracking-wider">Secondes</span>
                <button
                  type="button"
                  onClick={() => applyCustomTime(customHours, customMinutes, customSeconds + 1)}
                  className="w-full max-w-[60px] py-1 bg-stone-800 hover:bg-stone-700 text-amber-400 font-extrabold text-base rounded-t-xl border-t border-x border-stone-700 cursor-pointer transition-colors active:bg-stone-700"
                >
                  +
                </button>
                <input
                  type="number"
                  min={0}
                  max={59}
                  value={customSeconds}
                  onChange={(e) => applyCustomTime(customHours, customMinutes, parseInt(e.target.value) || 0)}
                  className="w-full max-w-[60px] py-1.5 bg-stone-950 border-2 border-stone-700 text-center font-mono font-bold text-2xl text-[#F7C858] focus:outline-none focus:border-amber-400"
                />
                <button
                  type="button"
                  onClick={() => applyCustomTime(customHours, customMinutes, customSeconds - 1)}
                  className="w-full max-w-[60px] py-1 bg-stone-800 hover:bg-stone-700 text-amber-400 font-extrabold text-base rounded-b-xl border-b border-x border-stone-700 cursor-pointer transition-colors active:bg-stone-700"
                >
                  -
                </button>
              </div>
            </div>

            <div className="mt-3 flex items-center justify-between w-full max-w-xs px-1">
              <div className="text-xs font-mono text-stone-400">
                Durée choisie : <span className="font-bold text-white">{formatTimerDisplay(timerDuration)}</span>
              </div>
              {timerDuration > 0 && (
                <button
                  type="button"
                  onClick={handleSaveCurrentDuration}
                  disabled={isSaving}
                  className="flex items-center gap-1 px-2.5 py-1 bg-amber-400 hover:bg-amber-300 text-stone-950 font-extrabold text-[11px] rounded-lg border-2 border-stone-800 shadow-[1px_1px_0px_0px_#1c1917] active:translate-x-0.5 active:translate-y-0.5 transition-all cursor-pointer"
                  title="Enregistrer cette heure pour la retrouver plus tard"
                >
                  <BookmarkPlus className="w-3.5 h-3.5 shrink-0" />
                  <span>{isSaving ? 'Sauvegarde...' : 'Enregistrer'}</span>
                </button>
              )}
            </div>
          </div>
        ) : (
          /* Giant Countdown Display when running or paused */
          <div className={`p-6 sm:p-8 rounded-3xl border-3 border-stone-900 shadow-[4px_4px_0px_0px_#1c1917] w-full text-center transition-colors ${
            timerLeft === 0 ? 'bg-red-600 text-white animate-pulse' : 'bg-stone-900 text-[#F7C858]'
          }`}>
            <span className="text-[10px] font-bold uppercase tracking-widest text-stone-400 block mb-1">Temps restant</span>
            <div className="text-5xl sm:text-7xl font-mono font-bold tracking-tight">
              {formatTimerDisplay(timerLeft)}
            </div>
            {timerRunning && (
              <p className="text-xs text-amber-400/80 font-medium mt-2 animate-pulse">Session en cours...</p>
            )}
            {!timerRunning && timerLeft > 0 && timerLeft < timerDuration && (
              <p className="text-xs text-stone-400 font-medium mt-2">Minuteur en pause</p>
            )}
          </div>
        )}

        {/* Feedback Toast */}
        {feedbackToast && (
          <div className="bg-amber-100 border-2 border-stone-800 text-stone-900 px-3 py-1.5 rounded-xl text-xs font-bold text-center shadow-[2px_2px_0px_0px_#1c1917] animate-fadeIn">
            {feedbackToast}
          </div>
        )}

        {/* Mes Heures Enregistrées (Persistent User Presets from Cloudflare D1) */}
        {savedPresets.length > 0 && (
          <div className="w-full bg-amber-50/70 border-2 border-dashed border-amber-400/80 p-3 rounded-2xl">
            <div className="flex items-center justify-between mb-2 px-1">
              <label className="text-xs font-extrabold text-stone-800 flex items-center gap-1.5">
                <BookmarkCheck className="w-3.5 h-3.5 text-amber-600" />
                <span>Mes heures enregistrées :</span>
              </label>
              <span className="text-[10px] text-stone-500 font-bold">
                {savedPresets.length} enregistrée(s)
              </span>
            </div>
            <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
              {savedPresets.map((preset) => (
                <div
                  key={preset.id}
                  onClick={() => applyCustomTime(preset.hours, preset.minutes, preset.seconds)}
                  className="flex items-center gap-1.5 px-2.5 py-1 bg-white hover:bg-amber-100 text-stone-900 font-extrabold text-xs rounded-xl border-2 border-stone-800 shadow-[1px_1px_0px_0px_#1c1917] transition-all cursor-pointer active:translate-x-0.5 active:translate-y-0.5 group"
                  title="Cliquer pour appliquer cette heure"
                >
                  <Clock className="w-3 h-3 text-amber-600 shrink-0" />
                  <span>{preset.label || formatTimerDisplay(preset.duration_seconds)}</span>
                  <button
                    type="button"
                    onClick={(e) => handleDeletePreset(preset.id, e)}
                    className="p-0.5 hover:bg-red-100 text-stone-400 hover:text-red-600 rounded transition-colors cursor-pointer"
                    title="Supprimer cette heure enregistrée"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Quick Presets */}
        <div className="w-full">
          <label className="block text-center text-xs font-bold text-stone-700 mb-2">Raccourcis rapides :</label>
          <div className="flex items-center justify-center gap-1.5 sm:gap-2 flex-wrap">
            {[
              { label: '1 min', sec: 60 },
              { label: '5 min', sec: 300 },
              { label: '00:10:00', sec: 600 },
              { label: '00:15:00', sec: 900 },
              { label: '00:30:00', sec: 1800 },
              { label: '01:00:00', sec: 3600 },
            ].map(p => (
              <button
                key={p.sec}
                type="button"
                onClick={() => handleStartTimerPreset(p.sec)}
                className="px-2.5 sm:px-3 py-1 bg-white hover:bg-stone-100 text-stone-900 font-bold text-xs rounded-xl border-2 border-stone-800 shadow-[1px_1px_0px_0px_#1c1917] transition-all cursor-pointer active:translate-x-0.5 active:translate-y-0.5"
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-3 justify-center pt-1 border-t border-stone-200">
          <button
            type="button"
            onClick={() => {
              if (timerDuration === 0) return;
              setTimerFinishedAlert(false);
              setTimerRunning(!timerRunning);
            }}
            disabled={timerDuration === 0}
            className={`flex items-center gap-2 px-6 py-2.5 font-bold text-sm rounded-xl border-2 border-stone-900 shadow-[2px_2px_0px_0px_#1c1917] transition-all cursor-pointer active:translate-x-0.5 active:translate-y-0.5 ${
              timerDuration === 0
                ? 'bg-stone-300 text-stone-500 opacity-60 cursor-not-allowed'
                : timerRunning
                ? 'bg-amber-500 hover:bg-amber-600 text-stone-900'
                : 'bg-[#18568A] hover:bg-[#13436D] text-white'
            }`}
          >
            {timerRunning ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            <span>{timerRunning ? 'Pause' : 'Démarrer'}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setTimerRunning(false);
              setTimerLeft(timerDuration);
              setTimerFinishedAlert(false);
            }}
            className="flex items-center gap-2 px-4 py-2.5 bg-[#E8DFD0] hover:bg-[#D4C9B5] text-stone-900 font-bold text-sm rounded-xl border-2 border-stone-900 shadow-[2px_2px_0px_0px_#1c1917] transition-all cursor-pointer active:translate-x-0.5 active:translate-y-0.5"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Réinitialiser</span>
          </button>
        </div>
      </div>
    </div>
  );
};
