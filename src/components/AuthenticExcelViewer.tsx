import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  FileSpreadsheet,
  Save,
  RotateCcw,
  Plus,
  Search,
  Download,
  Check,
  ZoomIn,
  ZoomOut
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { storeFileBlob, formatFileSize } from '../services/localFileStorage';
import { CloudDataStore } from '../services/cloudDataStore';
import { CloudStorageAPI } from '../services/cloudStorageService';

interface AuthenticExcelViewerProps {
  fileId?: string;
  fileName?: string;
  fileSize?: string | number;
  initialWorkbook: XLSX.WorkBook;
  onSaved?: (newBlob: Blob) => void;
  className?: string;
}

export const AuthenticExcelViewer: React.FC<AuthenticExcelViewerProps> = ({
  fileId,
  fileName = 'Classeur.xlsx',
  fileSize,
  initialWorkbook,
  onSaved,
  className = '',
}) => {
  const [workbook, setWorkbook] = useState<XLSX.WorkBook>(initialWorkbook);
  const sheetNames = workbook.SheetNames || ['Feuille 1'];
  const [activeSheetName, setActiveSheetName] = useState<string>(sheetNames[0] || 'Feuille 1');

  // Données de la feuille active sous forme de tableau 2D de cellules
  const [gridData, setGridData] = useState<any[][]>(() => {
    const ws = workbook.Sheets[sheetNames[0]];
    if (!ws) return [['']];
    return XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];
  });

  const originalGridDataRef = useRef<any[][]>(gridData);
  const [selectedCell, setSelectedCell] = useState<{ r: number; c: number } | null>(null);
  const [formulaValue, setFormulaValue] = useState<string>('');
  const [isDirty, setIsDirty] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [zoomLevel, setZoomLevel] = useState<number>(100);

  // Synchronisation lors du changement d'onglet de feuille
  const handleSheetChange = (sName: string) => {
    setActiveSheetName(sName);
    const ws = workbook.Sheets[sName];
    const data = ws ? (XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][]) : [['']];
    setGridData(data);
    originalGridDataRef.current = JSON.parse(JSON.stringify(data));
    setSelectedCell(null);
    setFormulaValue('');
    setIsDirty(false);
  };

  // Sélection d'une cellule
  const handleSelectCell = (r: number, c: number) => {
    setSelectedCell({ r, c });
    const val = gridData[r]?.[c];
    setFormulaValue(val !== undefined && val !== null ? String(val) : '');
  };

  // Modification de cellule
  const handleCellChange = (r: number, c: number, newVal: string) => {
    setGridData(prev => {
      const copy = prev.map(row => [...row]);
      while (copy.length <= r) copy.push([]);
      copy[r][c] = newVal;
      return copy;
    });
    setFormulaValue(newVal);
    if (!isDirty) {
      setIsDirty(true);
      setSaveSuccess(false);
    }
  };

  // Action Abandonner
  const handleDiscard = () => {
    setGridData(JSON.parse(JSON.stringify(originalGridDataRef.current)));
    if (selectedCell) {
      const origVal = originalGridDataRef.current[selectedCell.r]?.[selectedCell.c];
      setFormulaValue(origVal !== undefined && origVal !== null ? String(origVal) : '');
    }
    setIsDirty(false);
    setSaveSuccess(false);
  };

  // Action Enregistrer
  const handleSave = async () => {
    setIsSaving(true);
    try {
      const newWs = XLSX.utils.aoa_to_sheet(gridData);
      workbook.Sheets[activeSheetName] = newWs;

      const wbout = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
      const newBlob = new Blob([wbout], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });

      originalGridDataRef.current = JSON.parse(JSON.stringify(gridData));

      if (fileId) {
        await storeFileBlob(fileId, newBlob);
        CloudDataStore.updateFile(fileId, {
          size: formatFileSize(newBlob.size),
          sizeBytes: newBlob.size,
          timestamp: Date.now(),
        });
        CloudStorageAPI.uploadFile(newBlob, 'documents', fileName, undefined, undefined, undefined, newBlob.size, undefined, fileId).catch(() => {});
      }

      onSaved?.(newBlob);
      setIsDirty(false);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3500);
    } catch (err: any) {
      console.error('[AuthenticExcelViewer] Erreur sauvegarde Excel:', err);
      alert("Erreur lors de l'enregistrement du tableau : " + (err.message || ''));
    } finally {
      setIsSaving(false);
    }
  };

  // Génération des noms de colonnes A, B, C...
  const getColName = (idx: number): string => {
    let name = '';
    let num = idx;
    while (num >= 0) {
      name = String.fromCharCode((num % 26) + 65) + name;
      num = Math.floor(num / 26) - 1;
    }
    return name;
  };

  // Calcul du nombre de colonnes nécessaires (min 15)
  const maxCols = Math.max(15, ...gridData.map(r => (Array.isArray(r) ? r.length : 0)));
  const maxRows = Math.max(40, gridData.length + 10);

  return (
    <div className={`w-full h-full min-h-0 flex flex-col bg-stone-100 dark:bg-[#070b14] text-stone-900 dark:text-stone-100 overflow-hidden select-text ${className}`}>
      {/* 1. EN-TÊTE ET ACTIONS AVEC BOUTONS ENREGISTRER & ABANDONNER */}
      <div className="w-full px-3 sm:px-4 py-2 bg-white dark:bg-[#0e1424] border-b border-stone-200 dark:border-stone-800 flex items-center justify-between gap-2 shrink-0 shadow-xs z-10">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
            <FileSpreadsheet className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h4 className="text-xs sm:text-sm font-bold text-stone-900 dark:text-white truncate max-w-[160px] sm:max-w-xs md:max-w-md" title={fileName}>
                {fileName}
              </h4>
              {isDirty && (
                <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 animate-pulse">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                  <span>Modifié</span>
                </span>
              )}
              {saveSuccess && (
                <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                  <Check className="w-3 h-3 text-emerald-500" />
                  <span>Enregistré !</span>
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 text-[10px] text-stone-500 dark:text-stone-400">
              <span className="uppercase font-semibold text-emerald-600 dark:text-emerald-400">Tableau Excel Authentique</span>
              {fileSize && <span>• {fileSize}</span>}
              <span>• Cliquez sur une cellule pour modifier sa valeur</span>
            </div>
          </div>
        </div>

        {/* Contrôles droits */}
        <div className="flex items-center gap-1.5 shrink-0">
          {isDirty && (
            <button
              type="button"
              onClick={handleDiscard}
              disabled={isSaving}
              className="px-3 py-1.5 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/50 text-rose-600 dark:text-rose-400 border border-rose-300 dark:border-rose-800 rounded-lg text-xs font-bold flex items-center gap-1.5 active:scale-95 transition-all cursor-pointer shadow-xs"
              title="Annuler les modifications"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Abandonner</span>
            </button>
          )}

          {isDirty && (
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 active:scale-95 transition-all cursor-pointer shadow-md"
              title="Enregistrer le tableau Excel"
            >
              {isSaving ? (
                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Save className="w-3.5 h-3.5" />
              )}
              <span>{isSaving ? 'Enregistrement...' : 'Enregistrer'}</span>
            </button>
          )}

          {/* Zoom */}
          <div className="flex items-center gap-1 bg-stone-100 dark:bg-stone-800 px-2 py-1 rounded-lg border border-stone-200 dark:border-stone-700 text-xs">
            <button
              type="button"
              onClick={() => setZoomLevel(prev => Math.max(60, prev - 15))}
              className="p-0.5 hover:text-emerald-500 cursor-pointer text-stone-600 dark:text-stone-300"
              title="Zoom arrière"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="font-mono text-[11px] px-1 font-bold">{zoomLevel}%</span>
            <button
              type="button"
              onClick={() => setZoomLevel(prev => Math.min(200, prev + 15))}
              className="p-0.5 hover:text-emerald-500 cursor-pointer text-stone-600 dark:text-stone-300"
              title="Zoom avant"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* 2. BARRE DE FORMULE ET COORDONNÉES DE CELLULE */}
      <div className="w-full px-3 py-1.5 bg-stone-50 dark:bg-[#0c1220] border-b border-stone-200 dark:border-stone-800 flex items-center gap-2 shrink-0 text-xs">
        <span className="w-14 px-2 py-0.5 font-mono font-bold text-center bg-white dark:bg-stone-800 border border-stone-300 dark:border-stone-700 rounded text-emerald-600 dark:text-emerald-400 shrink-0">
          {selectedCell ? `${getColName(selectedCell.c)}${selectedCell.r + 1}` : 'A1'}
        </span>
        <span className="font-mono text-stone-400 font-bold shrink-0">fx</span>
        <input
          type="text"
          value={formulaValue}
          onChange={(e) => {
            const val = e.target.value;
            setFormulaValue(val);
            if (selectedCell) {
              handleCellChange(selectedCell.r, selectedCell.c, val);
            }
          }}
          placeholder="Valeur de la cellule..."
          className="flex-1 px-2.5 py-0.5 bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 rounded font-sans text-xs text-stone-900 dark:text-stone-100 outline-none focus:border-emerald-500"
        />
      </div>

      {/* 3. GRILLE EXCEL AUTHENTIQUE */}
      <div 
        className="flex-1 w-full h-full min-h-0 overflow-auto bg-stone-200 dark:bg-[#070b14] p-0 overscroll-contain"
        style={{ overscrollBehavior: 'contain', touchAction: 'pan-x pan-y' }}
      >
        <div style={{ zoom: `${zoomLevel}%` }} className="inline-block min-w-full">
          <table className="border-collapse table-fixed text-xs bg-white dark:bg-stone-900 select-text">
            <thead>
              <tr className="bg-stone-100 dark:bg-stone-800 sticky top-0 z-10 select-none shadow-xs">
                <th className="w-12 px-2 py-1 border border-stone-300 dark:border-stone-700 text-[10px] text-stone-400 font-mono text-center bg-stone-200 dark:bg-stone-800/90"></th>
                {Array.from({ length: maxCols }, (_, c) => (
                  <th
                    key={c}
                    className="min-w-[100px] px-2 py-1 border border-stone-300 dark:border-stone-700 text-[11px] font-bold text-stone-600 dark:text-stone-300 text-center"
                  >
                    {getColName(c)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: maxRows }, (_, r) => (
                <tr key={r} className="hover:bg-emerald-500/5">
                  <td className="w-12 px-1 py-1 border border-stone-300 dark:border-stone-700 text-[10px] text-stone-400 font-mono text-center bg-stone-100 dark:bg-stone-800/60 sticky left-0 z-0 select-none">
                    {r + 1}
                  </td>
                  {Array.from({ length: maxCols }, (_, c) => {
                    const isSelected = selectedCell?.r === r && selectedCell?.c === c;
                    const cellVal = gridData[r]?.[c] ?? '';
                    return (
                      <td
                        key={c}
                        onClick={() => handleSelectCell(r, c)}
                        contentEditable={true}
                        suppressContentEditableWarning={true}
                        onBlur={(e) => {
                          const val = e.currentTarget.innerText;
                          if (val !== String(cellVal)) {
                            handleCellChange(r, c, val);
                          }
                        }}
                        className={`min-w-[100px] px-2 py-1.5 border border-stone-200 dark:border-stone-800 outline-none truncate transition-colors ${
                          isSelected
                            ? 'ring-2 ring-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/30'
                            : ''
                        }`}
                      >
                        {String(cellVal)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 4. ONGLETS DE FEUILLES EXCEL EN BAS */}
      {sheetNames.length > 0 && (
        <div className="w-full px-3 py-1.5 bg-stone-100 dark:bg-[#0c1220] border-t border-stone-300 dark:border-stone-800 flex items-center gap-1.5 overflow-x-auto shrink-0 select-none">
          {sheetNames.map((sName) => (
            <button
              key={sName}
              type="button"
              onClick={() => handleSheetChange(sName)}
              className={`px-3 py-1 rounded-t-md text-xs font-bold border-t border-x transition-colors cursor-pointer whitespace-nowrap ${
                activeSheetName === sName
                  ? 'bg-white dark:bg-stone-900 text-emerald-600 dark:text-emerald-400 border-stone-300 dark:border-stone-700 shadow-xs'
                  : 'bg-stone-200 dark:bg-stone-800 text-stone-600 dark:text-stone-400 border-transparent hover:bg-stone-300'
              }`}
            >
              {sName}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
