/**
 * StudyCloud - Service de Synchronisation et d'Isolation des Données Utilisateur
 * Assure que toutes les données (Matières, Fichiers, Notes, Emploi du temps, Notes/Bulletins, Alarmes)
 * sont strictement rattachées à l'identifiant de l'utilisateur connecté (user_id / Cloudflare D1).
 */

import { StudyCloudAPI } from './api';
import { safeLocalStorageSet } from '../utils/safeStorage';

export function getCurrentUserId(): string | null {
  return localStorage.getItem('unifolder_user_id') || null;
}

export function isUserLoggedIn(): boolean {
  return Boolean(localStorage.getItem('sc_auth_token') && localStorage.getItem('unifolder_user_id'));
}

/**
 * Nettoyage complet du cache de session locale lors de la déconnexion
 * pour empêcher qu'un autre utilisateur se connectant sur le même appareil ne voie ces données.
 */
export function clearUserDataOnLogout(): void {
  const userKeys = [
    'sc_auth_token',
    'sc_auth_user',
    'sc_last_active_at',
    'sc_idb_has_data',
    'unifolder_user_id',
    'unifolder_user_name',
    'unifolder_user_school',
    'unifolder_user_filiere',
    'unifolder_user_email',
    'unifolder_user_country',
    'unifolder_user_phone',
    'unifolder_user_avatar',
    'unifolder_is_student',
    'unifolder_user_profession',
    'unifolder_saved_matieres',
    'unifolder_keep_notes',
    'user_schedule_data',
    'user_schedule_days',
    'user_schedule_hours',
    'user_schedule_zoom',
    'unifolder_grades_data',
    'user_grades_trimesters_data',
    'user_grades_standard_scale',
    'unifolder_alarms',
    'unifolder_clock_alarms',
    'unifolder_user_files',
    'unifolder_files',
    'unifolder_files_menu_items',
    'unifolder_imported_files',
    'unifolder_matiere_files',
    'unifolder_last_imported_id',
    'unifolder_importing_ids',
    'unifolder_shared_folders',
    'unifolder_shares',
    'unifolder_published_products',
    'unifolder_cart',
    'unifolder_cart_items',
    'unifolder_calendar_data',
    'unifolder_history_files',
    'studycloud_last_sync',
    'unifolder_view_mode',
    'studycloud_recent_files',
    'studycloud_deleted_recent_ids',
    'studycloud_deleted_file_ids',
    'studycloud_classeur_3d_folders',
    'studycloud_folder_files_map',
    'studycloud_documents_files',
    'studycloud_images_files',
    'studycloud_videos_files',
    'studycloud_audio_files',
    'studycloud_trash_files',
    'studycloud_secure_files',
    'studycloud_secure_folder_files',
    'studycloud_downloaded_items',
    'studycloud_downloaded_files',
    'studycloud_pinned_ids',
    'studycloud_favorites_ids',
    'studycloud_dashboard_wallpaper',
    'studycloud_dashboard_wallpaper_meta',
    'studycloud_recent_searches',
  ];

  // Nettoyer également toutes les clés dynamiques commençant par unifolder_ ou studycloud_
  for (let i = localStorage.length - 1; i >= 0; i--) {
    const key = localStorage.key(i);
    if (
      key && (
        userKeys.includes(key) ||
        key.startsWith('unifolder_') ||
        key.startsWith('studycloud_') ||
        key.startsWith('sc_onb_') ||
        key.startsWith('sc_resend_')
      )
    ) {
      localStorage.removeItem(key);
    }
  }

  // Notifier tous les composants React montés
  window.dispatchEvent(new Event('unifolder_files_updated'));
  window.dispatchEvent(new Event('unifolder_data_restored'));
}

/**
 * Restaure automatiquement les données de l'utilisateur depuis Cloudflare D1
 * dès qu'il se connecte ou valide sa session.
 */
