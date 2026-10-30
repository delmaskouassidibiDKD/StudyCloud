/**
 * ============================================================================
 * STUDYCLOUD - SYSTÈME CENTRALISÉ DE TRADUCTIONS ET D'INTERNATIONALISATION (i18n)
 * ============================================================================
 * Permet d'adapter dynamiquement l'interface (Chat, Studio de créations,
 * visualiseur central, volet Mes créations, boutons et badges) selon la langue
 * sélectionnée, et de persister ce choix durablement.
 * ============================================================================
 */

import { useState, useEffect } from 'react';

export interface SupportedLanguageInfo {
  code: string;
  name: string;
  nativeName: string;
  flag: string;
  promptInstruction: string;
}

export const SUPPORTED_STUDY_LANGUAGES: SupportedLanguageInfo[] = [
  {
    code: 'fr',
    name: 'Français',
    nativeName: 'Français',
    flag: '🇫🇷',
    promptInstruction: 'TU RÉPONDS EXCLUSIVEMENT ET TOTALEMENT EN FRANÇAIS SOIGNÉ, CLAIR ET PÉDAGOGIQUE. Toutes les réponses de discussion et tous les supports interactifs doivent être rédigés à 100% en français.'
  },
  {
    code: 'en',
    name: 'English',
    nativeName: 'English',
    flag: '🇬🇧',
    promptInstruction: 'YOU MUST RESPOND EXCLUSIVELY AND TOTALLY IN HIGH-QUALITY, PEDAGOGICAL ENGLISH. All chat responses, explanations, problem statements, questions and learning creations must be strictly 100% in English.'
  },
  {
    code: 'zh',
    name: 'Chinois',
    nativeName: '中文',
    flag: '🇨🇳',
    promptInstruction: '你必须完全使用标准、严谨且富有教学性的中文进行回答。所有的对话、解析以及生成的交互式学习模块都必须严格100%使用中文 (All responses and creations must be 100% in Chinese).'
  },
  {
    code: 'ja',
    name: 'Japonais',
    nativeName: '日本語',
    flag: '🇯🇵',
    promptInstruction: 'すべての回答、解説、および生成される学習モジュールは、完全に丁寧でわかりやすい日本語で100%記述してください (All responses and creations must be 100% in Japanese).'
  },
  {
    code: 'de',
    name: 'Allemand',
    nativeName: 'Deutsch',
    flag: '🇩🇪',
    promptInstruction: 'DU MUSST AUSSCHLIESSLICH UND VOLLSTÄNDIG AUF DEUTSCH ANTWORTEN. Alle Antworten, Erklärungen und erstellten interaktiven Lernmodule müssen zu 100% auf Deutsch verfasst sein (All responses and creations must be 100% in German).'
  },
  {
    code: 'es',
    name: 'Espagnol',
    nativeName: 'Español',
    flag: '🇪🇸',
    promptInstruction: 'DEBES RESPONDER EXCLUSIVA Y TOTALMENTE EN ESPAÑOL CLARO Y PEDAGÓGICO. Todas las respuestas, explicaciones y creaciones de aprendizaje deben estar al 100% en español (All responses and creations must be 100% in Spanish).'
  },
  {
    code: 'ar',
    name: 'Arabe',
    nativeName: 'العربية',
    flag: '🇸🇦',
    promptInstruction: 'يجب عليك الإجابة حصرياً وبالكامل باللغة العربية الفصحى الواضحة والتعليمية. جميع الردود والشروحات والوحدات التعليمية التفاعلية المنشأة يجب أن تكون بنسبة 100% باللغة العربية (All responses and creations must be 100% in Arabic).'
  },
  {
    code: 'ru',
    name: 'Russe',
    nativeName: 'Русский',
    flag: '🇷🇺',
    promptInstruction: 'ВЫ ДОЛЖНЫ ОТВЕЧАТЬ ИСКЛЮЧИТЕЛЬНО И ПОЛНОСТЬЮ НА РУССКОМ ЯЗЫКЕ. Все ответы, пояснения и интерактивные учебные модули должны быть строго на 100% на русском языке (All responses and creations must be 100% in Russian).'
  },
  {
    code: 'pt',
    name: 'Portugais',
    nativeName: 'Português',
    flag: '🇵🇹',
    promptInstruction: 'DEVE RESPONDER EXCLUSIVA E TOTALMENTE EM PORTUGUÊS CLARO E PEDAGÓGICO. Todas as respostas, explicações e módulos de estudo devem estar 100% em português (All responses and creations must be 100% in Portuguese).'
  },
  {
    code: 'it',
    name: 'Italien',
    nativeName: 'Italiano',
    flag: '🇮🇹',
    promptInstruction: 'DEVI RISPONDERE ESCLUSIVAMENTE E TOTALMENTE IN ITALIANO CHIARO E PEDAGOGICO. Tutte le risposte, le spiegazioni e i moduli interattivi creati devono essere rigorosamente al 100% in italiano (All responses and creations must be 100% in Italian).'
  }
];

