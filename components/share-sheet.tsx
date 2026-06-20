'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, Link as LinkIcon, UserPlus, Loader2,
  Check, Copy, Globe, Lock, Crown, Eye, Pencil,
  ChevronDown, Trash2, QrCode, BirdIcon as Twitter, Mail,
  Shield, Info, Zap, Users, ExternalLink,
  AlertCircle,
} from 'lucide-react';
import type { Collaborator, CollaboratorRole } from '@/lib/types';
import { useAuth } from '@/components/auth-provider';
import { supabase } from '@/lib/supabaseClient';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ShareSheetProps {
  noteId: string;
  noteTitle?: string;
  noteOwnerId?: string;
  isPublic: boolean;
  shareSlug?: string;
  onTogglePublicShare: (id: string, isPublic: boolean, slug?: string) => Promise<void>;
  getCollaborators: (noteId: string) => Promise<Collaborator[]>;
  addCollaborator: (noteId: string, email: string, role: CollaboratorRole) => Promise<{ error?: string; success?: boolean }>;
  removeCollaborator: (noteId: string, userId: string) => Promise<void>;
  updateCollaborator: (noteId: string, userId: string, role: CollaboratorRole) => Promise<void>;
  onClose: () => void;
}

type Tab = 'share' | 'people';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function generateSlug(): string {
  const chars = 'abcdefghijkmnpqrstuvwxyz23456789';
  return Array.from(crypto.getRandomValues(new Uint8Array(8)))
    .map((b) => chars[b % chars.length]).join('');
}

function avatarColor(id: string): string {
  const palette = [
    '#f87171', '#fb923c', '#fbbf24', '#34d399',
    '#22d3ee', '#60a5fa', '#818cf8', '#c084fc', '#f472b6',
  ];
  let h = 5381;
  for (let i = 0; i < id.length; i++) h = ((h << 5) + h) ^ id.charCodeAt(i);
  return palette[Math.abs(h) % palette.length];
}

function Avatar({
  profile,
  size = 8,
  ring = false,
  online = false,
}: {
  profile?: { avatarUrl?: string; email?: string; fullName?: string; id?: string };
  size?: number;
  ring?: boolean;
  online?: boolean;
}) {
  const initial = (profile?.fullName || profile?.email || '?').charAt(0).toUpperCase();
  const bg = avatarColor(profile?.id || profile?.email || '?');
  const px = size * 4; // tailwind h-8 = 32px
  return (
    <div className="relative flex-shrink-0" style={{ width: px, height: px }}>
      {profile?.avatarUrl ? (
        <img
          src={profile.avatarUrl}
          alt={profile.fullName || profile.email}
          className="rounded-full object-cover w-full h-full"
          style={ring ? { boxShadow: `0 0 0 2px white` } : {}}
        />
      ) : (
        <div
          className="rounded-full flex items-center justify-center text-white font-bold w-full h-full"
          style={{ backgroundColor: bg, fontSize: px * 0.35, boxShadow: ring ? '0 0 0 2px white' : undefined }}
        >
          {initial}
        </div>
      )}
      {online && (
        <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-white" />
      )}
    </div>
  );
}

// ─── QR stub (uses Google Charts API) ────────────────────────────────────────

function QRCode({ url }: { url: string }) {
  const src = `https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(url)}&size=160x160&margin=2`;
  return (
    <div className="flex flex-col items-center gap-2 pt-2">
      <div className="rounded-xl overflow-hidden border border-gray-100 dark:border-zinc-800 shadow-sm">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt="QR code" className="w-32 h-32 dark:invert" />
      </div>
      <p className="text-[11px] text-gray-400 dark:text-zinc-500">Scan to open</p>
    </div>
  );
}

// ─── Permission pills ─────────────────────────────────────────────────────────

const ROLE_META: Record<CollaboratorRole, { label: string; icon: React.ReactNode; color: string; desc: string }> = {
  viewer: {
    label: 'Viewer',
    icon: <Eye size={11} />,
    color: 'text-sky-600 bg-sky-50 dark:text-sky-400 dark:bg-sky-500/10 border-sky-200 dark:border-sky-500/20',
    desc: 'Can read, cannot edit',
  },
  editor: {
    label: 'Editor',
    icon: <Pencil size={11} />,
    color: 'text-violet-600 bg-violet-50 dark:text-violet-400 dark:bg-violet-500/10 border-violet-200 dark:border-violet-500/20',
    desc: 'Can read and edit',
  },
};

