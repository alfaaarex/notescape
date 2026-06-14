'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, Link as LinkIcon, UserPlus, Loader2, UserCircle2,
  Check, Copy, Globe, Lock, Crown, Eye, Pencil, ChevronDown,
} from 'lucide-react';
import type { Collaborator, CollaboratorRole } from '@/lib/types';
import { useAuth } from '@/components/auth-provider';
import { supabase } from '@/lib/supabaseClient';

interface ShareSheetProps {
  noteId: string;
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

/** Generate a 7-char alphanumeric slug */
function generateSlug(): string {
  const chars = 'abcdefghijkmnpqrstuvwxyz23456789';
  return Array.from(crypto.getRandomValues(new Uint8Array(7)))
    .map((b) => chars[b % chars.length])
    .join('');
}

const ROLE_ICONS: Record<CollaboratorRole, React.ReactNode> = {
  viewer: <Eye size={12} />,
  editor: <Pencil size={12} />,
};

const ROLE_COLORS: Record<CollaboratorRole, string> = {
  viewer: 'text-sky-600 bg-sky-50 dark:text-sky-400 dark:bg-sky-500/10',
  editor: 'text-violet-600 bg-violet-50 dark:text-violet-400 dark:bg-violet-500/10',
};

/** Deterministic avatar color from user id */
function avatarColor(id: string) {
  const palette = [
    'bg-rose-400', 'bg-orange-400', 'bg-amber-400',
    'bg-emerald-500', 'bg-teal-500', 'bg-sky-500',
    'bg-indigo-500', 'bg-violet-500', 'bg-pink-500',
  ];
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return palette[h % palette.length];
}

function Avatar({ profile, size = 8 }: { profile?: { avatarUrl?: string; email?: string; fullName?: string; id?: string }; size?: number }) {
  const initial = (profile?.fullName || profile?.email || '?').charAt(0).toUpperCase();
  const color = avatarColor(profile?.id || profile?.email || '?');
  return profile?.avatarUrl ? (
    <img src={profile.avatarUrl} alt={profile.fullName || profile.email} className={`h-${size} w-${size} rounded-full object-cover`} />
  ) : (
    <div className={`h-${size} w-${size} rounded-full ${color} flex items-center justify-center text-white font-bold text-xs`}>
      {initial}
    </div>
  );
}

export function ShareSheet({
  noteId,
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
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [ownerProfile, setOwnerProfile] = useState<{ email?: string; fullName?: string; avatarUrl?: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<CollaboratorRole>('editor');
  const [isInviting, setIsInviting] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [activeSlug, setActiveSlug] = useState(shareSlug || '');
  const [openRoleMenu, setOpenRoleMenu] = useState<string | null>(null);

  const shortUrl = activeSlug ? `${window.location.origin}/s/${activeSlug}` : '';

  useEffect(() => { loadCollaborators(); }, [noteId]);
  useEffect(() => { setActiveSlug(shareSlug || ''); }, [shareSlug]);

  // Fetch owner profile (may differ from current user if viewer/editor opens the sheet)
  useEffect(() => {
    if (!noteOwnerId) return;
    if (noteOwnerId === user?.id) {
      setOwnerProfile({
        email: user.email,
        fullName: user.user_metadata?.full_name,
        avatarUrl: user.user_metadata?.avatar_url,
      });
      return;
    }
    supabase
      .from('profiles')
      .select('email, full_name, avatar_url')
      .eq('id', noteOwnerId)
      .single()
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

  const handleCopy = useCallback(async () => {
    const url = shortUrl || `${window.location.origin}/shared/${noteId}`;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [shortUrl, noteId]);

  const handleTogglePublic = async () => {
    setToggling(true);
    let slug = activeSlug;
    if (!isPublic && !slug) {
      slug = generateSlug();
      setActiveSlug(slug);
    }
    await onTogglePublicShare(noteId, !isPublic, slug);
    if (!isPublic) setTimeout(handleCopy, 50);
    setToggling(false);
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!inviteEmail.trim()) return;
    setIsInviting(true);
    const res = await addCollaborator(noteId, inviteEmail.trim(), inviteRole);
    if (res.error) {
      setError(res.error);
    } else {
      setInviteEmail('');
      await loadCollaborators();
    }
    setIsInviting(false);
  };

  const handleRoleChange = async (userId: string, newRole: CollaboratorRole) => {
    setOpenRoleMenu(null);
    await updateCollaborator(noteId, userId, newRole);
    setCollaborators((prev) => prev.map((c) => (c.userId === userId ? { ...c, role: newRole } : c)));
  };

  const handleRemove = async (userId: string) => {
    await removeCollaborator(noteId, userId);
    setCollaborators((prev) => prev.filter((c) => c.userId !== userId));
  };

  const isOwner = user?.id === noteOwnerId;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 40 }}
        transition={{ type: 'spring', damping: 28, stiffness: 260 }}
        className="relative w-full sm:max-w-md overflow-hidden rounded-t-2xl sm:rounded-2xl bg-white shadow-2xl dark:bg-zinc-900 max-h-[90vh] flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4 dark:border-zinc-800 flex-shrink-0">
          <h2 className="text-base font-bold text-gray-900 dark:text-zinc-50">Share & Collaborate</h2>
          <button
            onClick={onClose}
            className="rounded-full p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-300 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        <div className="overflow-y-auto flex-1">
          <div className="p-5 space-y-5">

            {/* ── Public link card ── */}
            <div className={`rounded-xl border p-4 transition-colors ${isPublic ? 'border-indigo-200 bg-indigo-50/60 dark:border-indigo-500/30 dark:bg-indigo-500/5' : 'border-gray-100 bg-gray-50 dark:border-zinc-800 dark:bg-zinc-800/40'}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className={`rounded-lg p-2 ${isPublic ? 'bg-indigo-100 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-400' : 'bg-gray-200 text-gray-500 dark:bg-zinc-700 dark:text-zinc-400'}`}>
                    {isPublic ? <Globe size={15} /> : <Lock size={15} />}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900 dark:text-zinc-100">
                      {isPublic ? 'Public link active' : 'Share via link'}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-zinc-400 mt-0.5">
                      {isPublic ? 'Anyone with the link can view' : 'Enable to get a short shareable link'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleTogglePublic}
                  disabled={toggling}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors flex-shrink-0 ${isPublic ? 'bg-indigo-600' : 'bg-gray-200 dark:bg-zinc-700'}`}
                >
                  {toggling ? (
                    <Loader2 size={10} className="absolute left-1/2 -translate-x-1/2 animate-spin text-white" />
                  ) : (
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${isPublic ? 'translate-x-6' : 'translate-x-1'}`} />
                  )}
                </button>
              </div>

              <AnimatePresence>
                {isPublic && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.18 }}
                    className="overflow-hidden"
                  >
                    <div className="mt-3 flex gap-2">
                      <div className="flex-1 flex items-center gap-1.5 rounded-lg bg-white px-3 py-2 border border-gray-200 dark:border-zinc-700 dark:bg-zinc-900 min-w-0">
                        <LinkIcon size={12} className="text-gray-400 flex-shrink-0" />
                        <span className="text-xs text-gray-600 dark:text-zinc-300 truncate font-mono">
                          {shortUrl || `${window.location.origin}/shared/${noteId}`}
                        </span>
                      </div>
                      <button
                        onClick={handleCopy}
                        className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-all flex-shrink-0 ${copied ? 'bg-emerald-600 text-white' : 'bg-indigo-600 hover:bg-indigo-700 text-white'}`}
                      >
                        {copied ? <><Check size={12} /> Copied</> : <><Copy size={12} /> Copy</>}
                      </button>
                    </div>
                    {shortUrl && (
                      <p className="mt-1.5 text-[10px] text-gray-400 dark:text-zinc-500 pl-1">
                        Short link active · full URL also works
                      </p>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* ── Invite collaborators ── */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 dark:text-zinc-500 mb-2.5">
                Invite collaborators
              </p>
              <form onSubmit={handleInvite} className="flex gap-2">
                <input
                  type="email"
                  placeholder="name@example.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="flex-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:focus:border-indigo-500 transition-colors min-w-0"
                />
                <div className="flex gap-1.5">
                  <div className="relative">
                    <select
                      value={inviteRole}
                      onChange={(e) => setInviteRole(e.target.value as CollaboratorRole)}
                      className="appearance-none rounded-lg border border-gray-200 bg-white pl-2.5 pr-6 py-2 text-xs font-medium outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 cursor-pointer"
                    >
                      <option value="editor">Editor</option>
                      <option value="viewer">Viewer</option>
                    </select>
                    <ChevronDown size={11} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                  </div>
                  <button
                    type="submit"
                    disabled={isInviting || !inviteEmail.trim()}
                    className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:opacity-50 flex-shrink-0"
                  >
                    {isInviting ? <Loader2 size={13} className="animate-spin" /> : <UserPlus size={13} />}
                  </button>
                </div>
              </form>
              {error && (
                <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="mt-2 text-xs text-red-500">
                  {error}
                </motion.p>
              )}
            </div>

            {/* ── Collaborator list ── */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 dark:text-zinc-500 mb-2.5">
                People with access
              </p>

              {/* Note owner row */}
              {noteOwnerId && (
                <div className="flex items-center justify-between py-2">
                  <div className="flex items-center gap-2.5">
                    <Avatar profile={{ id: noteOwnerId, email: ownerProfile?.email, avatarUrl: ownerProfile?.avatarUrl, fullName: ownerProfile?.fullName }} size={8} />
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-zinc-200">
                        {ownerProfile?.fullName || ownerProfile?.email || '…'}
                        {user?.id === noteOwnerId && (
                          <span className="ml-1.5 text-[10px] text-gray-400 dark:text-zinc-500">(you)</span>
                        )}
                      </p>
                      {ownerProfile?.email && ownerProfile?.fullName && (
                        <p className="text-xs text-gray-400 dark:text-zinc-500">{ownerProfile.email}</p>
                      )}
                    </div>
                  </div>
                  <span className="flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-600 dark:bg-amber-500/10 dark:text-amber-400">
                    <Crown size={10} /> Owner
                  </span>
                </div>
              )}

              {loading ? (
                <div className="flex justify-center py-6">
                  <Loader2 size={18} className="animate-spin text-gray-300 dark:text-zinc-600" />
                </div>
              ) : collaborators.length === 0 ? (
                <p className="py-3 text-sm text-gray-400 dark:text-zinc-500">
                  No collaborators yet — invite someone above.
                </p>
              ) : (
                <ul className="space-y-0.5">
                  {collaborators.map((c) => (
                    <li key={c.userId} className="group flex items-center justify-between rounded-lg px-1 py-2 hover:bg-gray-50 dark:hover:bg-zinc-800/50 transition-colors">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Avatar profile={{ id: c.userId, email: c.profile?.email, avatarUrl: c.profile?.avatarUrl, fullName: c.profile?.fullName }} size={8} />
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-900 dark:text-zinc-200 truncate">
                            {c.profile?.fullName || c.profile?.email || 'Unknown'}
                            {c.userId === user?.id && (
                              <span className="ml-1.5 text-[10px] text-gray-400 dark:text-zinc-500">(you)</span>
                            )}
                          </p>
                          {c.profile?.email && c.profile?.fullName && (
                            <p className="text-xs text-gray-400 dark:text-zinc-500 truncate">{c.profile.email}</p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        {/* Role badge / dropdown */}
                        {isOwner && c.userId !== user?.id ? (
                          <div className="relative">
                            <button
                              onClick={() => setOpenRoleMenu(openRoleMenu === c.userId ? null : c.userId)}
                              className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold transition-colors ${ROLE_COLORS[c.role]} hover:opacity-80`}
                            >
                              {ROLE_ICONS[c.role]}
                              {c.role.charAt(0).toUpperCase() + c.role.slice(1)}
                              <ChevronDown size={9} />
                            </button>
                            <AnimatePresence>
                              {openRoleMenu === c.userId && (
                                <motion.div
                                  initial={{ opacity: 0, scale: 0.95, y: -4 }}
                                  animate={{ opacity: 1, scale: 1, y: 0 }}
                                  exit={{ opacity: 0, scale: 0.95, y: -4 }}
                                  className="absolute right-0 top-full mt-1 z-50 min-w-[120px] rounded-xl border border-gray-100 bg-white shadow-xl dark:border-zinc-700 dark:bg-zinc-800 overflow-hidden"
                                >
                                  {(['editor', 'viewer'] as CollaboratorRole[]).map((role) => (
                                    <button
                                      key={role}
                                      onClick={() => handleRoleChange(c.userId, role)}
                                      className={`w-full flex items-center gap-2 px-3 py-2 text-xs font-medium transition-colors hover:bg-gray-50 dark:hover:bg-zinc-700 ${c.role === role ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-700 dark:text-zinc-300'}`}
                                    >
                                      {ROLE_ICONS[role]}
                                      {role.charAt(0).toUpperCase() + role.slice(1)}
                                      {c.role === role && <Check size={10} className="ml-auto" />}
                                    </button>
                                  ))}
                                  <div className="border-t border-gray-100 dark:border-zinc-700">
                                    <button
                                      onClick={() => { setOpenRoleMenu(null); handleRemove(c.userId); }}
                                      className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                                    >
                                      <X size={10} /> Remove
                                    </button>
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        ) : (
                          <span className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${ROLE_COLORS[c.role]}`}>
                            {ROLE_ICONS[c.role]}
                            {c.role.charAt(0).toUpperCase() + c.role.slice(1)}
                          </span>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

          </div>
        </div>
      </motion.div>
    </div>
  );
}