export const STUDY_TRANSLATIONS: Record<string, Record<string, string>> = {
  history_button: {
    fr: "Historique",
    en: "History",
    zh: "历史记录",
    ja: "履歴",
    de: "Verlauf",
    es: "Historial",
    ar: "السجل",
    ru: "История",
    pt: "Histórico",
    it: "Cronologia"
  },
  close_button: {
    fr: "Fermer",
    en: "Close",
    zh: "关闭",
    ja: "閉じる",
    de: "Schließen",
    es: "Cerrar",
    ar: "إغلاق",
    ru: "Закрыть",
    pt: "Fechar",
    it: "Chiudi"
  },
  // 1. CHAT ET QUESTIONS D'APPROFONDISSEMENT
  suggested_questions_title: {
    fr: "Pistes & Questions d'approfondissement proposées",
    en: "Suggested Exploration & Follow-up Questions",
    zh: "推荐深入探索与拓展思考的问题",
    ja: "おすすめの深化・発展の問い",
    de: "Vorgeschlagene Vertiefungsfragen",
    es: "Preguntas de profundización sugeridas",
    ar: "مسارات وأسئلة مقترحة للتعمق",
    ru: "Рекомендуемые вопросы для углубления",
    pt: "Perguntas de aprofundamento sugeridas",
    it: "Domande di approfondimento suggerite"
  },
  ask_this_question: {
    fr: "Poser cette question",
    en: "Ask this question",
    zh: "提问此问题",
    ja: "この質問をする",
    de: "Diese Frage stellen",
    es: "Hacer esta pregunta",
    ar: "طرح هذا السؤال",
    ru: "Задать этот вопрос",
    pt: "Fazer esta pergunta",
    it: "Fai questa domanda"
  },
  credits_label: {
    fr: "crédits",
    en: "credits",
    zh: "积分",
    ja: "クレジット",
    de: "Credits",
    es: "créditos",
    ar: "رصيد",
    ru: "кредиты",
    pt: "créditos",
    it: "crediti"
  },
  credits_title_caps: {
    fr: "Crédits",
    en: "Credits",
    zh: "积分",
    ja: "クレジット",
    de: "Credits",
    es: "Créditos",
    ar: "رصيد",
    ru: "Кредиты",
    pt: "Créditos",
    it: "Crediti"
  },
  consumption_label: {
    fr: "Consommation :",
    en: "Usage:",
    zh: "消耗：",
    ja: "消費：",
    de: "Verbrauch:",
    es: "Consumo:",
    ar: "الاستهلاك:",
    ru: "Расход:",
    pt: "Consumo:",
    it: "Consumo:"
  },
  analyzing_question: {
    fr: "J'analyse votre question avec attention...",
    en: "Carefully analyzing your question...",
    zh: "正在认真分析您的问题...",
    ja: "ご質問を丁寧に分析しています...",
    de: "Ich analysiere Ihre Frage sorgfältig...",
    es: "Analizando su pregunta con atención...",
    ar: "أقوم بتحليل سؤالك بعناية...",
    ru: "Внимательно анализирую ваш вопрос...",
    pt: "Analisando sua pergunta com atenção...",
    it: "Sto analizzando attentamente la tua domanda..."
  },
  chat_placeholder: {
    fr: "Posez votre question ou collez votre cours...",
    en: "Ask your question or paste your course notes...",
    zh: "提出您的问题或粘贴您的课程内容...",
    ja: "質問を入力するか、講義ノートを貼り付けてください...",
    de: "Stellen Sie Ihre Frage oder fügen Sie Ihren Kurs ein...",
    es: "Haz tu pregunta o pega tus apuntes...",
    ar: "اطرح سؤالك أو الصق محتوى درسك...",
    ru: "Задайте вопрос или вставьте текст курса...",
    pt: "Faça sua pergunta ou cole seu curso...",
    it: "Fai la tua domanda o incolla i tuoi appunti..."
  },
  no_file_selected: {
    fr: "Aucun fichier sélectionné",
    en: "No file selected",
    zh: "未选择文件",
    ja: "ファイルが選択されていません",
    de: "Keine Datei ausgewählt",
    es: "Ningún archivo seleccionado",
    ar: "لم يتم تحديد أي ملف",
    ru: "Файл не выбран",
    pt: "Nenhum arquivo selecionado",
    it: "Nessun file selezionato"
  },
  stop_button: {
    fr: "Arrêter",
    en: "Stop",
    zh: "停止",
    ja: "停止",
    de: "Stopp",
    es: "Detener",
    ar: "إيقاف",
    ru: "Стоп",
    pt: "Parar",
    it: "Interrompi"
  },
  recent_discussions: {
    fr: "Discussions Récentes",
    en: "Recent Discussions",
    zh: "最近的对话",
    ja: "最近のディスカッション",
    de: "Neueste Diskussionen",
    es: "Conversaciones Recientes",
    ar: "المحادثات الأخيرة",
    ru: "Недавние диалоги",
    pt: "Discussões Recentes",
    it: "Discussioni Recenti"
  },
  new_discussion: {
    fr: "+ Nouvelle discussion",
    en: "+ New discussion",
    zh: "+ 新对话",
    ja: "+ 新しいディスカッション",
    de: "+ Neue Diskussion",
    es: "+ Nueva conversación",
    ar: "+ محادثة جديدة",
    ru: "+ Новый диалог",
    pt: "+ Nova discussão",
    it: "+ Nuova discussione"
  },
  search_discussion: {
    fr: "Rechercher une discussion...",
    en: "Search a discussion...",
    zh: "搜索对话...",
    ja: "ディスカッションを検索...",
    de: "Diskussion suchen...",
    es: "Buscar conversación...",
    ar: "البحث في المحادثات...",
    ru: "Поиск диалога...",
    pt: "Pesquisar discussão...",
    it: "Cerca discussione..."
  },
  no_discussion_found: {
    fr: "Aucune discussion trouvée",
    en: "No discussion found",
    zh: "未找到任何对话",
    ja: "ディスカッションが見つかりません",
    de: "Keine Diskussion gefunden",
    es: "No se encontró ninguna conversación",
    ar: "لم يتم العثور على أي محادثة",
    ru: "Диалоги не найдены",
    pt: "Nenhuma discussão encontrada",
    it: "Nessuna discussione trovata"
  },

  // 2. STUDIO DE CRÉATIONS
  studio_title: {
    fr: "Studio de Créations",
    en: "Creation Studio",
    zh: "创作工作室",
    ja: "クリエーションスタジオ",
    de: "Kreativstudio",
    es: "Estudio de Creaciones",
    ar: "استوديو الإبداع",
    ru: "Студия создания",
    pt: "Estúdio de Criações",
    it: "Studio delle Creazioni"
  },
  custom_interactive_creations: {
    fr: "Créations interactives sur mesure :",
    en: "Custom interactive creations:",
    zh: "量身定制的交互式学习模块：",
    ja: "オーダーメイドのインタラクティブ作成：",
    de: "Maßgeschneiderte interaktive Lernmodule:",
    es: "Creaciones interactivas a medida:",
    ar: "وحدات تفاعلية مخصصة:",
    ru: "Интерактивные учебные модули на заказ:",
    pt: "Criações interativas sob medida:",
    it: "Creazioni interattive su misura:"
  },
  interactive_for_doc_prefix: {
    fr: "Créations interactives pour",
    en: "Interactive creations for",
    zh: "专属交互式创作针对",
    ja: "インタラクティブ作成 対象：",
    de: "Interaktive Kreationen für",
    es: "Creaciones interactivas para",
    ar: "وحدات تفاعلية لـ",
    ru: "Интерактивные создания для",
    pt: "Criações interativas para",
    it: "Creazioni interattive per"
  },

  // Modules de création
  mod_questionnaire: {
    fr: "Questionnaire QCM",
    en: "Multiple Choice Quiz",
    zh: "选择题测验 (QCM)",
    ja: "選択式クイズ",
    de: "Multiple-Choice-Quiz",
    es: "Cuestionario Tipo Test",
    ar: "اختبار اختيار من متعدد",
    ru: "Тест с вариантами ответов",
    pt: "Questionário Múltipla Escolha",
    it: "Quiz a Scelta Multipla"
  },
  mod_questionnaire_test: {
    fr: "Questionnaire Test",
    en: "Graded Quiz Test",
    zh: "评分考核测验",
    ja: "採点テストクイズ",
    de: "Benoteter Quiztest",
    es: "Cuestionario de Examen",
    ar: "اختبار تقييمي مع درجات",
    ru: "Экзаменационный тест",
    pt: "Questionário de Teste",
    it: "Test con Voto"
  },
  badge_graded_test: {
    fr: "Test Noté",
    en: "Graded",
    zh: "考核",
    ja: "採点",
    de: "Benotet",
    es: "Evaluado",
    ar: "تقييم",
    ru: "Оценка",
    pt: "Avaliado",
    it: "Valutato"
  },
  mod_vrai_ou_faux: {
    fr: "Vrai ou Faux",
    en: "True or False",
    zh: "判断题 (对或错)",
    ja: "正誤問題 (True/False)",
    de: "Wahr oder Falsch",
    es: "Verdadero o Falso",
    ar: "صح أم خطأ",
    ru: "Правда или Ложь",
    pt: "Verdadeiro ou Falso",
    it: "Vero o Falso"
  },
  mod_vrai_ou_faux_test: {
    fr: "Vrai ou Faux Test",
    en: "True/False Exam",
    zh: "判断题考核",
    ja: "正誤テスト",
    de: "Wahr/Falsch-Prüfung",
    es: "Examen Verdadero/Falso",
    ar: "اختبار صح أو خطأ تقييمي",
    ru: "Экзамен Правда/Ложь",
    pt: "Teste Verdadeiro/Falso",
    it: "Esame Vero/Falso"
  },
  badge_exam: {
    fr: "Épreuve",
    en: "Exam",
    zh: "考试",
    ja: "試験",
    de: "Prüfung",
    es: "Prueba",
    ar: "امتحان",
    ru: "Экзамен",
    pt: "Prova",
    it: "Prova"
  },
  mod_carte_mentale: {
    fr: "Carte Mentale",
    en: "Mind Map",
    zh: "思维导图",
    ja: "マインドマップ",
    de: "Mindmap",
    es: "Mapa Mental",
    ar: "خريطة ذهنية",
    ru: "Интеллект-карта",
    pt: "Mapa Mental",
    it: "Mappa Mentale"
  },
  mod_carte_mentale_2: {
    fr: "Carte Conceptuelle",
    en: "Concept Map",
    zh: "概念图",
    ja: "概念マップ",
    de: "Konzeptkarte",
    es: "Mapa Conceptual",
    ar: "خريطة مفاهيمية",
    ru: "Концептуальная карта",
    pt: "Mapa Conceitual",
    it: "Mappa Concettuale"
  },
  badge_conceptual: {
    fr: "Conceptuelle",
    en: "Conceptual",
    zh: "概念",
    ja: "概念",
    de: "Konzeptuell",
    es: "Conceptual",
    ar: "مفاهيمي",
    ru: "Концепт",
    pt: "Conceitual",
    it: "Concettuale"
  },
  mod_carte_memoire: {
    fr: "Cartes Mémoires",
    en: "Flashcards",
    zh: "记忆抽认卡",
    ja: "暗記フラッシュカード",
    de: "Lernkarteikarten",
    es: "Tarjetas de Memoria",
    ar: "بطاقات الاستذكار",
    ru: "Флеш-карточки",
    pt: "Cartões de Memória",
    it: "Flashcard"
  },
  mod_resume: {
    fr: "Fiche de Résumé",
    en: "Summary Sheet",
    zh: "精炼复习总结",
    ja: "要約・復習シート",
    de: "Zusammenfassung",
    es: "Ficha de Resumen",
    ar: "ملخص الدرس",
    ru: "Конспект и резюме",
    pt: "Ficha de Resumo",
    it: "Scheda di Riassunto"
  },
  mod_exercices_ecrits: {
    fr: "Exercices Écrits",
    en: "Written Exercises",
    zh: "书面实战练习",
    ja: "記述式演習問題",
    de: "Schriftliche Übungen",
    es: "Ejercicios Escritos",
    ar: "تمارين كتابية تطبيقية",
    ru: "Письменные упражнения",
    pt: "Exercícios Escritos",
    it: "Esercizi Scritti"
  },
  mod_devoir_complet: {
    fr: "Devoir Complet",
    en: "Full Exam Paper",
    zh: "完整模拟试卷",
    ja: "完全模擬試験",
    de: "Vollständige Prüfung",
    es: "Examen Completo",
    ar: "واجب امتحاني شامل",
    ru: "Полный экзамен",
    pt: "Exame Completo",
    it: "Esame Completo"
  },
  badge_official_exam: {
    fr: "Examen",
    en: "Exam",
    zh: "统考",
    ja: "本番",
    de: "Examen",
    es: "Examen",
    ar: "شامل",
    ru: "Экзамен",
    pt: "Exame",
    it: "Esame"
  },

  // 3. TIROIR "MES CRÉATIONS"
  my_creations: {
    fr: "Mes Créations",
    en: "My Creations",
    zh: "我的创作",
    ja: "私の作成物",
    de: "Meine Kreationen",
    es: "Mis Creaciones",
    ar: "إبداعاتي",
    ru: "Мои создания",
    pt: "Minhas Criações",
    it: "Le Mie Creazioni"
  },
  search_creation: {
    fr: "Rechercher une création...",
    en: "Search a creation...",
    zh: "搜索创作...",
    ja: "作成物を検索...",
    de: "Kreation suchen...",
    es: "Buscar creación...",
    ar: "البحث في الإبداعات...",
    ru: "Поиск создания...",
    pt: "Pesquisar criação...",
    it: "Cerca creazione..."
  },
  all_your_creations: {
    fr: "Toutes vos créations",
    en: "All your creations",
    zh: "您的全部创作",
    ja: "すべての作成物",
    de: "Alle Ihre Kreationen",
    es: "Todas tus creaciones",
    ar: "جميع إبداعاتك",
    ru: "Все ваши создания",
    pt: "Todas as suas criações",
    it: "Tutte le tue creazioni"
  },
  no_creations_saved: {
    fr: "Aucune création enregistrée",
    en: "No creations saved",
    zh: "暂无已保存的创作",
    ja: "保存された作成物はありません",
    de: "Keine Kreationen gespeichert",
    es: "No hay creaciones guardadas",
    ar: "لا توجد إبداعات محفوظة",
    ru: "Нет сохраненных созданий",
    pt: "Nenhuma criação salva",
    it: "Nessuna creazione salvata"
  },
  loading_creations: {
    fr: "Chargement de vos créations...",
    en: "Loading your creations...",
    zh: "正在加载您的创作...",
    ja: "作成物を読み込み中...",
    de: "Ihre Kreationen werden geladen...",
    es: "Cargando tus creaciones...",
    ar: "جارٍ تحميل إبداعاتك...",
    ru: "Загрузка ваших созданий...",
    pt: "Carregando suas criações...",
    it: "Caricamento delle tue creazioni..."
  },
  status_generating: {
    fr: "En cours",
    en: "Generating",
    zh: "生成中",
    ja: "生成中",
    de: "In Bearbeitung",
    es: "En curso",
    ar: "قيد الإنشاء",
    ru: "В процессе",
    pt: "Em andamento",
    it: "In corso"
  },
  status_queued: {
    fr: "En attente",
    en: "Queued",
    zh: "等待中",
    ja: "待機中",
    de: "Warteschlange",
    es: "En espera",
    ar: "قيد الانتظار",
    ru: "В очереди",
    pt: "Na fila",
    it: "In attesa"
  },
  status_error: {
    fr: "Échec",
    en: "Failed",
    zh: "失败",
    ja: "失敗",
    de: "Fehlgeschlagen",
    es: "Fallido",
    ar: "فشل",
    ru: "Ошибка",
    pt: "Falha",
    it: "Non riuscito"
  },
  status_active: {
    fr: "Affiché",
    en: "Active",
    zh: "已显示",
    ja: "表示中",
    de: "Angezeigt",
    es: "Activo",
    ar: "معروض",
    ru: "Активно",
    pt: "Exibido",
    it: "Attivo"
  },
  retry: {
    fr: "Réessayer",
    en: "Retry",
    zh: "重试",
    ja: "再試行",
    de: "Wiederholen",
    es: "Reintentar",
    ar: "إعادة المحاولة",
    ru: "Повторить",
    pt: "Repetir",
    it: "Riprova"
  },

  // 4. VISUALISEUR CENTRAL (EMPTY STATE)
  center_no_file_title: {
    fr: "Aucun fichier sélectionné",
    en: "No file selected",
    zh: "未选择文件",
    ja: "ファイルが選択されていません",
    de: "Keine Datei ausgewählt",
    es: "Ningún archivo seleccionado",
    ar: "لم يتم تحديد أي ملف",
    ru: "Файл не выбран",
    pt: "Nenhum arquivo selecionado",
    it: "Nessun file selezionato"
  },
  center_no_file_desc: {
    fr: "Sélectionnez un fichier dans la liste à gauche pour afficher son aperçu et commencer votre session d'étude.",
    en: "Select a file from the list on the left to preview it and start your study session.",
    zh: "请在左侧列表中选择一个文件以预览并开始您的学习。",
    ja: "左側のリストからファイルを選択してプレビューを表示し、学習セッションを開始してください。",
    de: "Wählen Sie eine Datei aus der linken Liste aus, um die Vorschau anzuzeigen und Ihre Lerneinheit zu starten.",
    es: "Selecciona un archivo de la lista de la izquierda para ver su vista previa y comenzar tu sesión de estudio.",
    ar: "حدد ملفاً من القائمة على اليسار لمعاينته وبدء جلسة الدراسة.",
    ru: "Выберите файл из списка слева, чтобы просмотреть его и начать учебную сессию.",
    pt: "Selecione um arquivo na lista à esquerda para visualizar e iniciar sua sessão de estudo.",
    it: "Seleziona un file dall'elenco a sinistra per visualizzarne l'anteprima e iniziare la sessione di studio."
  },
  center_loading_doc: {
    fr: "Chargement et adaptation du document...",
    en: "Loading and adapting document...",
    zh: "正在加载并适配文档...",
    ja: "ドキュメントを読み込み・最適化中...",
    de: "Dokument wird geladen und angepasst...",
    es: "Cargando y adaptando documento...",
    ar: "جارٍ تحميل المستند ومواءمته...",
    ru: "Загрузка и обработка документа...",
    pt: "Carregando e adaptando documento...",
    it: "Caricamento e adattamento del documento..."
  }
};

