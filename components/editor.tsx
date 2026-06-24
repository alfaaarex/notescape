'use client';

/* eslint-disable react-hooks/set-state-in-effect */

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlignLeft,
  ArrowLeft,
  Bold,
  Calendar,
  Check,
  CheckSquare,
  Code,
  Copy,
  Columns2,
  Eye,
  Focus,
  Heading1,
  Heading2,
  Heading3,
  Highlighter,
  Italic,
  Link,
  List,
  ListOrdered,
  Loader2,
  Menu,
  Minus,
  MoreHorizontal,
  Palette,
  Pencil,
  Pin,
  PinOff,
  Quote,
  RefreshCw,
  Share,
  Sparkles,
  Strikethrough,
  Tag,
  Trash2,
  Type,
  X,
  Radio
} from 'lucide-react';
import type { Note } from '@/lib/storage';
import type { Collaborator, CollaboratorRole } from '@/lib/types';
import { supabase } from '@/lib/supabaseClient';
import { ShareSheet } from '@/components/share-sheet';
import { useAuth } from '@/components/auth-provider';
import { useYjsNote } from '@/lib/useYjsNote';

interface EditorProps {
  note: Note | null;
  onSave: (note: Note) => Promise<void>;
  onDelete: () => Promise<void>;
  onClose: () => void;
  onTogglePin?: (id: string) => Promise<void>;
  onTogglePublicShare?: (id: string, isPublic: boolean, shareSlug?: string) => Promise<void>;
  getCollaborators?: (noteId: string) => Promise<Collaborator[]>;
  addCollaborator?: (noteId: string, email: string, role: CollaboratorRole) => Promise<{ error?: string; success?: boolean }>;
  removeCollaborator?: (noteId: string, userId: string) => Promise<void>;
  updateCollaborator?: (noteId: string, userId: string, role: CollaboratorRole) => Promise<void>;
}

interface DbNote {
  id: string;
  user_id: string;
  title: string;
  content: string;
  color: string;
  summary?: string | null;
  tags: string[];
  pinned: boolean;
  updated_at: number;
  is_public: boolean;
  share_token?: string | null;
  share_slug?: string | null;
}

const colorMap: Record<string, { label: string; hex: string; ring: string }> = {
  cream: { label: 'Warm Cream', hex: 'var(--background)', ring: 'var(--border)' },
  concrete: { label: 'Light Concrete', hex: 'var(--muted)', ring: 'var(--border)' },
  kraft: { label: 'Kraft Paper', hex: '#E3DACC', ring: '#CBBFAA' },
  slate: { label: 'Dark Slate', hex: '#D5D9E0', ring: '#BAC1CC' },
};

type SlashCommand = {
  id: string;
  label: string;
  description: string;
  category: 'Basics' | 'Structure' | 'Lists' | 'Smart';
  icon: React.ReactNode;
  insert: {
    prefix: string;
    suffix?: string;
    placeholder?: string;
    lineStart?: boolean;
  };
};

const SLASH_COMMANDS: SlashCommand[] = [
  {
    id: 'text',
    label: 'Text',
    description: 'Plain writing block',
    category: 'Basics',
    icon: <Type size={15} />,
    insert: { prefix: '', placeholder: '' },
  },
  {
    id: 'h1',
    label: 'Heading 1',
    description: 'Large section title',
    category: 'Structure',
    icon: <Heading1 size={15} />,
    insert: { prefix: '# ', placeholder: 'Heading', lineStart: true },
  },
  {
    id: 'h2',
    label: 'Heading 2',
    description: 'Medium section title',
    category: 'Structure',
    icon: <Heading2 size={15} />,
    insert: { prefix: '## ', placeholder: 'Heading', lineStart: true },
  },
  {
    id: 'h3',
    label: 'Heading 3',
    description: 'Small section title',
    category: 'Structure',
    icon: <Heading3 size={15} />,
    insert: { prefix: '### ', placeholder: 'Heading', lineStart: true },
  },
  {
    id: 'bullet',
    label: 'Bullet List',
    description: 'Quick unordered list',
    category: 'Lists',
    icon: <List size={15} />,
    insert: { prefix: '- ', placeholder: 'List item', lineStart: true },
  },
  {
    id: 'numbered',
    label: 'Numbered List',
    description: 'Steps or ordered notes',
    category: 'Lists',
    icon: <ListOrdered size={15} />,
    insert: { prefix: '1. ', placeholder: 'First step', lineStart: true },
  },
  {
    id: 'task',
    label: 'Task List',
    description: 'Track an action item',
    category: 'Lists',
    icon: <CheckSquare size={15} />,
    insert: { prefix: '- [ ] ', placeholder: 'Todo', lineStart: true },
  },
  {
    id: 'quote',
    label: 'Quote',
    description: 'Pull out a quote or thought',
    category: 'Structure',
    icon: <Quote size={15} />,
    insert: { prefix: '> ', placeholder: 'Quote', lineStart: true },
  },
  {
    id: 'code',
    label: 'Code Block',
    description: 'Multi-line code snippet',
    category: 'Structure',
    icon: <Code size={15} />,
    insert: { prefix: '```\n', suffix: '\n```', placeholder: 'code' },
  },
  {
    id: 'divider',
    label: 'Divider',
    description: 'Separate two sections',
    category: 'Structure',
    icon: <Minus size={15} />,
    insert: { prefix: '---\n', placeholder: '', lineStart: true },
  },
  {
    id: 'callout',
    label: 'Callout',
    description: 'Highlight an important note',
    category: 'Smart',
    icon: <Highlighter size={15} />,
    insert: { prefix: '> Note: ', placeholder: 'Important context', lineStart: true },
  },
  {
    id: 'date',
    label: 'Today',
    description: 'Insert today\'s date',
    category: 'Smart',
    icon: <Calendar size={15} />,
    insert: { prefix: new Date().toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' }), placeholder: '' },
  },
];

const getLinePrefix = (content: string, cursor: number) => {
  const lineStart = content.lastIndexOf('\n', cursor - 1) + 1;
  return { lineStart, prefix: content.slice(lineStart, cursor) };
};

const estimateReadingTime = (wordCount: number) => Math.max(1, Math.ceil(wordCount / 220));

const renderInline = (text: string): React.ReactNode[] => {
  const parts: React.ReactNode[] = [];
  const pattern = /(`[^`]+`|\*\*\*(.+?)\*\*\*|\*\*(.+?)\*\*|\*(.+?)\*|~~(.+?)~~|\[([^\]]+)\]\(([^)]+)\))/g;
  let last = 0;
  let match: RegExpExecArray | null;
  let idx = 0;
  while ((match = pattern.exec(text)) !== null) {
    if (match.index > last) parts.push(<span key={`t-${idx++}`}>{text.slice(last, match.index)}</span>);
    const m = match[0];
    if (m.startsWith('`')) {
      parts.push(<code key={`c-${idx++}`} className="rounded te-inset px-1.5 py-0.5 font-mono text-[13px] text-primary">{m.slice(1, -1)}</code>);
    } else if (m.startsWith('***')) {
      parts.push(<strong key={`bi-${idx++}`} className="font-bold italic">{match[2]}</strong>);
    } else if (m.startsWith('**')) {
      parts.push(<strong key={`b-${idx++}`} className="font-semibold">{match[3]}</strong>);
    } else if (m.startsWith('*')) {
      parts.push(<em key={`i-${idx++}`} className="italic">{match[4]}</em>);
    } else if (m.startsWith('~~')) {
      parts.push(<s key={`s-${idx++}`} className="line-through text-muted-foreground">{match[5]}</s>);
    } else if (m.startsWith('[')) {
      parts.push(<a key={`a-${idx++}`} href={match[7]} target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-4 decoration-primary/30 hover:decoration-primary">{match[6]}</a>);
    }
    last = match.index + m.length;
  }
  if (last < text.length) parts.push(<span key={`t-${idx++}`}>{text.slice(last)}</span>);
  return parts;
};

