/**
 * StudyCloud — Étape 4 : Moteur d'Emails (Resend), Politiques de Relance,
 * Webhook de Suivi (Envoyé/Reçu/Ouvert/Rebondi) & Garde-fous de Blocage.
 *
 * - Utilise la clé `RESEND_API_KEY` déjà configurée sur `studycloud-worker`.
 * - Enregistre systématiquement chaque envoi dans `billing_email_logs` et met à jour
 *   `active_subscriptions.last_email_at` / `last_email_type` / `last_email_status`.
 * - Supporte 8 modèles d'emails brandés StudyCloud / DKD Technologies.
 */

export type BillingEmailType =
  | 'purchase_confirmed'
  | 'infinite_confirmed'
  | 'pre_renewal_notice'
  | 'payment_failed'
  | 'overdue_reminder'
  | 'service_blocked'
  | 'service_reactivated'
  | 'subscription_cancelled'
  | 'subscription_cancelled_data_warning'
  | 'data_overflow_purged'
  | 'storage_downgrade_proposed'
  | 'storage_downgrade_completed'
  | 'admin_manual_notice';

export type BillingBlockScope = 'service_only' | 'read_only' | 'full_account';

export interface BillingEmailSubscriptionContext {
  id: string;
  user_id: string;
  user_name?: string;
  user_email?: string;
  product_type?: string;
  app_key?: string;
  app_name?: string;
  plan_name?: string;
  price_amount?: number;
  currency?: string;
  renewal_mode?: string;
  is_infinite?: number | boolean;
  last_network_label?: string;
  current_period_start?: string | null;
  current_period_end?: string | null;
  next_billing_at?: string | null;
  grace_until?: string | null;
  block_scope?: string;
  last_charge_error?: string;
  reminder_count?: number;
}

export interface SendBillingEmailResult {
  success: boolean;
  logId: string;
  status: 'sent' | 'failed' | 'skipped';
  providerMessageId: string;
  subject: string;
  error?: string;
}

const APP_BASE_URL = 'https://studycloud.dkd-technologies.com';
const FROM_EMAIL = 'StudyCloud <noreply@dkd-technologies.com>';
const REPLY_TO_EMAIL = 'StudyClouddkd@gmail.com';

function escHtml(v: unknown): string {
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function formatFrDateTime(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  const datePart = d.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'UTC',
  });
  const timePart = d.toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'UTC',
  });
  return `${datePart} à ${timePart} UTC`;
}

export function formatEmailAmount(amount?: number, currency = 'XOF'): string {
  const safe = Number(amount || 0);
  const cur = String(currency || 'XOF').toUpperCase();
  if (cur === 'XOF' || cur === 'FCFA') {
    return `${Math.round(safe).toLocaleString('fr-FR')} FCFA`;
  }
  if (cur === 'EUR') return `${safe.toFixed(2)} €`;
  if (cur === 'USD') return `$${safe.toFixed(2)}`;
  return `${safe} ${cur}`;
}

export function describeServiceLabel(sub: BillingEmailSubscriptionContext): string {
  const pt = String(sub.product_type || '').toLowerCase();
  if (pt === 'storage') return 'Stockage Cloud StudyCloud';
  if (pt === 'ai') return 'Crédits IA StudyCloud';
  if (pt === 'app') return sub.app_name || sub.app_key || 'Application StudyCloud';
  return sub.app_name || sub.plan_name || 'StudyCloud';
}

export function describeBlockScopeFr(scope?: string): string {
  const s = String(scope || 'service_only').toLowerCase();
  if (s === 'full_account') return 'l’ensemble de votre compte StudyCloud (hors espace de règlement)';
  if (s === 'read_only') return 'le passage en mode lecture seule (modifications et ajouts suspendus)';
  return 'le service ou l’application concerné(e) uniquement';
}

