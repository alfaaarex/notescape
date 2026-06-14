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
  Eye,
  EyeOff,
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
  Minus,
  Palette,
  PanelRight,
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
} from 'lucide-react';
import type { Note } from '@/lib/storage';
import type { Collaborator, CollaboratorRole, Profile } from '@/lib/types';
import { supabase } from '@/lib/supabaseClient';
import { ShareSheet } from '@/components/share-sheet';
import { useAuth } from '@/components/auth-provider';

interface EditorProps {
  note: Note | null;
  onSave: (note: Note) => Promise<void>;
  onDelete: () => Promise<void>;
  onClose: () => void;
  onTogglePin?: (id: string) => Promise<void>;
  onTogglePublicShare?: (id: string, isPublic: boolean) => Promise<void>;
  getCollaborators?: (noteId: string) => Promise<Collaborator[]>;
  addCollaborator?: (noteId: string, email: string, role: CollaboratorRole) => Promise<{ error?: string; success?: boolean }>;
  removeCollaborator?: (noteId: string, userId: string) => Promise<void>;
  updateCollaborator?: (noteId: string, userId: string, role: CollaboratorRole) => Promise<void>;
}

const colorMap: Record<string, { label: string; hex: string; ring: string }> = {
  alabaster: { label: 'Alabaster', hex: '#F9F9F6', ring: '#E6E4DC' },
  sage: { label: 'Soft Sage', hex: '#EEF2EE', ring: '#CFDCCF' },
  linen: { label: 'Warm Linen', hex: '#FDF8F5', ring: '#EAD8CE' },
  slate: { label: 'Faint Slate', hex: '#F0F1F4', ring: '#D9DDE5' },
  lavender: { label: 'Washed Lavender', hex: '#F3EFFF', ring: '#DCD1FF' },
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

// Render inline markdown: bold, italic, code, strikethrough, links
const renderInline = (text: string): React.ReactNode[] => {
  const parts: React.ReactNode[] = [];
  // Pattern order matters: code first (to avoid processing its contents), then links, then bold+italic combos
  const pattern = /(`[^`]+`|\*\*\*(.+?)\*\*\*|\*\*(.+?)\*\*|\*(.+?)\*|~~(.+?)~~|\[([^\]]+)\]\(([^)]+)\))/g;
  let last = 0;
  let match: RegExpExecArray | null;
  let idx = 0;
  while ((match = pattern.exec(text)) !== null) {
    if (match.index > last) parts.push(<span key={`t-${idx++}`}>{text.slice(last, match.index)}</span>);
    const m = match[0];
    if (m.startsWith('`')) {
      parts.push(<code key={`c-${idx++}`} className="rounded bg-gray-100 px-1 py-0.5 font-mono text-sm text-rose-600 dark:bg-zinc-800 dark:text-rose-400">{m.slice(1, -1)}</code>);
    } else if (m.startsWith('***')) {
      parts.push(<strong key={`bi-${idx++}`} className="font-bold italic">{match[2]}</strong>);
    } else if (m.startsWith('**')) {
      parts.push(<strong key={`b-${idx++}`} className="font-semibold text-gray-900 dark:text-zinc-100">{match[3]}</strong>);
    } else if (m.startsWith('*')) {
      parts.push(<em key={`i-${idx++}`} className="italic">{match[4]}</em>);
    } else if (m.startsWith('~~')) {
      parts.push(<s key={`s-${idx++}`} className="line-through text-gray-400 dark:text-zinc-500">{match[5]}</s>);
    } else if (m.startsWith('[')) {
      parts.push(<a key={`a-${idx++}`} href={match[7]} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline underline-offset-2 dark:text-blue-400">{match[6]}</a>);
    }
    last = match.index + m.length;
  }
  if (last < text.length) parts.push(<span key={`t-${idx++}`}>{text.slice(last)}</span>);
  return parts;
};

