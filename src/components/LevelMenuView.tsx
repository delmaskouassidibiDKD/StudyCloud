import React, { useState } from 'react';
import { ArrowLeft, Menu, X, BarChart2, Calendar, FolderTree, Award } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { ResponsiveContainer, BarChart as RechartsBarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell } from 'recharts';

interface LevelMenuViewProps {
  onBack: () => void;
}

const getStandardScale = () => {
  try {
    const s = localStorage.getItem('user_grades_standard_scale');
    if (s) return parseFloat(s) || 20;
  } catch (e) {}
  return 20;
};

const getTrimesterAverage = (trimestreKey: string, standardScale: number) => {
  try {
    const data = localStorage.getItem('user_grades_trimesters_data');
    if (data) {
      const parsed = JSON.parse(data);
      const items = parsed[trimestreKey];
      if (Array.isArray(items) && items.length > 0) {
        let totalW = 0;
        let totalC = 0;
        let hasAnyGrade = false;

        items.forEach((item: any) => {
          const subs = item.subGrades || [];
          if (subs.length > 0) {
            hasAnyGrade = true;
            let subW = 0;
            let subC = 0;
            subs.forEach((s: any) => {
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
              subW += norm * coeff;
              subC += coeff;
            });
            const itemAvg = subC > 0 ? subW / subC : 0;
            totalW += itemAvg * (Number(item.coefficient) || 1);
            totalC += Number(item.coefficient) || 1;
          }
        });

        if (hasAnyGrade && totalC > 0) {
          const avg = totalW / totalC;
          return Math.min(Math.max(avg, 0), standardScale);
        }
      }
    }
  } catch (e) {}
  return null;
};

