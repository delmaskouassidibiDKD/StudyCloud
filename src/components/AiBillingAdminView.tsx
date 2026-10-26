import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  RefreshCw,
  Coins,
  Sliders,
  Users,
  Clock,
  Sparkles,
  Zap,
  Gift,
  ShieldAlert,
  Search,
  CheckCircle2,
  AlertCircle,
  PlusCircle,
  TrendingDown,
  Activity,
  History,
  Check,
  Calendar,
  X
} from 'lucide-react';
import {
  getAiBillingConfig,
  saveAiBillingConfig,
  getAiAdminUsers,
  adjustUserAiCredits,
  getAiUsageLogs,
  AiBillingConfig,
  AiUserCreditProfile,
  AiUsageLogItem
} from '../services/api';

interface AiBillingAdminViewProps {
  onBack?: () => void;
}

export const AiBillingAdminView: React.FC<AiBillingAdminViewProps> = ({ onBack }) => {
  // Onglets : 'config' (Règles Formule 2), 'users' (Portefeuilles), 'logs' (Audit temps réel)
  const [activeTab, setActiveTab] = useState<'config' | 'users' | 'logs'>('config');

  // Configuration de facturation
  const [config, setConfig] = useState<AiBillingConfig>({
    tokens_per_credit: 1000,
    welcome_credits: 50.0,
    daily_free_credits: 0.0,
    is_daily_renewal_active: 0
  });

  // États de chargement et retours
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Données des utilisateurs et logs
  const [users, setUsers] = useState<AiUserCreditProfile[]>([]);
  const [logs, setLogs] = useState<AiUsageLogItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState<'all' | 'depleted' | 'active'>('all');

  // Modal d'ajustement de crédit utilisateur
  const [selectedUser, setSelectedUser] = useState<AiUserCreditProfile | null>(null);
  const [adjustAmount, setAdjustAmount] = useState<number>(50);
  const [adjustAction, setAdjustAction] = useState<'add' | 'set'>('add');
  const [adjustReason, setAdjustReason] = useState<string>('Recharge manuelle par l\'administrateur');
  const [submittingAdjust, setSubmittingAdjust] = useState(false);

  // Charger toutes les données
  const loadData = async (showSpin = false) => {
    if (showSpin) setRefreshing(true);
    else setLoading(true);

    try {
      const [cfgRes, usersRes, logsRes] = await Promise.all([
        getAiBillingConfig(),
        getAiAdminUsers(),
        getAiUsageLogs()
      ]);

      if (cfgRes?.success && cfgRes.config) {
        setConfig(cfgRes.config);
      }
      if (usersRes?.success && Array.isArray(usersRes.users)) {
        setUsers(usersRes.users);
      }
      if (logsRes?.success && Array.isArray(logsRes.logs)) {
        setLogs(logsRes.logs);
      }
    } catch (err: any) {
      console.warn('[AiBillingAdminView] Erreur chargement données:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Afficher une notification temporaire
  const showToast = (type: 'success' | 'error', text: string) => {
    setToastMessage({ type, text });
    setTimeout(() => {
      setToastMessage(null);
    }, 4500);
  };

  // Sauvegarder la configuration de facturation
  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingConfig(true);
    try {
      const res = await saveAiBillingConfig(config);
      if (res.success) {
        showToast('success', 'Règles de facturation (Formule 2) enregistrées avec succès et appliquées à l\'IA !');
      } else {
        showToast('error', res.error || 'Erreur lors de la sauvegarde de la configuration');
      }
    } catch (err: any) {
      showToast('error', err?.message || 'Erreur réseau');
    } finally {
      setSavingConfig(false);
    }
  };

  // Valider l'ajustement de crédits pour un utilisateur
  const handleConfirmAdjust = async () => {
    if (!selectedUser) return;
    setSubmittingAdjust(true);
    try {
      const res = await adjustUserAiCredits(selectedUser.id, adjustAmount, adjustAction, adjustReason);
      if (res.success) {
        showToast('success', `Solde mis à jour pour ${selectedUser.name || selectedUser.id} !`);
        setSelectedUser(null);
        await loadData(true);
      } else {
        showToast('error', res.error || 'Erreur lors de la modification des crédits');
      }
    } catch (err: any) {
      showToast('error', err?.message || 'Erreur réseau');
    } finally {
      setSubmittingAdjust(false);
    }
  };

  // Filtrage des utilisateurs
  const filteredUsers = users.filter((u) => {
    const matchesSearch =
      (u.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (u.email || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (u.phone || '').includes(searchQuery) ||
      (u.id || '').toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;
    if (filterMode === 'depleted') return (u.credits_balance || 0) <= 0;
    if (filterMode === 'active') return (u.credits_balance || 0) > 0;
    return true;
  });

  // Métriques de synthèse
  const totalTokensSum = users.reduce((acc, u) => acc + (Number(u.total_tokens_consumed) || 0), 0);
  const totalCreditsInCirculation = users.reduce((acc, u) => acc + (Number(u.credits_balance) || 0), 0);
  const depletedUsersCount = users.filter(u => (u.credits_balance || 0) <= 0).length;

  return (
    <div className="absolute inset-x-0 bottom-0 top-[62px] md:top-[66px] md:left-64 z-30 w-full md:w-[calc(100%-16rem)] bg-[#F5F2EC] dark:bg-[#0b0f19] text-[#2D4A3E] dark:text-slate-100 overflow-y-auto overflow-x-hidden transition-colors duration-300">

      {/* ── TOAST NOTIFICATION ── */}
      {toastMessage && (
        <div className="fixed top-20 right-6 z-50 animate-in slide-in-from-top-3 fade-in duration-300">
          <div
            className={`flex items-center gap-2.5 px-4 py-3 rounded-2xl shadow-2xl border text-sm font-bold ${
              toastMessage.type === 'success'
                ? 'bg-emerald-600 text-white border-emerald-400'
                : 'bg-red-600 text-white border-red-400'
            }`}
          >
            {toastMessage.type === 'success' ? <CheckCircle2 className="w-5 h-5 shrink-0" /> : <AlertCircle className="w-5 h-5 shrink-0" />}
            <span>{toastMessage.text}</span>
          </div>
        </div>
      )}

      {/* ======================================================================
          HERO HEADER — Style Cyber Admin Améthyste / Ambre
          ====================================================================== */}
      <div className="relative w-full bg-gradient-to-br from-[#1E293B] via-[#0F172A] to-[#3B1F69] dark:from-[#070B14] dark:via-[#0F172A] dark:to-[#220B3B] p-5 sm:p-6 md:p-8 border-b-2 border-stone-200 dark:border-slate-800 shadow-md">
        <div className="max-w-[1500px] mx-auto">
          {/* Ligne haute : navigation & actions */}
          <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
            <div className="flex items-center gap-3">
              {onBack && (
                <button
                  onClick={onBack}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white font-bold text-xs rounded-xl border border-white/20 backdrop-blur-sm transition-all cursor-pointer"
                  title="Retour au Tableau de Bord"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span className="hidden sm:inline">Tableau de bord</span>
                </button>
              )}
              <div className="flex items-center gap-2 px-3 py-1 bg-amber-500/20 border border-amber-400/40 rounded-xl text-amber-300 text-xs font-black uppercase tracking-wider">
                <Sliders className="w-3.5 h-3.5" />
                <span>Panneau Administrateur</span>
              </div>
            </div>

            <button
              onClick={() => loadData(true)}
              disabled={refreshing || loading}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-xl border border-white/20 backdrop-blur-sm transition-all text-xs font-bold cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-amber-300' : ''}`} />
              <span>Actualiser</span>
            </button>
          </div>

          {/* Titre et sous-titre */}
          <div className="space-y-1 mb-6">
            <h1 className="text-xl sm:text-2xl md:text-3xl font-black text-white tracking-tight flex items-center gap-2.5">
              <Coins className="w-7 h-7 text-amber-400" />
              <span>Facturation & Quotas IA — Formule Proportionnelle</span>
            </h1>
            <p className="text-xs sm:text-sm text-stone-300 dark:text-slate-300 max-w-3xl">
              Définissez la formule de facturation au token, configurez les crédits offerts et gérez en direct le portefeuille de chaque utilisateur dans Cloudflare D1.
            </p>
          </div>

          {/* KPI CARDS (4 Cartes Synthèse) */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {/* Taux actif */}
            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/15">
              <span className="text-[11px] font-bold text-amber-300 uppercase tracking-wider block mb-1">
                Taux Actif (Formule 2)
              </span>
              <p className="text-xl sm:text-2xl font-black text-white leading-tight">
                1 Crédit = {config.tokens_per_credit} Tokens
              </p>
              <p className="text-[10px] text-white/60 mt-1">
                {(1000 / config.tokens_per_credit).toFixed(2)} crédit(s) pour 1 000 tokens
              </p>
            </div>

            {/* Cadeau Bienvenue */}
            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/15">
              <span className="text-[11px] font-bold text-emerald-300 uppercase tracking-wider block mb-1">
                Offert Inscription
              </span>
              <p className="text-xl sm:text-2xl font-black text-white leading-tight">
                {config.welcome_credits} Crédits
              </p>
              <p className="text-[10px] text-white/60 mt-1">Crédités au 1er échange IA</p>
            </div>

            {/* Quota Quotidien */}
            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/15">
              <span className="text-[11px] font-bold text-sky-300 uppercase tracking-wider block mb-1">
                Recharge Quotidienne
              </span>
              <p className="text-xl sm:text-2xl font-black text-white leading-tight">
                {config.is_daily_renewal_active ? `+${config.daily_free_credits}/jour` : 'Désactivée'}
              </p>
              <p className="text-[10px] text-white/60 mt-1">
                {config.is_daily_renewal_active ? 'Renouvelé chaque minuit' : '0 crédit automatique'}
              </p>
            </div>

            {/* Tokens cumulés */}
            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/15">
              <span className="text-[11px] font-bold text-purple-300 uppercase tracking-wider block mb-1">
                Tokens IA Consommés
              </span>
              <p className="text-xl sm:text-2xl font-black text-white leading-tight">
                {totalTokensSum.toLocaleString('fr-FR')}
              </p>
              <p className="text-[10px] text-white/60 mt-1">Sur l'ensemble de la plateforme</p>
            </div>
          </div>
        </div>
      </div>

      {/* ======================================================================
          ONGLETS PRINCIPAUX
          ====================================================================== */}
      <div className="max-w-[1500px] mx-auto px-4 sm:px-6 py-6">
        <div className="flex items-center gap-2 border-b-2 border-stone-200 dark:border-slate-800 pb-3 mb-6 overflow-x-auto">
          <button
            onClick={() => setActiveTab('config')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-extrabold transition-all cursor-pointer shrink-0 ${
              activeTab === 'config'
                ? 'bg-orange-500 text-white shadow-md'
                : 'bg-white dark:bg-slate-900 text-stone-600 dark:text-slate-300 hover:bg-stone-100 dark:hover:bg-slate-800 border border-stone-200 dark:border-slate-800'
            }`}
          >
            <Sliders className="w-4 h-4" />
            <span>1. Règles de Facturation (Formule 2)</span>
          </button>

          <button
            onClick={() => setActiveTab('users')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-extrabold transition-all cursor-pointer shrink-0 ${
              activeTab === 'users'
                ? 'bg-orange-500 text-white shadow-md'
                : 'bg-white dark:bg-slate-900 text-stone-600 dark:text-slate-300 hover:bg-stone-100 dark:hover:bg-slate-800 border border-stone-200 dark:border-slate-800'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>2. Portefeuilles Utilisateurs ({users.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('logs')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-extrabold transition-all cursor-pointer shrink-0 ${
              activeTab === 'logs'
                ? 'bg-orange-500 text-white shadow-md'
                : 'bg-white dark:bg-slate-900 text-stone-600 dark:text-slate-300 hover:bg-stone-100 dark:hover:bg-slate-800 border border-stone-200 dark:border-slate-800'
            }`}
          >
            <Activity className="w-4 h-4" />
            <span>3. Audit & Débits en Temps Réel ({logs.length})</span>
          </button>
        </div>

        {/* ====================================================================
            ONGLET 1 : RÈGLES DE FACTURATION & ÉQUIVALENCE TOKENS/CRÉDITS
            ==================================================================== */}
        {activeTab === 'config' && (
          <form onSubmit={handleSaveConfig} className="space-y-6 max-w-4xl">
            {/* Boîte d'information */}
            <div className="p-4 bg-amber-50 dark:bg-amber-950/40 border-2 border-amber-300 dark:border-amber-800 rounded-2xl flex items-start gap-3 text-amber-900 dark:text-amber-200 text-xs sm:text-sm">
              <Sparkles className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <strong>Fonctionnement de la Formule 2 (Proportionnelle aux Tokens) :</strong>
                <p className="mt-1 text-xs text-amber-800 dark:text-amber-300">
                  À chaque question posée ou création générée, l'IA calcule le nombre exact de tokens consommés (mots générés + prompt). 
                  Le serveur divise ce nombre par votre équivalence définie ci-dessous et déduit immédiatement le résultat du solde de l'utilisateur. 
                  Si son solde atteint 0 crédit, l'IA lui demande de recharger.
                </p>
              </div>
            </div>

            {/* Carte 1 : Taux de conversion */}
            <div className="bg-white dark:bg-[#131b2e] rounded-3xl border-2 border-stone-200 dark:border-slate-800 p-6 shadow-sm space-y-4">
              <div className="flex items-center gap-3">
                <span className="p-3 bg-orange-100 dark:bg-orange-950/60 text-orange-600 dark:text-orange-400 rounded-2xl">
                  <Coins className="w-6 h-6" />
                </span>
                <div>
                  <h2 className="text-base sm:text-lg font-black text-stone-900 dark:text-white">
                    Équivalence Tokens ↔ Crédits (Formule 2)
                  </h2>
                  <p className="text-xs text-stone-500 dark:text-slate-400">
                    Définissez combien de tokens IA réels valent 1 Crédit pour l'utilisateur.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                <div>
                  <label className="block text-xs font-bold text-stone-700 dark:text-slate-300 mb-1.5">
                    Nombre de Tokens pour 1 Crédit
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min={10}
                      step={50}
                      value={config.tokens_per_credit}
                      onChange={(e) => setConfig({ ...config, tokens_per_credit: Math.max(10, parseInt(e.target.value) || 1000) })}
                      className="w-full px-4 py-3 bg-stone-50 dark:bg-slate-900 border-2 border-stone-200 dark:border-slate-700 rounded-xl font-black text-lg text-stone-900 dark:text-white focus:outline-none focus:border-orange-500"
                      required
                    />
                    <span className="absolute right-4 top-3.5 text-xs font-bold text-stone-400">Tokens / Crédit</span>
                  </div>
                  <p className="text-[11px] text-stone-400 mt-1">Recommandé : 1 000 tokens (environ 750 mots) pour 1 crédit.</p>
                </div>

                {/* Simulateur interactif en direct */}
                <div className="p-4 bg-stone-50 dark:bg-slate-900/60 border border-stone-200 dark:border-slate-800 rounded-2xl space-y-2">
                  <span className="text-[11px] font-bold text-orange-600 dark:text-orange-400 uppercase tracking-wider block">
                    Simulation en direct
                  </span>
                  <div className="text-xs space-y-1 text-stone-600 dark:text-slate-300">
                    <p>
                      • Échange court (<strong>350 tokens</strong>) ={' '}
                      <strong className="text-emerald-600 dark:text-emerald-400">
                        {Math.max(0.01, +(350 / config.tokens_per_credit).toFixed(2))} crédit
                      </strong>
                    </p>
                    <p>
                      • Question complète (<strong>850 tokens</strong>) ={' '}
                      <strong className="text-emerald-600 dark:text-emerald-400">
                        {Math.max(0.01, +(850 / config.tokens_per_credit).toFixed(2))} crédit
                      </strong>
                    </p>
                    <p>
                      • Synthèse de cours PDF (<strong>3 200 tokens</strong>) ={' '}
                      <strong className="text-orange-600 dark:text-orange-400">
                        {Math.max(0.01, +(3200 / config.tokens_per_credit).toFixed(2))} crédits
                      </strong>
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Carte 2 : Crédits de bienvenue */}
            <div className="bg-white dark:bg-[#131b2e] rounded-3xl border-2 border-stone-200 dark:border-slate-800 p-6 shadow-sm space-y-4">
              <div className="flex items-center gap-3">
                <span className="p-3 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 rounded-2xl">
                  <Gift className="w-6 h-6" />
                </span>
                <div>
                  <h2 className="text-base sm:text-lg font-black text-stone-900 dark:text-white">
                    Crédits de Bienvenue (Cadeau d'inscription)
                  </h2>
                  <p className="text-xs text-stone-500 dark:text-slate-400">
                    Solde initial offert automatiquement à tout nouvel utilisateur lors de sa première utilisation.
                  </p>
                </div>
              </div>

              <div className="max-w-md pt-2">
                <label className="block text-xs font-bold text-stone-700 dark:text-slate-300 mb-1.5">
                  Montant de bienvenue offert
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min={0}
                    step={5}
                    value={config.welcome_credits}
                    onChange={(e) => setConfig({ ...config, welcome_credits: Math.max(0, parseFloat(e.target.value) || 0) })}
                    className="w-full px-4 py-3 bg-stone-50 dark:bg-slate-900 border-2 border-stone-200 dark:border-slate-700 rounded-xl font-black text-lg text-stone-900 dark:text-white focus:outline-none focus:border-emerald-500"
                    required
                  />
                  <span className="absolute right-4 top-3.5 text-xs font-bold text-stone-400">Crédits offerts</span>
                </div>
                <p className="text-[11px] text-stone-400 mt-1">Actuellement : 50 crédits (Pack Découverte Étudiant).</p>
              </div>
            </div>

            {/* Carte 3 : Crédits Quotidiens Renouvelables */}
            <div className="bg-white dark:bg-[#131b2e] rounded-3xl border-2 border-stone-200 dark:border-slate-800 p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="p-3 bg-sky-100 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400 rounded-2xl">
                    <Calendar className="w-6 h-6" />
                  </span>
                  <div>
                    <h2 className="text-base sm:text-lg font-black text-stone-900 dark:text-white">
                      Crédits Gratuits Quotidiens (Renouvellement automatique)
                    </h2>
                    <p className="text-xs text-stone-500 dark:text-slate-400">
                      Recharge automatiquement un quota gratuit chaque jour à minuit pour encourager la fidélité.
                    </p>
                  </div>
                </div>

                {/* Switch toggle */}
                <label className="relative inline-flex items-center cursor-pointer shrink-0">
                  <input
                    type="checkbox"
                    checked={Boolean(config.is_daily_renewal_active)}
                    onChange={(e) => setConfig({ ...config, is_daily_renewal_active: e.target.checked ? 1 : 0 })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-stone-300 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-stone-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-sky-500" />
                </label>
              </div>

              {Boolean(config.is_daily_renewal_active) && (
                <div className="max-w-md pt-2 border-t border-stone-100 dark:border-slate-800">
                  <label className="block text-xs font-bold text-stone-700 dark:text-slate-300 mb-1.5">
                    Crédits offerts chaque jour à chaque utilisateur
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min={1}
                      step={1}
                      value={config.daily_free_credits}
                      onChange={(e) => setConfig({ ...config, daily_free_credits: Math.max(0, parseFloat(e.target.value) || 0) })}
                      className="w-full px-4 py-3 bg-stone-50 dark:bg-slate-900 border-2 border-stone-200 dark:border-slate-700 rounded-xl font-black text-lg text-stone-900 dark:text-white focus:outline-none focus:border-sky-500"
                    />
                    <span className="absolute right-4 top-3.5 text-xs font-bold text-stone-400">Crédits / Jour</span>
                  </div>
                  <p className="text-[11px] text-stone-400 mt-1">Exemple : 5 crédits offerts tous les matins dès leur première connexion.</p>
                </div>
              )}
            </div>

            {/* Bouton de sauvegarde principal */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={savingConfig}
                className="w-full sm:w-auto px-8 py-4 bg-gradient-to-r from-orange-500 via-amber-500 to-orange-600 hover:from-orange-600 hover:to-amber-600 text-white font-black text-sm rounded-2xl shadow-xl transition-all cursor-pointer hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2.5"
              >
                <Check className="w-5 h-5" />
                <span>{savingConfig ? 'Enregistrement dans Cloudflare D1...' : 'Enregistrer & Appliquer à l\'IA'}</span>
              </button>
            </div>
          </form>
        )}

        {/* ====================================================================
            ONGLET 2 : PORTEFEUILLES UTILISATEURS & AJOUT DE CRÉDITS
            ==================================================================== */}
        {activeTab === 'users' && (
          <div className="space-y-4">
            {/* Barre de recherche et filtres */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white dark:bg-[#131b2e] p-4 rounded-2xl border-2 border-stone-200 dark:border-slate-800 shadow-sm">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-3.5" />
                <input
                  type="text"
                  placeholder="Rechercher par nom, email, téléphone ou ID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-stone-50 dark:bg-slate-900 border border-stone-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm font-medium text-stone-900 dark:text-white focus:outline-none focus:border-orange-500"
                />
              </div>

              {/* Filtres de statut */}
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  onClick={() => setFilterMode('all')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    filterMode === 'all'
                      ? 'bg-stone-900 dark:bg-white text-white dark:text-stone-900'
                      : 'bg-stone-100 dark:bg-slate-800 text-stone-600 dark:text-slate-300'
                  }`}
                >
                  Tous ({users.length})
                </button>
                <button
                  onClick={() => setFilterMode('active')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    filterMode === 'active'
                      ? 'bg-emerald-600 text-white'
                      : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300'
                  }`}
                >
                  Crédit &gt; 0
                </button>
                <button
                  onClick={() => setFilterMode('depleted')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    filterMode === 'depleted'
                      ? 'bg-red-600 text-white'
                      : 'bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300'
                  }`}
                >
                  Épuisé ({depletedUsersCount})
                </button>
              </div>
            </div>

            {/* Tableau des utilisateurs */}
            <div className="bg-white dark:bg-[#131b2e] rounded-3xl border-2 border-stone-200 dark:border-slate-800 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs sm:text-sm">
                  <thead>
                    <tr className="bg-stone-50 dark:bg-slate-900/60 border-b border-stone-200 dark:border-slate-800 text-stone-500 dark:text-slate-400 font-bold uppercase tracking-wider text-[11px]">
                      <th className="py-3.5 px-4">Utilisateur</th>
                      <th className="py-3.5 px-4 text-center">Solde Disponible</th>
                      <th className="py-3.5 px-4 text-center">Tokens IA Utilisés</th>
                      <th className="py-3.5 px-4 text-center">Crédits Dépensés</th>
                      <th className="py-3.5 px-4 text-center">Dernière Utilisation</th>
                      <th className="py-3.5 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100 dark:divide-slate-800">
                    {filteredUsers.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-12 text-center text-stone-400 text-xs">
                          Aucun utilisateur trouvé correspondant à votre recherche.
                        </td>
                      </tr>
                    ) : (
                      filteredUsers.map((u) => {
                        const balance = Number(u.credits_balance) || 0;
                        const isDepleted = balance <= 0;
                        const isLow = balance > 0 && balance <= 10;

                        return (
                          <tr key={u.id} className="hover:bg-stone-50/80 dark:hover:bg-slate-800/40 transition-colors">
                            {/* Utilisateur */}
                            <td className="py-3.5 px-4">
                              <div className="font-extrabold text-stone-900 dark:text-white leading-tight">
                                {u.name || 'Étudiant'}
                              </div>
                              <div className="text-[11px] text-stone-400 mt-0.5 font-mono">
                                {u.email || u.phone || u.id}
                              </div>
                              {u.school && (
                                <div className="text-[10px] text-stone-500 dark:text-slate-400 mt-0.5">
                                  {u.school} {u.filiere ? `• ${u.filiere}` : ''}
                                </div>
                              )}
                            </td>

                            {/* Solde Disponible */}
                            <td className="py-3.5 px-4 text-center">
                              <span
                                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl font-black text-xs ${
                                  isDepleted
                                    ? 'bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-300 border border-red-300 dark:border-red-800'
                                    : isLow
                                    ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-800'
                                    : 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800'
                                }`}
                              >
                                <Zap className="w-3.5 h-3.5" />
                                {balance.toFixed(2)} Crédits
                              </span>
                            </td>

                            {/* Tokens consommés */}
                            <td className="py-3.5 px-4 text-center font-bold text-stone-700 dark:text-slate-300 font-mono">
                              {(Number(u.total_tokens_consumed) || 0).toLocaleString('fr-FR')}
                            </td>

                            {/* Crédits dépensés */}
                            <td className="py-3.5 px-4 text-center text-stone-500 dark:text-slate-400">
                              {(Number(u.total_credits_consumed) || 0).toFixed(2)}
                            </td>

                            {/* Dernière utilisation */}
                            <td className="py-3.5 px-4 text-center text-[11px] text-stone-400">
                              {u.last_usage_at ? new Date(u.last_usage_at).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }) : 'Jamais'}
                            </td>

                            {/* Bouton Action */}
                            <td className="py-3.5 px-4 text-right">
                              <button
                                onClick={() => {
                                  setSelectedUser(u);
                                  setAdjustAmount(50);
                                  setAdjustAction('add');
                                }}
                                className="px-3.5 py-1.5 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-extrabold text-xs rounded-xl shadow-sm transition-all cursor-pointer hover:scale-105 active:scale-95"
                              >
                                + Créditer
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ====================================================================
            ONGLET 3 : JOURNAL D'AUDIT EN DIRECT (LOGS)
            ==================================================================== */}
        {activeTab === 'logs' && (
          <div className="bg-white dark:bg-[#131b2e] rounded-3xl border-2 border-stone-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-stone-100 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-extrabold text-stone-900 dark:text-white">
                  Historique en temps réel des consommations IA
                </h3>
                <p className="text-xs text-stone-500 dark:text-slate-400">
                  Chaque débit est tracé avec les tokens réels retournés par les modèles Llama 3.3 / Gemini.
                </p>
              </div>
              <button
                onClick={() => loadData(true)}
                className="px-3 py-1 bg-stone-100 dark:bg-slate-800 hover:bg-stone-200 text-stone-700 dark:text-slate-200 rounded-lg text-xs font-bold transition-all cursor-pointer"
              >
                Actualiser
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs sm:text-sm">
                <thead>
                  <tr className="bg-stone-50 dark:bg-slate-900/60 border-b border-stone-200 dark:border-slate-800 text-stone-500 dark:text-slate-400 font-bold uppercase tracking-wider text-[11px]">
                    <th className="py-3 px-4">Date & Heure</th>
                    <th className="py-3 px-4">Utilisateur</th>
                    <th className="py-3 px-4">Action / Création</th>
                    <th className="py-3 px-4 text-center">Tokens Réels</th>
                    <th className="py-3 px-4 text-center">Crédits Prélevés</th>
                    <th className="py-3 px-4 text-center">Solde Après</th>
                    <th className="py-3 px-4">Modèle IA</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100 dark:divide-slate-800">
                  {logs.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-stone-400 text-xs">
                        Aucune transaction enregistrée pour le moment. Dès qu'un utilisateur enverra un message à l'IA, le débit apparaîtra ici.
                      </td>
                    </tr>
                  ) : (
                    logs.map((log) => (
                      <tr key={log.id} className="hover:bg-stone-50/80 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="py-3 px-4 text-stone-500 dark:text-slate-400 whitespace-nowrap text-xs font-mono">
                          {log.created_at ? new Date(log.created_at).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'medium' }) : '-'}
                        </td>
                        <td className="py-3 px-4 font-bold text-stone-900 dark:text-white">
                          {log.user_name || log.user_id}
                        </td>
                        <td className="py-3 px-4 font-mono text-[11px] text-stone-600 dark:text-slate-300">
                          {log.action_type}
                        </td>
                        <td className="py-3 px-4 text-center font-mono font-bold text-stone-700 dark:text-slate-200">
                          {(Number(log.total_tokens) || 0).toLocaleString('fr-FR')}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span
                            className={`font-black font-mono text-xs ${
                              Number(log.credits_deducted) > 0 ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'
                            }`}
                          >
                            {Number(log.credits_deducted) > 0 ? `-${Number(log.credits_deducted).toFixed(2)}` : `+${Math.abs(Number(log.credits_deducted)).toFixed(2)}`}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center font-bold font-mono text-xs text-stone-600 dark:text-slate-300">
                          {log.balance_after !== undefined ? Number(log.balance_after).toFixed(2) : '-'}
                        </td>
                        <td className="py-3 px-4 text-[11px] text-stone-400 font-mono">
                          {log.model_used || 'Llama 3.3'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* ======================================================================
          MODAL : AJOUTER / AJUSTER DES CRÉDITS UTILISATEUR
          ====================================================================== */}
      {selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-[#131b2e] rounded-3xl border-2 border-stone-200 dark:border-slate-700 max-w-lg w-full p-6 shadow-2xl space-y-5 animate-in zoom-in-95 duration-200">
            {/* Header du modal */}
            <div className="flex items-center justify-between border-b border-stone-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <span className="p-2 bg-orange-100 dark:bg-orange-950/60 text-orange-600 rounded-xl">
                  <Coins className="w-5 h-5" />
                </span>
                <h3 className="font-black text-base sm:text-lg text-stone-900 dark:text-white">
                  Ajuster les Crédits IA
                </h3>
              </div>
              <button
                onClick={() => setSelectedUser(null)}
                className="p-1 text-stone-400 hover:text-stone-600 dark:hover:text-white rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Infos utilisateur */}
            <div className="p-3 bg-stone-50 dark:bg-slate-900 rounded-2xl border border-stone-200 dark:border-slate-800">
              <div className="text-xs text-stone-400 uppercase font-bold">Compte sélectionné :</div>
              <div className="font-extrabold text-sm text-stone-900 dark:text-white mt-0.5">
                {selectedUser.name || 'Étudiant'} ({selectedUser.email || selectedUser.id})
              </div>
              <div className="flex items-center gap-2 mt-2 text-xs">
                <span className="text-stone-500 dark:text-slate-400">Solde actuel :</span>
                <strong className="text-emerald-600 dark:text-emerald-400 font-black">
                  {(Number(selectedUser.credits_balance) || 0).toFixed(2)} Crédits
                </strong>
              </div>
            </div>

            {/* Choix Action : Ajouter ou Définir */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-stone-700 dark:text-slate-300">
                Type d'opération
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setAdjustAction('add')}
                  className={`py-2 px-3 rounded-xl font-bold text-xs transition-all cursor-pointer border ${
                    adjustAction === 'add'
                      ? 'bg-orange-500 text-white border-orange-500 shadow-sm'
                      : 'bg-stone-50 dark:bg-slate-900 text-stone-600 dark:text-slate-400 border-stone-200 dark:border-slate-800'
                  }`}
                >
                  + Ajouter au solde
                </button>
                <button
                  type="button"
                  onClick={() => setAdjustAction('set')}
                  className={`py-2 px-3 rounded-xl font-bold text-xs transition-all cursor-pointer border ${
                    adjustAction === 'set'
                      ? 'bg-orange-500 text-white border-orange-500 shadow-sm'
                      : 'bg-stone-50 dark:bg-slate-900 text-stone-600 dark:text-slate-400 border-stone-200 dark:border-slate-800'
                  }`}
                >
                  = Définir le solde exact
                </button>
              </div>
            </div>

            {/* Presets rapides de crédits */}
            {adjustAction === 'add' && (
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-stone-700 dark:text-slate-300">
                  Raccourcis rapides
                </label>
                <div className="flex flex-wrap gap-2">
                  {[10, 25, 50, 100, 250, 500].map((val) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setAdjustAmount(val)}
                      className={`px-3 py-1.5 rounded-xl font-black text-xs transition-all cursor-pointer ${
                        adjustAmount === val
                          ? 'bg-emerald-600 text-white shadow-sm'
                          : 'bg-stone-100 dark:bg-slate-800 text-stone-700 dark:text-slate-300 hover:bg-stone-200'
                      }`}
                    >
                      +{val}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Montant exact */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-stone-700 dark:text-slate-300">
                Montant de crédits {adjustAction === 'add' ? 'à ajouter' : 'à attribuer'}
              </label>
              <input
                type="number"
                min={0}
                step={1}
                value={adjustAmount}
                onChange={(e) => setAdjustAmount(parseFloat(e.target.value) || 0)}
                className="w-full px-4 py-3 bg-stone-50 dark:bg-slate-900 border-2 border-stone-200 dark:border-slate-700 rounded-xl font-black text-lg text-stone-900 dark:text-white focus:outline-none focus:border-orange-500"
                required
              />
            </div>

            {/* Motif / Raison */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-stone-700 dark:text-slate-300">
                Motif (Note d'audit)
              </label>
              <input
                type="text"
                value={adjustReason}
                onChange={(e) => setAdjustReason(e.target.value)}
                placeholder="Ex: Validation reçu Wave, cadeau de fidélité..."
                className="w-full px-3.5 py-2.5 bg-stone-50 dark:bg-slate-900 border border-stone-200 dark:border-slate-700 rounded-xl text-xs font-medium text-stone-900 dark:text-white focus:outline-none focus:border-orange-500"
              />
            </div>

            {/* Nouveau solde estimé */}
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-800 dark:text-emerald-300 flex items-center justify-between">
              <span>Nouveau solde après validation :</span>
              <strong className="text-sm font-black">
                {adjustAction === 'add'
                  ? ((Number(selectedUser.credits_balance) || 0) + adjustAmount).toFixed(2)
                  : adjustAmount.toFixed(2)}{' '}
                Crédits
              </strong>
            </div>

            {/* Actions du modal */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setSelectedUser(null)}
                className="px-4 py-2.5 bg-stone-100 hover:bg-stone-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-stone-700 dark:text-slate-300 font-bold text-xs rounded-xl cursor-pointer"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleConfirmAdjust}
                disabled={submittingAdjust}
                className="px-5 py-2.5 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-black text-xs rounded-xl shadow-md cursor-pointer disabled:opacity-50 flex items-center gap-2"
              >
                <Check className="w-4 h-4" />
                <span>{submittingAdjust ? 'Sauvegarde dans D1...' : 'Confirmer & Créditer'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