function wrapBrandedEmailLayout(params: {
  title: string;
  badgeText: string;
  badgeBg: string;
  badgeColor: string;
  greeting: string;
  introHtml: string;
  rows: Array<{ label: string; value: string }>;
  noticeBoxHtml?: string;
  ctaLabel: string;
  ctaUrl: string;
}): string {
  const rowsHtml = params.rows
    .map(
      (r) => `
      <tr>
        <td style="padding:10px 0;border-bottom:1px solid #f1f5f9;color:#64748b;font-size:13px;">${escHtml(r.label)}</td>
        <td style="padding:10px 0;border-bottom:1px solid #f1f5f9;color:#0f172a;font-size:13px;font-weight:700;text-align:right;">${escHtml(r.value)}</td>
      </tr>`
    )
    .join('');

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>${escHtml(params.title)}</title>
</head>
<body style="margin:0;padding:0;background-color:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color:#f1f5f9;padding:32px 16px;">
    <tr>
      <td align="center">
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 10px 30px rgba(15,23,42,0.08);">
          <tr>
            <td style="background:linear-gradient(135deg,#0f172a 0%,#1e293b 100%);padding:28px 24px;text-align:center;">
              <h1 style="margin:0;font-size:24px;font-weight:900;letter-spacing:-0.4px;">
                <span style="color:#f97316;">Study</span><span style="color:#38bdf8;">Cloud</span>
              </h1>
              <p style="margin:4px 0 0 0;color:#f59e0b;font-size:10px;font-weight:800;letter-spacing:2px;text-transform:uppercase;">
                DKD TECHNOLOGIES
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:28px 28px 24px 28px;">
              <div style="display:inline-block;padding:6px 14px;border-radius:999px;background:${params.badgeBg};color:${params.badgeColor};font-size:12px;font-weight:800;margin-bottom:16px;">
                ${escHtml(params.badgeText)}
              </div>
              <h2 style="margin:0 0 10px 0;color:#0f172a;font-size:20px;font-weight:800;line-height:1.3;">
                ${escHtml(params.title)}
              </h2>
              <p style="margin:0 0 12px 0;color:#334155;font-size:14px;line-height:1.6;">
                ${escHtml(params.greeting)}
              </p>
              <div style="margin:0 0 18px 0;color:#334155;font-size:14px;line-height:1.6;">
                ${params.introHtml}
              </div>

              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:14px;padding:8px 16px;margin-bottom:18px;">
                ${rowsHtml}
              </table>

              ${params.noticeBoxHtml || ''}

              <div style="text-align:center;margin-top:22px;">
                <a href="${escHtml(params.ctaUrl)}" style="display:inline-block;padding:13px 28px;border-radius:12px;background:linear-gradient(135deg,#f97316,#ea580c);color:#ffffff;font-size:14px;font-weight:800;text-decoration:none;box-shadow:0 6px 18px rgba(234,88,12,0.28);">
                  ${escHtml(params.ctaLabel)}
                </a>
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding:18px 24px;background:#f8fafc;border-top:1px solid #e2e8f0;text-align:center;">
              <p style="margin:0;color:#64748b;font-size:11px;line-height:1.5;">
                Cet email automatique concerne votre compte StudyCloud.<br/>
                Besoin d'aide ? Répondez directement à cet email (${escHtml(REPLY_TO_EMAIL)}).
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function buildBillingEmailContent(params: {
  emailType: BillingEmailType;
  sub: BillingEmailSubscriptionContext;
  customMessage?: string;
  graceDaysRemaining?: number | null;
  reference?: string;
  extraData?: Record<string, any>;
}): { subject: string; html: string } {
  const { emailType, sub, customMessage, graceDaysRemaining, reference, extraData = {} } = params;
  const serviceName = describeServiceLabel(sub);
  const planName = sub.plan_name || 'Forfait StudyCloud';
  const userName = sub.user_name ? `Bonjour ${sub.user_name},` : 'Bonjour,';
  const amountStr = formatEmailAmount(sub.price_amount, sub.currency || 'XOF');
  const startStr = formatFrDateTime(sub.current_period_start);
  const endStr = formatFrDateTime(sub.current_period_end);
  const graceStr = formatFrDateTime(sub.grace_until);
  const manageUrl = `${APP_BASE_URL}/?tab=subscriptions`;
  const renewalLabel =
    Number(sub.is_infinite) === 1 || sub.renewal_mode === 'infinite'
      ? '♾️ Abonnement à vie (Infini)'
      : sub.renewal_mode === 'auto'
      ? '⚡ Prélèvement automatique (Carte)'
      : '🔄 Renouvellement manuel';

  const customBlock = customMessage
    ? `<div style="margin:0 0 16px 0;padding:12px 14px;border-radius:12px;background:#fff7ed;border:1px solid #fdba74;color:#9a3412;font-size:13px;line-height:1.5;"><strong>Message de l'équipe StudyCloud :</strong><br/>${escHtml(customMessage).replace(/\n/g, '<br/>')}</div>`
    : '';

  switch (emailType) {
    case 'infinite_confirmed':
      return {
        subject: `♾️ Abonnement à vie activé — ${planName} (${serviceName})`,
        html: wrapBrandedEmailLayout({
          title: 'Votre abonnement à vie est activé !',
          badgeText: '♾️ Abonnement Infini / À vie',
          badgeBg: '#fef3c7',
          badgeColor: '#b45309',
          greeting: userName,
          introHtml: `Merci pour votre achat sur StudyCloud ! Votre accès <strong>à vie</strong> pour <strong>${escHtml(serviceName)}</strong> (${escHtml(planName)}) est immédiatement activé sur votre compte. Vous n'avez aucune date d'expiration et aucun renouvellement à payer.${customBlock}`,
          rows: [
            { label: 'Service / Application', value: serviceName },
            { label: 'Offre activée', value: planName },
            { label: 'Montant réglé', value: amountStr },
            { label: 'Moyen de paiement', value: sub.last_network_label || 'Paystack' },
            { label: 'Validité', value: '♾️ Permanent (À vie — Sans expiration)' },
            ...(reference ? [{ label: 'Référence', value: reference }] : []),
          ],
          ctaLabel: 'Accéder à StudyCloud',
          ctaUrl: manageUrl,
        }),
      };

    case 'purchase_confirmed':
      return {
        subject: `✅ Paiement confirmé — ${planName} (${serviceName})`,
        html: wrapBrandedEmailLayout({
          title: 'Votre abonnement StudyCloud est actif',
          badgeText: '✅ Paiement confirmé',
          badgeBg: '#dcfce7',
          badgeColor: '#15803d',
          greeting: userName,
          introHtml: `Votre règlement a bien été validé. Votre abonnement <strong>${escHtml(planName)}</strong> pour <strong>${escHtml(serviceName)}</strong> est actif dès maintenant.${customBlock}`,
          rows: [
            { label: 'Service / Application', value: serviceName },
            { label: 'Forfait', value: planName },
            { label: 'Montant réglé', value: amountStr },
            { label: 'Moyen de paiement', value: sub.last_network_label || 'Paystack' },
            { label: 'Mode de renouvellement', value: renewalLabel },
            { label: 'Date de début', value: startStr },
            { label: "Date et heure d'expiration", value: endStr },
            ...(reference ? [{ label: 'Référence', value: reference }] : []),
          ],
          noticeBoxHtml: `<div style="padding:12px 14px;border-radius:12px;background:#f0fdf4;border:1px solid #bbf7d0;color:#166534;font-size:12.5px;line-height:1.5;">Vous pouvez à tout moment passer du renouvellement <strong>Automatique</strong> au <strong>Manuel</strong> ou associer une carte Visa/Mastercard depuis le menu <strong>« Gérer mes abonnements »</strong> dans StudyCloud.</div>`,
          ctaLabel: 'Gérer mes abonnements',
          ctaUrl: manageUrl,
        }),
      };

    case 'pre_renewal_notice':
      return {
        subject: `⏰ Rappel d'échéance — ${planName} (${serviceName})`,
        html: wrapBrandedEmailLayout({
          title: 'Votre abonnement arrive bientôt à échéance',
          badgeText: '⏰ Pré-alerte échéance',
          badgeBg: '#e0f2fe',
          badgeColor: '#0369a1',
          greeting: userName,
          introHtml:
            sub.renewal_mode === 'auto'
              ? `Votre abonnement <strong>${escHtml(planName)}</strong> (${escHtml(serviceName)}) sera renouvelé automatiquement à l'échéance indiquée ci-dessous. Assurez-vous que votre carte bancaire est approvisionnée ou basculez en mode manuel depuis votre espace.${customBlock}`
              : `Votre abonnement <strong>${escHtml(planName)}</strong> (${escHtml(serviceName)}) arrive bientôt à expiration. Pensez à le renouveler manuellement afin d'éviter toute interruption de service.${customBlock}`,
          rows: [
            { label: 'Service / Application', value: serviceName },
            { label: 'Forfait', value: planName },
            { label: 'Montant prévu', value: amountStr },
            { label: 'Mode actuel', value: renewalLabel },
            { label: 'Échéance exacte', value: endStr },
          ],
          ctaLabel: sub.renewal_mode === 'auto' ? 'Gérer mon abonnement' : 'Renouveler maintenant',
          ctaUrl: manageUrl,
        }),
      };

    case 'payment_failed':
      return {
        subject: `⚠️ Échec de paiement — ${planName} (${serviceName})`,
        html: wrapBrandedEmailLayout({
          title: 'Votre renouvellement automatique a échoué',
          badgeText: '⚠️ Paiement échoué',
          badgeBg: '#fee2e2',
          badgeColor: '#b91c1c',
          greeting: userName,
          introHtml: `Nous n'avons pas pu renouveler automatiquement votre forfait <strong>${escHtml(planName)}</strong> (${escHtml(serviceName)}). Votre accès reste actif pendant votre période de grâce afin de vous laisser le temps de régulariser.${customBlock}`,
          rows: [
            { label: 'Service / Application', value: serviceName },
            { label: 'Forfait', value: planName },
            { label: 'Montant dû', value: amountStr },
            ...(sub.last_charge_error ? [{ label: 'Motif signalé', value: sub.last_charge_error }] : []),
            { label: 'Fin de période de grâce', value: graceStr },
            { label: 'Conséquence après délai', value: `Blocage : ${describeBlockScopeFr(sub.block_scope)}` },
          ],
          noticeBoxHtml: `<div style="padding:12px 14px;border-radius:12px;background:#fef2f2;border:1px solid #fecaca;color:#991b1b;font-size:12.5px;line-height:1.5;">Réglez dès maintenant par Mobile Money (Wave, Orange Money, MTN) ou Carte Visa/Mastercard pour éviter toute coupure.</div>`,
          ctaLabel: 'Régulariser mon paiement',
          ctaUrl: manageUrl,
        }),
      };

    case 'overdue_reminder': {
      const daysTxt =
        typeof graceDaysRemaining === 'number' && graceDaysRemaining > 0
          ? `Il vous reste environ <strong>${graceDaysRemaining} jour(s)</strong> avant le blocage.`
          : `Votre période de grâce touche à sa fin.`;
      return {
        subject: `🔔 Rappel de règlement — ${planName} (${serviceName})`,
        html: wrapBrandedEmailLayout({
          title: 'Rappel : abonnement en attente de règlement',
          badgeText: '🔔 Rappel d’impayé',
          badgeBg: '#fef3c7',
          badgeColor: '#b45309',
          greeting: userName,
          introHtml: `Votre abonnement <strong>${escHtml(planName)}</strong> pour <strong>${escHtml(serviceName)}</strong> est actuellement expiré / en attente de règlement. ${daysTxt}${customBlock}`,
          rows: [
            { label: 'Service / Application', value: serviceName },
            { label: 'Forfait', value: planName },
            { label: 'Montant à régler', value: amountStr },
            { label: 'Échéance initiale', value: endStr },
            { label: 'Date limite avant blocage', value: graceStr },
            { label: 'Blocage prévu', value: describeBlockScopeFr(sub.block_scope) },
          ],
          ctaLabel: 'Payer et conserver mon accès',
          ctaUrl: manageUrl,
        }),
      };
    }

    case 'service_blocked':
      return {
        subject: `🔒 Service suspendu (impayé) — ${serviceName}`,
        html: wrapBrandedEmailLayout({
          title: 'Accès temporairement suspendu',
          badgeText: '🔒 Service bloqué',
          badgeBg: '#fee2e2',
          badgeColor: '#991b1b',
          greeting: userName,
          introHtml: `Suite au non-règlement de votre forfait <strong>${escHtml(planName)}</strong> après expiration de la période de grâce, nous avons appliqué un blocage concernant <strong>${escHtml(describeBlockScopeFr(sub.block_scope))}</strong>. Vos données restent conservées en sécurité et seront immédiatement réactivées dès votre paiement.${customBlock}`,
          rows: [
            { label: 'Service / Application', value: serviceName },
            { label: 'Forfait', value: planName },
            { label: 'Montant pour réactiver', value: amountStr },
            { label: 'Portée du blocage', value: describeBlockScopeFr(sub.block_scope) },
          ],
          ctaLabel: 'Débloquer immédiatement',
          ctaUrl: manageUrl,
        }),
      };

    case 'service_reactivated':
      return {
        subject: `🎉 Accès réactivé — ${planName} (${serviceName})`,
        html: wrapBrandedEmailLayout({
          title: 'Votre accès StudyCloud est rétabli !',
          badgeText: '🎉 Service réactivé',
          badgeBg: '#dcfce7',
          badgeColor: '#15803d',
          greeting: userName,
          introHtml: `Bonne nouvelle ! Votre règlement a bien été pris en compte et votre accès à <strong>${escHtml(serviceName)}</strong> est immédiatement rétabli.${customBlock}`,
          rows: [
            { label: 'Service / Application', value: serviceName },
            { label: 'Forfait', value: planName },
            { label: 'Montant réglé', value: amountStr },
            { label: 'Nouvelle échéance', value: Number(sub.is_infinite) === 1 ? '♾️ À vie' : endStr },
          ],
          ctaLabel: 'Retourner sur StudyCloud',
          ctaUrl: manageUrl,
        }),
      };

    case 'subscription_cancelled':
      return {
        subject: `❌ Annulation de votre abonnement — ${planName} (${serviceName})`,
        html: wrapBrandedEmailLayout({
          title: 'Votre abonnement a été annulé',
          badgeText: '❌ Abonnement annulé',
          badgeBg: '#f1f5f9',
          badgeColor: '#334155',
          greeting: userName,
          introHtml: `Votre abonnement <strong>${escHtml(planName)}</strong> pour <strong>${escHtml(serviceName)}</strong> a été annulé.${extraData.mode === 'end_of_period' ? ` Vous conservez votre accès jusqu'au <strong>${escHtml(endStr)}</strong>, puis le renouvellement automatique ne sera plus effectué.` : ' Votre accès payant a été arrêté immédiatement.'}${extraData.reason ? `<br/><br/><strong>Motif :</strong> ${escHtml(extraData.reason)}` : ''}${customBlock}`,
          rows: [
            { label: 'Service / Application', value: serviceName },
            { label: 'Forfait', value: planName },
            {
              label: 'Effet',
              value: extraData.mode === 'end_of_period' ? `Fin de période (${endStr})` : 'Immédiat',
            },
          ],
          ctaLabel: 'Voir mes abonnements',
          ctaUrl: manageUrl,
        }),
      };

    case 'subscription_cancelled_data_warning': {
      const retentionDays = Math.max(1, Number(extraData.retentionDays ?? graceDaysRemaining ?? 14));
      const deadlineStr = formatFrDateTime(extraData.purgeDeadlineIso || null);
      const usedStr = String(extraData.usedFormatted || '—');
      const welcomeStr = String(extraData.welcomeFormatted || '30 Mo');
      const excessStr = String(extraData.excessFormatted || '—');
      const overflowCount = Number(extraData.overflowFilesCount || 0);
      return {
        subject: `⚠️ Action requise (${retentionDays}j) : récupérez vos ${excessStr} dépassant le quota gratuit`,
        html: wrapBrandedEmailLayout({
          title: 'Abonnement annulé — Délai pour récupérer vos données',
          badgeText: `⏳ ${retentionDays} jour${retentionDays > 1 ? 's' : ''} pour récupérer vos fichiers`,
          badgeBg: '#ffedd5',
          badgeColor: '#c2410c',
          greeting: userName,
          introHtml: `Votre abonnement <strong>${escHtml(planName)}</strong> (${escHtml(serviceName)}) a été annulé.${extraData.reason ? ` <br/><strong>Motif :</strong> ${escHtml(extraData.reason)}` : ''}<br/><br/>Votre espace utilisé actuel est de <strong>${escHtml(usedStr)}</strong>, alors que votre quota gratuit est de <strong>${escHtml(welcomeStr)}</strong> : vous dépassez donc l'espace gratuit de <strong>${escHtml(excessStr)}</strong>${overflowCount > 0 ? ` (${overflowCount} fichier${overflowCount > 1 ? 's' : ''} sur l'espace payant)` : ''}.<br/><br/>Vous disposez de <strong>${retentionDays} jour${retentionDays > 1 ? 's' : ''}</strong> (jusqu'au <strong>${escHtml(deadlineStr)}</strong>) pour télécharger vos fichiers et revenir dans votre zone gratuite (ou renouveler votre stockage).${customBlock}`,
          rows: [
            { label: 'Consommation actuelle', value: usedStr },
            { label: 'Quota gratuit protégé', value: welcomeStr },
            { label: 'Données dépassant le gratuit', value: `${excessStr}${overflowCount > 0 ? ` (${overflowCount} fichier${overflowCount > 1 ? 's' : ''})` : ''}` },
            { label: 'Délai accordé', value: `${retentionDays} jour${retentionDays > 1 ? 's' : ''}` },
            { label: 'Date limite avant suppression', value: deadlineStr },
          ],
          noticeBoxHtml: `<div style="margin:0 0 16px 0;padding:14px 16px;border-radius:12px;background:#fef2f2;border:1px solid #fecaca;color:#991b1b;font-size:13px;line-height:1.55;"><strong>📌 Important — Quels fichiers sont concernés ?</strong><br/>Vos <strong>premiers fichiers situés dans votre espace gratuit (${escHtml(welcomeStr)})</strong> sont <strong>protégés et ne seront PAS supprimés</strong>. Seuls les fichiers enregistrés <strong>après l'espace gratuit (sur l'espace payant)</strong> seront définitivement supprimés après le <strong>${escHtml(deadlineStr)}</strong> si vous n'êtes pas revenu dans la zone gratuite.</div>`,
          ctaLabel: 'Accéder à mes fichiers & abonnements',
          ctaUrl: manageUrl,
        }),
      };
    }

    case 'data_overflow_purged': {
      const purgedStr = String(extraData.purgedFormatted || '—');
      const purgedCount = Number(extraData.purgedFilesCount || 0);
      const welcomeStr = String(extraData.welcomeFormatted || '30 Mo');
      return {
        subject: `🧹 Nettoyage automatique terminé — Retour dans la zone gratuite StudyCloud`,
        html: wrapBrandedEmailLayout({
          title: 'Suppression des fichiers au-delà du quota gratuit',
          badgeText: '🧹 Retour en zone gratuite',
          badgeBg: '#f1f5f9',
          badgeColor: '#334155',
          greeting: userName,
          introHtml: `Le délai de récupération accordé suite à l'annulation de votre abonnement <strong>${escHtml(planName)}</strong> étant arrivé à échéance, StudyCloud a supprimé uniquement les fichiers enregistrés sur l'espace payant au-delà de votre quota gratuit (${escHtml(welcomeStr)}). Vos premiers fichiers situés dans l'espace gratuit ont été conservés.${customBlock}`,
          rows: [
            { label: 'Fichiers payants supprimés', value: `${purgedCount} fichier${purgedCount > 1 ? 's' : ''}` },
            { label: 'Volume libéré', value: purgedStr },
            { label: 'Espace gratuit conservé', value: welcomeStr },
          ],
          ctaLabel: 'Ouvrir StudyCloud',
          ctaUrl: manageUrl,
        }),
      };
    }

    case 'storage_downgrade_proposed': {
      const curLabel = String(extraData.currentStorageLabel || '—');
      const targetLabel = String(extraData.targetStorageLabel || '—');
      const curPriceStr = formatEmailAmount(Number(extraData.currentMonthlyPrice || 0), sub.currency || 'XOF');
      const targetPriceStr = formatEmailAmount(Number(extraData.targetMonthlyPrice || 0), sub.currency || 'XOF');
      const prorataDueStr = formatEmailAmount(Number(extraData.consumedProrataAmount || 0), sub.currency || 'XOF');
      const daysUsed = Number(extraData.daysUsed || 0);
      const durDays = Number(extraData.durationDays || 30);
      return {
        subject: `📉 Réduction de stockage prête : passez de ${curLabel} à ${targetLabel} (${targetPriceStr}/mois)`,
        html: wrapBrandedEmailLayout({
          title: 'Votre réduction de stockage est prête !',
          badgeText: '📉 Réduction de stockage',
          badgeBg: '#dcfce7',
          badgeColor: '#15803d',
          greeting: userName,
          introHtml: `Suite à votre demande, l'équipe StudyCloud a préparé la réduction de votre abonnement de stockage de <strong>${escHtml(curLabel)}</strong> vers <strong>${escHtml(targetLabel)}</strong> (votre nouveau tarif mensuel passe de <strong>${escHtml(curPriceStr)}</strong> à <strong>${escHtml(targetPriceStr)} / mois</strong>).<br/><br/>Avant que le changement ne s'applique automatiquement, veuillez régler votre consommation déjà écoulée (${daysUsed} jour${daysUsed > 1 ? 's' : ''} sur ${durDays}j) : <strong>${escHtml(prorataDueStr)}</strong> dans <strong>Mes abonnements → Réduction de stockage</strong>.${customBlock}`,
          rows: [
            { label: 'Stockage actuel', value: curLabel },
            { label: 'Nouveau stockage réduit', value: targetLabel },
            { label: 'Ancien prix mensuel', value: curPriceStr },
            { label: 'Nouveau prix mensuel', value: targetPriceStr },
            { label: `Consommation écoulée (${daysUsed}j / ${durDays}j)`, value: prorataDueStr },
          ],
          noticeBoxHtml: `<div style="margin:0 0 16px 0;padding:12px 14px;border-radius:12px;background:#f0fdf4;border:1px solid #bbf7d0;color:#166534;font-size:13px;line-height:1.5;"><strong>⚡ Activation automatique :</strong> Dès réception du règlement de votre consommation prorata (<strong>${escHtml(prorataDueStr)}</strong>), votre abonnement basculera automatiquement sur <strong>${escHtml(targetLabel)}</strong> à <strong>${escHtml(targetPriceStr)}/mois</strong>.</div>`,
          ctaLabel: 'Régler ma consommation & activer',
          ctaUrl: `${APP_BASE_URL}/?tab=subscriptions&section=downgrades`,
        }),
      };
    }

    case 'storage_downgrade_completed': {
      const curLabel = String(extraData.currentStorageLabel || '—');
      const targetLabel = String(extraData.targetStorageLabel || '—');
      const targetPriceStr = formatEmailAmount(Number(extraData.targetMonthlyPrice || sub.price_amount || 0), sub.currency || 'XOF');
      const prorataPaidStr = formatEmailAmount(Number(extraData.consumedProrataAmount || 0), sub.currency || 'XOF');
      return {
        subject: `✅ Stockage modifié avec succès — Nouveau forfait ${targetLabel} (${targetPriceStr}/mois)`,
        html: wrapBrandedEmailLayout({
          title: 'Votre changement de stockage est confirmé !',
          badgeText: '✅ Stockage mis à jour',
          badgeBg: '#dcfce7',
          badgeColor: '#15803d',
          greeting: userName,
          introHtml: `Votre règlement prorata (${escHtml(prorataPaidStr)}) a bien été validé ! Votre abonnement de stockage est désormais passé de <strong>${escHtml(curLabel)}</strong> à <strong>${escHtml(targetLabel)}</strong> au tarif réduit de <strong>${escHtml(targetPriceStr)} / mois</strong>.${customBlock}`,
          rows: [
            { label: 'Ancien stockage', value: curLabel },
            { label: 'Nouveau stockage actif', value: targetLabel },
            { label: 'Nouveau tarif mensuel', value: targetPriceStr },
            { label: 'Consommation prorata réglée', value: prorataPaidStr },
            ...(reference ? [{ label: 'Référence paiement', value: reference }] : []),
          ],
          ctaLabel: 'Voir mon nouvel abonnement',
          ctaUrl: manageUrl,
        }),
      };
    }

    case 'admin_manual_notice':
    default:
      return {
        subject: `📩 Information importante sur votre abonnement — ${serviceName}`,
        html: wrapBrandedEmailLayout({
          title: `Suivi de votre abonnement ${planName}`,
          badgeText: '📩 Message StudyCloud',
          badgeBg: '#e0f2fe',
          badgeColor: '#0369a1',
          greeting: userName,
          introHtml:
            customBlock ||
            `Voici un récapitulatif de votre abonnement <strong>${escHtml(planName)}</strong> pour <strong>${escHtml(serviceName)}</strong>.`,
          rows: [
            { label: 'Service / Application', value: serviceName },
            { label: 'Forfait', value: planName },
            { label: 'Mode', value: renewalLabel },
            { label: 'Échéance', value: Number(sub.is_infinite) === 1 ? '♾️ À vie' : endStr },
          ],
          ctaLabel: 'Ouvrir StudyCloud',
          ctaUrl: manageUrl,
        }),
      };
  }
}

