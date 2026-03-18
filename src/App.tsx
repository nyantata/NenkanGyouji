import React, { useState, useRef } from 'react';
import { Upload, FileText, Calendar, Download, CheckSquare, Square, Trash2, Edit2, Loader2, AlertCircle } from 'lucide-react';
import { SchoolEvent, CATEGORIES } from './types';
import { analyzeCalendar } from './lib/gemini';
import { exportToICS, exportToCSV } from './lib/export';
import * as XLSX from 'xlsx';

export default function App() {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [events, setEvents] = useState<SchoolEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(new Set(CATEGORIES.map(c => c.id)));
  
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      
      const eventsWithId: SchoolEvent[] = parsedEvents.map((e, i) => ({
        ...e,
        id: `event-${i}-${Date.now()}`,
        selected: true
      }));

      setEvents(eventsWithId);
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

  const toggleCategory = (categoryId: string) => {
    const newSelected = new Set(selectedCategories);
    if (newSelected.has(categoryId)) {
      newSelected.delete(categoryId);
    } else {
      newSelected.add(categoryId);
    }
    setSelectedCategories(newSelected);
  };

  const filteredEvents = events.filter(e => selectedCategories.has(e.category));
  const selectedCount = filteredEvents.filter(e => e.selected).length;

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
                <p className="text-neutral-500 mt-1">AIが抽出した行事を確認し、エクスポートする対象を選択してください。</p>
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
              <div className="p-4 border-b border-neutral-200 bg-neutral-50 flex flex-wrap gap-4 items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-neutral-700">カテゴリフィルタ:</span>
                  <div className="flex flex-wrap gap-2">
                    {CATEGORIES.map(cat => (
                      <button
                        key={cat.id}
                        onClick={() => toggleCategory(cat.id)}
                        className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
                          selectedCategories.has(cat.id) 
                            ? 'bg-indigo-100 text-indigo-800 border border-indigo-200' 
                            : 'bg-white text-neutral-500 border border-neutral-200 hover:bg-neutral-50'
                        }`}
                      >
                        {cat.name}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-4 text-sm">
                  <button onClick={() => toggleAllEvents(true)} className="text-indigo-600 hover:text-indigo-800 font-medium">すべて選択</button>
                  <button onClick={() => toggleAllEvents(false)} className="text-neutral-500 hover:text-neutral-700 font-medium">選択解除</button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="text-xs text-neutral-500 uppercase bg-neutral-50 border-b border-neutral-200">
                    <tr>
                      <th className="px-4 py-3 w-12 text-center">選択</th>
                      <th className="px-4 py-3">日付</th>
                      <th className="px-4 py-3">行事名</th>
                      <th className="px-4 py-3">カテゴリ</th>
                      <th className="px-4 py-3">対象学年</th>
                      <th className="px-4 py-3">時間</th>
                      <th className="px-4 py-3">備考</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-200">
                    {filteredEvents.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-8 text-center text-neutral-500">
                          表示する行事がありません。
                        </td>
                      </tr>
                    ) : (
                      filteredEvents.map((event) => (
                        <tr key={event.id} className={`hover:bg-neutral-50 transition-colors ${!event.selected ? 'opacity-50' : ''}`}>
                          <td className="px-4 py-3 text-center">
                            <button onClick={() => toggleEventSelection(event.id)} className="text-indigo-600 focus:outline-none">
                              {event.selected ? <CheckSquare className="w-5 h-5" /> : <Square className="w-5 h-5 text-neutral-300" />}
                            </button>
                          </td>
                          <td className="px-4 py-3 font-medium text-neutral-900 whitespace-nowrap">{event.date}</td>
                          <td className="px-4 py-3 font-medium text-neutral-900">{event.title}</td>
                          <td className="px-4 py-3">
                            <span className="px-2.5 py-1 text-xs font-medium bg-neutral-100 text-neutral-700 rounded-md">
                              {CATEGORIES.find(c => c.id === event.category)?.name || event.category}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-neutral-600">{event.target || '-'}</td>
                          <td className="px-4 py-3 text-neutral-600 whitespace-nowrap">
                            {event.time_start ? `${event.time_start}${event.time_end ? ` - ${event.time_end}` : ''}` : '終日'}
                          </td>
                          <td className="px-4 py-3 text-neutral-600 max-w-xs truncate" title={event.notes || ''}>
                            {event.notes || '-'}
                          </td>
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
              <p className="text-neutral-500">選択した {selectedCount} 件の行事をカレンダー形式でダウンロードします。</p>
            </div>

            <div className="grid sm:grid-cols-2 gap-6">
              <div className="bg-white p-8 rounded-2xl border border-neutral-200 shadow-sm flex flex-col items-center text-center">
                <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mb-4">
                  <Calendar className="w-8 h-8 text-blue-600" />
                </div>
                <h3 className="text-lg font-bold text-neutral-900 mb-2">ICS形式 (iCal)</h3>
                <p className="text-sm text-neutral-500 mb-6">
                  Googleカレンダー、Appleカレンダー、Outlookなどに直接インポートできる標準フォーマットです。
                </p>
                <button 
                  onClick={() => exportToICS(filteredEvents.filter(e => e.selected))}
                  className="mt-auto w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl transition-colors flex items-center justify-center gap-2"
                >
                  <Download className="w-5 h-5" />
                  ICSをダウンロード
                </button>
              </div>

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
