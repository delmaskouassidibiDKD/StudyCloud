import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Clock as ClockIcon, Bell, Timer as TimerIcon, Watch, Plus, Trash2, Play, Pause, RotateCcw, Flag, Volume2, X } from 'lucide-react';
import { triggerDebouncedCloudBackup } from '../services/userSync';
import { StudyCloudAPI } from '../services/api';

interface ClockMenuViewProps {
  onBack: () => void;
}

interface AlarmItem {
  id: string;
  time: string; // HH:MM
  label: string;
  active: boolean;
  days?: string[];
}

interface WorldCity {
  name: string;
  country: string;
  timeZone: string;
}

const WORLD_CITIES: WorldCity[] = [
  { name: 'Abidjan', country: 'Côte d’Ivoire', timeZone: 'Africa/Abidjan' },
  { name: 'Paris', country: 'France', timeZone: 'Europe/Paris' },
  { name: 'Londres', country: 'Royaume-Uni', timeZone: 'Europe/London' },
  { name: 'New York', country: 'États-Unis', timeZone: 'America/New_York' },
  { name: 'Tokyo', country: 'Japon', timeZone: 'Asia/Tokyo' },
  { name: 'Dubaï', country: 'Émirats Arabes Unis', timeZone: 'Asia/Dubai' },
];

