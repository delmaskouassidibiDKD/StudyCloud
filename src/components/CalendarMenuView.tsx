import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Plus, Calendar as CalendarIcon, Trash2, Clock, MapPin, X } from 'lucide-react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import frLocale from '@fullcalendar/core/locales/fr';
import { StudyCloudAPI } from '../services/api';

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

  // Save events to localStorage
  useEffect(() => {
    localStorage.setItem('unifolder_calendar_data', JSON.stringify(events));
  }, [events]);

  // Synchronisation avec Cloudflare D1
  useEffect(() => {
    const userId = localStorage.getItem('unifolder_user_id') || 'default-user';
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
      .catch(() => {});
  }, []);

  // Modal State for New Event
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
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

  const handleDateClick = (arg: { dateStr: string; allDay: boolean }) => {
    setNewEventDate(arg.dateStr.split('T')[0]);
    setNewEventAllDay(arg.allDay);
    setIsAddModalOpen(true);
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

  const handleCreateEvent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEventTitle.trim() || !newEventDate) return;

    let startIso = newEventDate;
    let endIso = newEventDate;

    if (!newEventAllDay) {
      startIso = `${newEventDate}T${newEventStartTime}:00`;
      endIso = `${newEventDate}T${newEventEndTime}:00`;
    }

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
    const userId = localStorage.getItem('unifolder_user_id') || 'default-user';
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
    }).catch(() => {});

    // Reset Form
    setNewEventTitle('');
    setNewEventDescription('');
    setNewEventLocation('');
    setIsAddModalOpen(false);
  };

  const handleDeleteEvent = (id: string) => {
    setEvents(prev => prev.filter(e => e.id !== id));
    StudyCloudAPI.deleteCalendarEvent(id).catch(() => {});
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
    <div className="absolute inset-x-0 bottom-0 top-[72px] md:top-[76px] md:left-64 z-30 w-full md:w-[calc(100%-16rem)] bg-[#F5F0E8] dark:bg-[#0b0f19] text-[#2D4A3E] dark:text-slate-100 px-2 sm:px-4 py-6 overflow-y-auto min-h-[calc(100vh-76px)] flex flex-col transition-colors duration-300">
      
      {/* Header Bar */}
      <div className="fixed top-[84px] md:top-[88px] left-4 right-4 md:left-[17.5rem] flex items-center justify-between z-40 pointer-events-none">
        <button
          onClick={onBack}
          className="pointer-events-auto flex items-center gap-1.5 px-3 py-1.5 bg-[#E8DFD0] hover:bg-[#D4C9B5] text-[#2D4A3E] dark:bg-[#1e293b] dark:text-white dark:border-[#334155] font-bold text-xs rounded-xl border-2 border-[#2D4A3E] shadow-[2px_2px_0px_0px_#1c1917] transition-all cursor-pointer active:translate-x-0.5 active:translate-y-0.5"
        >
          <ArrowLeft className="w-4 h-4 text-[#2D4A3E] dark:text-white" />
          <span>Retour</span>
        </button>

        <button
          onClick={() => {
            setNewEventDate(new Date().toISOString().split('T')[0]);
            setIsAddModalOpen(true);
          }}
          className="pointer-events-auto flex items-center gap-1.5 px-3 py-1.5 bg-[#18568A] hover:bg-[#13436D] text-white font-bold text-xs rounded-xl border-2 border-stone-900 dark:border-blue-500 shadow-[2px_2px_0px_0px_#1c1917] transition-all cursor-pointer active:translate-x-0.5 active:translate-y-0.5"
        >
          <Plus className="w-4 h-4" />
          <span>Créer un événement</span>
        </button>
      </div>

      {/* Main Container */}
      <div className="w-full max-w-6xl mx-auto pt-20 pb-12 flex-1 flex flex-col">
        
        {/* Title & Quick Jump Toolbar */}
        <div className="mb-4 bg-white/90 dark:bg-[#111a2e] backdrop-blur-sm p-4 rounded-2xl border-2 border-stone-900 dark:border-[#1e293b] shadow-[3px_3px_0px_0px_#1c1917] dark:shadow-none flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-[#18568A] text-white flex items-center justify-center border-2 border-stone-900 dark:border-[#334155] shadow-[2px_2px_0px_0px_#1c1917] dark:shadow-none">
              <CalendarIcon className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-serif font-bold text-[#2D4A3E] dark:text-white">Calendrier</h1>
              <p className="text-xs text-[#5C6B5A] dark:text-slate-400">Consultez et planifiez vos tâches & événements</p>
            </div>
          </div>

          {/* Jump to Decade / Year / Month controls */}
          <div className="flex items-center gap-2 flex-wrap justify-center">
            <span className="text-xs font-semibold text-stone-700 dark:text-slate-300 hidden md:inline">Accès rapide :</span>
            
            {/* Month Select */}
            <select
              value={jumpMonth}
              onChange={(e) => handleJumpToDate(jumpYear, parseInt(e.target.value))}
              className="px-2.5 py-1.5 bg-[#FDFBF7] dark:bg-[#070a13] text-stone-900 dark:text-white font-semibold text-xs rounded-xl border-2 border-stone-900 dark:border-[#334155] shadow-[1px_1px_0px_0px_#1c1917] dark:shadow-none focus:outline-none cursor-pointer"
            >
              {monthsNames.map((m, idx) => (
                <option key={idx} value={idx}>{m}</option>
              ))}
            </select>

            {/* Year Select */}
            <select
              value={jumpYear}
              onChange={(e) => handleJumpToDate(parseInt(e.target.value), jumpMonth)}
              className="px-2.5 py-1.5 bg-[#FDFBF7] dark:bg-[#070a13] text-stone-900 dark:text-white font-semibold text-xs rounded-xl border-2 border-stone-900 dark:border-[#334155] shadow-[1px_1px_0px_0px_#1c1917] dark:shadow-none focus:outline-none cursor-pointer"
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
              className="px-2.5 py-1.5 bg-[#E8DFD0] dark:bg-[#1e293b] hover:bg-[#D4C9B5] dark:hover:bg-[#283852] text-stone-900 dark:text-white font-bold text-xs rounded-xl border-2 border-stone-900 dark:border-[#334155] shadow-[1px_1px_0px_0px_#1c1917] dark:shadow-none transition-all cursor-pointer active:translate-x-0.5 active:translate-y-0.5"
            >
              Aujourd'hui
            </button>
          </div>
        </div>

        {/* FullCalendar Wrapper */}
        <div className="flex-1 bg-white dark:bg-[#070a13] p-2 sm:p-4 rounded-2xl border-2 border-stone-900 dark:border-[#1e293b] shadow-[4px_4px_0px_0px_#1c1917] dark:shadow-none overflow-hidden min-h-[550px] custom-fullcalendar-container">
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

      {/* MODAL: CREATE EVENT */}
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
              Nouvel événement
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
                  Enregistrer
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

            <div className="flex items-center justify-between pt-2 border-t border-stone-300">
              <button
                onClick={() => handleDeleteEvent(selectedEvent.id)}
                className="flex items-center gap-1 px-3 py-1.5 bg-red-100 hover:bg-red-200 text-red-700 font-bold text-xs rounded-xl border-2 border-stone-900 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Supprimer</span>
              </button>

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
