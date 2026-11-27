import React, { useState, useMemo, useEffect } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  ArrowLeftRight,
  Layers,
  Copy,
  Users,
  Building2,
  Calendar,
  Check,
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  Info,
} from 'lucide-react';
import type {
  SchoolYearItem,
  SchoolItem,
  StudyLevelItem,
  ClassItem,
  TermItem,
  SubjectItem,
} from './TeacherClassesView';
import {
  executeTransfer,
  inspectGradebookStorage,
  getEffectiveClassName,
  getEffectiveSubjectTermId,
  type TransferMode,
  type GradebookContentMode,
  type ConflictStrategy,
  type GradebookCopyOptions,
  type TransferSummary,
  type TransferPlan,
  type GradebookInspection,
  type GradebookCopyOperation,
} from '../../utils/teacherTransferEngine';

interface TeacherTransferViewProps {
  currentSchool: SchoolItem;
  currentYear: SchoolYearItem | undefined;
  activeLevel: StudyLevelItem | null;
  activeClass: ClassItem | null;
  activeTerm: TermItem | null;
  schoolYears: SchoolYearItem[];
  schools: SchoolItem[];
  studyLevels: StudyLevelItem[];
  classes: ClassItem[];
  terms: TermItem[];
  subjects: SubjectItem[];
  serverGradebookStats?: Record<string, GradebookInspection>;
  onApplyTransfer: (next: {
    studyLevels: StudyLevelItem[];
    classes: ClassItem[];
    terms: TermItem[];
    subjects: SubjectItem[];
    createdLevels: StudyLevelItem[];
    createdClasses: ClassItem[];
    createdTerms: TermItem[];
    createdSubjects: SubjectItem[];
    updatedSubjects: SubjectItem[];
    gradebookCopyOps: GradebookCopyOperation[];
  }) => Promise<{ gradebooksCopied?: number; studentsCopied?: number; notesCopied?: number; photosCopied?: number } | void> | void;
  onClose: () => void;
}

const DEFAULT_GRADEBOOK_OPTIONS: GradebookCopyOptions = {
  contentMode: 'students_only',
  includePhotos: true,
  includeMetas: true,
  includeFormatting: false,
};

const plural = (count: number, singular: string, pluralForm?: string): string =>
  `${count} ${count > 1 ? pluralForm || `${singular}s` : singular}`;

