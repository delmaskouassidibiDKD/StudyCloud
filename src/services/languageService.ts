/**
 * Service de gestion de la langue et de traduction globale StudyCloud
 * Moteur universel sans bandeau avec synchronisation en direct dans toute l'application.
 */

export interface LanguageOption {
  code: string;
  label: string;
  nativeLabel: string;
  flag?: string;
}

export const SUPPORTED_LANGUAGES: LanguageOption[] = [
  { code: 'fr', label: 'Français', nativeLabel: 'Français' },
  { code: 'en', label: 'English', nativeLabel: 'English' },
  { code: 'es', label: 'Español', nativeLabel: 'Español' },
  { code: 'pt', label: 'Português', nativeLabel: 'Português' },
  { code: 'it', label: 'Italiano', nativeLabel: 'Italiano' },
  { code: 'de', label: 'Deutsch', nativeLabel: 'Deutsch' },
  { code: 'zh-CN', label: '中文 (Chinois)', nativeLabel: '简体中文' },
  { code: 'ja', label: '日本語 (Japonais)', nativeLabel: '日本語' },
  { code: 'ko', label: '한국어 (Coréen)', nativeLabel: '한국어' },
  { code: 'ar', label: 'العربية (Arabe)', nativeLabel: 'العربية' },
  { code: 'hi', label: 'हिन्दी (Hindi)', nativeLabel: 'हिन्दी' },
  { code: 'ru', label: 'Русский (Russe)', nativeLabel: 'Русский' },
];

const STORAGE_KEY = 'studycloud_language';

/**
 * Récupère la langue active actuelle (par défaut 'fr')
 */
export function getCurrentLanguage(): string {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && SUPPORTED_LANGUAGES.some((l) => l.code === saved)) {
      return saved;
    }

    const match = document.cookie.match(/(?:^|; )googtrans=([^;]*)/);
    if (match && match[1]) {
      const parts = match[1].split('/');
      const code = parts[parts.length - 1];
      if (code && SUPPORTED_LANGUAGES.some((l) => l.code === code)) {
        return code;
      }
    }
  } catch (e) {
    // ignore
  }
  return 'fr';
}

/**
 * Configure les cookies de traduction sur tous les domaines et sous-domaines possibles
 */
function setGoogtransCookie(langCode: string | null) {
  const hostname = window.location.hostname;
  const hostParts = hostname.split('.');
  const domains: string[] = ['', hostname, `.${hostname}`];
  if (hostParts.length > 2) {
    domains.push(`.${hostParts.slice(-2).join('.')}`);
  }

  domains.forEach((d) => {
    const domainPart = d ? ` domain=${d};` : '';
    if (!langCode || langCode === 'fr') {
      document.cookie = `googtrans=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;${domainPart}`;
    } else {
      document.cookie = `googtrans=/fr/${langCode}; path=/;${domainPart}`;
    }
  });
}

/**
 * Déclenche la traduction de la page via le widget Google Translate sous-jacent
 */
function triggerCombo(langCode: string): boolean {
  try {
    const select = document.querySelector<HTMLSelectElement>('.goog-te-combo');
    if (select) {
      select.value = langCode;
      select.dispatchEvent(new Event('change'));
      return true;
    }
  } catch (e) {
    // ignore
  }
  return false;
}

/**
 * Modifie la langue globale de l'application StudyCloud
 */
export function applyLanguage(langCode: string, reloadFallback = true) {
  try {
    localStorage.setItem(STORAGE_KEY, langCode);
  } catch (e) {}

  if (langCode === 'fr') {
    setGoogtransCookie(null);
    document.documentElement.setAttribute('lang', 'fr');
    document.documentElement.setAttribute('translate', 'no');
    document.documentElement.classList.add('notranslate');
    document.body?.setAttribute('translate', 'no');
    document.body?.classList.add('notranslate');

    // Déclenche le retour en français ou recharge si nécessaire
    const ok = triggerCombo('fr');
    if (!ok && reloadFallback) {
      window.location.reload();
    }
    window.dispatchEvent(new CustomEvent('studycloud_language_changed', { detail: { lang: 'fr' } }));
    return;
  }

  // Langue étrangère
  setGoogtransCookie(langCode);
  document.documentElement.setAttribute('lang', langCode);
  document.documentElement.removeAttribute('translate');
  document.documentElement.classList.remove('notranslate');
  document.body?.removeAttribute('translate');
  document.body?.classList.remove('notranslate');

  const ok = triggerCombo(langCode);
  if (!ok && reloadFallback) {
    window.location.reload();
  }

  window.dispatchEvent(new CustomEvent('studycloud_language_changed', { detail: { lang: langCode } }));
}

/**
 * Initialise l'observateur pour s'assurer que les nouveaux menus et modales React soient traduits
 */
export function initLanguageObserver() {
  if (typeof window === 'undefined') return;

  const current = getCurrentLanguage();
  if (current !== 'fr') {
    document.documentElement.removeAttribute('translate');
    document.documentElement.classList.remove('notranslate');
    document.body?.removeAttribute('translate');
    document.body?.classList.remove('notranslate');

    // Retente le combo après chargement du script si nécessaire
    let attempts = 0;
    const interval = setInterval(() => {
      attempts++;
      if (triggerCombo(current) || attempts > 20) {
        clearInterval(interval);
      }
    }, 400);
  }
}