export async function restoreUserDataFromCloud(userId: string): Promise<boolean> {
  if (!userId || userId === 'default-user') return false;
  try {
    const res = await StudyCloudAPI.restoreCloud(userId);
    if (res && res.success && res.data) {
      const d = res.data;

      // 1. Profil
      if (d.user) {
        if (d.user.name) localStorage.setItem('unifolder_user_name', d.user.name);
        if (d.user.school) localStorage.setItem('unifolder_user_school', d.user.school);
        if (d.user.filiere) localStorage.setItem('unifolder_user_filiere', d.user.filiere);
        if (d.user.email) localStorage.setItem('unifolder_user_email', d.user.email);
        if (d.user.country) localStorage.setItem('unifolder_user_country', d.user.country);
        if (d.user.avatar_url) localStorage.setItem('unifolder_user_avatar', d.user.avatar_url);
      }

      // 2. Matières
      if (Array.isArray(d.matieres)) {
        const mappedMatieres = d.matieres.map((m: any) => ({
          id: m.id,
          name: m.name,
          coefficient: String(m.coefficient || 1),
          color: m.color || '#EA580C',
        }));
        safeLocalStorageSet('unifolder_saved_matieres', mappedMatieres);
      }

      // 3. Fichiers & Documents ("Mes fichiers")
      if (Array.isArray(d.files)) {
        safeLocalStorageSet('unifolder_user_files', d.files);
        safeLocalStorageSet('unifolder_files_menu_items', d.files);
      }

      // 4. Notes Keep
      if (Array.isArray(d.notes)) {
        safeLocalStorageSet('unifolder_keep_notes', d.notes);
      }

      // 5. Emploi du temps
      if (d.scheduleConfig) {
        if (d.scheduleConfig.days_json) safeLocalStorageSet('user_schedule_days', d.scheduleConfig.days_json);
        if (d.scheduleConfig.hours_json) safeLocalStorageSet('user_schedule_hours', d.scheduleConfig.hours_json);
        if (d.scheduleConfig.zoom_level) safeLocalStorageSet('user_schedule_zoom', String(d.scheduleConfig.zoom_level));
      }
      if (Array.isArray(d.scheduleSlots)) {
        const mappedSchedule: Record<string, any> = {};
        for (const s of d.scheduleSlots) {
          const k = `${s.day}_${s.hour_slot}`;
          mappedSchedule[k] = {
            subject: s.subject,
            room: s.room || '',
            note: s.note_or_teacher || '',
            color: s.color || 'bg-emerald-100 dark:bg-emerald-950/80',
          };
        }
        safeLocalStorageSet('user_schedule_data', mappedSchedule);
      }

      // Calendrier des événements
      if (Array.isArray(d.calendarEvents)) {
        const mappedEvents = d.calendarEvents.map((row: any) => ({
          id: row.id,
          title: row.title,
          start: row.start_date,
          end: row.end_date || undefined,
          allDay: Boolean(row.all_day),
          color: row.color || '#2563EB',
          description: row.description || undefined,
          location: row.location || undefined,
        }));
        localStorage.setItem('unifolder_calendar_data', JSON.stringify(mappedEvents));
      }

      // 6. Carnet de notes & Moyennes (les notes sont stockées directement dans la base D1)
      if (Array.isArray(d.grades)) {
        try {
          localStorage.removeItem('user_grades_trimesters_data');
          localStorage.removeItem('unifolder_grades_data');
        } catch (e) {}
      }

      // 7. Alarmes
      if (Array.isArray(d.alarms)) {
        const normalizedAlarms = d.alarms.map((a: any) => {
          let days = ['Tous les jours'];
          if (a.days && Array.isArray(a.days)) days = a.days;
          else if (a.days_json) {
            try {
              days = typeof a.days_json === 'string' ? JSON.parse(a.days_json) : a.days_json;
            } catch (e) {}
          }
          return {
            id: a.id,
            time: a.time,
            label: a.label || 'Alarme',
            active: a.active !== undefined ? Boolean(a.active) : Boolean(a.is_active),
            days: Array.isArray(days) ? days : ['Tous les jours']
          };
        });
        localStorage.setItem('unifolder_alarms', JSON.stringify(normalizedAlarms));
        localStorage.setItem('unifolder_clock_alarms', JSON.stringify(normalizedAlarms));
      }

      // 8. Contenus Générés IA (Créations & Studio)
      if (Array.isArray(d.aiContents) && d.aiContents.length > 0) {
        const mappedAiHistory = d.aiContents.map((item: any) => ({
          id: item.id,
          toolType: item.tool_type,
          title: item.title,
          dateStr: item.created_at ? new Date(item.created_at).toLocaleDateString('fr-FR') : "Récemment",
          colorClass: 'text-orange-300',
          desc: item.source_file_name ? `Généré pour "${item.source_file_name}"` : 'Création IA',
          pinned: Boolean(item.is_pinned),
          contentJson: item.content_json ? (typeof item.content_json === 'string' ? JSON.parse(item.content_json) : item.content_json) : null,
          sourceFileName: item.source_file_name,
        }));
        localStorage.setItem('unifolder_ai_history', JSON.stringify(mappedAiHistory));
      }

      const nowStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' - ' + new Date().toLocaleDateString();
      localStorage.setItem('studycloud_last_sync', nowStr);

      // Notifier l'UI pour re-render immédiat
      window.dispatchEvent(new Event('unifolder_files_updated'));
      window.dispatchEvent(new Event('unifolder_data_restored'));
      import('./cloudDataStore').then(m => m.CloudDataStore.sync(true)).catch(() => {});
      return true;
    }
  } catch (err) {
    console.warn('[UserSync] Restauration cloud différée (mode hors-ligne ou réseau restreint):', err);
  }
  return false;
}

