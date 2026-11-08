import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Plus, Trash2, Edit2, Clock, Calendar, Check, X, ZoomIn, ZoomOut, MapPin, User, Download, Loader2 } from 'lucide-react';
import { triggerDebouncedCloudBackup, getCurrentUserId } from '../services/userSync';
import { StudyCloudAPI } from '../services/api';
import { useScheduleConfig, useScheduleSlots } from '../hooks/useCloudQueries';
import { invalidateCloudQueries } from '../services/queryClient';
import { safeLocalStorageSet, safeLocalStorageGet } from '../utils/safeStorage';
import { exportScheduleToPdf } from '../utils/exportSchedulePdf';

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

// Décode une valeur potentiellement doublement encodée en tableau de chaînes (sinon fallback)
const toStringArray = (value: any, fallback: string[]): string[] => {
  let out = value;
  for (let i = 0; i < 3 && typeof out === 'string'; i++) {
    try { out = JSON.parse(out); } catch { return fallback; }
  }
  return Array.isArray(out) && out.length > 0 ? out.map(String) : fallback;
};

const toScheduleObject = (value: any): Record<string, ScheduleEntry> => {
  let out = value;
  for (let i = 0; i < 3 && typeof out === 'string'; i++) {
    try { out = JSON.parse(out); } catch { return {}; }
  }
  return out && typeof out === 'object' && !Array.isArray(out) ? out : {};
};

