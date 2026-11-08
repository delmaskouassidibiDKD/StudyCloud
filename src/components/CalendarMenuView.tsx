import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Plus, Calendar as CalendarIcon, Trash2, Clock, MapPin, X, Edit2 } from 'lucide-react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import frLocale from '@fullcalendar/core/locales/fr';
import { StudyCloudAPI } from '../services/api';
import { triggerDebouncedCloudBackup, getCurrentUserId } from '../services/userSync';

interface CalendarEventItem {
  id: string;
  title: string;
  start: string; // YYYY-MM-DD or ISO string
  end?: string;
  color?: string;
  description?: string;
  location?: string;
  allDay?: boolean;
}

interface CalendarMenuViewProps {
  onBack: () => void;
}

const EVENT_COLORS = [
  { name: 'Bleu', value: '#2563EB', bg: 'bg-blue-600' },
  { name: 'Vert', value: '#16A34A', bg: 'bg-green-600' },
  { name: 'Rouge', value: '#DC2626', bg: 'bg-red-600' },
  { name: 'Orange', value: '#EA580C', bg: 'bg-orange-600' },
  { name: 'Violet', value: '#9333EA', bg: 'bg-purple-600' },
  { name: 'Rose', value: '#DB2777', bg: 'bg-pink-600' },
];

