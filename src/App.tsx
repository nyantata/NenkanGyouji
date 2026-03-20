import React, { useState, useRef, useEffect } from 'react';
import { Upload, FileText, Calendar, Download, CheckSquare, Square, AlertCircle, Loader2, RefreshCw, Trash2 } from 'lucide-react';
import { SchoolEvent } from './types';
import { analyzeCalendar } from './lib/gemini';
import { exportToCSV } from './lib/export';
import * as XLSX from 'xlsx';

export default function App() {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [events, setEvents] = useState<SchoolEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(new Set());
  const [selectedMonths, setSelectedMonths] = useState<Set<number>>(new Set());
  const [selectedTargets, setSelectedTargets] = useState<Set<string>>(new Set());
  const [editingCell, setEditingCell] = useState<{id: string, field: keyof SchoolEvent} | null>(null);
  const [hasSavedData, setHasSavedData] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const saved = localStorage.getItem('calendar_app_data');
    if (saved) {
      setHasSavedData(true);
    }
  }, []);

  useEffect(() => {
    if (events.length > 0) {
      const dataToSave = {
        step,
        events,
        selectedCategories: Array.from(selectedCategories),
        selectedMonths: Array.from(selectedMonths),
        selectedTargets: Array.from(selectedTargets),
      };
      localStorage.setItem('calendar_app_data', JSON.stringify(dataToSave));
    }
  }, [events, selectedCategories, selectedMonths, selectedTargets, step]);

  const loadSavedData = () => {
    const saved = localStorage.getItem('calendar_app_data');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setEvents(parsed.events || []);
        setSelectedCategories(new Set(parsed.selectedCategories || []));
        setSelectedMonths(new Set(parsed.selectedMonths || []));
        setSelectedTargets(new Set(parsed.selectedTargets || []));
        setStep(parsed.step || 2);
        setHasSavedData(false);
      } catch (e) {
        console.error("Failed to load saved data", e);
      }
    }
  };

  const clearSavedData = () => {
    localStorage.removeItem('calendar_app_data');
    setHasSavedData(false);
    setEvents([]);
    setStep(1);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setError(null);

    try {
      let fileData = '';
      let fileText = '';
      const mimeType = file.type;

      if (file.type === 'application/pdf') {
        const buffer = await file.arrayBuffer();
        fileData = btoa(new Uint8Array(buffer).reduce((data, byte) => data + String.fromCharCode(byte), ''));
      } else if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
        const buffer = await file.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        fileText = XLSX.utils.sheet_to_csv(worksheet);
      } else if (file.name.endsWith('.csv')) {
        fileText = await file.text();
      } else {
        throw new Error('Unsupported file format. Please upload PDF, Excel, or CSV.');
      }

      const parsedEvents = await analyzeCalendar(fileData, mimeType, fileText);
      
      const eventsWithId: SchoolEvent[] = parsedEvents.map((ev, i) => ({
        ...ev,
        id: `event-${i}-${Date.now()}`,
        selected: true
      }));

      setEvents(eventsWithId);
      
      // Initialize filters
      const cats = new Set(eventsWithId.map(ev => ev.category || '未分類'));
      const tgts = new Set(eventsWithId.map(ev => ev.target || '未指定'));
      const mos = new Set([1,2,3,4,5,6,7,8,9,10,11,12]);
      
      setSelectedCategories(cats);
      setSelectedTargets(tgts);
      setSelectedMonths(mos);
      
      setStep(2);
    } catch (err: any) {
      setError(err.message || 'An error occurred during analysis.');
    } finally {
      setLoading(false);
    }
  };

  const toggleEventSelection = (id: string) => {
    setEvents(events.map(e => e.id === id ? { ...e, selected: !e.selected } : e));
  };

  const toggleAllEvents = (selected: boolean) => {
    setEvents(events.map(e => ({ ...e, selected })));
  };

  const handleCellChange = (id: string, field: keyof SchoolEvent, value: string) => {
    setEvents(events.map(e => e.id === id ? { ...e, [field]: value } : e));
    
    // Automatically add new categories/targets to filters if they are changed inline
    if (field === 'category') {
      const cat = value || '未分類';
      if (!selectedCategories.has(cat)) {
        setSelectedCategories(new Set([...selectedCategories, cat]));
      }
    }
    if (field === 'target') {
      const tgt = value || '未指定';
      if (!selectedTargets.has(tgt)) {
        setSelectedTargets(new Set([...selectedTargets, tgt]));
      }
    }
  };

  const toggleFilter = (set: Set<any>, value: any, setter: React.Dispatch<React.SetStateAction<Set<any>>>) => {
    const newSet = new Set(set);
    if (newSet.has(value)) {
      newSet.delete(value);
    } else {
      newSet.add(value);
    }
    setter(newSet);
  };

  const availableCategories = Array.from(new Set(events.map(e => e.category || '未分類'))).sort();
  const availableTargets = Array.from(new Set(events.map(e => e.target || '未指定'))).sort();
  const availableMonths = [4, 5, 6, 7, 8, 9, 10, 11, 12, 1, 2, 3];

  const filteredEvents = events.filter(e => {
    const cat = e.category || '未分類';
    const tgt = e.target || '未指定';
    
    let monthMatch = false;
    const match = e.date?.match(/^\d{4}-(\d{2})-\d{2}$/);
    if (match) {
      monthMatch = selectedMonths.has(parseInt(match[1], 10));
    } else {
      monthMatch = true; // Always show invalid dates so user can fix them
    }

    return selectedCategories.has(cat) && selectedTargets.has(tgt) && monthMatch;
  });

  const selectedCount = filteredEvents.filter(e => e.selected).length;

  const renderCell = (event: SchoolEvent, field: keyof SchoolEvent, placeholder: string = '') => {
    const isEditing = editingCell?.id === event.id && editingCell?.field === field;
    const value = (event[field] as string) || '';
    
    let isError = false;
    if (field === 'date' && !/^\d{4}-\d{2}-\d{2}$/.test(value)) isError = true;
    if ((field === 'time_start' || field === 'time_end') && value && !/^([01]\d|2[0-3]):([0-5]\d)$/.test(value)) isError = true;

    if (isEditing) {
      return (
        <input
          autoFocus
          type="text"
          className={`w-full px-2 py-1 text-sm border rounded outline-none focus:ring-2 focus:ring-indigo-500 ${isError ? 'border-red-500 bg-red-50' : 'border-indigo-300'}`}
          value={value}
          onChange={(e) => handleCellChange(event.id, field, e.target.value)}
          onBlur={() => setEditingCell(null)}
          onKeyDown={(e) => e.key === 'Enter' && setEditingCell(null)}
        />
      );
    }

    return (
      <div 
        className={`min-h-[1.5rem] cursor-pointer px-2 py-1 rounded border border-transparent hover:border-neutral-300 hover:bg-white transition-colors flex items-center ${isError ? 'bg-red-100/50 text-red-800 border-red-200' : ''}`}
        onClick={() => setEditingCell({ id: event.id, field })}
        title={isError ? "フォーマットが正しくありません。クリックして修正してください。" : "クリックして編集"}
      >
        {value || <span className="text-neutral-400 italic text-xs">{placeholder}</span>}
        {isError && <AlertCircle className="w-3 h-3 text-red-500 ml-auto shrink-0" />}
      </div>
    );
  };

  const hasRowError = (event: SchoolEvent) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(event.date || '')) return true;
    if (event.time_start && !/^([01]\d|2[0-3]):([0-5]\d)$/.test(event.time_start)) return true;
    if (event.time_end && !/^([01]\d|2[0-3]):([0-5]\d)$/.test(event.time_end)) return true;
    return false;
  };

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900 font-sans">
      <header className="bg-white border-b border-neutral-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="w-6 h-6 text-indigo-600" />
            <h1 className="text-xl font-semibold tracking-tight">年間行事計画エクスポートツール</h1>
          </div>
          <div className="flex items-center gap-4 text-sm font-medium text-neutral-500">
            <span className={step >= 1 ? 'text-indigo-600' : ''}>1. アップロード</span>
            <span className="text-neutral-300">/</span>
            <span className={step >= 2 ? 'text-indigo-600' : ''}>2. レビュー</span>
            <span className="text-neutral-300">/</span>
            <span className={step >= 3 ? 'text-indigo-600' : ''}>3. エクスポート</span>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <div className="mb-8 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3 text-red-700">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <div>
              <h3 className="font-medium">エラーが発生しました</h3>
              <p className="text-sm mt-1">{error}</p>
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="max-w-2xl mx-auto mt-12">
            {hasSavedData && events.length === 0 && (
              <div className="mb-12 p-6 bg-indigo-50 border border-indigo-100 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm">
                <div>
                  <h3 className="font-bold text-indigo-900 flex items-center gap-2">
                    <RefreshCw className="w-5 h-5" />
                    前回の作業データが残っています
                  </h3>
                  <p className="text-sm text-indigo-700 mt-1">途中で終了した編集作業を再開できます。</p>
                </div>
                <div className="flex gap-3 w-full sm:w-auto">
                  <button onClick={clearSavedData} className="px-4 py-2 text-sm font-medium text-indigo-600 bg-white border border-indigo-200 rounded-lg hover:bg-indigo-50 flex items-center justify-center gap-2 flex-1 sm:flex-none">
                    <Trash2 className="w-4 h-4" />
                    破棄する
                  </button>
                  <button onClick={loadSavedData} className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 flex items-center justify-center gap-2 flex-1 sm:flex-none">
                    復元して再開
                  </button>
                </div>
              </div>
            )}

            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold tracking-tight mb-3">行事予定表をアップロード</h2>
              <p className="text-neutral-500">PDF、Excel、CSVファイルからAIが行事を自動抽出します。</p>
            </div>

            <div 
              className={`border-2 border-dashed rounded-2xl p-12 text-center transition-colors ${
                loading ? 'border-indigo-300 bg-indigo-50' : 'border-neutral-300 hover:border-indigo-400 hover:bg-indigo-50/50 cursor-pointer'
              }`}
              onClick={() => !loading && fileInputRef.current?.click()}
            >
              <input 
                type="file" 
                ref={fileInputRef} 
                className="hidden" 
                accept=".pdf,.xlsx,.xls,.csv" 
                onChange={handleFileUpload}
                disabled={loading}
              />
              
              {loading ? (
                <div className="flex flex-col items-center">
                  <Loader2 className="w-12 h-12 text-indigo-600 animate-spin mb-4" />
                  <p className="text-lg font-medium text-indigo-900">AIが解析中...</p>
                  <p className="text-sm text-indigo-600/70 mt-2">これには数分かかる場合があります</p>
                </div>
              ) : (
                <div className="flex flex-col items-center">
                  <div className="w-16 h-16 bg-white rounded-full shadow-sm flex items-center justify-center mb-4">
                    <Upload className="w-8 h-8 text-indigo-600" />
                  </div>
                  <p className="text-lg font-medium text-neutral-900">クリックしてファイルを選択</p>
                  <p className="text-sm text-neutral-500 mt-2">対応形式: PDF, Excel (.xlsx), CSV</p>
                </div>
              )}
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold tracking-tight">抽出結果のレビュー</h2>
                <p className="text-neutral-500 mt-1">
                  セルをクリックして直接編集できます。赤くハイライトされた箇所はフォーマットを修正してください。
                </p>
              </div>
              <div className="flex gap-3">
                <button 
                  onClick={() => setStep(1)}
                  className="px-4 py-2 text-sm font-medium text-neutral-700 bg-white border border-neutral-300 rounded-lg hover:bg-neutral-50"
                >
                  再アップロード
                </button>
                <button 
                  onClick={() => setStep(3)}
                  disabled={selectedCount === 0}
                  className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  次へ ({selectedCount}件選択)
                </button>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-neutral-200 overflow-hidden">
              <div className="p-4 border-b border-neutral-200 bg-neutral-50 space-y-4">
                
                {/* 月フィルタ */}
                <div className="flex items-start gap-4">
                  <div className="w-24 pt-1 flex flex-col gap-1.5 shrink-0">
                    <span className="text-sm font-medium text-neutral-700">月:</span>
                    <div className="flex gap-1">
                      <button onClick={() => setSelectedMonths(new Set(availableMonths))} className="text-[10px] px-1.5 py-0.5 bg-neutral-200 hover:bg-neutral-300 rounded text-neutral-700 transition-colors">全選択</button>
                      <button onClick={() => setSelectedMonths(new Set())} className="text-[10px] px-1.5 py-0.5 bg-neutral-200 hover:bg-neutral-300 rounded text-neutral-700 transition-colors">全解除</button>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 flex-1">
                    {availableMonths.map(m => (
                      <button
                        key={`month-${m}`}
                        onClick={() => toggleFilter(selectedMonths, m, setSelectedMonths)}
                        className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
                          selectedMonths.has(m) 
                            ? 'bg-indigo-100 text-indigo-800 border border-indigo-200' 
                            : 'bg-white text-neutral-500 border border-neutral-200 hover:bg-neutral-50'
                        }`}
                      >
                        {m}月
                      </button>
                    ))}
                  </div>
                </div>

                {/* カテゴリフィルタ */}
                <div className="flex items-start gap-4">
                  <div className="w-24 pt-1 flex flex-col gap-1.5 shrink-0">
                    <span className="text-sm font-medium text-neutral-700">カテゴリ:</span>
                    <div className="flex gap-1">
                      <button onClick={() => setSelectedCategories(new Set(availableCategories))} className="text-[10px] px-1.5 py-0.5 bg-neutral-200 hover:bg-neutral-300 rounded text-neutral-700 transition-colors">全選択</button>
                      <button onClick={() => setSelectedCategories(new Set())} className="text-[10px] px-1.5 py-0.5 bg-neutral-200 hover:bg-neutral-300 rounded text-neutral-700 transition-colors">全解除</button>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 flex-1">
                    {availableCategories.map(cat => (
                      <button
                        key={`cat-${cat}`}
                        onClick={() => toggleFilter(selectedCategories, cat, setSelectedCategories)}
                        className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
                          selectedCategories.has(cat) 
                            ? 'bg-indigo-100 text-indigo-800 border border-indigo-200' 
                            : 'bg-white text-neutral-500 border border-neutral-200 hover:bg-neutral-50'
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 対象学年フィルタ */}
                <div className="flex items-start gap-4">
                  <div className="w-24 pt-1 flex flex-col gap-1.5 shrink-0">
                    <span className="text-sm font-medium text-neutral-700">対象学年:</span>
                    <div className="flex gap-1">
                      <button onClick={() => setSelectedTargets(new Set(availableTargets))} className="text-[10px] px-1.5 py-0.5 bg-neutral-200 hover:bg-neutral-300 rounded text-neutral-700 transition-colors">全選択</button>
                      <button onClick={() => setSelectedTargets(new Set())} className="text-[10px] px-1.5 py-0.5 bg-neutral-200 hover:bg-neutral-300 rounded text-neutral-700 transition-colors">全解除</button>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 flex-1">
                    {availableTargets.map(tgt => (
                      <button
                        key={`tgt-${tgt}`}
                        onClick={() => toggleFilter(selectedTargets, tgt, setSelectedTargets)}
                        className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
                          selectedTargets.has(tgt) 
                            ? 'bg-indigo-100 text-indigo-800 border border-indigo-200' 
                            : 'bg-white text-neutral-500 border border-neutral-200 hover:bg-neutral-50'
                        }`}
                      >
                        {tgt}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-end gap-4 text-sm pt-2 border-t border-neutral-200">
                  <button onClick={() => toggleAllEvents(true)} className="text-indigo-600 hover:text-indigo-800 font-medium">すべて選択</button>
                  <button onClick={() => toggleAllEvents(false)} className="text-neutral-500 hover:text-neutral-700 font-medium">選択解除</button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="text-xs text-neutral-500 uppercase bg-neutral-50 border-b border-neutral-200">
                    <tr>
                      <th className="px-4 py-3 w-12 text-center">選択</th>
                      <th className="px-4 py-3 w-32">日付 (YYYY-MM-DD)</th>
                      <th className="px-4 py-3 min-w-[12rem]">行事名</th>
                      <th className="px-4 py-3 w-32">カテゴリ</th>
                      <th className="px-4 py-3 w-32">対象学年</th>
                      <th className="px-4 py-3 w-24">開始 (HH:MM)</th>
                      <th className="px-4 py-3 w-24">終了 (HH:MM)</th>
                      <th className="px-4 py-3 min-w-[12rem]">備考</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-200">
                    {filteredEvents.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="px-4 py-8 text-center text-neutral-500">
                          表示する行事がありません。
                        </td>
                      </tr>
                    ) : (
                      filteredEvents.map((event) => (
                        <tr key={event.id} className={`transition-colors ${!event.selected ? 'opacity-50' : ''} ${hasRowError(event) ? 'bg-red-50/30' : 'hover:bg-neutral-50'}`}>
                          <td className="px-4 py-3 text-center">
                            <button onClick={() => toggleEventSelection(event.id)} className="text-indigo-600 focus:outline-none">
                              {event.selected ? <CheckSquare className="w-5 h-5" /> : <Square className="w-5 h-5 text-neutral-300" />}
                            </button>
                          </td>
                          <td className="px-2 py-2">{renderCell(event, 'date', 'YYYY-MM-DD')}</td>
                          <td className="px-2 py-2 font-medium">{renderCell(event, 'title', '行事名')}</td>
                          <td className="px-2 py-2">{renderCell(event, 'category', '未分類')}</td>
                          <td className="px-2 py-2">{renderCell(event, 'target', '未指定')}</td>
                          <td className="px-2 py-2">{renderCell(event, 'time_start', '終日')}</td>
                          <td className="px-2 py-2">{renderCell(event, 'time_end', '-')}</td>
                          <td className="px-2 py-2">{renderCell(event, 'notes', '-')}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="max-w-2xl mx-auto mt-12">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold tracking-tight mb-3">エクスポート</h2>
              <p className="text-neutral-500">選択した {selectedCount} 件の行事をダウンロードします。</p>
            </div>

            <div className="max-w-md mx-auto">
              <div className="bg-white p-8 rounded-2xl border border-neutral-200 shadow-sm flex flex-col items-center text-center">
                <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center mb-4">
                  <FileText className="w-8 h-8 text-emerald-600" />
                </div>
                <h3 className="text-lg font-bold text-neutral-900 mb-2">CSV形式</h3>
                <p className="text-sm text-neutral-500 mb-6">
                  Googleカレンダーの公式インポート形式に準拠したCSVファイルです。Excelで編集したい場合にも便利です。
                </p>
                <button 
                  onClick={() => exportToCSV(filteredEvents.filter(e => e.selected))}
                  className="mt-auto w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-xl transition-colors flex items-center justify-center gap-2"
                >
                  <Download className="w-5 h-5" />
                  CSVをダウンロード
                </button>
              </div>
            </div>

            <div className="mt-8 text-center">
              <button 
                onClick={() => setStep(2)}
                className="text-sm font-medium text-neutral-500 hover:text-neutral-900 transition-colors"
              >
                ← レビュー画面に戻る
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