export async function sendAndLogBillingEmail(params: {
  db: any;
  rawEnv: Record<string, any>;
  fetchFn?: typeof fetch;
  subscription: BillingEmailSubscriptionContext;
  emailType: BillingEmailType;
  triggeredBy: 'system' | 'cron' | 'admin';
  customMessage?: string;
  reference?: string;
  graceDaysRemaining?: number | null;
  extraData?: Record<string, any>;
  nowIso?: string;
  recordEventFn?: (db: any, args: { subscriptionId: string; userId: string; eventType: string; actor: string; details?: Record<string, any> }) => Promise<void>;
}): Promise<SendBillingEmailResult> {
  const {
    db,
    rawEnv,
    subscription,
    emailType,
    triggeredBy,
    customMessage,
    reference,
    graceDaysRemaining,
    extraData,
    recordEventFn,
  } = params;
  const fetchFn = params.fetchFn || fetch;
  const logId = `bmail_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  // Résoudre l'email utilisateur (fallback table users si absent de l'abonnement)
  let toEmail = String(subscription.user_email || '').trim();
  let resolvedName = String(subscription.user_name || '').trim();
  if ((!toEmail || !resolvedName) && subscription.user_id) {
    const uRow: any = await db
      .prepare('SELECT email, name FROM users WHERE id = ? LIMIT 1')
      .bind(String(subscription.user_id))
      .first()
      .catch(() => null);
    if (!toEmail && uRow?.email) toEmail = String(uRow.email).trim();
    if (!resolvedName && uRow?.name) resolvedName = String(uRow.name).trim();
  }

  const enrichedSub: BillingEmailSubscriptionContext = {
    ...subscription,
    user_email: toEmail,
    user_name: resolvedName,
  };
  const { subject, html } = buildBillingEmailContent({
    emailType,
    sub: enrichedSub,
    customMessage,
    graceDaysRemaining,
    reference,
    extraData,
  });

  if (!toEmail || !toEmail.includes('@')) {
    await db
      .prepare(
        `INSERT INTO billing_email_logs (
           id, user_id, subscription_id, transaction_ref, email_to, email_type,
           trigger_source, subject, body_preview, resend_message_id, delivery_status, error_message
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, '', 'failed', 'Adresse email utilisateur manquante')`
      )
      .bind(
        logId,
        String(subscription.user_id || ''),
        String(subscription.id || ''),
        String(reference || ''),
        toEmail,
        emailType,
        triggeredBy,
        subject,
        String(customMessage || subject).slice(0, 220)
      )
      .run()
      .catch(() => {});
    return {
      success: false,
      logId,
      status: 'failed',
      providerMessageId: '',
      subject,
      error: 'Adresse email utilisateur manquante.',
    };
  }

  const resendApiKey = String(rawEnv?.RESEND_API_KEY || '').trim();
  let finalStatus: 'sent' | 'failed' = 'failed';
  let providerMessageId = '';
  let errMsg = '';

  if (!resendApiKey) {
    errMsg = 'RESEND_API_KEY non configurée sur le Worker';
  } else {
    try {
      const resp = await fetchFn('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: String(rawEnv?.RESEND_FROM_EMAIL || FROM_EMAIL),
          to: [toEmail],
          reply_to: REPLY_TO_EMAIL,
          subject,
          html,
          tags: [
            { name: 'email_type', value: emailType },
            { name: 'subscription_id', value: String(subscription.id || 'none').slice(0, 64) },
          ],
        }),
      });
      const json: any = await resp.json().catch(() => ({}));
      if (resp.ok && json?.id) {
        finalStatus = 'sent';
        providerMessageId = String(json.id);
      } else {
        errMsg = String(json?.message || json?.error || `Erreur Resend HTTP ${resp.status}`);
      }
    } catch (err: any) {
      errMsg = String(err?.message || 'Erreur réseau Resend');
    }
  }

  const nowIso = params.nowIso || new Date().toISOString();
  await db
    .prepare(
      `INSERT INTO billing_email_logs (
         id, user_id, subscription_id, transaction_ref, email_to, email_type,
         trigger_source, subject, body_preview, resend_message_id, delivery_status, error_message, sent_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      logId,
      String(subscription.user_id || ''),
      String(subscription.id || ''),
      String(reference || ''),
      toEmail,
      emailType,
      triggeredBy,
      subject,
      String(customMessage || subject).slice(0, 220),
      providerMessageId,
      finalStatus,
      errMsg,
      nowIso
    )
    .run()
    .catch(() => {});

  if (subscription.id) {
    const isReminderType =
      emailType === 'overdue_reminder' ||
      emailType === 'payment_failed' ||
      emailType === 'admin_manual_notice';

    await db
      .prepare(
        `UPDATE active_subscriptions
         SET last_email_at = ?,
             last_email_type = ?,
             last_email_status = ?,
             reminder_count = CASE WHEN ? = 1 AND ? = 'sent' THEN COALESCE(reminder_count, 0) + 1 ELSE COALESCE(reminder_count, 0) END,
             last_reminder_sent_at = CASE WHEN ? = 1 AND ? = 'sent' THEN ? ELSE last_reminder_sent_at END,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`
      )
      .bind(
        nowIso,
        emailType,
        finalStatus,
        isReminderType ? 1 : 0,
        finalStatus,
        isReminderType ? 1 : 0,
        finalStatus,
        nowIso,
        String(subscription.id)
      )
      .run()
      .catch(() => {});
  }

  if (recordEventFn && subscription.id) {
    await recordEventFn(db, {
      subscriptionId: String(subscription.id),
      userId: String(subscription.user_id || ''),
      eventType: finalStatus === 'sent' ? 'email_sent' : 'email_failed',
      actor: triggeredBy,
      details: {
        logId,
        emailType,
        toEmail,
        subject,
        providerMessageId: providerMessageId || null,
        error: errMsg || null,
      },
    }).catch(() => {});
  }

  return {
    success: finalStatus === 'sent',
    logId,
    status: finalStatus,
    providerMessageId,
    subject,
    ...(errMsg ? { error: errMsg } : {}),
  };
}

