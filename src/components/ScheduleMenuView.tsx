import React, { useState, useEffect } from 'react';
import { ArrowLeft, Plus, Trash2, Edit2, Clock, Calendar, Check, X, ZoomIn, ZoomOut, MapPin, User } from 'lucide-react';
import { triggerDebouncedCloudBackup } from '../services/userSync';
import { StudyCloudAPI } from '../services/api';

interface ScheduleMenuViewProps {
  onBack: () => void;
}

interface ScheduleEntry {
  subject: string;
  room?: string;
  note?: string;
  color?: string;
}

const DEFAULT_DAYS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
const DEFAULT_HOURS = [
  '07h00', '08h00', '09h00', '10h00', '11h00', '12h00',
  '13h00', '14h00', '15h00', '16h00', '17h00', '18h00',
  '19h00', '20h00', '21h00', '22h00', '23h00'
];

const COLORS = [
  { name: 'Vert Pastel', bg: 'bg-emerald-100 dark:bg-emerald-950/80', text: 'text-emerald-900 dark:text-emerald-200', border: 'border-emerald-300 dark:border-emerald-700' },
  { name: 'Bleu Pastel', bg: 'bg-sky-100 dark:bg-sky-950/80', text: 'text-sky-900 dark:text-sky-200', border: 'border-sky-300 dark:border-sky-700' },
  { name: 'Jaune Pastel', bg: 'bg-amber-100 dark:bg-amber-950/80', text: 'text-amber-900 dark:text-amber-200', border: 'border-amber-300 dark:border-amber-700' },
  { name: 'Rose Pastel', bg: 'bg-rose-100 dark:bg-rose-950/80', text: 'text-rose-900 dark:text-rose-200', border: 'border-rose-300 dark:border-rose-700' },
  { name: 'Violet Pastel', bg: 'bg-purple-100 dark:bg-purple-950/80', text: 'text-purple-900 dark:text-purple-200', border: 'border-purple-300 dark:border-purple-700' },
];