export const ScheduleMenuView: React.FC<ScheduleMenuViewProps> = ({ onBack }) => {
  const userId = getCurrentUserId() || (typeof window !== 'undefined' ? localStorage.getItem('unifolder_user_id') : null) || '';

  // Hooks TanStack Query pour la synchronisation Hono/D1
  const { data: serverConfig } = useScheduleConfig(userId);
  const { data: serverSlots } = useScheduleSlots(userId);

  const [scheduleData, setScheduleData] = useState<Record<string, ScheduleEntry>>(() => {
    try {
      return toScheduleObject(localStorage.getItem('user_schedule_data'));
    } catch (e) {}
    return {};
  });
  const [days, setDays] = useState<string[]>(() => {
    try {
      return toStringArray(localStorage.getItem('user_schedule_days'), DEFAULT_DAYS);
    } catch (e) {}
    return DEFAULT_DAYS;
  });
  const [hours, setHours] = useState<string[]>(() => {
    try {
      return toStringArray(localStorage.getItem('user_schedule_hours'), DEFAULT_HOURS);
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
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [zoomLevel, setZoomLevel] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('user_schedule_zoom');
      if (saved) return Number(saved);
    } catch (e) {}
    return 100;
  });

  const hasConfigLoadedRef = useRef(false);

  // Synchronisation réactive TanStack Query pour la configuration (jours, heures, zoom)
  useEffect(() => {
    if (serverConfig) {
      if (serverConfig.days_json) {
        const d = toStringArray(serverConfig.days_json, []);
        if (d.length > 0) {
          setDays(d);
          safeLocalStorageSet('user_schedule_days', d);
        }
      }
      if (serverConfig.hours_json) {
        const h = toStringArray(serverConfig.hours_json, []);
        if (h.length > 0) {
          setHours(h);
          safeLocalStorageSet('user_schedule_hours', h);
        }
      }
      if (serverConfig.zoom_level) {
        const z = Number(serverConfig.zoom_level);
        if (!isNaN(z) && z > 0) {
          setZoomLevel(z);
          safeLocalStorageSet('user_schedule_zoom', z.toString());
        }
      }
    }
    hasConfigLoadedRef.current = true;
  }, [serverConfig]);

  // Synchronisation réactive TanStack Query pour les créneaux réels (D1)
  useEffect(() => {
    if (serverSlots && Array.isArray(serverSlots)) {
      const mapped: Record<string, ScheduleEntry> = {};
      for (const s of serverSlots) {
        const k = `${s.day}_${s.hour_slot}`;
        mapped[k] = {
          subject: s.subject,
          room: s.room || '',
          note: s.note_or_teacher || '',
          color: s.color || COLORS[0].bg,
        };
      }
      setScheduleData(mapped);
      safeLocalStorageSet('user_schedule_data', mapped);
    }
  }, [serverSlots]);

  // Sauvegarde locale sécurisée
  useEffect(() => {
    safeLocalStorageSet('user_schedule_data', scheduleData);
    triggerDebouncedCloudBackup();
  }, [scheduleData]);

  useEffect(() => {
    safeLocalStorageSet('user_schedule_days', days);
    triggerDebouncedCloudBackup();
  }, [days]);

  useEffect(() => {
    safeLocalStorageSet('user_schedule_hours', hours);
    triggerDebouncedCloudBackup();
  }, [hours]);

  useEffect(() => {
    safeLocalStorageSet('user_schedule_zoom', zoomLevel.toString());
    triggerDebouncedCloudBackup();
  }, [zoomLevel]);

  // Synchronisation automatique de la configuration vers Cloudflare D1
  useEffect(() => {
    if (!hasConfigLoadedRef.current || !userId || userId === 'default-user') return;
    const timer = setTimeout(() => {
      StudyCloudAPI.updateScheduleConfig(userId, JSON.stringify(days), JSON.stringify(hours), zoomLevel)
        .then(() => invalidateCloudQueries.scheduleConfig())
        .catch(() => {});
    }, 800);
    return () => clearTimeout(timer);
  }, [days, hours, zoomLevel, userId]);

  useEffect(() => {
    const handleRestore = () => {
      try {
        setScheduleData(toScheduleObject(localStorage.getItem('user_schedule_data')));
        setDays(toStringArray(localStorage.getItem('user_schedule_days'), DEFAULT_DAYS));
        setHours(toStringArray(localStorage.getItem('user_schedule_hours'), DEFAULT_HOURS));
        const savedZoom = localStorage.getItem('user_schedule_zoom');
        setZoomLevel(savedZoom ? Number(savedZoom) : 100);
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

  const saveEntry = async () => {
    if (!activeSlot) return;
    const key = `${activeSlot.day}_${activeSlot.hour}`;
    const updated = { ...scheduleData };

    if (!subjectInput.trim()) {
      delete updated[key];
      setScheduleData(updated);
      safeLocalStorageSet('user_schedule_data', updated);
      setActiveSlot(null);
      try {
        await StudyCloudAPI.deleteScheduleSlot({ userId, day: activeSlot.day, hourSlot: activeSlot.hour });
        invalidateCloudQueries.scheduleSlots();
        setSuccessMessage('Créneau effacé avec succès !');
        setTimeout(() => setSuccessMessage(null), 3000);
      } catch (e) {
        console.error(e);
      }
      return;
    }

    const entry: ScheduleEntry = {
      subject: subjectInput.trim(),
      room: roomInput.trim(),
      note: noteInput.trim(),
      color: selectedColor
    };
    updated[key] = entry;
    setScheduleData(updated);
    safeLocalStorageSet('user_schedule_data', updated);
    setActiveSlot(null);

    try {
      const slotId = `${userId}-${activeSlot.day}-${activeSlot.hour}`;
      await StudyCloudAPI.addScheduleSlot({
        id: slotId,
        userId,
        day: activeSlot.day,
        hourSlot: activeSlot.hour,
        subject: entry.subject,
        room: entry.room,
        noteOrTeacher: entry.note,
        color: entry.color,
      });
      invalidateCloudQueries.scheduleSlots();
      setSuccessMessage('Créneau enregistré avec succès !');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (e) {
      console.error(e);
      setErrorMessage("Erreur lors de l'enregistrement du créneau");
      setTimeout(() => setErrorMessage(null), 4000);
    }
  };

  const deleteSlot = async () => {
    if (!activeSlot) return;
    const key = `${activeSlot.day}_${activeSlot.hour}`;
    const updated = { ...scheduleData };
    delete updated[key];
    setScheduleData(updated);
    safeLocalStorageSet('user_schedule_data', updated);
    setActiveSlot(null);

    try {
      await StudyCloudAPI.deleteScheduleSlot({ userId, day: activeSlot.day, hourSlot: activeSlot.hour });
      invalidateCloudQueries.scheduleSlots();
      setSuccessMessage('Créneau effacé avec succès !');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (e) {
      console.error(e);
    }
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

  const saveHeaderEdit = async () => {
    if (!editingHeader) return;
    const { type, index, value } = editingHeader;
    const trimmed = value.trim();
    if (!trimmed) {
      setEditingHeader(null);
      return;
    }

    if (type === 'day') {
      const oldDay = days[index];
      if (oldDay === trimmed) {
        setEditingHeader(null);
        return;
      }
      const newDays = [...days];
      newDays[index] = trimmed;
      setDays(newDays);

      // Migrer les créneaux dans l'état local et localStorage
      const updatedData = { ...scheduleData };
      const slotsToMigrate: any[] = [];
      hours.forEach((h) => {
        const oldKey = `${oldDay}_${h}`;
        const newKey = `${trimmed}_${h}`;
        if (updatedData[oldKey]) {
          const entry = updatedData[oldKey];
          updatedData[newKey] = entry;
          delete updatedData[oldKey];
          slotsToMigrate.push({
            id: `${userId}-${trimmed}-${h}`,
            userId,
            day: trimmed,
            hourSlot: h,
            subject: entry.subject,
            room: entry.room || '',
            noteOrTeacher: entry.note || '',
            color: entry.color,
            oldDay,
          });
        }
      });
      setScheduleData(updatedData);
      safeLocalStorageSet('user_schedule_days', newDays);
      safeLocalStorageSet('user_schedule_data', updatedData);

      // Synchroniser avec Cloudflare D1
      try {
        await StudyCloudAPI.updateScheduleConfig(userId, JSON.stringify(newDays), JSON.stringify(hours), zoomLevel);
        for (const s of slotsToMigrate) {
          await StudyCloudAPI.deleteScheduleSlot({ userId, day: s.oldDay, hourSlot: s.hourSlot });
          await StudyCloudAPI.addScheduleSlot(s);
        }
        invalidateCloudQueries.schedule();
        setSuccessMessage('Jour et créneaux mis à jour avec succès !');
        setTimeout(() => setSuccessMessage(null), 3000);
      } catch (err) {
        console.error(err);
      }
    } else {
      const oldHour = hours[index];
      if (oldHour === trimmed) {
        setEditingHeader(null);
        return;
      }
      const newHours = [...hours];
      newHours[index] = trimmed;
      setHours(newHours);

      // Migrer les créneaux vers la nouvelle heure
      const updatedData = { ...scheduleData };
      const slotsToMigrate: any[] = [];
      days.forEach((d) => {
        const oldKey = `${d}_${oldHour}`;
        const newKey = `${d}_${trimmed}`;
        if (updatedData[oldKey]) {
          const entry = updatedData[oldKey];
          updatedData[newKey] = entry;
          delete updatedData[oldKey];
          slotsToMigrate.push({
            id: `${userId}-${d}-${trimmed}`,
            userId,
            day: d,
            hourSlot: trimmed,
            subject: entry.subject,
            room: entry.room || '',
            noteOrTeacher: entry.note || '',
            color: entry.color,
            oldHour,
          });
        }
      });
      setScheduleData(updatedData);
      safeLocalStorageSet('user_schedule_hours', newHours);
      safeLocalStorageSet('user_schedule_data', updatedData);

      // Synchroniser avec Cloudflare D1
      try {
        await StudyCloudAPI.updateScheduleConfig(userId, JSON.stringify(days), JSON.stringify(newHours), zoomLevel);
        for (const s of slotsToMigrate) {
          await StudyCloudAPI.deleteScheduleSlot({ userId, day: s.day, hourSlot: s.oldHour });
          await StudyCloudAPI.addScheduleSlot(s);
        }
        invalidateCloudQueries.schedule();
        setSuccessMessage('Horaire et créneaux mis à jour avec succès !');
        setTimeout(() => setSuccessMessage(null), 3000);
      } catch (err) {
        console.error(err);
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
    safeLocalStorageSet('user_schedule_hours', newHours);

    StudyCloudAPI.updateScheduleConfig(userId, JSON.stringify(days), JSON.stringify(newHours), zoomLevel)
      .then(() => {
        invalidateCloudQueries.scheduleConfig();
        setSuccessMessage('Ligne ajoutée et enregistrée avec succès !');
        setTimeout(() => setSuccessMessage(null), 3000);
      })
      .catch(() => {});
  };

  const deleteHourRow = async () => {
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
    safeLocalStorageSet('user_schedule_hours', newHours);
    safeLocalStorageSet('user_schedule_data', updatedData);

    setShowDeleteConfirm(false);
    setEditingHeader(null);

    try {
      await StudyCloudAPI.updateScheduleConfig(userId, JSON.stringify(days), JSON.stringify(newHours), zoomLevel);
      await StudyCloudAPI.deleteScheduleSlot({ userId, hourSlot: hourToRemove });
      invalidateCloudQueries.schedule();
      setSuccessMessage('Ligne supprimée avec succès !');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      console.error(err);
    }
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
    safeLocalStorageSet('user_schedule_hours', newHours);

    const newIndex = index + 1;
    setEditingHeader({ type: 'hour', index: newIndex, value: '' });
    setShowAddConfirm(false);

    StudyCloudAPI.updateScheduleConfig(userId, JSON.stringify(days), JSON.stringify(newHours), zoomLevel)
      .then(() => {
        invalidateCloudQueries.scheduleConfig();
        setSuccessMessage('Une ligne a été ajoutée et enregistrée !');
        setTimeout(() => setSuccessMessage(null), 3000);
      })
      .catch(() => {});
  };

  const handleDownloadPdf = async () => {
    if (isGeneratingPdf) return;
    try {
      setIsGeneratingPdf(true);
      await exportScheduleToPdf({
        days,
        hours,
        scheduleData,
        title: 'Mon emploi du temps',
      });
      setSuccessMessage('Emploi du temps téléchargé en PDF avec succès !');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: any) {
      console.error('Erreur export PDF:', err);
      setErrorMessage(err?.message || "Impossible de générer le fichier PDF de l'emploi du temps.");
      setTimeout(() => setErrorMessage(null), 4000);
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  return (
    <div className="absolute inset-x-0 md:left-64 md:right-0 bottom-16 md:bottom-0 top-[62px] md:top-[66px] z-30 w-full md:w-[calc(100%-16rem)] bg-slate-50 dark:bg-[#070a13] text-slate-800 dark:text-slate-100 flex flex-col overflow-hidden transition-colors duration-300">
      {/* Top Header Bar */}
      <div className="flex-none px-3 sm:px-5 py-2.5 bg-white/95 dark:bg-[#0c1222]/95 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800/80 flex items-center justify-between z-40 shadow-xs">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold text-xs rounded-xl border border-slate-200 dark:border-slate-700 shadow-2xs transition-all cursor-pointer active:scale-95 shrink-0"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Retour</span>
        </button>
        <div className="text-center flex-1 mx-2 flex items-center justify-center gap-2 sm:gap-3 min-w-0">
          <h1 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white truncate">Mon emploi du temps</h1>
          <button
            type="button"
            onClick={handleDownloadPdf}
            disabled={isGeneratingPdf}
            className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 font-semibold text-xs rounded-xl border border-indigo-200/80 dark:border-indigo-800/60 shadow-2xs transition-all cursor-pointer active:scale-95 disabled:opacity-60 whitespace-nowrap shrink-0"
            title="Télécharger l'emploi du temps en PDF"
          >
            {isGeneratingPdf ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-600 dark:text-indigo-400" />
                <span className="hidden sm:inline">Génération...</span>
              </>
            ) : (
              <>
                <Download className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                <span className="hidden sm:inline">Télécharger</span>
                <span className="sm:hidden">PDF</span>
              </>
            )}
          </button>
        </div>
        <button
          onClick={addHourRow}
          className="flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-xl shadow-xs transition-all cursor-pointer whitespace-nowrap active:scale-95 shrink-0"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>+ Heure</span>
        </button>
      </div>

      {/* Scrollable Schedule Grid Container (Both Horizontal & Vertical) */}
      <div 
        className="flex-1 overflow-auto p-4 sm:p-6 pb-24 md:pb-8 touch-pan-x touch-pan-y"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onWheel={handleWheel}
      >
        <div 
          ref={tableRef}
          className="min-w-[900px] max-w-full mx-auto bg-white dark:bg-[#0c1222] rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden"
          style={{ zoom: `${zoomLevel}%` }}
        >
          {/* Header title inside the table area */}
          <div className="bg-slate-50 dark:bg-[#111a2e] py-3 px-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span className="font-bold text-sm text-slate-800 dark:text-white">Emploi du temps hebdomadaire</span>
              </div>
              {/* Zoom Controls */}
              <div className="flex items-center gap-1 bg-white dark:bg-[#070a13] border border-slate-200 dark:border-slate-800 rounded-xl p-1 shadow-2xs">
                <button
                  type="button"
                  onClick={() => changeZoom(-1)}
                  title="Dézoomer (réduire)"
                  className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setZoomLevel(100);
                    try { localStorage.setItem('user_schedule_zoom', '100'); } catch(e) {}
                  }}
                  title="Réinitialiser le zoom (100%)"
                  className="px-2 py-0.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition-colors cursor-pointer"
                >
                  {zoomLevel}%
                </button>
                <button
                  type="button"
                  onClick={() => changeZoom(1)}
                  title="Zoomer (agrandir)"
                  className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
            <span className="text-xs text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800/80 px-2.5 py-1 rounded-full font-medium">Glissez horizontalement et verticalement • Cliquez sur les jours et heures pour les renommer</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-xs sm:text-sm table-fixed">
            <thead>
              <tr className="bg-slate-100 dark:bg-[#162033] text-slate-800 dark:text-slate-200 border-b border-slate-200 dark:border-slate-800">
                {/* Diagonal Split Top-Left Corner Box */}
                <th className="relative border-r border-slate-200 dark:border-slate-800 w-32 h-14 p-0 overflow-hidden bg-slate-100 dark:bg-[#162033]">
                  <svg className="absolute inset-0 w-full h-full pointer-events-none" preserveAspectRatio="none" viewBox="0 0 100 100">
                    <line x1="0" y1="0" x2="100" y2="100" stroke="currentColor" className="text-slate-300 dark:text-slate-700" strokeWidth="1.5" />
                  </svg>
                  <div className="absolute top-1.5 right-2 text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                    Jours
                  </div>
                  <div className="absolute bottom-1.5 left-2 text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                    Heures
                  </div>
                </th>
                {days.map((day, dIdx) => (
                  <th
                    key={day}
                    onClick={() => handleHeaderClick('day', dIdx)}
                    className="py-3 px-3 font-semibold border-r border-slate-200 dark:border-slate-800 text-center uppercase tracking-wider last:border-r-0 cursor-pointer hover:bg-slate-200/60 dark:hover:bg-slate-800/60 transition-colors group relative text-xs"
                    title="Cliquer pour modifier ce jour"
                  >
                    <div className="flex items-center justify-center gap-1">
                      <span>{day}</span>
                      <Edit2 className="w-3 h-3 opacity-0 group-hover:opacity-100 text-slate-400 transition-opacity" />
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {hours.map((hour, hIdx) => (
                <tr key={`${hour}-${hIdx}`} className="border-b border-slate-200 dark:border-slate-800/80 hover:bg-slate-50/60 dark:hover:bg-slate-850/40 transition-colors">
                  <td
                    onClick={() => handleHeaderClick('hour', hIdx)}
                    className="py-3 px-2 font-semibold text-slate-700 dark:text-slate-300 bg-slate-50/80 dark:bg-[#0c1424] border-r border-slate-200 dark:border-slate-800 text-center whitespace-nowrap cursor-pointer hover:bg-slate-100 dark:hover:bg-[#162033] transition-colors group text-xs"
                    title="Cliquer pour modifier cette heure"
                  >
                    <div className="flex items-center justify-center gap-1">
                      <span>{hour}</span>
                      <Edit2 className="w-3 h-3 opacity-0 group-hover:opacity-100 text-slate-400 transition-opacity" />
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
                        className={`p-2 border-r border-slate-200 dark:border-slate-800/80 last:border-r-0 cursor-pointer transition-all hover:bg-slate-100/60 dark:hover:bg-slate-800/40 relative group align-top ${
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
                          <div className="w-full h-full flex items-center justify-center opacity-0 group-hover:opacity-40 text-slate-400 dark:text-slate-500">
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
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#111a2e] rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200 dark:border-slate-800 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-200 dark:border-slate-800">
              <h3 className="font-bold text-base text-slate-900 dark:text-white">
                Modifier {editingHeader.type === 'day' ? 'le jour' : "l'heure"}
              </h3>
              <button
                onClick={() => setEditingHeader(null)}
                className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white cursor-pointer transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                  Nouveau nom *
                </label>
                <input
                  type="text"
                  value={editingHeader.value}
                  onChange={(e) => setEditingHeader({ ...editingHeader, value: e.target.value })}
                  className="w-full px-3.5 py-2.5 border border-slate-300 dark:border-slate-700 rounded-xl focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none text-sm font-semibold text-slate-900 dark:text-white bg-slate-50 dark:bg-[#070a13]"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') saveHeaderEdit();
                  }}
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingHeader(null)}
                  className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold text-xs rounded-xl transition-all cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  onClick={saveHeaderEdit}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-xl shadow-xs transition-all cursor-pointer"
                >
                  Enregistrer
                </button>
              </div>

              {editingHeader.type === 'hour' && (
                <div className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-2">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
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
                      className="px-3 py-2 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/50 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 font-semibold text-xs rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-2xs"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Supprimer la ligne</span>
                    </button>
                    <button
                      type="button"
                      onClick={promptAddHourRow}
                      title="Ajouter une ligne en bas"
                      className="px-3 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 font-semibold text-xs rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-2xs"
                    >
                      <Plus className="w-3.5 h-3.5" />
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
        <div className="fixed inset-0 z-60 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#111a2e] rounded-2xl max-w-sm w-full p-6 shadow-xl border border-slate-200 dark:border-slate-800 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-emerald-50 dark:bg-emerald-950/50 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
                <Plus className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-base text-slate-900 dark:text-white">
                  Créer une nouvelle ligne ?
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Une nouvelle ligne d'horaire sera ajoutée en dessous de celle-ci.
                </p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setShowAddConfirm(false)}
                className="px-3.5 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold text-xs rounded-xl transition-all cursor-pointer"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={confirmAddHourRow}
                className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-xl shadow-xs transition-all cursor-pointer"
              >
                Ajouter
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Success Toast Notification */}
      {successMessage && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[70] bg-emerald-600 text-white px-4 py-2.5 rounded-2xl shadow-lg border border-emerald-500 flex items-center gap-2 animate-in fade-in slide-in-from-top-4 duration-300 pointer-events-none">
          <Check className="w-4 h-4 text-white shrink-0" />
          <span className="text-xs sm:text-sm font-semibold">{successMessage}</span>
        </div>
      )}

      {/* Error Toast Notification */}
      {errorMessage && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[70] bg-rose-600 text-white px-4 py-2.5 rounded-2xl shadow-lg border border-rose-500 flex items-center gap-2 animate-in fade-in slide-in-from-top-4 duration-300">
          <X className="w-4 h-4 text-white shrink-0" />
          <span className="text-xs sm:text-sm font-semibold">{errorMessage}</span>
        </div>
      )}

      {/* Confirmation Modal for Deleting Row */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-60 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#111a2e] rounded-2xl max-w-sm w-full p-6 shadow-xl border border-slate-200 dark:border-slate-800 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-rose-100 dark:bg-rose-950/50 flex items-center justify-center text-rose-600 dark:text-rose-400 shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-base text-slate-900 dark:text-white">
                  Supprimer cette ligne ?
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Toute la ligne et tout ce qu'elle contient (cours, notes, salles) seront définitivement effacés.
                </p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                className="px-3.5 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold text-xs rounded-xl transition-all cursor-pointer"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={deleteHourRow}
                className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs rounded-xl shadow-xs transition-all cursor-pointer"
              >
                Confirmer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit/Add Modal */}
      {activeSlot && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#111a2e] rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200 dark:border-slate-800 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <h3 className="font-bold text-base text-slate-900 dark:text-white">
                  {activeSlot.day} à {activeSlot.hour}
                </h3>
              </div>
              <button
                onClick={() => setActiveSlot(null)}
                className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white cursor-pointer transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                  Matière / Cours *
                </label>
                <input
                  type="text"
                  value={subjectInput}
                  onChange={(e) => setSubjectInput(e.target.value)}
                  placeholder="Ex: Mathématiques, Physique..."
                  className="w-full px-3.5 py-2.5 border border-slate-300 dark:border-slate-700 rounded-xl focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none text-sm font-semibold text-slate-900 dark:text-white bg-slate-50 dark:bg-[#070a13]"
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                    Salle (optionnel)
                  </label>
                  <input
                    type="text"
                    value={roomInput}
                    onChange={(e) => setRoomInput(e.target.value)}
                    placeholder="Ex: Salle 204"
                    className="w-full px-3.5 py-2.5 border border-slate-300 dark:border-slate-700 rounded-xl focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none text-sm font-semibold text-slate-900 dark:text-white bg-slate-50 dark:bg-[#070a13]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                    Note / Prof
                  </label>
                  <input
                    type="text"
                    value={noteInput}
                    onChange={(e) => setNoteInput(e.target.value)}
                    placeholder="Ex: M. Dupont"
                    className="w-full px-3.5 py-2.5 border border-slate-300 dark:border-slate-700 rounded-xl focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none text-sm font-semibold text-slate-900 dark:text-white bg-slate-50 dark:bg-[#070a13]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
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
                        className={`w-7 h-7 rounded-full ${c.bg} border-2 ${
                          isSelected ? 'border-slate-900 dark:border-white scale-110 shadow-sm' : 'border-slate-200 dark:border-slate-700'
                        } transition-all cursor-pointer flex items-center justify-center`}
                      >
                        {isSelected && <Check className="w-3.5 h-3.5 text-slate-900 dark:text-white" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-200 dark:border-slate-800">
                {scheduleData[`${activeSlot.day}_${activeSlot.hour}`] && (
                  <button
                    type="button"
                    onClick={deleteSlot}
                    className="px-3.5 py-2 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/50 text-rose-700 dark:text-rose-300 font-semibold text-xs rounded-xl border border-rose-200 dark:border-rose-800 transition-all flex items-center gap-1.5 cursor-pointer mr-auto"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Effacer</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setActiveSlot(null)}
                  className="px-3.5 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold text-xs rounded-xl transition-all cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  onClick={saveEntry}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-xl shadow-xs transition-all cursor-pointer"
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
