
import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import { iterateOnSelection, getGhostSuggestion } from '../services/geminiService';
import { Suggestion, WritingMode, Theme } from '../types';
import { Toolbar } from './Toolbar';

interface EditorProps {
  content: string;
  onChange: (content: string) => void;
  onManualAction: (content: string) => void;
  onUndo: () => void;
  onRedo: () => void;
  isGenerating: boolean;
  suggestions: Suggestion[];
  mode: WritingMode;
  theme: Theme;
  onManualCheck?: () => void;
}

export const Editor: React.FC<EditorProps> = ({ 
  content, 
  onChange, 
  onManualAction, 
  onUndo, 
  onRedo, 
  isGenerating,
  suggestions,
  mode,
  theme,
  onManualCheck
}) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const highlightRef = useRef<HTMLDivElement>(null);
  const ghostTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  const [selection, setSelection] = useState<{ text: string; top: number; left: number; range: Range } | null>(null);
  const [activeSuggestion, setActiveSuggestion] = useState<{ suggestion: Suggestion; top: number; left: number } | null>(null);
  const [ghostSuggestion, setGhostSuggestion] = useState<string>('');
  const [isIterating, setIsIterating] = useState(false);
  const [instruction, setInstruction] = useState('');
  const [activeFormats, setActiveFormats] = useState<{ [key: string]: boolean | string }>({});
  
  const [linkInput, setLinkInput] = useState<{ visible: boolean; url: string; text: string; top: number; left: number; range?: Range }>({
    visible: false,
    url: '',
    text: '',
    top: 0,
    left: 0
  });

  const [contextMenu, setContextMenu] = useState<{ x: number, y: number } | null>(null);

  useEffect(() => {
    document.execCommand('defaultParagraphSeparator', false, 'p');
  }, []);

  const updateActiveFormats = useCallback(() => {
    setActiveFormats({
      bold: document.queryCommandState('bold'),
      italic: document.queryCommandState('italic'),
      underline: document.queryCommandState('underline'),
      justifyLeft: document.queryCommandState('justifyLeft'),
      justifyCenter: document.queryCommandState('justifyCenter'),
      justifyRight: document.queryCommandState('justifyRight'),
    });
  }, []);

  const handleMouseUp = (e: React.MouseEvent) => {
    updateActiveFormats();
    if (contextMenu) setContextMenu(null);

    const sel = window.getSelection();
    if (sel && sel.toString().trim().length > 0) {
      const range = sel.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      setSelection({
        text: sel.toString(),
        top: rect.top + window.scrollY - 60,
        left: rect.left + window.scrollX + rect.width / 2,
        range: range.cloneRange()
      });
      setActiveSuggestion(null);
    } else {
      setSelection(null);
      const clickedText = editorRef.current?.innerText || '';
      
      let caretRange: Range | null = null;
      if (typeof (document as any).caretRangeFromPoint === 'function') {
        caretRange = (document as any).caretRangeFromPoint(e.clientX, e.clientY);
      } else if (typeof (document as any).caretPositionFromPoint === 'function') {
        const position = (document as any).caretPositionFromPoint(e.clientX, e.clientY);
        if (position) {
          caretRange = document.createRange();
          caretRange.setStart(position.offsetNode, position.offset);
          caretRange.setEnd(position.offsetNode, position.offset);
        }
      }

      if (caretRange) {
        const textNode = caretRange.startContainer;
        for (const sug of suggestions) {
          if (clickedText.includes(sug.originalText)) {
            if (textNode.textContent?.includes(sug.originalText)) {
              const rect = caretRange.getBoundingClientRect();
              setActiveSuggestion({
                suggestion: sug,
                top: rect.top + window.scrollY - 20,
                left: rect.left + window.scrollX,
              });
              return;
            }
          }
        }
      }
      setActiveSuggestion(null);
    }
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY });
  };

  const handleFormat = (command: string, value: string | undefined = undefined) => {
    document.execCommand(command, false, value);
    updateActiveFormats();
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML);
    }
  };

  const triggerLinkInput = () => {
    const sel = window.getSelection();
    let text = '';
    let range: Range | undefined = undefined;
    let top = 200;
    let left = window.innerWidth / 2;

    if (sel && sel.rangeCount > 0) {
      text = sel.toString();
      range = sel.getRangeAt(0).cloneRange();
      const rect = range.getBoundingClientRect();
      if (rect.width > 0) {
        top = rect.bottom + window.scrollY + 10;
        left = rect.left + window.scrollX + rect.width / 2;
      }
    }

    setLinkInput({
      visible: true,
      url: '',
      text: text,
      top,
      left,
      range
    });
    setSelection(null);
    setContextMenu(null);
  };

  const applyLink = () => {
    if (!linkInput.url.trim()) return;
    const sel = window.getSelection();
    if (sel && linkInput.range) {
      sel.removeAllRanges();
      sel.addRange(linkInput.range);
    }
    let finalUrl = linkInput.url.trim();
    if (!/^https?:\/\//i.test(finalUrl)) {
      finalUrl = 'https://' + finalUrl;
    }
    if (linkInput.text && !sel?.toString()) {
      handleFormat('insertHTML', `<a href="${finalUrl}" class="text-indigo-600 underline hover:text-indigo-800 transition-colors" target="_blank">${linkInput.text}</a>`);
    } else {
      handleFormat('createLink', finalUrl);
      if (editorRef.current) {
        const links = editorRef.current.querySelectorAll('a:not(.text-indigo-600)');
        links.forEach(l => {
          l.classList.add('text-indigo-600', 'underline', 'hover:text-indigo-800', 'transition-colors');
          l.setAttribute('target', '_blank');
        });
        onChange(editorRef.current.innerHTML);
      }
    }
    setLinkInput({ ...linkInput, visible: false });
  };

  const handleApplySuggestion = (sug: Suggestion) => {
    // Avoid corrupted strings by searching for first match in HTML
    const escaped = sug.originalText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const newContent = content.replace(new RegExp(escaped, ''), sug.suggestedText);
    onManualAction(newContent);
    setActiveSuggestion(null);
  };

  const handleIterate = async () => {
    if (!selection || !instruction.trim()) return;
    setIsIterating(true);
    try {
      const result = await iterateOnSelection(content.replace(/<[^>]*>/g, ''), selection.text, instruction, mode);
      const newContent = content.replace(selection.text, result);
      onManualAction(newContent);
      setSelection(null);
      setInstruction('');
    } catch (error) {
      console.error("Iteration failed", error);
    } finally {
      setIsIterating(false);
    }
  };

  const requestGhostSuggestion = useCallback(async (currentContent: string) => {
    if (!currentContent.trim() || isGenerating) return;
    const plainText = currentContent.replace(/<[^>]*>/g, '');
    const completion = await getGhostSuggestion(plainText, mode);
    setGhostSuggestion(completion);
  }, [mode, isGenerating]);

  const handleInput = () => {
    updateActiveFormats();
    if (editorRef.current) {
      if (editorRef.current.innerHTML === '' || editorRef.current.innerHTML === '<br>') {
        editorRef.current.innerHTML = '<p><br></p>';
      }
      const newHtml = editorRef.current.innerHTML;
      onChange(newHtml);
      setGhostSuggestion('');
      if (ghostTimeoutRef.current) clearTimeout(ghostTimeoutRef.current);
      ghostTimeoutRef.current = setTimeout(() => {
        requestGhostSuggestion(newHtml);
      }, 1200);
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const text = e.clipboardData.getData('text/plain');
    document.execCommand('insertText', false, text);
    handleInput();
  };

  const acceptGhostSuggestion = () => {
    if (!ghostSuggestion) return;
    // Inject directly into the HTML to maintain cursor position/structure
    if (editorRef.current) {
      const lastP = editorRef.current.querySelector('p:last-child') || editorRef.current;
      const textNode = document.createTextNode(ghostSuggestion);
      lastP.appendChild(textNode);
      onChange(editorRef.current.innerHTML);
      setGhostSuggestion('');
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMod = e.metaKey || e.ctrlKey;
      if (e.key === 'Tab' && ghostSuggestion) {
        e.preventDefault();
        acceptGhostSuggestion();
      } else if (isMod && e.key === 'z') {
        e.preventDefault();
        if (e.shiftKey) onRedo(); else onUndo();
      } else if (isMod && e.key === 'k') {
        e.preventDefault();
        triggerLinkInput();
      } else if (isMod && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        handleFormat('bold');
      } else if (isMod && e.key.toLowerCase() === 'i') {
        e.preventDefault();
        handleFormat('italic');
      } else if (isMod && e.key.toLowerCase() === 'u') {
        e.preventDefault();
        handleFormat('underline');
      }
      updateActiveFormats();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onUndo, onRedo, ghostSuggestion, content, updateActiveFormats]);

  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== content) {
      editorRef.current.innerHTML = content || '<p><br></p>';
    }
  }, [content]);

  const handleScroll = () => {
    if (editorRef.current && highlightRef.current) {
      highlightRef.current.scrollTop = editorRef.current.scrollTop;
    }
  };

  const getHighlightedHTML = useCallback(() => {
    let html = content;
    
    // 1. Markdown Headers (Non-breaking layout versions)
    html = html.replace(/^### (.*$)(?![^<]*>)/gm, '<span class="md-h3"><span class="opacity-20 select-none">###</span> $1</span>');
    html = html.replace(/^## (.*$)(?![^<]*>)/gm, '<span class="md-h2"><span class="opacity-20 select-none">##</span> $1</span>');
    html = html.replace(/^# (.*$)(?![^<]*>)/gm, '<span class="md-h1"><span class="opacity-20 select-none">#</span> $1</span>');
    
    // 2. Parentheses
    html = html.replace(/\(([^)]+)\)(?![^<]*>)/g, '<span class="md-parenthesis">($1)</span>');

    // 3. Emphasis
    html = html.replace(/\*\*(.*?)\*\*(?![^<]*>)/g, '<span class="md-bold"><span class="opacity-20 select-none">**</span>$1<span class="opacity-20 select-none">**</span></span>');
    html = html.replace(/\*(.*?)\*(?![^<]*>)/g, '<span class="md-italic"><span class="opacity-20 select-none">*</span>$1<span class="opacity-20 select-none">*</span></span>');

    // 4. Ghost Completion
    if (ghostSuggestion) {
      // Find the last closing tag or append
      const lastClosingP = html.lastIndexOf('</p>');
      if (lastClosingP !== -1) {
        html = html.substring(0, lastClosingP) + `<span class="opacity-30 select-none italic">${ghostSuggestion}</span>` + html.substring(lastClosingP);
      } else {
        html += `<span class="opacity-30 select-none italic">${ghostSuggestion}</span>`;
      }
    }

    // 5. Suggestions Highlighting (Improved logic to prevent marker leaks)
    if (suggestions.length > 0) {
      suggestions.forEach((suggestion) => {
        const escapedOriginal = suggestion.originalText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const className = suggestion.isGrammar ? 'grammar-highlight' : 'suggestion-highlight';
        const regex = new RegExp(`(${escapedOriginal})(?![^<]*>)`, 'g');
        // Simple one-pass replace to avoid placeholder leaks
        html = html.replace(regex, `<span class="${className}">$1</span>`);
      });
    }
    
    return html;
  }, [content, ghostSuggestion, suggestions]);

  return (
    <div className="flex flex-col h-full bg-white relative">
      <Toolbar onFormat={handleFormat} activeFormats={activeFormats} />
      <div className="flex-1 relative w-full max-w-4xl mx-auto py-12 px-12 md:px-24" onContextMenu={handleContextMenu}>
        
        {/* Overlays */}
        {linkInput.visible && (
          <div className="fixed z-[110] flex flex-col gap-3 p-4 bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-zinc-200 dark:border-zinc-700 animate-in fade-in zoom-in duration-200 w-80"
               style={{ top: linkInput.top, left: linkInput.left, transform: 'translateX(-50%)' }}>
            <input type="text" className="px-3 py-2 text-sm bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500" placeholder="Display text..." value={linkInput.text} onChange={(e) => setLinkInput({ ...linkInput, text: e.target.value })} />
            <input autoFocus type="text" className="px-3 py-2 text-sm bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500" placeholder="URL (https://...)" value={linkInput.url} onChange={(e) => setLinkInput({ ...linkInput, url: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && applyLink()} />
            <div className="flex justify-end gap-2 mt-1">
              <button onClick={() => setLinkInput({ ...linkInput, visible: false })} className="px-3 py-1.5 text-xs font-bold text-zinc-500">Cancel</button>
              <button onClick={applyLink} className="px-3 py-1.5 bg-indigo-600 text-white text-xs font-bold rounded-lg shadow-md">Insert Link</button>
            </div>
          </div>
        )}

        {contextMenu && (
          <div className="fixed z-[100] w-56 bg-white border border-zinc-200 shadow-2xl rounded-xl py-2"
               style={{ top: contextMenu.y, left: contextMenu.x }} onClick={(e) => e.stopPropagation()}>
            <button onClick={() => { document.execCommand('copy'); setContextMenu(null); }} className="w-full flex items-center gap-3 px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-50">Copy</button>
            <button onClick={async () => { try { const text = await navigator.clipboard.readText(); document.execCommand('insertText', false, text); } catch(e) {} setContextMenu(null); }} className="w-full flex items-center gap-3 px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-50">Paste</button>
            <div className="h-px bg-zinc-100 my-1 mx-2" />
            <button onClick={triggerLinkInput} className="w-full flex items-center gap-3 px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-50">Insert Link</button>
            <button onClick={() => { if (onManualCheck) onManualCheck(); setContextMenu(null); }} className="w-full flex items-center gap-3 px-4 py-2 text-sm text-indigo-600 font-semibold hover:bg-indigo-50">Check Grammar & Style</button>
          </div>
        )}

        {/* AI Selection Tooltip */}
        {selection && !isIterating && !linkInput.visible && (
          <div className="fixed z-50 flex flex-col gap-2 p-2 bg-white rounded-xl shadow-2xl border border-zinc-200"
               style={{ top: selection.top, left: selection.left, transform: 'translateX(-50%)' }}>
            <input autoFocus className="px-3 py-1.5 text-sm bg-zinc-50 border-none focus:ring-2 focus:ring-indigo-500 rounded-lg w-64 outline-none" placeholder={`Refine for ${mode}...`} value={instruction} onChange={(e) => setInstruction(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleIterate()} />
            <button onClick={handleIterate} className="px-3 py-1 bg-indigo-600 text-white text-xs font-semibold rounded-md">Refine</button>
          </div>
        )}

        {/* Suggestion Popover */}
        {activeSuggestion && !selection && (
          <div className={`fixed z-50 p-3 rounded-2xl shadow-2xl animate-in fade-in slide-in-from-bottom-2 w-72 ${activeSuggestion.suggestion.isGrammar ? 'bg-red-600' : 'bg-indigo-600'}`}
               style={{ top: activeSuggestion.top, left: activeSuggestion.left, transform: 'translate(-50%, -100%) translateY(-10px)' }}>
            <div className="flex flex-col gap-2">
              <div className="flex justify-between items-start">
                <div className="flex flex-col">
                  <span className="text-[9px] font-bold uppercase text-white/70">{activeSuggestion.suggestion.isGrammar ? 'Correction' : 'Insight'}</span>
                  <span className="text-sm text-white font-bold">"{activeSuggestion.suggestion.suggestedText}"</span>
                </div>
                <button onClick={() => handleApplySuggestion(activeSuggestion.suggestion)} className={`px-4 py-1.5 bg-white text-xs font-bold rounded-lg shadow-md ${activeSuggestion.suggestion.isGrammar ? 'text-red-600' : 'text-indigo-600'}`}>Apply</button>
              </div>
              <p className="text-[11px] text-white/90 font-medium italic">{activeSuggestion.suggestion.explanation}</p>
            </div>
            <div className={`absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-full w-0 h-0 border-l-[10px] border-r-[10px] border-t-[10px] border-l-transparent border-r-transparent ${activeSuggestion.suggestion.isGrammar ? 'border-t-red-600' : 'border-t-indigo-600'}`} />
          </div>
        )}

        {/* The Dual Layer Core */}
        <div className="relative">
          <div
            ref={highlightRef}
            aria-hidden="true"
            className="absolute inset-0 editor-font highlight-layer overflow-hidden pointer-events-none select-none"
            dangerouslySetInnerHTML={{ __html: getHighlightedHTML() }}
          />
          <div
            ref={editorRef}
            contentEditable
            suppressContentEditableWarning
            onMouseUp={handleMouseUp}
            onInput={handleInput}
            onPaste={handlePaste}
            onScroll={handleScroll}
            className={`editor-font real-editor transition-opacity duration-500 ${isGenerating ? 'opacity-30 pointer-events-none' : 'opacity-100'}`}
            style={{ minHeight: '60vh' }}
          />
        </div>
        
        {content.length === 0 && !isGenerating && (
          <div className="absolute top-12 left-12 md:left-24 text-zinc-300 editor-font pointer-events-none">
            {mode === WritingMode.POEM ? 'Whisper your verses here...' : 
             mode === WritingMode.ACADEMIC ? 'Enter your thesis...' :
             'Start typing your masterpiece...'}
          </div>
        )}
      </div>
    </div>
  );
};