export const CalendarMenuView: React.FC<CalendarMenuViewProps> = ({ onBack }) => {
  const calendarRef = useRef<any>(null);

  // Initial events
  const defaultEvents: CalendarEventItem[] = [];

  // Load events from localStorage
  const [events, setEvents] = useState<CalendarEventItem[]>(() => {
    const saved = localStorage.getItem('unifolder_calendar_data');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { console.error(e); }
    }
    return defaultEvents;
  });

  // Save events to localStorage and trigger cloud backup
  useEffect(() => {
    localStorage.setItem('unifolder_calendar_data', JSON.stringify(events));
    triggerDebouncedCloudBackup();
  }, [events]);

  // Synchronisation avec Cloudflare D1
  useEffect(() => {
    const handleRestore = () => {
      try {
        const saved = localStorage.getItem('unifolder_calendar_data');
        if (saved) setEvents(JSON.parse(saved));
        else setEvents([]);
      } catch (e) {
        setEvents([]);
      }
    };
    window.addEventListener('unifolder_data_restored', handleRestore);

    const userId = getCurrentUserId() || (typeof localStorage !== 'undefined' ? localStorage.getItem('unifolder_user_id') : '') || '';
    if (!userId || userId === 'default-user') {
      setEvents([]);
      return;
    }
    StudyCloudAPI.getCalendarEvents(userId)
      .then((res: any) => {
        if (res && res.success && Array.isArray(res.data)) {
          const mapped: CalendarEventItem[] = res.data.map((row: any) => ({
            id: row.id,
            title: row.title,
            start: row.start_date,
            end: row.end_date || undefined,
            allDay: Boolean(row.all_day),
            color: row.color || '#2563EB',
            description: row.description || undefined,
            location: row.location || undefined,
          }));
          setEvents(mapped);
          localStorage.setItem('unifolder_calendar_data', JSON.stringify(mapped));
        }
      })
      .catch((err) => {
        console.warn('[Calendar] Erreur chargement événements D1:', err);
      });

    return () => window.removeEventListener('unifolder_data_restored', handleRestore);
  }, []);

  // Modal State for New / Edit Event
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [newEventTitle, setNewEventTitle] = useState('');
  const [newEventDate, setNewEventDate] = useState('');
  const [newEventStartTime, setNewEventStartTime] = useState('09:00');
  const [newEventEndTime, setNewEventEndTime] = useState('10:00');
  const [newEventAllDay, setNewEventAllDay] = useState(false);
  const [newEventColor, setNewEventColor] = useState('#2563EB');
  const [newEventDescription, setNewEventDescription] = useState('');
  const [newEventLocation, setNewEventLocation] = useState('');

  // Modal State for Viewing / Deleting Event
  const [selectedEvent, setSelectedEvent] = useState<CalendarEventItem | null>(null);

  // Quick Jump State
  const currentYear = new Date().getFullYear();
  const [jumpYear, setJumpYear] = useState(currentYear);
  const [jumpMonth, setJumpMonth] = useState(new Date().getMonth());

  // Generate Year Options (1970 to 2060)
  const yearsOptions = Array.from({ length: 91 }, (_, i) => 1970 + i);
  const monthsNames = [
    'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
    'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
  ];

  const handleOpenAddModal = (dateStr?: string, allDay = false) => {
    setEditingEventId(null);
    setNewEventTitle('');
    setNewEventDate(dateStr || new Date().toISOString().split('T')[0]);
    setNewEventStartTime('09:00');
    setNewEventEndTime('10:00');
    setNewEventAllDay(allDay);
    setNewEventColor('#2563EB');
    setNewEventDescription('');
    setNewEventLocation('');
    setIsAddModalOpen(true);
  };

  const handleOpenEditModal = (event: CalendarEventItem) => {
    setEditingEventId(event.id);
    setNewEventTitle(event.title);
    setNewEventDate(event.start.split('T')[0]);
    if (!event.allDay && event.start.includes('T')) {
      setNewEventStartTime(event.start.split('T')[1].substring(0, 5));
      if (event.end && event.end.includes('T')) {
        setNewEventEndTime(event.end.split('T')[1].substring(0, 5));
      } else {
        setNewEventEndTime('10:00');
      }
      setNewEventAllDay(false);
    } else {
      setNewEventStartTime('09:00');
      setNewEventEndTime('10:00');
      setNewEventAllDay(true);
    }
    setNewEventColor(event.color || '#2563EB');
    setNewEventDescription(event.description || '');
    setNewEventLocation(event.location || '');
    setSelectedEvent(null);
    setIsAddModalOpen(true);
  };

  const handleDateClick = (arg: { dateStr: string; allDay: boolean }) => {
    handleOpenAddModal(arg.dateStr.split('T')[0], arg.allDay);
  };

  const handleEventClick = (clickInfo: any) => {
    const eventObj = events.find(e => e.id === clickInfo.event.id);
    if (eventObj) {
      setSelectedEvent(eventObj);
    } else {
      setSelectedEvent({
        id: clickInfo.event.id,
        title: clickInfo.event.title,
        start: clickInfo.event.startStr,
        end: clickInfo.event.endStr,
        color: clickInfo.event.backgroundColor,
        description: clickInfo.event.extendedProps?.description,
        location: clickInfo.event.extendedProps?.location,
      });
    }
  };

  // Drag & drop ou redimensionnement sur le calendrier synchronisé en BDD D1
  const handleEventDrop = (info: any) => {
    const updatedId = info.event.id;
    const newStart = info.event.startStr;
    const newEnd = info.event.endStr || undefined;
    const isAllDay = Boolean(info.event.allDay);

    const userId = getCurrentUserId() || (typeof localStorage !== 'undefined' ? localStorage.getItem('unifolder_user_id') : '') || '';
    if (!userId || userId === 'default-user') return;
    setEvents(prev => prev.map(e => {
      if (e.id === updatedId) {
        const updated = {
          ...e,
          start: newStart,
          end: newEnd,
          allDay: isAllDay,
        };
        StudyCloudAPI.createCalendarEvent({
          id: updated.id,
          userId,
          title: updated.title,
          startDate: updated.start,
          endDate: updated.end || null,
          allDay: updated.allDay ? 1 : 0,
          color: updated.color || '#2563EB',
          description: updated.description || '',
          location: updated.location || '',
        }).catch((err) => {
          console.warn('[Calendar] Erreur déplacement événement D1:', err);
        });
        return updated;
      }
      return e;
    }));
  };

  const handleEventResize = (info: any) => {
    handleEventDrop(info);
  };

  const handleCreateEvent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEventTitle.trim() || !newEventDate) return;

    let startIso = newEventDate;
    let endIso = newEventDate;

    if (!newEventAllDay) {
      startIso = `${newEventDate}T${newEventStartTime}:00`;
      endIso = `${newEventDate}T${newEventEndTime}:00`;
    }

    const userId = getCurrentUserId() || (typeof localStorage !== 'undefined' ? localStorage.getItem('unifolder_user_id') : '') || '';

    if (editingEventId) {
      // Modification d'un événement existant
      const updatedItem: CalendarEventItem = {
        id: editingEventId,
        title: newEventTitle.trim(),
        start: startIso,
        end: newEventAllDay ? undefined : endIso,
        allDay: newEventAllDay,
        color: newEventColor,
        description: newEventDescription.trim() || undefined,
        location: newEventLocation.trim() || undefined,
      };
      setEvents(prev => prev.map(ev => ev.id === editingEventId ? updatedItem : ev));
      StudyCloudAPI.createCalendarEvent({
        id: updatedItem.id,
        userId,
        title: updatedItem.title,
        startDate: updatedItem.start,
        endDate: updatedItem.end || null,
        allDay: updatedItem.allDay ? 1 : 0,
        color: updatedItem.color,
        description: updatedItem.description || '',
        location: updatedItem.location || '',
      }).catch((err) => {
        console.warn('[Calendar] Erreur mise à jour événement D1:', err);
      });
    } else {
      // Création d'un nouvel événement
      const created: CalendarEventItem = {
        id: 'event-' + Date.now(),
        title: newEventTitle.trim(),
        start: startIso,
        end: newEventAllDay ? undefined : endIso,
        allDay: newEventAllDay,
        color: newEventColor,
        description: newEventDescription.trim() || undefined,
        location: newEventLocation.trim() || undefined,
      };
      setEvents(prev => [...prev, created]);
      StudyCloudAPI.createCalendarEvent({
        id: created.id,
        userId,
        title: created.title,
        startDate: created.start,
        endDate: created.end || null,
        allDay: created.allDay ? 1 : 0,
        color: created.color,
        description: created.description || '',
        location: created.location || '',
      }).catch((err) => {
        console.warn('[Calendar] Erreur création événement D1:', err);
      });
    }

    // Reset Form
    setNewEventTitle('');
    setNewEventDescription('');
    setNewEventLocation('');
    setEditingEventId(null);
    setIsAddModalOpen(false);
  };

  const handleDeleteEvent = (id: string) => {
    setEvents(prev => prev.filter(e => e.id !== id));
    StudyCloudAPI.deleteCalendarEvent(id).catch((err) => {
      console.warn('[Calendar] Erreur suppression événement D1:', err);
    });
    setSelectedEvent(null);
  };

  const handleJumpToDate = (year: number, month: number) => {
    setJumpYear(year);
    setJumpMonth(month);
    if (calendarRef.current) {
      const calendarApi = calendarRef.current.getApi();
      const monthStr = (month + 1).toString().padStart(2, '0');
      calendarApi.gotoDate(`${year}-${monthStr}-01`);
    }
  };

  return (
    <div className="absolute inset-x-0 bottom-16 md:bottom-0 top-[62px] md:top-[66px] md:left-64 z-30 w-full md:w-[calc(100%-16rem)] bg-slate-50 dark:bg-[#070a13] text-slate-800 dark:text-slate-100 overflow-y-auto flex flex-col transition-colors duration-300">
      
      {/* Modern Sticky Header */}
      <div className="sticky top-0 z-40 px-3 sm:px-6 py-2.5 bg-white/95 dark:bg-[#0c1222]/95 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800/80 flex items-center justify-between shadow-xs">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold text-xs rounded-xl border border-slate-200 dark:border-slate-700 shadow-2xs transition-all cursor-pointer active:scale-95"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Retour</span>
        </button>

        <h1 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white tracking-tight">
          Calendrier
        </h1>

        <button
          onClick={() => handleOpenAddModal()}
          className="flex items-center gap-1.5 px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs rounded-xl shadow-xs transition-all cursor-pointer active:scale-95 whitespace-nowrap"
        >
          <Plus className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Créer un événement</span>
          <span className="sm:hidden">Créer</span>
        </button>
      </div>

      {/* Main Container */}
      <div className="w-full max-w-6xl mx-auto px-3 sm:px-6 py-4 pb-24 md:pb-8 flex-1 flex flex-col">
        
        {/* Title & Quick Jump Toolbar */}
        <div className="mb-4 bg-white dark:bg-[#0c1222] p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center border border-indigo-500/20 shadow-2xs">
              <CalendarIcon className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">Planification</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">Consultez et planifiez vos événements et échéances</p>
            </div>
          </div>

          {/* Jump to Decade / Year / Month controls */}
          <div className="flex items-center gap-2 flex-wrap justify-center">
            <span className="text-xs font-semibold text-slate-600 dark:text-slate-300 hidden md:inline">Accès rapide :</span>
            
            {/* Month Select */}
            <select
              value={jumpMonth}
              onChange={(e) => handleJumpToDate(jumpYear, parseInt(e.target.value))}
              className="px-2.5 py-1.5 bg-slate-50 dark:bg-[#070a13] text-slate-800 dark:text-white font-semibold text-xs rounded-xl border border-slate-200 dark:border-slate-700 shadow-2xs focus:border-indigo-500 focus:outline-none cursor-pointer"
            >
              {monthsNames.map((m, idx) => (
                <option key={idx} value={idx}>{m}</option>
              ))}
            </select>

            {/* Year Select */}
            <select
              value={jumpYear}
              onChange={(e) => handleJumpToDate(parseInt(e.target.value), jumpMonth)}
              className="px-2.5 py-1.5 bg-slate-50 dark:bg-[#070a13] text-slate-800 dark:text-white font-semibold text-xs rounded-xl border border-slate-200 dark:border-slate-700 shadow-2xs focus:border-indigo-500 focus:outline-none cursor-pointer"
            >
              {yearsOptions.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>

            {/* Reset Today Button */}
            <button
              onClick={() => {
                const today = new Date();
                handleJumpToDate(today.getFullYear(), today.getMonth());
              }}
              className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold text-xs rounded-xl border border-slate-200 dark:border-slate-700 shadow-2xs transition-all cursor-pointer active:scale-95"
            >
              Aujourd'hui
            </button>
          </div>
        </div>

        {/* FullCalendar Wrapper */}
        <div className="flex-1 bg-white dark:bg-[#0c1222] p-2 sm:p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden min-h-[550px] custom-fullcalendar-container">
          <FullCalendar
            ref={calendarRef}
            plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
            initialView="dayGridMonth"
            locales={[frLocale]}
            locale="fr"
            headerToolbar={{
              left: 'prev,next today',
              center: 'title',
              right: 'dayGridMonth,timeGridWeek,timeGridDay'
            }}
            events={events}
            editable={true}
            selectable={true}
            selectMirror={true}
            dayMaxEvents={true}
            dateClick={handleDateClick}
            eventClick={handleEventClick}
            eventDrop={handleEventDrop}
            eventResize={handleEventResize}
            height="100%"
            buttonText={{
              today: "Aujourd'hui",
              month: 'Mois',
              week: 'Semaine',
              day: 'Jour'
            }}
          />
        </div>
      </div>

      {/* MODAL: CREATE / EDIT EVENT */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-[#FDFBF7] border-3 border-stone-900 rounded-2xl shadow-[6px_6px_0px_0px_#1c1917] w-full max-w-md p-5 text-stone-900 relative">
            
            <button
              onClick={() => setIsAddModalOpen(false)}
              className="absolute top-3 right-3 p-1.5 text-stone-600 hover:text-stone-900 bg-stone-200 hover:bg-stone-300 rounded-xl border-2 border-stone-900 transition-all cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <h3 className="text-lg font-serif font-bold text-[#2D4A3E] mb-4 flex items-center gap-2">
              <CalendarIcon className="w-5 h-5 text-[#18568A]" />
              {editingEventId ? "Modifier l'événement" : 'Nouvel événement'}
            </h3>

            <form onSubmit={handleCreateEvent} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">Titre de l'événement *</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Examen, Réunion, Anniversaire..."
                  value={newEventTitle}
                  onChange={(e) => setNewEventTitle(e.target.value)}
                  className="w-full px-3 py-2 bg-white border-2 border-stone-900 rounded-xl font-medium text-sm focus:outline-none focus:ring-2 focus:ring-[#18568A]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">Date *</label>
                <input
                  type="date"
                  required
                  value={newEventDate}
                  onChange={(e) => setNewEventDate(e.target.value)}
                  className="w-full px-3 py-2 bg-white border-2 border-stone-900 rounded-xl font-medium text-sm focus:outline-none"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="allDayCheck"
                  checked={newEventAllDay}
                  onChange={(e) => setNewEventAllDay(e.target.checked)}
                  className="w-4 h-4 accent-[#18568A] cursor-pointer"
                />
                <label htmlFor="allDayCheck" className="text-xs font-bold text-stone-800 cursor-pointer">
                  Toute la journée
                </label>
              </div>

              {!newEventAllDay && (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-bold text-stone-700 mb-1">Heure de début</label>
                    <input
                      type="time"
                      value={newEventStartTime}
                      onChange={(e) => setNewEventStartTime(e.target.value)}
                      className="w-full px-3 py-1.5 bg-white border-2 border-stone-900 rounded-xl font-medium text-xs focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-stone-700 mb-1">Heure de fin</label>
                    <input
                      type="time"
                      value={newEventEndTime}
                      onChange={(e) => setNewEventEndTime(e.target.value)}
                      className="w-full px-3 py-1.5 bg-white border-2 border-stone-900 rounded-xl font-medium text-xs focus:outline-none"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">Couleur</label>
                <div className="flex items-center gap-2">
                  {EVENT_COLORS.map(c => (
                    <button
                      key={c.value}
                      type="button"
                      onClick={() => setNewEventColor(c.value)}
                      className={`w-7 h-7 rounded-full border-2 border-stone-900 cursor-pointer transition-transform ${c.bg} ${newEventColor === c.value ? 'scale-125 ring-2 ring-stone-900' : 'opacity-80 hover:opacity-100'}`}
                      title={c.name}
                    />
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">Lieu (optionnel)</label>
                <input
                  type="text"
                  placeholder="Ex: Amphi 3, En ligne..."
                  value={newEventLocation}
                  onChange={(e) => setNewEventLocation(e.target.value)}
                  className="w-full px-3 py-1.5 bg-white border-2 border-stone-900 rounded-xl font-medium text-xs focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">Description (optionnelle)</label>
                <textarea
                  rows={2}
                  placeholder="Détails supplémentaires..."
                  value={newEventDescription}
                  onChange={(e) => setNewEventDescription(e.target.value)}
                  className="w-full px-3 py-1.5 bg-white border-2 border-stone-900 rounded-xl font-medium text-xs focus:outline-none resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-3 py-1.5 bg-stone-200 hover:bg-stone-300 text-stone-800 font-bold text-xs rounded-xl border-2 border-stone-900 cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-[#18568A] hover:bg-[#13436D] text-white font-bold text-xs rounded-xl border-2 border-stone-900 shadow-[2px_2px_0px_0px_#1c1917] cursor-pointer"
                >
                  {editingEventId ? 'Mettre à jour' : 'Enregistrer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: VIEW / DELETE EVENT DETAILS */}
      {selectedEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-[#FDFBF7] border-3 border-stone-900 rounded-2xl shadow-[6px_6px_0px_0px_#1c1917] w-full max-w-sm p-5 text-stone-900 relative">
            
            <button
              onClick={() => setSelectedEvent(null)}
              className="absolute top-3 right-3 p-1.5 text-stone-600 hover:text-stone-900 bg-stone-200 hover:bg-stone-300 rounded-xl border-2 border-stone-900 transition-all cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-2 mb-3">
              <div
                className="w-4 h-4 rounded-full border border-stone-900"
                style={{ backgroundColor: selectedEvent.color || '#2563EB' }}
              />
              <h3 className="text-lg font-serif font-bold text-[#2D4A3E]">
                {selectedEvent.title}
              </h3>
            </div>

            <div className="space-y-2 text-xs text-stone-700 mb-5">
              <div className="flex items-center gap-1.5 font-medium">
                <Clock className="w-4 h-4 text-stone-500" />
                <span>
                  {new Date(selectedEvent.start).toLocaleDateString('fr-FR', {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric'
                  })}
                  {!selectedEvent.allDay && selectedEvent.start.includes('T') && (
                    ` à ${selectedEvent.start.split('T')[1].substring(0, 5)}`
                  )}
                </span>
              </div>

              {selectedEvent.location && (
                <div className="flex items-center gap-1.5 font-medium">
                  <MapPin className="w-4 h-4 text-stone-500" />
                  <span>{selectedEvent.location}</span>
                </div>
              )}

              {selectedEvent.description && (
                <div className="p-2.5 bg-white border-2 border-stone-900 rounded-xl mt-2 text-stone-800">
                  {selectedEvent.description}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-stone-300 gap-2">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleDeleteEvent(selectedEvent.id)}
                  className="flex items-center gap-1 px-3 py-1.5 bg-red-100 hover:bg-red-200 text-red-700 font-bold text-xs rounded-xl border-2 border-stone-900 cursor-pointer transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Supprimer</span>
                </button>

                <button
                  onClick={() => handleOpenEditModal(selectedEvent)}
                  className="flex items-center gap-1 px-3 py-1.5 bg-[#18568A] hover:bg-[#13436D] text-white font-bold text-xs rounded-xl border-2 border-stone-900 shadow-[1px_1px_0px_0px_#1c1917] cursor-pointer transition-all active:translate-x-0.5 active:translate-y-0.5"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  <span>Modifier</span>
                </button>
              </div>

              <button
                onClick={() => setSelectedEvent(null)}
                className="px-4 py-1.5 bg-[#E8DFD0] hover:bg-[#D4C9B5] text-stone-900 font-bold text-xs rounded-xl border-2 border-stone-900 cursor-pointer"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Global CSS Customizations for FullCalendar */}
      <style>{`
        .custom-fullcalendar-container .fc {
          font-family: inherit;
        }
        .custom-fullcalendar-container .fc-toolbar {
          flex-wrap: wrap;
          gap: 0.5rem;
          margin-bottom: 0.75rem !important;
        }
        .custom-fullcalendar-container .fc-toolbar-title {
          font-family: serif;
          font-weight: 700;
          color: #2D4A3E;
          font-size: 1.25rem !important;
        }
        .custom-fullcalendar-container .fc-button {
          background-color: #E8DFD0 !important;
          color: #1c1917 !important;
          border: 2px solid #1c1917 !important;
          border-radius: 0.75rem !important;
          font-weight: 700 !important;
          font-size: 0.75rem !important;
          padding: 0.35rem 0.65rem !important;
          box-shadow: 2px 2px 0px 0px #1c1917 !important;
          text-transform: capitalize !important;
          opacity: 1 !important;
        }
        .custom-fullcalendar-container .fc-button:hover {
          background-color: #D4C9B5 !important;
        }
        .custom-fullcalendar-container .fc-button-active {
          background-color: #18568A !important;
          color: #ffffff !important;
        }
        .custom-fullcalendar-container .fc-daygrid-day-number {
          font-weight: 700;
          color: #2D4A3E;
          text-decoration: none !important;
          font-size: 0.8rem;
          padding: 4px;
        }
        .custom-fullcalendar-container .fc-col-header-cell-cushion {
          font-weight: 700;
          color: #18568A;
          text-decoration: none !important;
          font-size: 0.85rem;
          text-transform: uppercase;
        }
        .custom-fullcalendar-container .fc-day-today {
          background-color: #FEF3C7 !important;
        }
        .custom-fullcalendar-container .fc-event {
          border-radius: 6px !important;
          font-weight: 600 !important;
          font-size: 0.75rem !important;
          padding: 2px 4px !important;
          cursor: pointer !important;
          border: 1px solid #1c1917 !important;
          box-shadow: 1px 1px 0px 0px #1c1917 !important;
        }

        /* Mode Sombre Spécifique pour FullCalendar */
        .dark .custom-fullcalendar-container .fc-toolbar-title {
          color: #ffffff !important;
        }
        .dark .custom-fullcalendar-container .fc-button {
          background-color: #1e293b !important;
          color: #ffffff !important;
          border: 2px solid #334155 !important;
          box-shadow: none !important;
        }
        .dark .custom-fullcalendar-container .fc-button:hover {
          background-color: #283852 !important;
        }
        .dark .custom-fullcalendar-container .fc-button-active {
          background-color: #2563eb !important;
          color: #ffffff !important;
          border-color: #3b82f6 !important;
        }
        .dark .custom-fullcalendar-container .fc-daygrid-day-number {
          color: #f8fafc !important;
        }
        .dark .custom-fullcalendar-container .fc-col-header-cell-cushion {
          color: #60a5fa !important;
        }
        .dark .custom-fullcalendar-container .fc-day-today {
          background-color: #162a45 !important;
        }
        .dark .custom-fullcalendar-container .fc-theme-standard td,
        .dark .custom-fullcalendar-container .fc-theme-standard th {
          border-color: #1e293b !important;
        }
        .dark .custom-fullcalendar-container .fc-scrollgrid {
          border-color: #1e293b !important;
        }
        .dark .custom-fullcalendar-container .fc-daygrid-day {
          background-color: #070a13;
        }
      `}</style>

    </div>
  );
};
