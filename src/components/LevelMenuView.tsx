import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { ArrowLeft, Menu, X, BarChart2, Calendar, FolderTree, Award } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { ResponsiveContainer, BarChart as RechartsBarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell, Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, PieChart, Pie, AreaChart, Area } from 'recharts';
import { StudyCloudAPI } from '../services/api';
import { getCurrentUserId } from '../services/userSync';

interface LevelMenuViewProps {
  onBack: () => void;
}

export interface SubGradeDetail {
  value: number;
  max: number;
  coefficient: number;
}

export function parseSubGrade(s: any): SubGradeDetail | null {
  if (s === null || s === undefined) return null;
  if (typeof s === 'number') {
    return { value: s, max: 20, coefficient: 1 };
  }
  if (typeof s === 'string') {
    const num = parseFloat(s);
    if (!isNaN(num)) return { value: num, max: 20, coefficient: 1 };
    return null;
  }
  if (typeof s === 'object') {
    const val = Number(s.value ?? s.note ?? s.grade ?? s.val ?? s.score ?? 0);
    const max = Number(s.max ?? s.bareme ?? s.scale ?? s.outOf ?? s.total ?? 20) || 20;
    const coeff = Number(s.coefficient ?? s.coeff ?? s.coef ?? s.weight ?? 1) || 1;
    return { value: val, max, coefficient: coeff };
  }
  return null;
}

export function getItemAverage(item: any, standardScale: number = 20): { average: number; hasGrade: boolean; subGradeCount: number } {
  if (!item) return { average: 0, hasGrade: false, subGradeCount: 0 };
  
  const subs = Array.isArray(item.subGrades) ? item.subGrades : [];
  const validSubs: SubGradeDetail[] = [];
  for (const s of subs) {
    const parsed = parseSubGrade(s);
    if (parsed) validSubs.push(parsed);
  }

  if (validSubs.length > 0) {
    let totalW = 0;
    let totalC = 0;
    for (const sub of validSubs) {
      const norm = sub.max > 0 ? (sub.value / sub.max) * standardScale : sub.value;
      totalW += norm * sub.coefficient;
      totalC += sub.coefficient;
    }
    if (totalC > 0) {
      const avg = totalW / totalC;
      return {
        average: Math.min(Math.max(avg, 0), standardScale),
        hasGrade: true,
        subGradeCount: validSubs.length
      };
    }
  }

  // Prise en compte de la note directe si pas de sous-notes
  const directGrade = Number(item.grade ?? item.average ?? item.note ?? item.score ?? -1);
  if (directGrade >= 0 && (directGrade > 0 || item.hasGrade === true || (item.grade !== undefined && item.grade !== null))) {
    const norm = Math.min(Math.max(directGrade, 0), standardScale);
    return {
      average: norm,
      hasGrade: directGrade > 0 || item.hasGrade === true,
      subGradeCount: 0
    };
  }

  return { average: 0, hasGrade: false, subGradeCount: 0 };
}

const getStandardScale = () => {
  try {
    const s = localStorage.getItem('user_grades_standard_scale');
    if (s) return parseFloat(s) || 20;
  } catch (e) {}
  return 20;
};

const formatGradesDataFromD1 = (d1Rows: any[] = []): Record<string, any[]> => {
  const result: Record<string, any[]> = { '1': [], '2': [], '3': [] };

  // 1. Initialiser avec les matières enregistrées de l'élève (unifolder_saved_matieres) pour garantir l'affichage des matières
  try {
    const savedMat = localStorage.getItem('unifolder_saved_matieres');
    if (savedMat) {
      const parsedMat = JSON.parse(savedMat);
      if (Array.isArray(parsedMat) && parsedMat.length > 0) {
        (['1', '2', '3'] as const).forEach(trimKey => {
          parsedMat.forEach((m: any) => {
            const name = (m.name || '').trim();
            if (!name) return;
            result[trimKey].push({
              id: m.id ? `${m.id}_t${trimKey}` : `mat_${name}_t${trimKey}`,
              subject: name,
              coefficient: parseFloat(m.coefficient) || 1.0,
              grade: 0,
              subGrades: []
            });
          });
        });
      }
    }
  } catch (e) {}

  // 2. Fusionner les notes réelles récupérées depuis Cloudflare D1
  if (Array.isArray(d1Rows) && d1Rows.length > 0) {
    for (const row of d1Rows) {
      const trimKey = String(row.trimester || '1');
      if (!result[trimKey]) result[trimKey] = [];
      let subs: any[] = [];
      try {
        if (typeof row.sub_grades_json === 'string') {
          subs = JSON.parse(row.sub_grades_json);
        } else if (Array.isArray(row.sub_grades_json)) {
          subs = row.sub_grades_json;
        }
      } catch (e) {}

      const subjectName = (row.subject_name || row.subject || 'Matière').trim();
      const existingIdx = result[trimKey].findIndex((item: any) =>
        (item.id && row.id && String(item.id) === String(row.id)) ||
        (item.subject && item.subject.trim().toLowerCase() === subjectName.toLowerCase())
      );

      const gradeObj = {
        id: String(row.id || `d1-${Math.random()}`),
        subject: subjectName,
        coefficient: Number(row.coefficient) || 1.0,
        grade: Number(row.average ?? row.grade ?? 0),
        subGrades: subs,
      };

      if (existingIdx !== -1) {
        result[trimKey][existingIdx] = { ...result[trimKey][existingIdx], ...gradeObj };
      } else {
        result[trimKey].push(gradeObj);
      }
    }
  }

  return result;
};

