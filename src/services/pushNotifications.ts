// Service de gestion des Notifications Push StudyCloud
export class PushNotificationService {
  private static registered = false;

  public static async registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
    if (!('serviceWorker' in navigator)) return null;
    try {
      const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
      this.registered = true;
      return reg;
    } catch (err) {
      console.warn('[Push Service Worker]', err);
      return null;
    }
  }

  public static async requestPermission(): Promise<NotificationPermission> {
    if (!('Notification' in window)) return 'denied';
    if (Notification.permission === 'granted') return 'granted';
    try {
      const perm = await Notification.requestPermission();
      return perm;
    } catch {
      return Notification.permission;
    }
  }

  public static isSupported(): boolean {
    return 'Notification' in window && 'serviceWorker' in navigator;
  }

  public static getPermission(): NotificationPermission {
    if (!('Notification' in window)) return 'denied';
    return Notification.permission;
  }

  public static async showNotification(title: string, options?: { body?: string; icon?: string; tag?: string; data?: any }) {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;

    const notifOptions = {
      body: options?.body || '',
      icon: options?.icon || '/dna-logo.png',
      badge: '/dna-logo.png',
      vibrate: [200, 100, 200],
      tag: options?.tag || 'studycloud-' + Date.now(),
      data: options?.data || { url: '/?view=notifications' },
    };

    try {
      if ('serviceWorker' in navigator) {
        const reg = await navigator.serviceWorker.ready;
        if (reg && reg.showNotification) {
          await reg.showNotification(title, notifOptions as any);
          return;
        }
      }
    } catch (e) {
      // Fallback window Notification
    }

    try {
      new Notification(title, notifOptions);
    } catch (e) {}
  }
}