/**
 * Récupère la langue mémorisée par défaut
 */
export function getStoredStudyLanguage(): string {
  if (typeof window === 'undefined' || !window.localStorage) return 'fr';
  try {
    return localStorage.getItem('studycloud_chat_language') || 'fr';
  } catch {
    return 'fr';
  }
}

/**
 * Définit la langue et diffuse l'événement à toute l'application
 */
export function setStoredStudyLanguage(langCode: string): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    localStorage.setItem('studycloud_chat_language', langCode);
    window.dispatchEvent(new CustomEvent('studycloud_language_changed', { detail: langCode }));
    if (document.documentElement) {
      document.documentElement.setAttribute('lang', langCode);
    }
  } catch { }
}

/**
 * Traduit une clé donnée dans la langue spécifiée ou courante
 */
export function tStudy(key: string, lang?: string, fallback?: string): string {
  const effectiveLang = lang || getStoredStudyLanguage();
  const dict = STUDY_TRANSLATIONS[key];
  if (!dict) return fallback || key;
  return dict[effectiveLang] || dict['fr'] || dict['en'] || fallback || key;
}

/**
 * Renvoie le titre traduit pour un type de création donné
 */
export function getLocalizedModuleTitle(type: string, lang?: string): string {
  const norm = (type || '').toLowerCase().trim();
  switch (norm) {
    case 'questionnaire':
      return tStudy('mod_questionnaire', lang, 'Questionnaire QCM');
    case 'questionnaire-test':
      return tStudy('mod_questionnaire_test', lang, 'Questionnaire Test');
    case 'vrai-ou-faux':
      return tStudy('mod_vrai_ou_faux', lang, 'Vrai ou Faux');
    case 'vrai-ou-faux-test':
      return tStudy('mod_vrai_ou_faux_test', lang, 'Vrai ou Faux Test');
    case 'carte-mentale':
      return tStudy('mod_carte_mentale', lang, 'Carte Mentale');
    case 'carte-mentale-2':
      return tStudy('mod_carte_mentale_2', lang, 'Carte Conceptuelle');
    case 'carte-memoire':
      return tStudy('mod_carte_memoire', lang, 'Cartes Mémoires');
    case 'resume':
      return tStudy('mod_resume', lang, 'Fiche de Résumé');
    case 'exercices-ecrits':
    case 'exercices':
      return tStudy('mod_exercices_ecrits', lang, 'Exercices Écrits');
    case 'devoir-complet':
    case 'devoir':
      return tStudy('mod_devoir_complet', lang, 'Devoir Complet');
    default:
      return type || 'Création';
  }
}