const getTrimesterAverage = (trimestreKey: string, scale: number, data: Record<string, any[]>): number | null => {
  const items = data[trimestreKey];
  if (!Array.isArray(items) || items.length === 0) return null;

  let totalW = 0;
  let totalC = 0;
  let hasAnyGrade = false;

  items.forEach((item: any) => {
    const { average, hasGrade } = getItemAverage(item, scale);
    if (hasGrade) {
      hasAnyGrade = true;
      const coeff = Number(item.coefficient) || 1.0;
      totalW += average * coeff;
      totalC += coeff;
    }
  });

  if (hasAnyGrade && totalC > 0) {
    const avg = totalW / totalC;
    return Math.min(Math.max(avg, 0), scale);
  }

  return null;
};

const getSubjectsList = (trimKey: string, data: Record<string, any[]>) => {
  const subjectsSet = new Set<string>();

  const items = data[trimKey] || [];
  if (Array.isArray(items)) {
    items.forEach((i: any) => {
      const s = (i.subject || '').trim();
      if (s) subjectsSet.add(s);
    });
  }

  for (const t of ['1', '2', '3'] as const) {
    const otherItems = data[t] || [];
    if (Array.isArray(otherItems)) {
      otherItems.forEach((i: any) => {
        const s = (i.subject || '').trim();
        if (s) subjectsSet.add(s);
      });
    }
  }

  try {
    const savedMat = localStorage.getItem('unifolder_saved_matieres');
    if (savedMat) {
      const parsedMat = JSON.parse(savedMat);
      if (Array.isArray(parsedMat)) {
        parsedMat.forEach((m: any) => {
          const s = (m.name || '').trim();
          if (s) subjectsSet.add(s);
        });
      }
    }
  } catch (e) {}

  const list = Array.from(subjectsSet);
  return list.length > 0 ? list : ['Mathématiques', 'Physique', 'Anglais'];
};

const getNoteDataForSubject = (trimKey: string, subName: string, scale: number, data: Record<string, any[]>) => {
  const items = data[trimKey] || [];
  const item = items.find((i: any) => (i.subject || 'Matière').trim().toLowerCase() === subName.trim().toLowerCase());
  if (!item) return [];

  const subs = Array.isArray(item.subGrades) ? item.subGrades : [];
  if (subs.length > 0) {
    return subs.map((s: any, idx: number) => {
      const parsed = parseSubGrade(s);
      const val = parsed ? parsed.value : 0;
      const max = parsed ? parsed.max : 20;
      const norm = max > 0 ? (val / max) * scale : val;
      const clamped = Math.min(Math.max(norm, 0), scale);
      return {
        index: idx + 1,
        name: `Note ${idx + 1}`,
        count: clamped,
        hasNote: true,
        displayLabel: `${clamped.toFixed(2).replace('.', ',')} / ${scale}`
      };
    });
  }

  const { average, hasGrade } = getItemAverage(item, scale);
  if (hasGrade) {
    return [{
      index: 1,
      name: 'Note 1',
      count: average,
      hasNote: true,
      displayLabel: `${average.toFixed(2).replace('.', ',')} / ${scale}`
    }];
  }

  return [];
};

const getSubjectAveragesForTrimester = (trimestreKey: string, scale: number, data: Record<string, any[]>) => {
  const items = data[trimestreKey] || [];
  if (!Array.isArray(items) || items.length === 0) {
    return [];
  }

  return items.map((item: any) => {
    const subName = (item.subject || 'Matière').trim();
    const { average, hasGrade } = getItemAverage(item, scale);

    return {
      name: subName,
      count: hasGrade ? average : 0,
      hasNote: hasGrade,
      displayLabel: hasGrade ? `${average.toFixed(2).replace('.', ',')} / ${scale}` : 'Pas de note'
    };
  });
};

const getGlobalSubjectAverages = (scale: number, data: Record<string, any[]>) => {
  const subjectMap: Record<string, { totalW: number; totalC: number; hasGrade: boolean }> = {};

  Object.keys(data).forEach((trimKey) => {
    const items = data[trimKey] || [];
    if (Array.isArray(items)) {
      items.forEach((item: any) => {
        const subName = (item.subject || 'Matière').trim();
        if (!subName) return;

        if (!subjectMap[subName]) {
          subjectMap[subName] = { totalW: 0, totalC: 0, hasGrade: false };
        }

        const { average, hasGrade } = getItemAverage(item, scale);
        if (hasGrade) {
          const coeff = Number(item.coefficient) || 1.0;
          subjectMap[subName].totalW += average * coeff;
          subjectMap[subName].totalC += coeff;
          subjectMap[subName].hasGrade = true;
        }
      });
    }
  });

  const subjects = Object.keys(subjectMap);
  if (subjects.length > 0) {
    return subjects.map(sub => {
      const entry = subjectMap[sub];
      const avg = entry.hasGrade && entry.totalC > 0 ? entry.totalW / entry.totalC : 0;
      const clamped = Math.min(Math.max(avg, 0), scale);
      return {
        subject: sub.length > 15 ? sub.substring(0, 12) + '...' : sub,
        fullSubject: sub,
        A: clamped,
        hasGrade: entry.hasGrade,
        fullMark: scale,
      };
    });
  }

  return [
    { subject: 'Math', A: 0, fullMark: scale, hasGrade: false, fullSubject: 'Mathématiques' },
    { subject: 'Phys', A: 0, fullMark: scale, hasGrade: false, fullSubject: 'Physique' },
    { subject: 'Hist', A: 0, fullMark: scale, hasGrade: false, fullSubject: 'Histoire' },
    { subject: 'Lang', A: 0, fullMark: scale, hasGrade: false, fullSubject: 'Langues' },
  ];
};

