import React, { useState, useEffect } from 'react';
import { ArrowLeft, Plus, Trash2, Edit2, Award, BookOpen, Check, X, Calculator, Sparkles } from 'lucide-react';
import { triggerDebouncedCloudBackup } from '../services/userSync';
import { StudyCloudAPI } from '../services/api';

interface GradeItem {
  id: string;
  subject: string;
  coefficient: number;
  grade: number; // sur 20
  subGrades?: any[];
}

interface GradesMenuViewProps {
  onBack: () => void;
}

const getInitialTrimestersData = (): Record<string, GradeItem[]> => {
  try {
    const saved = localStorage.getItem('user_grades_trimesters_data');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed && typeof parsed === 'object') {
        const hasAnyItems = Object.values(parsed).some((list: any) => Array.isArray(list) && list.length > 0);
        if (hasAnyItems) {
          return parsed;
        }
      }
    }
  } catch (e) {}

  let initialSubjects: { id: string; name: string; coefficient: string }[] = [];
  try {
    const savedMat = localStorage.getItem('unifolder_saved_matieres');
    if (savedMat) {
      const parsedMat = JSON.parse(savedMat);
      if (Array.isArray(parsedMat) && parsedMat.length > 0) {
        initialSubjects = parsedMat;
      }
    }
  } catch (e) {}

  if (initialSubjects.length === 0) {
    return { '1': [], '2': [], '3': [] };
  }

  const baseItems: GradeItem[] = initialSubjects.map((m, idx) => ({
    id: m.id || String(idx + 1),
    subject: m.name,
    coefficient: parseFloat(m.coefficient) || 1.0,
    grade: 0,
    subGrades: []
  }));

  return {
    '1': baseItems,
    '2': baseItems.map(item => ({ ...item, id: 't2-' + item.id })),
    '3': baseItems.map(item => ({ ...item, id: 't3-' + item.id }))
  };
};