/**
 * Décode une chaîne Base64 en octets Uint8Array (compatible Cloudflare Workers & Node).
 */
function base64ToUint8Array(b64: string): Uint8Array {
  const clean = String(b64 || '').trim();
  const binStr = atob(clean);
  const bytes = new Uint8Array(binStr.length);
  for (let i = 0; i < binStr.length; i++) {
    bytes[i] = binStr.charCodeAt(i);
  }
  return bytes;
}

function uint8ArrayToBase64(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) {
    bin += String.fromCharCode(bytes[i]);
  }
  return btoa(bin);
}

function constantTimeEqualStrings(a: string, b: string): boolean {
  if (!a || !b || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

/**
 * Calcule une signature Svix/Resend `v1,<base64>` (utile pour la vérification et les tests).
 */
export async function computeResendSvixSignature(
  rawBody: string,
  svixId: string,
  svixTimestamp: string,
  webhookSecret: string
): Promise<string> {
  const stripped = String(webhookSecret || '').trim().replace(/^whsec_/, '');
  const keyBytes = base64ToUint8Array(stripped);
  const key = await crypto.subtle.importKey(
    'raw',
    keyBytes,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signedPayload = `${svixId}.${svixTimestamp}.${rawBody}`;
  const sigBuf = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(signedPayload));
  return `v1,${uint8ArrayToBase64(new Uint8Array(sigBuf))}`;
}

/**
 * Vérifie cryptographiquement la signature Svix/Resend HMAC-SHA256 (`svix-id`, `svix-timestamp`, `svix-signature`)
 * avec fenêtre anti-rejeu de 5 minutes.
 */
export async function verifyResendSvixSignature(
  rawBody: string,
  headers: Headers,
  webhookSecret: string,
  nowMs = Date.now()
): Promise<{ valid: boolean; reason?: string }> {
  const secret = String(webhookSecret || '').trim();
  if (!secret) return { valid: false, reason: 'missing_secret' };

  const svixId = String(headers.get('svix-id') || headers.get('webhook-id') || '').trim();
  const svixTimestamp = String(headers.get('svix-timestamp') || headers.get('webhook-timestamp') || '').trim();
  const svixSignature = String(headers.get('svix-signature') || headers.get('webhook-signature') || '').trim();

  if (!svixId || !svixTimestamp || !svixSignature) {
    return { valid: false, reason: 'missing_svix_headers' };
  }

  const tsSeconds = Number(svixTimestamp);
  if (!Number.isFinite(tsSeconds)) {
    return { valid: false, reason: 'invalid_timestamp' };
  }
  const nowSeconds = Math.floor(nowMs / 1000);
  if (Math.abs(nowSeconds - tsSeconds) > 300) {
    return { valid: false, reason: 'timestamp_out_of_range' };
  }

  let expectedV1: string;
  try {
    expectedV1 = await computeResendSvixSignature(rawBody, svixId, svixTimestamp, secret);
  } catch {
    return { valid: false, reason: 'invalid_secret_format' };
  }

  const expectedB64 = expectedV1.slice(3); // après "v1,"
  const candidates = svixSignature.split(/\s+/).filter(Boolean);
  for (const token of candidates) {
    const commaIdx = token.indexOf(',');
    if (commaIdx <= 0) continue;
    const version = token.slice(0, commaIdx).trim();
    const providedB64 = token.slice(commaIdx + 1).trim();
    if (version === 'v1' && constantTimeEqualStrings(providedB64, expectedB64)) {
      return { valid: true };
    }
  }

  return { valid: false, reason: 'signature_mismatch' };
}

/**
 * Traite un webhook Resend (`POST /api/webhooks/resend`) pour suivre en temps réel
 * si l'utilisateur a reçu (`delivered`), ouvert (`opened`) ou rejeté (`bounced`) l'email.
 */
export async function processResendWebhookEvent(
  db: any,
  payload: any
): Promise<{ matched: boolean; emailId: string; status: string }> {
  const eventType = String(payload?.type || '').trim().toLowerCase();
  const data = payload?.data || {};
  const emailId = String(data?.email_id || data?.id || '').trim();
  if (!emailId) {
    return { matched: false, emailId: '', status: 'ignored' };
  }

  const mapStatus: Record<string, string> = {
    'email.sent': 'sent',
    'email.delivered': 'delivered',
    'email.opened': 'opened',
    'email.clicked': 'opened',
    'email.bounced': 'bounced',
    'email.complained': 'complained',
    'email.delivery_delayed': 'delayed',
  };
  const nextStatus = mapStatus[eventType];
  if (!nextStatus) {
    return { matched: false, emailId, status: 'ignored' };
  }

  const row: any = await db
    .prepare('SELECT id, subscription_id, delivery_status FROM billing_email_logs WHERE resend_message_id = ? LIMIT 1')
    .bind(emailId)
    .first()
    .catch(() => null);
  if (!row) {
    return { matched: false, emailId, status: nextStatus };
  }

  const nowIso = new Date().toISOString();
  const deliveredAt = nextStatus === 'delivered' || nextStatus === 'opened' ? nowIso : null;
  const openedAt = nextStatus === 'opened' ? nowIso : null;
  const bounceReason =
    nextStatus === 'bounced'
      ? String(data?.bounce?.message || data?.reason || 'Email rebondi (adresse invalide ou boîte pleine)')
      : nextStatus === 'complained'
      ? 'Marqué comme spam par le destinataire'
      : '';

  // Ne pas rétrograder `opened` vers `delivered` si les webhooks arrivent dans le désordre
  const statusRank: Record<string, number> = {
    sent: 1,
    delayed: 1,
    delivered: 2,
    opened: 3,
    bounced: 4,
    complained: 4,
  };
  const finalStatus =
    (statusRank[nextStatus] || 0) >= (statusRank[String(row.delivery_status || 'sent')] || 0)
      ? nextStatus
      : String(row.delivery_status || nextStatus);

  await db
    .prepare(
      `UPDATE billing_email_logs
       SET delivery_status = ?,
           delivered_at = COALESCE(delivered_at, ?),
           opened_at = COALESCE(opened_at, ?),
           error_message = CASE WHEN ? != '' THEN ? ELSE error_message END
       WHERE id = ?`
    )
    .bind(finalStatus, deliveredAt, openedAt, bounceReason, bounceReason, row.id)
    .run()
    .catch(() => {});

  if (row.subscription_id) {
    await db
      .prepare(
        `UPDATE active_subscriptions
         SET last_email_status = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`
      )
      .bind(finalStatus, String(row.subscription_id))
      .run()
      .catch(() => {});
  }

  return { matched: true, emailId, status: finalStatus };
}

/**
 * Insère une notification in-app persistante dans la table `notifications` de StudyCloud.
 */
export async function insertBillingInAppNotification(
  db: any,
  userId: string,
  title: string,
  description: string,
  itemRef?: string,
  type: string = 'billing'
): Promise<void> {
  if (!db || !userId) return;
  try {
    await db
      .prepare(
        `CREATE TABLE IF NOT EXISTS notifications (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          title TEXT NOT NULL,
          description TEXT NOT NULL,
          item_ref TEXT,
          type TEXT DEFAULT 'general',
          is_read INTEGER DEFAULT 0,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )`
      )
      .run()
      .catch(() => {});
    const id = `notif_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    await db
      .prepare(
        `INSERT INTO notifications (id, user_id, title, description, item_ref, type, is_read, created_at)
         VALUES (?, ?, ?, ?, ?, ?, 0, CURRENT_TIMESTAMP)`
      )
      .bind(id, String(userId), String(title).slice(0, 180), String(description).slice(0, 1000), itemRef || null, type)
      .run()
      .catch(() => {});
  } catch {}
}

/**
 * Calcule l'état global de blocage et d'alerte d'un utilisateur pour
 * les garde-fous backend (`service_only` / `read_only` / `full_account`)
 * et la bannière d'alerte StudyCloud (y compris réductions de stockage en attente et délais de récupération de données).
 */
export async function evaluateUserBillingGuard(
  db: any,
  userId: string
): Promise<{
  fullAccountBlocked: boolean;
  readOnlyBlocked: boolean;
  blockedSubscriptions: Array<{
    id: string;
    productType: string;
    appKey: string;
    appName: string;
    planName: string;
    blockScope: BillingBlockScope;
    blockedAt: string | null;
    priceAmount: number;
    currency: string;
  }>;
  graceSubscriptions: Array<{
    id: string;
    productType: string;
    appKey: string;
    appName: string;
    planName: string;
    status: string;
    graceUntil: string | null;
    currentPeriodEnd: string | null;
    blockScope: BillingBlockScope;
    priceAmount: number;
    currency: string;
  }>;
  pendingDowngrades: Array<{
    id: string;
    currentPaidMb: number;
    targetPaidMb: number;
    currentMonthlyPrice: number;
    targetMonthlyPrice: number;
    consumedProrataAmount: number;
    daysUsed: number;
    durationDays: number;
    currency: string;
    createdAt: string | null;
  }>;
  dataPurgeWarnings: Array<{
    subscriptionId: string;
    planName: string;
    excessBytes: number;
    retentionDays: number;
    purgeDeadlineAt: string;
    daysRemaining: number;
  }>;
}> {
  const res = await db
    .prepare(
      `SELECT id, product_type, app_key, app_name, plan_name, status,
              block_scope, blocked_at, grace_until, current_period_end,
              price_amount, currency
       FROM active_subscriptions
       WHERE user_id = ? AND status IN ('blocked', 'grace', 'past_due')
       ORDER BY updated_at DESC`
    )
    .bind(userId)
    .all()
    .catch(() => ({ results: [] }));

  const blockedSubscriptions: any[] = [];
  const graceSubscriptions: any[] = [];
  let fullAccountBlocked = false;
  let readOnlyBlocked = false;

  for (const r of res.results || []) {
    const scope = (['service_only', 'read_only', 'full_account'].includes(String(r.block_scope || ''))
      ? String(r.block_scope)
      : 'service_only') as BillingBlockScope;

    if (r.status === 'blocked') {
      if (scope === 'full_account') fullAccountBlocked = true;
      if (scope === 'read_only') readOnlyBlocked = true;
      blockedSubscriptions.push({
        id: String(r.id),
        productType: String(r.product_type || ''),
        appKey: String(r.app_key || ''),
        appName: String(r.app_name || r.plan_name || ''),
        planName: String(r.plan_name || ''),
        blockScope: scope,
        blockedAt: r.blocked_at || null,
        priceAmount: Number(r.price_amount || 0),
        currency: String(r.currency || 'XOF'),
      });
    } else {
      graceSubscriptions.push({
        id: String(r.id),
        productType: String(r.product_type || ''),
        appKey: String(r.app_key || ''),
        appName: String(r.app_name || r.plan_name || ''),
        planName: String(r.plan_name || ''),
        status: String(r.status || 'grace'),
        graceUntil: r.grace_until || null,
        currentPeriodEnd: r.current_period_end || null,
        blockScope: scope,
        priceAmount: Number(r.price_amount || 0),
        currency: String(r.currency || 'XOF'),
      });
    }
  }

  // Demandes de réduction de stockage en attente de règlement prorata
  const dgRes = await db
    .prepare(
      `SELECT id, current_paid_mb, target_paid_mb, current_monthly_price, target_monthly_price,
              consumed_prorata_amount, days_used, duration_days, currency, created_at
       FROM storage_downgrade_requests
       WHERE user_id = ? AND status = 'pending_payment'
       ORDER BY created_at DESC LIMIT 5`
    )
    .bind(userId)
    .all()
    .catch(() => ({ results: [] }));

  const pendingDowngrades = (dgRes.results || []).map((d: any) => ({
    id: String(d.id),
    currentPaidMb: Number(d.current_paid_mb || 0),
    targetPaidMb: Number(d.target_paid_mb || 0),
    currentMonthlyPrice: Number(d.current_monthly_price || 0),
    targetMonthlyPrice: Number(d.target_monthly_price || 0),
    consumedProrataAmount: Number(d.consumed_prorata_amount || 0),
    daysUsed: Number(d.days_used || 0),
    durationDays: Number(d.duration_days || 30),
    currency: String(d.currency || 'XOF'),
    createdAt: d.created_at || null,
  }));

  // Avertissements de délai de récupération des données payantes après annulation
  const purgeRes = await db
    .prepare(
      `SELECT id, plan_name, excess_bytes_at_cancel, data_retention_days, data_purge_deadline_at
       FROM active_subscriptions
       WHERE user_id = ?
         AND product_type = 'storage'
         AND status = 'cancelled'
         AND data_purge_deadline_at IS NOT NULL
         AND data_purged_at IS NULL
         AND COALESCE(excess_bytes_at_cancel, 0) > 0
       ORDER BY updated_at DESC LIMIT 3`
    )
    .bind(userId)
    .all()
    .catch(() => ({ results: [] }));

  const nowMs = Date.now();
  const dataPurgeWarnings = (purgeRes.results || []).map((p: any) => {
    const dlMs = Date.parse(String(p.data_purge_deadline_at || ''));
    const daysRemaining = Number.isFinite(dlMs)
      ? Math.max(0, Math.ceil((dlMs - nowMs) / (24 * 60 * 60 * 1000)))
      : 0;
    return {
      subscriptionId: String(p.id),
      planName: String(p.plan_name || 'Stockage Cloud'),
      excessBytes: Number(p.excess_bytes_at_cancel || 0),
      retentionDays: Number(p.data_retention_days || 14),
      purgeDeadlineAt: String(p.data_purge_deadline_at),
      daysRemaining,
    };
  });

  return {
    fullAccountBlocked,
    readOnlyBlocked,
    blockedSubscriptions,
    graceSubscriptions,
    pendingDowngrades,
    dataPurgeWarnings,
  };
}