/**
 * Traduit le titre complet d'une carte de création (ex: 'Carte Mentale : FILTRES' -> 'Mind Map: FILTRES')
 */
export function getLocalizedCreationCardTitle(title: string, type: string, lang?: string): string {
  if (!title) return getLocalizedModuleTitle(type, lang);
  const localizedModule = getLocalizedModuleTitle(type, lang);
  
  // Remplacer les préfixes français standards par le nom localisé
  return title
    .replace(/^Carte\s+Mentale\s*:\s*/i, `${localizedModule} : `)
    .replace(/^Cartes\s+M[eé]moires\s*:\s*/i, `${localizedModule} : `)
    .replace(/^Questionnaire\s+Test\s*:\s*/i, `${localizedModule} : `)
    .replace(/^Questionnaire\s+QCM\s*:\s*/i, `${localizedModule} : `)
    .replace(/^Vrai\s+ou\s+Faux\s*:\s*/i, `${localizedModule} : `)
    .replace(/^Vrai\s+ou\s+Faux\s+Test\s*:\s*/i, `${localizedModule} : `)
    .replace(/^Fiche\s+de\s+R[eé]sum[eé]\s*:\s*/i, `${localizedModule} : `)
    .replace(/^Exercices\s+[EÉ]crits\s*:\s*/i, `${localizedModule} : `)
    .replace(/^Devoir\s+Complet\s*:\s*/i, `${localizedModule} : `)
    .replace(/^Carte\s+Conceptuelle\s*:\s*/i, `${localizedModule} : `);
}