export const ScheduleMenuView: React.FC<ScheduleMenuViewProps> = ({ onBack }) => {
  const [scheduleData, setScheduleData] = useState<Record<string, ScheduleEntry>>(() => {
    try {
      const saved = localStorage.getItem('user_schedule_data');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return {};
  });
  const [days, setDays] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('user_schedule_days');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return DEFAULT_DAYS;
  });
  const [hours, setHours] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('user_schedule_hours');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return DEFAULT_HOURS;
  });

  const [activeSlot, setActiveSlot] = useState<{ day: string; hour: string } | null>(null);
  const [subjectInput, setSubjectInput] = useState('');
  const [roomInput, setRoomInput] = useState('');
  const [noteInput, setNoteInput] = useState('');
  const [selectedColor, setSelectedColor] = useState(COLORS[0].bg);

  // Edit header modal / state
  const [editingHeader, setEditingHeader] = useState<{ type: 'day' | 'hour'; index: number; value: string } | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showAddConfirm, setShowAddConfirm] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [zoomLevel, setZoomLevel] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('user_schedule_zoom');
      if (saved) return Number(saved);
    } catch (e) {}
    return 100;
  });

  useEffect(() => {
    try {
      localStorage.setItem('user_schedule_data', JSON.stringify(scheduleData));
      triggerDebouncedCloudBackup();
    } catch (e) {}
  }, [scheduleData]);

  useEffect(() => {
    try {
      localStorage.setItem('user_schedule_days', JSON.stringify(days));
      triggerDebouncedCloudBackup();
    } catch (e) {}
  }, [days]);

  useEffect(() => {
    try {
      localStorage.setItem('user_schedule_hours', JSON.stringify(hours));
      triggerDebouncedCloudBackup();
    } catch (e) {}
  }, [hours]);

  useEffect(() => {
    try {
      localStorage.setItem('user_schedule_zoom', zoomLevel.toString());
      triggerDebouncedCloudBackup();
    } catch (e) {}
  }, [zoomLevel]);

  // Synchronisation avec Cloudflare D1
  useEffect(() => {
    const userId = localStorage.getItem('unifolder_user_id') || 'default-user';
    // 1. Charger la configuration (jours, heures, zoom)
    StudyCloudAPI.getScheduleConfig(userId)
      .then((res: any) => {
        if (res && res.success && res.data) {
          if (res.data.days_json) {
            try {
              const d = JSON.parse(res.data.days_json);
              if (Array.isArray(d) && d.length > 0) setDays(d);
            } catch (e) {}
          }
          if (res.data.hours_json) {
            try {
              const h = JSON.parse(res.data.hours_json);
              if (Array.isArray(h) && h.length > 0) setHours(h);
            } catch (e) {}
          }
          if (res.data.zoom_level) {
            setZoomLevel(Number(res.data.zoom_level));
          }
        }
      })
      .catch(() => {});

    // 2. Charger les créneaux réels
    StudyCloudAPI.getScheduleSlots(userId)
      .then((res: any) => {
        if (res && res.success && Array.isArray(res.data) && res.data.length > 0) {
          const mapped: Record<string, ScheduleEntry> = {};
          for (const s of res.data) {
            const k = `${s.day}_${s.hour_slot}`;
            mapped[k] = {
              subject: s.subject,
              room: s.room || '',
              note: s.note_or_teacher || '',
              color: s.color || COLORS[0].bg,
            };
          }
          setScheduleData(mapped);
        }
      })
      .catch(() => {});
  }, []);

  // Mettre à jour la configuration vers D1 dès modification
  useEffect(() => {
    const userId = localStorage.getItem('unifolder_user_id') || 'default-user';
    const timer = setTimeout(() => {
      StudyCloudAPI.updateScheduleConfig(userId, JSON.stringify(days), JSON.stringify(hours), zoomLevel).catch(() => {});
    }, 1000);
    return () => clearTimeout(timer);
  }, [days, hours, zoomLevel]);

  useEffect(() => {
    const handleRestore = () => {
      try {
        const savedData = localStorage.getItem('user_schedule_data');
        if (savedData) setScheduleData(JSON.parse(savedData));
        const savedDays = localStorage.getItem('user_schedule_days');
        if (savedDays) setDays(JSON.parse(savedDays));
        const savedHours = localStorage.getItem('user_schedule_hours');
        if (savedHours) setHours(JSON.parse(savedHours));
        const savedZoom = localStorage.getItem('user_schedule_zoom');
        if (savedZoom) setZoomLevel(Number(savedZoom));
      } catch (e) {}
    };
    window.addEventListener('unifolder_data_restored', handleRestore);
    return () => window.removeEventListener('unifolder_data_restored', handleRestore);
  }, []);

  const changeZoom = (delta: number) => {
    setZoomLevel((prev) => {
      const next = Math.min(150, Math.max(30, prev + 10 * delta));
      try {
        localStorage.setItem('user_schedule_zoom', next.toString());
      } catch (e) {}
      return next;
    });
  };

  const [touchStartDist, setTouchStartDist] = useState<number | null>(null);
  const [zoomAtStart, setZoomAtStart] = useState<number>(zoomLevel);
  const tableRef = React.useRef<HTMLDivElement>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      setTouchStartDist(dist);
      setZoomAtStart(zoomLevel);
    } else {
      setTouchStartDist(null);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && touchStartDist !== null) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const factor = dist / touchStartDist;
      const newZoom = Math.min(150, Math.max(30, Math.round(zoomAtStart * factor)));
      if (tableRef.current) {
        tableRef.current.style.zoom = `${newZoom}%`;
      }
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartDist !== null) {
      // Calculate final zoom based on last applied style or current transform
      if (tableRef.current) {
        const currentZoomStr = tableRef.current.style.zoom;
        const finalZoom = currentZoomStr ? parseInt(currentZoomStr) : zoomLevel;
        setZoomLevel(finalZoom);
        try {
          localStorage.setItem('user_schedule_zoom', finalZoom.toString());
        } catch (err) {}
      }
      setTouchStartDist(null);
    }
  };

  const handleWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const delta = e.deltaY < 0 ? 5 : -5;
      setZoomLevel((prev) => {
        const next = Math.min(150, Math.max(30, prev + delta));
        try {
          localStorage.setItem('user_schedule_zoom', next.toString());
        } catch (e) {}
        return next;
      });
    }
  };

  const saveEntry = () => {
    if (!activeSlot) return;
    const key = `${activeSlot.day}_${activeSlot.hour}`;
    const updated = { ...scheduleData };
    const userId = localStorage.getItem('unifolder_user_id') || 'default-user';

    if (!subjectInput.trim()) {
      delete updated[key];
      StudyCloudAPI.deleteScheduleSlot({ userId, day: activeSlot.day, hourSlot: activeSlot.hour }).catch(() => {});
    } else {
      const entry: ScheduleEntry = {
        subject: subjectInput.trim(),
        room: roomInput.trim(),
        note: noteInput.trim(),
        color: selectedColor
      };
      updated[key] = entry;
      StudyCloudAPI.addScheduleSlot({
        id: `${userId}-${activeSlot.day}-${activeSlot.hour}`,
        userId,
        day: activeSlot.day,
        hourSlot: activeSlot.hour,
        subject: entry.subject,
        room: entry.room,
        noteOrTeacher: entry.note,
        color: entry.color,
      }).catch(() => {});
    }
    setScheduleData(updated);
    try {
      localStorage.setItem('user_schedule_data', JSON.stringify(updated));
    } catch (e) {
      console.error(e);
    }
    setActiveSlot(null);
  };

  const openSlot = (day: string, hour: string) => {
    const key = `${day}_${hour}`;
    const existing = scheduleData[key];
    setActiveSlot({ day, hour });
    if (existing) {
      setSubjectInput(existing.subject || '');
      setRoomInput(existing.room || '');
      setNoteInput(existing.note || '');
      setSelectedColor(existing.color || COLORS[0].bg);
    } else {
      setSubjectInput('');
      setRoomInput('');
      setNoteInput('');
      setSelectedColor(COLORS[0].bg);
    }
  };

  const handleHeaderClick = (type: 'day' | 'hour', index: number) => {
    const currentVal = type === 'day' ? days[index] : hours[index];
    setEditingHeader({ type, index, value: currentVal });
  };

  const saveHeaderEdit = () => {
    if (!editingHeader) return;
    const { type, index, value } = editingHeader;
    const trimmed = value.trim();
    if (!trimmed) {
      setEditingHeader(null);
      return;
    }

    if (type === 'day') {
      const oldDay = days[index];
      const newDays = [...days];
      newDays[index] = trimmed;
      setDays(newDays);

      // Migrate scheduleData keys
      const updatedData = { ...scheduleData };
      hours.forEach((h) => {
        const oldKey = `${oldDay}_${h}`;
        const newKey = `${trimmed}_${h}`;
        if (updatedData[oldKey]) {
          updatedData[newKey] = updatedData[oldKey];
          delete updatedData[oldKey];
        }
      });
      setScheduleData(updatedData);
      try {
        localStorage.setItem('user_schedule_days', JSON.stringify(newDays));
        localStorage.setItem('user_schedule_data', JSON.stringify(updatedData));
      } catch (e) {
        console.error(e);
      }
    } else {
      const oldHour = hours[index];
      const newHours = [...hours];
      newHours[index] = trimmed;
      setHours(newHours);

      // Migrate scheduleData keys
      const updatedData = { ...scheduleData };
      days.forEach((d) => {
        const oldKey = `${d}_${oldHour}`;
        const newKey = `${d}_${trimmed}`;
        if (updatedData[oldKey]) {
          updatedData[newKey] = updatedData[oldKey];
          delete updatedData[oldKey];
        }
      });
      setScheduleData(updatedData);
      try {
        localStorage.setItem('user_schedule_hours', JSON.stringify(newHours));
        localStorage.setItem('user_schedule_data', JSON.stringify(updatedData));
      } catch (e) {
        console.error(e);
      }
    }
    setEditingHeader(null);
  };

  const addHourRow = () => {
    if (hours.length >= 50) {
      setErrorMessage('Impossible vous avez atteint votre limite 50 lignes maximale');
      setTimeout(() => setErrorMessage(null), 4000);
      return;
    }
    const lastHour = hours[hours.length - 1] || '07h00';
    const match = lastHour.match(/^(\d+)h(\d*)$/);
    let nextHourStr = '00h00';
    if (match) {
      const hNum = parseInt(match[1], 10) + 1;
      nextHourStr = `${hNum < 10 ? '0' + hNum : hNum}h00`;
    } else {
      nextHourStr = `${hours.length + 7}h00`;
    }
    const newHours = [...hours, nextHourStr];
    setHours(newHours);
    try {
      localStorage.setItem('user_schedule_hours', JSON.stringify(newHours));
    } catch (e) {}
  };

  const deleteHourRow = () => {
    if (!editingHeader || editingHeader.type !== 'hour') return;
    if (hours.length <= 1) {
      setErrorMessage("Impossible de supprimer la ligne, il ne peut pas y avoir zéro ligne !");
      setTimeout(() => setErrorMessage(null), 4000);
      setShowDeleteConfirm(false);
      setEditingHeader(null);
      return;
    }
    const index = editingHeader.index;
    const hourToRemove = hours[index];
    const newHours = hours.filter((_, i) => i !== index);
    setHours(newHours);

    const updatedData = { ...scheduleData };
    days.forEach((d) => {
      const key = `${d}_${hourToRemove}`;
      delete updatedData[key];
    });
    setScheduleData(updatedData);

    try {
      localStorage.setItem('user_schedule_hours', JSON.stringify(newHours));
      localStorage.setItem('user_schedule_data', JSON.stringify(updatedData));
    } catch (e) {}

    setShowDeleteConfirm(false);
    setEditingHeader(null);
  };

  const promptAddHourRow = () => {
    if (hours.length >= 50) {
      setErrorMessage('Impossible vous avez atteint votre limite 50 lignes maximale');
      setTimeout(() => setErrorMessage(null), 4000);
      setEditingHeader(null);
      setShowAddConfirm(false);
      return;
    }
    setShowAddConfirm(true);
  };

  const confirmAddHourRow = () => {
    if (hours.length >= 50) {
      setErrorMessage('Impossible vous avez atteint votre limite 50 lignes maximale');
      setTimeout(() => setErrorMessage(null), 4000);
      setShowAddConfirm(false);
      setEditingHeader(null);
      return;
    }
    if (!editingHeader || editingHeader.type !== 'hour') return;
    const index = editingHeader.index;

    const newHours = [...hours];
    newHours.splice(index + 1, 0, '');
    setHours(newHours);
    try {
      localStorage.setItem('user_schedule_hours', JSON.stringify(newHours));
    } catch (e) {}

    const newIndex = index + 1;
    setEditingHeader({ type: 'hour', index: newIndex, value: '' });
    setShowAddConfirm(false);
    
    setSuccessMessage('Une ligne a été ajoutée avec succès !');
    setTimeout(() => {
      setSuccessMessage(null);
    }, 3000);
  };

  return (
    <div className="absolute inset-x-0 md:left-64 md:right-0 bottom-16 md:bottom-0 top-[72px] md:top-[76px] z-30 w-full md:w-[calc(100%-16rem)] bg-[#FDFBF7] dark:bg-[#0b0f19] text-stone-900 dark:text-slate-100 flex flex-col overflow-hidden transition-colors duration-300">
      {/* Top Header Bar */}
      <div className="flex-none px-3 py-2 bg-[#FDFBF7] dark:bg-[#070a13] backdrop-blur-md border-b border-stone-200 dark:border-[#1e293b] flex items-center justify-between z-40 shadow-sm">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 px-2.5 py-1 bg-[#E8DFD0] dark:bg-[#1e293b] hover:bg-[#D4C9B5] dark:hover:bg-[#334155] text-[#2D4A3E] dark:text-white font-bold text-xs rounded-lg border-2 border-[#2D4A3E] dark:border-[#334155] shadow-[1px_1px_0px_0px_#1c1917] dark:shadow-none transition-all cursor-pointer active:translate-x-0.5 active:translate-y-0.5"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Retour</span>
        </button>
        <div className="text-center flex-1 mx-2">
          <h1 className="text-base sm:text-lg font-serif font-bold text-[#2D4A3E] dark:text-white truncate">Mon emploi du temps</h1>
        </div>
        <button
          onClick={addHourRow}
          className="flex items-center gap-1 px-2.5 py-1 bg-[#2D4A3E] dark:bg-emerald-600 hover:bg-[#20342b] dark:hover:bg-emerald-500 text-white font-bold text-xs rounded-lg shadow transition-all cursor-pointer whitespace-nowrap"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>+ Heure</span>
        </button>
      </div>

      {/* Scrollable Schedule Grid Container (Both Horizontal & Vertical) */}
      <div 
        className="flex-1 overflow-auto p-4 sm:p-6 pb-4 sm:pb-6 touch-pan-x touch-pan-y"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onWheel={handleWheel}
      >
        <div 
          ref={tableRef}
          className="min-w-[900px] max-w-full mx-auto bg-white dark:bg-[#070a13] rounded-xl shadow-lg border-2 border-stone-800 dark:border-[#1e293b] overflow-hidden"
          style={{ zoom: `${zoomLevel}%` }}
        >
          {/* Header title inside the table area */}
          <div className="bg-[#F5F0E8] dark:bg-[#111a2e] py-3 px-4 border-b-2 border-stone-800 dark:border-[#1e293b] flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-[#2D4A3E] dark:text-emerald-400" />
                <span className="font-serif font-bold text-base text-[#2D4A3E] dark:text-white">Emploi du temps hebdomadaire</span>
              </div>
              {/* Zoom Controls */}
              <div className="flex items-center gap-1 bg-white dark:bg-[#070a13] border border-stone-300 dark:border-[#1e293b] rounded-lg p-1 shadow-xs">
                <button
                  type="button"
                  onClick={() => changeZoom(-1)}
                  title="Dézoomer (réduire)"
                  className="p-1 hover:bg-stone-100 dark:hover:bg-[#1e293b] rounded text-stone-700 dark:text-slate-200 transition-colors cursor-pointer"
                >
                  <ZoomOut className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setZoomLevel(100);
                    try { localStorage.setItem('user_schedule_zoom', '100'); } catch(e) {}
                  }}
                  title="Réinitialiser le zoom (100%)"
                  className="px-2 py-0.5 text-xs font-bold text-[#2D4A3E] dark:text-white hover:bg-stone-100 dark:hover:bg-[#1e293b] rounded transition-colors cursor-pointer"
                >
                  {zoomLevel}%
                </button>
                <button
                  type="button"
                  onClick={() => changeZoom(1)}
                  title="Zoomer (agrandir)"
                  className="p-1 hover:bg-stone-100 dark:hover:bg-[#1e293b] rounded text-stone-700 dark:text-slate-200 transition-colors cursor-pointer"
                >
                  <ZoomIn className="w-4 h-4" />
                </button>
              </div>
            </div>
            <span className="text-xs text-stone-600 dark:text-slate-300 bg-stone-200/70 dark:bg-[#1e293b] px-2.5 py-1 rounded-full font-medium">Glissez horizontalement et verticalement • Cliquez sur les jours et heures pour les renommer</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-xs sm:text-sm table-fixed">
            <thead>
              <tr className="bg-[#E8DFD0] dark:bg-[#162033] text-[#2D4A3E] dark:text-white border-b-2 border-stone-800 dark:border-[#1e293b]">
                {/* Diagonal Split Top-Left Corner Box */}
                <th className="relative border-r-2 border-stone-800 dark:border-[#1e293b] w-32 h-16 p-0 overflow-hidden bg-[#E8DFD0] dark:bg-[#162033]">
                  <svg className="absolute inset-0 w-full h-full pointer-events-none" preserveAspectRatio="none" viewBox="0 0 100 100">
                    <line x1="0" y1="0" x2="100" y2="100" stroke="currentColor" className="text-stone-800 dark:text-[#334155]" strokeWidth="2" />
                  </svg>
                  <div className="absolute top-1 right-2 text-[11px] font-bold uppercase tracking-wider text-[#2D4A3E] dark:text-white">
                    Jours
                  </div>
                  <div className="absolute bottom-1 left-2 text-[11px] font-bold uppercase tracking-wider text-[#2D4A3E] dark:text-white">
                    Heures
                  </div>
                </th>
                {days.map((day, dIdx) => (
                  <th
                    key={day}
                    onClick={() => handleHeaderClick('day', dIdx)}
                    className="py-3 px-3 font-bold border-r border-stone-800 dark:border-[#1e293b] text-center uppercase tracking-wider last:border-r-0 cursor-pointer hover:bg-[#dfd4c0] dark:hover:bg-[#1e293b] transition-colors group relative"
                    title="Cliquer pour modifier ce jour"
                  >
                    <div className="flex items-center justify-center gap-1">
                      <span>{day}</span>
                      <Edit2 className="w-3 h-3 opacity-0 group-hover:opacity-100 text-[#2D4A3E] dark:text-slate-300 transition-opacity" />
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {hours.map((hour, hIdx) => (
                <tr key={`${hour}-${hIdx}`} className="border-b border-stone-300 dark:border-[#1e293b] hover:bg-stone-50/50 dark:hover:bg-[#111a2e]/40 transition-colors">
                  <td
                    onClick={() => handleHeaderClick('hour', hIdx)}
                    className="py-3 px-2 font-bold text-stone-800 dark:text-white bg-[#F9F6F0] dark:bg-[#0c1424] border-r-2 border-stone-800 dark:border-[#1e293b] text-center whitespace-nowrap cursor-pointer hover:bg-[#f0e8dc] dark:hover:bg-[#162033] transition-colors group"
                    title="Cliquer pour modifier cette heure"
                  >
                    <div className="flex items-center justify-center gap-1">
                      <span>{hour}</span>
                      <Edit2 className="w-3 h-3 opacity-0 group-hover:opacity-100 text-stone-600 dark:text-slate-300 transition-opacity" />
                    </div>
                  </td>
                  {days.map((day) => {
                    const key = `${day}_${hour}`;
                    const entry = scheduleData[key];
                    const colorStyle = COLORS.find(c => c.bg === entry?.color || c.bg.startsWith(entry?.color?.split(' ')[0])) || COLORS[0];

                    return (
                      <td
                        key={day}
                        onClick={() => openSlot(day, hour)}
                        className={`p-2 border-r border-stone-300 dark:border-[#1e293b] last:border-r-0 cursor-pointer transition-all hover:bg-stone-100 dark:hover:bg-[#111a2e] relative group align-top ${
                          entry ? colorStyle.bg + ' ' + colorStyle.border + ' border-l-4' : 'h-16 dark:bg-[#070a13]'
                        }`}
                      >
                        {entry ? (
                          <div className="flex flex-col gap-1">
                            <div 
                              className={`font-bold text-xs sm:text-sm ${colorStyle.text}`}
                              style={{
                                display: '-webkit-box',
                                WebkitLineClamp: 2,
                                WebkitBoxOrient: 'vertical',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                wordBreak: 'break-word',
                              }}
                            >
                              {entry.subject}
                            </div>
                            {entry.room && (
                              <div className="text-[11px] opacity-85 font-semibold flex items-start gap-1 min-w-0">
                                <MapPin className="w-3 h-3 shrink-0 mt-0.5" />
                                <span 
                                  className="min-w-0"
                                  style={{
                                    display: '-webkit-box',
                                    WebkitLineClamp: 2,
                                    WebkitBoxOrient: 'vertical',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    wordBreak: 'break-word',
                                  }}
                                >
                                  {entry.room}
                                </span>
                              </div>
                            )}
                            {entry.note && (
                              <div className="text-[10px] opacity-80 font-medium flex items-start gap-1 min-w-0">
                                <User className="w-3 h-3 shrink-0 mt-0.5" />
                                <span 
                                  className="min-w-0"
                                  style={{
                                    display: '-webkit-box',
                                    WebkitLineClamp: 2,
                                    WebkitBoxOrient: 'vertical',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    wordBreak: 'break-word',
                                  }}
                                >
                                  {entry.note}
                                </span>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="w-full h-full flex items-center justify-center opacity-0 group-hover:opacity-40 text-stone-400 dark:text-slate-500">
                            <Plus className="w-4 h-4" />
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>

      {/* Edit Header Modal */}
      {editingHeader && (
        <div className="fixed inset-0 z-50 bg-stone-900/60 dark:bg-black/70 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#111a2e] rounded-2xl max-w-md w-full p-6 sm:p-7 shadow-2xl border-2 border-stone-900 dark:border-[#1e293b] animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between mb-5 pb-3 border-b-2 border-stone-200 dark:border-[#1e293b]">
              <h3 className="font-serif font-bold text-lg text-[#2D4A3E] dark:text-white">
                Modifier {editingHeader.type === 'day' ? 'le jour' : "l'heure"}
              </h3>
              <button
                onClick={() => setEditingHeader(null)}
                className="p-1.5 rounded-lg hover:bg-stone-100 dark:hover:bg-[#1e293b] text-stone-700 dark:text-slate-300 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-5">
              <div>
                <label className="block text-xs font-bold text-stone-800 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                  Nouveau nom *
                </label>
                <input
                  type="text"
                  value={editingHeader.value}
                  onChange={(e) => setEditingHeader({ ...editingHeader, value: e.target.value })}
                  className="w-full px-3.5 py-2.5 border-2 border-stone-400 dark:border-[#334155] rounded-xl focus:border-[#2D4A3E] dark:focus:border-blue-500 focus:outline-none text-sm font-bold text-stone-900 dark:text-white bg-stone-50 dark:bg-[#070a13]"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') saveHeaderEdit();
                  }}
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setEditingHeader(null)}
                  className="px-4 py-2.5 bg-stone-100 dark:bg-[#1e293b] hover:bg-stone-200 dark:hover:bg-[#283852] text-stone-800 dark:text-slate-200 font-bold text-xs rounded-xl transition-all cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  onClick={saveHeaderEdit}
                  className="px-5 py-2.5 bg-[#2D4A3E] dark:bg-emerald-600 hover:bg-[#20342b] dark:hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer"
                >
                  Enregistrer
                </button>
              </div>

              {editingHeader.type === 'hour' && (
                <div className="pt-4 border-t-2 border-stone-200 dark:border-[#1e293b] space-y-2">
                  <label className="block text-xs font-bold text-stone-800 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Gestion de la ligne
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        if (hours.length <= 1) {
                          setErrorMessage("Impossible de supprimer la ligne, il ne peut pas y avoir zéro ligne !");
                          setTimeout(() => setErrorMessage(null), 4000);
                          setEditingHeader(null);
                          return;
                        }
                        setShowDeleteConfirm(true);
                      }}
                      title="Supprimer toute la ligne"
                      className="px-3 py-2.5 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/50 text-rose-700 dark:text-rose-300 border-2 border-rose-300 dark:border-rose-800 font-bold text-xs rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-xs"
                    >
                      <Trash2 className="w-4 h-4" />
                      <span>Supprimer la ligne</span>
                    </button>
                    <button
                      type="button"
                      onClick={promptAddHourRow}
                      title="Ajouter une ligne en bas"
                      className="px-3 py-2.5 bg-stone-100 dark:bg-[#1e293b] hover:bg-stone-200 dark:hover:bg-[#283852] text-stone-800 dark:text-slate-200 border-2 border-stone-300 dark:border-[#334155] font-bold text-xs rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-xs"
                    >
                      <Plus className="w-4 h-4" />
                      <span>+ Ajouter ligne</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal for Adding Row */}
      {showAddConfirm && (
        <div className="fixed inset-0 z-60 bg-stone-900/70 dark:bg-black/70 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#111a2e] rounded-2xl max-w-sm w-full p-6 shadow-2xl border-2 border-stone-900 dark:border-[#1e293b] animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-[#2D4A3E]/10 dark:bg-emerald-950/50 flex items-center justify-center text-[#2D4A3E] dark:text-emerald-400 shrink-0">
                <Plus className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-serif font-bold text-base text-stone-900 dark:text-white">
                  Créer une nouvelle ligne ?
                </h3>
                <p className="text-xs text-stone-600 dark:text-slate-300 mt-0.5">
                  Une nouvelle ligne d'horaire sera ajoutée en dessous de celle-ci.
                </p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-stone-200 dark:border-[#1e293b]">
              <button
                type="button"
                onClick={() => setShowAddConfirm(false)}
                className="px-4 py-2 bg-stone-100 dark:bg-[#1e293b] hover:bg-stone-200 dark:hover:bg-[#283852] text-stone-700 dark:text-slate-300 font-bold text-xs rounded-xl transition-all cursor-pointer"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={confirmAddHourRow}
                className="px-4 py-2 bg-[#2D4A3E] dark:bg-emerald-600 hover:bg-[#20342b] dark:hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer"
              >
                Ajouter
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Success Toast Notification */}
      {successMessage && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[70] bg-[#2D4A3E] text-white px-5 py-3 rounded-2xl shadow-xl border-2 border-white flex items-center gap-2.5 animate-in fade-in slide-in-from-top-4 duration-300">
          <Check className="w-5 h-5 text-emerald-400" />
          <span className="text-xs sm:text-sm font-bold">{successMessage}</span>
        </div>
      )}

      {/* Error Toast Notification */}
      {errorMessage && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[70] bg-rose-600 text-white px-5 py-3 rounded-2xl shadow-xl border-2 border-white flex items-center gap-2.5 animate-in fade-in slide-in-from-top-4 duration-300">
          <X className="w-5 h-5 text-white shrink-0" />
          <span className="text-xs sm:text-sm font-bold">{errorMessage}</span>
        </div>
      )}

      {/* Confirmation Modal for Deleting Row */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-60 bg-stone-900/70 dark:bg-black/70 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#111a2e] rounded-2xl max-w-sm w-full p-6 shadow-2xl border-2 border-stone-900 dark:border-[#1e293b] animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-rose-100 dark:bg-rose-950/50 flex items-center justify-center text-rose-600 dark:text-rose-400 shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-serif font-bold text-base text-stone-900 dark:text-white">
                  Supprimer cette ligne ?
                </h3>
                <p className="text-xs text-stone-600 dark:text-slate-300 mt-0.5">
                  Toute la ligne et tout ce qu'elle contient (cours, notes, salles) seront définitivement effacés.
                </p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-stone-200 dark:border-[#1e293b]">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 bg-stone-100 dark:bg-[#1e293b] hover:bg-stone-200 dark:hover:bg-[#283852] text-stone-700 dark:text-slate-300 font-bold text-xs rounded-xl transition-all cursor-pointer"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={deleteHourRow}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer"
              >
                Confirmer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit/Add Modal */}
      {activeSlot && (
        <div className="fixed inset-0 z-50 bg-stone-900/60 dark:bg-black/70 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#111a2e] rounded-2xl max-w-md w-full p-6 shadow-2xl border-2 border-stone-900 dark:border-[#1e293b] animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between mb-4 pb-3 border-b-2 border-stone-200 dark:border-[#1e293b]">
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-[#2D4A3E] dark:text-emerald-400" />
                <h3 className="font-serif font-bold text-lg text-[#2D4A3E] dark:text-white">
                  {activeSlot.day} à {activeSlot.hour}
                </h3>
              </div>
              <button
                onClick={() => setActiveSlot(null)}
                className="p-1.5 rounded-lg hover:bg-stone-100 dark:hover:bg-[#1e293b] text-stone-700 dark:text-slate-300 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-stone-800 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                  Matière / Cours *
                </label>
                <input
                  type="text"
                  value={subjectInput}
                  onChange={(e) => setSubjectInput(e.target.value)}
                  placeholder="Ex: Mathématiques, Physique..."
                  className="w-full px-3.5 py-2.5 border-2 border-stone-400 dark:border-[#334155] rounded-xl focus:border-[#2D4A3E] dark:focus:border-blue-500 focus:outline-none text-sm font-bold text-stone-900 dark:text-white bg-stone-50 dark:bg-[#070a13]"
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-stone-800 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                    Salle (optionnel)
                  </label>
                  <input
                    type="text"
                    value={roomInput}
                    onChange={(e) => setRoomInput(e.target.value)}
                    placeholder="Ex: Salle 204"
                    className="w-full px-3.5 py-2.5 border-2 border-stone-400 dark:border-[#334155] rounded-xl focus:border-[#2D4A3E] dark:focus:border-blue-500 focus:outline-none text-sm font-bold text-stone-900 dark:text-white bg-stone-50 dark:bg-[#070a13]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-stone-800 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                    Note / Prof
                  </label>
                  <input
                    type="text"
                    value={noteInput}
                    onChange={(e) => setNoteInput(e.target.value)}
                    placeholder="Ex: M. Dupont"
                    className="w-full px-3.5 py-2.5 border-2 border-stone-400 dark:border-[#334155] rounded-xl focus:border-[#2D4A3E] dark:focus:border-blue-500 focus:outline-none text-sm font-bold text-stone-900 dark:text-white bg-stone-50 dark:bg-[#070a13]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-800 dark:text-slate-300 uppercase tracking-wider mb-2">
                  Couleur du créneau
                </label>
                <div className="flex items-center gap-2">
                  {COLORS.map((c) => {
                    const isSelected = selectedColor === c.bg || selectedColor?.split(' ')[0] === c.bg.split(' ')[0];
                    return (
                      <button
                        key={c.name}
                        type="button"
                        onClick={() => setSelectedColor(c.bg)}
                        className={`w-8 h-8 rounded-full ${c.bg} border-2 ${
                          isSelected ? 'border-stone-900 dark:border-white scale-110 shadow-md' : 'border-stone-300 dark:border-stone-600'
                        } transition-all cursor-pointer flex items-center justify-center`}
                      >
                        {isSelected && <Check className="w-4 h-4 text-stone-900 dark:text-white" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t-2 border-stone-200 dark:border-[#1e293b]">
                {scheduleData[`${activeSlot.day}_${activeSlot.hour}`] && (
                  <button
                    type="button"
                    onClick={() => {
                      setSubjectInput('');
                      setRoomInput('');
                      setNoteInput('');
                    }}
                    className="px-4 py-2 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/50 text-rose-700 dark:text-rose-300 font-bold text-xs rounded-xl border border-rose-300 dark:border-rose-800 transition-all flex items-center gap-1.5 cursor-pointer mr-auto"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Effacer</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setActiveSlot(null)}
                  className="px-4 py-2 bg-stone-100 dark:bg-[#1e293b] hover:bg-stone-200 dark:hover:bg-[#283852] text-stone-700 dark:text-slate-200 font-bold text-xs rounded-xl transition-all cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  onClick={saveEntry}
                  className="px-5 py-2 bg-[#2D4A3E] dark:bg-emerald-600 hover:bg-[#20342b] dark:hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer"
                >
                  Enregistrer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