const getGlobalGradeDistribution = (scale: number, data: Record<string, any[]>) => {
  let exc = 0, bien = 0, moyen = 0, faible = 0;

  Object.keys(data).forEach((trimKey) => {
    const items = data[trimKey] || [];
    if (Array.isArray(items)) {
      items.forEach((item: any) => {
        const subs = Array.isArray(item.subGrades) ? item.subGrades : [];
        if (subs.length > 0) {
          subs.forEach((s: any) => {
            const parsed = parseSubGrade(s);
            if (parsed) {
              const norm = parsed.max > 0 ? (parsed.value / parsed.max) * 20 : parsed.value;
              if (norm >= 16) exc++;
              else if (norm >= 12) bien++;
              else if (norm >= 10) moyen++;
              else faible++;
            }
          });
        } else {
          const { average, hasGrade } = getItemAverage(item, scale);
          if (hasGrade) {
            const norm = scale > 0 ? (average / scale) * 20 : average;
            if (norm >= 16) exc++;
            else if (norm >= 12) bien++;
            else if (norm >= 10) moyen++;
            else faible++;
          }
        }
      });
    }
  });

  const total = exc + bien + moyen + faible;
  if (total === 0) return [];

  return [
    { name: 'Excellent (≥16)', value: exc, color: '#16a34a' },
    { name: 'Bien (12-16)', value: bien, color: '#9333ea' },
    { name: 'Moyen (10-12)', value: moyen, color: '#ea580c' },
    { name: 'Faible (<10)', value: faible, color: '#ef4444' },
  ].filter(d => d.value > 0);
};