export const GradesMenuView: React.FC<GradesMenuViewProps> = ({ onBack }) => {
  const [activeTrimestre, setActiveTrimestre] = useState<'1' | '2' | '3'>('1');
  
  const [trimestersData, setTrimestersData] = useState<Record<string, GradeItem[]>>(() => {
    return getInitialTrimestersData();
  });

  const [standardScale, setStandardScale] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('user_grades_standard_scale');
      if (saved) return parseFloat(saved) || 20;
    } catch (e) {}
    return 20;
  });

  const [showAddModal, setShowAddModal] = useState(false);
  const [editingItem, setEditingItem] = useState<GradeItem | null>(null);
  const [subjectInput, setSubjectInput] = useState('');
  const [coeffInput, setCoeffInput] = useState('2.0');
  const [gradeInput, setGradeInput] = useState('10.0');
  const [standardScaleInput, setStandardScaleInput] = useState('20');

  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [expandedSubjectIds, setExpandedSubjectIds] = useState<Record<string, boolean>>({});
  const [activeAddGradeSubjectId, setActiveAddGradeSubjectId] = useState<string | null>(null);
  const [newSubVal, setNewSubVal] = useState('');
  const [newSubMax, setNewSubMax] = useState('20');
  const [newSubCoeff, setNewSubCoeff] = useState('1');

  const [editingSubGrade, setEditingSubGrade] = useState<{ itemId: string; index: number; value: string; max: string; coefficient: string } | null>(null);
  const [showCalcStepsModal, setShowCalcStepsModal] = useState(false);
  const [showAddLineConfirm, setShowAddLineConfirm] = useState(false);

  // Synchronisation avec les matières créées dans le menu "Matière"
  useEffect(() => {
    try {
      const savedMat = localStorage.getItem('unifolder_saved_matieres');
      if (savedMat) {
        const parsedMat = JSON.parse(savedMat);
        if (Array.isArray(parsedMat) && parsedMat.length > 0) {
          setTrimestersData(prev => {
            let hasChanged = false;
            const updated = { ...prev };
            (['1', '2', '3'] as const).forEach(trimKey => {
              const currentList = updated[trimKey] ? [...updated[trimKey]] : [];
              parsedMat.forEach((m: any) => {
                const name = (m.name || '').trim();
                if (!name) return;
                const exists = currentList.some(item => item.subject.trim().toLowerCase() === name.toLowerCase());
                if (!exists) {
                  hasChanged = true;
                  currentList.push({
                    id: `${m.id || Date.now()}_t${trimKey}`,
                    subject: name,
                    coefficient: parseFloat(m.coefficient) || 1.0,
                    grade: 0,
                    subGrades: []
                  });
                }
              });
              updated[trimKey] = currentList;
            });
            return hasChanged ? updated : prev;
          });
        }
      }
    } catch (e) {}
  }, []);

  // Sauvegarde sécurisée dans localStorage avec nettoyage si quota dépassé
  const safeSaveGrades = (data: Record<string, GradeItem[]>) => {
    const json = JSON.stringify(data);
    try {
      localStorage.setItem('user_grades_trimesters_data', json);
    } catch (e: any) {
      if (e && (e.name === 'QuotaExceededError' || e.code === 22 || e.code === 1014)) {
        // Nettoyer les entrées non critiques pour libérer de la place
        const keysToClean = [
          'unifolder_grades_data',
          'user_grades_trimesters_data_backup',
        ];
        keysToClean.forEach(k => { try { localStorage.removeItem(k); } catch {} });
        // Réessayer après nettoyage
        try { localStorage.setItem('user_grades_trimesters_data', json); } catch {}
      }
    }
  };

  // Synchronisation automatique vers localStorage et Cloudflare D1
  useEffect(() => {
    safeSaveGrades(trimestersData);
    triggerDebouncedCloudBackup();
    window.dispatchEvent(new Event('user_grades_changed'));

    const userId = localStorage.getItem('unifolder_user_id') || 'default-user';
    const timer = setTimeout(() => {
      Object.entries(trimestersData).forEach(([trim, items]) => {
        if (Array.isArray(items)) {
          items.forEach((item: any) => {
            StudyCloudAPI.saveGrade({
              id: item.id,
              userId,
              trimester: Number(trim) || 1,
              subjectName: item.subject,
              coefficient: item.coefficient,
              subGradesJson: JSON.stringify(item.subGrades || []),
              average: item.grade
            }).catch(() => {});
          });
        }
      });
    }, 800);
    return () => clearTimeout(timer);
  }, [trimestersData]);

  // Récupération des notes depuis Cloudflare D1 au montage
  useEffect(() => {
    const userId = localStorage.getItem('unifolder_user_id') || 'default-user';
    StudyCloudAPI.getGrades(userId)
      .then((res: any) => {
        if (res && res.success && Array.isArray(res.data) && res.data.length > 0) {
          // Fusionner avec les données locales pour préserver les subGrades
          setTrimestersData(prev => {
            const merged: Record<string, GradeItem[]> = {
              '1': prev['1'] ? [...prev['1']] : [],
              '2': prev['2'] ? [...prev['2']] : [],
              '3': prev['3'] ? [...prev['3']] : [],
            };
            for (const row of res.data) {
              const trimKey = String(row.trimester || '1');
              if (!merged[trimKey]) merged[trimKey] = [];
              let subs: any[] = [];
              try {
                if (typeof row.sub_grades_json === 'string') {
                  subs = JSON.parse(row.sub_grades_json);
                } else if (Array.isArray(row.sub_grades_json)) {
                  subs = row.sub_grades_json;
                }
              } catch (e) { subs = []; }

              const subjectName = (row.subject_name || row.subject || 'Matière').trim();
              const existingIdx = merged[trimKey].findIndex(item =>
                (item.id && row.id && String(item.id) === String(row.id)) ||
                item.subject.trim().toLowerCase() === subjectName.toLowerCase()
              );

              // Si D1 renvoie des subGrades vides mais que les données locales en ont, on garde les locales
              const localItem = existingIdx !== -1 ? merged[trimKey][existingIdx] : null;
              const finalSubs = (subs.length === 0 && localItem && Array.isArray(localItem.subGrades) && localItem.subGrades.length > 0)
                ? localItem.subGrades
                : subs;

              const gradeObj: GradeItem = {
                id: row.id || (localItem ? localItem.id : `d1-${Math.random()}`),
                subject: subjectName,
                coefficient: Number(row.coefficient) || 1.0,
                grade: finalSubs.length > 0 ? (localItem ? localItem.grade : Number(row.average) || 0) : (Number(row.average) || Number(row.grade) || 0),
                subGrades: finalSubs,
              };

              if (existingIdx !== -1) {
                merged[trimKey][existingIdx] = { ...(localItem as GradeItem), ...gradeObj };
              } else {
                merged[trimKey].push(gradeObj);
              }
            }
            try {
              safeSaveGrades(merged);
            } catch {}
            window.dispatchEvent(new Event('user_grades_changed'));
            return merged;
          });
        } else if (res && res.success && Array.isArray(res.data) && res.data.length === 0) {
          // Si la base distante est encore vide, pousser les données locales vers Cloudflare D1
          const localData = getInitialTrimestersData();
          const hasLocalItems = Object.values(localData).some(list => Array.isArray(list) && list.length > 0);
          if (hasLocalItems) {
            Object.entries(localData).forEach(([trim, items]) => {
              if (Array.isArray(items)) {
                items.forEach((item: any) => {
                  StudyCloudAPI.saveGrade({
                    id: item.id,
                    userId,
                    trimester: Number(trim) || 1,
                    subjectName: item.subject,
                    coefficient: item.coefficient,
                    subGradesJson: JSON.stringify(item.subGrades || []),
                    average: item.grade
                  }).catch(() => {});
                });
              }
            });
            triggerDebouncedCloudBackup();
          }
        }
      })
      .catch((err) => {
        console.warn('[Grades] Erreur chargement initial D1:', err);
      });
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem('user_grades_standard_scale', standardScale.toString());
      triggerDebouncedCloudBackup();
      window.dispatchEvent(new Event('user_grades_changed'));
    } catch (e) {}
  }, [standardScale]);

  useEffect(() => {
    const handleRestore = () => {
      try {
        const saved = localStorage.getItem('user_grades_trimesters_data');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed && typeof parsed === 'object') setTrimestersData(parsed);
        }
      } catch (e) {}
    };
    window.addEventListener('unifolder_data_restored', handleRestore);
    return () => window.removeEventListener('unifolder_data_restored', handleRestore);
  }, []);

  const currentItems = trimestersData[activeTrimestre] || [];

  const calculateAverageFromSubGrades = (subs: any[]) => {
    if (!subs || subs.length === 0) return 0;
    let totalW = 0;
    let totalC = 0;
    subs.forEach(s => {
      let val = 0;
      let max = 20;
      let coeff = 1;
      if (typeof s === 'object' && s !== null) {
        val = Number(s.value) || 0;
        max = Number(s.max) || 20;
        coeff = Number(s.coefficient) || 1;
      } else if (typeof s === 'number') {
        val = s;
        max = 20;
        coeff = 1;
      }
      const norm = max > 0 ? (val / max) * standardScale : val;
      totalW += norm * coeff;
      totalC += coeff;
    });
    const avg = totalC > 0 ? totalW / totalC : 0;
    return Math.min(Math.max(avg, 0), standardScale);
  };

  const getSubGradeDetails = (sg: any) => {
    if (typeof sg === 'object' && sg !== null) {
      return {
        value: Number(sg.value) || 0,
        max: Number(sg.max) || 20,
        coefficient: Number(sg.coefficient) || 1
      };
    }
    return {
      value: Number(sg) || 0,
      max: 20,
      coefficient: 1
    };
  };

  // Calculate General Average
  const itemsWithGrades = currentItems.filter(item => item.subGrades && item.subGrades.length > 0);
  const totalPoints = itemsWithGrades.reduce((acc, item) => {
    const avg = calculateAverageFromSubGrades(item.subGrades);
    return acc + (avg * item.coefficient);
  }, 0);
  const totalCoeffs = itemsWithGrades.reduce((acc, item) => acc + item.coefficient, 0);
  const generalAverage = totalCoeffs > 0 ? Math.min(Math.max(totalPoints / totalCoeffs, 0), standardScale) : null;

  const toggleExpand = (id: string) => {
    setExpandedSubjectIds(prev => ({ ...prev, [id]: !prev[id] }));
    if (activeAddGradeSubjectId === id) {
      setActiveAddGradeSubjectId(null);
    }
  };

  const handleAddNewGradeSubmit = (itemId: string, e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(newSubVal) || 0;
    const max = parseFloat(newSubMax) || 20;
    const coeff = parseFloat(newSubCoeff) || 1;

    if (val > max) {
      setErrorMessage(`La note ne peut pas être supérieure au maximum (${max}) !`);
      setTimeout(() => setErrorMessage(null), 4000);
      return;
    }

    const updatedList = currentItems.map(item => {
      if (item.id === itemId) {
        const existingSubs = item.subGrades && item.subGrades.length > 0 ? [...item.subGrades] : [];
        const newSubObj = { value: val, max, coefficient: coeff };
        const updatedSubs = [...existingSubs, newSubObj];
        const newAvg = calculateAverageFromSubGrades(updatedSubs);
        return {
          ...item,
          subGrades: updatedSubs,
          grade: newAvg
        };
      }
      return item;
    });

    setTrimestersData(prev => ({
      ...prev,
      [activeTrimestre]: updatedList
    }));
    setActiveAddGradeSubjectId(null);
    setNewSubVal('');
    setNewSubMax('20');
    setNewSubCoeff('1');
    setSuccessMessage('Note ajoutée avec succès !');
    setTimeout(() => setSuccessMessage(null), 3000);
  };

  const handleDeleteSubGrade = (itemId: string, subIdx: number) => {
    const updatedList = currentItems.map(item => {
      if (item.id === itemId) {
        const subs = item.subGrades ? [...item.subGrades] : [];
        subs.splice(subIdx, 1);
        const hasGrades = subs.length > 0;
        const newAvg = hasGrades ? calculateAverageFromSubGrades(subs) : 0;
        return {
          ...item,
          subGrades: subs,
          grade: newAvg
        };
      }
      return item;
    });

    setTrimestersData(prev => ({
      ...prev,
      [activeTrimestre]: updatedList
    }));
    setSuccessMessage('Note supprimée avec succès !');
    setTimeout(() => setSuccessMessage(null), 3000);
  };

  const handleEditSubGradeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSubGrade) return;
    const val = parseFloat(editingSubGrade.value) || 0;
    const max = parseFloat(editingSubGrade.max) || 20;
    const coeff = parseFloat(editingSubGrade.coefficient) || 1;

    if (val > max) {
      setErrorMessage(`La note ne peut pas être supérieure au maximum (${max}) !`);
      setTimeout(() => setErrorMessage(null), 4000);
      return;
    }

    const updatedList = currentItems.map(item => {
      if (item.id === editingSubGrade.itemId) {
        const subs = item.subGrades ? [...item.subGrades] : [{ value: item.grade, max: 20, coefficient: 1 }];
        subs[editingSubGrade.index] = { value: val, max, coefficient: coeff };
        const newAvg = calculateAverageFromSubGrades(subs);
        return {
          ...item,
          subGrades: subs,
          grade: newAvg
        };
      }
      return item;
    });

    setTrimestersData(prev => ({
      ...prev,
      [activeTrimestre]: updatedList
    }));
    setEditingSubGrade(null);
    setSuccessMessage('Note modifiée avec succès !');
    setTimeout(() => setSuccessMessage(null), 3000);
  };

  const handleOpenAdd = () => {
    setEditingItem(null);
    setSubjectInput('');
    setCoeffInput('2.0');
    setGradeInput('0.0');
    setStandardScaleInput(standardScale.toString());
    setShowAddModal(true);
  };

  const handleOpenEdit = (item: GradeItem) => {
    setEditingItem(item);
    setSubjectInput(item.subject);
    setCoeffInput(item.coefficient.toString());
    setGradeInput(item.grade.toString());
    setStandardScaleInput(standardScale.toString());
    setShowAddModal(true);
  };

  const handleSaveItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!subjectInput.trim()) return;

    const coeff = parseFloat(coeffInput) || 1.0;
    const scale = parseFloat(standardScaleInput);
    if (!isNaN(scale) && scale > 0) {
      setStandardScale(scale);
    }

    if (editingItem) {
      const updatedList = [...currentItems];
      const idx = updatedList.findIndex(i => i.id === editingItem.id);
      if (idx !== -1) {
        updatedList[idx] = {
          ...editingItem,
          subject: subjectInput.trim(),
          coefficient: coeff,
          grade: editingItem.grade,
          subGrades: editingItem.subGrades || []
        };
      }
      setTrimestersData(prev => ({
        ...prev,
        [activeTrimestre]: updatedList
      }));
      setSuccessMessage('Matière modifiée avec succès !');
    } else {
      const trimmedSubject = subjectInput.trim();
      const now = Date.now();
      const allTrimestres: ('1' | '2' | '3')[] = ['1', '2', '3'];

      setTrimestersData(prev => {
        const nextData = { ...prev };

        allTrimestres.forEach(trimKey => {
          const list = nextData[trimKey] ? [...nextData[trimKey]] : [];
          const alreadyExists = list.some(
            item => item.subject.trim().toLowerCase() === trimmedSubject.toLowerCase()
          );

          if (!alreadyExists) {
            list.push({
              id: `${now}_t${trimKey}_${Math.random().toString(36).substring(2, 6)}`,
              subject: trimmedSubject,
              coefficient: coeff,
              grade: 0,
              subGrades: []
            });
          }

          nextData[trimKey] = list;
        });

        return nextData;
      });

      setSuccessMessage('Nouvelle matière ajoutée dans les trimestres !');
    }

    setShowAddModal(false);
    setTimeout(() => setSuccessMessage(null), 3000);
  };

  const confirmDelete = () => {
    if (!deleteId) return;
    const targetId = deleteId;
    const updatedList = currentItems.filter(i => i.id !== targetId);
    setTrimestersData(prev => ({
      ...prev,
      [activeTrimestre]: updatedList
    }));
    StudyCloudAPI.deleteGrade(targetId).catch(() => {});
    triggerDebouncedCloudBackup();
    setDeleteId(null);
    setSuccessMessage('Matière supprimée avec succès !');
    setTimeout(() => setSuccessMessage(null), 3000);
  };

  return (
    <div className="absolute inset-x-0 bottom-0 top-[62px] md:top-[66px] md:left-64 z-30 w-full md:w-[calc(100%-16rem)] bg-[#f1f5f9] dark:bg-[#0b0f19] text-stone-900 dark:text-slate-100 flex flex-col overflow-hidden transition-colors duration-300">
      {/* Sticky Header Group */}
      <div className="sticky top-0 z-40 flex flex-col w-full shadow-md shrink-0">
        {/* Top Navigation Bar with Back & Add */}
        <div className="bg-[#1e40af] dark:bg-[#0f172a] px-4 py-2.5 flex items-center justify-between text-white shadow-md">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white font-medium text-xs rounded-lg transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Retour</span>
          </button>

          <span className="text-xs sm:text-sm font-semibold tracking-wide uppercase text-blue-100 dark:text-blue-200">
            Mes notes d'évaluation
          </span>

          <button
            onClick={handleOpenAdd}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white text-blue-900 font-bold text-xs rounded-lg shadow hover:bg-blue-50 transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Ajouter</span>
          </button>
        </div>

        {/* General Average Hero Banner (Reduced height/spacing) */}
        <div className="bg-[#1d4ed8] dark:bg-[#1e3a8a] text-white py-3 px-4 shadow-md flex items-center justify-between px-6">
          <div className="text-2xl sm:text-4xl font-sans font-bold tracking-tight mx-auto flex items-center gap-2">
            <span>{generalAverage !== null ? `${generalAverage.toFixed(2).replace('.', ',')} / ${standardScale}` : 'Pas de note'}</span>
            <span className="text-xs sm:text-sm font-normal uppercase tracking-wider text-blue-200">
              • Moyenne générale
            </span>
          </div>
          <button
            onClick={() => setShowCalcStepsModal(true)}
            className="text-xs bg-blue-700/80 hover:bg-blue-600 text-blue-100 px-3 py-1.5 rounded-xl transition-colors cursor-pointer flex items-center gap-1.5 border border-blue-500/40 shadow-2xs font-medium"
            title="Voir la logique de calcul pas à pas"
          >
            <Calculator className="w-4 h-4" />
            <span className="hidden sm:inline">Étapes de calcul</span>
          </button>
        </div>

        {/* Trimester Tabs */}
        <div className="bg-[#1e40af] dark:bg-[#0f172a] text-white flex justify-center border-t border-blue-800 dark:border-slate-800 shadow-inner">
          <div className="flex w-full">
            {[
              { id: '1', label: 'TRIMESTRE 1' },
              { id: '2', label: 'TRIMESTRE 2' },
              { id: '3', label: 'TRIMESTRE 3' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTrimestre(tab.id as '1' | '2' | '3')}
                className={`flex-1 py-3 text-center text-xs sm:text-sm font-bold tracking-wider transition-all cursor-pointer border-b-4 ${
                  activeTrimestre === tab.id
                    ? 'bg-blue-900/40 dark:bg-blue-600/30 border-white text-white'
                    : 'border-transparent text-blue-200/70 dark:text-slate-400 hover:text-white hover:bg-blue-900/20 dark:hover:bg-slate-800/40'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Table Headers Bar */}
        <div className="bg-[#e2e8f0] dark:bg-[#161f30] border-b border-stone-300 dark:border-slate-800 transition-colors">
          <div className="w-full max-w-6xl xl:max-w-7xl mx-auto text-stone-700 dark:text-slate-200 font-bold text-xs sm:text-sm md:text-base uppercase tracking-wider px-4 md:px-8 py-3 md:py-4 grid grid-cols-12 items-center">
            <div className="col-span-6">Matière</div>
            <div className="col-span-2 text-center">Coefficient</div>
            <div className="col-span-4 text-right pr-2 md:pr-4">Moyenne</div>
          </div>
        </div>
      </div>

      {/* Rows Container - Stacked white cards on background (Scrollable) */}
      <div className="flex-1 overflow-y-auto p-3 sm:p-4 md:p-6 space-y-2.5 md:space-y-4 max-w-6xl xl:max-w-7xl w-full mx-auto pb-20">
        {currentItems.length === 0 ? (
          <div className="bg-white dark:bg-[#161f30] rounded-xl md:rounded-2xl p-12 md:p-16 text-center text-stone-500 dark:text-slate-400 shadow-sm border border-stone-200 dark:border-slate-800 transition-colors">
            <p className="font-semibold text-base md:text-lg text-stone-700 dark:text-slate-200">Aucune matière enregistrée</p>
            <p className="text-xs md:text-sm text-stone-400 dark:text-slate-400 mt-1">Cliquez sur le bouton "Ajouter" en haut pour commencer.</p>
          </div>
        ) : (
          currentItems.map((item) => {
            const isExpanded = !!expandedSubjectIds[item.id];
            const subs = item.subGrades || [];
            const hasGrades = subs.length > 0;

            return (
              <div
                key={item.id}
                className="bg-white dark:bg-[#161f30] rounded-xl md:rounded-2xl shadow-xs md:shadow-md border border-stone-200/80 dark:border-slate-800 hover:border-stone-300 dark:hover:border-slate-700 transition-all overflow-hidden"
              >
                {/* Main Row */}
                <div className="px-4 sm:px-5 md:px-8 py-3.5 sm:py-4 md:py-5 lg:py-6 grid grid-cols-12 items-center group">
                  <div className="col-span-6 pr-2 md:pr-4">
                    <div 
                      className="bg-[#F5F1E9] dark:bg-[#1e293b] hover:bg-[#EBE5DA] dark:hover:bg-[#283548] border-2 border-stone-300 dark:border-slate-700 hover:border-stone-400 dark:hover:border-slate-600 px-3 py-2 md:px-5 md:py-3.5 rounded-lg md:rounded-xl cursor-pointer max-w-full overflow-hidden transition-all shadow-2xs"
                      onClick={() => handleOpenEdit(item)}
                      title="Modifier cette matière"
                    >
                      <div 
                        className="font-sans font-semibold text-xs sm:text-sm md:text-base lg:text-lg text-stone-900 dark:text-slate-100 leading-snug"
                        style={{
                          display: '-webkit-box',
                          WebkitLineClamp: 3,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {item.subject}
                      </div>
                    </div>
                  </div>
                  <div className="col-span-2 text-center font-sans font-bold text-sm sm:text-base md:text-lg lg:text-xl text-stone-700 dark:text-slate-300">
                    <span className="md:inline-block md:bg-stone-100 md:dark:bg-slate-800 md:border md:border-stone-200 md:dark:border-slate-700 md:px-4 md:py-1.5 md:rounded-xl">
                      {item.coefficient.toLocaleString('fr-FR', { maximumFractionDigits: 1 })}
                    </span>
                  </div>
                  <div className="col-span-4 flex items-center justify-end pl-2 md:pl-4">
                    <button
                      type="button"
                      onClick={() => toggleExpand(item.id)}
                      title="Cliquez pour afficher / masquer les notes de cette matière"
                      className="font-extrabold text-sm sm:text-base md:text-lg lg:text-xl text-blue-900 dark:text-blue-300 bg-blue-100/90 dark:bg-blue-950/60 hover:bg-blue-200 dark:hover:bg-blue-900/60 px-3.5 py-1.5 md:px-6 md:py-3 rounded-xl md:rounded-2xl transition-all cursor-pointer border border-blue-300 dark:border-blue-800 shadow-2xs md:shadow-xs ml-auto active:scale-95 flex items-center gap-2"
                    >
                      <span>{hasGrades ? `${calculateAverageFromSubGrades(subs).toFixed(2).replace('.', ',')} / ${standardScale}` : 'Pas de note'}</span>
                    </button>
                  </div>
                </div>

                {/* Expanded Sub-Grades Accordion */}
                {isExpanded && (
                  <div className="bg-[#F5F1E9] dark:bg-[#0f172a] px-4 sm:px-5 md:px-8 py-4 md:py-6 border-t border-stone-200/80 dark:border-slate-800 animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="flex items-center justify-between mb-3 md:mb-4">
                      <div className="flex items-center gap-2.5">
                        <h4 className="font-sans font-bold text-xs md:text-sm uppercase tracking-wider text-stone-800 dark:text-slate-200">
                          Évaluations ({subs.length})
                        </h4>
                        <button
                          type="button"
                          onClick={() => setActiveAddGradeSubjectId(activeAddGradeSubjectId === item.id ? null : item.id)}
                          className="p-1 bg-stone-900 dark:bg-blue-600 hover:bg-stone-800 dark:hover:bg-blue-700 text-white rounded-lg shadow-2xs transition-all cursor-pointer flex items-center justify-center"
                          title="Ajouter une note"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => toggleExpand(item.id)}
                        className="text-xs text-stone-500 dark:text-slate-400 hover:text-stone-800 dark:hover:text-slate-200 font-medium cursor-pointer"
                      >
                        Replier ▲
                      </button>
                    </div>

                    {/* Add Grade Menu/Modal */}
                    {activeAddGradeSubjectId === item.id && (
                      <form onSubmit={(e) => handleAddNewGradeSubmit(item.id, e)} className="bg-white dark:bg-[#1e293b] p-3.5 rounded-xl border border-blue-200 dark:border-blue-900 shadow-sm mb-3 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-xs text-blue-900 dark:text-blue-300 uppercase">Ajouter une nouvelle note</span>
                          <button 
                            type="button" 
                            onClick={() => setActiveAddGradeSubjectId(null)}
                            className="text-stone-400 hover:text-stone-600 dark:hover:text-slate-300 text-xs cursor-pointer"
                          >
                            ✕
                          </button>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          <div>
                            <label className="block text-[10px] font-semibold text-stone-500 dark:text-slate-400 mb-1">Note</label>
                            <input 
                              type="number"
                              step="0.01"
                              min="0"
                              max={newSubMax || 20}
                              maxLength={5}
                              required
                              placeholder="Ex: 14"
                              value={newSubVal}
                              onChange={(e) => {
                                if (e.target.value.length <= 5) setNewSubVal(e.target.value);
                              }}
                              className="w-full px-2.5 py-1.5 bg-stone-50 dark:bg-slate-900 border border-stone-200 dark:border-slate-700 rounded-lg text-xs font-medium text-stone-900 dark:text-slate-100 focus:outline-none focus:border-blue-600"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-semibold text-stone-500 dark:text-slate-400 mb-1">Sur combien</label>
                            <input 
                              type="number"
                              step="1"
                              min="1"
                              maxLength={5}
                              required
                              placeholder="Ex: 20"
                              value={newSubMax}
                              onChange={(e) => {
                                if (e.target.value.length <= 5) setNewSubMax(e.target.value);
                              }}
                              className="w-full px-2.5 py-1.5 bg-stone-50 dark:bg-slate-900 border border-stone-200 dark:border-slate-700 rounded-lg text-xs font-medium text-stone-900 dark:text-slate-100 focus:outline-none focus:border-blue-600"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-semibold text-stone-500 dark:text-slate-400 mb-1">Coefficient</label>
                            <input 
                              type="number"
                              step="0.5"
                              min="0.5"
                              maxLength={5}
                              required
                              placeholder="Ex: 1"
                              value={newSubCoeff}
                              onChange={(e) => {
                                if (e.target.value.length <= 5) setNewSubCoeff(e.target.value);
                              }}
                              className="w-full px-2.5 py-1.5 bg-stone-50 dark:bg-slate-900 border border-stone-200 dark:border-slate-700 rounded-lg text-xs font-medium text-stone-900 dark:text-slate-100 focus:outline-none focus:border-blue-600"
                            />
                          </div>
                        </div>
                        <div className="flex justify-end gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => setActiveAddGradeSubjectId(null)}
                            className="px-3 py-1.5 bg-stone-100 dark:bg-slate-800 hover:bg-stone-200 dark:hover:bg-slate-700 text-stone-700 dark:text-slate-300 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                          >
                            Annuler
                          </button>
                          <button
                            type="submit"
                            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1 shadow-2xs"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Enregistrer</span>
                          </button>
                        </div>
                      </form>
                    )}

                    <div className="space-y-2">
                      {subs.length === 0 ? (
                        <div className="bg-white dark:bg-[#1e293b] px-4 py-3 rounded-xl border border-stone-200 dark:border-slate-800 text-center text-stone-500 dark:text-slate-400 text-xs italic">
                          Pas de note
                        </div>
                      ) : (
                        subs.map((sg, sIdx) => {
                          const details = getSubGradeDetails(sg);
                          return (
                            <div
                              key={sIdx}
                              onClick={() => setEditingSubGrade({
                                itemId: item.id,
                                index: sIdx,
                                value: details.value.toString(),
                                max: details.max.toString(),
                                coefficient: details.coefficient.toString()
                              })}
                              className="bg-white dark:bg-[#1e293b] px-3.5 py-2.5 rounded-xl border border-blue-200/70 dark:border-slate-700 hover:border-blue-400 dark:hover:border-blue-500 flex items-center justify-between shadow-2xs cursor-pointer transition-all group/sub"
                              title="Cliquer pour modifier cette note"
                            >
                              <div className="flex items-center gap-2.5">
                                <span className="bg-blue-100 dark:bg-blue-950 text-blue-900 dark:text-blue-300 font-bold text-xs px-2 py-0.5 rounded-md">
                                  Note {sIdx + 1}
                                </span>
                                <span className="font-bold text-sm text-stone-900 dark:text-slate-100">
                                  {details.value.toFixed(2).replace('.', ',')} <span className="text-xs font-normal text-stone-500 dark:text-slate-400">/ {details.max}</span>
                                </span>
                                {details.coefficient > 1 && (
                                  <span className="text-[10px] bg-stone-100 dark:bg-slate-800 text-stone-600 dark:text-slate-300 px-1.5 py-0.5 rounded font-medium">
                                    Coeff: {details.coefficient}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-1">
                                <span className="text-[10px] text-blue-600 dark:text-blue-400 font-medium opacity-0 group-hover/sub:opacity-150 transition-opacity mr-1">Modifier</span>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteSubGrade(item.id, sIdx);
                                  }}
                                  title="Supprimer cette note"
                                  className="p-1.5 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-600 dark:text-rose-400 rounded-lg transition-colors cursor-pointer"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Success Toast */}
      {successMessage && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[70] bg-blue-900 text-white px-5 py-3 rounded-2xl shadow-xl border border-blue-400 flex items-center gap-2.5 animate-in fade-in slide-in-from-top-4 duration-300">
          <Check className="w-5 h-5 text-emerald-400 shrink-0" />
          <span className="text-xs sm:text-sm font-bold">{successMessage}</span>
        </div>
      )}

      {/* Add / Edit Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-60 bg-stone-900/60 dark:bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#161f30] rounded-2xl max-w-md w-full p-6 shadow-2xl border border-stone-200 dark:border-slate-800 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-stone-100 dark:border-slate-800">
              <h3 className="font-sans font-bold text-base text-blue-900 dark:text-blue-300">
                {editingItem ? "Modifier la matière" : "Ajouter une matière"}
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="w-8 h-8 rounded-full bg-stone-100 dark:bg-slate-800 hover:bg-stone-200 dark:hover:bg-slate-700 flex items-center justify-center text-stone-700 dark:text-slate-300 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveItem} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-stone-600 dark:text-slate-300 mb-1">
                  Nom de la matière
                </label>
                <input
                  type="text"
                  required
                  value={subjectInput}
                  onChange={(e) => setSubjectInput(e.target.value)}
                  placeholder="Ex: Mathématiques..."
                  className="w-full px-3.5 py-2.5 bg-stone-50 dark:bg-slate-900 border border-stone-300 dark:border-slate-700 rounded-xl font-medium text-stone-900 dark:text-slate-100 text-sm focus:outline-none focus:border-blue-600 transition-all"
                />
              </div>

              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-stone-600 dark:text-slate-300 mb-1">
                    Coefficient
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    min="0.5"
                    max="20"
                    maxLength={5}
                    required
                    value={coeffInput}
                    onChange={(e) => {
                      if (e.target.value.length <= 5) setCoeffInput(e.target.value);
                    }}
                    className="w-full px-3.5 py-2.5 bg-stone-50 dark:bg-slate-900 border border-stone-300 dark:border-slate-700 rounded-xl font-medium text-stone-900 dark:text-slate-100 text-sm focus:outline-none focus:border-blue-600 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-stone-600 dark:text-slate-300 mb-1">
                    Échelle standard de notation (Défaut : 20)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="99999"
                    maxLength={5}
                    required
                    value={standardScaleInput}
                    onChange={(e) => {
                      if (e.target.value.length <= 5) setStandardScaleInput(e.target.value);
                    }}
                    className="w-32 px-3.5 py-2.5 bg-stone-50 dark:bg-slate-900 border border-stone-300 dark:border-slate-700 rounded-xl font-medium text-stone-900 dark:text-slate-100 text-sm focus:outline-none focus:border-blue-600 transition-all"
                  />
                  <p className="text-[11px] text-stone-500 dark:text-slate-400 mt-1">
                    Base de référence commune (ex : 20, 10, 100...)
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-stone-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 bg-stone-100 dark:bg-slate-800 hover:bg-stone-200 dark:hover:bg-slate-700 text-stone-700 dark:text-slate-300 font-semibold text-xs rounded-xl transition-all cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-xl shadow transition-all cursor-pointer"
                >
                  {editingItem ? "Enregistrer" : "Ajouter"}
                </button>
              </div>

              {editingItem && (
                <div className="pt-4 mt-2 border-t border-stone-200 dark:border-slate-800 space-y-2">
                  <label className="block text-xs font-semibold text-stone-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Gestion de la ligne
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setShowAddModal(false);
                        setDeleteId(editingItem.id);
                      }}
                      className="px-3 py-2.5 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/60 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-800 font-semibold text-xs rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <Trash2 className="w-4 h-4" />
                      <span>Supprimer la ligne</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowAddModal(false);
                        setShowAddLineConfirm(true);
                      }}
                      className="px-3 py-2.5 bg-stone-100 dark:bg-slate-800 hover:bg-stone-200 dark:hover:bg-slate-700 text-stone-800 dark:text-slate-200 border border-stone-300 dark:border-slate-700 font-semibold text-xs rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <Plus className="w-4 h-4" />
                      <span>+ Ajouter ligne</span>
                    </button>
                  </div>
                </div>
              )}
            </form>
          </div>
        </div>
      )}

      {/* Sub-Grade Edit Modal */}
      {editingSubGrade && (
        <div className="fixed inset-0 z-60 bg-stone-900/60 dark:bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#161f30] rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-stone-200 dark:border-slate-800 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-stone-100 dark:border-slate-800">
              <h3 className="font-sans font-bold text-base text-blue-900 dark:text-blue-300">
                Modifier la note
              </h3>
              <button
                onClick={() => setEditingSubGrade(null)}
                className="w-8 h-8 rounded-full bg-stone-100 dark:bg-slate-800 hover:bg-stone-200 dark:hover:bg-slate-700 flex items-center justify-center text-stone-700 dark:text-slate-300 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleEditSubGradeSubmit} className="space-y-4">
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-[10px] font-semibold text-stone-500 dark:text-slate-400 mb-1">Note</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max={editingSubGrade.max || 20}
                    maxLength={5}
                    required
                    value={editingSubGrade.value}
                    onChange={(e) => {
                      if (e.target.value.length <= 5) setEditingSubGrade({ ...editingSubGrade, value: e.target.value });
                    }}
                    className="w-full px-2.5 py-2 bg-stone-50 dark:bg-slate-900 border border-stone-300 dark:border-slate-700 rounded-xl text-xs font-medium text-stone-900 dark:text-slate-100 focus:outline-none focus:border-blue-600"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-stone-500 dark:text-slate-400 mb-1">Sur combien</label>
                  <input
                    type="number"
                    step="1"
                    min="1"
                    maxLength={5}
                    required
                    value={editingSubGrade.max}
                    onChange={(e) => {
                      if (e.target.value.length <= 5) setEditingSubGrade({ ...editingSubGrade, max: e.target.value });
                    }}
                    className="w-full px-2.5 py-2 bg-stone-50 dark:bg-slate-900 border border-stone-300 dark:border-slate-700 rounded-xl text-xs font-medium text-stone-900 dark:text-slate-100 focus:outline-none focus:border-blue-600"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-stone-500 dark:text-slate-400 mb-1">Coefficient</label>
                  <input
                    type="number"
                    step="0.5"
                    min="0.5"
                    maxLength={5}
                    required
                    value={editingSubGrade.coefficient}
                    onChange={(e) => {
                      if (e.target.value.length <= 5) setEditingSubGrade({ ...editingSubGrade, coefficient: e.target.value });
                    }}
                    className="w-full px-2.5 py-2 bg-stone-50 dark:bg-slate-900 border border-stone-300 dark:border-slate-700 rounded-xl text-xs font-medium text-stone-900 dark:text-slate-100 focus:outline-none focus:border-blue-600"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-stone-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingSubGrade(null)}
                  className="px-4 py-2 bg-stone-100 dark:bg-slate-800 hover:bg-stone-200 dark:hover:bg-slate-700 text-stone-700 dark:text-slate-300 font-semibold text-xs rounded-xl transition-all cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-xl shadow transition-all cursor-pointer"
                >
                  Enregistrer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteId && (
        <div className="fixed inset-0 z-60 bg-stone-900/60 dark:bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#161f30] rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-stone-200 dark:border-slate-800 animate-in fade-in zoom-in-95 duration-200">
            <h3 className="font-sans font-bold text-base text-stone-900 dark:text-slate-100 mb-2">
              Supprimer cette matière ?
            </h3>
            <p className="text-xs text-stone-600 dark:text-slate-400 mb-6">
              Voulez-vous vraiment supprimer cette ligne de note ?
            </p>
            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-stone-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setDeleteId(null)}
                className="px-4 py-2 bg-stone-100 dark:bg-slate-800 hover:bg-stone-200 dark:hover:bg-slate-700 text-stone-700 dark:text-slate-300 font-semibold text-xs rounded-xl transition-all cursor-pointer"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs rounded-xl shadow transition-all cursor-pointer"
              >
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Calculation Steps & User Guide Modal */}
      {showCalcStepsModal && (
        <div className="fixed inset-0 md:left-64 z-60 bg-[#FBF9F5] dark:bg-[#0b0f19] flex flex-col animate-in fade-in duration-200 overflow-y-auto">
          {/* Header with Fixed Top-Left Back Arrow */}
          <div className="sticky top-0 left-0 right-0 bg-[#FBF9F5] dark:bg-[#0b0f19] shadow-xs px-4 py-3 border-b border-stone-300 dark:border-slate-800 flex items-center justify-between z-50">
            <button
              onClick={() => setShowCalcStepsModal(false)}
              className="flex items-center gap-2 px-4 py-2 bg-stone-900 dark:bg-blue-600 hover:bg-stone-800 dark:hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4 text-white" />
              <span>Retour</span>
            </button>
            <h2 className="text-sm font-extrabold text-stone-900 dark:text-slate-100 truncate">
              Guide & Logique de calcul
            </h2>
            <div className="w-16" />
          </div>

          {/* Content Body */}
          <div className="max-w-3xl w-full mx-auto px-6 py-8 space-y-10 pb-24 text-stone-800 dark:text-slate-200 font-serif">
            
            {/* Section 1: Guide Pratique */}
            <div className="space-y-6">
              <div className="border-b-2 border-stone-300 dark:border-slate-800 pb-2">
                <span className="text-xs font-sans font-bold uppercase tracking-widest text-blue-800 dark:text-blue-400">
                  Chapitre 1
                </span>
                <h3 className="text-xl sm:text-2xl font-extrabold text-stone-900 dark:text-slate-100 font-serif mt-1">
                  Mode d'emploi des fonctionnalités
                </h3>
              </div>
              
              <div className="space-y-6 text-sm sm:text-base leading-relaxed text-stone-700 dark:text-slate-300">
                <div className="space-y-1.5">
                  <h4 className="font-extrabold text-stone-900 dark:text-slate-100 text-base flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-blue-600"></span>
                    1. Ajouter et gérer les matières
                  </h4>
                  <p className="pl-4 text-stone-600 dark:text-slate-400">
                    Cliquez sur le bouton <strong>"+ Ajouter ligne"</strong> pour créer une nouvelle matière. Un message de confirmation vous invite à valider pour éviter les clics multiples. Vous pouvez ensuite modifier son nom, son coefficient et son échelle de notation directement dans le tableau.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <h4 className="font-extrabold text-stone-900 dark:text-slate-100 text-base flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-blue-600"></span>
                    2. Le rôle des Coefficients
                  </h4>
                  <p className="pl-4 text-stone-600 dark:text-slate-400">
                    Le coefficient détermine le poids de la matière dans votre moyenne générale. Plus le coefficient est élevé (ex: 4 ou 5), plus la note de cette matière aura d'impact sur votre semestre.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <h4 className="font-extrabold text-stone-900 dark:text-slate-100 text-base flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-blue-600"></span>
                    3. Gestion des notes et sous-notes
                  </h4>
                  <p className="pl-4 text-stone-600 dark:text-slate-400">
                    Vous pouvez ajouter plusieurs notes (devoirs, examens, colles) pour chaque matière. L'application calcule automatiquement la moyenne pondérée de chaque matière selon les barèmes (ex: /20, /10 ou /100).
                  </p>
                </div>
              </div>
            </div>

            {/* Section 2: Logique de calcul */}
            <div className="space-y-6 pt-6 border-t-2 border-stone-300 dark:border-slate-800">
              <div className="border-b-2 border-stone-300 dark:border-slate-800 pb-2">
                <span className="text-xs font-sans font-bold uppercase tracking-widest text-blue-800 dark:text-blue-400">
                  Chapitre 2
                </span>
                <h3 className="text-xl sm:text-2xl font-extrabold text-stone-900 dark:text-slate-100 font-serif mt-1">
                  Logique de calcul mathématique (Pas à pas)
                </h3>
              </div>

              <div className="space-y-8 text-sm sm:text-base text-stone-700 dark:text-slate-300">
                <div className="space-y-3">
                  <h4 className="font-extrabold text-stone-900 dark:text-slate-100 text-sm font-sans uppercase tracking-wider bg-stone-200/60 dark:bg-slate-800 px-3 py-1.5 rounded-lg inline-block">
                    A. Calcul de la moyenne d'une matière (Évaluations)
                  </h4>
                  <div className="space-y-3 pl-2">
                    <div>
                      <strong className="text-stone-900 dark:text-slate-100">1. Harmonisation des échelles :</strong>
                      <p className="text-stone-600 dark:text-slate-400 mt-0.5">Toutes les notes sont ramenées sur la base de 20 : <code className="bg-stone-200/80 dark:bg-slate-800 px-1.5 py-0.5 rounded font-mono text-xs font-bold text-stone-900 dark:text-slate-100">(Note / Max) × 20</code>.</p>
                    </div>
                    <div>
                      <strong className="text-stone-900 dark:text-slate-100">2. Pondération & Addition :</strong>
                      <p className="text-stone-600 dark:text-slate-400 mt-0.5">Somme des notes pondérées par leurs coefficients respectifs, divisée par la somme des coefficients des évaluations.</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <h4 className="font-extrabold text-stone-900 dark:text-slate-100 text-sm font-sans uppercase tracking-wider bg-stone-200/60 dark:bg-slate-800 px-3 py-1.5 rounded-lg inline-block">
                    B. Calcul de la moyenne générale du semestre
                  </h4>
                  <div className="space-y-3 pl-2">
                    <div>
                      <strong className="text-stone-900 dark:text-slate-100">1. Pondération par matière :</strong>
                      <p className="text-stone-600 dark:text-slate-400 mt-0.5">Pour chaque matière, on multiplie sa moyenne obtenue par le coefficient attribué à la matière.</p>
                    </div>
                    <div>
                      <strong className="text-stone-900 dark:text-slate-100">2. Total des points :</strong>
                      <p className="text-stone-600 dark:text-slate-400 mt-0.5">Somme de tous les résultats obtenus pour l'ensemble des matières du semestre.</p>
                    </div>
                    <div>
                      <strong className="text-stone-900 dark:text-slate-100">3. Total des coefficients :</strong>
                      <p className="text-stone-600 dark:text-slate-400 mt-0.5">Addition des coefficients de toutes les matières du semestre pour obtenir le poids total.</p>
                    </div>
                    <div>
                      <strong className="text-stone-900 dark:text-slate-100">4. Moyenne générale finale :</strong>
                      <p className="text-stone-600 dark:text-slate-400 mt-0.5">Division du total des points par le total des coefficients.</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer Button */}
            <div className="pt-8 border-t border-stone-300 dark:border-slate-800 flex justify-center">
              <button
                onClick={() => setShowCalcStepsModal(false)}
                className="px-8 py-3.5 bg-stone-900 dark:bg-blue-600 hover:bg-stone-800 dark:hover:bg-blue-700 text-white font-extrabold text-xs font-sans uppercase tracking-wider rounded-2xl shadow-lg transition-all cursor-pointer flex items-center gap-2"
              >
                <span>Fermer et retourner à l'application</span>
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Confirmation Modal for Adding Line */}
      {showAddLineConfirm && (
        <div className="fixed inset-0 z-60 bg-stone-900/70 dark:bg-black/80 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#161f30] rounded-2xl max-w-sm w-full p-6 shadow-2xl border-2 border-stone-900 dark:border-slate-700 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-950 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0">
                <Plus className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-serif font-bold text-base text-stone-900 dark:text-slate-100">
                  Créer une nouvelle ligne ?
                </h3>
                <p className="text-xs text-stone-600 dark:text-slate-400 mt-0.5">
                  Voulez-vous ajouter une nouvelle ligne de matière ?
                </p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-stone-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setShowAddLineConfirm(false)}
                className="px-4 py-2 bg-stone-100 dark:bg-slate-800 hover:bg-stone-200 dark:hover:bg-slate-700 text-stone-700 dark:text-slate-300 font-bold text-xs rounded-xl transition-all cursor-pointer"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowAddLineConfirm(false);
                  const newItem: GradeItem = {
                    id: Date.now().toString(),
                    subject: 'Nouvelle matière',
                    coefficient: 2.0,
                    grade: 10.0,
                  };
                  setTrimestersData(prev => ({
                    ...prev,
                    [activeTrimestre]: [...(prev[activeTrimestre] || []), newItem]
                  }));
                  handleOpenEdit(newItem);
                }}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer"
              >
                Ajouter
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
