'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Palette, Calendar, Sparkles, X, Check, Loader2, ArrowLeft, Pin, PinOff, Trash2 } from 'lucide-react';
import type { Note } from '@/lib/storage';

interface EditorProps {
  note: Note | null;
  onSave: (note: Note) => Promise<void>;
  onDelete: () => Promise<void>;
  onClose: () => void;
  onTogglePin?: (id: string) => Promise<void>;
}

const colorMap: Record<string, { label: string; hex: string }> = {
  alabaster: { label: 'Alabaster', hex: '#F9F9F6' },
  sage:      { label: 'Soft Sage', hex: '#EEF2EE' },
  linen:     { label: 'Warm Linen', hex: '#FDF8F5' },
  slate:     { label: 'Faint Slate', hex: '#F0F1F4' },
  lavender:  { label: 'Washed Lavender', hex: '#F3EFFF' },
};

export const Editor = ({ note, onSave, onDelete, onClose, onTogglePin }: EditorProps) => {
  const [title, setTitle]         = useState('');
  const [content, setContent]     = useState('');
  const [color, setColor]         = useState('alabaster');
  const [tags, setTags]           = useState<string[]>([]);
  const [pinned, setPinned]       = useState(false);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'idle'>('idle');
  const [showColorPicker, setShowColorPicker]   = useState(false);
  const [showSummary, setShowSummary]           = useState(false);
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  const [tagInput, setTagInput]   = useState('');

  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const noteIdRef = useRef<string>(note?.id ?? crypto.randomUUID());

  useEffect(() => {
    if (note) {
      setTitle(note.title);
      setContent(note.content);
      setColor(colorMap[note.color] ? note.color : 'alabaster');
      setTags(note.tags ?? []);
      setPinned(note.pinned ?? false);
      noteIdRef.current = note.id;
    } else {
      setTitle('');
      setContent('');
      setColor('alabaster');
      setTags([]);
      setPinned(false);
      noteIdRef.current = crypto.randomUUID();
    }
    setSaveStatus('idle');
  }, [note]);

  const triggerSave = useCallback(() => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    setSaveStatus('saving');
    saveTimeoutRef.current = setTimeout(async () => {
      try {
        await onSave({
          id: noteIdRef.current,
          title: title.trim() || '',
          content,
          color,
          tags,
          pinned,
          summary: content.slice(0, 100),
          updatedAt: Date.now(),
        });
        setSaveStatus('saved');
      } catch (err) {
        console.error('Failed to save note:', err);
        setSaveStatus('idle');
      }
    }, 700);
  }, [title, content, color, tags, pinned, onSave]);

  useEffect(() => {
    if (saveStatus !== 'idle') return;
    // don't auto-save on initial mount
  }, []);

  const handleChange = useCallback(
    (field: 'title' | 'content' | 'color' | 'tags', value: string | string[]) => {
      if (field === 'title') setTitle(value as string);
      if (field === 'content') setContent(value as string);
      if (field === 'color') { setColor(value as string); setShowColorPicker(false); }
      if (field === 'tags') setTags(value as string[]);
      setSaveStatus('saving');
    },
    [],
  );

  // Debounced save when anything relevant changes
  useEffect(() => {
    if (!title && !content) return; // skip if nothing has been typed
    triggerSave();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, content, color, tags, pinned]);

  useEffect(() => () => { if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current); }, []);

  const handleDelete = async () => {
    if (window.confirm('Delete this note permanently?')) {
      await onDelete();
    }
  };

  const handlePinToggle = async () => {
    const newPinned = !pinned;
    setPinned(newPinned);
    if (note?.id && onTogglePin) await onTogglePin(note.id);
  };

  const handleGenerateSummary = () => {
    setShowSummary(true);
    setIsGeneratingSummary(true);
    setTimeout(() => setIsGeneratingSummary(false), 2000);
  };

  const addTag = () => {
    const t = tagInput.trim();
    if (t && !tags.includes(t)) {
      handleChange('tags', [...tags, t]);
    }
    setTagInput('');
  };

  const wordCount = content.trim() ? content.trim().split(/\s+/).length : 0;
  const charCount = content.length;
  const bgHex = colorMap[color]?.hex ?? colorMap.alabaster.hex;

  return (
    <div className="flex h-full w-full relative overflow-hidden">
      {/* Editor Canvas */}
      <motion.div
        layoutId={note ? `note-${note.id}` : 'new-note'}
        className="flex flex-col flex-1 h-full overflow-hidden transition-colors duration-300"
        style={{ backgroundColor: bgHex }}
      >
        {/* Floating Toolbar */}
        <header
          className="h-12 px-5 flex items-center gap-2 z-10 sticky top-0 opacity-30 hover:opacity-100 transition-opacity duration-300"
          style={{ backgroundColor: bgHex + 'cc' }}
        >
          {/* Back */}
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-gray-500 hover:bg-black/5 transition-colors"
            aria-label="Back"
          >
            <ArrowLeft size={16} />
          </button>

          <div className="flex-1" />

          {/* Set Reminder */}
          <button className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-gray-500 hover:bg-black/5 transition-colors">
            <Calendar size={14} />
            <span className="hidden sm:inline">Remind</span>
          </button>

          {/* Color Picker */}
          <div className="relative">
            <button
              onClick={() => setShowColorPicker(!showColorPicker)}
              className="p-2 rounded-lg text-gray-500 hover:bg-black/5 transition-colors"
              aria-label="Background color"
            >
              <Palette size={15} />
            </button>
            <AnimatePresence>
              {showColorPicker && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.92, y: -8 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.92, y: -8 }}
                  transition={{ duration: 0.15 }}
                  className="absolute top-full right-0 mt-2 p-2 bg-white rounded-xl shadow-xl border border-gray-100 flex flex-col gap-0.5 w-44 z-50"
                >
                  {Object.entries(colorMap).map(([key, val]) => (
                    <button
                      key={key}
                      onClick={() => handleChange('color', key)}
                      className="flex items-center gap-2.5 w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-lg transition-colors"
                    >
                      <span className="w-4 h-4 rounded-full border border-gray-200 flex-shrink-0" style={{ backgroundColor: val.hex }} />
                      <span className="flex-1 text-left">{val.label}</span>
                      {color === key && <Check size={13} className="text-gray-700" />}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Pin */}
          <button
            onClick={handlePinToggle}
            className={`p-2 rounded-lg transition-colors ${pinned ? 'text-indigo-500 bg-indigo-50' : 'text-gray-500 hover:bg-black/5'}`}
            aria-label={pinned ? 'Unpin' : 'Pin'}
          >
            {pinned ? <Pin size={15} /> : <PinOff size={15} />}
          </button>

          {/* AI Summarize */}
          <button
            onClick={handleGenerateSummary}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 transition-colors"
          >
            <Sparkles size={13} />
            Summarize
          </button>

          {/* Delete */}
          <button
            onClick={handleDelete}
            className="p-2 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
            aria-label="Delete note"
          >
            <Trash2 size={15} />
          </button>
        </header>

        {/* Document Body */}
        <div className="flex-1 overflow-y-auto px-6 sm:px-12 md:px-20 lg:px-28 py-10 flex flex-col max-w-4xl mx-auto w-full">
          <input
            type="text"
            value={title}
            onChange={(e) => handleChange('title', e.target.value)}
            placeholder="Untitled"
            className="w-full bg-transparent text-4xl sm:text-5xl font-bold text-gray-900 tracking-tight border-none outline-none placeholder:text-gray-300 mb-6 leading-tight"
          />

          {/* Tags */}
          <div className="flex items-center flex-wrap gap-1.5 mb-6">
            {tags.map((tag) => (
              <span
                key={tag}
                className="flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-black/5 text-xs font-medium text-gray-600"
              >
                #{tag}
                <button
                  onClick={() => handleChange('tags', tags.filter((t) => t !== tag))}
                  className="ml-0.5 hover:text-red-500 transition-colors"
                >
                  <X size={10} />
                </button>
              </span>
            ))}
            <input
              type="text"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag(); } }}
              placeholder="+ tag"
              className="bg-transparent text-xs text-gray-500 placeholder:text-gray-400 border-none outline-none w-16"
            />
          </div>

          <textarea
            value={content}
            onChange={(e) => handleChange('content', e.target.value)}
            placeholder="Start writing..."
            className="w-full flex-1 bg-transparent text-[17px] text-gray-700 leading-[1.85] border-none outline-none placeholder:text-gray-300 resize-none min-h-[400px]"
            spellCheck
          />
        </div>

        {/* Status Bar */}
        <div className="h-10 px-5 flex items-center justify-between text-[11px] font-medium text-gray-400 border-t border-black/5 flex-shrink-0">
          <div className="flex items-center gap-4">
            <span>{wordCount} words</span>
            <span>{charCount} chars</span>
          </div>
          <AnimatePresence mode="wait">
            {saveStatus === 'saving' && (
              <motion.span key="saving" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center gap-1.5 text-gray-500">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-gray-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-gray-400" />
                </span>
                Saving...
              </motion.span>
            )}
            {saveStatus === 'saved' && (
              <motion.span key="saved" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-gray-400">
                ✓ Saved
              </motion.span>
            )}
          </AnimatePresence>
        </div>
      </motion.div>

      {/* AI Summary Panel */}
      <AnimatePresence>
        {showSummary && (
          <motion.div
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 300, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ type: 'spring', damping: 26, stiffness: 220 }}
            className="border-l border-gray-100 bg-white dark:bg-zinc-900 h-full flex flex-col shadow-xl flex-shrink-0 overflow-hidden"
          >
            <div className="h-12 px-4 flex items-center justify-between border-b border-gray-100 dark:border-zinc-800 min-w-[300px]">
              <div className="flex items-center gap-2 text-indigo-600 font-semibold text-sm">
                <Sparkles size={15} /> AI Summary
              </div>
              <button onClick={() => setShowSummary(false)} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-zinc-800">
                <X size={15} />
              </button>
            </div>
            <div className="p-5 flex-1 overflow-y-auto min-w-[300px]">
              {isGeneratingSummary ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-sm text-gray-500 font-medium animate-pulse">
                    <Loader2 size={15} className="animate-spin" /> Analyzing...
                  </div>
                  <div className="space-y-2.5 mt-6">
                    {[3, 4, 3.5, 2.5].map((w, i) => (
                      <div key={i} className="h-3 bg-gray-100 rounded-full animate-pulse" style={{ width: `${w / 4 * 100}%` }} />
                    ))}
                  </div>
                </div>
              ) : (
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
                  <p className="font-semibold text-gray-900 dark:text-gray-100 text-sm mb-3">Key takeaways</p>
                  <ul className="space-y-2.5 text-sm text-gray-600 dark:text-gray-400 list-disc pl-4 marker:text-indigo-400 leading-relaxed">
                    <li>Note focuses on design principles and visual hierarchy.</li>
                    <li>Key themes include typography, spacing, and color palette.</li>
                    <li>Contains actionable items for implementation.</li>
                  </ul>
                  <div className="mt-6 p-3 bg-indigo-50/60 dark:bg-indigo-900/20 rounded-xl text-xs text-indigo-500 border border-indigo-100/60 dark:border-indigo-800">
                    Summary generated from document context. Connect an AI API to get real summaries.
                  </div>
                </motion.div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};