const renderPreview = (text: string) => {
  if (!text.trim()) {
    return <p className="text-gray-400 dark:text-zinc-500">Nothing to preview yet.</p>;
  }

  const lines = text.split('\n');
  const elements: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const key = `${i}-${line.slice(0, 20)}`;

    // Fenced code blocks
    if (line.startsWith('```')) {
      const lang = line.slice(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      elements.push(
        <pre key={key} className="my-4 overflow-x-auto rounded-xl bg-gray-950 px-5 py-4 text-sm leading-relaxed dark:bg-zinc-900">
          <code className={`text-gray-100 font-mono ${lang ? `language-${lang}` : ''}`}>{codeLines.join('\n')}</code>
        </pre>
      );
      i++;
      continue;
    }

    if (line.startsWith('# ')) { elements.push(<h1 key={key} className="mt-7 first:mt-0 text-3xl font-bold text-gray-950 dark:text-zinc-50">{renderInline(line.slice(2))}</h1>); }
    else if (line.startsWith('## ')) { elements.push(<h2 key={key} className="mt-6 text-2xl font-bold text-gray-900 dark:text-zinc-100">{renderInline(line.slice(3))}</h2>); }
    else if (line.startsWith('### ')) { elements.push(<h3 key={key} className="mt-5 text-xl font-semibold text-gray-900 dark:text-zinc-100">{renderInline(line.slice(4))}</h3>); }
    else if (line.startsWith('- [ ] ')) { elements.push(<p key={key} className="my-1.5 flex items-start gap-2 text-gray-700 dark:text-zinc-300"><span className="mt-1 inline-block h-4 w-4 flex-shrink-0 rounded border border-gray-300 dark:border-zinc-600" /><span>{renderInline(line.slice(6))}</span></p>); }
    else if (line.startsWith('- [x] ') || line.startsWith('- [X] ')) { elements.push(<p key={key} className="my-1.5 flex items-start gap-2 text-gray-500 dark:text-zinc-500"><span className="mt-1 inline-flex h-4 w-4 flex-shrink-0 items-center justify-center rounded bg-gray-800 dark:bg-zinc-200"><svg viewBox="0 0 10 10" className="h-2.5 w-2.5 text-white dark:text-zinc-900" fill="none"><path d="M2 5l2.5 2.5L8 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg></span><span className="line-through">{renderInline(line.slice(6))}</span></p>); }
    else if (line.startsWith('- ')) { elements.push(<p key={key} className="my-1.5 flex items-start gap-2 text-gray-700 dark:text-zinc-300"><span className="mt-2 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-gray-400 dark:bg-zinc-500" /><span>{renderInline(line.slice(2))}</span></p>); }
    else if (/^\d+\.\s/.test(line)) { elements.push(<p key={key} className="my-1.5 text-gray-700 dark:text-zinc-300">{renderInline(line)}</p>); }
    else if (line.startsWith('> ')) { elements.push(<blockquote key={key} className="my-3 border-l-2 border-indigo-300 pl-4 text-gray-600 italic dark:border-indigo-700 dark:text-zinc-400">{renderInline(line.slice(2))}</blockquote>); }
    else if (line === '---') { elements.push(<hr key={key} className="my-6 border-gray-200 dark:border-zinc-800" />); }
    else if (!line.trim()) { elements.push(<div key={key} className="h-3" />); }
    else { elements.push(<p key={key} className="my-2 text-gray-700 dark:text-zinc-300">{renderInline(line)}</p>); }

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
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [color, setColor] = useState('alabaster');
  const [tags, setTags] = useState<string[]>([]);
  const [pinned, setPinned] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'idle'>('idle');
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
  const [previewOpen, setPreviewOpen] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const [slashOpen, setSlashOpen] = useState(false);
  const [slashQuery, setSlashQuery] = useState('');
  const [slashIndex, setSlashIndex] = useState(0);
  const [isPublic, setIsPublic] = useState(false);
  const [shareSheetOpen, setShareSheetOpen] = useState(false);
  const [presentUsers, setPresentUsers] = useState<Record<string, any>>({});
  
  const { user } = useAuth();

  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const noteIdRef = useRef<string>(note?.id ?? crypto.randomUUID());
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  // Tracks the last time we sent a save so we can ignore our own realtime echo
  const lastSavedAtRef = useRef<number>(0);

  useEffect(() => {
    if (note) {
      setTitle(note.title);
      setContent(note.content);
      setColor(colorMap[note.color] ? note.color : 'alabaster');
      setTags(note.tags ?? []);
      setPinned(note.pinned ?? false);
      setIsPublic(note.isPublic ?? false);
      noteIdRef.current = note.id;
    } else {
      // Generate a fresh ID immediately so a new note never inherits
      // the previous note's ID (which would cause content to be copied).
      noteIdRef.current = crypto.randomUUID();
      setTitle('');
      setContent('');
      setColor('alabaster');
      setTags([]);
      setPinned(false);
      setIsPublic(false);
    }
    setSaveStatus('idle');
    setSlashOpen(false);
    setPreviewOpen(false);
    setSummaryData(null);
    setSummaryError(null);
  }, [note]);

  // Realtime subscription for the current note
  // Dependency array is ONLY note?.id — we don't want to re-subscribe on every keystroke.
  // We use refs to read the latest state values inside the callback without re-subscribing.
  const contentRef = useRef(content);
  const titleRef = useRef(title);
  const colorRef = useRef(color);
  const isPublicRef = useRef(isPublic);
  const pinnedRef = useRef(pinned);

  useEffect(() => { contentRef.current = content; }, [content]);
  useEffect(() => { titleRef.current = title; }, [title]);
  useEffect(() => { colorRef.current = color; }, [color]);
  useEffect(() => { isPublicRef.current = isPublic; }, [isPublic]);
  useEffect(() => { pinnedRef.current = pinned; }, [pinned]);

  useEffect(() => {
    if (!note?.id) return;

    const channel = supabase
      .channel(`note_changes_${note.id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'notes', filter: `id=eq.${note.id}` },
        (payload) => {
          const newData = payload.new as any;
          if (!newData) return;

          // Ignore our own echoed saves (within a 3-second window)
          const remoteTs = newData.updated_at;
          if (remoteTs && Math.abs(remoteTs - lastSavedAtRef.current) < 3000) return;

          // Only update fields that actually changed vs current local state
          if (newData.content !== contentRef.current) setContent(newData.content ?? '');
          if (newData.title !== titleRef.current) setTitle(newData.title ?? '');
          if (colorMap[newData.color] && newData.color !== colorRef.current) setColor(newData.color);
          if (newData.is_public !== isPublicRef.current) setIsPublic(newData.is_public);
          if (newData.pinned !== pinnedRef.current) setPinned(newData.pinned);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [note?.id]);

  // Broadcast ref so we can send typing events from triggerSave without re-subscribing
  const broadcastChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  // Typing indicators: map of userId -> { email, fullName, avatarUrl, at: timestamp }
  const [typingUsers, setTypingUsers] = useState<Record<string, any>>({});

  // Combined presence + broadcast channel for live collaboration
  useEffect(() => {
    if (!note?.id || !user) return;

    const colabChannel = supabase.channel(`collab_${note.id}`, {
      config: { presence: { key: user.id } },
    });

    broadcastChannelRef.current = colabChannel;

    // Presence: who is viewing/editing right now
    colabChannel.on('presence', { event: 'sync' }, () => {
      const state = colabChannel.presenceState();
      const users: Record<string, any> = {};
      for (const id in state) {
        users[id] = (state[id] as any[])[0];
      }
      setPresentUsers(users);
    });

    // Broadcast: live typing events from other editors
    colabChannel.on('broadcast', { event: 'typing' }, ({ payload }) => {
      if (!payload || payload.userId === user.id) return;
      setTypingUsers((prev) => ({
        ...prev,
        [payload.userId]: { ...payload, at: Date.now() },
      }));
    });

    colabChannel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await colabChannel.track({
          id: user.id,
          email: user.email,
          fullName: user.user_metadata?.full_name,
          avatarUrl: user.user_metadata?.avatar_url,
        });
      }
    });

    // Prune stale typing indicators every 2s
    const pruneInterval = setInterval(() => {
      setTypingUsers((prev) => {
        const now = Date.now();
        const next = { ...prev };
        let changed = false;
        for (const uid in next) {
          if (now - next[uid].at > 3000) { delete next[uid]; changed = true; }
        }
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
    // Broadcast that this user is actively typing
    if (broadcastChannelRef.current && user) {
      broadcastChannelRef.current.send({
        type: 'broadcast',
        event: 'typing',
        payload: {
          userId: user.id,
          email: user.email,
          fullName: user.user_metadata?.full_name,
          avatarUrl: user.user_metadata?.avatar_url,
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
        setSaveStatus('error' as any);
        // Reset to idle after 3s so user can keep typing
        setTimeout(() => setSaveStatus('idle'), 3000);
      }
    }, 650);
  }, [title, content, color, tags, pinned, isPublic, onSave]);

  const handleChange = useCallback((field: 'title' | 'content' | 'color' | 'tags', value: string | string[]) => {
    if (field === 'title') setTitle(value as string);
    if (field === 'content') setContent(value as string);
    if (field === 'color') {
      setColor(value as string);
      setShowColorPicker(false);
    }
    if (field === 'tags') setTags(value as string[]);
    setSaveStatus('saving');
  }, []);

  useEffect(() => {
    if (!title && !content) return;
    triggerSave();
  }, [title, content, color, tags, pinned, isPublic, triggerSave]);

  useEffect(() => () => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
  }, []);

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

  const handleShareToggle = () => {
    if (!note?.id) {
      alert('Please save the note first to share it.');
      return;
    }
    setShareSheetOpen(true);
  };

  const handleGenerateSummary = async () => {
    setShowSummary(true);
    if (isGeneratingSummary) return;

    // Need at least some content to summarise
    if (!content.trim() || wordCount < 10) {
      setSummaryData(null);
      setSummaryError('Write a bit more before generating an insight.');
      return;
    }

    setIsGeneratingSummary(true);
    setSummaryError(null);
    setSummaryData(null);

    const systemPrompt = `You are a note analyst. Analyse the note and return ONLY a valid JSON object — no markdown fences, no prose.

JSON shape:
{
  "summary": string,         // 2-3 sentence plain-English summary of the note
  "themes": string[],        // 2-4 key themes or topics (short noun phrases, ≤4 words each)
  "actions": string[],       // 0-4 concrete action items you can infer from the note (imperative phrases); empty array if none
  "suggestedTags": string[]  // 2-5 short tag words (lowercase, no spaces, no #) relevant to the content
}

Rules:
- summary: be direct and useful, not generic
- themes: extract the actual topics discussed, not meta commentary
- actions: only include if genuinely inferable — leave empty rather than guess
- suggestedTags: suggest tags different from the ones already on the note if possible`;

    try {
      const existingTagsNote = tags.length > 0 ? `\n\nExisting tags: ${tags.join(', ')}` : '';
      const noteText = `Title: ${title || 'Untitled'}\n\n${content}${existingTagsNote}`;

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 1000,
          system: systemPrompt,
          messages: [{ role: 'user', content: noteText }],
        }),
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
    } finally {
      setIsGeneratingSummary(false);
    }
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

  const handleAddSuggestedTag = (tag: string) => {
    if (!tags.includes(tag)) {
      handleChange('tags', [...tags, tag]);
    }
  };

  const addTag = () => {
    const t = tagInput.trim().replace(/^#/, '');
    if (t && !tags.includes(t)) {
      handleChange('tags', [...tags, t]);
    }
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
    if (e.key === 'Tab') {
      e.preventDefault();
      insertText('  ');
      return;
    }

    if (!slashOpen) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSlashIndex((prev) => (prev + 1) % Math.max(filteredCommands.length, 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSlashIndex((prev) => (prev - 1 + Math.max(filteredCommands.length, 1)) % Math.max(filteredCommands.length, 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      executeSlashCommand(filteredCommands[slashIndex]);
    } else if (e.key === 'Escape') {
      setSlashOpen(false);
    } else if (e.key === 'Backspace' && slashQuery === '') {
      setSlashOpen(false);
    }
  };

  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    handleChange('content', val);

    const cursor = e.target.selectionStart;
    const { prefix } = getLinePrefix(val, cursor);

    if (prefix === '/') {
      setSlashOpen(true);
      setSlashQuery('');
      setSlashIndex(0);
      return;
    }

    if (slashOpen) {
      const slashMatch = prefix.match(/\/([^\s/]*)$/);
      if (slashMatch) {
        setSlashQuery(slashMatch[1]);
        setSlashIndex(0);
      } else {
        setSlashOpen(false);
      }
    }
  };

  const wordCount = content.trim() ? content.trim().split(/\s+/).length : 0;
  const charCount = content.length;
  const readTime = estimateReadingTime(wordCount);
  const bgHex = colorMap[color]?.hex ?? colorMap.alabaster.hex;
  const activeCommand = filteredCommands[slashIndex];

  return (
    <div className={`relative flex h-full w-full overflow-hidden ${focusMode ? 'bg-white dark:bg-zinc-950' : ''}`}>
      <motion.div
        layoutId={note ? `note-${note.id}` : 'new-note'}
        className="flex h-full flex-1 flex-col overflow-hidden bg-[var(--note-bg)] transition-colors duration-300 dark:bg-zinc-950"
        style={{ '--note-bg': bgHex } as React.CSSProperties}
      >
        <header
          className={`sticky top-0 z-10 flex min-h-14 items-center gap-2 border-b border-black/5 bg-[color-mix(in_srgb,var(--note-bg)_90%,transparent)] px-4 backdrop-blur-md transition-opacity duration-300 dark:border-white/10 dark:bg-zinc-950/90 ${focusMode ? 'opacity-0 hover:opacity-100' : 'opacity-100'}`}
        >
          <button onClick={onClose} className="rounded-lg p-2 text-gray-500 transition-colors hover:bg-black/5 dark:text-zinc-400 dark:hover:bg-white/10 dark:hover:text-zinc-100" aria-label="Back">
            <ArrowLeft size={17} />
          </button>

          <div className="hidden items-center gap-1 rounded-lg bg-white/55 p-1 shadow-sm ring-1 ring-black/5 dark:bg-zinc-900/80 dark:ring-white/10 md:flex">
            <ToolbarButton label="Heading" onClick={() => insertText('## ', '', 'Heading', true)} icon={<Heading2 size={15} />} />
            <ToolbarButton label="Bold" onClick={() => insertMarkdown('**')} icon={<Bold size={15} />} />
            <ToolbarButton label="Italic" onClick={() => insertMarkdown('*')} icon={<Italic size={15} />} />
            <ToolbarButton label="Strike" onClick={() => insertMarkdown('~~')} icon={<Strikethrough size={15} />} />
            <ToolbarButton label="Code" onClick={() => insertText('`', '`', 'code')} icon={<Code size={15} />} />
            <ToolbarButton label="Quote" onClick={() => insertText('> ', '', 'Quote', true)} icon={<Quote size={15} />} />
            <ToolbarButton label="List" onClick={() => insertText('- ', '', 'List item', true)} icon={<List size={15} />} />
            <ToolbarButton label="Task" onClick={() => insertText('- [ ] ', '', 'Todo', true)} icon={<CheckSquare size={15} />} />
            <ToolbarButton label="Link" onClick={() => insertText('[', '](https://)', 'link')} icon={<Link size={15} />} />
          </div>

          <div className="flex-1" />

          <button
            onClick={() => setPreviewOpen((open) => !open)}
            className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors ${previewOpen ? 'bg-gray-950 text-white dark:bg-zinc-100 dark:text-zinc-950' : 'text-gray-500 hover:bg-black/5 dark:text-zinc-400 dark:hover:bg-white/10 dark:hover:text-zinc-100'}`}
          >
            {previewOpen ? <EyeOff size={14} /> : <Eye size={14} />}
            Preview
          </button>

          <button
            onClick={() => setFocusMode((open) => !open)}
            className={`hidden rounded-lg p-2 transition-colors sm:block ${focusMode ? 'bg-gray-950 text-white dark:bg-zinc-100 dark:text-zinc-950' : 'text-gray-500 hover:bg-black/5 dark:text-zinc-400 dark:hover:bg-white/10 dark:hover:text-zinc-100'}`}
            aria-label="Focus mode"
          >
            <Focus size={15} />
          </button>

          <div className="relative">
            <button onClick={() => setShowColorPicker(!showColorPicker)} className="rounded-lg p-2 text-gray-500 transition-colors hover:bg-black/5 dark:text-zinc-400 dark:hover:bg-white/10 dark:hover:text-zinc-100" aria-label="Background color">
              <Palette size={16} />
            </button>
            <AnimatePresence>
              {showColorPicker && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.96, y: -6 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.96, y: -6 }}
                  transition={{ duration: 0.14 }}
                  className="absolute right-0 top-full z-50 mt-2 w-52 rounded-xl border border-gray-100 bg-white p-2 shadow-2xl dark:border-zinc-800 dark:bg-zinc-900"
                >
                  {Object.entries(colorMap).map(([key, val]) => (
                    <button
                      key={key}
                      onClick={() => handleChange('color', key)}
                      className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-gray-700 transition-colors hover:bg-gray-50 dark:text-zinc-300 dark:hover:bg-zinc-800"
                    >
                      <span className="h-5 w-5 flex-shrink-0 rounded-full border" style={{ backgroundColor: val.hex, borderColor: val.ring }} />
                      <span className="flex-1 text-left">{val.label}</span>
                      {color === key && <Check size={14} className="text-gray-700 dark:text-zinc-200" />}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <button onClick={handlePinToggle} className={`hidden rounded-lg p-2 transition-colors sm:block ${pinned ? 'bg-gray-950 text-white dark:bg-zinc-100 dark:text-zinc-950' : 'text-gray-500 hover:bg-black/5 dark:text-zinc-400 dark:hover:bg-white/10 dark:hover:text-zinc-100'}`} aria-label={pinned ? 'Unpin' : 'Pin'}>
            {pinned ? <Pin size={15} /> : <PinOff size={15} />}
          </button>

          <div className="flex items-center gap-1 mr-2">
            {Object.values(presentUsers).filter((u) => u.id !== user?.id).map((u) => {
              const isTyping = !!typingUsers[u.id];
              // Deterministic avatar color
              const palette = ['bg-rose-400','bg-orange-400','bg-amber-400','bg-emerald-500','bg-teal-500','bg-sky-500','bg-indigo-500','bg-violet-500','bg-pink-500'];
              let h = 0; for (let i = 0; i < (u.id||'').length; i++) h = (h * 31 + (u.id||'').charCodeAt(i)) >>> 0;
              const avatarBg = palette[h % palette.length];
              return (
                <div
                  key={u.id}
                  className="group relative flex h-7 w-7 items-center justify-center rounded-full ring-2 ring-white dark:ring-zinc-900"
                >
                  {u.avatarUrl ? (
                    <img src={u.avatarUrl} alt={u.fullName || u.email} className="h-full w-full rounded-full object-cover" />
                  ) : (
                    <div className={`h-full w-full rounded-full ${avatarBg} flex items-center justify-center`}>
                      <span className="text-[10px] font-bold text-white">{(u.email||'?').charAt(0).toUpperCase()}</span>
                    </div>
                  )}
                  {isTyping && (
                    <span className="absolute -bottom-0.5 -right-0.5 flex h-3 w-3 items-center justify-center rounded-full bg-emerald-500 ring-1 ring-white dark:ring-zinc-900">
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
                    </span>
                  )}
                  <div className="absolute top-full z-50 mt-1.5 hidden whitespace-nowrap rounded-lg bg-gray-900 px-2 py-1.5 text-[10px] text-white shadow-lg group-hover:block dark:bg-zinc-800 pointer-events-none">
                    <p className="font-semibold">{u.fullName || u.email}</p>
                    {isTyping && <p className="text-emerald-400">editing now...</p>}
                  </div>
                </div>
              );
            })}
          </div>

          <button onClick={handleShareToggle} className={`hidden rounded-lg p-2 transition-colors sm:block text-gray-500 hover:bg-black/5 dark:text-zinc-400 dark:hover:bg-white/10 dark:hover:text-zinc-100`} aria-label="Share">
            <Share size={15} />
          </button>

          <button onClick={handleGenerateSummary} className="hidden items-center gap-1.5 rounded-lg bg-white/70 px-3 py-1.5 text-xs font-semibold text-gray-700 shadow-sm ring-1 ring-black/5 transition-colors hover:bg-white dark:bg-zinc-900/80 dark:text-zinc-300 dark:ring-white/10 dark:hover:bg-zinc-800 sm:flex">
            <Sparkles size={14} />
            Insight
          </button>

          <button onClick={handleDelete} className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-500 dark:text-zinc-500 dark:hover:bg-red-500/10 dark:hover:text-red-300" aria-label="Delete note">
            <Trash2 size={16} />
          </button>
        </header>

        <div className="flex min-h-0 flex-1">
          <div className="min-w-0 flex-1 overflow-y-auto px-5 py-8 sm:px-10 md:px-16 lg:px-24">
            <div className="mx-auto flex w-full max-w-3xl flex-col">
              <div className="mb-5 flex flex-wrap items-center gap-2 text-xs font-medium text-gray-500 dark:text-zinc-400">
                <span className="rounded-full bg-white/60 px-2.5 py-1 shadow-sm ring-1 ring-black/5 dark:bg-zinc-900/80 dark:ring-white/10">{readTime} min read</span>
                <span className="rounded-full bg-white/60 px-2.5 py-1 shadow-sm ring-1 ring-black/5 dark:bg-zinc-900/80 dark:ring-white/10">{wordCount} words</span>
                {pinned && <span className="rounded-full bg-gray-950 px-2.5 py-1 text-white dark:bg-zinc-100 dark:text-zinc-950">Pinned</span>}
              </div>

              <input
                type="text"
                value={title}
                onChange={(e) => handleChange('title', e.target.value)}
                placeholder="Untitled"
                className="mb-5 w-full border-none bg-transparent text-4xl font-bold leading-tight tracking-tight text-gray-950 outline-none placeholder:text-gray-300 dark:text-zinc-50 dark:placeholder:text-zinc-700 sm:text-5xl"
              />

              <div className="mb-6 flex flex-wrap items-center gap-1.5">
                {tags.map((tag) => (
                  <span key={tag} className="flex items-center gap-1 rounded-full bg-white/60 px-2.5 py-1 text-xs font-medium text-gray-600 shadow-sm ring-1 ring-black/5 dark:bg-zinc-900/80 dark:text-zinc-300 dark:ring-white/10">
                    #{tag}
                    <button onClick={() => handleChange('tags', tags.filter((t) => t !== tag))} className="rounded-full p-0.5 transition-colors hover:bg-black/5 hover:text-red-500 dark:hover:bg-white/10 dark:hover:text-red-300" aria-label={`Remove ${tag} tag`}>
                      <X size={10} />
                    </button>
                  </span>
                ))}
                <input
                  type="text"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onBlur={() => tagInput.trim() && addTag()}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ',') {
                      e.preventDefault();
                      addTag();
                    }
                  }}
                  placeholder="+ tag"
                  className="w-20 border-none bg-transparent text-xs text-gray-500 outline-none placeholder:text-gray-400 dark:text-zinc-400 dark:placeholder:text-zinc-600"
                />
              </div>

              <div className="relative">
                <textarea
                  ref={textareaRef}
                  value={content}
                  onChange={handleContentChange}
                  onKeyDown={handleKeyDown}
                  placeholder="Start writing... type '/' for commands"
                  className="min-h-[520px] w-full flex-1 resize-none border-none bg-transparent text-[17px] leading-[1.85] text-gray-700 outline-none placeholder:text-gray-300 dark:text-zinc-300 dark:placeholder:text-zinc-700"
                  spellCheck
                />

                <AnimatePresence>
                  {slashOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: 8, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 8, scale: 0.98 }}
                      transition={{ duration: 0.14 }}
                      className="absolute left-0 top-10 z-50 w-[min(26rem,calc(100vw-3rem))] overflow-hidden rounded-xl border border-gray-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-900"
                    >
                      <div className="flex items-center gap-2 border-b border-gray-100 px-3 py-2 dark:border-zinc-800">
                        <AlignLeft size={14} className="text-gray-400 dark:text-zinc-500" />
                        <span className="text-xs font-semibold text-gray-500 dark:text-zinc-400">Type to filter commands</span>
                        <span className="ml-auto rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-semibold text-gray-400 dark:bg-zinc-800 dark:text-zinc-500">Esc</span>
                      </div>

                      {filteredCommands.length === 0 ? (
                        <div className="px-4 py-6 text-center text-sm text-gray-400 dark:text-zinc-500">No command found for &ldquo;{slashQuery}&rdquo;</div>
                      ) : (
                        <div className="max-h-80 overflow-y-auto p-1.5">
                          {Object.entries(groupedCommands).map(([category, commands]) => (
                            <div key={category} className="py-1">
                              <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-zinc-500">{category}</div>
                              {commands.map((cmd) => {
                                const flatIndex = filteredCommands.findIndex((item) => item.id === cmd.id);
                                const active = activeCommand?.id === cmd.id;
                                return (
                                  <button
                                    key={cmd.id}
                                    onClick={() => executeSlashCommand(cmd)}
                                    onMouseEnter={() => setSlashIndex(flatIndex)}
                                    className={`flex w-full items-center gap-3 rounded-lg px-2.5 py-2.5 text-left transition-colors ${active ? 'bg-gray-950 text-white dark:bg-zinc-100 dark:text-zinc-950' : 'text-gray-700 hover:bg-gray-50 dark:text-zinc-300 dark:hover:bg-zinc-800'}`}
                                  >
                                    <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${active ? 'bg-white/15 text-white dark:bg-zinc-950/10 dark:text-zinc-950' : 'bg-gray-100 text-gray-500 dark:bg-zinc-800 dark:text-zinc-400'}`}>
                                      {cmd.icon}
                                    </span>
                                    <span className="min-w-0 flex-1">
                                      <span className="block text-sm font-semibold">{cmd.label}</span>
                                      <span className={`block truncate text-xs ${active ? 'text-white/65 dark:text-zinc-600' : 'text-gray-400 dark:text-zinc-500'}`}>{cmd.description}</span>
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
          </div>

          <AnimatePresence initial={false}>
            {previewOpen && (
              <motion.aside
                initial={{ width: 0, opacity: 0 }}
                animate={{ width: 380, opacity: 1 }}
                exit={{ width: 0, opacity: 0 }}
                transition={{ type: 'spring', damping: 28, stiffness: 240 }}
                className="min-w-0 border-l border-black/5 bg-white/65 backdrop-blur-xl dark:border-white/10 dark:bg-zinc-900/70"
              >
                <div className="flex h-14 items-center gap-2 border-b border-black/5 px-4 text-sm font-semibold text-gray-700 dark:border-white/10 dark:text-zinc-300">
                  <PanelRight size={16} />
                  Preview
                </div>
                <div className="h-[calc(100%-3.5rem)] overflow-y-auto p-6">
                  <div className="prose prose-sm max-w-none dark:prose-invert">{renderPreview(content)}</div>
                </div>
              </motion.aside>
            )}
          </AnimatePresence>
        </div>

        <div className="flex h-10 flex-shrink-0 items-center justify-between border-t border-black/5 px-5 text-[11px] font-medium text-gray-400 dark:border-white/10 dark:text-zinc-500">
          <div className="flex items-center gap-4">
            <span>{charCount} chars</span>
            <span>{content.split('\n').length} lines</span>
          </div>
          <AnimatePresence mode="wait">
            {saveStatus === 'saving' && (
              <motion.span key="saving" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center gap-1.5 text-gray-500 dark:text-zinc-400">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-gray-400 opacity-75 dark:bg-zinc-500" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-gray-400 dark:bg-zinc-500" />
                </span>
                Saving...
              </motion.span>
            )}
            {saveStatus === 'saved' && (
              <motion.span key="saved" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-gray-400 dark:text-zinc-500">
                Saved
              </motion.span>
            )}
          </AnimatePresence>
        </div>
      </motion.div>

      <AnimatePresence>
        {shareSheetOpen && note?.id && onTogglePublicShare && getCollaborators && addCollaborator && removeCollaborator && updateCollaborator && (
          <ShareSheet
            noteId={note.id}
            noteOwnerId={note.userId}
            isPublic={isPublic}
            shareSlug={note.shareSlug}
            onTogglePublicShare={async (id, pub, slug) => {
              await onTogglePublicShare(id, pub);
              // If a slug was generated, persist it via a save
              if (slug && note) {
                await onSave({ ...note, title, content, color, tags, pinned, isPublic: pub, shareSlug: slug, updatedAt: Date.now() });
              }
            }}
            getCollaborators={getCollaborators}
            addCollaborator={addCollaborator}
            removeCollaborator={removeCollaborator}
            updateCollaborator={updateCollaborator}
            onClose={() => setShareSheetOpen(false)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showSummary && (
          <motion.div
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 320, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ type: 'spring', damping: 26, stiffness: 220 }}
            className="hidden h-full flex-shrink-0 flex-col overflow-hidden border-l border-gray-100 bg-white shadow-xl dark:border-zinc-800 dark:bg-zinc-950 md:flex"
          >
            {/* Panel header */}
            <div className="flex h-14 min-w-[320px] items-center justify-between border-b border-gray-100 px-4 dark:border-zinc-800">
              <div className="flex items-center gap-2 text-sm font-semibold text-gray-800 dark:text-zinc-200">
                <Sparkles size={15} className="text-indigo-400" /> Note Insight
              </div>
              <div className="flex items-center gap-1">
                {summaryData && !isGeneratingSummary && (
                  <button
                    onClick={handleGenerateSummary}
                    title="Regenerate"
                    className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 dark:text-zinc-500 dark:hover:bg-zinc-900"
                  >
                    <RefreshCw size={13} />
                  </button>
                )}
                <button onClick={() => setShowSummary(false)} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 dark:text-zinc-500 dark:hover:bg-zinc-900">
                  <X size={15} />
                </button>
              </div>
            </div>

            {/* Panel body */}
            <div className="min-w-[320px] flex-1 overflow-y-auto p-5">

              {/* Stats row — always shown */}
              <div className="mb-5 grid grid-cols-3 gap-2">
                <Stat label="Words" value={wordCount.toString()} />
                <Stat label="Read" value={`${readTime} min`} />
                <Stat label="Lines" value={content.split('\n').filter(l => l.trim()).length.toString()} />
              </div>

              {/* Loading skeleton */}
              {isGeneratingSummary && (
                <div className="space-y-5">
                  <div className="flex items-center gap-2 text-xs font-medium text-indigo-400 dark:text-indigo-500">
                    <Loader2 size={13} className="animate-spin" />
                    Reading your note…
                  </div>
                  <div className="space-y-3">
                    <div className="h-2.5 rounded-full bg-gray-100 dark:bg-zinc-800 animate-pulse" style={{ width: '90%' }} />
                    <div className="h-2.5 rounded-full bg-gray-100 dark:bg-zinc-800 animate-pulse" style={{ width: '78%' }} />
                    <div className="h-2.5 rounded-full bg-gray-100 dark:bg-zinc-800 animate-pulse" style={{ width: '84%' }} />
                  </div>
                  <div className="space-y-2 pt-2">
                    {[60, 45, 70].map((w, i) => (
                      <div key={i} className="h-6 rounded-lg bg-gray-100 dark:bg-zinc-800 animate-pulse" style={{ width: `${w}%` }} />
                    ))}
                  </div>
                </div>
              )}

              {/* Error state */}
              {!isGeneratingSummary && summaryError && (
                <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                  <p className="text-sm text-amber-500 dark:text-amber-400">{summaryError}</p>
                  {wordCount >= 10 && (
                    <button
                      onClick={handleGenerateSummary}
                      className="flex items-center gap-2 rounded-lg bg-indigo-50 px-3 py-2 text-xs font-semibold text-indigo-600 hover:bg-indigo-100 dark:bg-indigo-500/10 dark:text-indigo-400 dark:hover:bg-indigo-500/20"
                    >
                      <Sparkles size={12} /> Try again
                    </button>
                  )}
                </motion.div>
              )}

              {/* Empty / not yet generated */}
              {!isGeneratingSummary && !summaryError && !summaryData && (
                <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col items-center gap-4 pt-4 text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 dark:bg-indigo-500/10">
                    <Sparkles size={22} className="text-indigo-400" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-700 dark:text-zinc-300">AI Note Insight</p>
                    <p className="mt-1 text-xs text-gray-400 dark:text-zinc-500 leading-relaxed">
                      Get a summary, key themes, action items, and tag suggestions for this note.
                    </p>
                  </div>
                  <button
                    onClick={handleGenerateSummary}
                    disabled={wordCount < 10}
                    className="flex items-center gap-2 rounded-xl bg-indigo-500 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-600 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                  >
                    <Sparkles size={13} />
                    {wordCount < 10 ? 'Write more to unlock' : 'Generate Insight'}
                  </button>
                </motion.div>
              )}

              {/* Results */}
              {!isGeneratingSummary && summaryData && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-5"
                >
                  {/* Summary */}
                  <div>
                    <div className="mb-2 flex items-center justify-between">
                      <p className="text-xs font-bold uppercase tracking-widest text-gray-400 dark:text-zinc-500">Summary</p>
                      <button
                        onClick={handleCopySummary}
                        title="Copy summary"
                        className="flex items-center gap-1 rounded-md px-1.5 py-1 text-[11px] font-medium text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-300 transition-colors"
                      >
                        {copiedSummary ? <Check size={11} className="text-emerald-500" /> : <Copy size={11} />}
                        {copiedSummary ? 'Copied' : 'Copy'}
                      </button>
                    </div>
                    <p className="text-sm leading-relaxed text-gray-600 dark:text-zinc-400">
                      {summaryData.summary}
                    </p>
                  </div>

                  {/* Themes */}
                  {summaryData.themes.length > 0 && (
                    <div>
                      <p className="mb-2.5 text-xs font-bold uppercase tracking-widest text-gray-400 dark:text-zinc-500">Key Themes</p>
                      <div className="flex flex-wrap gap-1.5">
                        {summaryData.themes.map((theme) => (
                          <span
                            key={theme}
                            className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400"
                          >
                            {theme}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Action items */}
                  {summaryData.actions.length > 0 && (
                    <div>
                      <p className="mb-2.5 text-xs font-bold uppercase tracking-widest text-gray-400 dark:text-zinc-500">Action Items</p>
                      <ul className="space-y-2">
                        {summaryData.actions.map((action, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm text-gray-600 dark:text-zinc-400">
                            <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-indigo-400 dark:bg-indigo-500" />
                            {action}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Suggested tags */}
                  {summaryData.suggestedTags.length > 0 && (
                    <div>
                      <p className="mb-2.5 text-xs font-bold uppercase tracking-widest text-gray-400 dark:text-zinc-500">Suggested Tags</p>
                      <div className="flex flex-wrap gap-1.5">
                        {summaryData.suggestedTags.map((tag) => {
                          const already = tags.includes(tag);
                          return (
                            <button
                              key={tag}
                              onClick={() => !already && handleAddSuggestedTag(tag)}
                              disabled={already}
                              className={`flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition-all ${
                                already
                                  ? 'border-emerald-200 bg-emerald-50 text-emerald-600 dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-400 cursor-default'
                                  : 'border-gray-200 bg-white text-gray-500 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:border-indigo-700 dark:hover:bg-indigo-950/40 dark:hover:text-indigo-400'
                              }`}
                            >
                              {already ? <Check size={10} /> : <Tag size={10} />}
                              #{tag}
                            </button>
                          );
                        })}
                      </div>
                      <p className="mt-2 text-[11px] text-gray-400 dark:text-zinc-600">Click a tag to add it to your note</p>
                    </div>
                  )}
                </motion.div>
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
    <button onClick={onClick} className="rounded-md p-1.5 text-gray-500 transition-colors hover:bg-white hover:text-gray-950 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100" title={label} aria-label={label}>
      {icon}
    </button>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-gray-50 p-3 ring-1 ring-gray-100 dark:bg-zinc-900 dark:ring-zinc-800">
      <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-zinc-500">{label}</p>
      <p className="mt-1 text-lg font-bold text-gray-900 dark:text-zinc-100">{value}</p>
    </div>
  );
}