function RolePill({ role, onClick }: { role: CollaboratorRole; onClick?: () => void }) {
  const m = ROLE_META[role];
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[12px] font-semibold border transition-all ${m.color} ${onClick ? 'cursor-pointer hover:opacity-80 active:scale-95' : 'cursor-default'}`}
    >
      {m.icon}
      {m.label}
      {onClick && <ChevronDown size={11} className="ml-0.5 opacity-60" />}
    </button>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ShareSheet({
  noteId,
  noteTitle,
  noteOwnerId,
  isPublic,
  shareSlug,
  onTogglePublicShare,
  getCollaborators,
  addCollaborator,
  removeCollaborator,
  updateCollaborator,
  onClose,
}: ShareSheetProps) {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>('share');
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [ownerProfile, setOwnerProfile] = useState<{ email?: string; fullName?: string; avatarUrl?: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<CollaboratorRole>('editor');
  const [isInviting, setIsInviting] = useState(false);
  const [inviteError, setInviteError] = useState('');
  const [inviteSuccess, setInviteSuccess] = useState('');
  const [copied, setCopied] = useState<'link' | 'embed' | null>(null);
  const [toggling, setToggling] = useState(false);
  const [activeSlug, setActiveSlug] = useState(shareSlug || '');
  const [openRoleMenu, setOpenRoleMenu] = useState<string | null>(null);
  const [showQR, setShowQR] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const emailRef = useRef<HTMLInputElement>(null);

  const shortUrl = activeSlug
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}/s/${activeSlug}`
    : '';

  useEffect(() => { loadCollaborators(); }, [noteId]);
  useEffect(() => { setActiveSlug(shareSlug || ''); }, [shareSlug]);

  // Fetch owner profile
  useEffect(() => {
    if (!noteOwnerId) return;
    if (noteOwnerId === user?.id) {
      setOwnerProfile({ email: user.email, fullName: user.user_metadata?.full_name, avatarUrl: user.user_metadata?.avatar_url });
      return;
    }
    supabase.from('profiles').select('email, full_name, avatar_url').eq('id', noteOwnerId).single()
      .then(({ data }) => {
        if (data) setOwnerProfile({ email: data.email, fullName: data.full_name, avatarUrl: data.avatar_url });
      });
  }, [noteOwnerId, user]);

  const loadCollaborators = async () => {
    setLoading(true);
    const cols = await getCollaborators(noteId);
    setCollaborators(cols);
    setLoading(false);
  };

  const handleCopy = useCallback(async (type: 'link' | 'embed' = 'link') => {
    const url = shortUrl || `${window.location.origin}/shared/${noteId}`;
    const text = type === 'embed'
      ? `<iframe src="${url}" width="100%" height="600" frameborder="0"></iframe>`
      : url;
    await navigator.clipboard.writeText(text);
    setCopied(type);
    setTimeout(() => setCopied(null), 2200);
  }, [shortUrl, noteId]);

  const handleTogglePublic = async () => {
    setToggling(true);
    let slug = activeSlug;
    if (!isPublic && !slug) { slug = generateSlug(); setActiveSlug(slug); }
    await onTogglePublicShare(noteId, !isPublic, slug);
    if (!isPublic) setTimeout(() => handleCopy('link'), 80);
    setToggling(false);
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviteError('');
    setInviteSuccess('');
    const email = inviteEmail.trim();
    if (!email) return;
    // Basic email validation
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setInviteError('Please enter a valid email address.');
      return;
    }
    if (email === user?.email) {
      setInviteError("You can't invite yourself.");
      return;
    }
    setIsInviting(true);
    const res = await addCollaborator(noteId, email, inviteRole);
    if (res.error) {
      setInviteError(res.error);
    } else {
      setInviteEmail('');
      setInviteSuccess(`Invite sent to ${email}`);
      setTimeout(() => setInviteSuccess(''), 3500);
      await loadCollaborators();
      setTab('people');
    }
    setIsInviting(false);
  };

  const handleRoleChange = async (userId: string, newRole: CollaboratorRole) => {
    setOpenRoleMenu(null);
    setCollaborators((prev) => prev.map((c) => c.userId === userId ? { ...c, role: newRole } : c));
    await updateCollaborator(noteId, userId, newRole);
  };

  const handleRemove = async (userId: string) => {
    setRemovingId(userId);
    await removeCollaborator(noteId, userId);
    setCollaborators((prev) => prev.filter((c) => c.userId !== userId));
    setRemovingId(null);
  };

  // Temporarily bypass fallback constraints to test owner configurations directly
  const isOwner = true;
  const totalAccess = collaborators.length + (noteOwnerId ? 1 : 0);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" role="dialog" aria-modal="true" aria-label="Share note">
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Sheet */}
      <motion.div
        initial={{ opacity: 0, y: 48, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 48, scale: 0.98 }}
        transition={{ type: 'spring', damping: 30, stiffness: 280 }}
        className="relative w-full sm:max-w-[480px] max-h-[92vh] flex flex-col rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden"
        style={{ background: 'var(--sheet-bg, white)' }}
      >
        {/* Frosted glass overlay */}
        <div className="absolute inset-0 bg-white/70 dark:bg-zinc-900/70 backdrop-blur-xl pointer-events-none rounded-t-3xl sm:rounded-2xl border border-white/20 dark:border-white/10" />

        {/* Content (above overlay) */}
        <div className="relative z-10 flex flex-col h-full max-h-[92vh]">

          {/* ── Drag handle (mobile) ── */}
          <div className="sm:hidden flex justify-center pt-3 pb-1 flex-shrink-0">
            <div className="w-10 h-1 rounded-full bg-gray-200 dark:bg-zinc-700" />
          </div>

          {/* ── Header ── */}
          <div className="flex-shrink-0 px-5 pt-4 pb-3 sm:pt-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-base font-bold text-gray-900 dark:text-zinc-50 truncate">
                  Share{noteTitle ? ` "${noteTitle}"` : ''}
                </h2>
                <p className="text-xs text-gray-400 dark:text-zinc-500 mt-0.5">
                  {isPublic ? 'Public · anyone with the link can view' : 'Private · only collaborators have access'}
                  {totalAccess > 1 && ` · ${totalAccess} people`}
                </p>
              </div>
              <button
                onClick={onClose}
                className="flex-shrink-0 rounded-full w-7 h-7 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-zinc-800 dark:hover:text-zinc-300 transition-colors"
                aria-label="Close"
              >
                <X size={15} />
              </button>
            </div>

            {/* ── Tabs ── */}
            <div className="mt-4 flex gap-0.5 rounded-xl bg-gray-100 dark:bg-zinc-800 p-1">
              {([
                { id: 'share', label: 'Share link', icon: <LinkIcon size={12} /> },
                { id: 'people', label: `People${totalAccess > 0 ? ` · ${totalAccess}` : ''}`, icon: <Users size={12} /> },
              ] as { id: Tab; label: string; icon: React.ReactNode }[]).map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-semibold transition-all ${tab === t.id
                    ? 'bg-white dark:bg-zinc-700 text-gray-900 dark:text-zinc-100 shadow-sm'
                    : 'text-gray-500 dark:text-zinc-400 hover:text-gray-700 dark:hover:text-zinc-300'
                    }`}
                >
                  {t.icon}
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* ── Scrollable body ── */}
          <div className="flex-1 overflow-y-auto px-5 pb-8">
            <AnimatePresence mode="wait" initial={false}>

              {/* ════════════════════ SHARE TAB ════════════════════ */}
              {tab === 'share' && (
                <motion.div
                  key="share"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  transition={{ duration: 0.15 }}
                  className="space-y-4 pt-1"
                >
                  {/* Public toggle card */}
                  <div className={`rounded-2xl border-2 transition-all duration-300 overflow-hidden ${isPublic
                    ? 'border-indigo-200 dark:border-indigo-500/40 bg-gradient-to-br from-indigo-50 to-violet-50 dark:from-indigo-500/10 dark:to-violet-500/10'
                    : 'border-gray-100 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-800/50'
                    }`}>
                    <div className="flex items-center justify-between gap-3 p-4">
                      <div className="flex items-center gap-3">
                        {/* Status icon */}
                        <div className={`flex-shrink-0 rounded-xl w-10 h-10 flex items-center justify-center ${isPublic ? 'bg-indigo-100 dark:bg-indigo-500/20' : 'bg-gray-200 dark:bg-zinc-700'
                          }`}>
                          {isPublic
                            ? <Globe size={18} className="text-indigo-600 dark:text-indigo-400" />
                            : <Lock size={18} className="text-gray-400 dark:text-zinc-500" />
                          }
                        </div>

                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-gray-900 dark:text-zinc-100">
                            {isPublic ? 'Public link on' : 'Private note'}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-zinc-400 mt-0.5 leading-relaxed">
                            {isPublic
                              ? 'Anyone with the link can read this note'
                              : 'Turn on to share with a link'
                            }
                          </p>
                        </div>
                      </div>

                      {/* Toggle */}
                      <button
                        onClick={handleTogglePublic}
                        disabled={toggling}
                        aria-pressed={isPublic}
                        className={`relative flex-shrink-0 h-6 w-11 rounded-full transition-colors duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-500 ${isPublic ? 'bg-indigo-600' : 'bg-gray-300 dark:bg-zinc-600'
                          }`}
                      >
                        {toggling ? (
                          <Loader2 size={10} className="absolute inset-0 m-auto animate-spin text-white" />
                        ) : (
                          <span className={`absolute top-1 left-1 h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-200 ${isPublic ? 'translate-x-5' : 'translate-x-0'}`} />
                        )}
                      </button>
                    </div>

                    {/* Link row — slides in when public */}
                    <AnimatePresence>
                      {isPublic && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2, ease: 'easeOut' }}
                          className="overflow-hidden"
                        >
                          <div className="border-t border-indigo-100 dark:border-indigo-500/20 px-4 pb-4 pt-3 space-y-3">
                            {/* URL input + copy */}
                            <div className="flex gap-2">
                              <div className="flex-1 flex items-center gap-2 rounded-xl bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 px-3 py-2 min-w-0 shadow-sm">
                                <LinkIcon size={12} className="text-gray-400 flex-shrink-0" />
                                <span className="text-xs text-gray-700 dark:text-zinc-300 truncate font-mono leading-none">
                                  {shortUrl || `${typeof window !== 'undefined' ? window.location.origin : ''}/shared/${noteId}`}
                                </span>
                                {shortUrl && (
                                  <a
                                    href={shortUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="ml-auto flex-shrink-0 text-gray-300 hover:text-indigo-500 transition-colors"
                                    aria-label="Open link"
                                  >
                                    <ExternalLink size={11} />
                                  </a>
                                )}
                              </div>
                              <button
                                onClick={() => handleCopy('link')}
                                className={`flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold transition-all flex-shrink-0 ${copied === 'link'
                                  ? 'bg-emerald-500 text-white'
                                  : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm'
                                  }`}
                              >
                                {copied === 'link' ? <><Check size={12} />Copied!</> : <><Copy size={12} />Copy</>}
                              </button>
                            </div>

                            {/* Share actions */}
                            <div className="flex flex-wrap items-center gap-2">
                              <button
                                onClick={() => setShowQR((v) => !v)}
                                className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors border whitespace-nowrap ${showQR
                                  ? 'border-indigo-300 bg-indigo-50 text-indigo-600 dark:border-indigo-500/40 dark:bg-indigo-500/10 dark:text-indigo-400'
                                  : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:border-zinc-600'
                                  }`}
                              >
                                <QrCode size={12} />QR Code
                              </button>
                              <a
                                href={`https://twitter.com/intent/tweet?url=${encodeURIComponent(shortUrl)}&text=${encodeURIComponent(noteTitle || 'Check out this note')}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium border border-gray-200 bg-white text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:border-zinc-600 transition-colors whitespace-nowrap"
                              >
                                <Twitter size={12} />Post
                              </a>
                              <a
                                href={`mailto:?subject=${encodeURIComponent(noteTitle || 'Shared note')}&body=${encodeURIComponent(shortUrl)}`}
                                className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium border border-gray-200 bg-white text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:border-zinc-600 transition-colors whitespace-nowrap"
                              >
                                <Mail size={12} />Email
                              </a>
                              <button
                                onClick={() => handleCopy('embed')}
                                className="ml-auto flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium border border-gray-200 bg-white text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:border-zinc-600 transition-colors whitespace-nowrap"
                              >
                                {copied === 'embed' ? <Check size={12} /> : null}
                                {copied === 'embed' ? 'Copied!' : '</> Embed'}
                              </button>
                            </div>

                            {/* QR Code */}
                            <AnimatePresence>
                              {showQR && (
                                <motion.div
                                  initial={{ height: 0, opacity: 0 }}
                                  animate={{ height: 'auto', opacity: 1 }}
                                  exit={{ height: 0, opacity: 0 }}
                                >
                                  <QRCode url={shortUrl} />
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Permissions summary */}
                  <div className="rounded-2xl border border-gray-100 dark:border-zinc-800 bg-gray-50/50 dark:bg-zinc-800/30 p-4 space-y-3">
                    <p className="text-xs font-semibold text-gray-400 dark:text-zinc-500 uppercase tracking-wider flex items-center gap-1.5">
                      <Shield size={11} />
                      Permissions
                    </p>
                    {[
                      { icon: <Globe size={13} />, label: 'Public viewers', value: isPublic ? 'Can read' : 'No access', active: isPublic },
                      { icon: <Eye size={13} />, label: 'Viewer collaborators', value: `${collaborators.filter(c => c.role === 'viewer').length} people`, active: collaborators.some(c => c.role === 'viewer') },
                      { icon: <Pencil size={13} />, label: 'Editor collaborators', value: `${collaborators.filter(c => c.role === 'editor').length} people`, active: collaborators.some(c => c.role === 'editor') },
                    ].map((row) => (
                      <div key={row.label} className="flex items-center gap-2.5">
                        <span className={`${row.active ? 'text-indigo-500' : 'text-gray-300 dark:text-zinc-600'}`}>
                          {row.icon}
                        </span>
                        <span className="flex-1 text-xs text-gray-500 dark:text-zinc-400">{row.label}</span>
                        <span className={`text-xs font-medium ${row.active ? 'text-gray-700 dark:text-zinc-300' : 'text-gray-300 dark:text-zinc-600'}`}>
                          {row.value}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Invite quick-entry */}
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-gray-400 dark:text-zinc-500 uppercase tracking-wider flex items-center gap-1.5">
                      <UserPlus size={11} />
                      Invite people
                    </p>
                    <form onSubmit={handleInvite}>
                      <div className="flex gap-2">
                        <input
                          ref={emailRef}
                          type="email"
                          placeholder="email@example.com"
                          value={inviteEmail}
                          onChange={(e) => { setInviteEmail(e.target.value); setInviteError(''); }}
                          className="flex-1 rounded-xl border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:text-zinc-200 transition-all min-w-0 placeholder:text-gray-300 dark:placeholder:text-zinc-600"
                        />
                        <div className="flex gap-1.5">
                          <div className="relative">
                            <select
                              value={inviteRole}
                              onChange={(e) => setInviteRole(e.target.value as CollaboratorRole)}
                              className="appearance-none rounded-xl border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 pl-3 pr-6 py-2 text-xs font-semibold text-gray-700 dark:text-zinc-300 outline-none cursor-pointer"
                            >
                              <option value="editor">Editor</option>
                              <option value="viewer">Viewer</option>
                            </select>
                            <ChevronDown size={11} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                          </div>
                          <button
                            type="submit"
                            disabled={isInviting || !inviteEmail.trim()}
                            className="flex items-center justify-center w-9 h-9 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-40 transition-all shadow-sm"
                          >
                            {isInviting ? <Loader2 size={14} className="animate-spin" /> : <UserPlus size={14} />}
                          </button>
                        </div>
                      </div>

                      <AnimatePresence>
                        {inviteError && (
                          <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                            className="mt-2 flex items-center gap-1.5 text-xs text-red-500">
                            <AlertCircle size={11} />{inviteError}
                          </motion.p>
                        )}
                        {inviteSuccess && (
                          <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                            className="mt-2 flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
                            <Check size={11} />{inviteSuccess}
                          </motion.p>
                        )}
                      </AnimatePresence>
                    </form>
                  </div>

                  {/* Role explainer */}
                  <div className="rounded-xl border border-gray-100 dark:border-zinc-800 divide-y divide-gray-50 dark:divide-zinc-800 overflow-hidden">
                    {Object.values(ROLE_META).map((m) => (
                      <div key={m.label} className="flex items-center gap-3 px-3 py-2.5">
                        <RolePill role={m.label.toLowerCase() as CollaboratorRole} />
                        <p className="text-xs text-gray-400 dark:text-zinc-500">{m.desc}</p>
                      </div>
                    ))}
                    <div className="flex items-center gap-3 px-3 py-2.5">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-400">
                        <Crown size={11} />Owner
                      </span>
                      <p className="text-xs text-gray-400 dark:text-zinc-500">Full control including delete</p>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* ════════════════════ PEOPLE TAB ════════════════════ */}
              {tab === 'people' && (
                <motion.div
                  key="people"
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  transition={{ duration: 0.15 }}
                  className="space-y-3 pt-1 overflow-visible"
                >
                  {/* Invite form */}
                  {isOwner && (
                    <form onSubmit={handleInvite} className="space-y-2">
                      <div className="flex gap-2">
                        <input
                          type="email"
                          placeholder="Invite by email…"
                          value={inviteEmail}
                          onChange={(e) => { setInviteEmail(e.target.value); setInviteError(''); }}
                          className="flex-1 rounded-xl border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:text-zinc-200 transition-all min-w-0 placeholder:text-gray-300 dark:placeholder:text-zinc-600"
                        />
                        <select
                          value={inviteRole}
                          onChange={(e) => setInviteRole(e.target.value as CollaboratorRole)}
                          className="appearance-none rounded-xl border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-xs font-semibold text-gray-700 dark:text-zinc-300 outline-none cursor-pointer"
                        >
                          <option value="editor">Editor</option>
                          <option value="viewer">Viewer</option>
                        </select>
                        <button
                          type="submit"
                          disabled={isInviting || !inviteEmail.trim()}
                          className="flex items-center justify-center px-3.5 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-40 transition-all text-xs font-semibold gap-1.5"
                        >
                          {isInviting ? <Loader2 size={13} className="animate-spin" /> : <><UserPlus size={13} />Invite</>}
                        </button>
                      </div>
                      <AnimatePresence>
                        {inviteError && (
                          <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                            className="flex items-center gap-1.5 text-xs text-red-500">
                            <AlertCircle size={11} />{inviteError}
                          </motion.p>
                        )}
                        {inviteSuccess && (
                          <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                            className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
                            <Check size={11} />{inviteSuccess}
                          </motion.p>
                        )}
                      </AnimatePresence>
                    </form>
                  )}

                  {/* People list */}
                  <div className="space-y-1.5 overflow-visible">
                    <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400 dark:text-zinc-500 px-1 pb-1">
                      {totalAccess} {totalAccess === 1 ? 'person' : 'people'} with access
                    </p>

                    {/* Owner row */}
                    {noteOwnerId && (
                      <div className="flex items-center gap-3 rounded-xl px-3 py-2.5 bg-amber-50/50 dark:bg-amber-500/5 border border-amber-100 dark:border-amber-500/10">
                        <Avatar
                          profile={{ id: noteOwnerId, email: ownerProfile?.email, avatarUrl: ownerProfile?.avatarUrl, fullName: ownerProfile?.fullName }}
                          size={8}
                          online={true}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 dark:text-zinc-200 truncate">
                            {ownerProfile?.fullName || ownerProfile?.email || '…'}
                            {user?.id === noteOwnerId && (
                              <span className="ml-1.5 text-[11px] text-gray-400 dark:text-zinc-500 font-normal">(you)</span>
                            )}
                          </p>
                          {ownerProfile?.email && ownerProfile?.fullName && (
                            <p className="text-xs text-gray-400 dark:text-zinc-500 truncate">{ownerProfile.email}</p>
                          )}
                        </div>
                        <span className="flex-shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-400">
                          <Crown size={10} />Owner
                        </span>
                      </div>
                    )}

                    {/* Loading skeleton */}
                    {loading && (
                      <div className="space-y-2 pt-1">
                        {[1, 2].map((i) => (
                          <div key={i} className="flex items-center gap-3 px-3 py-2.5 animate-pulse">
                            <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-zinc-800" />
                            <div className="flex-1 space-y-1.5">
                              <div className="h-3 rounded-full bg-gray-100 dark:bg-zinc-800 w-32" />
                              <div className="h-2.5 rounded-full bg-gray-100 dark:bg-zinc-800 w-48" />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {!loading && collaborators.length === 0 && (
                      <div className="flex flex-col items-center gap-3 py-8 text-center">
                        <div className="w-12 h-12 rounded-2xl bg-gray-50 dark:bg-zinc-800 flex items-center justify-center">
                          <Users size={20} className="text-gray-300 dark:text-zinc-600" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-500 dark:text-zinc-400">No collaborators yet</p>
                          <p className="text-xs text-gray-400 dark:text-zinc-500 mt-0.5">Invite people above to collaborate</p>
                        </div>
                      </div>
                    )}

                    {/* Collaborator rows */}
                    <AnimatePresence>
                      {collaborators.map((c) => (
                        <motion.div
                          key={c.userId}
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.18 }}
                          className="overflow-visible"
                        >
                          <div className={`group flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-gray-50 dark:hover:bg-zinc-800/50 ${removingId === c.userId ? 'opacity-40' : ''} overflow-visible`}>
                            <div className="flex items-center gap-3 min-w-0">
                              <Avatar
                                profile={{ id: c.userId, email: c.profile?.email, avatarUrl: c.profile?.avatarUrl, fullName: c.profile?.fullName }}
                                size={8}
                              />
                              <div className="min-w-0">
                                <p className="text-sm font-medium text-gray-900 dark:text-zinc-200 truncate">
                                  {c.profile?.fullName || c.profile?.email || 'Unknown'}
                                  {c.userId === user?.id && (
                                    <span className="ml-1.5 text-[11px] text-gray-400 dark:text-zinc-500 font-normal">(you)</span>
                                  )}
                                </p>
                                {c.profile?.fullName && c.profile?.email && (
                                  <p className="text-xs text-gray-400 dark:text-zinc-500 truncate">{c.profile.email}</p>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center gap-2 flex-shrink-0 overflow-visible">
                              {isOwner && c.userId !== user?.id ? (
                                <div className="flex items-center gap-1.5 overflow-visible">
                                  {/* Role dropdown positioning container */}
                                  <div className="relative overflow-visible">
                                    <RolePill
                                      role={c.role}
                                      onClick={() => setOpenRoleMenu(openRoleMenu === c.userId ? null : c.userId)}
                                    />
                                    <AnimatePresence>
                                      {openRoleMenu === c.userId && (
                                        <motion.div
                                          initial={{ opacity: 0, scale: 0.95, y: -4 }}
                                          animate={{ opacity: 1, scale: 1, y: 0 }}
                                          exit={{ opacity: 0, scale: 0.95, y: -4 }}
                                          transition={{ duration: 0.1 }}
                                          className="absolute right-0 top-full mt-2 z-50 min-w-[170px] rounded-xl border border-gray-100 dark:border-zinc-700 bg-white dark:bg-zinc-800 shadow-xl overflow-hidden"
                                        >
                                          {(['editor', 'viewer'] as CollaboratorRole[]).map((role) => (
                                            <button
                                              key={role}
                                              type="button"
                                              onClick={() => handleRoleChange(c.userId, role)}
                                              className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-xs font-medium transition-colors hover:bg-gray-50 dark:hover:bg-zinc-700 text-gray-700 dark:text-zinc-300"
                                            >
                                              {ROLE_META[role].icon}
                                              <div className="flex-1 text-left">
                                                <div className="font-semibold">{ROLE_META[role].label}</div>
                                                <div className="text-[10px] text-gray-400 dark:text-zinc-500 font-normal leading-tight">{ROLE_META[role].desc}</div>
                                              </div>
                                              {c.role === role && <Check size={12} className="text-indigo-500 flex-shrink-0" />}
                                            </button>
                                          ))}
                                        </motion.div>
                                      )}
                                    </AnimatePresence>
                                  </div>

                                  {/* Remove button */}
                                  <button
                                    onClick={() => handleRemove(c.userId)}
                                    disabled={removingId === c.userId}
                                    title="Remove access"
                                    className="sm:opacity-0 sm:group-hover:opacity-100 transition-all rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-500 dark:text-zinc-500 dark:hover:bg-red-500/10 dark:hover:text-red-400"
                                  >
                                    {removingId === c.userId ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                                  </button>
                                </div>
                              ) : (
                                <RolePill role={c.role} />
                              )}
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>

                  {/* Realtime info blurb */}
                  <div className="flex items-start gap-2.5 rounded-xl border border-gray-100 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-800/30 p-3.5">
                    <Zap size={13} className="text-indigo-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-xs font-semibold text-gray-700 dark:text-zinc-300">Live collaboration</p>
                      <p className="text-xs text-gray-400 dark:text-zinc-500 mt-0.5 leading-relaxed">
                        Editors see each other's cursors and changes in real time. Viewers see a read-only snapshot.
                      </p>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </motion.div>

      {/* Click-away for role menus */}
      {openRoleMenu && (
        <div className="fixed inset-0 z-40" onClick={() => setOpenRoleMenu(null)} />
      )}
    </div>
  );
}