export const ClockMenuView: React.FC<ClockMenuViewProps> = ({ onBack }) => {
  const [activeTab, setActiveTab] = useState<'clock' | 'alarm' | 'stopwatch' | 'timer'>('clock');

  // Audio Beep helper
  const playBeep = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, audioCtx.currentTime);
      gain.gain.setValueAtTime(0.4, audioCtx.currentTime);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 1.2);
    } catch (e) {
      console.error(e);
    }
  };

  // ---------------- 1. LIVE CLOCK & WORLD CLOCK ----------------
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // ---------------- 2. ALARMS STATE ----------------
  const defaultAlarms: AlarmItem[] = [];

  const [alarms, setAlarms] = useState<AlarmItem[]>(() => {
    const saved = localStorage.getItem('unifolder_clock_alarms');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { console.error(e); }
    }
    return [];
  });

  useEffect(() => {
    localStorage.setItem('unifolder_clock_alarms', JSON.stringify(alarms));
    localStorage.setItem('unifolder_alarms', JSON.stringify(alarms));
    triggerDebouncedCloudBackup();
  }, [alarms]);

  // Synchronisation avec Cloudflare D1
  useEffect(() => {
    const userId = localStorage.getItem('unifolder_user_id') || 'default-user';
    StudyCloudAPI.getAlarms(userId)
      .then((res: any) => {
        if (res && res.success && Array.isArray(res.data)) {
          const mapped: AlarmItem[] = res.data.map((row: any) => ({
            id: row.id,
            time: row.time,
            label: row.label || 'Alarme',
            active: Boolean(row.is_active),
            days: row.days_json ? JSON.parse(row.days_json) : ['Tous les jours'],
          }));
          setAlarms(mapped);
          localStorage.setItem('unifolder_clock_alarms', JSON.stringify(mapped));
          localStorage.setItem('unifolder_alarms', JSON.stringify(mapped));
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const handleRestore = () => {
      const saved = localStorage.getItem('unifolder_clock_alarms') || localStorage.getItem('unifolder_alarms');
      if (saved) {
        try { setAlarms(JSON.parse(saved)); } catch (e) {}
      } else {
        setAlarms(defaultAlarms);
      }
    };
    window.addEventListener('unifolder_data_restored', handleRestore);
    return () => window.removeEventListener('unifolder_data_restored', handleRestore);
  }, []);

  const [isAddAlarmOpen, setIsAddAlarmOpen] = useState(false);
  const [newAlarmTime, setNewAlarmTime] = useState('08:00');
  const [newAlarmLabel, setNewAlarmLabel] = useState('');
  const [ringingAlarm, setRingingAlarm] = useState<AlarmItem | null>(null);

  // Check Alarms every minute
  useEffect(() => {
    const currentFormatted = now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    const seconds = now.getSeconds();

    if (seconds === 0) {
      const triggered = alarms.find(a => a.active && a.time === currentFormatted);
      if (triggered) {
        setRingingAlarm(triggered);
        playBeep();
      }
    }
  }, [now, alarms]);

  const handleAddAlarm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAlarmTime) return;
    const created: AlarmItem = {
      id: 'alarm-' + Date.now(),
      time: newAlarmTime,
      label: newAlarmLabel.trim() || 'Alarme',
      active: true,
      days: ['Tous les jours']
    };
    setAlarms(prev => [...prev, created]);
    const userId = localStorage.getItem('unifolder_user_id') || 'default-user';
    StudyCloudAPI.createAlarm({
      id: created.id,
      userId,
      time: created.time,
      label: created.label,
      isActive: created.active ? 1 : 0,
      daysJson: JSON.stringify(created.days)
    }).catch(() => {});
    setNewAlarmLabel('');
    setIsAddAlarmOpen(false);
  };

  const toggleAlarmActive = (id: string) => {
    const target = alarms.find(a => a.id === id);
    if (target) {
      const updated = { ...target, active: !target.active };
      setAlarms(prev => prev.map(a => a.id === id ? updated : a));
      const userId = localStorage.getItem('unifolder_user_id') || 'default-user';
      StudyCloudAPI.createAlarm({
        id: updated.id,
        userId,
        time: updated.time,
        label: updated.label,
        isActive: updated.active ? 1 : 0,
        daysJson: JSON.stringify(updated.days)
      }).catch(() => {});
    }
  };

  const deleteAlarm = (id: string) => {
    setAlarms(prev => prev.filter(a => a.id !== id));
    StudyCloudAPI.deleteAlarm(id).catch(() => {});
  };

  // ---------------- 3. STOPWATCH STATE ----------------
  const [swTime, setSwTime] = useState(0); // in ms
  const [swRunning, setSwRunning] = useState(false);
  const [swLaps, setSwLaps] = useState<number[]>([]);
  const swStartTimeRef = useRef<number>(0);

  useEffect(() => {
    let interval: any;
    if (swRunning) {
      if (!swStartTimeRef.current) {
        swStartTimeRef.current = Date.now() - swTime;
      }
      const syncSw = () => {
        if (!swStartTimeRef.current) return;
        setSwTime(Date.now() - swStartTimeRef.current);
      };
      interval = setInterval(syncSw, 25);
      const handleWakeUp = () => syncSw();
      document.addEventListener('visibilitychange', handleWakeUp);
      window.addEventListener('focus', handleWakeUp);
      window.addEventListener('pageshow', handleWakeUp);

      return () => {
        clearInterval(interval);
        document.removeEventListener('visibilitychange', handleWakeUp);
        window.removeEventListener('focus', handleWakeUp);
        window.removeEventListener('pageshow', handleWakeUp);
      };
    } else {
      swStartTimeRef.current = 0;
    }
  }, [swRunning]);

  const handleSwLap = () => {
    setSwLaps(prev => [swTime, ...prev]);
  };

  const handleSwReset = () => {
    swStartTimeRef.current = 0;
    setSwRunning(false);
    setSwTime(0);
    setSwLaps([]);
  };

  const formatSwTime = (ms: number) => {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    const centiseconds = Math.floor((ms % 1000) / 10);
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(centiseconds).padStart(2, '0')}`;
  };

  // ---------------- 4. TIMER COUNTDOWN STATE ----------------
  const [customHours, setCustomHours] = useState(0);
  const [customMinutes, setCustomMinutes] = useState(5);
  const [customSeconds, setCustomSeconds] = useState(0);

  const [timerDuration, setTimerDuration] = useState(300); // 5 mins in seconds
  const [timerLeft, setTimerLeft] = useState(300);
  const [timerRunning, setTimerRunning] = useState(false);
  const [timerFinishedAlert, setTimerFinishedAlert] = useState(false);
  const timerTargetRef = useRef<number>(0);

  // Update timerLeft when custom time inputs change if timer is not running
  const applyCustomTime = (h: number, m: number, s: number) => {
    const validH = Math.max(0, Math.min(99, h));
    const validM = Math.max(0, Math.min(59, m));
    const validS = Math.max(0, Math.min(59, s));

    setCustomHours(validH);
    setCustomMinutes(validM);
    setCustomSeconds(validS);

    const total = validH * 3600 + validM * 60 + validS;
    timerTargetRef.current = 0;
    setTimerDuration(total);
    setTimerLeft(total);
    setTimerRunning(false);
  };

  useEffect(() => {
    let interval: any;
    if (timerRunning) {
      if (!timerTargetRef.current || timerTargetRef.current <= Date.now()) {
        timerTargetRef.current = Date.now() + timerLeft * 1000;
      }
      const syncTimer = () => {
        if (!timerTargetRef.current) return;
        const remaining = Math.max(0, Math.ceil((timerTargetRef.current - Date.now()) / 1000));
        setTimerLeft(remaining);
        if (remaining <= 0) {
          timerTargetRef.current = 0;
          setTimerRunning(false);
          setTimerFinishedAlert(true);
          playBeep();
        }
      };

      syncTimer();
      interval = setInterval(syncTimer, 500);

      const handleWakeUp = () => syncTimer();
      document.addEventListener('visibilitychange', handleWakeUp);
      window.addEventListener('focus', handleWakeUp);
      window.addEventListener('pageshow', handleWakeUp);

      return () => {
        clearInterval(interval);
        document.removeEventListener('visibilitychange', handleWakeUp);
        window.removeEventListener('focus', handleWakeUp);
        window.removeEventListener('pageshow', handleWakeUp);
      };
    } else {
      timerTargetRef.current = 0;
    }
  }, [timerRunning]);

  const handleStartTimerPreset = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    setCustomHours(h);
    setCustomMinutes(m);
    setCustomSeconds(s);

    timerTargetRef.current = Date.now() + seconds * 1000;
    setTimerDuration(seconds);
    setTimerLeft(seconds);
    setTimerRunning(true);
    setTimerFinishedAlert(false);
  };

  const formatTimerDisplay = (totalSec: number) => {
    const hrs = Math.floor(totalSec / 3600);
    const mins = Math.floor((totalSec % 3600) / 60);
    const secs = totalSec % 60;
    if (hrs > 0) {
      return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  return (
    <div className="absolute inset-x-0 bottom-0 top-[62px] md:top-[66px] md:left-64 z-30 w-full md:w-[calc(100%-16rem)] bg-[#F5F0E8] dark:bg-[#0b0f19] text-[#2D4A3E] dark:text-slate-100 px-3 sm:px-6 py-6 overflow-y-auto min-h-[calc(100vh-66px)] flex flex-col transition-colors duration-300">
      
      {/* Top Header */}
      <div className="fixed top-[84px] md:top-[88px] left-4 right-4 md:left-[17.5rem] flex items-center justify-between z-40 pointer-events-none">
        <button
          onClick={onBack}
          className="pointer-events-auto flex items-center gap-1.5 px-3 py-1.5 bg-[#E8DFD0] hover:bg-[#D4C9B5] text-[#2D4A3E] dark:bg-[#1e293b] dark:text-white dark:border-[#334155] font-bold text-xs rounded-xl border-2 border-[#2D4A3E] shadow-[2px_2px_0px_0px_#1c1917] transition-all cursor-pointer active:translate-x-0.5 active:translate-y-0.5"
        >
          <ArrowLeft className="w-4 h-4 text-[#2D4A3E] dark:text-white" />
          <span>Retour</span>
        </button>
      </div>

      <div className="w-full max-w-4xl mx-auto pt-20 pb-12 flex-1 flex flex-col">
        
        {/* Navigation Tabs */}
        <div className="mb-6 bg-white/90 backdrop-blur-sm p-1.5 rounded-2xl border-2 border-stone-900 shadow-[3px_3px_0px_0px_#1c1917] flex items-center justify-between gap-1 overflow-x-auto">
          <button
            onClick={() => setActiveTab('clock')}
            className={`flex-1 min-w-[90px] flex items-center justify-center gap-2 py-2 px-3 rounded-xl font-bold text-xs sm:text-sm border-2 transition-all cursor-pointer ${
              activeTab === 'clock'
                ? 'bg-[#18568A] text-white border-stone-900 shadow-[2px_2px_0px_0px_#1c1917]'
                : 'bg-transparent text-stone-700 border-transparent hover:bg-stone-100'
            }`}
          >
            <ClockIcon className="w-4 h-4" />
            <span>Horloge</span>
          </button>

          <button
            onClick={() => setActiveTab('alarm')}
            className={`flex-1 min-w-[90px] flex items-center justify-center gap-2 py-2 px-3 rounded-xl font-bold text-xs sm:text-sm border-2 transition-all cursor-pointer ${
              activeTab === 'alarm'
                ? 'bg-[#18568A] text-white border-stone-900 shadow-[2px_2px_0px_0px_#1c1917]'
                : 'bg-transparent text-stone-700 border-transparent hover:bg-stone-100'
            }`}
          >
            <Bell className="w-4 h-4" />
            <span>Alarme</span>
          </button>

          <button
            onClick={() => setActiveTab('stopwatch')}
            className={`flex-1 min-w-[90px] flex items-center justify-center gap-2 py-2 px-3 rounded-xl font-bold text-xs sm:text-sm border-2 transition-all cursor-pointer ${
              activeTab === 'stopwatch'
                ? 'bg-[#18568A] text-white border-stone-900 shadow-[2px_2px_0px_0px_#1c1917]'
                : 'bg-transparent text-stone-700 border-transparent hover:bg-stone-100'
            }`}
          >
            <Watch className="w-4 h-4" />
            <span>Chronomètre</span>
          </button>

          <button
            onClick={() => setActiveTab('timer')}
            className={`flex-1 min-w-[90px] flex items-center justify-center gap-2 py-2 px-3 rounded-xl font-bold text-xs sm:text-sm border-2 transition-all cursor-pointer ${
              activeTab === 'timer'
                ? 'bg-[#18568A] text-white border-stone-900 shadow-[2px_2px_0px_0px_#1c1917]'
                : 'bg-transparent text-stone-700 border-transparent hover:bg-stone-100'
            }`}
          >
            <TimerIcon className="w-4 h-4" />
            <span>Minuteur</span>
          </button>
        </div>

        {/* TAB 1: HORLOGE & HORLOGE MONDIALE */}
        {activeTab === 'clock' && (
          <div className="space-y-6">
            {/* Main Giant Clock Card */}
            <div className="bg-stone-900 text-white p-8 rounded-3xl border-3 border-stone-900 shadow-[5px_5px_0px_0px_#1c1917] flex flex-col items-center justify-center text-center relative overflow-hidden">
              <div className="absolute -top-10 -right-10 w-40 h-40 bg-[#18568A]/20 rounded-full blur-2xl" />
              <div className="text-5xl sm:text-7xl font-mono font-bold tracking-tight mb-2 text-[#F7C858]">
                {now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </div>
              <div className="text-sm sm:text-base font-semibold text-stone-300 uppercase tracking-widest">
                {now.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
              </div>
            </div>

            {/* World Clock Grid */}
            <div>
              <h3 className="text-base font-serif font-bold text-[#2D4A3E] mb-3 flex items-center gap-2">
                <ClockIcon className="w-4 h-4 text-[#18568A]" />
                Horloge Mondiale
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {WORLD_CITIES.map(city => {
                  const cityTime = new Date().toLocaleTimeString('fr-FR', {
                    timeZone: city.timeZone,
                    hour: '2-digit',
                    minute: '2-digit'
                  });
                  return (
                    <div key={city.name} className="bg-white p-4 rounded-2xl border-2 border-stone-900 shadow-[3px_3px_0px_0px_#1c1917] flex items-center justify-between">
                      <div>
                        <div className="font-bold text-sm text-stone-900">{city.name}</div>
                        <div className="text-xs text-stone-500">{city.country}</div>
                      </div>
                      <div className="text-2xl font-mono font-bold text-[#18568A]">
                        {cityTime}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: ALARMES */}
        {activeTab === 'alarm' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-serif font-bold text-[#2D4A3E]">Vos Alarmes</h3>
              <button
                onClick={() => setIsAddAlarmOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-[#18568A] hover:bg-[#13436D] text-white font-bold text-xs rounded-xl border-2 border-stone-900 shadow-[2px_2px_0px_0px_#1c1917] transition-all cursor-pointer active:translate-x-0.5 active:translate-y-0.5"
              >
                <Plus className="w-4 h-4" />
                <span>Ajouter une alarme</span>
              </button>
            </div>

            {alarms.length === 0 ? (
              <div className="bg-white/80 p-8 text-center rounded-2xl border-2 border-dashed border-stone-400 text-stone-500 font-medium text-sm">
                Aucune alarme configurée. Cliquez sur "Ajouter une alarme" ci-dessus.
              </div>
            ) : (
              <div className="space-y-3">
                {alarms.map(alarm => (
                  <div
                    key={alarm.id}
                    className={`p-4 rounded-2xl border-2 border-stone-900 shadow-[3px_3px_0px_0px_#1c1917] flex items-center justify-between transition-all ${
                      alarm.active ? 'bg-white' : 'bg-stone-100 opacity-75'
                    }`}
                  >
                    <div>
                      <div className="text-3xl font-mono font-bold text-stone-900">{alarm.time}</div>
                      <div className="text-xs font-semibold text-[#18568A] mt-0.5">{alarm.label}</div>
                      <div className="text-[11px] text-stone-500">{alarm.days?.join(', ')}</div>
                    </div>

                    <div className="flex items-center gap-3">
                      {/* Toggle Active Switch */}
                      <button
                        onClick={() => toggleAlarmActive(alarm.id)}
                        className={`w-12 h-6 rounded-full p-0.5 border-2 border-stone-900 transition-colors cursor-pointer ${
                          alarm.active ? 'bg-[#18568A]' : 'bg-stone-300'
                        }`}
                      >
                        <div
                          className={`w-4 h-4 rounded-full bg-white border border-stone-900 transform transition-transform ${
                            alarm.active ? 'translate-x-6' : 'translate-x-0'
                          }`}
                        />
                      </button>

                      {/* Delete */}
                      <button
                        onClick={() => deleteAlarm(alarm.id)}
                        className="p-1.5 text-stone-500 hover:text-red-600 rounded-lg hover:bg-stone-200 transition-colors cursor-pointer"
                        title="Supprimer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: CHRONOMÈTRE */}
        {activeTab === 'stopwatch' && (
          <div className="space-y-6 flex flex-col items-center">
            {/* Giant Display */}
            <div className="bg-stone-900 text-[#F7C858] px-8 py-10 rounded-3xl border-3 border-stone-900 shadow-[5px_5px_0px_0px_#1c1917] w-full text-center">
              <div className="text-6xl sm:text-8xl font-mono font-bold tracking-tight">
                {formatSwTime(swTime)}
              </div>
            </div>

            {/* Controls */}
            <div className="flex items-center gap-3 flex-wrap justify-center">
              <button
                onClick={() => setSwRunning(!swRunning)}
                className={`flex items-center gap-2 px-6 py-3 font-bold text-sm rounded-2xl border-2 border-stone-900 shadow-[3px_3px_0px_0px_#1c1917] transition-all cursor-pointer active:translate-x-0.5 active:translate-y-0.5 ${
                  swRunning
                    ? 'bg-amber-500 hover:bg-amber-600 text-stone-900'
                    : 'bg-[#16A34A] hover:bg-green-700 text-white'
                }`}
              >
                {swRunning ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
                <span>{swRunning ? 'Pause' : 'Démarrer'}</span>
              </button>

              {swRunning && (
                <button
                  onClick={handleSwLap}
                  className="flex items-center gap-2 px-5 py-3 bg-[#18568A] hover:bg-[#13436D] text-white font-bold text-sm rounded-2xl border-2 border-stone-900 shadow-[3px_3px_0px_0px_#1c1917] transition-all cursor-pointer active:translate-x-0.5 active:translate-y-0.5"
                >
                  <Flag className="w-5 h-5" />
                  <span>Tour</span>
                </button>
              )}

              <button
                onClick={handleSwReset}
                className="flex items-center gap-2 px-5 py-3 bg-[#E8DFD0] hover:bg-[#D4C9B5] text-stone-900 font-bold text-sm rounded-2xl border-2 border-stone-900 shadow-[3px_3px_0px_0px_#1c1917] transition-all cursor-pointer active:translate-x-0.5 active:translate-y-0.5"
              >
                <RotateCcw className="w-5 h-5" />
                <span>Réinitialiser</span>
              </button>
            </div>

            {/* Laps List */}
            {swLaps.length > 0 && (
              <div className="w-full max-w-md bg-white rounded-2xl border-2 border-stone-900 shadow-[3px_3px_0px_0px_#1c1917] p-4 max-h-60 overflow-y-auto">
                <h4 className="font-serif font-bold text-sm text-[#2D4A3E] mb-2 border-b border-stone-200 pb-1">
                  Tours enregistrés ({swLaps.length})
                </h4>
                <div className="space-y-1.5">
                  {swLaps.map((lapTime, index) => (
                    <div key={index} className="flex items-center justify-between text-xs font-mono py-1 border-b border-stone-100 last:border-0">
                      <span className="font-bold text-stone-500">Tour {swLaps.length - index}</span>
                      <span className="font-bold text-stone-900">{formatSwTime(lapTime)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 4: MINUTEUR */}
        {activeTab === 'timer' && (
          <div className="space-y-6 flex flex-col items-center">
            
            {/* Custom Time Selector (when timer is stopped) vs Active Countdown */}
            {!timerRunning && timerLeft === timerDuration ? (
              <div className="bg-stone-900 text-white p-6 sm:p-8 rounded-3xl border-3 border-stone-900 shadow-[5px_5px_0px_0px_#1c1917] w-full text-center flex flex-col items-center">
                <div className="text-xs font-bold text-stone-400 uppercase tracking-wider mb-4">
                  Définir la durée du minuteur
                </div>

                {/* 3 Columns: Heures - Minutes - Secondes (Vertical layout to fit all mobile screens) */}
                <div className="flex items-center justify-center gap-1.5 sm:gap-6 my-2 w-full max-w-xs sm:max-w-md px-1">
                  
                  {/* Heures Column */}
                  <div className="flex flex-col items-center flex-1 min-w-[70px]">
                    <span className="text-[11px] font-bold text-stone-400 mb-1.5 uppercase tracking-wider">Heures</span>
                    <button
                      type="button"
                      onClick={() => applyCustomTime(customHours + 1, customMinutes, customSeconds)}
                      className="w-full max-w-[64px] py-1 bg-stone-800 hover:bg-stone-700 text-amber-400 font-extrabold text-lg rounded-t-xl border-t border-x border-stone-700 cursor-pointer transition-colors active:bg-stone-700"
                    >
                      +
                    </button>
                    <input
                      type="number"
                      min={0}
                      max={99}
                      value={customHours}
                      onChange={(e) => applyCustomTime(parseInt(e.target.value) || 0, customMinutes, customSeconds)}
                      className="w-full max-w-[64px] py-2 bg-stone-950 border-2 border-stone-700 text-center font-mono font-bold text-2xl sm:text-3xl text-[#F7C858] focus:outline-none focus:border-[#18568A] z-10"
                    />
                    <button
                      type="button"
                      onClick={() => applyCustomTime(customHours - 1, customMinutes, customSeconds)}
                      className="w-full max-w-[64px] py-1 bg-stone-800 hover:bg-stone-700 text-amber-400 font-extrabold text-lg rounded-b-xl border-b border-x border-stone-700 cursor-pointer transition-colors active:bg-stone-700"
                    >
                      -
                    </button>
                  </div>

                  <span className="text-2xl sm:text-3xl font-mono font-bold text-stone-500 pt-5">:</span>

                  {/* Minutes Column */}
                  <div className="flex flex-col items-center flex-1 min-w-[70px]">
                    <span className="text-[11px] font-bold text-stone-400 mb-1.5 uppercase tracking-wider">Minutes</span>
                    <button
                      type="button"
                      onClick={() => applyCustomTime(customHours, customMinutes + 1, customSeconds)}
                      className="w-full max-w-[64px] py-1 bg-stone-800 hover:bg-stone-700 text-amber-400 font-extrabold text-lg rounded-t-xl border-t border-x border-stone-700 cursor-pointer transition-colors active:bg-stone-700"
                    >
                      +
                    </button>
                    <input
                      type="number"
                      min={0}
                      max={59}
                      value={customMinutes}
                      onChange={(e) => applyCustomTime(customHours, parseInt(e.target.value) || 0, customSeconds)}
                      className="w-full max-w-[64px] py-2 bg-stone-950 border-2 border-stone-700 text-center font-mono font-bold text-2xl sm:text-3xl text-[#F7C858] focus:outline-none focus:border-[#18568A] z-10"
                    />
                    <button
                      type="button"
                      onClick={() => applyCustomTime(customHours, customMinutes - 1, customSeconds)}
                      className="w-full max-w-[64px] py-1 bg-stone-800 hover:bg-stone-700 text-amber-400 font-extrabold text-lg rounded-b-xl border-b border-x border-stone-700 cursor-pointer transition-colors active:bg-stone-700"
                    >
                      -
                    </button>
                  </div>

                  <span className="text-2xl sm:text-3xl font-mono font-bold text-stone-500 pt-5">:</span>

                  {/* Secondes Column */}
                  <div className="flex flex-col items-center flex-1 min-w-[70px]">
                    <span className="text-[11px] font-bold text-stone-400 mb-1.5 uppercase tracking-wider">Secondes</span>
                    <button
                      type="button"
                      onClick={() => applyCustomTime(customHours, customMinutes, customSeconds + 1)}
                      className="w-full max-w-[64px] py-1 bg-stone-800 hover:bg-stone-700 text-amber-400 font-extrabold text-lg rounded-t-xl border-t border-x border-stone-700 cursor-pointer transition-colors active:bg-stone-700"
                    >
                      +
                    </button>
                    <input
                      type="number"
                      min={0}
                      max={59}
                      value={customSeconds}
                      onChange={(e) => applyCustomTime(customHours, customMinutes, parseInt(e.target.value) || 0)}
                      className="w-full max-w-[64px] py-2 bg-stone-950 border-2 border-stone-700 text-center font-mono font-bold text-2xl sm:text-3xl text-[#F7C858] focus:outline-none focus:border-[#18568A] z-10"
                    />
                    <button
                      type="button"
                      onClick={() => applyCustomTime(customHours, customMinutes, customSeconds - 1)}
                      className="w-full max-w-[64px] py-1 bg-stone-800 hover:bg-stone-700 text-amber-400 font-extrabold text-lg rounded-b-xl border-b border-x border-stone-700 cursor-pointer transition-colors active:bg-stone-700"
                    >
                      -
                    </button>
                  </div>

                </div>

                <div className="mt-4 text-xs font-mono text-stone-400">
                  Durée choisie : <span className="font-bold text-white">{formatTimerDisplay(timerDuration)}</span>
                </div>
              </div>
            ) : (
              /* Giant Countdown Display when running or paused */
              <div className={`p-8 rounded-3xl border-3 border-stone-900 shadow-[5px_5px_0px_0px_#1c1917] w-full text-center transition-colors ${
                timerLeft === 0 ? 'bg-red-600 text-white animate-pulse' : 'bg-stone-900 text-[#F7C858]'
              }`}>
                <div className="text-6xl sm:text-8xl font-mono font-bold tracking-tight">
                  {formatTimerDisplay(timerLeft)}
                </div>
              </div>
            )}

            {/* Presets */}
            <div className="w-full">
              <label className="block text-center text-xs font-bold text-stone-700 mb-2">Raccourcis rapides :</label>
              <div className="flex items-center justify-center gap-2 flex-wrap">
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
                    onClick={() => handleStartTimerPreset(p.sec)}
                    className="px-3.5 py-1.5 bg-white hover:bg-stone-100 text-stone-900 font-bold text-xs rounded-xl border-2 border-stone-900 shadow-[2px_2px_0px_0px_#1c1917] transition-all cursor-pointer active:translate-x-0.5 active:translate-y-0.5"
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Controls */}
            <div className="flex items-center gap-3 flex-wrap justify-center">
              <button
                onClick={() => {
                  if (timerDuration === 0) return;
                  setTimerFinishedAlert(false);
                  setTimerRunning(!timerRunning);
                }}
                disabled={timerDuration === 0}
                className={`flex items-center gap-2 px-7 py-3.5 font-bold text-base rounded-2xl border-2 border-stone-900 shadow-[3px_3px_0px_0px_#1c1917] transition-all cursor-pointer active:translate-x-0.5 active:translate-y-0.5 ${
                  timerDuration === 0
                    ? 'bg-stone-300 text-stone-500 opacity-60 cursor-not-allowed'
                    : timerRunning
                      ? 'bg-amber-500 hover:bg-amber-600 text-stone-900'
                      : 'bg-[#18568A] hover:bg-[#13436D] text-white'
                }`}
              >
                {timerRunning ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
                <span>{timerRunning ? 'Pause' : 'Démarrer'}</span>
              </button>

              <button
                onClick={() => {
                  setTimerRunning(false);
                  setTimerLeft(timerDuration);
                  setTimerFinishedAlert(false);
                }}
                className="flex items-center gap-2 px-5 py-3.5 bg-[#E8DFD0] hover:bg-[#D4C9B5] text-stone-900 font-bold text-sm rounded-2xl border-2 border-stone-900 shadow-[3px_3px_0px_0px_#1c1917] transition-all cursor-pointer active:translate-x-0.5 active:translate-y-0.5"
              >
                <RotateCcw className="w-5 h-5" />
                <span>Réinitialiser</span>
              </button>
            </div>
          </div>
        )}

      </div>

      {/* MODAL: ADD ALARM */}
      {isAddAlarmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-[#FDFBF7] border-3 border-stone-900 rounded-2xl shadow-[6px_6px_0px_0px_#1c1917] w-full max-w-sm p-5 text-stone-900 relative">
            
            <button
              onClick={() => setIsAddAlarmOpen(false)}
              className="absolute top-3 right-3 p-1.5 text-stone-600 hover:text-stone-900 bg-stone-200 hover:bg-stone-300 rounded-xl border-2 border-stone-900 transition-all cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <h3 className="text-lg font-serif font-bold text-[#2D4A3E] mb-4 flex items-center gap-2">
              <Bell className="w-5 h-5 text-[#18568A]" />
              Nouvelle Alarme
            </h3>

            <form onSubmit={handleAddAlarm} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">Heure de l'alarme *</label>
                <input
                  type="time"
                  required
                  value={newAlarmTime}
                  onChange={(e) => setNewAlarmTime(e.target.value)}
                  className="w-full px-3 py-2 bg-white border-2 border-stone-900 rounded-xl font-mono font-bold text-xl focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">Libellé / Note (ex: Réveil, Réunion)</label>
                <input
                  type="text"
                  placeholder="Ex: Réveil matin..."
                  value={newAlarmLabel}
                  onChange={(e) => setNewAlarmLabel(e.target.value)}
                  className="w-full px-3 py-2 bg-white border-2 border-stone-900 rounded-xl font-medium text-sm focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddAlarmOpen(false)}
                  className="px-3 py-1.5 bg-stone-200 hover:bg-stone-300 text-stone-800 font-bold text-xs rounded-xl border-2 border-stone-900 cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-[#18568A] hover:bg-[#13436D] text-white font-bold text-xs rounded-xl border-2 border-stone-900 shadow-[2px_2px_0px_0px_#1c1917] cursor-pointer"
                >
                  Enregistrer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RINGING ALARM OR TIMER MODAL */}
      {(ringingAlarm || timerFinishedAlert) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-bounce">
          <div className="bg-red-600 border-4 border-stone-900 rounded-3xl shadow-[8px_8px_0px_0px_#1c1917] w-full max-w-sm p-6 text-white text-center relative">
            <Volume2 className="w-12 h-12 mx-auto mb-2 animate-pulse" />
            <h2 className="text-3xl font-bold font-serif mb-1">
              {ringingAlarm ? 'ALARME !' : 'MINUTEUR TERMINÉ !'}
            </h2>
            <p className="text-lg font-mono font-bold mb-6">
              {ringingAlarm ? ringingAlarm.time : '00:00'}
            </p>
            {ringingAlarm?.label && (
              <p className="text-sm font-semibold mb-6 bg-red-700/50 p-2 rounded-xl border border-white/20">
                {ringingAlarm.label}
              </p>
            )}

            <button
              onClick={() => {
                setRingingAlarm(null);
                setTimerFinishedAlert(false);
              }}
              className="w-full py-3 bg-white text-red-700 font-extrabold text-base rounded-2xl border-2 border-stone-900 shadow-[3px_3px_0px_0px_#1c1917] cursor-pointer hover:bg-stone-100 transition-colors"
            >
              Arrêter la sonnerie
            </button>
          </div>
        </div>
      )}

    </div>
  );
};
