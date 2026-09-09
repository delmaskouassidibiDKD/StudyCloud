import React, { useState, useMemo } from 'react';
import {
  ArrowLeft,
  RotateCcw,
  History,
  TrendingUp,
  ArrowLeftRight,
  Calculator,
  DollarSign,
  PieChart,
  ChevronDown,
  Sparkles,
  Delete,
  Check,
  Copy,
  X
} from 'lucide-react';
import { evaluate, format } from 'mathjs';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine
} from 'recharts';

interface CalculatorMenuViewProps {
  onBack: () => void;
}

type Mode = 'scientific' | 'graphing' | 'converter' | 'finance';

export const CalculatorMenuView: React.FC<CalculatorMenuViewProps> = ({ onBack }) => {
  const [activeMode, setActiveMode] = useState<Mode>('scientific');

  // ---------------- 1. SCIENTIFIC STATE ----------------
  const [expression, setExpression] = useState('');
  const [result, setResult] = useState('');
  const [lastAns, setLastAns] = useState('0');
  const [isShift, setIsShift] = useState(false);
  const [angleMode, setAngleMode] = useState<'DEG' | 'RAD'>('DEG');
  const [memory, setMemory] = useState<number>(0);
  const [history, setHistory] = useState<{ expr: string; res: string }[]>([]);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  // ---------------- 2. GRAPHING STATE ----------------
  const [graphFunction, setGraphFunction] = useState('x^2 - 4');
  const [xMin, setXMin] = useState(-10);
  const [xMax, setXMax] = useState(10);
  const [graphStep, setGraphStep] = useState(0.5);

  // ---------------- 3. CONVERTER STATE ----------------
  const [convType, setConvType] = useState<'length' | 'mass' | 'temp' | 'data' | 'speed' | 'currency'>('length');
  const [convVal, setConvVal] = useState<string>('1');
  const [fromUnit, setFromUnit] = useState<string>('m');
  const [toUnit, setToUnit] = useState<string>('km');

  // ---------------- 4. FINANCE STATE ----------------
  const [loanAmount, setLoanAmount] = useState<string>('100000');
  const [loanRate, setLoanRate] = useState<string>('4.5');
  const [loanYears, setLoanYears] = useState<string>('15');

  const [discountPrice, setDiscountPrice] = useState<string>('15000');
  const [discountPercent, setDiscountPercent] = useState<string>('20');

  // Helper for expression append
  const appendVal = (val: string) => {
    setExpression(prev => prev + val);
    setIsShift(false);
    tryEval(expression + val);
  };

  const handleDelete = () => {
    const updated = expression.slice(0, -1);
    setExpression(updated);
    tryEval(updated);
  };

  const handleClear = () => {
    setExpression('');
    setResult('');
  };

  const tryEval = (exprToEval: string) => {
    if (!exprToEval.trim()) {
      setResult('');
      return;
    }
    try {
      let expr = exprToEval
        .replace(/×/g, '*')
        .replace(/÷/g, '/')
        .replace(/π/g, 'pi')
        .replace(/√\(/g, 'sqrt(')
        .replace(/Ans/g, lastAns);

      if (angleMode === 'DEG') {
        expr = expr
          .replace(/sin\(([^)]+)\)/g, 'sin(($1) deg)')
          .replace(/cos\(([^)]+)\)/g, 'cos(($1) deg)')
          .replace(/tan\(([^)]+)\)/g, 'tan(($1) deg)')
          .replace(/asin\(([^)]+)\)/g, 'asin($1) / deg')
          .replace(/acos\(([^)]+)\)/g, 'acos($1) / deg')
          .replace(/atan\(([^)]+)\)/g, 'atan($1) / deg');
      }

      const rawRes = evaluate(expr);
      if (typeof rawRes === 'number' && !isNaN(rawRes) && isFinite(rawRes)) {
        setResult(format(rawRes, { precision: 10 }));
      }
    } catch {
      // Don't overwrite result if incomplete syntax while typing
    }
  };

  const handleCalculate = () => {
    if (!expression.trim()) return;
    try {
      let expr = expression
        .replace(/×/g, '*')
        .replace(/÷/g, '/')
        .replace(/π/g, 'pi')
        .replace(/√\(/g, 'sqrt(')
        .replace(/Ans/g, lastAns);

      if (angleMode === 'DEG') {
        expr = expr
          .replace(/sin\(([^)]+)\)/g, 'sin(($1) deg)')
          .replace(/cos\(([^)]+)\)/g, 'cos(($1) deg)')
          .replace(/tan\(([^)]+)\)/g, 'tan(($1) deg)')
          .replace(/asin\(([^)]+)\)/g, 'asin($1) / deg')
          .replace(/acos\(([^)]+)\)/g, 'acos($1) / deg')
          .replace(/atan\(([^)]+)\)/g, 'atan($1) / deg');
      }

      const rawRes = evaluate(expr);
      let formattedRes = '';

      if (typeof rawRes === 'number') {
        if (isNaN(rawRes)) formattedRes = 'Erreur';
        else if (!isFinite(rawRes)) formattedRes = 'Infini';
        else formattedRes = format(rawRes, { precision: 10 });
      } else if (rawRes !== undefined && rawRes !== null) {
        formattedRes = String(rawRes);
      } else {
        formattedRes = '0';
      }

      setResult(formattedRes);
      if (formattedRes !== 'Erreur') {
        setLastAns(formattedRes);
        setHistory(prev => [{ expr: expression, res: formattedRes }, ...prev.slice(0, 24)]);
      }
    } catch {
      setResult('Erreur de syntaxe');
    }
  };

  // Memory functions
  const handleMemoryAdd = () => {
    try {
      const currentVal = parseFloat(result || expression) || 0;
      setMemory(prev => prev + currentVal);
    } catch {
      // ignore
    }
  };

  const handleMemorySub = () => {
    try {
      const currentVal = parseFloat(result || expression) || 0;
      setMemory(prev => prev - currentVal);
    } catch {
      // ignore
    }
  };

  // Graph Data Computation
  const graphData = useMemo(() => {
    const data: { x: number; y: number }[] = [];
    if (!graphFunction.trim()) return data;

    try {
      const step = Math.max(0.1, graphStep);
      for (let x = xMin; x <= xMax; x += step) {
        const roundX = Math.round(x * 100) / 100;
        let expr = graphFunction
          .replace(/x/g, `(${roundX})`)
          .replace(/×/g, '*')
          .replace(/÷/g, '/');
        const val = evaluate(expr);
        if (typeof val === 'number' && !isNaN(val) && isFinite(val) && Math.abs(val) < 1000) {
          data.push({ x: roundX, y: Math.round(val * 100) / 100 });
        }
      }
    } catch {
      // Ignore evaluation error for incomplete functions
    }
    return data;
  }, [graphFunction, xMin, xMax, graphStep]);

  // Converter Logic
  const convertedResult = useMemo(() => {
    const num = parseFloat(convVal);
    if (isNaN(num)) return '0';

    if (convType === 'length') {
      const toMeters: Record<string, number> = {
        mm: 0.001, cm: 0.01, m: 1, km: 1000, inch: 0.0254, ft: 0.3048, mi: 1609.34
      };
      const meters = num * (toMeters[fromUnit] || 1);
      const res = meters / (toMeters[toUnit] || 1);
      return res.toLocaleString('fr-FR', { maximumFractionDigits: 6 });
    }

    if (convType === 'mass') {
      const toGrams: Record<string, number> = {
        mg: 0.001, g: 1, kg: 1000, lb: 453.592, oz: 28.3495
      };
      const grams = num * (toGrams[fromUnit] || 1);
      const res = grams / (toGrams[toUnit] || 1);
      return res.toLocaleString('fr-FR', { maximumFractionDigits: 6 });
    }

    if (convType === 'temp') {
      let celsius = num;
      if (fromUnit === '°F') celsius = (num - 32) * (5 / 9);
      if (fromUnit === 'K') celsius = num - 273.15;

      let res = celsius;
      if (toUnit === '°F') res = (celsius * 9 / 5) + 32;
      if (toUnit === 'K') res = celsius + 273.15;
      return res.toFixed(2);
    }

    if (convType === 'data') {
      const toBytes: Record<string, number> = {
        B: 1, KB: 1024, MB: 1024 ** 2, GB: 1024 ** 3, TB: 1024 ** 4
      };
      const bytes = num * (toBytes[fromUnit] || 1);
      const res = bytes / (toBytes[toUnit] || 1);
      return res.toLocaleString('fr-FR', { maximumFractionDigits: 6 });
    }

    if (convType === 'currency') {
      const rates: Record<string, number> = {
        EUR: 1, USD: 1.08, GBP: 0.85, CAD: 1.47, XOF: 655.95, JPY: 162.5
      };
      const eur = num / (rates[fromUnit] || 1);
      const res = eur * (rates[toUnit] || 1);
      return res.toLocaleString('fr-FR', { maximumFractionDigits: 2 });
    }

    return String(num);
  }, [convType, convVal, fromUnit, toUnit]);

  // Loan computation
  const loanSummary = useMemo(() => {
    const P = parseFloat(loanAmount);
    const annualRate = parseFloat(loanRate);
    const years = parseFloat(loanYears);

    if (isNaN(P) || isNaN(annualRate) || isNaN(years) || P <= 0 || annualRate <= 0 || years <= 0) {
      return { monthly: '0', totalInterest: '0', totalCost: '0' };
    }

    const r = (annualRate / 100) / 12;
    const n = years * 12;
    const monthly = (P * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
    const totalCost = monthly * n;
    const totalInterest = totalCost - P;

    return {
      monthly: Math.round(monthly).toLocaleString('fr-FR'),
      totalInterest: Math.round(totalInterest).toLocaleString('fr-FR'),
      totalCost: Math.round(totalCost).toLocaleString('fr-FR')
    };
  }, [loanAmount, loanRate, loanYears]);

  // Discount computation
  const discountSummary = useMemo(() => {
    const p = parseFloat(discountPrice);
    const d = parseFloat(discountPercent);

    if (isNaN(p) || isNaN(d)) return { saved: '0', final: '0' };

    const saved = p * (d / 100);
    const final = p - saved;

    return {
      saved: saved.toLocaleString('fr-FR', { maximumFractionDigits: 2 }),
      final: final.toLocaleString('fr-FR', { maximumFractionDigits: 2 })
    };
  }, [discountPrice, discountPercent]);

  return (
    <div className="absolute inset-x-0 bottom-0 top-[56px] md:top-[60px] md:left-64 z-30 w-full md:w-[calc(100%-16rem)] bg-stone-950 text-white px-2 sm:px-4 pt-4 pb-44 sm:pb-48 overflow-y-auto min-h-screen">
      

      {/* APP HEADER */}
      <div className="max-w-md mx-auto mb-4 flex items-center justify-between">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-stone-800 hover:bg-stone-700 text-stone-200 font-bold text-xs rounded-xl border-2 border-stone-700 shadow-[2px_2px_0px_0px_#000] transition-all cursor-pointer active:translate-x-0.5 active:translate-y-0.5"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Retour</span>
        </button>

        <div className="flex items-center gap-1 bg-stone-900 px-3.5 py-1 rounded-full border border-stone-800">
          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
          <span className="text-xs font-mono font-bold text-amber-400 tracking-wider">
            Calculatrice
          </span>
        </div>

        {activeMode === 'scientific' && (
          <div className="relative">
            <button
              onClick={() => setShowHistoryModal(!showHistoryModal)}
              className="flex items-center gap-1 px-3 py-1.5 bg-stone-800 hover:bg-stone-700 text-stone-200 font-bold text-xs rounded-xl border-2 border-stone-700 shadow-[2px_2px_0px_0px_#000] transition-all cursor-pointer active:translate-x-0.5 active:translate-y-0.5"
            >
              <History className="w-3.5 h-3.5 text-amber-400" />
              <span>Historique</span>
            </button>

            {/* FLOATING POPOVER DROPDOWN (Anchored right next to Historique button) */}
            {showHistoryModal && (
              <div className="absolute right-0 top-full mt-2 w-72 sm:w-80 md:w-96 z-50 bg-stone-900/98 backdrop-blur-md border-2 border-stone-700 rounded-2xl p-3 shadow-2xl font-mono text-xs animate-in fade-in zoom-in duration-150">
                <div className="flex items-center justify-between mb-2 pb-2 border-b border-stone-800">
                  <div className="flex items-center gap-1.5">
                    <History className="w-3.5 h-3.5 text-amber-400" />
                    <span className="font-bold text-stone-200 text-xs">Historique ({history.length})</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {history.length > 0 && (
                      <button
                        onClick={() => setHistory([])}
                        className="text-stone-400 hover:text-red-400 text-[10px] uppercase font-bold cursor-pointer mr-1"
                      >
                        Effacer
                      </button>
                    )}
                    <button
                      onClick={() => setShowHistoryModal(false)}
                      className="p-1 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-300 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {history.length === 0 ? (
                  <p className="text-stone-500 italic text-center py-4 text-[11px]">Aucun calcul récent</p>
                ) : (
                  <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
                    {history.map((h, i) => (
                      <div
                        key={i}
                        className="p-2 bg-stone-800/90 hover:bg-stone-800 rounded-xl flex items-center justify-between border border-stone-700/60 transition-colors"
                      >
                        <div
                          onClick={() => {
                            setExpression(h.expr);
                            setResult(h.res);
                            setShowHistoryModal(false);
                          }}
                          className="flex-1 cursor-pointer overflow-hidden mr-2"
                        >
                          <div className="text-stone-400 text-[11px] truncate">{h.expr}</div>
                          <div className="text-amber-400 font-bold text-xs truncate">= {h.res}</div>
                        </div>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(h.res);
                            setCopiedIndex(i);
                            setTimeout(() => setCopiedIndex(null), 1500);
                          }}
                          className="p-1.5 text-stone-400 hover:text-white bg-stone-700/50 hover:bg-stone-700 rounded-lg cursor-pointer transition-colors shrink-0"
                          title="Copier le résultat"
                        >
                          {copiedIndex === i ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* MODE TABS (Scientifique, Graphique, Convertisseur, Finance) */}
      <div className="max-w-md mx-auto mb-4 bg-stone-900/90 p-1.5 rounded-2xl border-2 border-stone-800 shadow-[0_4px_0_0_#000] flex items-center gap-1.5">
        <button
          onClick={() => setActiveMode('scientific')}
          className={`flex-1 py-2 px-1.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1 cursor-pointer ${
            activeMode === 'scientific'
              ? 'bg-gradient-to-b from-[#18568A] to-[#0e3658] text-white border-t border-[#4388c4] border-b-3 border-[#061929] shadow-[0_2px_0_0_#000]'
              : 'text-stone-400 hover:text-stone-200 bg-stone-800/60 border-t border-stone-700 border-b-2 border-stone-950 hover:bg-stone-800'
          }`}
        >
          <Calculator className="w-3.5 h-3.5" />
          <span>Calcul</span>
        </button>

        <button
          onClick={() => setActiveMode('graphing')}
          className={`flex-1 py-2 px-1.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1 cursor-pointer ${
            activeMode === 'graphing'
              ? 'bg-gradient-to-b from-[#18568A] to-[#0e3658] text-white border-t border-[#4388c4] border-b-3 border-[#061929] shadow-[0_2px_0_0_#000]'
              : 'text-stone-400 hover:text-stone-200 bg-stone-800/60 border-t border-stone-700 border-b-2 border-stone-950 hover:bg-stone-800'
          }`}
        >
          <TrendingUp className="w-3.5 h-3.5" />
          <span>Graphe</span>
        </button>

        <button
          onClick={() => setActiveMode('converter')}
          className={`flex-1 py-2 px-1.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1 cursor-pointer ${
            activeMode === 'converter'
              ? 'bg-gradient-to-b from-[#18568A] to-[#0e3658] text-white border-t border-[#4388c4] border-b-3 border-[#061929] shadow-[0_2px_0_0_#000]'
              : 'text-stone-400 hover:text-stone-200 bg-stone-800/60 border-t border-stone-700 border-b-2 border-stone-950 hover:bg-stone-800'
          }`}
        >
          <ArrowLeftRight className="w-3.5 h-3.5" />
          <span>Unités</span>
        </button>

        <button
          onClick={() => setActiveMode('finance')}
          className={`flex-1 py-2 px-1.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1 cursor-pointer ${
            activeMode === 'finance'
              ? 'bg-gradient-to-b from-[#18568A] to-[#0e3658] text-white border-t border-[#4388c4] border-b-3 border-[#061929] shadow-[0_2px_0_0_#000]'
              : 'text-stone-400 hover:text-stone-200 bg-stone-800/60 border-t border-stone-700 border-b-2 border-stone-950 hover:bg-stone-800'
          }`}
        >
          <DollarSign className="w-3.5 h-3.5" />
          <span>Finance</span>
        </button>
      </div>

      <div className="max-w-md mx-auto">
        
        {/* ==================== MODE 1: SCIENTIFIC ==================== */}
        {activeMode === 'scientific' && (
          <div className="space-y-3">
            
            {/* AUTHENTIC CASIO LCD DISPLAY SCREEN */}
            <div className="bg-[#c2d3bd] text-[#0f2212] rounded-2xl p-4 sm:p-5 border-4 border-stone-800 shadow-[inset_0px_3px_10px_rgba(0,0,0,0.5),3px_3px_0px_0px_#000] font-mono h-32 sm:h-36 flex flex-col justify-between relative overflow-hidden select-none">
              
              {/* LCD Status Header */}
              <div className="flex items-center justify-between text-[11px] font-extrabold tracking-widest text-[#1c3a21] opacity-90 border-b border-[#a3b89e] pb-1">
                <div className="flex items-center gap-2">
                  <span className="opacity-75">NORM</span>
                  <span className="opacity-75">MATH</span>
                  <span className="opacity-75">DECI</span>
                </div>
                <div className="flex items-center gap-2">
                  {isShift && <span className="bg-[#0f2212] text-[#c2d3bd] px-1 rounded text-[9px]">S</span>}
                  <span className="bg-[#0f2212]/15 px-1.5 py-0.2 rounded">{angleMode}</span>
                  {memory !== 0 && <span className="bg-[#0f2212]/15 px-1 rounded">M</span>}
                </div>
              </div>

              {/* Expression Input Area (Top Left / Natural Layout like CalcES) */}
              <div className="text-left text-lg sm:text-xl font-bold tracking-wider break-all min-h-[30px] my-1 text-[#0f2212]">
                {expression || '0'}
              </div>

              {/* Live Result Output (Bottom Right like CalcES) */}
              <div className="text-right text-3xl sm:text-4xl font-extrabold tracking-tight text-[#0a190d]">
                {result ? result : ''}
              </div>
            </div>

            {/* KEYPAD WITH TACTILE 3D KEYS */}
            <div className="bg-stone-900/90 p-3 rounded-3xl border-3 border-stone-800 shadow-[5px_5px_0px_0px_#000] space-y-2.5">
              
              {/* Row 1: Memory & Modes */}
              <div className="grid grid-cols-5 gap-1.5">
                <button
                  onClick={() => setIsShift(!isShift)}
                  className={`p-2.5 text-xs font-black rounded-xl border-t border-b-4 transition-all cursor-pointer ${
                    isShift
                      ? 'bg-gradient-to-b from-amber-300 to-amber-500 text-stone-950 border-t-amber-200 border-b-amber-700 shadow-[0_4px_0_0_#000,inset_0_1px_0_0_rgba(255,255,255,0.5)] active:translate-y-1 active:border-b-2 active:shadow-none'
                      : 'bg-gradient-to-b from-stone-800 to-stone-900 text-amber-400 border-t-stone-600 border-b-stone-950 shadow-[0_4px_0_0_#000,inset_0_1px_0_0_rgba(255,255,255,0.12)] active:translate-y-1 active:border-b-2 active:shadow-none'
                  }`}
                >
                  SHIFT
                </button>
                <button
                  onClick={() => setAngleMode(angleMode === 'DEG' ? 'RAD' : 'DEG')}
                  className="p-2.5 bg-gradient-to-b from-stone-800 to-stone-900 hover:from-stone-750 hover:to-stone-850 text-cyan-400 text-xs font-bold rounded-xl border-t border-stone-600 border-b-4 border-stone-950 shadow-[0_4px_0_0_#000,inset_0_1px_0_0_rgba(255,255,255,0.12)] active:translate-y-1 active:border-b-2 active:shadow-none transition-all cursor-pointer"
                >
                  {angleMode}
                </button>
                <button
                  onClick={handleMemoryAdd}
                  className="p-2.5 bg-gradient-to-b from-stone-800 to-stone-900 hover:from-stone-750 hover:to-stone-850 text-emerald-400 text-xs font-bold rounded-xl border-t border-stone-600 border-b-4 border-stone-950 shadow-[0_4px_0_0_#000,inset_0_1px_0_0_rgba(255,255,255,0.12)] active:translate-y-1 active:border-b-2 active:shadow-none transition-all cursor-pointer"
                  title="M+ Ajouter à la mémoire"
                >
                  M+
                </button>
                <button
                  onClick={handleMemorySub}
                  className="p-2.5 bg-gradient-to-b from-stone-800 to-stone-900 hover:from-stone-750 hover:to-stone-850 text-emerald-400 text-xs font-bold rounded-xl border-t border-stone-600 border-b-4 border-stone-950 shadow-[0_4px_0_0_#000,inset_0_1px_0_0_rgba(255,255,255,0.12)] active:translate-y-1 active:border-b-2 active:shadow-none transition-all cursor-pointer"
                  title="M- Soustraire de la mémoire"
                >
                  M-
                </button>
                <button
                  onClick={() => setMemory(0)}
                  className="p-2.5 bg-gradient-to-b from-stone-800 to-stone-900 hover:from-stone-750 hover:to-stone-850 text-stone-400 text-xs font-bold rounded-xl border-t border-stone-600 border-b-4 border-stone-950 shadow-[0_4px_0_0_#000,inset_0_1px_0_0_rgba(255,255,255,0.12)] active:translate-y-1 active:border-b-2 active:shadow-none transition-all cursor-pointer"
                  title="MC Effacer la mémoire"
                >
                  MC
                </button>
              </div>

              {/* Row 2: Trig Functions */}
              <div className="grid grid-cols-5 gap-1.5">
                <button
                  onClick={() => appendVal(isShift ? 'asin(' : 'sin(')}
                  className="p-2.5 bg-gradient-to-b from-stone-800 to-stone-900 hover:from-stone-750 hover:to-stone-850 text-stone-200 text-xs font-bold rounded-xl border-t border-stone-600 border-b-4 border-stone-950 shadow-[0_4px_0_0_#000,inset_0_1px_0_0_rgba(255,255,255,0.12)] active:translate-y-1 active:border-b-2 active:shadow-none transition-all cursor-pointer"
                >
                  {isShift ? 'sin⁻¹' : 'sin'}
                </button>
                <button
                  onClick={() => appendVal(isShift ? 'acos(' : 'cos(')}
                  className="p-2.5 bg-gradient-to-b from-stone-800 to-stone-900 hover:from-stone-750 hover:to-stone-850 text-stone-200 text-xs font-bold rounded-xl border-t border-stone-600 border-b-4 border-stone-950 shadow-[0_4px_0_0_#000,inset_0_1px_0_0_rgba(255,255,255,0.12)] active:translate-y-1 active:border-b-2 active:shadow-none transition-all cursor-pointer"
                >
                  {isShift ? 'cos⁻¹' : 'cos'}
                </button>
                <button
                  onClick={() => appendVal(isShift ? 'atan(' : 'tan(')}
                  className="p-2.5 bg-gradient-to-b from-stone-800 to-stone-900 hover:from-stone-750 hover:to-stone-850 text-stone-200 text-xs font-bold rounded-xl border-t border-stone-600 border-b-4 border-stone-950 shadow-[0_4px_0_0_#000,inset_0_1px_0_0_rgba(255,255,255,0.12)] active:translate-y-1 active:border-b-2 active:shadow-none transition-all cursor-pointer"
                >
                  {isShift ? 'tan⁻¹' : 'tan'}
                </button>
                <button
                  onClick={() => appendVal('(')}
                  className="p-2.5 bg-gradient-to-b from-stone-800 to-stone-900 hover:from-stone-750 hover:to-stone-850 text-stone-300 text-sm font-bold rounded-xl border-t border-stone-600 border-b-4 border-stone-950 shadow-[0_4px_0_0_#000,inset_0_1px_0_0_rgba(255,255,255,0.12)] active:translate-y-1 active:border-b-2 active:shadow-none transition-all cursor-pointer"
                >
                  (
                </button>
                <button
                  onClick={() => appendVal(')')}
                  className="p-2.5 bg-gradient-to-b from-stone-800 to-stone-900 hover:from-stone-750 hover:to-stone-850 text-stone-300 text-sm font-bold rounded-xl border-t border-stone-600 border-b-4 border-stone-950 shadow-[0_4px_0_0_#000,inset_0_1px_0_0_rgba(255,255,255,0.12)] active:translate-y-1 active:border-b-2 active:shadow-none transition-all cursor-pointer"
                >
                  )
                </button>
              </div>

              {/* Row 3: Powers & Roots */}
              <div className="grid grid-cols-5 gap-1.5">
                <button
                  onClick={() => appendVal(isShift ? '^3' : '^2')}
                  className="p-2.5 bg-gradient-to-b from-stone-800 to-stone-900 hover:from-stone-750 hover:to-stone-850 text-stone-200 text-xs font-bold rounded-xl border-t border-stone-600 border-b-4 border-stone-950 shadow-[0_4px_0_0_#000,inset_0_1px_0_0_rgba(255,255,255,0.12)] active:translate-y-1 active:border-b-2 active:shadow-none transition-all cursor-pointer"
                >
                  {isShift ? 'x³' : 'x²'}
                </button>
                <button
                  onClick={() => appendVal('^')}
                  className="p-2.5 bg-gradient-to-b from-stone-800 to-stone-900 hover:from-stone-750 hover:to-stone-850 text-stone-200 text-xs font-bold rounded-xl border-t border-stone-600 border-b-4 border-stone-950 shadow-[0_4px_0_0_#000,inset_0_1px_0_0_rgba(255,255,255,0.12)] active:translate-y-1 active:border-b-2 active:shadow-none transition-all cursor-pointer"
                >
                  xʸ
                </button>
                <button
                  onClick={() => appendVal('sqrt(')}
                  className="p-2.5 bg-gradient-to-b from-stone-800 to-stone-900 hover:from-stone-750 hover:to-stone-850 text-stone-200 text-xs font-bold rounded-xl border-t border-stone-600 border-b-4 border-stone-950 shadow-[0_4px_0_0_#000,inset_0_1px_0_0_rgba(255,255,255,0.12)] active:translate-y-1 active:border-b-2 active:shadow-none transition-all cursor-pointer"
                >
                  √
                </button>
                <button
                  onClick={() => appendVal(isShift ? '10^(' : 'log(')}
                  className="p-2.5 bg-gradient-to-b from-stone-800 to-stone-900 hover:from-stone-750 hover:to-stone-850 text-stone-200 text-xs font-bold rounded-xl border-t border-stone-600 border-b-4 border-stone-950 shadow-[0_4px_0_0_#000,inset_0_1px_0_0_rgba(255,255,255,0.12)] active:translate-y-1 active:border-b-2 active:shadow-none transition-all cursor-pointer"
                >
                  {isShift ? '10ˣ' : 'log'}
                </button>
                <button
                  onClick={() => appendVal(isShift ? 'e^(' : 'log(')}
                  className="p-2.5 bg-gradient-to-b from-stone-800 to-stone-900 hover:from-stone-750 hover:to-stone-850 text-stone-200 text-xs font-bold rounded-xl border-t border-stone-600 border-b-4 border-stone-950 shadow-[0_4px_0_0_#000,inset_0_1px_0_0_rgba(255,255,255,0.12)] active:translate-y-1 active:border-b-2 active:shadow-none transition-all cursor-pointer"
                >
                  {isShift ? 'eˣ' : 'ln'}
                </button>
              </div>

              {/* Row 4: Constants & DEL/AC */}
              <div className="grid grid-cols-5 gap-1.5">
                <button
                  onClick={() => appendVal('π')}
                  className="p-2.5 bg-gradient-to-b from-stone-800 to-stone-900 hover:from-stone-750 hover:to-stone-850 text-stone-200 text-sm font-bold rounded-xl border-t border-stone-600 border-b-4 border-stone-950 shadow-[0_4px_0_0_#000,inset_0_1px_0_0_rgba(255,255,255,0.12)] active:translate-y-1 active:border-b-2 active:shadow-none transition-all cursor-pointer"
                >
                  π
                </button>
                <button
                  onClick={() => appendVal('e')}
                  className="p-2.5 bg-gradient-to-b from-stone-800 to-stone-900 hover:from-stone-750 hover:to-stone-850 text-stone-200 text-sm font-bold rounded-xl border-t border-stone-600 border-b-4 border-stone-950 shadow-[0_4px_0_0_#000,inset_0_1px_0_0_rgba(255,255,255,0.12)] active:translate-y-1 active:border-b-2 active:shadow-none transition-all cursor-pointer"
                >
                  e
                </button>
                <button
                  onClick={() => appendVal('!')}
                  className="p-2.5 bg-gradient-to-b from-stone-800 to-stone-900 hover:from-stone-750 hover:to-stone-850 text-stone-200 text-xs font-bold rounded-xl border-t border-stone-600 border-b-4 border-stone-950 shadow-[0_4px_0_0_#000,inset_0_1px_0_0_rgba(255,255,255,0.12)] active:translate-y-1 active:border-b-2 active:shadow-none transition-all cursor-pointer"
                >
                  x!
                </button>
                <button
                  onClick={handleDelete}
                  className="p-2.5 bg-gradient-to-b from-red-800 to-red-950 hover:from-red-700 hover:to-red-900 text-red-200 text-xs font-black rounded-xl border-t border-red-500 border-b-4 border-red-950 shadow-[0_4px_0_0_#000,inset_0_1px_0_0_rgba(255,255,255,0.2)] active:translate-y-1 active:border-b-2 active:shadow-none transition-all cursor-pointer flex items-center justify-center"
                >
                  DEL
                </button>
                <button
                  onClick={handleClear}
                  className="p-2.5 bg-gradient-to-b from-orange-500 to-orange-700 hover:from-orange-400 hover:to-orange-600 text-white font-black text-xs rounded-xl border-t border-orange-300 border-b-4 border-orange-950 shadow-[0_4px_0_0_#000,inset_0_1px_0_0_rgba(255,255,255,0.3)] active:translate-y-1 active:border-b-2 active:shadow-none transition-all cursor-pointer"
                >
                  AC
                </button>
              </div>

              {/* Main Numeric Grid */}
              <div className="grid grid-cols-4 gap-1.5 pt-2.5 border-t border-stone-800">
                <button onClick={() => appendVal('7')} className="p-3.5 bg-gradient-to-b from-stone-700 to-stone-850 hover:from-stone-650 hover:to-stone-800 text-white font-black text-xl rounded-2xl border-t border-stone-500 border-b-4 border-stone-950 shadow-[0_4px_0_0_#000,inset_0_1px_0_0_rgba(255,255,255,0.15)] active:translate-y-1 active:border-b-2 active:shadow-none transition-all cursor-pointer">7</button>
                <button onClick={() => appendVal('8')} className="p-3.5 bg-gradient-to-b from-stone-700 to-stone-850 hover:from-stone-650 hover:to-stone-800 text-white font-black text-xl rounded-2xl border-t border-stone-500 border-b-4 border-stone-950 shadow-[0_4px_0_0_#000,inset_0_1px_0_0_rgba(255,255,255,0.15)] active:translate-y-1 active:border-b-2 active:shadow-none transition-all cursor-pointer">8</button>
                <button onClick={() => appendVal('9')} className="p-3.5 bg-gradient-to-b from-stone-700 to-stone-850 hover:from-stone-650 hover:to-stone-800 text-white font-black text-xl rounded-2xl border-t border-stone-500 border-b-4 border-stone-950 shadow-[0_4px_0_0_#000,inset_0_1px_0_0_rgba(255,255,255,0.15)] active:translate-y-1 active:border-b-2 active:shadow-none transition-all cursor-pointer">9</button>
                <button onClick={() => appendVal('÷')} className="p-3.5 bg-gradient-to-b from-amber-600 to-amber-800 hover:from-amber-500 hover:to-amber-700 text-amber-100 font-black text-2xl rounded-2xl border-t border-amber-400 border-b-4 border-amber-950 shadow-[0_4px_0_0_#000,inset_0_1px_0_0_rgba(255,255,255,0.25)] active:translate-y-1 active:border-b-2 active:shadow-none transition-all cursor-pointer">÷</button>

                <button onClick={() => appendVal('4')} className="p-3.5 bg-gradient-to-b from-stone-700 to-stone-850 hover:from-stone-650 hover:to-stone-800 text-white font-black text-xl rounded-2xl border-t border-stone-500 border-b-4 border-stone-950 shadow-[0_4px_0_0_#000,inset_0_1px_0_0_rgba(255,255,255,0.15)] active:translate-y-1 active:border-b-2 active:shadow-none transition-all cursor-pointer">4</button>
                <button onClick={() => appendVal('5')} className="p-3.5 bg-gradient-to-b from-stone-700 to-stone-850 hover:from-stone-650 hover:to-stone-800 text-white font-black text-xl rounded-2xl border-t border-stone-500 border-b-4 border-stone-950 shadow-[0_4px_0_0_#000,inset_0_1px_0_0_rgba(255,255,255,0.15)] active:translate-y-1 active:border-b-2 active:shadow-none transition-all cursor-pointer">5</button>
                <button onClick={() => appendVal('6')} className="p-3.5 bg-gradient-to-b from-stone-700 to-stone-850 hover:from-stone-650 hover:to-stone-800 text-white font-black text-xl rounded-2xl border-t border-stone-500 border-b-4 border-stone-950 shadow-[0_4px_0_0_#000,inset_0_1px_0_0_rgba(255,255,255,0.15)] active:translate-y-1 active:border-b-2 active:shadow-none transition-all cursor-pointer">6</button>
                <button onClick={() => appendVal('×')} className="p-3.5 bg-gradient-to-b from-amber-600 to-amber-800 hover:from-amber-500 hover:to-amber-700 text-amber-100 font-black text-2xl rounded-2xl border-t border-amber-400 border-b-4 border-amber-950 shadow-[0_4px_0_0_#000,inset_0_1px_0_0_rgba(255,255,255,0.25)] active:translate-y-1 active:border-b-2 active:shadow-none transition-all cursor-pointer">×</button>

                <button onClick={() => appendVal('1')} className="p-3.5 bg-gradient-to-b from-stone-700 to-stone-850 hover:from-stone-650 hover:to-stone-800 text-white font-black text-xl rounded-2xl border-t border-stone-500 border-b-4 border-stone-950 shadow-[0_4px_0_0_#000,inset_0_1px_0_0_rgba(255,255,255,0.15)] active:translate-y-1 active:border-b-2 active:shadow-none transition-all cursor-pointer">1</button>
                <button onClick={() => appendVal('2')} className="p-3.5 bg-gradient-to-b from-stone-700 to-stone-850 hover:from-stone-650 hover:to-stone-800 text-white font-black text-xl rounded-2xl border-t border-stone-500 border-b-4 border-stone-950 shadow-[0_4px_0_0_#000,inset_0_1px_0_0_rgba(255,255,255,0.15)] active:translate-y-1 active:border-b-2 active:shadow-none transition-all cursor-pointer">2</button>
                <button onClick={() => appendVal('3')} className="p-3.5 bg-gradient-to-b from-stone-700 to-stone-850 hover:from-stone-650 hover:to-stone-800 text-white font-black text-xl rounded-2xl border-t border-stone-500 border-b-4 border-stone-950 shadow-[0_4px_0_0_#000,inset_0_1px_0_0_rgba(255,255,255,0.15)] active:translate-y-1 active:border-b-2 active:shadow-none transition-all cursor-pointer">3</button>
                <button onClick={() => appendVal('-')} className="p-3.5 bg-gradient-to-b from-amber-600 to-amber-800 hover:from-amber-500 hover:to-amber-700 text-amber-100 font-black text-2xl rounded-2xl border-t border-amber-400 border-b-4 border-amber-950 shadow-[0_4px_0_0_#000,inset_0_1px_0_0_rgba(255,255,255,0.25)] active:translate-y-1 active:border-b-2 active:shadow-none transition-all cursor-pointer">-</button>

                <button onClick={() => appendVal('0')} className="p-3.5 bg-gradient-to-b from-stone-700 to-stone-850 hover:from-stone-650 hover:to-stone-800 text-white font-black text-xl rounded-2xl border-t border-stone-500 border-b-4 border-stone-950 shadow-[0_4px_0_0_#000,inset_0_1px_0_0_rgba(255,255,255,0.15)] active:translate-y-1 active:border-b-2 active:shadow-none transition-all cursor-pointer">0</button>
                <button onClick={() => appendVal('.')} className="p-3.5 bg-gradient-to-b from-stone-700 to-stone-850 hover:from-stone-650 hover:to-stone-800 text-white font-black text-xl rounded-2xl border-t border-stone-500 border-b-4 border-stone-950 shadow-[0_4px_0_0_#000,inset_0_1px_0_0_rgba(255,255,255,0.15)] active:translate-y-1 active:border-b-2 active:shadow-none transition-all cursor-pointer">.</button>
                <button onClick={() => appendVal('Ans')} className="p-3.5 bg-gradient-to-b from-stone-700 to-stone-850 hover:from-stone-650 hover:to-stone-800 text-amber-400 font-extrabold text-xs rounded-2xl border-t border-stone-500 border-b-4 border-stone-950 shadow-[0_4px_0_0_#000,inset_0_1px_0_0_rgba(255,255,255,0.15)] active:translate-y-1 active:border-b-2 active:shadow-none transition-all cursor-pointer">Ans</button>
                <button onClick={() => appendVal('+')} className="p-3.5 bg-gradient-to-b from-amber-600 to-amber-800 hover:from-amber-500 hover:to-amber-700 text-amber-100 font-black text-2xl rounded-2xl border-t border-amber-400 border-b-4 border-amber-950 shadow-[0_4px_0_0_#000,inset_0_1px_0_0_rgba(255,255,255,0.25)] active:translate-y-1 active:border-b-2 active:shadow-none transition-all cursor-pointer">+</button>
              </div>

              {/* BIG EQUALS BUTTON */}
              <button
                onClick={handleCalculate}
                className="w-full py-4 bg-gradient-to-b from-[#18568A] to-[#0e3658] hover:from-[#1d639f] hover:to-[#113e66] text-white font-black text-2xl rounded-2xl border-t border-[#4388c4] border-b-5 border-[#061929] shadow-[0_5px_0_0_#000,inset_0_1px_0_0_rgba(255,255,255,0.3)] active:translate-y-1.5 active:border-b-2 active:shadow-none transition-all cursor-pointer mt-1"
              >
                =
              </button>
            </div>
          </div>
        )}

        {/* ==================== MODE 2: GRAPHING ==================== */}
        {activeMode === 'graphing' && (
          <div className="bg-stone-900/90 p-4 rounded-3xl border-3 border-stone-800 shadow-[5px_5px_0px_0px_#000] space-y-4">
            <div>
              <label className="block text-xs font-bold text-amber-400 uppercase tracking-wider mb-2">
                Fonction f(x) =
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={graphFunction}
                  onChange={(e) => setGraphFunction(e.target.value)}
                  placeholder="ex: x^2 - 4"
                  className="flex-1 bg-stone-950 border-2 border-stone-700 rounded-xl px-3 py-2 text-white font-mono font-bold text-base focus:outline-none focus:border-[#18568A]"
                />
              </div>
              <div className="flex gap-2 mt-2">
                {['x^2 - 4', 'sin(x)', '2*x + 1', 'cos(x) * x', 'abs(x) - 3'].map(preset => (
                  <button
                    key={preset}
                    onClick={() => setGraphFunction(preset)}
                    className="px-2 py-1 bg-stone-800 hover:bg-stone-700 text-stone-300 text-[11px] font-mono rounded-lg border border-stone-700 cursor-pointer"
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>

            {/* X Range Controls */}
            <div className="grid grid-cols-3 gap-2 bg-stone-950 p-2.5 rounded-2xl border border-stone-800 text-xs font-mono">
              <div>
                <span className="text-stone-400 block text-[10px]">X Min</span>
                <input
                  type="number"
                  value={xMin}
                  onChange={(e) => setXMin(parseFloat(e.target.value) || -10)}
                  className="w-full bg-stone-900 border border-stone-700 rounded px-2 py-1 text-center font-bold"
                />
              </div>
              <div>
                <span className="text-stone-400 block text-[10px]">X Max</span>
                <input
                  type="number"
                  value={xMax}
                  onChange={(e) => setXMax(parseFloat(e.target.value) || 10)}
                  className="w-full bg-stone-900 border border-stone-700 rounded px-2 py-1 text-center font-bold"
                />
              </div>
              <div>
                <span className="text-stone-400 block text-[10px]">Pas (Step)</span>
                <input
                  type="number"
                  step="0.1"
                  value={graphStep}
                  onChange={(e) => setGraphStep(parseFloat(e.target.value) || 0.5)}
                  className="w-full bg-stone-900 border border-stone-700 rounded px-2 py-1 text-center font-bold"
                />
              </div>
            </div>

            {/* RECHARTS CANVAS */}
            <div className="h-64 sm:h-72 w-full bg-stone-950 p-2 rounded-2xl border-2 border-stone-800">
              {graphData.length === 0 ? (
                <div className="h-full flex items-center justify-center text-stone-500 italic text-xs">
                  Entrez une fonction valide pour afficher la courbe
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={graphData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                    <XAxis dataKey="x" stroke="#71717a" tick={{ fontSize: 10 }} />
                    <YAxis stroke="#71717a" tick={{ fontSize: 10 }} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#18181b', borderColor: '#3f3f46', borderRadius: '12px', fontSize: '12px' }}
                      labelStyle={{ color: '#f59e0b', fontWeight: 'bold' }}
                    />
                    <ReferenceLine y={0} stroke="#52525b" strokeWidth={1.5} />
                    <ReferenceLine x={0} stroke="#52525b" strokeWidth={1.5} />
                    <Line
                      type="monotone"
                      dataKey="y"
                      stroke="#38bdf8"
                      strokeWidth={3}
                      dot={false}
                      activeDot={{ r: 6, fill: '#f59e0b' }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        )}

        {/* ==================== MODE 3: UNIT CONVERTER ==================== */}
        {activeMode === 'converter' && (
          <div className="bg-stone-900/90 p-4 rounded-3xl border-3 border-stone-800 shadow-[5px_5px_0px_0px_#000] space-y-4">
            
            {/* Category Selector */}
            <div className="grid grid-cols-3 gap-1.5 bg-stone-950 p-1.5 rounded-2xl border border-stone-800">
              {[
                { id: 'length', label: 'Longueur' },
                { id: 'mass', label: 'Masse' },
                { id: 'temp', label: 'Température' },
                { id: 'data', label: 'Stockage' },
                { id: 'speed', label: 'Vitesse' },
                { id: 'currency', label: 'Devises' },
              ].map(cat => (
                <button
                  key={cat.id}
                  onClick={() => {
                    setConvType(cat.id as any);
                    if (cat.id === 'length') { setFromUnit('m'); setToUnit('km'); }
                    if (cat.id === 'mass') { setFromUnit('kg'); setToUnit('g'); }
                    if (cat.id === 'temp') { setFromUnit('°C'); setToUnit('°F'); }
                    if (cat.id === 'data') { setFromUnit('GB'); setToUnit('MB'); }
                    if (cat.id === 'currency') { setFromUnit('EUR'); setToUnit('XOF'); }
                  }}
                  className={`py-1.5 px-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                    convType === cat.id
                      ? 'bg-amber-500 text-stone-950 shadow-sm'
                      : 'text-stone-400 hover:text-white'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            {/* Inputs & Units */}
            <div className="space-y-3">
              {/* FROM UNIT */}
              <div className="bg-stone-950 p-3 rounded-2xl border border-stone-800 flex items-center justify-between gap-3">
                <input
                  type="number"
                  value={convVal}
                  onChange={(e) => setConvVal(e.target.value)}
                  className="w-full bg-transparent text-2xl font-mono font-bold text-white focus:outline-none"
                />
                <select
                  value={fromUnit}
                  onChange={(e) => setFromUnit(e.target.value)}
                  className="bg-stone-800 text-amber-400 font-bold border border-stone-700 rounded-xl px-3 py-2 text-sm focus:outline-none"
                >
                  {convType === 'length' && ['mm','cm','m','km','inch','ft','mi'].map(u => <option key={u} value={u}>{u}</option>)}
                  {convType === 'mass' && ['mg','g','kg','lb','oz'].map(u => <option key={u} value={u}>{u}</option>)}
                  {convType === 'temp' && ['°C','°F','K'].map(u => <option key={u} value={u}>{u}</option>)}
                  {convType === 'data' && ['B','KB','MB','GB','TB'].map(u => <option key={u} value={u}>{u}</option>)}
                  {convType === 'currency' && ['EUR','USD','GBP','CAD','XOF','JPY'].map(u => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>

              {/* Swap Button */}
              <div className="flex justify-center">
                <button
                  onClick={() => {
                    const temp = fromUnit;
                    setFromUnit(toUnit);
                    setToUnit(temp);
                  }}
                  className="p-2 bg-stone-800 hover:bg-stone-700 text-stone-200 rounded-full border border-stone-700 shadow cursor-pointer transition-transform active:rotate-180"
                >
                  <ArrowLeftRight className="w-4 h-4 rotate-90" />
                </button>
              </div>

              {/* TO UNIT */}
              <div className="bg-stone-950 p-3 rounded-2xl border border-stone-800 flex items-center justify-between gap-3">
                <div className="w-full text-2xl font-mono font-bold text-[#F7C858] break-all">
                  {convertedResult}
                </div>
                <select
                  value={toUnit}
                  onChange={(e) => setToUnit(e.target.value)}
                  className="bg-stone-800 text-amber-400 font-bold border border-stone-700 rounded-xl px-3 py-2 text-sm focus:outline-none"
                >
                  {convType === 'length' && ['mm','cm','m','km','inch','ft','mi'].map(u => <option key={u} value={u}>{u}</option>)}
                  {convType === 'mass' && ['mg','g','kg','lb','oz'].map(u => <option key={u} value={u}>{u}</option>)}
                  {convType === 'temp' && ['°C','°F','K'].map(u => <option key={u} value={u}>{u}</option>)}
                  {convType === 'data' && ['B','KB','MB','GB','TB'].map(u => <option key={u} value={u}>{u}</option>)}
                  {convType === 'currency' && ['EUR','USD','GBP','CAD','XOF','JPY'].map(u => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
            </div>
          </div>
        )}

        {/* ==================== MODE 4: FINANCE ==================== */}
        {activeMode === 'finance' && (
          <div className="space-y-4">
            
            {/* LOAN CALCULATOR */}
            <div className="bg-stone-900/90 p-4 rounded-3xl border-3 border-stone-800 shadow-[5px_5px_0px_0px_#000] space-y-3">
              <div className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                <DollarSign className="w-4 h-4" />
                <span>Calculateur d'Emprunt / Prêt</span>
              </div>

              <div className="grid grid-cols-3 gap-2 text-xs font-mono">
                <div>
                  <span className="text-stone-400 block text-[10px] mb-1">Montant</span>
                  <input
                    type="number"
                    value={loanAmount}
                    onChange={(e) => setLoanAmount(e.target.value)}
                    className="w-full bg-stone-950 border border-stone-700 rounded-xl px-2.5 py-2 font-bold text-white focus:outline-none focus:border-[#18568A]"
                  />
                </div>
                <div>
                  <span className="text-stone-400 block text-[10px] mb-1">Taux (% an)</span>
                  <input
                    type="number"
                    step="0.1"
                    value={loanRate}
                    onChange={(e) => setLoanRate(e.target.value)}
                    className="w-full bg-stone-950 border border-stone-700 rounded-xl px-2.5 py-2 font-bold text-white focus:outline-none focus:border-[#18568A]"
                  />
                </div>
                <div>
                  <span className="text-stone-400 block text-[10px] mb-1">Durée (ans)</span>
                  <input
                    type="number"
                    value={loanYears}
                    onChange={(e) => setLoanYears(e.target.value)}
                    className="w-full bg-stone-950 border border-stone-700 rounded-xl px-2.5 py-2 font-bold text-white focus:outline-none focus:border-[#18568A]"
                  />
                </div>
              </div>

              <div className="bg-stone-950 p-3 rounded-2xl border border-stone-800 space-y-1.5 text-xs font-mono">
                <div className="flex justify-between">
                  <span className="text-stone-400">Mensualité :</span>
                  <span className="font-bold text-emerald-400 text-sm">{loanSummary.monthly} FCFA / mois</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-400">Intérêts totaux :</span>
                  <span className="font-bold text-amber-400">{loanSummary.totalInterest} FCFA</span>
                </div>
                <div className="flex justify-between border-t border-stone-800 pt-1.5">
                  <span className="text-stone-300 font-bold">Coût total :</span>
                  <span className="font-bold text-white">{loanSummary.totalCost} FCFA</span>
                </div>
              </div>
            </div>

            {/* DISCOUNT CALCULATOR */}
            <div className="bg-stone-900/90 p-4 rounded-3xl border-3 border-stone-800 shadow-[5px_5px_0px_0px_#000] space-y-3">
              <div className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                <PieChart className="w-4 h-4" />
                <span>Calculateur de Réduction / Solde</span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                <div>
                  <span className="text-stone-400 block text-[10px] mb-1">Prix Initial</span>
                  <input
                    type="number"
                    value={discountPrice}
                    onChange={(e) => setDiscountPrice(e.target.value)}
                    className="w-full bg-stone-950 border border-stone-700 rounded-xl px-2.5 py-2 font-bold text-white focus:outline-none focus:border-[#18568A]"
                  />
                </div>
                <div>
                  <span className="text-stone-400 block text-[10px] mb-1">Remise (%)</span>
                  <input
                    type="number"
                    value={discountPercent}
                    onChange={(e) => setDiscountPercent(e.target.value)}
                    className="w-full bg-stone-950 border border-stone-700 rounded-xl px-2.5 py-2 font-bold text-white focus:outline-none focus:border-[#18568A]"
                  />
                </div>
              </div>

              <div className="bg-stone-950 p-3 rounded-2xl border border-stone-800 space-y-1.5 text-xs font-mono">
                <div className="flex justify-between">
                  <span className="text-stone-400">Économie réalisée :</span>
                  <span className="font-bold text-emerald-400">{discountSummary.saved} FCFA</span>
                </div>
                <div className="flex justify-between border-t border-stone-800 pt-1.5">
                  <span className="text-stone-300 font-bold">Prix Final après remise :</span>
                  <span className="font-bold text-[#F7C858] text-sm">{discountSummary.final} FCFA</span>
                </div>
              </div>
            </div>

          </div>
        )}

      </div>
    </div>
  );
};
