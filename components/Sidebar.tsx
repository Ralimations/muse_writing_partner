
import React, { useState, useEffect } from 'react';
import { Attachment, Suggestion, WritingMode } from '../types';

interface SidebarProps {
  onGenerate: (prompt: string, attachments: Attachment[]) => void;
  suggestions: Suggestion[];
  onApplySuggestion: (suggestion: Suggestion) => void;
  isGenerating: boolean;
  mode: WritingMode;
  onModeChange: (mode: WritingMode) => void;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ 
  onGenerate, 
  suggestions, 
  onApplySuggestion, 
  isGenerating,
  mode,
  onModeChange,
  isOpen,
  setIsOpen
}) => {
  const [prompt, setPrompt] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);

  // Auto-minimize when generation starts
  useEffect(() => {
    if (isGenerating) {
      setIsOpen(false);
    }
  }, [isGenerating, setIsOpen]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    (Array.from(files) as File[]).forEach(file => {
      const reader = new FileReader();
      reader.onload = (event) => {
        setAttachments(prev => [...prev, {
          name: file.name,
          type: file.type,
          content: event.target?.result as string
        }]);
      };
      if (file.type.startsWith('image/')) {
        reader.readAsDataURL(file);
      } else {
        reader.readAsText(file);
      }
    });
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const modes = [
    { id: WritingMode.GENERAL, label: 'General', icon: '✍️', color: 'bg-zinc-100 text-zinc-700' },
    { id: WritingMode.ACADEMIC, label: 'Academic', icon: '🏛️', color: 'bg-blue-50 text-blue-700' },
    { id: WritingMode.POEM, label: 'Poem', icon: '🖋️', color: 'bg-purple-50 text-purple-700' },
    { id: WritingMode.LYRICS, label: 'Lyrics', icon: '🎵', color: 'bg-pink-50 text-pink-700' },
  ];

  return (
    <>
      {/* Floating Toggle Button (Visible when sidebar is closed) */}
      {!isOpen && (
        <button 
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 left-6 z-50 p-4 bg-zinc-900 text-white rounded-full shadow-2xl hover:scale-110 transition-all active:scale-95 group"
          title="Open Sidebar"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
          </svg>
          <span className="absolute left-16 bg-zinc-900 text-white text-[10px] font-bold px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">Open Tools</span>
        </button>
      )}

      <aside className={`fixed top-0 left-0 h-full w-80 bg-white border-r border-zinc-200 z-40 p-6 flex flex-col gap-8 transition-all duration-500 ease-in-out shadow-2xl md:shadow-none ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-zinc-900 mb-1">Muse</h1>
            <p className="text-xs text-zinc-500 font-medium uppercase tracking-widest">Thought Partner AI</p>
          </div>
          <button 
            onClick={() => setIsOpen(false)}
            className="p-1 hover:bg-zinc-100 rounded-lg text-zinc-400 transition-colors"
            title="Collapse Sidebar"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
            </svg>
          </button>
        </div>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <label className="text-sm font-semibold text-zinc-700">Writing Mode</label>
            <div className="grid grid-cols-2 gap-2">
              {modes.map((m) => (
                <button
                  key={m.id}
                  onClick={() => onModeChange(m.id)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold border transition-all ${
                    mode === m.id 
                    ? `${m.color} border-current ring-1 ring-current` 
                    : 'bg-white border-zinc-200 text-zinc-500 hover:border-zinc-300'
                  }`}
                >
                  <span>{m.icon}</span>
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-2 mt-2">
            <label className="text-sm font-semibold text-zinc-700">New Project</label>
            <textarea
              className="w-full h-24 p-3 text-sm bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-shadow resize-none"
              placeholder={`What are we writing? Current mode: ${mode}...`}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
            />
          </div>
          
          <div className="flex flex-col gap-2">
            <label className="flex items-center justify-center w-full px-4 py-3 bg-zinc-50 border-2 border-dashed border-zinc-200 rounded-xl cursor-pointer hover:bg-zinc-100 transition-colors">
              <span className="text-xs font-medium text-zinc-500 flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Attach context
              </span>
              <input type="file" className="hidden" multiple onChange={handleFileUpload} />
            </label>

            {attachments.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-2">
                {attachments.map((att, i) => (
                  <div key={i} className="group relative px-2 py-1 bg-indigo-50 text-indigo-700 text-[10px] font-bold rounded flex items-center gap-1 border border-indigo-100">
                    <span className="truncate max-w-[100px]">{att.name}</span>
                    <button onClick={() => removeAttachment(i)} className="text-indigo-400 hover:text-indigo-600">×</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <button
            disabled={isGenerating || !prompt.trim()}
            onClick={() => onGenerate(prompt, attachments)}
            className="w-full py-3 bg-zinc-900 text-white font-bold text-sm rounded-xl hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg transition-all active:scale-[0.98]"
          >
            {isGenerating ? 'Generative Flow...' : `Craft ${mode.charAt(0).toUpperCase() + mode.slice(1)} Draft`}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto no-scrollbar space-y-6 pt-4">
          <div className="flex justify-between items-center">
             <label className="text-sm font-semibold text-zinc-700">Proactive Insights</label>
             {suggestions.length > 0 && <span className={`flex h-2 w-2 rounded-full animate-pulse ${suggestions.some(s => s.isGrammar) ? 'bg-red-500' : 'bg-indigo-500'}`}></span>}
          </div>
          
          {suggestions.length === 0 ? (
            <p className="text-xs text-zinc-400 italic leading-relaxed">
              Start writing in {mode} mode to see technical fixes and creative suggestions here.
            </p>
          ) : (
            <div className="space-y-4">
              {suggestions.map((suggestion) => (
                <div 
                  key={suggestion.id} 
                  className={`p-4 rounded-xl border group animate-in slide-in-from-left duration-500 ${suggestion.isGrammar ? 'bg-red-50/50 border-red-100/50' : 'bg-indigo-50/50 border-indigo-100/50'}`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <p className={`text-[10px] font-bold uppercase tracking-wider ${suggestion.isGrammar ? 'text-red-500' : 'text-indigo-500'}`}>
                      {suggestion.isGrammar ? 'Technical Correction' : `${mode} Suggestion`}
                    </p>
                  </div>
                  <p className="text-xs text-zinc-600 line-through mb-1 opacity-50">{suggestion.originalText}</p>
                  <p className="text-sm text-zinc-800 font-medium mb-2">{suggestion.suggestedText}</p>
                  <p className="text-[11px] text-zinc-500 italic mb-4">{suggestion.explanation}</p>
                  <button 
                    onClick={() => onApplySuggestion(suggestion)}
                    className={`w-full py-2 text-white text-xs font-bold rounded-lg shadow-sm transition-colors ${suggestion.isGrammar ? 'bg-red-600 hover:bg-red-700' : 'bg-indigo-600 hover:bg-indigo-700'}`}
                  >
                    Accept Change
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </aside>
    </>
  );
};
