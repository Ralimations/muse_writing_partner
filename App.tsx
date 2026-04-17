
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Sidebar } from './components/Sidebar';
import { Editor } from './components/Editor';
import { Attachment, Suggestion, WritingMode } from './types';
import { generateInitialDraft, getProactiveSuggestions, checkGrammar } from './services/geminiService';

const STORAGE_KEY = 'muse_draft_save';
const AUTO_SAVE_INTERVAL = 30000; // 30 seconds

const App: React.FC = () => {
  const [content, setContent] = useState<string>('');
  const [past, setPast] = useState<string[]>([]);
  const [future, setFuture] = useState<string[]>([]);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [mode, setMode] = useState<WritingMode>(WritingMode.GENERAL);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved' | 'auto-saving'>('idle');
  const [lastAutoSaveTime, setLastAutoSaveTime] = useState<string | null>(null);
  const [hasSavedDraft, setHasSavedDraft] = useState<boolean>(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(true);
  
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const historyDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedContentRef = useRef<string>('');

  const wordCount = useMemo(() => {
    const plainText = content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    return plainText ? plainText.split(/\s+/).length : 0;
  }, [content]);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      setHasSavedDraft(true);
      try {
        const data = JSON.parse(saved);
        lastSavedContentRef.current = data.content || '';
      } catch(e) {}
    }
  }, []);

  const performSave = useCallback((type: 'manual' | 'auto' = 'manual') => {
    if (content === lastSavedContentRef.current && type === 'auto') return;
    const data = { content, past, future, suggestions, mode, timestamp: new Date().toISOString() };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    lastSavedContentRef.current = content;
    setHasSavedDraft(true);
    const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setLastAutoSaveTime(now);
    if (type === 'manual') {
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    } else {
      setSaveStatus('auto-saving');
      setTimeout(() => setSaveStatus('idle'), 2000);
    }
  }, [content, past, future, suggestions, mode]);

  const saveDraft = () => performSave('manual');

  useEffect(() => {
    const timer = setInterval(() => performSave('auto'), AUTO_SAVE_INTERVAL);
    return () => clearInterval(timer);
  }, [performSave]);

  const pushToHistory = useCallback((newContent: string) => {
    if (newContent === content) return;
    setPast(prev => [...prev, content]);
    setFuture([]);
    setContent(newContent);
  }, [content]);

  const undo = useCallback(() => {
    if (past.length === 0) return;
    const previous = past[past.length - 1];
    const newPast = past.slice(0, past.length - 1);
    setFuture(prev => [content, ...prev]);
    setPast(newPast);
    setContent(previous);
  }, [past, content]);

  const redo = useCallback(() => {
    if (future.length === 0) return;
    const next = future[0];
    const newFuture = future.slice(1);
    setPast(prev => [...prev, content]);
    setFuture(newFuture);
    setContent(next);
  }, [future, content]);

  const handleGenerate = async (prompt: string, attachments: Attachment[]) => {
    setIsGenerating(true);
    try {
      const draft = await generateInitialDraft(prompt, attachments, mode);
      pushToHistory(draft);
    } catch (error) {
      console.error("Draft generation failed", error);
    } finally {
      setIsGenerating(false);
    }
  };

  const applySuggestion = (suggestion: Suggestion) => {
    const escaped = suggestion.originalText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const newContent = content.replace(new RegExp(escaped, 'g'), suggestion.suggestedText);
    pushToHistory(newContent);
    setSuggestions(prev => prev.filter(s => s.id !== suggestion.id));
  };

  const triggerSuggestions = useCallback(async (text: string) => {
    const plainText = text.replace(/<[^>]*>/g, ' ').trim();
    if (plainText.length < 20 || isGenerating) return;
    try {
      const [creative, technical] = await Promise.all([
        getProactiveSuggestions(plainText, mode),
        checkGrammar(plainText)
      ]);
      const mappedCreative = creative.map((n: any, i: number) => ({ ...n, id: `creative-${Math.random().toString(36).substr(2, 9)}`, index: i, isGrammar: false }));
      const mappedTechnical = technical.map((n: any, i: number) => ({ ...n, id: `grammar-${Math.random().toString(36).substr(2, 9)}`, index: i, isGrammar: true }));
      setSuggestions([...mappedTechnical, ...mappedCreative].slice(0, 8));
    } catch (e) {}
  }, [isGenerating, mode]);

  const handleEditorChange = (newContent: string) => {
    setContent(newContent);
    if (historyDebounceRef.current) clearTimeout(historyDebounceRef.current);
    historyDebounceRef.current = setTimeout(() => {
      setPast(prev => {
        const last = prev[prev.length - 1];
        if (last === newContent) return prev;
        return [...prev, content];
      });
      setFuture([]);
    }, 1000); 
  };

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (content.trim()) {
      debounceRef.current = setTimeout(() => triggerSuggestions(content), 5000);
    }
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (historyDebounceRef.current) clearTimeout(historyDebounceRef.current);
    };
  }, [content, triggerSuggestions]);

  const modeThemes = {
    [WritingMode.GENERAL]: 'bg-indigo-600',
    [WritingMode.ACADEMIC]: 'bg-blue-600',
    [WritingMode.POEM]: 'bg-purple-600',
    [WritingMode.LYRICS]: 'bg-pink-600',
  };

  return (
    <div className="flex min-h-screen bg-zinc-50 selection:bg-indigo-100">
      <Sidebar 
        onGenerate={handleGenerate} 
        suggestions={suggestions}
        onApplySuggestion={applySuggestion}
        isGenerating={isGenerating}
        mode={mode}
        onModeChange={setMode}
        isOpen={isSidebarOpen}
        setIsOpen={setIsSidebarOpen}
      />
      
      <main className={`flex-1 flex flex-col transition-all duration-500 ease-in-out ${isSidebarOpen ? 'md:ml-80' : 'ml-0'}`}>
        <header className="z-30 bg-white/80 backdrop-blur-md px-8 py-3 flex justify-between items-center border-b border-zinc-200">
          <div className="flex items-center gap-6">
             <div className="flex items-center gap-3">
               <div className={`w-9 h-9 rounded-xl ${modeThemes[mode]} flex items-center justify-center text-white font-bold shadow-sm transition-colors duration-500`}>M</div>
               <div className="flex flex-col">
                 <div className="flex items-center gap-2">
                   <span className="text-sm font-semibold text-zinc-900">Untitled Document</span>
                   <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold uppercase border ${
                     mode === WritingMode.ACADEMIC ? 'bg-blue-50 border-blue-100 text-blue-600' :
                     mode === WritingMode.POEM ? 'bg-purple-50 border-purple-100 text-purple-600' :
                     mode === WritingMode.LYRICS ? 'bg-pink-50 border-pink-100 text-pink-600' :
                     'bg-zinc-50 border-zinc-100 text-zinc-500'
                   }`}>{mode}</span>
                 </div>
                 <div className="flex items-center gap-2 mt-0.5">
                   <span className="text-[10px] text-zinc-400 uppercase font-bold tracking-tighter">{wordCount} words</span>
                   {lastAutoSaveTime && <span className="text-[10px] text-zinc-400 font-medium ml-1">Saved {lastAutoSaveTime}</span>}
                 </div>
               </div>
             </div>
          </div>
          <div className="flex items-center gap-2">
             <button onClick={saveDraft} className={`flex items-center gap-2 px-3 py-1.5 border rounded-lg text-xs font-bold shadow-sm transition-all active:scale-95 ${saveStatus === 'saved' ? 'bg-green-50 border-green-200 text-green-700' : 'bg-white border-zinc-200 text-zinc-700 hover:bg-zinc-50'}`}>
                {saveStatus === 'saved' ? 'Saved' : 'Save'}
             </button>
             <button className="px-3 py-1.5 bg-zinc-900 text-white text-xs font-bold rounded-lg hover:bg-zinc-800">Share</button>
          </div>
        </header>

        <div className="flex-1 overflow-hidden">
          <Editor 
            content={content} 
            onChange={handleEditorChange}
            onManualAction={pushToHistory}
            onUndo={undo}
            onRedo={redo}
            isGenerating={isGenerating}
            suggestions={suggestions}
            mode={mode}
            theme="light"
            onManualCheck={() => triggerSuggestions(content)}
          />
        </div>
      </main>
    </div>
  );
};

export default App;
