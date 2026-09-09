import React from 'react';
import { Play, Pause, RotateCcw, X, Clock, Bell, Sparkles } from 'lucide-react';

interface StudyTimerModalProps {
  isOpen: boolean;
  onClose: () => void;
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

            <div className="mt-3 text-xs font-mono text-stone-400">
              Durée choisie : <span className="font-bold text-white">{formatTimerDisplay(timerDuration)}</span>
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
