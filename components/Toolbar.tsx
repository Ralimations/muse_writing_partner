
import React from 'react';

interface ToolbarProps {
  onFormat: (command: string, value?: string) => void;
  activeFormats: { [key: string]: boolean | string };
}

export const Toolbar: React.FC<ToolbarProps> = ({ onFormat, activeFormats }) => {
  const Button = ({ command, icon, label, value }: { command: string, icon: React.ReactNode, label?: string, value?: string }) => (
    <button
      onMouseDown={(e) => {
        e.preventDefault();
        onFormat(command, value);
      }}
      className={`p-1.5 rounded-md transition-colors flex items-center justify-center gap-1 ${
        activeFormats[command] === (value || true)
          ? 'bg-indigo-100 text-indigo-700'
          : 'text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900'
      }`}
      title={label || command}
    >
      {icon}
    </button>
  );

  const adjustFontSize = (direction: 'increase' | 'decrease') => {
    // browser execCommand 'fontSize' uses values 1-7. 
    // We can attempt to read current size and increment/decrement.
    const currentSize = document.queryCommandValue('fontSize') || "3";
    let newSize = parseInt(currentSize);
    
    if (direction === 'increase' && newSize < 7) {
      newSize++;
    } else if (direction === 'decrease' && newSize > 1) {
      newSize--;
    }
    
    onFormat('fontSize', newSize.toString());
  };

  return (
    <div className="flex items-center gap-1 p-1 bg-white border-b border-zinc-200 sticky top-0 z-20 overflow-x-auto no-scrollbar">
      <div className="flex items-center gap-0.5 px-2 border-r border-zinc-200">
        <Button 
          command="bold" 
          icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M6 4h8a4 4 0 014 4 4 4 0 01-4 4H6z"/><path d="M6 12h9a4 4 0 014 4 4 4 0 01-4 4H6z"/></svg>} 
          label="Bold (Ctrl+B)" 
        />
        <Button 
          command="italic" 
          icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="19" y1="4" x2="10" y2="4"/><line x1="14" y1="20" x2="5" y2="20"/><line x1="15" y1="4" x2="9" y2="20"/></svg>} 
          label="Italic (Ctrl+I)" 
        />
        <Button 
          command="underline" 
          icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M6 3v7a6 6 0 0012 0V3"/><line x1="4" y1="21" x2="20" y2="21"/></svg>} 
          label="Underline (Ctrl+U)" 
        />
      </div>

      <div className="flex items-center gap-0.5 px-2 border-r border-zinc-200">
        <button
          onMouseDown={(e) => { e.preventDefault(); adjustFontSize('decrease'); }}
          className="p-1.5 rounded-md text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 flex items-center justify-center"
          title="Decrease Font Size"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="5" y1="12" x2="19" y2="12"/></svg>
        </button>
        <span className="text-[10px] font-bold text-zinc-400 px-1 w-4 text-center">A</span>
        <button
          onMouseDown={(e) => { e.preventDefault(); adjustFontSize('increase'); }}
          className="p-1.5 rounded-md text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 flex items-center justify-center"
          title="Increase Font Size"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        </button>
      </div>

      <div className="flex items-center gap-0.5 px-2 border-r border-zinc-200">
        <Button 
          command="justifyLeft" 
          icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="17" y1="10" x2="3" y2="10"/><line x1="21" y1="6" x2="3" y2="6"/><line x1="21" y1="14" x2="3" y2="14"/><line x1="17" y1="18" x2="3" y2="18"/></svg>} 
          label="Align Left" 
        />
        <Button 
          command="justifyCenter" 
          icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="10" x2="6" y2="10"/><line x1="21" y1="6" x2="3" y2="6"/><line x1="21" y1="14" x2="3" y2="14"/><line x1="18" y1="18" x2="6" y2="18"/></svg>} 
          label="Align Center" 
        />
        <Button 
          command="justifyRight" 
          icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="21" y1="10" x2="7" y2="10"/><line x1="21" y1="6" x2="3" y2="6"/><line x1="21" y1="14" x2="3" y2="14"/><line x1="21" y1="18" x2="7" y2="18"/></svg>} 
          label="Align Right" 
        />
      </div>

      <div className="flex items-center gap-0.5 px-2 border-r border-zinc-200">
        <Button 
          command="insertUnorderedList" 
          icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>} 
          label="Bullet List" 
        />
        <Button 
          command="insertOrderedList" 
          icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="10" y1="6" x2="21" y2="6"/><line x1="10" y1="12" x2="21" y2="12"/><line x1="10" y1="18" x2="21" y2="18"/><path d="M4 6h1v4"/><path d="M4 10h2"/><path d="M6 18H4c0-1 2-2 2-3s-1-1.5-2-1"/></svg>} 
          label="Numbered List" 
        />
      </div>

      <div className="flex items-center gap-1 px-2">
        <input 
          type="color" 
          className="w-6 h-6 p-0 border-none bg-transparent cursor-pointer"
          onChange={(e) => onFormat('foreColor', e.target.value)}
          title="Text Color"
        />
      </div>
    </div>
  );
};