// ----------------------------------------------------------------------------
// Synchronisations Transparentes en Arrière-Plan (Non-Bloquantes)
// ----------------------------------------------------------------------------

let debounceBackupTimer: any = null;

/**
 * Déclenche une sauvegarde globale vers Cloudflare D1 avec debouncing
 * pour éviter de saturer l'API lors de frappes multiples.
 */
export function triggerDebouncedCloudBackup(delayMs = 2000): void {
  const userId = getCurrentUserId();
  if (!userId || !isUserLoggedIn()) return;

  if (debounceBackupTimer) clearTimeout(debounceBackupTimer);
  debounceBackupTimer = setTimeout(async () => {
    try {
      const matieres = JSON.parse(localStorage.getItem('unifolder_saved_matieres') || '[]');
      const notes = JSON.parse(localStorage.getItem('unifolder_keep_notes') || '[]');
      const rawSchedule = JSON.parse(localStorage.getItem('user_schedule_data') || '{}');
      let scheduleSlots: any[] = [];
      if (Array.isArray(rawSchedule)) {
        scheduleSlots = rawSchedule;
      } else if (rawSchedule && typeof rawSchedule === 'object') {
        scheduleSlots = Object.entries(rawSchedule).map(([key, val]: [string, any]) => {
          const parts = key.split('_');
          const day = parts[0] || '';
          const hourSlot = parts.slice(1).join('_') || '';
          return {
            id: `${userId}-${day}-${hourSlot}`,
            day,
            hourSlot,
            subject: val?.subject || '',
            room: val?.room || '',
            noteOrTeacher: val?.note || '',
            color: val?.color || 'bg-emerald-100 dark:bg-emerald-950/80',
          };
        });
      }

      const calendarEvents = JSON.parse(localStorage.getItem('unifolder_calendar_data') || '[]');
      const scheduleConfig = {
        days: JSON.parse(localStorage.getItem('user_schedule_days') || '["Lundi","Mardi","Mercredi","Jeudi","Vendredi","Samedi"]'),
        hours: JSON.parse(localStorage.getItem('user_schedule_hours') || '["08:00 - 10:00","10:00 - 12:00","14:00 - 16:00","16:00 - 18:00"]'),
        zoomLevel: Number(localStorage.getItem('user_schedule_zoom') || '100'),
      };
      const rawAlarms = JSON.parse(localStorage.getItem('unifolder_clock_alarms') || localStorage.getItem('unifolder_alarms') || '[]');
      const alarms = Array.isArray(rawAlarms) ? rawAlarms.map((a: any) => ({
        id: a.id,
        time: a.time,
        label: a.label || 'Alarme',
        active: a.active !== undefined ? Boolean(a.active) : Boolean(a.is_active),
        isActive: (a.isActive !== undefined ? a.isActive : (a.active !== undefined ? (a.active ? 1 : 0) : 1)) ? 1 : 0,
        days: Array.isArray(a.days) ? a.days : ['Tous les jours'],
        days_json: JSON.stringify(Array.isArray(a.days) ? a.days : ['Tous les jours'])
      })) : [];
      const userProfile = {
        name: localStorage.getItem('unifolder_user_name') || '',
        school: localStorage.getItem('unifolder_user_school') || '',
        filiere: localStorage.getItem('unifolder_user_filiere') || '',
        email: localStorage.getItem('unifolder_user_email') || '',
        country: localStorage.getItem('unifolder_user_country') || "Côte d'Ivoire",
      };

      const rawGrades = JSON.parse(localStorage.getItem('user_grades_trimesters_data') || '{}');
      const grades: any[] = [];
      if (rawGrades && typeof rawGrades === 'object') {
        Object.entries(rawGrades).forEach(([trim, items]) => {
          if (Array.isArray(items)) {
            items.forEach((item: any) => {
              grades.push({
                id: item.id,
                trimester: Number(trim) || 1,
                subjectName: item.subject,
                coefficient: Number(item.coefficient) || 1.0,
                subGradesJson: JSON.stringify(item.subGrades || []),
                average: Number(item.grade) || 0,
              });
            });
          }
        });
      }

      await StudyCloudAPI.backupCloud({
        userId,
        userProfile,
        matieres,
        notes,
        scheduleSlots,
        scheduleConfig,
        calendarEvents,
        alarms,
        grades,
      });

      const nowStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' - ' + new Date().toLocaleDateString();
      localStorage.setItem('studycloud_last_sync', nowStr);
    } catch (e) {
      console.warn('[UserSync] Sauvegarde automatique en arrière-plan ignorée:', e);
    }
  }, delayMs);
}