const renderPreview = (text: string) => {
  if (!text.trim()) {
    return <p className="text-muted-foreground font-mono text-sm uppercase tracking-widest">// NO CONTENT</p>;
  }

  const lines = text.split('\n');
  const elements: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const key = `${i}-${line.slice(0, 20)}`;

    if (line.startsWith('```')) {
      const lang = line.slice(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      elements.push(
        <pre key={key} className="my-6 overflow-x-auto rounded-xl te-inset bg-black/5 dark:bg-black/40 p-5 text-sm leading-relaxed border border-border">
          <code className={`font-mono text-foreground ${lang ? `language-${lang}` : ''}`}>{codeLines.join('\n')}</code>
        </pre>
      );
      i++;
      continue;
    }

    if (line.startsWith('# ')) { elements.push(<h1 key={key} className="mt-8 mb-4 text-3xl font-bold font-sans tracking-tight te-emboss">{renderInline(line.slice(2))}</h1>); }
    else if (line.startsWith('## ')) { elements.push(<h2 key={key} className="mt-7 mb-3 text-2xl font-bold font-sans tracking-tight">{renderInline(line.slice(3))}</h2>); }
    else if (line.startsWith('### ')) { elements.push(<h3 key={key} className="mt-6 mb-2 text-xl font-semibold font-sans">{renderInline(line.slice(4))}</h3>); }
    else if (line.startsWith('- [ ] ')) { elements.push(<p key={key} className="my-2 flex items-start gap-3"><span className="mt-1 inline-block h-4 w-4 flex-shrink-0 rounded te-inset bg-background" /><span>{renderInline(line.slice(6))}</span></p>); }
    else if (line.startsWith('- [x] ') || line.startsWith('- [X] ')) { elements.push(<p key={key} className="my-2 flex items-start gap-3 text-muted-foreground"><span className="mt-1 inline-flex h-4 w-4 flex-shrink-0 items-center justify-center rounded te-surface bg-primary text-primary-foreground"><Check size={12} strokeWidth={3} /></span><span className="line-through">{renderInline(line.slice(6))}</span></p>); }
    else if (line.startsWith('- ')) { elements.push(<p key={key} className="my-1.5 flex items-start gap-3"><span className="mt-2.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-primary" /><span>{renderInline(line.slice(2))}</span></p>); }
    else if (/^\d+\.\s/.test(line)) { elements.push(<p key={key} className="my-1.5">{renderInline(line)}</p>); }
    else if (line.startsWith('> ')) { elements.push(<blockquote key={key} className="my-5 border-l-4 border-primary pl-4 text-muted-foreground italic bg-muted/30 py-2 pr-4 rounded-r-lg">{renderInline(line.slice(2))}</blockquote>); }
    else if (line === '---') { elements.push(<div key={key} className="te-divider my-8" />); }
    else if (!line.trim()) { elements.push(<div key={key} className="h-4" />); }
    else { elements.push(<p key={key} className="my-3 leading-[1.8]">{renderInline(line)}</p>); }

    i++;
  }

  return elements;
};