export const LevelMenuView: React.FC<LevelMenuViewProps> = ({ onBack }) => {
  const [standardScale, setStandardScale] = useState<number>(() => getStandardScale());
  const [gradesData, setGradesData] = useState<Record<string, any[]>>(() => formatGradesDataFromD1([]));
  const [isRightDrawerOpen, setIsRightDrawerOpen] = useState(false);
  const [selectedAnalysis, setSelectedAnalysis] = useState<string>('analyse globale');
  const [subjectTrimestre, setSubjectTrimestre] = useState<'1' | '2' | '3'>('1');
  const [noteTrimestre, setNoteTrimestre] = useState<'1' | '2' | '3'>('1');
  const [selectedNoteSubject, setSelectedNoteSubject] = useState<string>('');
  const [isNoteSubjectDropdownOpen, setIsNoteSubjectDropdownOpen] = useState(false);

  // Chargement direct depuis Cloudflare D1
  const fetchGradesFromD1 = useCallback(() => {
    const userId = getCurrentUserId() || localStorage.getItem('unifolder_user_id') || 'default-user';
    StudyCloudAPI.getGrades(userId)
      .then((res: any) => {
        if (res && res.success && Array.isArray(res.data)) {
          setGradesData(formatGradesDataFromD1(res.data));
        } else {
          setGradesData(formatGradesDataFromD1([]));
        }
      })
      .catch((err) => {
        console.warn('[LevelMenuView] D1 getGrades warning:', err);
      });
  }, []);

  // Chargement initial au montage
  useEffect(() => {
    fetchGradesFromD1();
  }, [fetchGradesFromD1]);

  // Écoute de tous les événements de mise à jour des notes et matières (rechargement D1 en temps réel)
  useEffect(() => {
    const handleUpdate = () => {
      fetchGradesFromD1();
      setStandardScale(getStandardScale());
    };

    window.addEventListener('user_grades_changed', handleUpdate);
    window.addEventListener('unifolder_data_restored', handleUpdate);
    window.addEventListener('unifolder_files_updated', handleUpdate);
    window.addEventListener('storage', handleUpdate);

    return () => {
      window.removeEventListener('user_grades_changed', handleUpdate);
      window.removeEventListener('unifolder_data_restored', handleUpdate);
      window.removeEventListener('unifolder_files_updated', handleUpdate);
      window.removeEventListener('storage', handleUpdate);
    };
  }, [fetchGradesFromD1]);

  const t1Avg = useMemo(() => getTrimesterAverage('1', standardScale, gradesData), [standardScale, gradesData]);
  const t2Avg = useMemo(() => getTrimesterAverage('2', standardScale, gradesData), [standardScale, gradesData]);
  const t3Avg = useMemo(() => getTrimesterAverage('3', standardScale, gradesData), [standardScale, gradesData]);

  const trimesterData = useMemo(() => [
    { 
      name: 'Trimestre 1', 
      count: t1Avg !== null ? t1Avg : 0, 
      hasNote: t1Avg !== null,
      displayLabel: t1Avg !== null ? `${t1Avg.toFixed(2).replace('.', ',')} / ${standardScale}` : 'Pas de note',
    },
    { 
      name: 'Trimestre 2', 
      count: t2Avg !== null ? t2Avg : 0, 
      hasNote: t2Avg !== null,
      displayLabel: t2Avg !== null ? `${t2Avg.toFixed(2).replace('.', ',')} / ${standardScale}` : 'Pas de note',
    },
    { 
      name: 'Trimestre 3', 
      count: t3Avg !== null ? t3Avg : 0, 
      hasNote: t3Avg !== null,
      displayLabel: t3Avg !== null ? `${t3Avg.toFixed(2).replace('.', ',')} / ${standardScale}` : 'Pas de note',
    },
  ], [t1Avg, t2Avg, t3Avg, standardScale]);

  const noteSubjects = useMemo(() => getSubjectsList(noteTrimestre, gradesData), [noteTrimestre, gradesData]);
  const currentNoteSubject = useMemo(() => {
    if (selectedNoteSubject && noteSubjects.includes(selectedNoteSubject)) {
      return selectedNoteSubject;
    }
    // Sélectionner automatiquement en priorité la première matière qui contient des notes pour ce trimestre
    const subjectWithGrade = noteSubjects.find(sub => {
      const items = gradesData[noteTrimestre] || [];
      const it = items.find((i: any) => (i.subject || '').trim().toLowerCase() === sub.trim().toLowerCase());
      if (!it) return false;
      const { hasGrade } = getItemAverage(it, standardScale);
      return hasGrade;
    });
    return subjectWithGrade || noteSubjects[0] || 'Matière';
  }, [selectedNoteSubject, noteSubjects, gradesData, noteTrimestre, standardScale]);

  const cycleNoteSubject = () => {
    if (noteSubjects.length <= 1) return;
    const idx = noteSubjects.indexOf(currentNoteSubject);
    const nextIdx = (idx + 1) % noteSubjects.length;
    setSelectedNoteSubject(noteSubjects[nextIdx]);
  };

  const noteData = useMemo(() => getNoteDataForSubject(noteTrimestre, currentNoteSubject, standardScale, gradesData), [noteTrimestre, currentNoteSubject, standardScale, gradesData]);

  const subjectData = useMemo(() => getSubjectAveragesForTrimester(subjectTrimestre, standardScale, gradesData), [subjectTrimestre, standardScale, gradesData]);

  const globalSubjectData = useMemo(() => getGlobalSubjectAverages(standardScale, gradesData), [standardScale, gradesData]);

  const gradeDistributionData = useMemo(() => getGlobalGradeDistribution(standardScale, gradesData), [standardScale, gradesData]);

  const globalProgressData = useMemo(() => [
    { name: 'Trimestre 1', avg: t1Avg !== null ? t1Avg : 0, hasNote: t1Avg !== null },
    { name: 'Trimestre 2', avg: t2Avg !== null ? t2Avg : 0, hasNote: t2Avg !== null },
    { name: 'Trimestre 3', avg: t3Avg !== null ? t3Avg : 0, hasNote: t3Avg !== null }
  ], [t1Avg, t2Avg, t3Avg]);

  const ticks = [0, 5, 10, 15, standardScale];

  const CustomYTick = (props: any) => {
    const { x, y, payload } = props;
    const val = Number(payload.value);
    let label = `${val}`;
    let color = '#2D4A3E';

    if (Math.abs(val - 0) < 0.1) {
      label = '0 : Nul';
      color = '#dc2626'; // Red
    } else if (Math.abs(val - 5) < 0.1) {
      label = '5 : Faible';
      color = '#ea580c'; // Orange
    } else if (Math.abs(val - 10) < 0.1) {
      label = '10 : Moyen';
      color = '#ea580c'; // Orange
    } else if (Math.abs(val - 15) < 0.1) {
      label = '15 : Fort';
      color = '#9333ea'; // Violet
    } else if (Math.abs(val - standardScale) < 0.1 || Math.abs(val - 20) < 0.1) {
      label = `${val} : God`;
      color = '#16a34a'; // Green
    }

    return (
      <text x={x - 4} y={y + 4} fill={color} fontSize="9" fontWeight="bold" textAnchor="end">
        {label}
      </text>
    );
  };

  // Dynamic gradient stops generator based on achieved grade value
  const getGradientStops = (rawVal: number, maxScale: number) => {
    const v20 = Math.max(0, Math.min((rawVal / (maxScale || 20)) * 20, 20));

    const getExactColor = (v: number) => {
      if (v <= 5) return v === 0 ? '#dc2626' : '#ef4444';
      if (v <= 10) return v <= 8 ? '#fb923c' : '#ea580c';
      if (v <= 15) return v <= 13 ? '#c084fc' : '#9333ea';
      return v <= 18 ? '#4ade80' : '#16a34a';
    };

    if (v20 <= 0) {
      return [
        { offset: '0%', color: '#dc2626' },
        { offset: '100%', color: '#dc2626' }
      ];
    }

    const stops = [{ offset: '0%', color: '#dc2626' }];

    if (v20 > 5) {
      stops.push({ offset: `${(5 / v20) * 100}%`, color: '#f87171' });
      stops.push({ offset: `${(5.01 / v20) * 100}%`, color: '#fdba74' });
    }
    if (v20 > 10) {
      stops.push({ offset: `${(10 / v20) * 100}%`, color: '#ea580c' });
      stops.push({ offset: `${(10.01 / v20) * 100}%`, color: '#d8b4fe' });
    }
    if (v20 > 15) {
      stops.push({ offset: `${(15 / v20) * 100}%`, color: '#9333ea' });
      stops.push({ offset: `${(15.01 / v20) * 100}%`, color: '#86efac' });
    }

    stops.push({ offset: '100%', color: getExactColor(v20) });

    return stops.map((s, idx, arr) => {
      let num = parseFloat(s.offset);
      if (isNaN(num)) num = 100;
      num = Math.max(0, Math.min(num, 100));
      if (idx > 0) {
        const prevNum = parseFloat(arr[idx - 1].offset);
        if (num <= prevNum) {
          num = Math.min(100, prevNum + 0.1);
        }
      }
      return { offset: `${num}%`, color: s.color };
    });
  };

  const getNoteSolidColor = (rawVal: number, maxScale: number) => {
    const v20 = Math.max(0, Math.min((rawVal / (maxScale || 20)) * 20, 20));
    if (v20 <= 5) return '#ef4444';
    if (v20 <= 10) return '#ea580c';
    if (v20 <= 15) return '#9333ea';
    return '#16a34a';
  };

  return (
    <div className="absolute inset-x-0 bottom-0 top-[62px] md:top-[66px] md:left-64 z-30 w-full md:w-[calc(100%-16rem)] bg-[#F5F0E8] dark:bg-[#0b0f19] text-[#2D4A3E] dark:text-slate-100 px-4 py-6 overflow-y-auto transition-colors duration-300">
      <svg style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden' }}>
        <defs>
          {trimesterData.map((item, idx) => {
            const stops = getGradientStops(item.count, standardScale);
            return (
              <React.Fragment key={`tri-frag-${idx}`}>
                <linearGradient id={`trimGradient-${idx}`} x1="0" y1="1" x2="0" y2="0">
                  {stops.map((s, sIdx) => (
                    <stop key={sIdx} offset={s.offset} stopColor={s.color} />
                  ))}
                </linearGradient>
                <linearGradient id={`triGradient-${idx}`} x1="0" y1="1" x2="0" y2="0">
                  {stops.map((s, sIdx) => (
                    <stop key={sIdx} offset={s.offset} stopColor={s.color} />
                  ))}
                </linearGradient>
              </React.Fragment>
            );
          })}
          {subjectData.map((item, idx) => {
            const stops = getGradientStops(item.count, standardScale);
            return (
              <linearGradient key={`sub-grad-${idx}`} id={`subGradient-${idx}`} x1="0" y1="1" x2="0" y2="0">
                {stops.map((s, sIdx) => (
                  <stop key={sIdx} offset={s.offset} stopColor={s.color} />
                ))}
              </linearGradient>
            );
          })}
          {noteData.map((item, idx) => {
            const stops = getGradientStops(item.count, standardScale);
            return (
              <linearGradient key={`note-grad-${idx}`} id={`noteGradient-${idx}`} x1="0" y1="1" x2="0" y2="0">
                {stops.map((s, sIdx) => (
                  <stop key={sIdx} offset={s.offset} stopColor={s.color} />
                ))}
              </linearGradient>
            );
          })}
        </defs>
      </svg>

      <div className="fixed top-[66px] md:top-[70px] left-4 right-4 md:left-[17.5rem] grid grid-cols-3 items-start z-40 pointer-events-none">
        <div className="flex flex-col items-start gap-1.5 pointer-events-auto justify-self-start">
          <button
            onClick={onBack}
            className="flex items-center gap-1 px-2.5 py-1 bg-[#E8DFD0] hover:bg-[#D4C9B5] text-[#2D4A3E] dark:bg-[#1e293b] dark:text-white dark:border-[#334155] font-bold text-[10px] rounded-lg border-2 border-[#2D4A3E] shadow-[1px_1px_0px_0px_#1c1917] transition-all cursor-pointer active:translate-x-0.5 active:translate-y-0.5"
          >
            <ArrowLeft className="w-3 h-3 text-[#2D4A3E] dark:text-white" />
            <span>Retour</span>
          </button>

          {selectedAnalysis === 'analyse par matière' && (
            <div className="flex flex-row items-center gap-1 mt-0.5 whitespace-nowrap">
              {(['1', '2', '3'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setSubjectTrimestre(t)}
                  className={`px-2.5 py-1 text-xs font-bold rounded-lg border border-[#2D4A3E] dark:border-slate-700 transition-all cursor-pointer shadow-xs ${subjectTrimestre === t ? 'bg-[#2D4A3E] dark:bg-emerald-700 text-[#F5F0E8]' : 'bg-[#E8DFD0] dark:bg-slate-800 text-[#2D4A3E] dark:text-slate-200 hover:bg-[#D4C9B5] dark:hover:bg-slate-700'}`}
                >
                  Trimestre {t}
                </button>
              ))}
            </div>
          )}

          {selectedAnalysis === 'analyse par note' && (
            <div className="flex flex-col gap-1.5 mt-0.5">
              <div className="flex flex-row items-center gap-1 whitespace-nowrap">
                {(['1', '2', '3'] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setNoteTrimestre(t)}
                    className={`px-2.5 py-1 text-xs font-bold rounded-lg border border-[#2D4A3E] dark:border-slate-700 transition-all cursor-pointer shadow-xs ${noteTrimestre === t ? 'bg-[#2D4A3E] dark:bg-emerald-700 text-[#F5F0E8]' : 'bg-[#E8DFD0] dark:bg-slate-800 text-[#2D4A3E] dark:text-slate-200 hover:bg-[#D4C9B5] dark:hover:bg-slate-700'}`}
                  >
                    Trimestre {t}
                  </button>
                ))}
              </div>
              <div className="flex relative">
                <button
                  onClick={() => setIsNoteSubjectDropdownOpen(!isNoteSubjectDropdownOpen)}
                  className="px-2.5 py-1 text-xs font-bold rounded-lg border border-[#2D4A3E] dark:border-slate-700 bg-[#E8DFD0] dark:bg-slate-800 hover:bg-[#D4C9B5] dark:hover:bg-slate-700 text-[#2D4A3E] dark:text-slate-200 transition-all cursor-pointer shadow-xs flex items-center gap-1.5 whitespace-nowrap"
                  title="Sélectionner la matière"
                >
                  <span>Matière : {currentNoteSubject}</span>
                  <svg className={`w-3 h-3 transition-transform ${isNoteSubjectDropdownOpen ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="6 9 12 15 18 9"/></svg>
                </button>
                {isNoteSubjectDropdownOpen && (
                  <div className="absolute top-full left-0 mt-1 bg-[#F5F0E8] dark:bg-[#1e293b] border-2 border-[#2D4A3E] dark:border-slate-700 rounded-lg shadow-lg z-50 min-w-[140px] py-1 max-h-48 overflow-y-auto">
                    {noteSubjects.map((sub, idx) => (
                      <button
                        key={idx}
                        onClick={() => {
                          setSelectedNoteSubject(sub);
                          setIsNoteSubjectDropdownOpen(false);
                        }}
                        className={`w-full text-left px-3 py-1.5 text-xs font-bold hover:bg-[#E8DFD0] dark:hover:bg-slate-700 transition-colors ${currentNoteSubject === sub ? 'bg-[#2D4A3E] dark:bg-emerald-700 text-[#F5F0E8]' : 'text-[#2D4A3E] dark:text-slate-200'}`}
                      >
                        {sub}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-center pointer-events-auto justify-self-center pt-0.5">
          <span className="font-serif font-bold text-xs sm:text-sm text-[#2D4A3E] dark:text-slate-100 capitalize px-2.5 py-1 bg-[#E8DFD0]/80 dark:bg-slate-800/80 rounded-lg border border-[#2D4A3E]/30 dark:border-slate-700 shadow-xs whitespace-nowrap">
            {selectedAnalysis}
          </span>
        </div>

        <div className="flex justify-end pointer-events-auto justify-self-end">
          <button
            onClick={() => setIsRightDrawerOpen(true)}
            className="p-2 bg-[#E8DFD0] dark:bg-slate-800 hover:bg-[#D4C9B5] dark:hover:bg-slate-700 text-[#2D4A3E] dark:text-slate-200 rounded-lg border-2 border-[#2D4A3E] dark:border-slate-700 shadow-[1px_1px_0px_0px_#1c1917] transition-all cursor-pointer active:translate-x-0.5 active:translate-y-0.5 flex items-center justify-center"
            title="Menu"
          >
            {/* Three vertical lines icon representation */}
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="9" y1="4" x2="9" y2="20" />
              <line x1="15" y1="4" x2="15" y2="20" />
            </svg>
          </button>
        </div>
      </div>

      <div className="w-full h-[calc(100vh-100px)] px-2 sm:px-4 pt-11 sm:pt-12 flex flex-col">
        {selectedAnalysis === 'analyse globale' ? (
          <div className="w-full h-full py-4 overflow-y-auto">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-4 h-auto min-h-full pb-10">
              {/* Radar Chart: Capabilities Profile */}
              <div className="bg-[#E8DFD0]/40 dark:bg-[#161f30] rounded-xl p-4 border border-[#2D4A3E]/10 dark:border-slate-800 flex flex-col items-center justify-center min-h-[350px]">
                <h3 className="font-serif font-bold text-[#2D4A3E] dark:text-slate-100 mb-2 text-center">Profil de Compétences</h3>
                <p className="text-xs text-[#5C6B5A] dark:text-slate-400 mb-4 text-center">Moyenne par matière sur l'année</p>
                <div className="w-full h-[250px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart cx="50%" cy="50%" outerRadius="70%" data={globalSubjectData}>
                      <PolarGrid stroke="#2D4A3E/30" />
                      <PolarAngleAxis dataKey="subject" tick={{ fill: '#2D4A3E', fontSize: 10, fontWeight: 'bold' }} />
                      <PolarRadiusAxis angle={30} domain={[0, standardScale]} tick={{ fill: '#2D4A3E', fontSize: 10 }} />
                      <Radar name="Moyenne" dataKey="A" stroke="#2D4A3E" fill="#2D4A3E" fillOpacity={0.5} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#F5F0E8', borderColor: '#2D4A3E', borderRadius: '8px', color: '#2D4A3E', fontWeight: 'bold' }}
                        formatter={(value: any, name: any, item: any) => [`${Number(value).toFixed(2).replace('.', ',')} / ${standardScale}`, item.payload.fullSubject || 'Moyenne']}
                      />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Pie Chart: Consistency */}
              <div className="bg-[#E8DFD0]/40 dark:bg-[#161f30] rounded-xl p-4 border border-[#2D4A3E]/10 dark:border-slate-800 flex flex-col items-center justify-center min-h-[350px]">
                <h3 className="font-serif font-bold text-[#2D4A3E] dark:text-slate-100 mb-2 text-center">Régularité des Notes</h3>
                <p className="text-xs text-[#5C6B5A] dark:text-slate-400 mb-4 text-center">Répartition de toutes les notes</p>
                {gradeDistributionData.length > 0 ? (
                  <div className="w-full flex-1 flex flex-col items-center justify-center min-h-[250px]">
                    <div className="w-full h-[200px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={gradeDistributionData}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={90}
                            paddingAngle={5}
                            dataKey="value"
                          >
                            {gradeDistributionData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip 
                            contentStyle={{ backgroundColor: '#F5F0E8', borderColor: '#2D4A3E', borderRadius: '8px', color: '#2D4A3E', fontWeight: 'bold' }}
                            formatter={(value: any) => [`${value} notes`, 'Quantité']}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="flex flex-wrap justify-center gap-3 mt-4 mb-2 px-2">
                      {gradeDistributionData.map((entry, idx) => (
                        <div key={idx} className="flex items-center gap-1.5 text-xs font-bold" style={{ color: entry.color }}>
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: entry.color }}></div>
                          {entry.name}: {entry.value}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-[250px] text-sm text-[#5C6B5A] dark:text-slate-400 italic">
                    Pas de notes enregistrées
                  </div>
                )}
              </div>

              {/* Area Chart: Progression */}
              <div className="bg-[#E8DFD0]/40 dark:bg-[#161f30] rounded-xl p-4 border border-[#2D4A3E]/10 dark:border-slate-800 flex flex-col items-center justify-center min-h-[350px] md:col-span-2">
                <h3 className="font-serif font-bold text-[#2D4A3E] dark:text-slate-100 mb-2 text-center">Progression Annuelle</h3>
                <p className="text-xs text-[#5C6B5A] dark:text-slate-400 mb-4 text-center">Évolution de la moyenne globale</p>
                <div className="w-full h-[250px] max-w-2xl">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={globalProgressData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorAvg" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#2D4A3E" stopOpacity={0.8}/>
                          <stop offset="95%" stopColor="#2D4A3E" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#2D4A3E/15" />
                      <XAxis dataKey="name" stroke="#2D4A3E" tick={{ fill: '#2D4A3E', fontWeight: 'bold', fontSize: 11 }} />
                      <YAxis stroke="#2D4A3E" domain={[0, standardScale]} tick={<CustomYTick />} ticks={ticks} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#F5F0E8', borderColor: '#2D4A3E', borderRadius: '8px', color: '#2D4A3E', fontWeight: 'bold' }}
                        formatter={(value: any, name: any, item: any) => item.payload.hasNote ? [`${Number(value).toFixed(2).replace('.', ',')} / ${standardScale}`, 'Moyenne'] : ['Pas de note', 'Moyenne']}
                      />
                      <Area type="monotone" dataKey="avg" stroke="#2D4A3E" strokeWidth={3} fillOpacity={1} fill="url(#colorAvg)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </div>
        ) : selectedAnalysis === 'analyse par trimestre' ? (
          <div className="w-full h-full py-4">
            <ResponsiveContainer width="100%" height="100%">
              <RechartsBarChart data={trimesterData} margin={{ top: 20, right: 10, left: 15, bottom: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2D4A3E/15" />
                <XAxis dataKey="name" stroke="#2D4A3E" tick={{ fill: '#2D4A3E', fontWeight: 'bold', fontSize: 11 }} />
                <YAxis stroke="#2D4A3E" tick={<CustomYTick />} domain={[0, standardScale]} ticks={ticks} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#F5F0E8', borderColor: '#2D4A3E', borderRadius: '8px', color: '#2D4A3E', fontWeight: 'bold' }}
                  formatter={(value: any, name: any, item: any) => [item.payload.displayLabel, 'Moyenne']}
                />
                <Bar 
                  dataKey="count" 
                  activeBar={false}
                  radius={[8, 8, 0, 0]} 
                  label={{ 
                    position: 'top', 
                    content: (props: any) => { 
                      const { x, y, width, index } = props; 
                      const item = trimesterData[index]; 
                      if (!item) return null;
                      return (
                        <text 
                          x={x + width / 2} 
                          y={y - 8} 
                          fill={item.hasNote ? '#2D4A3E' : '#ef4444'} 
                          textAnchor="middle" 
                          fontSize="11" 
                          fontWeight="bold"
                        >
                          {item.displayLabel}
                        </text>
                      ); 
                    } 
                  }} 
                >
                  {trimesterData.map((_, index) => (
                    <Cell key={`cell-trim-${index}`} fill={`url(#trimGradient-${index})`} />
                  ))}
                </Bar>
              </RechartsBarChart>
            </ResponsiveContainer>
          </div>
         ) : selectedAnalysis === 'analyse par matière' ? (
          <div className="w-full h-full py-2 flex flex-col">
            <div className="w-full flex-1 overflow-auto">
              <div style={{ width: subjectData.length <= 3 ? Math.max(250, subjectData.length * 80) : Math.max(500, subjectData.length * 85), height: '100%', minHeight: '300px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <RechartsBarChart data={subjectData} margin={{ top: 25, right: 20, left: 10, bottom: 25 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#2D4A3E/15" />
                    <XAxis dataKey="name" stroke="#2D4A3E" tick={{ fill: '#2D4A3E', fontWeight: 'bold', fontSize: 10 }} interval={0} angle={-15} textAnchor="end" height={40} />
                    <YAxis stroke="#2D4A3E" tick={<CustomYTick />} domain={[0, standardScale]} ticks={ticks} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#F5F0E8', borderColor: '#2D4A3E', borderRadius: '8px', color: '#2D4A3E', fontWeight: 'bold' }}
                      formatter={(value: any, name: any, item: any) => [item.payload.displayLabel, 'Moyenne']}
                    />
                    <Bar 
                      dataKey="count" 
                      activeBar={false}
                      radius={[8, 8, 0, 0]} 
                      label={{ 
                        position: 'top', 
                        content: (props: any) => { 
                          const { x, y, width, index } = props; 
                          const item = subjectData[index]; 
                          if (!item) return null;
                          return (
                            <text 
                              x={x + width / 2} 
                              y={y - 8} 
                              fill={item.hasNote ? '#2D4A3E' : '#ef4444'} 
                              textAnchor="middle" 
                              fontSize="10" 
                              fontWeight="bold"
                            >
                              {item.displayLabel}
                            </text>
                          ); 
                        } 
                      }} 
                    >
                      {subjectData.map((_, index) => (
                        <Cell key={`cell-sub-${index}`} fill={`url(#subGradient-${index})`} />
                      ))}
                    </Bar>
                  </RechartsBarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        ) : selectedAnalysis === 'analyse par note' ? (
          <div className="w-full h-full py-2 flex flex-col">
            {noteData.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full min-h-[300px] gap-3">
                <svg className="w-14 h-14 text-[#2D4A3E]/30 dark:text-slate-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                <p className="text-sm font-bold text-[#5C6B5A] dark:text-slate-400 italic text-center">
                  Aucune note pour <span className="text-[#2D4A3E] dark:text-slate-200 not-italic">{currentNoteSubject}</span><br />
                  <span className="text-xs font-normal">au Trimestre {noteTrimestre}. Ajoutez des notes dans le menu Notes.</span>
                </p>
              </div>
            ) : (
            <div className="w-full flex-1 overflow-auto">
              <div style={{ width: noteData.length <= 2 ? Math.max(180, noteData.length * 80) : Math.max(280, noteData.length * 55), height: '100%', minHeight: '300px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <RechartsBarChart data={noteData} margin={{ top: 25, right: 20, left: 10, bottom: 25 }} barCategoryGap="10%">
                    <CartesianGrid strokeDasharray="3 3" stroke="#2D4A3E/15" />
                    <XAxis 
                      dataKey="name" 
                      stroke="#2D4A3E" 
                      tick={{ fill: '#2D4A3E', fontWeight: 'bold', fontSize: 11 }} 
                    />
                    <YAxis stroke="#2D4A3E" tick={<CustomYTick />} domain={[0, standardScale]} ticks={ticks} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#F5F0E8', borderColor: '#2D4A3E', borderRadius: '8px', color: '#2D4A3E', fontWeight: 'bold' }}
                      formatter={(value: any, name: any, item: any) => [item.payload.displayLabel, 'Note']}
                    />
                    <Bar 
                      dataKey="count" 
                      activeBar={false}
                      barSize={28}
                      radius={[0, 0, 0, 0]} 
                      label={{ 
                        position: 'top', 
                        content: (props: any) => { 
                          const { x, y, width, index } = props; 
                          const item = noteData[index]; 
                          if (!item) return null;
                          return (
                            <text 
                              x={x + width / 2} 
                              y={y - 8} 
                              fill={item.hasNote ? '#2D4A3E' : '#ef4444'} 
                              textAnchor="middle" 
                              fontSize="11" 
                              fontWeight="bold"
                            >
                              {item.displayLabel}
                            </text>
                          ); 
                        } 
                      }} 
                    >
                      {noteData.map((entry, index) => (
                        <Cell key={`cell-note-${index}`} fill={getNoteSolidColor(entry.count, standardScale)} />
                      ))}
                    </Bar>
                  </RechartsBarChart>
                </ResponsiveContainer>
              </div>
            </div>
            )}
          </div>
        ) : (
          <div className="text-center py-24">
            <h2 className="text-xl font-serif font-bold text-[#2D4A3E] dark:text-slate-100 mb-2 capitalize">{selectedAnalysis}</h2>
            <p className="text-sm font-sans text-[#5C6B5A] dark:text-slate-400">Sélectionnez un autre type d'analyse.</p>
          </div>
        )}
      </div>

      {/* Right Sidebar Drawer with Spring Animation */}
      <AnimatePresence>
        {isRightDrawerOpen && (
          <div className="fixed inset-0 z-50 pointer-events-none">
            {/* Backdrop click area to close */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="absolute inset-0 pointer-events-auto"
              onClick={() => setIsRightDrawerOpen(false)}
            />

            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="absolute top-0 right-0 bottom-0 w-64 sm:w-72 md:w-96 bg-[#F5F0E8] dark:bg-[#0f172a] border-l-2 border-[#2D4A3E] dark:border-slate-700 rounded-l-2xl shadow-2xl p-5 flex flex-col justify-between pointer-events-auto overflow-hidden"
            >
              <div>
                <div className="flex items-center justify-between pb-3 mb-5 border-b border-[#2D4A3E]/20 dark:border-slate-800">
                  <h2 className="font-serif font-bold text-base text-[#2D4A3E] dark:text-slate-100">Menu</h2>
                  <button
                    onClick={() => setIsRightDrawerOpen(false)}
                    className="p-1.5 hover:bg-[#E8DFD0] dark:hover:bg-slate-800 rounded-lg border border-[#2D4A3E] dark:border-slate-700 text-[#2D4A3E] dark:text-slate-200 transition-all cursor-pointer flex items-center justify-center"
                    title="Fermer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="space-y-2.5 font-sans text-xs">
                  <button 
                    onClick={() => {
                      setSelectedAnalysis('analyse globale');
                      setIsRightDrawerOpen(false);
                    }}
                    className={`w-full text-left p-2.5 rounded-xl border border-[#2D4A3E]/30 dark:border-slate-700 font-bold transition-all flex items-center gap-2.5 cursor-pointer ${selectedAnalysis === 'analyse globale' ? 'bg-[#2D4A3E] dark:bg-emerald-700 text-[#F5F0E8]' : 'bg-[#E8DFD0]/60 dark:bg-slate-800/80 hover:bg-[#E8DFD0] dark:hover:bg-slate-700 text-[#2D4A3E] dark:text-slate-200'}`}
                  >
                    <BarChart2 className="w-4 h-4" />
                    <span>Analyse globale</span>
                  </button>
                  <button 
                    onClick={() => {
                      setSelectedAnalysis('analyse par trimestre');
                      setIsRightDrawerOpen(false);
                    }}
                    className={`w-full text-left p-2.5 rounded-xl border border-[#2D4A3E]/30 dark:border-slate-700 font-bold transition-all flex items-center gap-2.5 cursor-pointer ${selectedAnalysis === 'analyse par trimestre' ? 'bg-[#2D4A3E] dark:bg-emerald-700 text-[#F5F0E8]' : 'bg-[#E8DFD0]/60 dark:bg-slate-800/80 hover:bg-[#E8DFD0] dark:hover:bg-slate-700 text-[#2D4A3E] dark:text-slate-200'}`}
                  >
                    <Calendar className="w-4 h-4" />
                    <span>Analyse par trimestre</span>
                  </button>
                  <button 
                    onClick={() => {
                      setSelectedAnalysis('analyse par matière');
                      setIsRightDrawerOpen(false);
                    }}
                    className={`w-full text-left p-2.5 rounded-xl border border-[#2D4A3E]/30 dark:border-slate-700 font-bold transition-all flex items-center gap-2.5 cursor-pointer ${selectedAnalysis === 'analyse par matière' ? 'bg-[#2D4A3E] dark:bg-emerald-700 text-[#F5F0E8]' : 'bg-[#E8DFD0]/60 dark:bg-slate-800/80 hover:bg-[#E8DFD0] dark:hover:bg-slate-700 text-[#2D4A3E] dark:text-slate-200'}`}
                  >
                    <FolderTree className="w-4 h-4" />
                    <span>Analyse par matière</span>
                  </button>
                  <button 
                    onClick={() => {
                      setSelectedAnalysis('analyse par note');
                      setIsRightDrawerOpen(false);
                    }}
                    className={`w-full text-left p-2.5 rounded-xl border border-[#2D4A3E]/30 dark:border-slate-700 font-bold transition-all flex items-center gap-2.5 cursor-pointer ${selectedAnalysis === 'analyse par note' ? 'bg-[#2D4A3E] dark:bg-emerald-700 text-[#F5F0E8]' : 'bg-[#E8DFD0]/60 dark:bg-slate-800/80 hover:bg-[#E8DFD0] dark:hover:bg-slate-700 text-[#2D4A3E] dark:text-slate-200'}`}
                  >
                    <Award className="w-4 h-4" />
                    <span>Analyse par note</span>
                  </button>
                </div>
              </div>

              <div className="pt-3 border-t border-[#2D4A3E]/20 dark:border-slate-800 text-center">
                <p className="text-[10px] text-[#5C6B5A] dark:text-slate-400">UniFolder Statut v1.0</p>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};