/** Synchronise une matière ajoutée/modifiée vers le Worker */
export async function syncMatiere(matiere: { id: string; name: string; coefficient?: string | number; color?: string }) {
  const userId = getCurrentUserId();
  if (!userId || !isUserLoggedIn()) return;
  try {
    await StudyCloudAPI.createMatiere({
      id: matiere.id,
      userId,
      name: matiere.name,
      coefficient: Number(matiere.coefficient) || 1,
      color: matiere.color || '#EA580C',
    });
  } catch (e) {
    triggerDebouncedCloudBackup();
  }
}

/** Supprime une matière sur le Worker */
export async function deleteMatiereSync(matiereId: string) {
  const userId = getCurrentUserId();
  if (!userId || !isUserLoggedIn()) return;
  try {
    await StudyCloudAPI.deleteMatiere(matiereId);
  } catch (e) {
    triggerDebouncedCloudBackup();
  }
}

/** Synchronise une note Keep vers le Worker */
export async function syncNote(note: { id: string; title: string; content?: string; color?: string; isPinned?: boolean; imageUrl?: string }) {
  const userId = getCurrentUserId();
  if (!userId || !isUserLoggedIn()) return;
  try {
    await StudyCloudAPI.saveNote({
      id: note.id,
      userId,
      title: note.title,
      content: note.content || '',
      color: note.color || '#FFFFFF',
      isPinned: note.isPinned || false,
      imageUrl: note.imageUrl,
    });
  } catch (e) {
    triggerDebouncedCloudBackup();
  }
}