/**
 * Hook React pour écouter et synchroniser dynamiquement la langue dans n'importe quel composant
 */
export function useStudyLanguage() {
  const [lang, setLangState] = useState<string>(() => getStoredStudyLanguage());

  useEffect(() => {
    const handleLangChange = (e: any) => {
      const newLang = e.detail || getStoredStudyLanguage();
      setLangState(newLang);
    };

    window.addEventListener('studycloud_language_changed', handleLangChange);
    window.addEventListener('storage', handleLangChange);

    return () => {
      window.removeEventListener('studycloud_language_changed', handleLangChange);
      window.removeEventListener('storage', handleLangChange);
    };
  }, []);

  const changeLanguage = (newLangCode: string) => {
    setStoredStudyLanguage(newLangCode);
    setLangState(newLangCode);
  };

  const currentLangObj = SUPPORTED_STUDY_LANGUAGES.find(l => l.code === lang) || SUPPORTED_STUDY_LANGUAGES[0];

  const t = (key: string, fallback?: string): string => {
    return tStudy(key, lang, fallback);
  };

  return {
    lang,
    setLanguage: changeLanguage,
    currentLangObj,
    t,
    getLocalizedModuleTitle: (type: string) => getLocalizedModuleTitle(type, lang),
    getLocalizedCreationCardTitle: (title: string, type: string) => getLocalizedCreationCardTitle(title, type, lang)
  };
}