export const TeacherTransferView: React.FC<TeacherTransferViewProps> = ({
  currentSchool,
  currentYear,
  activeLevel,
  activeClass,
  activeTerm,
  schoolYears,
  schools,
  studyLevels,
  classes,
  terms,
  subjects,
  serverGradebookStats,
  onApplyTransfer,
  onClose,
}) => {
  // Navigation interne : null = écran d'accueil des options, sinon on est "entré" dans un mode précis
  const [selectedMode, setSelectedMode] = useState<TransferMode | null>(null);
  const [lastResult, setLastResult] = useState<{ mode: TransferMode; summary: TransferSummary } | null>(null);
  const [isTransferring, setIsTransferring] = useState(false);

  // Données de l'école courante
  const schoolLevels = useMemo(
    () => studyLevels.filter((l) => l.schoolId === currentSchool.id),
    [studyLevels, currentSchool.id]
  );
  const schoolClasses = useMemo(
    () => classes.filter((c) => c.schoolId === currentSchool.id),
    [classes, currentSchool.id]
  );
  const schoolSubjects = useMemo(
    () => subjects.filter((s) => s.schoolId === currentSchool.id),
    [subjects, currentSchool.id]
  );
  const otherSchools = useMemo(
    () => schools.filter((s) => s.id !== currentSchool.id),
    [schools, currentSchool.id]
  );

  // Cache d'inspection réelle des tableurs (priorité aux statistiques Cloudflare D1, sinon inspection locale)
  const gradebookStatsMap = useMemo(() => {
    const map = new Map<string, GradebookInspection>();
    for (const subj of schoolSubjects) {
      const clsTerms = terms.filter((t) => t.classId === subj.classId);
      const effTermId = getEffectiveSubjectTermId(subj, clsTerms);
      const key = `${subj.id}__${effTermId || 't1'}`;
      if (serverGradebookStats && serverGradebookStats[key]) {
        map.set(key, serverGradebookStats[key]);
      } else {
        map.set(key, inspectGradebookStorage(subj.id, effTermId));
      }
    }
    return map;
  }, [schoolSubjects, terms, serverGradebookStats]);

  const getSubjectStats = (subj: SubjectItem): GradebookInspection => {
    const clsTerms = terms.filter((t) => t.classId === subj.classId);
    const effTermId = getEffectiveSubjectTermId(subj, clsTerms);
    return (
      gradebookStatsMap.get(`${subj.id}__${effTermId || 't1'}`) || {
        hasStorage: false,
        totalRows: 0,
        namedStudentsCount: 0,
        photosCount: 0,
        notesCount: 0,
        noteColumnCount: 7,
        hasCustomMetas: false,
        hasFormatting: false,
      }
    );
  };

  // Statistiques globales de disponibilité dans l'école courante (pour signaler dès l'accueil)
  const globalDiagnostics = useMemo(() => {
    let totalNamedStudents = 0;
    let subjectsWithStudents = 0;
    let subjectsWithNotes = 0;
    for (const subj of schoolSubjects) {
      const st = getSubjectStats(subj);
      if (st.namedStudentsCount > 0) {
        totalNamedStudents += st.namedStudentsCount;
        subjectsWithStudents++;
      }
      if (st.notesCount > 0) subjectsWithNotes++;
    }
    const levelsWithTwoClasses = schoolLevels.filter(
      (l) => schoolClasses.filter((c) => c.levelId === l.id).length >= 2
    ).length;

    return {
      totalNamedStudents,
      subjectsWithStudents,
      subjectsWithNotes,
      levelsWithTwoClasses,
    };
  }, [schoolSubjects, schoolLevels, schoolClasses, gradebookStatsMap]);

  // ---------- États communs de configuration ----------
  const [gradebookOpts, setGradebookOpts] = useState<GradebookCopyOptions>(DEFAULT_GRADEBOOK_OPTIONS);
  const [conflictStrategy, setConflictStrategy] = useState<ConflictStrategy>('skip');

  // ---------- 1. État : Trimestre -> Trimestre ----------
  const [ttLevelId, setTtLevelId] = useState<string>(activeLevel?.id || schoolLevels[0]?.id || '');
  const [ttClassId, setTtClassId] = useState<string>(activeClass?.id || '');
  const [ttSourceTermId, setTtSourceTermId] = useState<string>(activeTerm?.id || '');
  const [ttSubjectIds, setTtSubjectIds] = useState<string[]>([]);
  const [ttTargetTermIds, setTtTargetTermIds] = useState<string[]>([]);
  const [ttApplyAllClassesInLevel, setTtApplyAllClassesInLevel] = useState<boolean>(false);

  // ---------- 2. État : Classe -> Classe (dans un même niveau) ----------
  const [ccLevelId, setCcLevelId] = useState<string>(activeLevel?.id || schoolLevels[0]?.id || '');
  const [ccSourceClassId, setCcSourceClassId] = useState<string>(activeClass?.id || '');
  const [ccTargetClassIds, setCcTargetClassIds] = useState<string[]>([]);
  const [ccCopyTerms, setCcCopyTerms] = useState<boolean>(true);
  const [ccTermIds, setCcTermIds] = useState<string[]>([]);
  const [ccCopySubjects, setCcCopySubjects] = useState<boolean>(true);
  const [ccSubjectIds, setCcSubjectIds] = useState<string[]>([]);

  // ---------- 3. État : Niveau -> Niveau ----------
  const [llSourceLevelId, setLlSourceLevelId] = useState<string>(activeLevel?.id || schoolLevels[0]?.id || '');
  const [llTargetLevelIds, setLlTargetLevelIds] = useState<string[]>([]);
  const [llCopyClasses, setLlCopyClasses] = useState<boolean>(true);
  const [llClassIds, setLlClassIds] = useState<string[]>([]);
  const [llCopyTerms, setLlCopyTerms] = useState<boolean>(true);
  const [llTermNumbers, setLlTermNumbers] = useState<number[]>([1, 2, 3]);
  const [llCopySubjects, setLlCopySubjects] = useState<boolean>(true);
  const [llSubjectIds, setLlSubjectIds] = useState<string[]>([]);

  // ---------- 4. État : Matière -> Matière (partage tableur / élèves) ----------
  const [ssSourceLevelId, setSsSourceLevelId] = useState<string>(activeLevel?.id || schoolLevels[0]?.id || '');
  const [ssSourceClassId, setSsSourceClassId] = useState<string>(activeClass?.id || '');
  const [ssSourceTermId, setSsSourceTermId] = useState<string>(activeTerm?.id || '');
  const [ssSourceSubjectId, setSsSourceSubjectId] = useState<string>('');
  const [ssTargetScope, setSsTargetScope] = useState<'same_class' | 'same_level' | 'all_school'>('same_class');
  const [ssTargetKeys, setSsTargetKeys] = useState<string[]>([]); // `${subjectId}__${termId}`

  // ---------- 5. État : École -> École / Année ----------
  const [scLevelIds, setScLevelIds] = useState<string[]>(() => schoolLevels.map((l) => l.id));
  const [scTargetSchoolIds, setScTargetSchoolIds] = useState<string[]>([]);
  const [scCopyClasses, setScCopyClasses] = useState<boolean>(true);
  const [scCopyTerms, setScCopyTerms] = useState<boolean>(true);
  const [scCopySubjects, setScCopySubjects] = useState<boolean>(true);

  // ---------- Synchronisations automatiques propres pour chaque mode ----------

  // Mode 1 : Trimestre -> Trimestre
  const ttLevelClasses = useMemo(
    () => schoolClasses.filter((c) => c.levelId === ttLevelId),
    [schoolClasses, ttLevelId]
  );
  useEffect(() => {
    if (!ttLevelClasses.some((c) => c.id === ttClassId)) {
      setTtClassId(ttLevelClasses[0]?.id || '');
    }
  }, [ttLevelClasses, ttClassId]);

  const ttClassTerms = useMemo(
    () => terms.filter((t) => t.classId === ttClassId).sort((a, b) => a.number - b.number),
    [terms, ttClassId]
  );
  useEffect(() => {
    if (!ttClassTerms.some((t) => t.id === ttSourceTermId)) {
      setTtSourceTermId(ttClassTerms[0]?.id || '');
    }
  }, [ttClassTerms, ttSourceTermId]);

  const ttSourceSubjects = useMemo(() => {
    if (!ttClassId || !ttSourceTermId) return [];
    return schoolSubjects.filter((s) => {
      if (s.classId !== ttClassId) return false;
      return getEffectiveSubjectTermId(s, ttClassTerms) === ttSourceTermId;
    });
  }, [schoolSubjects, ttClassId, ttSourceTermId, ttClassTerms]);

  useEffect(() => {
    setTtSubjectIds(ttSourceSubjects.map((s) => s.id));
    setTtTargetTermIds((prev) => prev.filter((tid) => tid !== ttSourceTermId && ttClassTerms.some((t) => t.id === tid)));
  }, [ttSourceSubjects, ttSourceTermId, ttClassTerms]);

  // Mode 2 : Classe -> Classe
  const ccLevelClasses = useMemo(
    () => schoolClasses.filter((c) => c.levelId === ccLevelId),
    [schoolClasses, ccLevelId]
  );
  useEffect(() => {
    if (!ccLevelClasses.some((c) => c.id === ccSourceClassId)) {
      setCcSourceClassId(ccLevelClasses[0]?.id || '');
    }
  }, [ccLevelClasses, ccSourceClassId]);

  const ccSourceTerms = useMemo(
    () => terms.filter((t) => t.classId === ccSourceClassId).sort((a, b) => a.number - b.number),
    [terms, ccSourceClassId]
  );
  useEffect(() => {
    setCcTermIds(ccSourceTerms.map((t) => t.id));
    setCcTargetClassIds((prev) =>
      prev.filter((cid) => cid !== ccSourceClassId && ccLevelClasses.some((c) => c.id === cid))
    );
  }, [ccSourceTerms, ccSourceClassId, ccLevelClasses]);

  const ccSourceSubjects = useMemo(() => {
    if (!ccSourceClassId) return [];
    return schoolSubjects.filter((s) => {
      if (s.classId !== ccSourceClassId) return false;
      const eff = getEffectiveSubjectTermId(s, ccSourceTerms);
      return !ccCopyTerms || (eff ? ccTermIds.includes(eff) : true);
    });
  }, [schoolSubjects, ccSourceClassId, ccSourceTerms, ccCopyTerms, ccTermIds]);

  useEffect(() => {
    setCcSubjectIds(ccSourceSubjects.map((s) => s.id));
  }, [ccSourceSubjects]);

  // Mode 3 : Niveau -> Niveau
  const llSourceClasses = useMemo(
    () => schoolClasses.filter((c) => c.levelId === llSourceLevelId),
    [schoolClasses, llSourceLevelId]
  );
  useEffect(() => {
    setLlClassIds(llSourceClasses.map((c) => c.id));
    setLlTargetLevelIds((prev) =>
      prev.filter((lid) => lid !== llSourceLevelId && schoolLevels.some((l) => l.id === lid))
    );
  }, [llSourceClasses, llSourceLevelId, schoolLevels]);

  const llAvailableTermNumbers = useMemo(() => {
    const nums = new Set<number>();
    for (const cid of llClassIds) {
      terms.filter((t) => t.classId === cid).forEach((t) => nums.add(t.number));
    }
    const arr = Array.from(nums).sort((a, b) => a - b);
    return arr.length > 0 ? arr : [1, 2, 3];
  }, [llClassIds, terms]);

  useEffect(() => {
    setLlTermNumbers(llAvailableTermNumbers);
  }, [llAvailableTermNumbers]);

  const llSourceSubjects = useMemo(() => {
    return schoolSubjects.filter((s) => {
      if (!llClassIds.includes(s.classId)) return false;
      const clsTerms = terms.filter((t) => t.classId === s.classId);
      const effId = getEffectiveSubjectTermId(s, clsTerms);
      const termObj = clsTerms.find((t) => t.id === effId);
      if (!termObj) return true;
      return !llCopyTerms || llTermNumbers.includes(termObj.number);
    });
  }, [schoolSubjects, llClassIds, terms, llCopyTerms, llTermNumbers]);

  useEffect(() => {
    setLlSubjectIds(llSourceSubjects.map((s) => s.id));
  }, [llSourceSubjects]);

  // Mode 4 : Matière -> Matière
  const ssSourceClasses = useMemo(
    () => schoolClasses.filter((c) => c.levelId === ssSourceLevelId),
    [schoolClasses, ssSourceLevelId]
  );
  useEffect(() => {
    if (!ssSourceClasses.some((c) => c.id === ssSourceClassId)) {
      setSsSourceClassId(ssSourceClasses[0]?.id || '');
    }
  }, [ssSourceClasses, ssSourceClassId]);

  const ssSourceTerms = useMemo(
    () => terms.filter((t) => t.classId === ssSourceClassId).sort((a, b) => a.number - b.number),
    [terms, ssSourceClassId]
  );
  useEffect(() => {
    if (!ssSourceTerms.some((t) => t.id === ssSourceTermId)) {
      setSsSourceTermId(ssSourceTerms[0]?.id || '');
    }
  }, [ssSourceTerms, ssSourceTermId]);

  const ssSourceSubjects = useMemo(() => {
    if (!ssSourceClassId || !ssSourceTermId) return [];
    return schoolSubjects.filter((s) => {
      if (s.classId !== ssSourceClassId) return false;
      return getEffectiveSubjectTermId(s, ssSourceTerms) === ssSourceTermId;
    });
  }, [schoolSubjects, ssSourceClassId, ssSourceTermId, ssSourceTerms]);

  useEffect(() => {
    if (!ssSourceSubjects.some((s) => s.id === ssSourceSubjectId)) {
      // Pré-sélectionner en priorité une matière contenant déjà des élèves
      const withStudents = ssSourceSubjects.find((s) => getSubjectStats(s).namedStudentsCount > 0);
      setSsSourceSubjectId(withStudents?.id || ssSourceSubjects[0]?.id || '');
    }
  }, [ssSourceSubjects, ssSourceSubjectId]);

  const ssCandidateTargets = useMemo(() => {
    const srcKey = `${ssSourceSubjectId}__${ssSourceTermId}`;
    return schoolSubjects
      .filter((s) => {
        const cls = schoolClasses.find((c) => c.id === s.classId);
        if (!cls) return false;
        if (ssTargetScope === 'same_class' && cls.id !== ssSourceClassId) return false;
        if (ssTargetScope === 'same_level' && cls.levelId !== ssSourceLevelId) return false;
        const clsTerms = terms.filter((t) => t.classId === cls.id);
        const effTermId = getEffectiveSubjectTermId(s, clsTerms) || 't1';
        return `${s.id}__${effTermId}` !== srcKey;
      })
      .map((s) => {
        const cls = schoolClasses.find((c) => c.id === s.classId)!;
        const lvl = schoolLevels.find((l) => l.id === cls.levelId);
        const clsTerms = terms.filter((t) => t.classId === cls.id);
        const effTermId = getEffectiveSubjectTermId(s, clsTerms) || clsTerms[0]?.id || 't1';
        const termObj = clsTerms.find((t) => t.id === effTermId);
        return {
          key: `${s.id}__${effTermId}`,
          subject: s,
          termId: effTermId,
          termName: termObj?.name || 'Trimestre 1',
          className: getEffectiveClassName(cls),
          levelName: lvl?.name || cls.level,
          stats: getSubjectStats(s),
        };
      });
  }, [schoolSubjects, schoolClasses, schoolLevels, terms, ssTargetScope, ssSourceClassId, ssSourceLevelId, ssSourceSubjectId, ssSourceTermId, gradebookStatsMap]);

  useEffect(() => {
    setSsTargetKeys((prev) => prev.filter((k) => ssCandidateTargets.some((t) => t.key === k)));
  }, [ssCandidateTargets]);

  // ---------- Calcul de disponibilité réelle du contenu des matières sélectionnées ----------
  const activeSelectedSubjectsForStats = useMemo((): SubjectItem[] => {
    if (selectedMode === 'term_to_term') {
      return ttSourceSubjects.filter((s) => ttSubjectIds.includes(s.id));
    }
    if (selectedMode === 'class_to_class') {
      return ccCopySubjects ? ccSourceSubjects.filter((s) => ccSubjectIds.includes(s.id)) : [];
    }
    if (selectedMode === 'level_to_level') {
      return llCopySubjects ? llSourceSubjects.filter((s) => llSubjectIds.includes(s.id)) : [];
    }
    if (selectedMode === 'subject_to_subject') {
      const found = ssSourceSubjects.find((s) => s.id === ssSourceSubjectId);
      return found ? [found] : [];
    }
    if (selectedMode === 'school_to_school') {
      if (!scCopyClasses || !scCopySubjects) return [];
      const clsIds = new Set(
        schoolClasses.filter((c) => c.levelId && scLevelIds.includes(c.levelId)).map((c) => c.id)
      );
      return schoolSubjects.filter((s) => clsIds.has(s.classId));
    }
    return [];
  }, [
    selectedMode,
    ttSourceSubjects,
    ttSubjectIds,
    ccCopySubjects,
    ccSourceSubjects,
    ccSubjectIds,
    llCopySubjects,
    llSourceSubjects,
    llSubjectIds,
    ssSourceSubjects,
    ssSourceSubjectId,
    scCopyClasses,
    scCopySubjects,
    schoolClasses,
    scLevelIds,
    schoolSubjects,
  ]);

  const contentAvailability = useMemo(() => {
    let students = 0;
    let notes = 0;
    let photos = 0;
    let metas = 0;
    let formatting = 0;
    for (const s of activeSelectedSubjectsForStats) {
      const st = getSubjectStats(s);
      students += st.namedStudentsCount;
      notes += st.notesCount;
      photos += st.photosCount;
      if (st.hasCustomMetas) metas++;
      if (st.hasFormatting) formatting++;
    }
    return { students, notes, photos, metas, formatting };
  }, [activeSelectedSubjectsForStats, gradebookStatsMap]);

  // Ajuster automatiquement le mode de contenu si l'option cochée n'a aucune donnée disponible
  useEffect(() => {
    if (selectedMode === 'subject_to_subject') {
      if (gradebookOpts.contentMode === 'none') {
        setGradebookOpts((prev) => ({
          ...prev,
          contentMode: contentAvailability.students > 0 ? 'students_only' : 'structure',
        }));
      }
    }
  }, [selectedMode, contentAvailability.students, gradebookOpts.contentMode]);

  // ---------- Validation : peut-on lancer le transfert ? + messages explicites ----------
  const validationState = useMemo((): { canExecute: boolean; blockingReason: string | null; notices: string[] } => {
    const notices: string[] = [];

    if (!selectedMode) return { canExecute: false, blockingReason: null, notices };

    if (selectedMode === 'term_to_term') {
      if (!ttClassId || !ttSourceTermId) {
        return { canExecute: false, blockingReason: 'Sélectionnez une classe et un trimestre source.', notices };
      }
      if (ttSourceSubjects.length === 0) {
        return { canExecute: false, blockingReason: 'Aucune matière disponible dans le trimestre source sélectionné.', notices };
      }
      if (ttSubjectIds.length === 0) {
        return { canExecute: false, blockingReason: 'Cochez au moins une matière à reproduire.', notices };
      }
      if (ttTargetTermIds.length === 0) {
        return { canExecute: false, blockingReason: 'Cochez au moins un trimestre de destination.', notices };
      }
      if (contentAvailability.students === 0 && (gradebookOpts.contentMode === 'students_only' || gradebookOpts.contentMode === 'students_and_notes')) {
        notices.push('Aucun élève nommé dans les matières sélectionnées : seules les matières et leurs barèmes seront copiés.');
      } else if (contentAvailability.notes === 0 && gradebookOpts.contentMode === 'students_and_notes') {
        notices.push('Aucune note saisie dans les matières sélectionnées : seule la liste des élèves sera copiée.');
      }
      return { canExecute: true, blockingReason: null, notices };
    }

    if (selectedMode === 'class_to_class') {
      if (ccLevelClasses.length < 2) {
        return { canExecute: false, blockingReason: 'Ce niveau contient moins de 2 classes. Créez une autre classe dans ce niveau pour effectuer un transfert.', notices };
      }
      if (ccTargetClassIds.length === 0) {
        return { canExecute: false, blockingReason: 'Cochez au moins une classe de destination.', notices };
      }
      if (!ccCopyTerms && !ccCopySubjects) {
        return { canExecute: false, blockingReason: 'Cochez au moins un type d’élément à transférer (trimestres ou matières).', notices };
      }
      if (ccCopyTerms && ccTermIds.length === 0) {
        return { canExecute: false, blockingReason: 'Cochez au moins un trimestre à transférer.', notices };
      }
      if (ccCopySubjects && ccSourceSubjects.length === 0) {
        notices.push('La classe source ne contient aucune matière dans les trimestres sélectionnés.');
        if (!ccCopyTerms) {
          return { canExecute: false, blockingReason: 'Aucune matière disponible à transférer dans cette classe.', notices };
        }
      } else if (ccCopySubjects && ccSubjectIds.length === 0) {
        return { canExecute: false, blockingReason: 'Cochez au moins une matière ou décochez l’option Matières.', notices };
      }
      return { canExecute: true, blockingReason: null, notices };
    }

    if (selectedMode === 'level_to_level') {
      if (schoolLevels.length < 2) {
        return { canExecute: false, blockingReason: 'Un seul niveau d’étude existe dans cet établissement. Créez un second niveau pour transférer vers celui-ci.', notices };
      }
      if (llSourceClasses.length === 0) {
        return { canExecute: false, blockingReason: 'Le niveau source ne contient aucune classe ni donnée à transférer.', notices };
      }
      if (llClassIds.length === 0) {
        return { canExecute: false, blockingReason: 'Cochez au moins une classe source dont le contenu doit être transféré.', notices };
      }
      if (llTargetLevelIds.length === 0) {
        return { canExecute: false, blockingReason: 'Cochez au moins un niveau de destination.', notices };
      }
      if (!llCopyClasses && !llCopyTerms && !llCopySubjects) {
        return { canExecute: false, blockingReason: 'Cochez au moins un élément à transférer.', notices };
      }
      const emptyClassesCount = llClassIds.filter(
        (cid) => schoolSubjects.filter((s) => s.classId === cid).length === 0
      ).length;
      if (emptyClassesCount > 0 && llCopySubjects) {
        notices.push(
          `${plural(emptyClassesCount, 'classe sélectionnée ne contient', 'classes sélectionnées ne contiennent')} encore aucune matière : les autres éléments disponibles seront transférés.`
        );
      }
      return { canExecute: true, blockingReason: null, notices };
    }

    if (selectedMode === 'subject_to_subject') {
      if (!ssSourceSubjectId) {
        return { canExecute: false, blockingReason: 'Aucune matière disponible comme source.', notices };
      }
      const hasAnyData =
        contentAvailability.students > 0 ||
        contentAvailability.notes > 0 ||
        contentAvailability.metas > 0 ||
        contentAvailability.formatting > 0;
      if (!hasAnyData) {
        return { canExecute: false, blockingReason: 'Cette matière ne contient encore aucun élève, note ou barème personnalisé à copier.', notices };
      }
      if (ssTargetKeys.length === 0) {
        return { canExecute: false, blockingReason: 'Cochez au moins une matière de destination.', notices };
      }
      if (gradebookOpts.contentMode === 'students_only' && contentAvailability.students === 0) {
        return { canExecute: false, blockingReason: 'Aucun élève nommé dans la matière source.', notices };
      }
      if (gradebookOpts.contentMode === 'students_and_notes' && contentAvailability.notes === 0) {
        notices.push('Aucune note saisie dans cette matière : seule la liste des élèves sera copiée.');
      }
      return { canExecute: true, blockingReason: null, notices };
    }

    if (selectedMode === 'school_to_school') {
      if (otherSchools.length === 0) {
        return { canExecute: false, blockingReason: 'Aucun autre établissement disponible comme destination. Créez une autre école ou une nouvelle rentrée scolaire.', notices };
      }
      if (scLevelIds.length === 0) {
        return { canExecute: false, blockingReason: 'Cochez au moins un niveau d’étude à transférer.', notices };
      }
      if (scTargetSchoolIds.length === 0) {
        return { canExecute: false, blockingReason: 'Cochez au moins un établissement de destination.', notices };
      }
      return { canExecute: true, blockingReason: null, notices };
    }

    return { canExecute: false, blockingReason: null, notices };
  }, [
    selectedMode,
    ttClassId,
    ttSourceTermId,
    ttSourceSubjects,
    ttSubjectIds,
    ttTargetTermIds,
    ccLevelClasses,
    ccTargetClassIds,
    ccCopyTerms,
    ccTermIds,
    ccCopySubjects,
    ccSourceSubjects,
    ccSubjectIds,
    schoolLevels,
    llSourceClasses,
    llClassIds,
    llTargetLevelIds,
    llCopyClasses,
    llCopyTerms,
    llCopySubjects,
    schoolSubjects,
    ssSourceSubjectId,
    ssTargetKeys,
    otherSchools,
    scLevelIds,
    scTargetSchoolIds,
    contentAvailability,
    gradebookOpts.contentMode,
  ]);

  // ---------- Exécution du transfert ----------
  const handleRunTransfer = async () => {
    if (!selectedMode || !validationState.canExecute || isTransferring) return;

    let plan: TransferPlan | null = null;

    if (selectedMode === 'term_to_term') {
      plan = {
        mode: 'term_to_term',
        sourceClassId: ttClassId,
        sourceTermId: ttSourceTermId,
        subjectIds: ttSubjectIds,
        targetTermIds: ttTargetTermIds,
        applyToAllClassesInLevel: ttApplyAllClassesInLevel,
        levelId: ttLevelId,
        conflictStrategy,
        gradebook: gradebookOpts,
      };
    } else if (selectedMode === 'class_to_class') {
      plan = {
        mode: 'class_to_class',
        sourceClassId: ccSourceClassId,
        targetClassIds: ccTargetClassIds,
        copyTerms: ccCopyTerms,
        termIds: ccTermIds,
        copySubjects: ccCopySubjects,
        subjectIds: ccSubjectIds,
        conflictStrategy,
        gradebook: gradebookOpts,
      };
    } else if (selectedMode === 'level_to_level') {
      plan = {
        mode: 'level_to_level',
        sourceLevelId: llSourceLevelId,
        targetLevelIds: llTargetLevelIds,
        copyClasses: llCopyClasses,
        classIds: llClassIds,
        copyTerms: llCopyTerms,
        termNumbers: llTermNumbers,
        copySubjects: llCopySubjects,
        subjectIds: llSubjectIds,
        conflictStrategy,
        gradebook: gradebookOpts,
      };
    } else if (selectedMode === 'subject_to_subject') {
      const targetEntries = ssTargetKeys.map((k) => {
        const [subjectId, termId] = k.split('__');
        return { subjectId, termId };
      });
      plan = {
        mode: 'subject_to_subject',
        sourceSubjectId: ssSourceSubjectId,
        sourceTermId: ssSourceTermId,
        targetEntries,
        gradebook: gradebookOpts,
      };
    } else if (selectedMode === 'school_to_school') {
      plan = {
        mode: 'school_to_school',
        sourceSchoolId: currentSchool.id,
        targetSchoolIds: scTargetSchoolIds,
        levelIds: scLevelIds,
        copyClasses: scCopyClasses,
        copyTerms: scCopyTerms,
        copySubjects: scCopySubjects,
        conflictStrategy,
        gradebook: gradebookOpts,
      };
    }

    if (!plan) return;

    setIsTransferring(true);
    try {
      const result = executeTransfer(
        plan,
        {
          schoolYears,
          schools,
          studyLevels,
          classes,
          terms,
          subjects,
        },
        // En mode cloud connecté, la copie réelle des tableurs + photos R2 est effectuée côté D1/R2
        serverGradebookStats ? null : undefined
      );

      const serverSummary = await onApplyTransfer({
        studyLevels: result.nextStudyLevels,
        classes: result.nextClasses,
        terms: result.nextTerms,
        subjects: result.nextSubjects,
        createdLevels: result.createdLevels,
        createdClasses: result.createdClasses,
        createdTerms: result.createdTerms,
        createdSubjects: result.createdSubjects,
        updatedSubjects: result.updatedSubjects,
        gradebookCopyOps: result.gradebookCopyOps,
      });

      const mergedSummary: TransferSummary = serverSummary
        ? {
            ...result.summary,
            gradebooksCopied: serverSummary.gradebooksCopied ?? result.summary.gradebooksCopied,
            studentsCopied: serverSummary.studentsCopied ?? result.summary.studentsCopied,
            notesCopied: serverSummary.notesCopied ?? result.summary.notesCopied,
            photosCopied: serverSummary.photosCopied ?? result.summary.photosCopied,
          }
        : result.summary;

      setLastResult({ mode: selectedMode, summary: mergedSummary });
    } finally {
      setIsTransferring(false);
    }
  };

  // ---------- Helper UI : Bloc d'options de contenu des tableurs (sobre & précis) ----------
  const renderGradebookOptionsBlock = (allowNone: boolean) => {
    const options: Array<{
      id: GradebookContentMode;
      label: string;
      desc: string;
      badge?: string;
      disabled?: boolean;
    }> = [];

    if (allowNone) {
      options.push({
        id: 'none',
        label: 'Matières uniquement (tableurs vierges)',
        desc: 'Crée uniquement les matières avec leurs coefficients et couleurs.',
      });
    }

    options.push(
      {
        id: 'structure',
        label: 'Structure et barèmes uniquement (sans élèves)',
        desc: 'Copie le nombre de colonnes de notes, leurs titres et leurs barèmes (/20, /40…).',
        badge: contentAvailability.metas > 0 ? `${plural(contentAvailability.metas, 'barème personnalisé', 'barèmes personnalisés')}` : 'Colonnes standard',
      },
      {
        id: 'students_only',
        label: 'Noms des élèves uniquement (sans les notes)',
        desc: 'Reproduit la liste complète des élèves en remettant toutes les notes à vide.',
        badge: contentAvailability.students > 0 ? plural(contentAvailability.students, 'élève disponible', 'élèves disponibles') : '0 élève saisi',
        disabled: contentAvailability.students === 0,
      },
      {
        id: 'students_and_notes',
        label: 'Élèves + toutes les notes saisies',
        desc: 'Copie intégralement les élèves ainsi que l’ensemble des notes enregistrées.',
        badge: contentAvailability.notes > 0 ? `${plural(contentAvailability.students, 'élève')} • ${plural(contentAvailability.notes, 'note')}` : '0 note saisie',
        disabled: contentAvailability.students === 0 && contentAvailability.notes === 0,
      }
    );

    return (
      <div className="space-y-3 pt-3 border-t border-slate-200">
        <div>
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
            Contenu des tableurs à transférer
          </h4>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Choisissez quelles données internes aux matières doivent suivre.
          </p>
        </div>

        <div className="space-y-1.5">
          {options.map((opt) => {
            const isChecked = gradebookOpts.contentMode === opt.id;
            return (
              <label
                key={opt.id}
                className={`flex items-start gap-2.5 p-2.5 rounded-lg border transition cursor-pointer ${
                  opt.disabled
                    ? 'bg-slate-50 border-slate-200/80 opacity-60 cursor-not-allowed'
                    : isChecked
                    ? 'bg-slate-50 border-slate-800'
                    : 'bg-white border-slate-200 hover:border-slate-300'
                }`}
              >
                <input
                  type="radio"
                  name="gradebookContentMode"
                  checked={isChecked}
                  disabled={opt.disabled}
                  onChange={() =>
                    setGradebookOpts((prev) => ({ ...prev, contentMode: opt.id }))
                  }
                  className="mt-0.5 accent-slate-900 cursor-pointer"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className="text-xs font-semibold text-slate-900">
                      {opt.label}
                    </span>
                    {opt.badge && (
                      <span className="text-[10px] font-medium text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                        {opt.badge}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                    {opt.desc}
                  </p>
                </div>
              </label>
            );
          })}
        </div>

        {gradebookOpts.contentMode !== 'none' && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
            {(gradebookOpts.contentMode === 'students_only' ||
              gradebookOpts.contentMode === 'students_and_notes') && (
              <label
                className={`flex items-center gap-2 px-2.5 py-2 rounded-lg border text-[11px] font-medium ${
                  contentAvailability.photos === 0
                    ? 'bg-slate-50 border-slate-200 text-slate-400 cursor-not-allowed'
                    : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300 cursor-pointer'
                }`}
              >
                <input
                  type="checkbox"
                  checked={gradebookOpts.includePhotos && contentAvailability.photos > 0}
                  disabled={contentAvailability.photos === 0}
                  onChange={(e) =>
                    setGradebookOpts((prev) => ({ ...prev, includePhotos: e.target.checked }))
                  }
                  className="accent-slate-900"
                />
                <span className="truncate">
                  Photos ({contentAvailability.photos})
                </span>
              </label>
            )}

            <label className="flex items-center gap-2 px-2.5 py-2 rounded-lg border border-slate-200 bg-white hover:border-slate-300 text-[11px] font-medium text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={gradebookOpts.includeMetas}
                onChange={(e) =>
                  setGradebookOpts((prev) => ({ ...prev, includeMetas: e.target.checked }))
                }
                className="accent-slate-900"
              />
              <span className="truncate">Barèmes & titres</span>
            </label>

            <label
              className={`flex items-center gap-2 px-2.5 py-2 rounded-lg border text-[11px] font-medium ${
                contentAvailability.formatting === 0
                  ? 'bg-slate-50 border-slate-200 text-slate-400 cursor-not-allowed'
                  : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300 cursor-pointer'
              }`}
            >
              <input
                type="checkbox"
                checked={gradebookOpts.includeFormatting && contentAvailability.formatting > 0}
                disabled={contentAvailability.formatting === 0}
                onChange={(e) =>
                  setGradebookOpts((prev) => ({ ...prev, includeFormatting: e.target.checked }))
                }
                className="accent-slate-900"
              />
              <span className="truncate">Mise en forme</span>
            </label>
          </div>
        )}
      </div>
    );
  };

  // ---------- Helper UI : Gestion des doublons ----------
  const renderConflictBlock = () => (
    <div className="space-y-2 pt-3 border-t border-slate-200">
      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
        Si un élément existe déjà à destination
      </h4>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        {(
          [
            { id: 'skip', label: 'Ignorer', desc: 'Conserver l’existant intact' },
            { id: 'merge', label: 'Compléter', desc: 'Mettre à jour le contenu' },
            { id: 'replace', label: 'Remplacer', desc: 'Écraser par la source' },
          ] as const
        ).map((opt) => (
          <button
            key={opt.id}
            type="button"
            onClick={() => setConflictStrategy(opt.id)}
            className={`px-3 py-2 rounded-lg border text-left transition cursor-pointer ${
              conflictStrategy === opt.id
                ? 'bg-slate-900 text-white border-slate-900'
                : 'bg-white text-slate-700 border-slate-200 hover:border-slate-400'
            }`}
          >
            <div className="text-xs font-semibold leading-tight">{opt.label}</div>
            <div
              className={`text-[10px] mt-0.5 leading-tight ${
                conflictStrategy === opt.id ? 'text-slate-300' : 'text-slate-500'
              }`}
            >
              {opt.desc}
            </div>
          </button>
        ))}
      </div>
    </div>
  );

  // ---------- Titres des modes ----------
  const MODE_TITLES: Record<TransferMode, string> = {
    term_to_term: 'Reproduire les matières vers un autre trimestre',
    class_to_class: 'Transférer dans un même niveau (entre classes)',
    level_to_level: "Transférer d'un niveau vers un autre niveau",
    subject_to_subject: 'Partager la liste d’élèves ou un tableur entre matières',
    school_to_school: 'Transférer vers un autre établissement ou une autre rentrée',
  };

  // ---------- Helper de sélection multiple ----------
  const toggleInArray = <T,>(arr: T[], value: T): T[] =>
    arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value];

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-slate-50/90 rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden animate-fade-in">
      {/* Barre supérieure sobre (identique à la logique Retour des cartes) */}
      <div className="flex items-center justify-between gap-2 sm:gap-3 px-2.5 sm:px-6 py-2.5 sm:py-3 bg-white border-b border-slate-200 shrink-0">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <button
            type="button"
            onClick={() => {
              if (lastResult) {
                setLastResult(null);
              } else if (selectedMode) {
                setSelectedMode(null);
              } else {
                onClose();
              }
            }}
            className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-lg bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 text-[11px] sm:text-xs font-semibold transition cursor-pointer shrink-0"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>{lastResult ? 'Retour' : selectedMode ? 'Options' : 'Retour'}</span>
          </button>

          <div className="min-w-0">
            <h2 className="text-xs sm:text-base font-bold text-slate-900 truncate leading-tight">
              {selectedMode ? MODE_TITLES[selectedMode] : 'Transfert et duplication'}
            </h2>
            <p className="text-[10px] sm:text-[11px] text-slate-500 truncate mt-0.5">
              {currentSchool.name}
              {currentYear ? ` • ${currentYear.label}` : ''}
              <span className="hidden sm:inline">{` • ${plural(schoolLevels.length, 'niveau', 'niveaux')}, ${plural(schoolClasses.length, 'classe')}, ${plural(schoolSubjects.length, 'matière')}`}</span>
            </p>
          </div>
        </div>

        {selectedMode && (
          <button
            type="button"
            onClick={onClose}
            className="px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600 text-[11px] sm:text-xs font-medium transition cursor-pointer shrink-0"
          >
            Quitter
          </button>
        )}
      </div>

      {/* Corps défilable */}
      <div className="flex-1 overflow-y-auto p-3 sm:p-6 pb-20 sm:pb-6">
        {/* =================================================================== */}
        {/* ÉCRAN DE CONFIRMATION APRÈS TRANSFERT                               */}
        {/* =================================================================== */}
        {lastResult ? (
          <div className="max-w-xl mx-auto bg-white rounded-xl border border-slate-200 p-6 space-y-5">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-900 shrink-0">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Transfert effectué avec succès
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {MODE_TITLES[lastResult.mode]}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {lastResult.summary.levelsCreated > 0 && (
                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                  <div className="text-lg font-bold text-slate-900">{lastResult.summary.levelsCreated}</div>
                  <div className="text-[11px] text-slate-500">Niveau(x) créé(s)</div>
                </div>
              )}
              {lastResult.summary.classesCreated > 0 && (
                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                  <div className="text-lg font-bold text-slate-900">{lastResult.summary.classesCreated}</div>
                  <div className="text-[11px] text-slate-500">Classe(s) créée(s)</div>
                </div>
              )}
              {lastResult.summary.termsCreated > 0 && (
                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                  <div className="text-lg font-bold text-slate-900">{lastResult.summary.termsCreated}</div>
                  <div className="text-[11px] text-slate-500">Trimestre(s) créé(s)</div>
                </div>
              )}
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                <div className="text-lg font-bold text-slate-900">{lastResult.summary.subjectsCreated}</div>
                <div className="text-[11px] text-slate-500">Matière(s) créée(s)</div>
              </div>
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                <div className="text-lg font-bold text-slate-900">{lastResult.summary.subjectsUpdated}</div>
                <div className="text-[11px] text-slate-500">Matière(s) mise(s) à jour</div>
              </div>
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                <div className="text-lg font-bold text-slate-900">{lastResult.summary.studentsCopied}</div>
                <div className="text-[11px] text-slate-500">Élève(s) copié(s)</div>
              </div>
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                <div className="text-lg font-bold text-slate-900">{lastResult.summary.notesCopied}</div>
                <div className="text-[11px] text-slate-500">Note(s) copiée(s)</div>
              </div>
              {lastResult.summary.photosCopied > 0 && (
                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                  <div className="text-lg font-bold text-slate-900">{lastResult.summary.photosCopied}</div>
                  <div className="text-[11px] text-slate-500">Photo(s) copiée(s)</div>
                </div>
              )}
              {lastResult.summary.subjectsSkipped > 0 && (
                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                  <div className="text-lg font-bold text-slate-700">{lastResult.summary.subjectsSkipped}</div>
                  <div className="text-[11px] text-slate-500">Doublon(s) ignoré(s)</div>
                </div>
              )}
            </div>

            {lastResult.summary.warnings.length > 0 && (
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-300 space-y-1">
                {lastResult.summary.warnings.map((w, idx) => (
                  <p key={idx} className="text-xs text-slate-700 flex items-start gap-2">
                    <Info className="w-3.5 h-3.5 mt-0.5 shrink-0 text-slate-500" />
                    <span>{w}</span>
                  </p>
                ))}
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={() => {
                  setLastResult(null);
                  setSelectedMode(null);
                }}
                className="px-4 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-800 transition cursor-pointer"
              >
                Nouveau transfert
              </button>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-xs font-semibold text-white transition cursor-pointer"
              >
                Retourner à {currentSchool.name}
              </button>
            </div>
          </div>
        ) : !selectedMode ? (
          /* =================================================================== */
          /* ÉCRAN D'ACCUEIL : CHOIX DU TYPE DE TRANSFERT (SOBRE & PRO)          */
          /* =================================================================== */
          <div className="max-w-4xl mx-auto space-y-4">
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-slate-900">
                Choisissez l’opération à effectuer
              </h3>
              <p className="text-xs text-slate-500">
                Dupliquez vos structures, matières, listes d’élèves et évaluations sans ressaisir ce qui existe déjà.
              </p>
            </div>

            {schoolClasses.length === 0 && (
              <div className="p-3.5 rounded-xl bg-white border border-slate-300 flex items-start gap-2.5 text-xs text-slate-700">
                <AlertCircle className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold text-slate-900">Aucune classe créée pour le moment.</span>{' '}
                  Créez au moins une classe et des matières dans un niveau pour activer les transferts entre trimestres, classes et matières.
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* Option 1 : Reproduire les matières dans un autre trimestre */}
              <button
                type="button"
                onClick={() => {
                  setSelectedMode('term_to_term');
                  setGradebookOpts({ ...DEFAULT_GRADEBOOK_OPTIONS, contentMode: 'students_only' });
                }}
                className="group text-left p-4 rounded-xl bg-white border border-slate-200 hover:border-slate-400 transition flex flex-col justify-between gap-3 cursor-pointer"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700 shrink-0">
                      <Calendar className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-900 leading-snug">
                        Envoyer les matières dans un autre trimestre
                      </h4>
                      <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                        Reproduisez les matières d’un trimestre vers un ou plusieurs autres trimestres (matières seules, avec les élèves sans notes, ou avec les notes).
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-slate-700 group-hover:translate-x-0.5 transition shrink-0 mt-1" />
                </div>
                <div className="flex items-center justify-between pt-2.5 border-t border-slate-100 text-[11px] text-slate-500">
                  <span>
                    {schoolSubjects.length > 0
                      ? `${plural(schoolSubjects.length, 'matière disponible', 'matières disponibles')}`
                      : 'Aucune matière créée pour l’instant'}
                  </span>
                  <span className="font-semibold text-slate-700">Ouvrir</span>
                </div>
              </button>

              {/* Option 2 : Transférer dans un même niveau (entre classes) */}
              <button
                type="button"
                onClick={() => {
                  setSelectedMode('class_to_class');
                  setGradebookOpts({ ...DEFAULT_GRADEBOOK_OPTIONS, contentMode: 'none' });
                }}
                className="group text-left p-4 rounded-xl bg-white border border-slate-200 hover:border-slate-400 transition flex flex-col justify-between gap-3 cursor-pointer"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700 shrink-0">
                      <Copy className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-900 leading-snug">
                        Transférer dans un même niveau (entre classes)
                      </h4>
                      <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                        Sélectionnez un niveau et copiez trimestres, matières, barèmes ou élèves d’une classe vers une ou plusieurs autres classes du même niveau.
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-slate-700 group-hover:translate-x-0.5 transition shrink-0 mt-1" />
                </div>
                <div className="flex items-center justify-between pt-2.5 border-t border-slate-100 text-[11px] text-slate-500">
                  <span>
                    {globalDiagnostics.levelsWithTwoClasses > 0
                      ? `${plural(globalDiagnostics.levelsWithTwoClasses, 'niveau prêt', 'niveaux prêts')} (2+ classes)`
                      : 'Nécessite au moins 2 classes dans un niveau'}
                  </span>
                  <span className="font-semibold text-slate-700">Ouvrir</span>
                </div>
              </button>

              {/* Option 3 : Transférer d'un niveau vers un autre niveau */}
              <button
                type="button"
                onClick={() => {
                  setSelectedMode('level_to_level');
                  setGradebookOpts({ ...DEFAULT_GRADEBOOK_OPTIONS, contentMode: 'students_only' });
                }}
                className="group text-left p-4 rounded-xl bg-white border border-slate-200 hover:border-slate-400 transition flex flex-col justify-between gap-3 cursor-pointer"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700 shrink-0">
                      <Layers className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-900 leading-snug">
                        Transférer d’un niveau vers un autre niveau
                      </h4>
                      <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                        Envoyez tout ou partie d’un niveau (classes, trimestres, matières, élèves avec ou sans notes) vers un ou plusieurs autres niveaux.
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-slate-700 group-hover:translate-x-0.5 transition shrink-0 mt-1" />
                </div>
                <div className="flex items-center justify-between pt-2.5 border-t border-slate-100 text-[11px] text-slate-500">
                  <span>
                    {schoolLevels.length >= 2
                      ? `${plural(schoolLevels.length, 'niveau disponible', 'niveaux disponibles')}`
                      : 'Créez un second niveau pour activer'}
                  </span>
                  <span className="font-semibold text-slate-700">Ouvrir</span>
                </div>
              </button>

              {/* Option 4 : Partager la liste d'élèves / tableur entre matières */}
              <button
                type="button"
                onClick={() => {
                  setSelectedMode('subject_to_subject');
                  setGradebookOpts({ ...DEFAULT_GRADEBOOK_OPTIONS, contentMode: 'students_only' });
                }}
                className="group text-left p-4 rounded-xl bg-white border border-slate-200 hover:border-slate-400 transition flex flex-col justify-between gap-3 cursor-pointer"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700 shrink-0">
                      <Users className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-900 leading-snug">
                        Partager une liste d’élèves ou un tableur entre matières
                      </h4>
                      <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                        Copiez les noms d’élèves (et photos) déjà saisis dans une matière vers d’autres matières de la classe, du niveau ou de l’école, sans recopier les notes.
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-slate-700 group-hover:translate-x-0.5 transition shrink-0 mt-1" />
                </div>
                <div className="flex items-center justify-between pt-2.5 border-t border-slate-100 text-[11px] text-slate-500">
                  <span>
                    {globalDiagnostics.subjectsWithStudents > 0
                      ? `${plural(globalDiagnostics.subjectsWithStudents, 'matière contenant des élèves', 'matières contenant des élèves')}`
                      : 'Aucun élève saisi dans les tableurs'}
                  </span>
                  <span className="font-semibold text-slate-700">Ouvrir</span>
                </div>
              </button>

              {/* Option 5 : Transférer vers un autre établissement / rentrée scolaire */}
              <button
                type="button"
                onClick={() => {
                  setSelectedMode('school_to_school');
                  setScLevelIds(schoolLevels.map((l) => l.id));
                  setGradebookOpts({ ...DEFAULT_GRADEBOOK_OPTIONS, contentMode: 'students_only' });
                }}
                className="group text-left p-4 rounded-xl bg-white border border-slate-200 hover:border-slate-400 transition flex flex-col justify-between gap-3 cursor-pointer md:col-span-2"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700 shrink-0">
                      <Building2 className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-900 leading-snug">
                        Transférer vers un autre établissement ou une autre rentrée scolaire
                      </h4>
                      <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                        Exportez des niveaux complets (classes, trimestres, matières, listes d’élèves) vers une autre école ou pour préparer une nouvelle année scolaire.
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-slate-700 group-hover:translate-x-0.5 transition shrink-0 mt-1" />
                </div>
                <div className="flex items-center justify-between pt-2.5 border-t border-slate-100 text-[11px] text-slate-500">
                  <span>
                    {otherSchools.length > 0
                      ? `${plural(otherSchools.length, 'autre établissement disponible', 'autres établissements disponibles')}`
                      : 'Aucun autre établissement enregistré pour le moment'}
                  </span>
                  <span className="font-semibold text-slate-700">Ouvrir</span>
                </div>
              </button>
            </div>
          </div>
        ) : (
          /* =================================================================== */
          /* VUE DÉTAILLÉE DU MODE CHOISI (2 COLONNES PRO : SOURCE | DESTINATION) */
          /* =================================================================== */
          <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            {/* COLONNE GAUCHE (7 cols) : SOURCE & ÉLÉMENTS À COCHER */}
            <div className="lg:col-span-7 bg-white rounded-xl border border-slate-200 p-4 sm:p-5 space-y-4">
              {/* -------------------- MODE 1 : TRIMESTRE -> TRIMESTRE -------------------- */}
              {selectedMode === 'term_to_term' && (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600">
                        Niveau d’étude
                      </label>
                      <select
                        value={ttLevelId}
                        onChange={(e) => setTtLevelId(e.target.value)}
                        className="w-full px-2.5 py-2 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-800 focus:outline-none focus:border-slate-600"
                      >
                        {schoolLevels.map((l) => (
                          <option key={l.id} value={l.id}>
                            {l.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600">
                        Classe source
                      </label>
                      <select
                        value={ttClassId}
                        onChange={(e) => setTtClassId(e.target.value)}
                        disabled={ttLevelClasses.length === 0}
                        className="w-full px-2.5 py-2 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-800 focus:outline-none focus:border-slate-600 disabled:bg-slate-100"
                      >
                        {ttLevelClasses.length === 0 ? (
                          <option value="">Aucune classe</option>
                        ) : (
                          ttLevelClasses.map((c) => (
                            <option key={c.id} value={c.id}>
                              {getEffectiveClassName(c)}
                            </option>
                          ))
                        )}
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600">
                        Trimestre source
                      </label>
                      <select
                        value={ttSourceTermId}
                        onChange={(e) => setTtSourceTermId(e.target.value)}
                        disabled={ttClassTerms.length === 0}
                        className="w-full px-2.5 py-2 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-800 focus:outline-none focus:border-slate-600 disabled:bg-slate-100"
                      >
                        {ttClassTerms.map((t) => {
                          const cnt = schoolSubjects.filter(
                            (s) => s.classId === ttClassId && getEffectiveSubjectTermId(s, ttClassTerms) === t.id
                          ).length;
                          return (
                            <option key={t.id} value={t.id}>
                              {t.name} ({cnt} mat.)
                            </option>
                          );
                        })}
                      </select>
                    </div>
                  </div>

                  {/* Liste des matières du trimestre source à cocher */}
                  <div className="space-y-2 pt-2 border-t border-slate-200">
                    <div className="flex items-center justify-between gap-2">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                        Matières à reproduire ({ttSubjectIds.length}/{ttSourceSubjects.length})
                      </h4>
                      {ttSourceSubjects.length > 0 && (
                        <button
                          type="button"
                          onClick={() =>
                            setTtSubjectIds(
                              ttSubjectIds.length === ttSourceSubjects.length
                                ? []
                                : ttSourceSubjects.map((s) => s.id)
                            )
                          }
                          className="text-[11px] font-semibold text-slate-600 hover:text-slate-900 underline cursor-pointer"
                        >
                          {ttSubjectIds.length === ttSourceSubjects.length ? 'Tout décocher' : 'Tout cocher'}
                        </button>
                      )}
                    </div>

                    {ttSourceSubjects.length === 0 ? (
                      <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-500">
                        Aucune matière enregistrée dans ce trimestre. Sélectionnez un autre trimestre contenant des matières.
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-52 overflow-y-auto pr-1">
                        {ttSourceSubjects.map((subj) => {
                          const checked = ttSubjectIds.includes(subj.id);
                          const st = getSubjectStats(subj);
                          return (
                            <label
                              key={subj.id}
                              className={`flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg border text-xs cursor-pointer transition ${
                                checked
                                  ? 'bg-slate-50 border-slate-800 text-slate-900'
                                  : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                              }`}
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() => setTtSubjectIds((prev) => toggleInArray(prev, subj.id))}
                                  className="accent-slate-900 shrink-0"
                                />
                                <span className="font-semibold truncate">{subj.name}</span>
                              </div>
                              <span className="text-[10px] text-slate-500 shrink-0">
                                {st.namedStudentsCount > 0
                                  ? `${st.namedStudentsCount} él. / ${st.notesCount} n.`
                                  : 'Vide'}
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {renderGradebookOptionsBlock(true)}
                </>
              )}

              {/* -------------------- MODE 2 : CLASSE -> CLASSE (MÊME NIVEAU) -------------------- */}
              {selectedMode === 'class_to_class' && (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600">
                        Niveau d’étude concerné
                      </label>
                      <select
                        value={ccLevelId}
                        onChange={(e) => setCcLevelId(e.target.value)}
                        className="w-full px-2.5 py-2 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-800 focus:outline-none focus:border-slate-600"
                      >
                        {schoolLevels.map((l) => {
                          const cnt = schoolClasses.filter((c) => c.levelId === l.id).length;
                          return (
                            <option key={l.id} value={l.id}>
                              {l.name} ({plural(cnt, 'classe')})
                            </option>
                          );
                        })}
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600">
                        Classe source
                      </label>
                      <select
                        value={ccSourceClassId}
                        onChange={(e) => setCcSourceClassId(e.target.value)}
                        disabled={ccLevelClasses.length === 0}
                        className="w-full px-2.5 py-2 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-800 focus:outline-none focus:border-slate-600 disabled:bg-slate-100"
                      >
                        {ccLevelClasses.length === 0 ? (
                          <option value="">Aucune classe</option>
                        ) : (
                          ccLevelClasses.map((c) => {
                            const cnt = schoolSubjects.filter((s) => s.classId === c.id).length;
                            return (
                              <option key={c.id} value={c.id}>
                                {getEffectiveClassName(c)} ({cnt} mat.)
                              </option>
                            );
                          })
                        )}
                      </select>
                    </div>
                  </div>

                  {/* Trimestres à inclure */}
                  <div className="space-y-2 pt-2 border-t border-slate-200">
                    <div className="flex items-center justify-between gap-2">
                      <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={ccCopyTerms}
                          onChange={(e) => setCcCopyTerms(e.target.checked)}
                          className="accent-slate-900"
                        />
                        <span>Trimestres ({ccTermIds.length}/{ccSourceTerms.length})</span>
                      </label>
                      {ccCopyTerms && ccSourceTerms.length > 0 && (
                        <button
                          type="button"
                          onClick={() =>
                            setCcTermIds(
                              ccTermIds.length === ccSourceTerms.length ? [] : ccSourceTerms.map((t) => t.id)
                            )
                          }
                          className="text-[11px] font-semibold text-slate-600 hover:text-slate-900 underline cursor-pointer"
                        >
                          {ccTermIds.length === ccSourceTerms.length ? 'Tout décocher' : 'Tout cocher'}
                        </button>
                      )}
                    </div>

                    {ccCopyTerms && (
                      <div className="flex flex-wrap gap-1.5">
                        {ccSourceTerms.map((t) => {
                          const checked = ccTermIds.includes(t.id);
                          const cnt = schoolSubjects.filter(
                            (s) => s.classId === ccSourceClassId && getEffectiveSubjectTermId(s, ccSourceTerms) === t.id
                          ).length;
                          return (
                            <label
                              key={t.id}
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium cursor-pointer transition ${
                                checked
                                  ? 'bg-slate-50 border-slate-800 text-slate-900'
                                  : 'bg-white border-slate-200 text-slate-600'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => setCcTermIds((prev) => toggleInArray(prev, t.id))}
                                className="accent-slate-900"
                              />
                              <span>{t.name}</span>
                              <span className="text-[10px] text-slate-400">({cnt})</span>
                            </label>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Matières à inclure */}
                  <div className="space-y-2 pt-2 border-t border-slate-200">
                    <div className="flex items-center justify-between gap-2">
                      <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={ccCopySubjects}
                          onChange={(e) => setCcCopySubjects(e.target.checked)}
                          className="accent-slate-900"
                        />
                        <span>Matières ({ccSubjectIds.length}/{ccSourceSubjects.length})</span>
                      </label>
                      {ccCopySubjects && ccSourceSubjects.length > 0 && (
                        <button
                          type="button"
                          onClick={() =>
                            setCcSubjectIds(
                              ccSubjectIds.length === ccSourceSubjects.length ? [] : ccSourceSubjects.map((s) => s.id)
                            )
                          }
                          className="text-[11px] font-semibold text-slate-600 hover:text-slate-900 underline cursor-pointer"
                        >
                          {ccSubjectIds.length === ccSourceSubjects.length ? 'Tout décocher' : 'Tout cocher'}
                        </button>
                      )}
                    </div>

                    {ccCopySubjects && (
                      ccSourceSubjects.length === 0 ? (
                        <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-500">
                          Aucune matière dans les trimestres sélectionnés de cette classe.
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-48 overflow-y-auto pr-1">
                          {ccSourceSubjects.map((subj) => {
                            const checked = ccSubjectIds.includes(subj.id);
                            const effId = getEffectiveSubjectTermId(subj, ccSourceTerms);
                            const tName = ccSourceTerms.find((t) => t.id === effId)?.name || 'T1';
                            const st = getSubjectStats(subj);
                            return (
                              <label
                                key={subj.id}
                                className={`flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg border text-xs cursor-pointer transition ${
                                  checked
                                    ? 'bg-slate-50 border-slate-800 text-slate-900'
                                    : 'bg-white border-slate-200 text-slate-600'
                                }`}
                              >
                                <div className="flex items-center gap-2 min-w-0">
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={() => setCcSubjectIds((prev) => toggleInArray(prev, subj.id))}
                                    className="accent-slate-900 shrink-0"
                                  />
                                  <div className="min-w-0">
                                    <div className="font-semibold truncate">{subj.name}</div>
                                    <div className="text-[10px] text-slate-400">{tName}</div>
                                  </div>
                                </div>
                                <span className="text-[10px] text-slate-500 shrink-0">
                                  {st.namedStudentsCount > 0 ? `${st.namedStudentsCount} él.` : 'Vide'}
                                </span>
                              </label>
                            );
                          })}
                        </div>
                      )
                    )}
                  </div>

                  {ccCopySubjects && ccSourceSubjects.length > 0 && renderGradebookOptionsBlock(true)}
                </>
              )}

              {/* -------------------- MODE 3 : NIVEAU -> NIVEAU -------------------- */}
              {selectedMode === 'level_to_level' && (
                <>
                  <div className="space-y-1">
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600">
                      Niveau d’étude source
                    </label>
                    <select
                      value={llSourceLevelId}
                      onChange={(e) => setLlSourceLevelId(e.target.value)}
                      className="w-full px-2.5 py-2 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-800 focus:outline-none focus:border-slate-600"
                    >
                      {schoolLevels.map((l) => {
                        const clsCnt = schoolClasses.filter((c) => c.levelId === l.id).length;
                        const subCnt = schoolSubjects.filter((s) =>
                          schoolClasses.some((c) => c.id === s.classId && c.levelId === l.id)
                        ).length;
                        return (
                          <option key={l.id} value={l.id}>
                            {l.name} — {plural(clsCnt, 'classe')}, {plural(subCnt, 'matière')}
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  {/* Classes à transférer */}
                  <div className="space-y-2 pt-2 border-t border-slate-200">
                    <div className="flex items-center justify-between gap-2">
                      <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={llCopyClasses}
                          onChange={(e) => setLlCopyClasses(e.target.checked)}
                          className="accent-slate-900"
                        />
                        <span>Créer / copier les classes ({llClassIds.length}/{llSourceClasses.length})</span>
                      </label>
                      {llSourceClasses.length > 0 && (
                        <button
                          type="button"
                          onClick={() =>
                            setLlClassIds(
                              llClassIds.length === llSourceClasses.length ? [] : llSourceClasses.map((c) => c.id)
                            )
                          }
                          className="text-[11px] font-semibold text-slate-600 hover:text-slate-900 underline cursor-pointer"
                        >
                          {llClassIds.length === llSourceClasses.length ? 'Tout décocher' : 'Tout cocher'}
                        </button>
                      )}
                    </div>

                    {llSourceClasses.length === 0 ? (
                      <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-500">
                        Ce niveau ne contient encore aucune classe.
                      </div>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {llSourceClasses.map((cls) => {
                          const checked = llClassIds.includes(cls.id);
                          const cnt = schoolSubjects.filter((s) => s.classId === cls.id).length;
                          return (
                            <label
                              key={cls.id}
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium cursor-pointer transition ${
                                checked
                                  ? 'bg-slate-50 border-slate-800 text-slate-900'
                                  : 'bg-white border-slate-200 text-slate-600'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => setLlClassIds((prev) => toggleInArray(prev, cls.id))}
                                className="accent-slate-900"
                              />
                              <span>{getEffectiveClassName(cls)}</span>
                              <span className="text-[10px] text-slate-400">({cnt} mat.)</span>
                            </label>
                          );
                        })}
                      </div>
                    )}
                    {!llCopyClasses && (
                      <p className="text-[11px] text-slate-500">
                        Case décochée : les trimestres et matières cochés ci-dessous seront ajoutés directement dans les classes déjà existantes du niveau cible.
                      </p>
                    )}
                  </div>

                  {/* Trimestres */}
                  <div className="space-y-2 pt-2 border-t border-slate-200">
                    <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={llCopyTerms}
                        onChange={(e) => setLlCopyTerms(e.target.checked)}
                        className="accent-slate-900"
                      />
                      <span>Trimestres à inclure</span>
                    </label>
                    {llCopyTerms && (
                      <div className="flex flex-wrap gap-1.5">
                        {llAvailableTermNumbers.map((num) => {
                          const checked = llTermNumbers.includes(num);
                          return (
                            <label
                              key={num}
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium cursor-pointer transition ${
                                checked
                                  ? 'bg-slate-50 border-slate-800 text-slate-900'
                                  : 'bg-white border-slate-200 text-slate-600'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => setLlTermNumbers((prev) => toggleInArray(prev, num))}
                                className="accent-slate-900"
                              />
                              <span>Trimestre {num}</span>
                            </label>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Matières */}
                  <div className="space-y-2 pt-2 border-t border-slate-200">
                    <div className="flex items-center justify-between gap-2">
                      <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={llCopySubjects}
                          onChange={(e) => setLlCopySubjects(e.target.checked)}
                          className="accent-slate-900"
                        />
                        <span>Matières ({llSubjectIds.length}/{llSourceSubjects.length})</span>
                      </label>
                      {llCopySubjects && llSourceSubjects.length > 0 && (
                        <button
                          type="button"
                          onClick={() =>
                            setLlSubjectIds(
                              llSubjectIds.length === llSourceSubjects.length ? [] : llSourceSubjects.map((s) => s.id)
                            )
                          }
                          className="text-[11px] font-semibold text-slate-600 hover:text-slate-900 underline cursor-pointer"
                        >
                          {llSubjectIds.length === llSourceSubjects.length ? 'Tout décocher' : 'Tout cocher'}
                        </button>
                      )}
                    </div>

                    {llCopySubjects && (
                      llSourceSubjects.length === 0 ? (
                        <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-500">
                          Aucune matière disponible dans les classes sélectionnées de ce niveau.
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-44 overflow-y-auto pr-1">
                          {llSourceSubjects.map((subj) => {
                            const checked = llSubjectIds.includes(subj.id);
                            const cls = schoolClasses.find((c) => c.id === subj.classId);
                            const st = getSubjectStats(subj);
                            return (
                              <label
                                key={subj.id}
                                className={`flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg border text-xs cursor-pointer transition ${
                                  checked
                                    ? 'bg-slate-50 border-slate-800 text-slate-900'
                                    : 'bg-white border-slate-200 text-slate-600'
                                }`}
                              >
                                <div className="flex items-center gap-2 min-w-0">
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={() => setLlSubjectIds((prev) => toggleInArray(prev, subj.id))}
                                    className="accent-slate-900 shrink-0"
                                  />
                                  <div className="min-w-0">
                                    <div className="font-semibold truncate">{subj.name}</div>
                                    <div className="text-[10px] text-slate-400 truncate">
                                      {cls ? getEffectiveClassName(cls) : ''}
                                    </div>
                                  </div>
                                </div>
                                <span className="text-[10px] text-slate-500 shrink-0">
                                  {st.namedStudentsCount > 0 ? `${st.namedStudentsCount} él.` : 'Vide'}
                                </span>
                              </label>
                            );
                          })}
                        </div>
                      )
                    )}
                  </div>

                  {llCopySubjects && llSourceSubjects.length > 0 && renderGradebookOptionsBlock(true)}
                </>
              )}

              {/* -------------------- MODE 4 : MATIÈRE -> MATIÈRE -------------------- */}
              {selectedMode === 'subject_to_subject' && (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600">
                        Niveau source
                      </label>
                      <select
                        value={ssSourceLevelId}
                        onChange={(e) => setSsSourceLevelId(e.target.value)}
                        className="w-full px-2.5 py-2 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-800 focus:outline-none focus:border-slate-600"
                      >
                        {schoolLevels.map((l) => (
                          <option key={l.id} value={l.id}>
                            {l.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600">
                        Classe source
                      </label>
                      <select
                        value={ssSourceClassId}
                        onChange={(e) => setSsSourceClassId(e.target.value)}
                        disabled={ssSourceClasses.length === 0}
                        className="w-full px-2.5 py-2 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-800 focus:outline-none focus:border-slate-600 disabled:bg-slate-100"
                      >
                        {ssSourceClasses.length === 0 ? (
                          <option value="">Aucune classe</option>
                        ) : (
                          ssSourceClasses.map((c) => (
                            <option key={c.id} value={c.id}>
                              {getEffectiveClassName(c)}
                            </option>
                          ))
                        )}
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600">
                        Trimestre source
                      </label>
                      <select
                        value={ssSourceTermId}
                        onChange={(e) => setSsSourceTermId(e.target.value)}
                        disabled={ssSourceTerms.length === 0}
                        className="w-full px-2.5 py-2 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-800 focus:outline-none focus:border-slate-600 disabled:bg-slate-100"
                      >
                        {ssSourceTerms.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600">
                        Matière source (tableur)
                      </label>
                      <select
                        value={ssSourceSubjectId}
                        onChange={(e) => setSsSourceSubjectId(e.target.value)}
                        disabled={ssSourceSubjects.length === 0}
                        className="w-full px-2.5 py-2 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-800 focus:outline-none focus:border-slate-600 disabled:bg-slate-100"
                      >
                        {ssSourceSubjects.length === 0 ? (
                          <option value="">Aucune matière</option>
                        ) : (
                          ssSourceSubjects.map((s) => {
                            const st = getSubjectStats(s);
                            return (
                              <option key={s.id} value={s.id}>
                                {s.name} ({st.namedStudentsCount} él., {st.notesCount} notes)
                              </option>
                            );
                          })
                        )}
                      </select>
                    </div>
                  </div>

                  {renderGradebookOptionsBlock(false)}
                </>
              )}

              {/* -------------------- MODE 5 : ÉCOLE -> ÉCOLE / ANNÉE -------------------- */}
              {selectedMode === 'school_to_school' && (
                <>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                        Niveaux d’étude de {currentSchool.name} à exporter ({scLevelIds.length}/{schoolLevels.length})
                      </h4>
                      <button
                        type="button"
                        onClick={() =>
                          setScLevelIds(
                            scLevelIds.length === schoolLevels.length ? [] : schoolLevels.map((l) => l.id)
                          )
                        }
                        className="text-[11px] font-semibold text-slate-600 hover:text-slate-900 underline cursor-pointer"
                      >
                        {scLevelIds.length === schoolLevels.length ? 'Tout décocher' : 'Tout cocher'}
                      </button>
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                      {schoolLevels.map((l) => {
                        const checked = scLevelIds.includes(l.id);
                        const clsCnt = schoolClasses.filter((c) => c.levelId === l.id).length;
                        return (
                          <label
                            key={l.id}
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium cursor-pointer transition ${
                              checked
                                ? 'bg-slate-50 border-slate-800 text-slate-900'
                                : 'bg-white border-slate-200 text-slate-600'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => setScLevelIds((prev) => toggleInArray(prev, l.id))}
                              className="accent-slate-900"
                            />
                            <span>{l.name}</span>
                            <span className="text-[10px] text-slate-400">({clsCnt} cl.)</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-3 border-t border-slate-200">
                    <label className="flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={scCopyClasses}
                        onChange={(e) => setScCopyClasses(e.target.checked)}
                        className="accent-slate-900"
                      />
                      <span>Inclure les classes</span>
                    </label>
                    <label
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-semibold ${
                        scCopyClasses
                          ? 'border-slate-200 bg-white text-slate-700 cursor-pointer'
                          : 'border-slate-200 bg-slate-50 text-slate-400 cursor-not-allowed'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={scCopyTerms && scCopyClasses}
                        disabled={!scCopyClasses}
                        onChange={(e) => setScCopyTerms(e.target.checked)}
                        className="accent-slate-900"
                      />
                      <span>Inclure les trimestres</span>
                    </label>
                    <label
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-semibold ${
                        scCopyClasses
                          ? 'border-slate-200 bg-white text-slate-700 cursor-pointer'
                          : 'border-slate-200 bg-slate-50 text-slate-400 cursor-not-allowed'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={scCopySubjects && scCopyClasses}
                        disabled={!scCopyClasses}
                        onChange={(e) => setScCopySubjects(e.target.checked)}
                        className="accent-slate-900"
                      />
                      <span>Inclure les matières</span>
                    </label>
                  </div>

                  {scCopyClasses && scCopySubjects && renderGradebookOptionsBlock(true)}
                </>
              )}
            </div>

            {/* COLONNE DROITE (5 cols) : DESTINATION, DOUBLONS & VALIDATION */}
            <div className="lg:col-span-5 bg-white rounded-xl border border-slate-200 p-4 sm:p-5 space-y-4">
              {/* Destination selon le mode */}
              {selectedMode === 'term_to_term' && (
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                      Trimestre(s) de destination
                    </h4>
                    {ttClassTerms.filter((t) => t.id !== ttSourceTermId).length > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          const others = ttClassTerms.filter((t) => t.id !== ttSourceTermId).map((t) => t.id);
                          setTtTargetTermIds(ttTargetTermIds.length === others.length ? [] : others);
                        }}
                        className="text-[11px] font-semibold text-slate-600 hover:text-slate-900 underline cursor-pointer"
                      >
                        Tout sélectionner
                      </button>
                    )}
                  </div>

                  {ttClassTerms.filter((t) => t.id !== ttSourceTermId).length === 0 ? (
                    <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-500">
                      Aucun autre trimestre disponible dans cette classe.
                    </div>
                  ) : (
                    <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                      {ttClassTerms
                        .filter((t) => t.id !== ttSourceTermId)
                        .map((t) => {
                          const checked = ttTargetTermIds.includes(t.id);
                          const existingCount = schoolSubjects.filter(
                            (s) => s.classId === ttClassId && getEffectiveSubjectTermId(s, ttClassTerms) === t.id
                          ).length;
                          return (
                            <label
                              key={t.id}
                              className={`flex items-center justify-between gap-2 px-3 py-2 rounded-lg border text-xs cursor-pointer transition ${
                                checked
                                  ? 'bg-slate-50 border-slate-800 text-slate-900'
                                  : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() => setTtTargetTermIds((prev) => toggleInArray(prev, t.id))}
                                  className="accent-slate-900"
                                />
                                <span className="font-semibold">{t.name}</span>
                              </div>
                              <span className="text-[10px] text-slate-500">
                                {existingCount} mat. actuelle{existingCount > 1 ? 's' : ''}
                              </span>
                            </label>
                          );
                        })}
                    </div>
                  )}

                  {ttLevelClasses.length >= 2 && (
                    <label className="flex items-start gap-2 p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-[11px] text-slate-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={ttApplyAllClassesInLevel}
                        onChange={(e) => setTtApplyAllClassesInLevel(e.target.checked)}
                        className="mt-0.5 accent-slate-900"
                      />
                      <span>
                        <strong className="text-slate-900">Appliquer à toutes les classes de ce niveau</strong> ({ttLevelClasses.length} classes) pour les mêmes numéros de trimestres.
                      </span>
                    </label>
                  )}
                </div>
              )}

              {selectedMode === 'class_to_class' && (
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                      Classe(s) de destination (même niveau)
                    </h4>
                    {ccLevelClasses.filter((c) => c.id !== ccSourceClassId).length > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          const others = ccLevelClasses.filter((c) => c.id !== ccSourceClassId).map((c) => c.id);
                          setCcTargetClassIds(ccTargetClassIds.length === others.length ? [] : others);
                        }}
                        className="text-[11px] font-semibold text-slate-600 hover:text-slate-900 underline cursor-pointer"
                      >
                        Tout sélectionner
                      </button>
                    )}
                  </div>

                  {ccLevelClasses.filter((c) => c.id !== ccSourceClassId).length === 0 ? (
                    <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-500">
                      Aucune autre classe disponible dans ce niveau.
                    </div>
                  ) : (
                    <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                      {ccLevelClasses
                        .filter((c) => c.id !== ccSourceClassId)
                        .map((cls) => {
                          const checked = ccTargetClassIds.includes(cls.id);
                          const cnt = schoolSubjects.filter((s) => s.classId === cls.id).length;
                          return (
                            <label
                              key={cls.id}
                              className={`flex items-center justify-between gap-2 px-3 py-2 rounded-lg border text-xs cursor-pointer transition ${
                                checked
                                  ? 'bg-slate-50 border-slate-800 text-slate-900'
                                  : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                              }`}
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() => setCcTargetClassIds((prev) => toggleInArray(prev, cls.id))}
                                  className="accent-slate-900 shrink-0"
                                />
                                <span className="font-semibold truncate">{getEffectiveClassName(cls)}</span>
                              </div>
                              <span className="text-[10px] text-slate-500 shrink-0">{cnt} mat.</span>
                            </label>
                          );
                        })}
                    </div>
                  )}
                </div>
              )}

              {selectedMode === 'level_to_level' && (
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                      Niveau(x) de destination
                    </h4>
                    {schoolLevels.filter((l) => l.id !== llSourceLevelId).length > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          const others = schoolLevels.filter((l) => l.id !== llSourceLevelId).map((l) => l.id);
                          setLlTargetLevelIds(llTargetLevelIds.length === others.length ? [] : others);
                        }}
                        className="text-[11px] font-semibold text-slate-600 hover:text-slate-900 underline cursor-pointer"
                      >
                        Tout sélectionner
                      </button>
                    )}
                  </div>

                  {schoolLevels.filter((l) => l.id !== llSourceLevelId).length === 0 ? (
                    <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-500">
                      Aucun autre niveau d’étude disponible dans cet établissement.
                    </div>
                  ) : (
                    <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                      {schoolLevels
                        .filter((l) => l.id !== llSourceLevelId)
                        .map((lvl) => {
                          const checked = llTargetLevelIds.includes(lvl.id);
                          const cnt = schoolClasses.filter((c) => c.levelId === lvl.id).length;
                          return (
                            <label
                              key={lvl.id}
                              className={`flex items-center justify-between gap-2 px-3 py-2 rounded-lg border text-xs cursor-pointer transition ${
                                checked
                                  ? 'bg-slate-50 border-slate-800 text-slate-900'
                                  : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                              }`}
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() => setLlTargetLevelIds((prev) => toggleInArray(prev, lvl.id))}
                                  className="accent-slate-900 shrink-0"
                                />
                                <span className="font-semibold truncate">{lvl.name}</span>
                              </div>
                              <span className="text-[10px] text-slate-500 shrink-0">
                                {plural(cnt, 'classe')}
                              </span>
                            </label>
                          );
                        })}
                    </div>
                  )}
                </div>
              )}

              {selectedMode === 'subject_to_subject' && (
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                      Matière(s) de destination ({ssTargetKeys.length})
                    </h4>
                    {ssCandidateTargets.length > 0 && (
                      <button
                        type="button"
                        onClick={() =>
                          setSsTargetKeys(
                            ssTargetKeys.length === ssCandidateTargets.length
                              ? []
                              : ssCandidateTargets.map((t) => t.key)
                          )
                        }
                        className="text-[11px] font-semibold text-slate-600 hover:text-slate-900 underline cursor-pointer"
                      >
                        {ssTargetKeys.length === ssCandidateTargets.length ? 'Tout décocher' : 'Tout cocher'}
                      </button>
                    )}
                  </div>

                  {/* Filtre de portée sobre */}
                  <div className="grid grid-cols-3 gap-1 p-1 rounded-lg bg-slate-100 border border-slate-200">
                    {(
                      [
                        { id: 'same_class', label: 'Même classe' },
                        { id: 'same_level', label: 'Même niveau' },
                        { id: 'all_school', label: 'Toute l’école' },
                      ] as const
                    ).map((sc) => (
                      <button
                        key={sc.id}
                        type="button"
                        onClick={() => setSsTargetScope(sc.id)}
                        className={`py-1 rounded-md text-[11px] font-semibold transition cursor-pointer ${
                          ssTargetScope === sc.id
                            ? 'bg-white text-slate-900 shadow-2xs border border-slate-200'
                            : 'text-slate-500 hover:text-slate-800'
                        }`}
                      >
                        {sc.label}
                      </button>
                    ))}
                  </div>

                  {ssCandidateTargets.length === 0 ? (
                    <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-500">
                      Aucune autre matière disponible dans ce périmètre. Élargissez le filtre ci-dessus ou créez d’autres matières.
                    </div>
                  ) : (
                    <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
                      {ssCandidateTargets.map((t) => {
                        const checked = ssTargetKeys.includes(t.key);
                        return (
                          <label
                            key={t.key}
                            className={`flex items-center justify-between gap-2 px-3 py-2 rounded-lg border text-xs cursor-pointer transition ${
                              checked
                                ? 'bg-slate-50 border-slate-800 text-slate-900'
                                : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                            }`}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => setSsTargetKeys((prev) => toggleInArray(prev, t.key))}
                                className="accent-slate-900 shrink-0"
                              />
                              <div className="min-w-0">
                                <div className="font-semibold truncate">{t.subject.name}</div>
                                <div className="text-[10px] text-slate-400 truncate">
                                  {t.levelName} • {t.className} • {t.termName}
                                </div>
                              </div>
                            </div>
                            <span className="text-[10px] text-slate-500 shrink-0">
                              {t.stats.namedStudentsCount} él.
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {selectedMode === 'school_to_school' && (
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                      Établissement(s) de destination
                    </h4>
                    {otherSchools.length > 0 && (
                      <button
                        type="button"
                        onClick={() =>
                          setScTargetSchoolIds(
                            scTargetSchoolIds.length === otherSchools.length ? [] : otherSchools.map((s) => s.id)
                          )
                        }
                        className="text-[11px] font-semibold text-slate-600 hover:text-slate-900 underline cursor-pointer"
                      >
                        Tout sélectionner
                      </button>
                    )}
                  </div>

                  {otherSchools.length === 0 ? (
                    <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-500">
                      Aucun autre établissement n’est encore enregistré.
                    </div>
                  ) : (
                    <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                      {otherSchools.map((sch) => {
                        const checked = scTargetSchoolIds.includes(sch.id);
                        const yr = schoolYears.find((y) => y.id === sch.yearId);
                        return (
                          <label
                            key={sch.id}
                            className={`flex items-center justify-between gap-2 px-3 py-2 rounded-lg border text-xs cursor-pointer transition ${
                              checked
                                ? 'bg-slate-50 border-slate-800 text-slate-900'
                                : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                            }`}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => setScTargetSchoolIds((prev) => toggleInArray(prev, sch.id))}
                                className="accent-slate-900 shrink-0"
                              />
                              <span className="font-semibold truncate">{sch.name}</span>
                            </div>
                            <span className="text-[10px] text-slate-500 shrink-0">
                              {yr?.label || ''}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Règle en cas de doublon (pour les modes créant des matières/classes) */}
              {selectedMode !== 'subject_to_subject' && renderConflictBlock()}

              {/* Signalements & alertes de données manquantes */}
              {validationState.blockingReason && (
                <div className="p-3 rounded-lg bg-slate-50 border border-slate-300 text-xs text-slate-700 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-slate-600 shrink-0 mt-0.5" />
                  <span>{validationState.blockingReason}</span>
                </div>
              )}

              {validationState.notices.length > 0 && (
                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-1">
                  {validationState.notices.map((n, idx) => (
                    <p key={idx} className="text-[11px] text-slate-600 flex items-start gap-1.5">
                      <Info className="w-3.5 h-3.5 text-slate-500 shrink-0 mt-0.5" />
                      <span>{n}</span>
                    </p>
                  ))}
                </div>
              )}

              {/* Bouton de validation sobre */}
              <div className="pt-3 border-t border-slate-200 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedMode(null)}
                  className="px-3.5 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 transition cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  disabled={!validationState.canExecute || isTransferring}
                  onClick={handleRunTransfer}
                  className={`flex-1 py-2 px-4 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition ${
                    validationState.canExecute && !isTransferring
                      ? 'bg-slate-900 hover:bg-slate-800 text-white cursor-pointer'
                      : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                  }`}
                >
                  <ArrowLeftRight className={`w-3.5 h-3.5 ${isTransferring ? 'animate-spin' : ''}`} />
                  <span>{isTransferring ? 'Transfert vers le cloud...' : 'Lancer le transfert'}</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