/** Supprime une note sur le Worker */
export async function deleteNoteSync(noteId: string) {
  const userId = getCurrentUserId();
  if (!userId || !isUserLoggedIn()) return;
  try {
    await StudyCloudAPI.deleteNote(noteId);
  } catch (e) {
    triggerDebouncedCloudBackup();
  }
}

/** Synchronise un créneau d'emploi du temps */
export async function syncScheduleSlot(slot: { id?: string; day: string; hourSlot: string; subject: string; room?: string; noteOrTeacher?: string; color?: string }) {
  const userId = getCurrentUserId();
  if (!userId || !isUserLoggedIn()) return;
  try {
    await StudyCloudAPI.addScheduleSlot({
      ...slot,
      userId,
    });
  } catch (e) {
    triggerDebouncedCloudBackup();
  }
}

/** Synchronise une alarme */
export async function syncAlarm(alarm: { id?: string; time: string; label?: string; isActive?: boolean; days?: string[] }) {
  const userId = getCurrentUserId();
  if (!userId || !isUserLoggedIn()) return;
  try {
    await StudyCloudAPI.createAlarm({
      ...alarm,
      userId,
      daysJson: JSON.stringify(alarm.days || ['Tous les jours']),
    });
  } catch (e) {
    triggerDebouncedCloudBackup();
  }
}

/** Synchronise un enregistrement de carnet de notes */
export async function syncGrade(grade: any) {
  const userId = getCurrentUserId();
  if (!userId || !isUserLoggedIn()) return;
  try {
    await StudyCloudAPI.saveGrade({
      ...grade,
      userId,
    });
  } catch (e) {
    triggerDebouncedCloudBackup();
  }
}

/** Enregistre les métadonnées d'un fichier uploadé */
export async function syncFileMetadata(fileData: {
  id: string;
  name: string;
  size: number;
  type: string;
  extension?: string;
  matiereId?: string | null;
  r2Key?: string | null;
  fileUrl?: string;
  isFavorite?: boolean;
  isImported?: boolean;
  isStudySession?: boolean;
}) {
  const userId = getCurrentUserId();
  if (!userId || !isUserLoggedIn()) return;
  try {
    await StudyCloudAPI.registerFileMetadata({
      ...fileData,
      userId,
    });
  } catch (e) {
    console.warn('[UserSync] Enregistrement métadonnée fichier différé:', e);
  }
}

/**
 * Importe directement des fichiers partagés dans l'espace personnel "Mes Fichiers" de l'utilisateur
 */
export function importFilesToMesFichiers(files: { name: string; size?: number; url?: string; type?: string }[]): number {
  if (!files || files.length === 0) return 0;
  try {
    const raw = localStorage.getItem('unifolder_files_menu_items');
    let existingList: any[] = raw ? JSON.parse(raw) : [];
    const now = Date.now();

    const newItems = files.map((f, i) => ({
      id: `file-imported-${now}-${i}`,
      name: f.name,
      size: f.size || 0,
      type: f.type || 'application/octet-stream',
      url: f.url || '',
      timestamp: now + i,
      isImported: true,
    }));

    const updated = [...newItems, ...existingList];
    safeLocalStorageSet('unifolder_files_menu_items', updated);
    try {
      localStorage.setItem('unifolder_last_imported_id', newItems[0].id);
      localStorage.setItem('unifolder_importing_ids', JSON.stringify(newItems.map(item => item.id)));
    } catch (e) {}

    // Déclencher le rafraîchissement réactif dans toute l'application
    window.dispatchEvent(new Event('unifolder_files_updated'));

    // Sauvegarde en arrière-plan vers Cloudflare D1
    triggerDebouncedCloudBackup();

    return newItems.length;
  } catch (e) {
    console.error('Erreur import fichiers dans Mes Fichiers:', e);
    return 0;
  }
}
