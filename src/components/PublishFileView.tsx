import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Upload, CheckCircle2, X, FileText, Table, Presentation, Plus, RefreshCw } from 'lucide-react';
import { FileIconBadge } from './FileIconBadge';
import * as pdfjsLib from 'pdfjs-dist';
import mammoth from 'mammoth';
import * as XLSX from 'xlsx';

// Configure worker for PDF.js
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

interface PublishFileViewProps {
  onBack: () => void;
  onPublish?: (title: string, description: string, category: string, files: any[]) => void;
}

export const PublishFileView: React.FC<PublishFileViewProps> = ({ onBack, onPublish }) => {
  const [selectedFiles, setSelectedFiles] = useState<any[]>(() => {
    try {
      const saved = localStorage.getItem('published_selected_files');
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.error(e);
    }
    return [];
  });
  const [school, setSchool] = useState(() => localStorage.getItem('published_school') || '');
  const [filiere, setFiliere] = useState(() => localStorage.getItem('published_filiere') || '');
  const [infoMode, setInfoMode] = useState<'all' | 'individual' | 'none'>(() => {
    return (localStorage.getItem('published_info_mode') as any) || 'all';
  });
  const [isPublishing, setIsPublishing] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    try {
      const sanitized = selectedFiles.map(f => ({
        ...f,
        url: f.isImage && f.url && f.url.length > 50000 ? '' : f.url
      }));
      localStorage.setItem('published_selected_files', JSON.stringify(sanitized));
    } catch (e) {
      console.error('LocalStorage quota exceeded:', e);
      try {
        localStorage.removeItem('published_selected_files');
      } catch (err) {}
    }
  }, [selectedFiles]);

  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      localStorage.setItem('published_school', school);
      localStorage.setItem('published_filiere', filiere);
      localStorage.setItem('published_info_mode', infoMode);
    } catch (e) {
      console.error(e);
    }
  }, [school, filiere, infoMode]);

  useEffect(() => {
    if (selectedFiles.length > 0 && containerRef.current) {
      setTimeout(() => {
        containerRef.current?.scrollTo({
          top: containerRef.current.scrollHeight,
          behavior: 'smooth'
        });
      }, 150);
    }
  }, [selectedFiles.length]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const filesArray = Array.from(e.target.files);
      filesArray.forEach((file: any) => {
        const fileNameLower = file.name.toLowerCase();
        const isImage = file.type && file.type.startsWith('image/');
        const isPdf = file.type === 'application/pdf' || fileNameLower.endsWith('.pdf');
        const isDocx = file.type.includes('wordprocessingml') || fileNameLower.endsWith('.docx') || fileNameLower.endsWith('.doc');
        const isXlsx = fileNameLower.endsWith('.xlsx') || fileNameLower.endsWith('.xls') || fileNameLower.endsWith('.csv') || file.type.includes('spreadsheet') || file.type.includes('excel');
        const isPptx = fileNameLower.endsWith('.pptx') || fileNameLower.endsWith('.ppt') || file.type.includes('presentation') || file.type.includes('powerpoint');
        const isText = file.type.startsWith('text/') || fileNameLower.endsWith('.txt') || fileNameLower.endsWith('.md') || fileNameLower.endsWith('.json');

        const cleanName = file.name.replace(/\.[^/.]+$/, "").replace(/[_-_]/g, ' ');

        if (isImage) {
          const reader = new FileReader();
          reader.onload = (uploadEvent) => {
            const resultUrl = uploadEvent.target?.result as string || '';
            const newFileObj = {
              id: Math.random().toString(36).substring(2, 9),
              name: file.name,
              size: file.size,
              type: file.type || 'image/png',
              url: resultUrl,
              isImage: true,
              fileTypeCategory: 'image',
              textContent: cleanName,
              tableRows: [],
            };
            setSelectedFiles((prev) => [...prev, newFileObj]);
          };
          reader.readAsDataURL(file);
        } else if (isPdf) {
          const reader = new FileReader();
          reader.onload = async (uploadEvent) => {
            try {
              const arrayBuffer = uploadEvent.target?.result as ArrayBuffer;
              if (arrayBuffer) {
                const typedarray = new Uint8Array(arrayBuffer);
                const loadingTask = pdfjsLib.getDocument({ data: typedarray });
                const pdf = await loadingTask.promise;
                const page = await pdf.getPage(1);
                const viewport = page.getViewport({ scale: 1.5 });
                const canvas = document.createElement('canvas');
                const context = canvas.getContext('2d');
                if (context) {
                  canvas.height = viewport.height;
                  canvas.width = viewport.width;
                  await page.render({ canvasContext: context, viewport }).promise;
                  const imageUrl = canvas.toDataURL('image/png');

                  const newFileObj = {
                    id: Math.random().toString(36).substring(2, 9),
                    name: file.name,
                    size: file.size,
                    type: file.type || 'application/pdf',
                    url: imageUrl,
                    isImage: true,
                    fileTypeCategory: 'pdf',
                    textContent: cleanName,
                    tableRows: [],
                  };
                  setSelectedFiles((prev) => [...prev, newFileObj]);
                  return;
                }
              }
            } catch (err) {
              console.warn('Could not render PDF first page (fallback):', err);
            }

            const newFileObj = {
              id: Math.random().toString(36).substring(2, 9),
              name: file.name,
              size: file.size,
              type: file.type || 'application/pdf',
              url: '',
              isImage: false,
              fileTypeCategory: 'pdf',
              textContent: cleanName,
              tableRows: [],
            };
            setSelectedFiles((prev) => [...prev, newFileObj]);
          };
          reader.readAsArrayBuffer(file);
        } else if (isDocx) {
          const reader = new FileReader();
          reader.onload = async (uploadEvent) => {
            try {
              const arrayBuffer = uploadEvent.target?.result as ArrayBuffer;
              if (arrayBuffer) {
                const result = await mammoth.extractRawText({ arrayBuffer });
                const text = result.value || '';
                const newFileObj = {
                  id: Math.random().toString(36).substring(2, 9),
                  name: file.name,
                  size: file.size,
                  type: file.type || 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                  url: '',
                  isImage: false,
                  fileTypeCategory: 'docx',
                  textContent: text ? text.trim() : cleanName,
                  tableRows: [],
                };
                setSelectedFiles((prev) => [...prev, newFileObj]);
                return;
              }
            } catch (err) {
              console.warn('Could not extract Word text (fallback):', err);
            }

            const newFileObj = {
              id: Math.random().toString(36).substring(2, 9),
              name: file.name,
              size: file.size,
              type: file.type || 'application/msword',
              url: '',
              isImage: false,
              fileTypeCategory: 'docx',
              textContent: cleanName,
              tableRows: [],
            };
            setSelectedFiles((prev) => [...prev, newFileObj]);
          };
          reader.readAsArrayBuffer(file);
        } else if (isXlsx) {
          const reader = new FileReader();
          reader.onload = async (uploadEvent) => {
            try {
              const arrayBuffer = uploadEvent.target?.result as ArrayBuffer;
              if (arrayBuffer) {
                const workbook = XLSX.read(arrayBuffer, { type: 'array' });
                const firstSheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheetName];
                const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
                const rows = jsonData.slice(0, 6).map((r) => r.slice(0, 4));

                const newFileObj = {
                  id: Math.random().toString(36).substring(2, 9),
                  name: file.name,
                  size: file.size,
                  type: file.type || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                  url: '',
                  isImage: false,
                  fileTypeCategory: 'xlsx',
                  textContent: cleanName,
                  tableRows: rows.length > 0 ? rows : [['ID', 'Nom', 'Valeur', 'Statut'], ['01', 'Article A', '150', 'Actif'], ['02', 'Article B', '320', 'En attente']],
                };
                setSelectedFiles((prev) => [...prev, newFileObj]);
                return;
              }
            } catch (err) {
              console.warn('Could not parse Excel spreadsheet (fallback):', err);
            }

            const newFileObj = {
              id: Math.random().toString(36).substring(2, 9),
              name: file.name,
              size: file.size,
              type: file.type || 'application/vnd.ms-excel',
              url: '',
              isImage: false,
              fileTypeCategory: 'xlsx',
              textContent: cleanName,
              tableRows: [
                ['Col 1', 'Col 2', 'Col 3'],
                ['Donnée 1', 'Donnée 2', 'Donnée 3'],
                ['Valeur A', 'Valeur B', 'Valeur C'],
              ],
            };
            setSelectedFiles((prev) => [...prev, newFileObj]);
          };
          reader.readAsArrayBuffer(file);
        } else if (isPptx) {
          const reader = new FileReader();
          reader.onload = () => {
            const newFileObj = {
              id: Math.random().toString(36).substring(2, 9),
              name: file.name,
              size: file.size,
              type: file.type || 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
              url: '',
              isImage: false,
              fileTypeCategory: 'pptx',
              textContent: cleanName,
              tableRows: [],
            };
            setSelectedFiles((prev) => [...prev, newFileObj]);
          };
          reader.readAsArrayBuffer(file);
        } else if (isText) {
          const reader = new FileReader();
          reader.onload = (uploadEvent) => {
            const text = uploadEvent.target?.result as string || '';
            const newFileObj = {
              id: Math.random().toString(36).substring(2, 9),
              name: file.name,
              size: file.size,
              type: file.type || 'text/plain',
              url: '',
              isImage: false,
              fileTypeCategory: 'text',
              textContent: text ? text.trim() : cleanName,
              tableRows: [],
            };
            setSelectedFiles((prev) => [...prev, newFileObj]);
          };
          reader.readAsText(file);
        } else {
          const reader = new FileReader();
          reader.onload = () => {
            const newFileObj = {
              id: Math.random().toString(36).substring(2, 9),
              name: file.name,
              size: file.size,
              type: file.type || 'application/octet-stream',
              url: '',
              isImage: false,
              fileTypeCategory: 'other',
              textContent: cleanName,
              tableRows: [],
            };
            setSelectedFiles((prev) => [...prev, newFileObj]);
          };
          reader.readAsDataURL(file);
        }
      });
    }
  };

  const removeFile = (id: string) => {
    setSelectedFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const handleBack = () => {
    localStorage.removeItem('published_selected_files');
    localStorage.removeItem('published_school');
    localStorage.removeItem('published_filiere');
    onBack();
  };

  const handlePublishAll = () => {
    if (selectedFiles.length === 0) return;
    setIsPublishing(true);
    localStorage.removeItem('published_selected_files');
    localStorage.removeItem('published_school');
    localStorage.removeItem('published_filiere');
    localStorage.removeItem('published_info_mode');
    setTimeout(() => {
      setIsPublishing(false);
      setSuccess(true);
      if (onPublish) {
        let finalDesc = 'Fichiers importés depuis la vue de publication';
        if (infoMode === 'all') {
          const descParts = [];
          if (school) descParts.push(`École : ${school}`);
          if (filiere) descParts.push(`Filière : ${filiere}`);
          if (descParts.length > 0) finalDesc = descParts.join(' | ');
        } else if (infoMode === 'individual') {
          const descParts = selectedFiles
            .map(f => {
              const parts = [];
              if (f.fileSchool) parts.push(`École: ${f.fileSchool}`);
              if (f.fileFiliere) parts.push(`Filière: ${f.fileFiliere}`);
              return parts.length > 0 ? `${f.name} (${parts.join(' - ')})` : null;
            })
            .filter(Boolean);
          if (descParts.length > 0) finalDesc = descParts.join(' | ');
        } else {
          finalDesc = 'Fichiers partagés (sans information d\'école)';
        }
        onPublish(
          selectedFiles[0]?.name || 'Document partagé',
          finalDesc,
          'Documents',
          selectedFiles
        );
      }
      setTimeout(() => {
        onBack();
      }, 500);
    }, 3000);
  };

  const formatSize = (bytes: number) => {
    if (bytes >= 1024 * 1024) {
      return (bytes / (1024 * 1024)).toFixed(1).replace('.', ',') + ' Mo';
    }
    return Math.round(bytes / 1024) + ' ko';
  };

  return (
    <div ref={containerRef} className="absolute inset-0 z-30 w-full min-h-screen bg-[#FDFBF7] text-stone-950 px-3 sm:px-6 py-4 overflow-y-auto">
      {/* Top Fixed Bar */}
      <div className="fixed top-4 left-3 right-3 sm:left-6 sm:right-6 flex items-center justify-between z-40 pointer-events-none">
        <button
          onClick={handleBack}
          className="pointer-events-auto flex items-center gap-1 px-2.5 py-1 bg-[#F5F1E9] hover:bg-[#EBE5DA] text-stone-900 font-bold text-[10px] rounded-lg border-2 border-stone-800 shadow-[1px_1px_0px_0px_#1c1917] transition-all cursor-pointer active:translate-x-0.5 active:translate-y-0.5"
        >
          <ArrowLeft className="w-3 h-3" />
          <span>Retour</span>
        </button>

        <div className="flex items-center gap-2 pointer-events-auto">
          <label className="flex items-center gap-1 px-2.5 py-1 bg-[#F5F1E9] hover:bg-[#EBE5DA] text-stone-900 font-bold text-[10px] rounded-lg border-2 border-stone-800 shadow-[1px_1px_0px_0px_#1c1917] transition-all cursor-pointer active:translate-x-0.5 active:translate-y-0.5">
            <Upload className="w-3 h-3 text-orange-600" />
            <span>Ajouter</span>
            <input type="file" multiple onChange={handleFileChange} className="hidden" />
          </label>

          {selectedFiles.length > 0 && (
            <button
              onClick={handlePublishAll}
              className="flex items-center gap-1 px-3 py-1 bg-[#2D4A3E] hover:bg-[#1e332a] text-white font-bold text-[10px] rounded-lg border-2 border-stone-800 shadow-[1px_1px_0px_0px_#1c1917] transition-all cursor-pointer active:translate-x-0.5 active:translate-y-0.5"
            >
              <span>Valider ({selectedFiles.length})</span>
            </button>
          )}
        </div>
      </div>

      <div className="w-full max-w-6xl mx-auto pt-16 pb-24">
        {success ? (
          <div className="bg-emerald-50 border-2 border-emerald-600 rounded-2xl p-6 text-center space-y-2 shadow-[3px_3px_0px_0px_#047857] w-full max-w-lg mx-auto mt-20">
            <CheckCircle2 className="w-12 h-12 text-emerald-600 mx-auto" />
            <h2 className="text-base font-black text-emerald-900">Fichiers publiés avec succès !</h2>
            <p className="text-xs text-emerald-700">Vos documents ont été partagés et enregistrés.</p>
          </div>
        ) : (
          <div className="w-full space-y-4">
            {selectedFiles.length === 0 ? (
              <div className="flex flex-col items-center justify-center min-h-[70vh]">
                <label className="flex flex-col items-center justify-center border-2 border-dashed border-stone-400 bg-white hover:bg-stone-50 rounded-2xl p-12 sm:p-16 cursor-pointer transition-all shadow-[3px_3px_0px_0px_#1c1917] text-center w-full max-w-md">
                  <Upload className="w-10 h-10 text-orange-600 mb-3" />
                  <span className="text-sm font-bold text-stone-800">Cliquez ou déposez vos fichiers ici</span>
                  <span className="text-xs text-stone-500 mt-1">PDF, Word, Excel, PPT, images...</span>
                  <input type="file" multiple onChange={handleFileChange} className="hidden" />
                </label>
              </div>
            ) : (
              <div>
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2.5 sm:gap-3 mt-4">
                  {selectedFiles.map((file) => (
                    <div
                      key={file.id}
                      className="aspect-[3/4] bg-[#2A2B2E] border-2 border-stone-800 rounded-xl p-2 flex flex-col justify-between shadow-[2px_2px_0px_0px_#1c1917] relative group select-none overflow-hidden"
                    >
                      {/* File size badge in top right */}
                      <div className="absolute top-1.5 right-1.5 z-20 bg-black/75 backdrop-blur-sm text-stone-200 font-bold text-[8px] px-1.5 py-0.5 rounded border border-stone-700 shadow-sm">
                        {formatSize(file.size)}
                      </div>

                      {/* Remove button on hover top left */}
                      <button
                        type="button"
                        onClick={() => removeFile(file.id)}
                        className="absolute top-1.5 left-1.5 z-20 w-5 h-5 bg-red-600 hover:bg-red-700 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-md cursor-pointer"
                        title="Supprimer"
                      >
                        <X className="w-3 h-3" />
                      </button>

                      {/* Preview Thumbnail / Authentic Document Page View */}
                      <div className="flex-1 w-full flex items-center justify-center overflow-hidden rounded-lg bg-[#1E1F22] relative mt-1">
                        {file.isImage && file.url ? (
                          <img src={file.url} alt={file.name} className="w-full h-full object-cover" />
                        ) : file.isImage && !file.url ? (
                          <div className="w-full h-full bg-[#2A2B2E] flex flex-col items-center justify-center p-2 text-center relative overflow-hidden">
                            <div className="absolute inset-0 opacity-20 flex items-center justify-center">
                              <FileIconBadge fileName={file.name} size={72} />
                            </div>
                            <div className="z-10 flex flex-col items-center justify-center space-y-1">
                              <FileIconBadge fileName={file.name} size={48} />
                              <span className="text-[8px] font-black uppercase tracking-wider text-purple-300 bg-black/80 px-2 py-0.5 rounded border border-purple-800 shadow-sm">
                                {file.name.split('.').pop()?.toUpperCase() || 'IMG'}
                              </span>
                            </div>
                          </div>
                        ) : file.fileTypeCategory === 'docx' ? (
                          /* Realistic Word Document Page Preview */
                          <div className="w-full h-full bg-[#FAFAFA] p-2 flex flex-col justify-between text-stone-900 overflow-hidden relative shadow-inner">
                            {/* Word Header */}
                            <div className="flex items-center gap-1 border-b-2 border-blue-600 pb-1 mb-1">
                              <FileText className="w-3 h-3 text-blue-600 shrink-0" />
                              <span className="text-[7.5px] font-black uppercase tracking-wider text-blue-900">DOCUMENT WORD</span>
                            </div>
                            {/* Document Content Sheet */}
                            <div className="space-y-1.5 flex-1 overflow-hidden font-sans">
                              <div className="text-[9px] font-extrabold text-stone-900 leading-tight line-clamp-2">
                                {file.textContent || file.name.replace(/\.[^/.]+$/, "")}
                              </div>
                              <div className="space-y-1 pt-0.5">
                                <div className="h-1 bg-stone-300 rounded w-full"></div>
                                <div className="h-1 bg-stone-300 rounded w-11/12"></div>
                                <div className="h-1 bg-stone-200 rounded w-4/5"></div>
                                <div className="h-1 bg-stone-300 rounded w-full"></div>
                                <div className="h-1 bg-stone-200 rounded w-3/4"></div>
                              </div>
                              <div className="text-[6.5px] text-stone-600 line-clamp-3 leading-relaxed bg-white p-1 rounded border border-stone-200 shadow-2xs font-mono">
                                {file.textContent && file.textContent.length > 15 ? file.textContent : `Introduction du document ${file.name}. Ce fichier contient les notes et analyses détaillées...`}
                              </div>
                            </div>
                            <div className="absolute bottom-1 right-1 opacity-10 pointer-events-none">
                              <FileIconBadge fileName={file.name} size={36} />
                            </div>
                          </div>
                        ) : file.fileTypeCategory === 'xlsx' && file.tableRows && file.tableRows.length > 0 ? (
                          /* Excel Spreadsheet Table Preview */
                          <div className="w-full h-full bg-white p-1.5 flex flex-col justify-between text-stone-900 overflow-hidden relative shadow-inner text-[6.5px]">
                            <div className="flex items-center gap-1 border-b border-emerald-600 pb-0.5 mb-1 bg-emerald-50 px-1 rounded">
                              <Table className="w-2.5 h-2.5 text-emerald-700 shrink-0" />
                              <span className="font-black uppercase tracking-wider text-emerald-900">
                                TABLEAU EXCEL
                              </span>
                            </div>
                            <div className="overflow-hidden flex-1 space-y-0.5 font-mono">
                              <table className="w-full border-collapse">
                                <tbody>
                                  {file.tableRows.map((row: any[], rIdx: number) => (
                                    <tr key={rIdx} className={rIdx === 0 ? 'bg-emerald-600 text-white font-bold' : rIdx % 2 === 0 ? 'bg-stone-100' : 'bg-white'}>
                                      {row.map((cell: any, cIdx: number) => (
                                        <td key={cIdx} className="px-1 py-0.5 border border-stone-300 truncate max-w-[40px]">
                                          {cell !== undefined && cell !== null ? String(cell) : ''}
                                        </td>
                                      ))}
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        ) : file.fileTypeCategory === 'pptx' ? (
                          /* PowerPoint Presentation Slide Preview */
                          <div className="w-full h-full bg-gradient-to-br from-orange-500 to-amber-600 p-2 flex flex-col justify-between text-white overflow-hidden relative shadow-inner">
                            <div className="flex items-center gap-1 border-b border-white/30 pb-1">
                              <Presentation className="w-3 h-3 text-white shrink-0" />
                              <span className="text-[7.5px] font-black uppercase tracking-wider">DIAPORAMA PPT</span>
                            </div>
                            <div className="my-auto py-2 text-center space-y-1">
                              <div className="text-[9px] font-black leading-tight line-clamp-2 drop-shadow-sm">
                                {file.textContent}
                              </div>
                              <div className="w-8 h-1 bg-white/60 mx-auto rounded-full"></div>
                            </div>
                            <div className="text-[6.5px] text-white/80 text-center font-mono truncate">
                              {file.name}
                            </div>
                          </div>
                        ) : (
                          /* Document Text / PDF Preview */
                          <div className="w-full h-full bg-white p-2.5 flex flex-col justify-between text-stone-900 overflow-hidden relative shadow-inner">
                            <div className="space-y-1">
                              <div className="flex items-center gap-1 border-b border-stone-200 pb-1">
                                <FileText className="w-3 h-3 text-orange-600 shrink-0" />
                                <span className="text-[8px] font-bold uppercase tracking-wider text-stone-600 truncate">
                                  {file.name.split('.').pop() || 'DOC'}
                                </span>
                              </div>
                              <div className="text-[7.5px] leading-tight text-stone-700 font-mono line-clamp-6 select-none whitespace-pre-wrap">
                                {file.textContent ? file.textContent : `Aperçu de la première page : ${file.name}...`}
                              </div>
                            </div>
                            <div className="absolute bottom-1 right-1 opacity-10 pointer-events-none">
                              <FileIconBadge fileName={file.name} size={40} />
                            </div>
                          </div>
                        )}
                      </div>

                      {/* File name at bottom */}
                      <div className="mt-1.5 px-0.5">
                        <p className="text-[10px] font-bold text-stone-100 line-clamp-1 leading-tight break-all" title={file.name}>
                          {file.name}
                        </p>
                      </div>

                      {/* If individual mode, two small inputs at the bottom of each file card */}
                      {infoMode === 'individual' && (
                        <div className="mt-2 pt-1.5 border-t border-stone-700 space-y-1">
                          <input
                            type="text"
                            value={file.fileSchool || ''}
                            onChange={(e) => {
                              const val = e.target.value;
                              setSelectedFiles(prev => prev.map(f => f.id === file.id ? { ...f, fileSchool: val } : f));
                            }}
                            placeholder="École..."
                            className="w-full bg-white border-2 border-orange-500 rounded px-1.5 py-1 text-[9px] font-bold text-stone-900 placeholder:text-stone-400 shadow-[1px_1px_0px_0px_#1c1917] focus:outline-none"
                          />
                          <input
                            type="text"
                            value={file.fileFiliere || ''}
                            onChange={(e) => {
                              const val = e.target.value;
                              setSelectedFiles(prev => prev.map(f => f.id === file.id ? { ...f, fileFiliere: val } : f));
                            }}
                            placeholder="Filière..."
                            className="w-full bg-white border-2 border-orange-500 rounded px-1.5 py-1 text-[9px] font-bold text-stone-900 placeholder:text-stone-400 shadow-[1px_1px_0px_0px_#1c1917] focus:outline-none"
                          />
                        </div>
                      )}
                    </div>
                  ))}

                  {/* Dashed square button with plus to add more files */}
                  <label className="aspect-[3/4] bg-white hover:bg-stone-50 border-2 border-dashed border-stone-400 hover:border-orange-600 rounded-xl p-3 flex flex-col items-center justify-center cursor-pointer transition-all shadow-[2px_2px_0px_0px_#1c1917] group">
                    <div className="w-9 h-9 rounded-full bg-orange-100 group-hover:bg-orange-200 text-orange-600 flex items-center justify-center transition-colors mb-2 shadow-sm">
                      <Plus className="w-5 h-5 stroke-[2.5]" />
                    </div>
                    <span className="text-[10px] font-extrabold text-stone-800 text-center">Ajouter</span>
                    <input type="file" multiple onChange={handleFileChange} className="hidden" />
                  </label>
                </div>

                {/* Conditional fields based on infoMode */}
                {infoMode === 'all' && (
                  <div className="mt-4 pt-3 border-t border-stone-300 flex flex-col sm:flex-row gap-3 max-w-lg">
                    <div className="flex-1">
                      <label className="block text-[10px] font-bold text-stone-700 mb-1">École</label>
                      <input
                        type="text"
                        value={school}
                        onChange={(e) => setSchool(e.target.value)}
                        placeholder="Provenance de l'école..."
                        className="w-full bg-white border-2 border-stone-800 rounded-xl px-3 py-1.5 text-xs font-medium text-stone-900 placeholder:text-stone-400 shadow-[2px_2px_0px_0px_#1c1917] focus:outline-none"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="block text-[10px] font-bold text-stone-700 mb-1">Filière</label>
                      <input
                        type="text"
                        value={filiere}
                        onChange={(e) => setFiliere(e.target.value)}
                        placeholder="Nom de la filière..."
                        className="w-full bg-white border-2 border-stone-800 rounded-xl px-3 py-1.5 text-xs font-medium text-stone-900 placeholder:text-stone-400 shadow-[2px_2px_0px_0px_#1c1917] focus:outline-none"
                      />
                    </div>
                  </div>
                )}

                {infoMode === 'none' && (
                  <div className="mt-4 pt-3 border-t border-stone-300 text-xs text-stone-500 font-medium italic">
                    Aucune information d'école ou de filière ne sera associée à ces fichiers.
                  </div>
                )}

                {/* 3 Option buttons */}
                <div className="mt-6 pt-4 border-t-2 border-stone-300 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setInfoMode('all')}
                    className={`px-3 py-2 rounded-xl border-2 border-stone-800 text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${infoMode === 'all' ? 'bg-[#2D4A3E] text-white shadow-[2px_2px_0px_0px_#1c1917]' : 'bg-white text-stone-800 hover:bg-stone-50 shadow-[1px_1px_0px_0px_#1c1917]'}`}
                  >
                    <span>Appliquer l'information à tous</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setInfoMode('individual')}
                    className={`px-3 py-2 rounded-xl border-2 border-stone-800 text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${infoMode === 'individual' ? 'bg-[#2D4A3E] text-white shadow-[2px_2px_0px_0px_#1c1917]' : 'bg-white text-stone-800 hover:bg-stone-50 shadow-[1px_1px_0px_0px_#1c1917]'}`}
                  >
                    <span>Informations individuelles</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setInfoMode('none')}
                    className={`px-3 py-2 rounded-xl border-2 border-stone-800 text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${infoMode === 'none' ? 'bg-[#2D4A3E] text-white shadow-[2px_2px_0px_0px_#1c1917]' : 'bg-white text-stone-800 hover:bg-stone-50 shadow-[1px_1px_0px_0px_#1c1917]'}`}
                  >
                    <span>Aucune information</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Publishing loading modal overlay with rotating arrow */}
      {isPublishing && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border-2 border-stone-900 rounded-2xl p-8 text-center space-y-4 shadow-[4px_4px_0px_0px_#1c1917] max-w-sm w-full">
            <div className="w-16 h-16 rounded-full bg-orange-100 flex items-center justify-center mx-auto border-2 border-stone-900 shadow-[2px_2px_0px_0px_#1c1917]">
              <RefreshCw className="w-8 h-8 text-orange-600 animate-spin" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-black text-stone-900">Publication en cours...</h3>
              <p className="text-xs text-stone-500">Veuillez patienter pendant le traitement et la validation de vos documents.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