export const Editor = ({
  note,
  onSave,
  onDelete,
  onClose,
  onTogglePin,
  onTogglePublicShare,
  getCollaborators,
  addCollaborator,
  removeCollaborator,
  updateCollaborator
}: EditorProps) => {
  const { title, content, setTitle, setContent, isSyncing } = useYjsNote(
    note?.id,
    note?.title ?? '',
    note?.content ?? '',
  );
  const [color, setColor] = useState('cream');
  const [tags, setTags] = useState<string[]>([]);
  const [pinned, setPinned] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'idle' | 'error'>('idle');
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [summaryData, setSummaryData] = useState<{
    summary: string;
    themes: string[];
    actions: string[];
    suggestedTags: string[];
  } | null>(null);
  const [copiedSummary, setCopiedSummary] = useState(false);
  const [tagInput, setTagInput] = useState('');
  const [editorMode, setEditorMode] = useState<'edit' | 'preview' | 'split'>('edit');
  const [focusMode, setFocusMode] = useState(false);
  const [slashOpen, setSlashOpen] = useState(false);
  const [slashQuery, setSlashQuery] = useState('');
  const [slashIndex, setSlashIndex] = useState(0);
  const [isPublic, setIsPublic] = useState(false);
  const [shareSheetOpen, setShareSheetOpen] = useState(false);
  const [showMobileToolbar, setShowMobileToolbar] = useState(false);
  const [showMobileMore, setShowMobileMore] = useState(false);

  interface PresenceUser { id: string; email: string; fullName?: string | null; avatarUrl?: string | null; }
  const [presentUsers, setPresentUsers] = useState<Record<string, PresenceUser>>({});
  const { user } = useAuth();
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const noteIdRef = useRef<string>(note?.id ?? crypto.randomUUID());
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lastSavedAtRef = useRef<number>(0);

  useEffect(() => {
    if (note) {
      setColor(colorMap[note.color] ? note.color : 'cream');
      setTags(note.tags ?? []);
      setPinned(note.pinned ?? false);
      setIsPublic(note.isPublic ?? false);
      noteIdRef.current = note.id;
    } else {
      noteIdRef.current = crypto.randomUUID();
      setColor('cream');
      setTags([]);
      setPinned(false);
      setIsPublic(false);
    }
    setSaveStatus('idle');
    setSlashOpen(false);
    setShowMobileToolbar(false);
    setShowMobileMore(false);
    setSummaryData(null);
    setSummaryError(null);
  }, [note]);

  const colorRef = useRef(color);
  const isPublicRef = useRef(isPublic);
  const pinnedRef = useRef(pinned);

  useEffect(() => { colorRef.current = color; }, [color]);
  useEffect(() => { isPublicRef.current = isPublic; }, [isPublic]);
  useEffect(() => { pinnedRef.current = pinned; }, [pinned]);

  useEffect(() => {
    if (!note?.id) return;
    const channel = supabase
      .channel(`note_changes_${note.id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'notes', filter: `id=eq.${note.id}` }, (payload) => {
        const newData = payload.new as DbNote;
        if (!newData) return;
        const remoteTs = newData.updated_at;
        if (remoteTs && Math.abs(remoteTs - lastSavedAtRef.current) < 3000) return;
        if (colorMap[newData.color] && newData.color !== colorRef.current) setColor(newData.color);
        if (newData.is_public !== isPublicRef.current) setIsPublic(newData.is_public);
        if (newData.pinned !== pinnedRef.current) setPinned(newData.pinned);
      }).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [note?.id]);

  const broadcastChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  interface TypingUser { userId: string; email: string; fullName?: string | null; avatarUrl?: string | null; at: number; }
  const [typingUsers, setTypingUsers] = useState<Record<string, TypingUser>>({});

  useEffect(() => {
    if (!note?.id || !user) return;
    const colabChannel = supabase.channel(`collab_${note.id}`, { config: { presence: { key: user.id } } });
    broadcastChannelRef.current = colabChannel;
    colabChannel.on('presence', { event: 'sync' }, () => {
      const state = colabChannel.presenceState();
      const users: Record<string, PresenceUser> = {};
      for (const id in state) users[id] = (state[id] as unknown as PresenceUser[])[0];
      setPresentUsers(users);
    });
    colabChannel.on('broadcast', { event: 'typing' }, ({ payload }) => {
      if (!payload || payload.userId === user.id) return;
      setTypingUsers((prev) => ({ ...prev, [payload.userId]: { ...payload, at: Date.now() } as TypingUser }));
    });
    colabChannel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await colabChannel.track({ id: user.id, email: user.email, fullName: user.user_metadata?.full_name, avatarUrl: user.user_metadata?.avatar_url });
      }
    });
    const pruneInterval = setInterval(() => {
      setTypingUsers((prev) => {
        const now = Date.now();
        const next = { ...prev };
        let changed = false;
        for (const uid in next) { if (now - next[uid].at > 3000) { delete next[uid]; changed = true; } }
        return changed ? next : prev;
      });
    }, 2000);
    return () => {
      broadcastChannelRef.current = null;
      supabase.removeChannel(colabChannel);
      clearInterval(pruneInterval);
    };
  }, [note?.id, user]);

  const triggerSave = useCallback(() => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    setSaveStatus('saving');
    if (broadcastChannelRef.current && user) {
      broadcastChannelRef.current.send({
        type: 'broadcast', event: 'typing', payload: {
          userId: user.id, email: user.email, fullName: user.user_metadata?.full_name, avatarUrl: user.user_metadata?.avatar_url,
        },
      });
    }
    saveTimeoutRef.current = setTimeout(async () => {
      const now = Date.now();
      lastSavedAtRef.current = now;
      try {
        await onSave({
          id: noteIdRef.current,
          title: title.trim() || '',
          content,
          color,
          tags,
          pinned,
          isPublic,
          summary: content.slice(0, 140),
          updatedAt: now,
        });
        setSaveStatus('saved');
      } catch (err) {
        console.error('Failed to save note:', err);
        setSaveStatus('error');
        setTimeout(() => setSaveStatus('idle'), 3000);
      }
    }, 650);
  }, [title, content, color, tags, pinned, isPublic, onSave, user]);

  const handleChange = useCallback((field: 'title' | 'content' | 'color' | 'tags', value: string | string[]) => {
    if (field === 'title') setTitle(value as string);
    if (field === 'content') setContent(value as string);
    if (field === 'color') { setColor(value as string); setShowColorPicker(false); }
    if (field === 'tags') setTags(value as string[]);
    setSaveStatus('saving');
  }, [setTitle, setContent]);

  useEffect(() => {
    if (!title && !content) return;
    triggerSave();
  }, [title, content, color, tags, pinned, isPublic, triggerSave]);

  useEffect(() => () => { if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current); }, []);

  const insertText = useCallback((prefix: string, suffix = '', placeholder = '', lineStart = false) => {
    if (!textareaRef.current) return;
    const start = textareaRef.current.selectionStart;
    const end = textareaRef.current.selectionEnd;
    const selectedText = content.substring(start, end);
    const needsLineBreak = lineStart && start > 0 && content[start - 1] !== '\n';
    const insertionPrefix = `${needsLineBreak ? '\n' : ''}${prefix}`;
    const innerText = selectedText || placeholder;
    const newContent = content.substring(0, start) + insertionPrefix + innerText + suffix + content.substring(end);
    const selectionStart = start + insertionPrefix.length;
    const selectionEnd = selectionStart + innerText.length;
    handleChange('content', newContent);
    window.setTimeout(() => {
      textareaRef.current?.focus();
      textareaRef.current?.setSelectionRange(selectionStart, selectionEnd);
    }, 0);
  }, [content, handleChange]);

  const insertMarkdown = (prefix: string, suffix = prefix) => insertText(prefix, suffix, 'text');

  const executeSlashCommand = (cmd?: SlashCommand) => {
    if (!textareaRef.current || !cmd) return;
    const cursor = textareaRef.current.selectionStart;
    const textBeforeCursor = content.substring(0, cursor);
    const lastSlashIdx = textBeforeCursor.lastIndexOf('/');
    if (lastSlashIdx === -1) return;
    const beforeSlash = content.substring(0, lastSlashIdx);
    const afterCursor = content.substring(cursor);
    const { prefix, suffix = '', placeholder = '', lineStart = false } = cmd.insert;
    const needsLineBreak = lineStart && lastSlashIdx > 0 && content[lastSlashIdx - 1] !== '\n';
    const insertionPrefix = `${needsLineBreak ? '\n' : ''}${prefix}`;
    const newContent = beforeSlash + insertionPrefix + placeholder + suffix + afterCursor;
    const selectionStart = lastSlashIdx + insertionPrefix.length;
    const selectionEnd = selectionStart + placeholder.length;
    handleChange('content', newContent);
    setSlashOpen(false);
    setSlashQuery('');
    window.setTimeout(() => {
      textareaRef.current?.focus();
      textareaRef.current?.setSelectionRange(selectionStart, selectionEnd);
    }, 0);
  };

  const handleDelete = async () => { if (window.confirm('Delete this note permanently?')) { await onDelete(); } };
  const handlePinToggle = async () => {
    const newPinned = !pinned;
    setPinned(newPinned);
    if (note?.id && onTogglePin) await onTogglePin(note.id);
  };
  const handleShareToggle = () => {
    if (!note?.id) { alert('Please save the note first to share it.'); return; }
    setShareSheetOpen(true);
  };

  const handleGenerateSummary = async () => {
    setShowSummary(true);
    if (isGeneratingSummary) return;
    if (!content.trim() || wordCount < 10) {
      setSummaryData(null);
      setSummaryError('Write a bit more before generating an insight.');
      return;
    }
    setIsGeneratingSummary(true);
    setSummaryError(null);
    setSummaryData(null);
    const systemPrompt = `You are a note analyst. Analyse the note and return ONLY a valid JSON object.
JSON shape: { "summary": string, "themes": string[], "actions": string[], "suggestedTags": string[] }`;
    try {
      const existingTagsNote = tags.length > 0 ? `\n\nExisting tags: ${tags.join(', ')}` : '';
      const noteText = `Title: ${title || 'Untitled'}\n\n${content}${existingTagsNote}`;
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: 1000, system: systemPrompt, messages: [{ role: 'user', content: noteText }] }),
      });
      if (!response.ok) throw new Error(`API error ${response.status}`);
      const data = await response.json();
      const text = data.content?.find((b: { type: string }) => b.type === 'text')?.text ?? '';
      const clean = text.replace(/```(?:json)?|```/g, '').trim();
      const parsed = JSON.parse(clean);
      setSummaryData({
        summary: typeof parsed.summary === 'string' ? parsed.summary : '',
        themes: Array.isArray(parsed.themes) ? parsed.themes.slice(0, 4) : [],
        actions: Array.isArray(parsed.actions) ? parsed.actions.slice(0, 4) : [],
        suggestedTags: Array.isArray(parsed.suggestedTags) ? parsed.suggestedTags.slice(0, 5) : [],
      });
    } catch (err) {
      console.error('Summary failed:', err);
      setSummaryError('Couldn\'t generate insight — please try again.');
    } finally { setIsGeneratingSummary(false); }
  };

  const handleCopySummary = () => {
    if (!summaryData) return;
    const text = [
      summaryData.summary,
      summaryData.themes.length ? `\nThemes: ${summaryData.themes.join(', ')}` : '',
      summaryData.actions.length ? `\nAction items:\n${summaryData.actions.map(a => `- ${a}`).join('\n')}` : '',
    ].join('');
    navigator.clipboard.writeText(text).then(() => {
      setCopiedSummary(true);
      setTimeout(() => setCopiedSummary(false), 2000);
    });
  };

  const handleAddSuggestedTag = (tag: string) => { if (!tags.includes(tag)) { handleChange('tags', [...tags, tag]); } };
  const addTag = () => {
    const t = tagInput.trim().replace(/^#/, '');
    if (t && !tags.includes(t)) { handleChange('tags', [...tags, t]); }
    setTagInput('');
  };

  const filteredCommands = SLASH_COMMANDS.filter((cmd) => {
    const query = slashQuery.toLowerCase();
    return cmd.label.toLowerCase().includes(query) || cmd.id.includes(query) || cmd.description.toLowerCase().includes(query);
  });
  const groupedCommands = filteredCommands.reduce<Record<string, SlashCommand[]>>((acc, cmd) => {
    acc[cmd.category] = [...(acc[cmd.category] ?? []), cmd];
    return acc;
  }, {});

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Tab') { e.preventDefault(); insertText('  '); return; }
    if (!slashOpen) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setSlashIndex((prev) => (prev + 1) % Math.max(filteredCommands.length, 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setSlashIndex((prev) => (prev - 1 + Math.max(filteredCommands.length, 1)) % Math.max(filteredCommands.length, 1)); }
    else if (e.key === 'Enter') { e.preventDefault(); executeSlashCommand(filteredCommands[slashIndex]); }
    else if (e.key === 'Escape') { setSlashOpen(false); }
    else if (e.key === 'Backspace' && slashQuery === '') { setSlashOpen(false); }
  };

  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    handleChange('content', val);
    const cursor = e.target.selectionStart;
    const { prefix } = getLinePrefix(val, cursor);
    if (prefix === '/') { setSlashOpen(true); setSlashQuery(''); setSlashIndex(0); return; }
    if (slashOpen) {
      const slashMatch = prefix.match(/\/([^\s/]*)$/);
      if (slashMatch) { setSlashQuery(slashMatch[1]); setSlashIndex(0); }
      else { setSlashOpen(false); }
    }
  };

  const wordCount = content.trim() ? content.trim().split(/\s+/).length : 0;
  const charCount = content.length;
  const readTime = estimateReadingTime(wordCount);
  const activeCommand = filteredCommands[slashIndex];

  return (
    <div className={`relative flex h-full w-full overflow-hidden ${focusMode ? 'bg-background' : ''}`}>
      <motion.div
        layoutId={note ? `note-${note.id}` : 'new-note'}
        className="flex h-full flex-1 flex-col overflow-hidden bg-background transition-colors duration-300"
        style={{
          background: focusMode ? 'var(--background)' : colorMap[color]?.hex
        }}
      >
        <header
          className={`sticky top-0 z-10 flex min-h-14 items-center gap-2 te-surface border-x-0 border-t-0 px-4 transition-opacity duration-300 ${focusMode ? 'opacity-0 hover:opacity-100' : 'opacity-100'}`}
        >
          <button onClick={onClose} className="rounded-lg p-2 te-button text-muted-foreground" aria-label="Back">
            <ArrowLeft size={15} />
          </button>

          {/* Desktop markdown toolbar - Industrial button strip */}
          <div className={`hidden items-center gap-0.5 rounded-lg te-inset p-1 ${editorMode === 'preview' ? 'md:hidden' : 'md:flex'}`}>
            <ToolbarButton label="Heading" onClick={() => insertText('## ', '', 'Heading', true)} icon={<Heading2 size={13} />} />
            <ToolbarButton label="Bold" onClick={() => insertMarkdown('**')} icon={<Bold size={13} />} />
            <ToolbarButton label="Italic" onClick={() => insertMarkdown('*')} icon={<Italic size={13} />} />
            <ToolbarButton label="Strike" onClick={() => insertMarkdown('~~')} icon={<Strikethrough size={13} />} />
            <ToolbarButton label="Code" onClick={() => insertText('`', '`', 'code')} icon={<Code size={13} />} />
            <div className="w-px h-4 bg-border mx-1" />
            <ToolbarButton label="Quote" onClick={() => insertText('> ', '', 'Quote', true)} icon={<Quote size={13} />} />
            <ToolbarButton label="List" onClick={() => insertText('- ', '', 'List item', true)} icon={<List size={13} />} />
            <ToolbarButton label="Task" onClick={() => insertText('- [ ] ', '', 'Todo', true)} icon={<CheckSquare size={13} />} />
            <ToolbarButton label="Link" onClick={() => insertText('[', '](https://)', 'link')} icon={<Link size={13} />} />
          </div>

          <div className="flex-1" />

          {/* Mode Switcher - Physical Rocker */}
          <div className="hidden items-center rounded-lg te-inset p-0.5 sm:flex font-mono">
            <button
              onClick={() => setEditorMode('edit')}
              className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[10px] font-bold tracking-widest uppercase transition-colors ${editorMode === 'edit' ? 'te-surface text-primary' : 'text-muted-foreground hover:text-foreground'}`}
            >
              <Pencil size={11} /> Edit
            </button>
            <button
              onClick={() => setEditorMode('split')}
              className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[10px] font-bold tracking-widest uppercase transition-colors ${editorMode === 'split' ? 'te-surface text-primary' : 'text-muted-foreground hover:text-foreground'}`}
            >
              <Columns2 size={11} /> Split
            </button>
            <button
              onClick={() => setEditorMode('preview')}
              className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[10px] font-bold tracking-widest uppercase transition-colors ${editorMode === 'preview' ? 'te-surface text-primary' : 'text-muted-foreground hover:text-foreground'}`}
            >
              <Eye size={11} /> View
            </button>
          </div>

          <button onClick={() => setFocusMode((open) => !open)} className={`hidden rounded-lg p-2 transition-colors sm:block te-button ${focusMode ? 'text-primary border-primary bg-primary/10' : 'text-muted-foreground'}`} aria-label="Focus mode">
            <Focus size={13} />
          </button>

          <div className="relative">
            <button onClick={() => setShowColorPicker(!showColorPicker)} className="rounded-lg p-2 te-button text-muted-foreground" aria-label="Background color">
              <Palette size={13} />
            </button>
            <AnimatePresence>
              {showColorPicker && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.96, y: -6 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.96, y: -6 }}
                  className="absolute right-0 top-full z-50 mt-2 w-48 rounded-xl te-surface p-2 shadow-2xl"
                >
                  <div className="text-[10px] font-mono font-bold text-muted-foreground tracking-widest mb-2 px-2 uppercase">PAPER TYPE</div>
                  {Object.entries(colorMap).map(([key, val]) => (
                    <button
                      key={key}
                      onClick={() => handleChange('color', key)}
                      className="flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-xs font-bold font-mono transition-colors hover:bg-muted"
                    >
                      <span className="h-4 w-4 flex-shrink-0 rounded-full border border-border" style={{ backgroundColor: val.hex }} />
                      <span className="flex-1 text-left uppercase tracking-wider">{val.label}</span>
                      {color === key && <Check size={12} className="text-primary" />}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <button onClick={handlePinToggle} className={`hidden rounded-lg p-2 transition-colors sm:block te-button ${pinned ? 'text-primary' : 'text-muted-foreground'}`} aria-label={pinned ? 'Unpin' : 'Pin'}>
            {pinned ? <Pin size={13} /> : <PinOff size={13} />}
          </button>

          {/* Collaborators */}
          <div className="flex items-center gap-1 mr-1 ml-1">
            {Object.values(presentUsers).filter((u) => u.id !== user?.id).map((u) => {
              const isTyping = !!typingUsers[u.id];
              const palette = ['bg-rose-400', 'bg-orange-400', 'bg-amber-400', 'bg-emerald-500', 'bg-teal-500', 'bg-sky-500', 'bg-indigo-500', 'bg-violet-500', 'bg-pink-500'];
              let h = 0; for (let i = 0; i < (u.id || '').length; i++) h = (h * 31 + (u.id || '').charCodeAt(i)) >>> 0;
              const avatarBg = palette[h % palette.length];
              return (
                <div key={u.id} className="group relative flex h-7 w-7 items-center justify-center rounded-full te-surface border border-border">
                  {u.avatarUrl ? (
                    <img src={u.avatarUrl} alt={u.fullName || u.email} className="h-full w-full rounded-full object-cover" />
                  ) : (
                    <div className={`h-full w-full rounded-full ${avatarBg} flex items-center justify-center`}><span className="text-[10px] font-bold text-white">{(u.email || '?').charAt(0).toUpperCase()}</span></div>
                  )}
                  {isTyping && <span className="absolute -bottom-0.5 -right-0.5 flex h-3 w-3 items-center justify-center rounded-full bg-primary ring-2 ring-background"><span className="h-1 w-1 animate-pulse rounded-full bg-white" /></span>}
                  <div className="absolute top-full z-50 mt-1.5 hidden whitespace-nowrap rounded-lg te-surface px-2 py-1.5 text-[10px] font-mono shadow-lg group-hover:block pointer-events-none">
                    <p className="font-bold uppercase tracking-wider">{u.fullName || u.email}</p>
                    {isTyping && <p className="text-primary mt-0.5">// EDITING</p>}
                  </div>
                </div>
              );
            })}
          </div>

          <button onClick={handleShareToggle} className="hidden rounded-lg p-2 te-button text-muted-foreground sm:block" aria-label="Share">
            <Share size={13} />
          </button>

          <button onClick={handleGenerateSummary} className="hidden items-center gap-1.5 rounded-lg te-button px-3 py-1.5 text-[10px] font-mono font-bold uppercase tracking-widest text-foreground sm:flex">
            <Radio size={12} className="text-primary" />
            ANALYZE
          </button>

          <button onClick={handleDelete} className="rounded-lg p-2 te-button-destructive text-white" aria-label="Delete note">
            <Trash2 size={13} />
          </button>
          
          <button onClick={() => { setShowMobileMore(v => !v); setShowMobileToolbar(false); }} className={`rounded-lg p-2 transition-colors sm:hidden te-button ${showMobileMore ? 'text-primary' : 'text-muted-foreground'}`}>
            <MoreHorizontal size={15} />
          </button>
        </header>

        <div className="flex min-h-0 flex-1 overflow-hidden relative">
          <AnimatePresence initial={false}>
            {editorMode !== 'preview' && (
              <motion.div
                key="edit-pane"
                initial={editorMode === 'split' ? { opacity: 0, x: -16 } : false}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -16 }}
                transition={{ duration: 0.18 }}
                className={`min-w-0 flex-1 overflow-y-auto px-5 py-8 sm:px-10 ${!focusMode && 'te-ruled-lines'} ${editorMode === 'split' ? 'border-r border-border md:px-10 lg:px-12' : 'md:px-16 lg:px-24'}`}
              >
                <div className="mx-auto flex w-full max-w-3xl flex-col">
                  {/* Status Badges */}
                  <div className="mb-5 flex flex-wrap items-center gap-2">
                    <span className="rounded te-inset px-2 py-0.5 text-[9px] font-mono font-bold tracking-widest text-muted-foreground border-none bg-muted/50">{readTime}M READ</span>
                    <span className="rounded te-inset px-2 py-0.5 text-[9px] font-mono font-bold tracking-widest text-muted-foreground border-none bg-muted/50">{wordCount} W</span>
                    {pinned && <span className="rounded te-surface bg-primary text-primary-foreground px-2 py-0.5 text-[9px] font-mono font-bold tracking-widest border-none">PINNED</span>}
                  </div>

                  <input
                    type="text"
                    value={title}
                    onChange={(e) => handleChange('title', e.target.value)}
                    placeholder="UNTITLED"
                    className="mb-5 w-full border-none bg-transparent text-4xl font-bold font-sans tracking-tight text-foreground outline-none placeholder:text-muted-foreground/40 sm:text-5xl te-emboss uppercase"
                  />

                  {/* Tags */}
                  <div className="mb-8 flex flex-wrap items-center gap-2">
                    {tags.map((tag) => (
                      <span key={tag} className="flex items-center gap-1 rounded te-inset px-2 py-1 text-[10px] font-mono font-bold tracking-wider text-muted-foreground border-none bg-muted/50">
                        #{tag.toUpperCase()}
                        <button onClick={() => handleChange('tags', tags.filter((t) => t !== tag))} className="rounded p-0.5 hover:bg-destructive hover:text-white transition-colors">
                          <X size={10} />
                        </button>
                      </span>
                    ))}
                    <div className="relative flex items-center">
                      <span className="text-muted-foreground text-[10px] font-mono font-bold mr-1">+</span>
                      <input
                        type="text"
                        value={tagInput}
                        onChange={(e) => setTagInput(e.target.value)}
                        onBlur={() => tagInput.trim() && addTag()}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag(); } }}
                        placeholder="TAG"
                        className="w-20 border-none bg-transparent text-[10px] font-mono font-bold text-muted-foreground outline-none placeholder:text-muted-foreground/50 uppercase"
                      />
                    </div>
                  </div>

                  {/* Editor Area */}
                  <div className="relative">
                    <textarea
                      ref={textareaRef}
                      value={content}
                      onChange={handleContentChange}
                      onKeyDown={handleKeyDown}
                      placeholder="// START WRITING... TYPE '/' FOR COMMANDS"
                      className="min-h-[520px] w-full flex-1 resize-none border-none bg-transparent text-base font-sans leading-[1.8] text-foreground outline-none placeholder:text-muted-foreground/40 placeholder:font-mono"
                      spellCheck
                    />

                    {/* Slash Command Menu */}
                    <AnimatePresence>
                      {slashOpen && (
                        <motion.div
                          initial={{ opacity: 0, y: 8, scale: 0.98 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: 8, scale: 0.98 }}
                          className="absolute left-0 top-10 z-50 w-[24rem] overflow-hidden rounded-xl te-surface shadow-2xl"
                        >
                          <div className="flex items-center gap-2 border-b border-border px-3 py-2 bg-muted">
                            <span className="text-[10px] font-mono font-bold text-muted-foreground tracking-widest">COMMAND LINE</span>
                            <span className="ml-auto rounded te-inset bg-background px-1.5 py-0.5 text-[9px] font-mono font-bold text-muted-foreground">ESC</span>
                          </div>
                          {filteredCommands.length === 0 ? (
                            <div className="px-4 py-6 text-center text-[10px] font-mono text-muted-foreground">NO MATCH FOR "{slashQuery.toUpperCase()}"</div>
                          ) : (
                            <div className="max-h-80 overflow-y-auto p-2">
                              {Object.entries(groupedCommands).map(([category, commands]) => (
                                <div key={category} className="py-1">
                                  <div className="px-2 py-1 text-[9px] font-bold font-mono uppercase tracking-widest text-muted-foreground/70">{category}</div>
                                  {commands.map((cmd) => {
                                    const flatIndex = filteredCommands.findIndex((item) => item.id === cmd.id);
                                    const active = activeCommand?.id === cmd.id;
                                    return (
                                      <button
                                        key={cmd.id}
                                        onClick={() => executeSlashCommand(cmd)}
                                        onMouseEnter={() => setSlashIndex(flatIndex)}
                                        className={`flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors ${active ? 'bg-primary text-primary-foreground' : 'text-foreground hover:bg-muted'}`}
                                      >
                                        <span className={`flex h-7 w-7 items-center justify-center rounded-md ${active ? 'bg-white/20' : 'te-inset bg-background'}`}>
                                          {cmd.icon}
                                        </span>
                                        <span className="min-w-0 flex-1">
                                          <span className="block text-xs font-bold font-mono tracking-wide">{cmd.label.toUpperCase()}</span>
                                          <span className={`block text-[10px] font-mono truncate ${active ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>{cmd.description}</span>
                                        </span>
                                      </button>
                                    );
                                  })}
                                </div>
                              ))}
                            </div>
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Preview Pane */}
          <AnimatePresence initial={false}>
            {editorMode !== 'edit' && (
              <motion.div
                key="preview-pane"
                initial={{ opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 16 }}
                transition={{ duration: 0.18 }}
                className={`min-w-0 overflow-y-auto bg-background/50 backdrop-blur-md ${editorMode === 'preview' ? 'flex-1 px-5 py-8 sm:px-10 md:px-16 lg:px-24' : 'flex-1 px-6 py-8 lg:px-10'}`}
              >
                <div className={`mx-auto w-full max-w-3xl ${editorMode === 'split' ? 'max-w-none' : ''}`}>
                  {editorMode === 'preview' && (
                    <>
                      <div className="mb-5 flex flex-wrap items-center gap-2">
                        <span className="rounded te-inset px-2 py-0.5 text-[9px] font-mono font-bold tracking-widest text-muted-foreground border-none bg-muted/50">{readTime}M READ</span>
                        <span className="rounded te-inset px-2 py-0.5 text-[9px] font-mono font-bold tracking-widest text-muted-foreground border-none bg-muted/50">{wordCount} W</span>
                      </div>
                      <h1 className="mb-6 text-4xl font-bold font-sans tracking-tight text-foreground uppercase te-emboss sm:text-5xl">{title || <span className="text-muted-foreground">UNTITLED</span>}</h1>
                    </>
                  )}
                  {editorMode === 'split' && (
                    <div className="mb-4 flex items-center gap-2 text-[10px] font-bold font-mono uppercase tracking-widest text-muted-foreground">
                      <Eye size={11} /> PREVIEW
                    </div>
                  )}
                  <div className="prose prose-sm max-w-none dark:prose-invert font-sans">
                    {renderPreview(content)}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Cassette-tape status bar */}
        <div className="flex h-8 flex-shrink-0 items-center justify-between te-inset rounded-none border-x-0 border-b-0 px-4">
          <div className="flex items-center gap-4 text-[9px] font-bold font-mono tracking-widest uppercase text-muted-foreground">
            <span>{charCount} C</span>
            <span>{content.split('\n').length} L</span>
          </div>
          <AnimatePresence mode="wait">
            {isSyncing && (
              <motion.span key="syncing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center gap-1.5 text-[9px] font-bold font-mono tracking-widest uppercase text-primary">
                <Loader2 size={10} className="animate-spin" /> SYNCING...
              </motion.span>
            )}
            {!isSyncing && saveStatus === 'saving' && (
              <motion.span key="saving" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center gap-1.5 text-[9px] font-bold font-mono tracking-widest uppercase text-primary">
                <span className="w-1.5 h-1.5 rounded-full te-led te-led-on animate-pulse" />
                REC...
              </motion.span>
            )}
            {!isSyncing && saveStatus === 'saved' && (
              <motion.span key="saved" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center gap-1.5 text-[9px] font-bold font-mono tracking-widest uppercase text-muted-foreground">
                <span className="w-1.5 h-1.5 rounded-full te-led te-led-off" />
                SAVED
              </motion.span>
            )}
          </AnimatePresence>
        </div>

        {/* Mobile Format Toolbar */}
        <AnimatePresence>
          {showMobileToolbar && (
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              className="absolute bottom-0 left-0 right-0 z-30 sm:hidden te-surface rounded-t-2xl pb-4"
            >
              <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-muted/50 rounded-t-2xl">
                <span className="text-[9px] font-bold font-mono uppercase tracking-widest text-muted-foreground">FORMAT</span>
                <button onClick={() => setShowMobileToolbar(false)} className="rounded p-1 text-muted-foreground hover:bg-background">
                  <X size={12} />
                </button>
              </div>
              <div className="grid grid-cols-5 gap-2 p-3">
                {[
                  { label: 'H2', icon: <Heading2 size={14} />, action: () => insertText('## ', '', 'Heading', true) },
                  { label: 'BOLD', icon: <Bold size={14} />, action: () => insertMarkdown('**') },
                  { label: 'ITAL', icon: <Italic size={14} />, action: () => insertMarkdown('*') },
                  { label: 'STRK', icon: <Strikethrough size={14} />, action: () => insertMarkdown('~~') },
                  { label: 'CODE', icon: <Code size={14} />, action: () => insertText('`', '`', 'code') },
                  { label: 'QUOTE', icon: <Quote size={14} />, action: () => insertText('> ', '', 'Quote', true) },
                  { label: 'LIST', icon: <List size={14} />, action: () => insertText('- ', '', 'List item', true) },
                  { label: 'TASK', icon: <CheckSquare size={14} />, action: () => insertText('- [ ] ', '', 'Todo', true) },
                  { label: 'LINK', icon: <Link size={14} />, action: () => insertText('[', '](https://)', 'link') },
                  { label: 'H3', icon: <Heading3 size={14} />, action: () => insertText('### ', '', 'Heading', true) },
                ].map(({ label, icon, action }) => (
                  <button key={label} onClick={() => { action(); setShowMobileToolbar(false); }} className="flex flex-col items-center gap-1.5 rounded-lg p-2 te-button text-muted-foreground">
                    {icon}
                    <span className="text-[8px] font-bold font-mono">{label}</span>
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Mobile More Options */}
        <AnimatePresence>
          {showMobileMore && (
            <>
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-30 sm:hidden bg-background/80 backdrop-blur-sm" onClick={() => setShowMobileMore(false)} />
              <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} className="absolute bottom-0 left-0 right-0 z-40 sm:hidden rounded-t-2xl te-surface pb-6">
                <div className="flex justify-center pt-3 pb-2"><div className="h-1 w-10 rounded-full bg-border" /></div>
                <div className="grid grid-cols-4 gap-2 px-4 py-2">
                  <button onClick={handlePinToggle} className={`flex flex-col items-center gap-1.5 rounded-xl py-3 te-button ${pinned ? 'text-primary' : 'text-muted-foreground'}`}>
                    {pinned ? <Pin size={16} /> : <PinOff size={16} />}
                    <span className="text-[9px] font-bold font-mono uppercase">{pinned ? 'UNPIN' : 'PIN'}</span>
                  </button>
                  <button onClick={() => { setShowMobileMore(false); handleShareToggle(); }} className="flex flex-col items-center gap-1.5 rounded-xl py-3 te-button text-muted-foreground">
                    <Share size={16} />
                    <span className="text-[9px] font-bold font-mono uppercase">SHARE</span>
                  </button>
                  <button onClick={() => { setShowMobileMore(false); handleGenerateSummary(); }} className="flex flex-col items-center gap-1.5 rounded-xl py-3 te-button text-muted-foreground">
                    <Radio size={16} className="text-primary" />
                    <span className="text-[9px] font-bold font-mono uppercase">ANALYZE</span>
                  </button>
                  <button onClick={() => { setFocusMode(v => !v); setShowMobileMore(false); }} className={`flex flex-col items-center gap-1.5 rounded-xl py-3 te-button ${focusMode ? 'text-primary' : 'text-muted-foreground'}`}>
                    <Focus size={16} />
                    <span className="text-[9px] font-bold font-mono uppercase">FOCUS</span>
                  </button>
                  <button onClick={() => { setShowColorPicker(v => !v); setShowMobileMore(false); }} className="flex flex-col items-center gap-1.5 rounded-xl py-3 te-button text-muted-foreground">
                    <Palette size={16} />
                    <span className="text-[9px] font-bold font-mono uppercase">PAPER</span>
                  </button>
                  <button onClick={() => { setShowMobileMore(false); handleDelete(); }} className="flex flex-col items-center gap-1.5 rounded-xl py-3 te-button-destructive">
                    <Trash2 size={16} />
                    <span className="text-[9px] font-bold font-mono uppercase">DELETE</span>
                  </button>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>

      </motion.div>

      <AnimatePresence>
        {shareSheetOpen && note?.id && onTogglePublicShare && getCollaborators && addCollaborator && removeCollaborator && updateCollaborator && (
          <ShareSheet
            noteId={note.id}
            noteOwnerId={note.userId}
            isPublic={isPublic}
            shareSlug={note.shareSlug}
            onTogglePublicShare={onTogglePublicShare}
            getCollaborators={getCollaborators}
            addCollaborator={addCollaborator}
            removeCollaborator={removeCollaborator}
            updateCollaborator={updateCollaborator}
            onClose={() => setShareSheetOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* AI Insight Panel */}
      <AnimatePresence>
        {showSummary && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="flex h-full w-full flex-shrink-0 flex-col overflow-hidden border-l border-border te-surface md:w-80"
          >
            <div className="flex h-14 items-center justify-between border-b border-border bg-muted px-4">
              <div className="flex items-center gap-2 text-[10px] font-bold font-mono uppercase tracking-widest text-muted-foreground">
                <Radio size={12} className="text-primary" /> ANALYSIS MODULE
              </div>
              <div className="flex items-center gap-1">
                {summaryData && !isGeneratingSummary && (
                  <button onClick={handleGenerateSummary} className="rounded p-1 text-muted-foreground hover:bg-background te-button"><RefreshCw size={11} /></button>
                )}
                <button onClick={() => setShowSummary(false)} className="rounded p-1 text-muted-foreground hover:bg-background te-button"><X size={11} /></button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-5 relative te-noise">
              <div className="mb-6 grid grid-cols-3 gap-2">
                <Stat label="WORDS" value={wordCount.toString()} />
                <Stat label="TIME" value={`${readTime}M`} />
                <Stat label="LINES" value={content.split('\n').filter(l => l.trim()).length.toString()} />
              </div>

              {isGeneratingSummary && (
                <div className="space-y-6">
                  <div className="flex items-center gap-2 text-[10px] font-bold font-mono uppercase tracking-widest text-primary">
                    <Loader2 size={12} className="animate-spin" /> PROCESSING...
                  </div>
                  <div className="space-y-3">
                    <div className="h-2 bg-primary/20 animate-pulse w-[90%]" />
                    <div className="h-2 bg-primary/20 animate-pulse w-[75%]" />
                    <div className="h-2 bg-primary/20 animate-pulse w-[85%]" />
                  </div>
                </div>
              )}

              {!isGeneratingSummary && summaryError && (
                <div className="space-y-4">
                  <p className="text-xs font-mono text-destructive uppercase">{summaryError}</p>
                  {wordCount >= 10 && (
                    <button onClick={handleGenerateSummary} className="te-button-primary rounded px-3 py-1.5 text-[10px] font-bold font-mono uppercase tracking-widest flex items-center gap-2">
                      <RefreshCw size={10} /> RETRY
                    </button>
                  )}
                </div>
              )}

              {!isGeneratingSummary && !summaryError && !summaryData && (
                <div className="flex flex-col items-center gap-4 pt-10 text-center">
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl te-inset border-border border shadow-inner">
                    <Radio size={24} className="text-primary" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold font-mono uppercase tracking-widest text-foreground">AI ANALYSIS</p>
                    <p className="mt-2 text-xs font-mono text-muted-foreground">Extract summary, themes, actions, and tags.</p>
                  </div>
                  <button onClick={handleGenerateSummary} disabled={wordCount < 10} className="te-button-primary rounded px-4 py-2 text-[10px] font-bold font-mono uppercase tracking-widest flex items-center gap-2 disabled:opacity-50 disabled:grayscale">
                    <Radio size={12} /> {wordCount < 10 ? 'INSUFFICIENT DATA' : 'START ANALYSIS'}
                  </button>
                </div>
              )}

              {!isGeneratingSummary && summaryData && (
                <div className="space-y-6">
                  <div>
                    <div className="mb-2 flex items-center justify-between">
                      <p className="text-[9px] font-bold font-mono uppercase tracking-widest text-muted-foreground">SUMMARY</p>
                      <button onClick={handleCopySummary} className="flex items-center gap-1 rounded te-button px-1.5 py-0.5 text-[9px] font-bold font-mono uppercase text-muted-foreground">
                        {copiedSummary ? <Check size={9} className="text-primary" /> : <Copy size={9} />}
                        {copiedSummary ? 'COPIED' : 'COPY'}
                      </button>
                    </div>
                    <p className="text-sm font-sans leading-relaxed text-foreground bg-background p-3 rounded te-inset">{summaryData.summary}</p>
                  </div>

                  {summaryData.themes.length > 0 && (
                    <div>
                      <p className="mb-2.5 text-[9px] font-bold font-mono uppercase tracking-widest text-muted-foreground">THEMES</p>
                      <div className="flex flex-wrap gap-1.5">
                        {summaryData.themes.map((theme) => (
                          <span key={theme} className="rounded te-inset bg-muted px-2 py-1 text-[9px] font-bold font-mono uppercase tracking-wider text-foreground border-none">
                            {theme}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {summaryData.actions.length > 0 && (
                    <div>
                      <p className="mb-2.5 text-[9px] font-bold font-mono uppercase tracking-widest text-muted-foreground">ACTIONS</p>
                      <ul className="space-y-2">
                        {summaryData.actions.map((action, i) => (
                          <li key={i} className="flex items-start gap-2 text-xs font-sans text-foreground">
                            <span className="mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-primary" />
                            {action}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {summaryData.suggestedTags.length > 0 && (
                    <div>
                      <p className="mb-2.5 text-[9px] font-bold font-mono uppercase tracking-widest text-muted-foreground">SUGGESTED TAGS</p>
                      <div className="flex flex-wrap gap-1.5">
                        {summaryData.suggestedTags.map((tag) => {
                          const already = tags.includes(tag);
                          return (
                            <button key={tag} onClick={() => !already && handleAddSuggestedTag(tag)} disabled={already} className={`flex items-center gap-1 rounded px-2 py-1 text-[9px] font-bold font-mono uppercase tracking-wider transition-all ${already ? 'te-surface bg-muted text-muted-foreground' : 'te-button text-primary border-primary'}`}>
                              {already ? <Check size={8} /> : <Tag size={8} />} #{tag}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

function ToolbarButton({ label, icon, onClick }: { label: string; icon: React.ReactNode; onClick: () => void }) {
  return (
    <button onClick={onClick} className="rounded p-1.5 text-muted-foreground te-button" title={label} aria-label={label}>
      {icon}
    </button>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-border te-inset bg-background p-2">
      <p className="text-[8px] font-bold font-mono uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-sm font-bold font-mono text-foreground">{value}</p>
    </div>
  );
}