export const LevelMenuView: React.FC<LevelMenuViewProps> = ({ onBack }) => {
  const [isRightDrawerOpen, setIsRightDrawerOpen] = useState(false);
  const [selectedAnalysis, setSelectedAnalysis] = useState<string>('analyse par trimestre');
  const [subjectTrimestre, setSubjectTrimestre] = useState<'1' | '2' | '3'>('1');
  const [noteTrimestre, setNoteTrimestre] = useState<'1' | '2' | '3'>('1');
  const [selectedNoteSubject, setSelectedNoteSubject] = useState<string>('');
  const [isNoteSubjectDropdownOpen, setIsNoteSubjectDropdownOpen] = useState(false);

  const standardScale = getStandardScale();
  const t1Avg = getTrimesterAverage('1', standardScale);
  const t2Avg = getTrimesterAverage('2', standardScale);
  const t3Avg = getTrimesterAverage('3', standardScale);

  const trimesterData = [
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
  ];

  const getSubjectsList = (trimKey: string) => {
    try {
      const data = localStorage.getItem('user_grades_trimesters_data');
      const trimData = data ? JSON.parse(data) : {};
      const items = trimData[trimKey] || [];
      return items.map((i: any) => i.subject || 'Matière');
    } catch (e) {}
    return ['Mathématiques', 'Physique', 'Anglais'];
  };

  const noteSubjects = getSubjectsList(noteTrimestre);
  const currentNoteSubject = noteSubjects.includes(selectedNoteSubject) ? selectedNoteSubject : (noteSubjects[0] || 'Matière');

  const cycleNoteSubject = () => {
    if (noteSubjects.length <= 1) return;
    const idx = noteSubjects.indexOf(currentNoteSubject);
    const nextIdx = (idx + 1) % noteSubjects.length;
    setSelectedNoteSubject(noteSubjects[nextIdx]);
  };

  const getNoteDataForSubject = (trimKey: string, subName: string, scale: number) => {
    try {
      const data = localStorage.getItem('user_grades_trimesters_data');
      const trimData = data ? JSON.parse(data) : {};
      const items = trimData[trimKey] || [];
      const item = items.find((i: any) => (i.subject || 'Matière') === subName);
      if (!item || !item.subGrades || item.subGrades.length === 0) {
        return [];
      }
      return item.subGrades.map((s: any, idx: number) => {
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
    } catch (e) {}
    return [];
  };

  const noteData = getNoteDataForSubject(noteTrimestre, currentNoteSubject, standardScale);

  const getSubjectAveragesForTrimester = (trimestreKey: string, scale: number) => {
    try {
      const data = localStorage.getItem('user_grades_trimesters_data');
      const trimData = data ? JSON.parse(data) : {};
      const items = trimData[trimestreKey] || [];

      if (!Array.isArray(items) || items.length === 0) {
        return [];
      }

      return items.map((item: any) => {
        const subName = item.subject || 'Matière';
        const subs = item.subGrades || [];
        
        if (!subs || subs.length === 0) {
          return {
            name: subName,
            count: 0,
            hasNote: false,
            displayLabel: 'Pas de note'
          };
        }

        let subW = 0;
        let subC = 0;
        let hasAnyGrade = false;

        subs.forEach((s: any) => {
          hasAnyGrade = true;
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
          const norm = max > 0 ? (val / max) * scale : val;
          subW += norm * coeff;
          subC += coeff;
        });

        if (hasAnyGrade && subC > 0) {
          const avg = subW / subC;
          const clamped = Math.min(Math.max(avg, 0), scale);
          return {
            name: subName,
            count: clamped,
            hasNote: true,
            displayLabel: `${clamped.toFixed(2).replace('.', ',')} / ${scale}`
          };
        }

        return {
          name: subName,
          count: 0,
          hasNote: false,
          displayLabel: 'Pas de note'
        };
      });
    } catch (e) {}
    return [];
  };

  const subjectData = getSubjectAveragesForTrimester(subjectTrimestre, standardScale);

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
    <div className="absolute inset-x-0 bottom-0 top-[56px] md:top-[60px] z-30 w-full bg-[#F5F0E8] text-[#2D4A3E] px-4 py-6 overflow-y-auto">
      <svg style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden' }}>
        <defs>
          {trimesterData.map((item, idx) => {
            const stops = getGradientStops(item.count, standardScale);
            return (
              <linearGradient key={`trim-grad-${idx}`} id={`trimGradient-${idx}`} x1="0" y1="1" x2="0" y2="0">
                {stops.map((s, sIdx) => (
                  <stop key={sIdx} offset={s.offset} stopColor={s.color} />
                ))}
              </linearGradient>
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

      <div className="fixed top-14 left-4 right-4 grid grid-cols-3 items-start z-40 pointer-events-none">
        <div className="flex flex-col items-start gap-1.5 pointer-events-auto justify-self-start">
          <button
            onClick={onBack}
            className="flex items-center gap-1 px-2.5 py-1 bg-[#E8DFD0] hover:bg-[#D4C9B5] text-[#2D4A3E] font-bold text-[10px] rounded-lg border-2 border-[#2D4A3E] shadow-[1px_1px_0px_0px_#1c1917] transition-all cursor-pointer active:translate-x-0.5 active:translate-y-0.5"
          >
            <ArrowLeft className="w-3 h-3" />
            <span>Retour</span>
          </button>

          {selectedAnalysis === 'analyse par matière' && (
            <div className="flex flex-row items-center gap-1 mt-0.5 whitespace-nowrap">
              {(['1', '2', '3'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setSubjectTrimestre(t)}
                  className={`px-2.5 py-1 text-xs font-bold rounded-lg border border-[#2D4A3E] transition-all cursor-pointer shadow-xs ${subjectTrimestre === t ? 'bg-[#2D4A3E] text-[#F5F0E8]' : 'bg-[#E8DFD0] text-[#2D4A3E] hover:bg-[#D4C9B5]'}`}
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
                    className={`px-2.5 py-1 text-xs font-bold rounded-lg border border-[#2D4A3E] transition-all cursor-pointer shadow-xs ${noteTrimestre === t ? 'bg-[#2D4A3E] text-[#F5F0E8]' : 'bg-[#E8DFD0] text-[#2D4A3E] hover:bg-[#D4C9B5]'}`}
                  >
                    Trimestre {t}
                  </button>
                ))}
              </div>
              <div className="flex relative">
                <button
                  onClick={() => setIsNoteSubjectDropdownOpen(!isNoteSubjectDropdownOpen)}
                  className="px-2.5 py-1 text-xs font-bold rounded-lg border border-[#2D4A3E] bg-[#E8DFD0] hover:bg-[#D4C9B5] text-[#2D4A3E] transition-all cursor-pointer shadow-xs flex items-center gap-1.5 whitespace-nowrap"
                  title="Sélectionner la matière"
                >
                  <span>Matière : {currentNoteSubject}</span>
                  <svg className={`w-3 h-3 transition-transform ${isNoteSubjectDropdownOpen ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="6 9 12 15 18 9"/></svg>
                </button>
                {isNoteSubjectDropdownOpen && (
                  <div className="absolute top-full left-0 mt-1 bg-[#F5F0E8] border-2 border-[#2D4A3E] rounded-lg shadow-lg z-50 min-w-[140px] py-1 max-h-48 overflow-y-auto">
                    {noteSubjects.map((sub, idx) => (
                      <button
                        key={idx}
                        onClick={() => {
                          setSelectedNoteSubject(sub);
                          setIsNoteSubjectDropdownOpen(false);
                        }}
                        className={`w-full text-left px-3 py-1.5 text-xs font-bold hover:bg-[#E8DFD0] transition-colors ${currentNoteSubject === sub ? 'bg-[#2D4A3E] text-[#F5F0E8]' : 'text-[#2D4A3E]'}`}
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
          <span className="font-serif font-bold text-xs sm:text-sm text-[#2D4A3E] capitalize px-2.5 py-1 bg-[#E8DFD0]/80 rounded-lg border border-[#2D4A3E]/30 shadow-xs whitespace-nowrap">
            {selectedAnalysis}
          </span>
        </div>

        <div className="flex justify-end pointer-events-auto justify-self-end">
          <button
            onClick={() => setIsRightDrawerOpen(true)}
            className="p-2 bg-[#E8DFD0] hover:bg-[#D4C9B5] text-[#2D4A3E] rounded-lg border-2 border-[#2D4A3E] shadow-[1px_1px_0px_0px_#1c1917] transition-all cursor-pointer active:translate-x-0.5 active:translate-y-0.5 flex items-center justify-center"
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

      <div className="w-full h-[calc(100vh-100px)] px-2 sm:px-4 pt-12 flex flex-col">
        {selectedAnalysis === 'analyse par trimestre' ? (
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
          </div>
        ) : (
          <div className="text-center py-24">
            <h2 className="text-xl font-serif font-bold text-[#2D4A3E] mb-2 capitalize">{selectedAnalysis}</h2>
            <p className="text-sm font-sans text-[#5C6B5A]">Affichage des données pour ce mode en cours de chargement...</p>
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
              className="absolute top-0 right-0 bottom-0 w-64 sm:w-72 bg-[#F5F0E8] border-l-2 border-[#2D4A3E] rounded-l-2xl shadow-2xl p-5 flex flex-col justify-between pointer-events-auto overflow-hidden"
            >
              <div>
                <div className="flex items-center justify-between pb-3 mb-5">
                  <h2 className="font-serif font-bold text-base text-[#2D4A3E]">Menu</h2>
                  <button
                    onClick={() => setIsRightDrawerOpen(false)}
                    className="p-1.5 hover:bg-[#E8DFD0] rounded-lg border border-[#2D4A3E] text-[#2D4A3E] transition-all cursor-pointer flex items-center justify-center"
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
                    className={`w-full text-left p-2.5 rounded-xl border border-[#2D4A3E]/30 font-bold transition-all flex items-center gap-2.5 cursor-pointer ${selectedAnalysis === 'analyse globale' ? 'bg-[#2D4A3E] text-[#F5F0E8]' : 'bg-[#E8DFD0]/60 hover:bg-[#E8DFD0] text-[#2D4A3E]'}`}
                  >
                    <BarChart2 className="w-4 h-4" />
                    <span>Analyse globale</span>
                  </button>
                  <button 
                    onClick={() => {
                      setSelectedAnalysis('analyse par trimestre');
                      setIsRightDrawerOpen(false);
                    }}
                    className={`w-full text-left p-2.5 rounded-xl border border-[#2D4A3E]/30 font-bold transition-all flex items-center gap-2.5 cursor-pointer ${selectedAnalysis === 'analyse par trimestre' ? 'bg-[#2D4A3E] text-[#F5F0E8]' : 'bg-[#E8DFD0]/60 hover:bg-[#E8DFD0] text-[#2D4A3E]'}`}
                  >
                    <Calendar className="w-4 h-4" />
                    <span>Analyse par trimestre</span>
                  </button>
                  <button 
                    onClick={() => {
                      setSelectedAnalysis('analyse par matière');
                      setIsRightDrawerOpen(false);
                    }}
                    className={`w-full text-left p-2.5 rounded-xl border border-[#2D4A3E]/30 font-bold transition-all flex items-center gap-2.5 cursor-pointer ${selectedAnalysis === 'analyse par matière' ? 'bg-[#2D4A3E] text-[#F5F0E8]' : 'bg-[#E8DFD0]/60 hover:bg-[#E8DFD0] text-[#2D4A3E]'}`}
                  >
                    <FolderTree className="w-4 h-4" />
                    <span>Analyse par matière</span>
                  </button>
                  <button 
                    onClick={() => {
                      setSelectedAnalysis('analyse par note');
                      setIsRightDrawerOpen(false);
                    }}
                    className={`w-full text-left p-2.5 rounded-xl border border-[#2D4A3E]/30 font-bold transition-all flex items-center gap-2.5 cursor-pointer ${selectedAnalysis === 'analyse par note' ? 'bg-[#2D4A3E] text-[#F5F0E8]' : 'bg-[#E8DFD0]/60 hover:bg-[#E8DFD0] text-[#2D4A3E]'}`}
                  >
                    <Award className="w-4 h-4" />
                    <span>Analyse par note</span>
                  </button>
                </div>
              </div>

              <div className="pt-3 border-t border-[#2D4A3E]/20 text-center">
                <p className="text-[10px] text-[#5C6B5A]">UniFolder Statut v1.0</p>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};


