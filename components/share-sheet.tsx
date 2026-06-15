'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, Link as LinkIcon, UserPlus, Loader2,
  Check, Copy, Globe, Lock, Crown, Eye, Pencil,
  Trash2, QrCode, Mail, Zap, Users, ExternalLink,
  AlertCircle, ChevronDown, Shield, Settings2, UserCheck
} from 'lucide-react';
import type { Collaborator, CollaboratorRole } from '@/lib/types';
import { useAuth } from '@/components/auth-provider';
import { supabase } from '@/lib/supabaseClient';

// ─── Types & Configs ──────────────────────────────────────────────────────────

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

const ROLES: Record<CollaboratorRole, { label: string; icon: React.ReactNode; color: string; bg: string; description: string }> = {
  editor: {
    label: 'Editor',
    icon: <Pencil size={12} />,
    color: 'text-violet-400',
    bg: 'bg-violet-500/10 border-violet-500/25 text-violet-300',
    description: 'Can read, write, and modify content live'
  },
  viewer: {
    label: 'Viewer',
    icon: <Eye size={12} />,
    color: 'text-sky-400',
    bg: 'bg-sky-500/10 border-sky-500/25 text-sky-300',
    description: 'Read-only access to this document'
  },
};

function generateSlug(): string {
  const chars = 'abcdefghijkmnpqrstuvwxyz23456789';
  return Array.from(crypto.getRandomValues(new Uint8Array(8)))
    .map((b) => chars[b % chars.length])
    .join('');
}

function getAvatarStyles(id: string) {
  const colors = ['bg-pink-500/20 text-pink-400', 'bg-emerald-500/20 text-emerald-400', 'bg-amber-500/20 text-amber-400', 'bg-blue-500/20 text-blue-400', 'bg-indigo-500/20 text-indigo-400'];
  let code = 0;
  for (let i = 0; i < id.length; i++) code += id.charCodeAt(i);
  return colors[code % colors.length];
}

// ─── Main Component ───────────────────────────────────────────────────────────

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

  // FIXED LOGIC: Determine if current user has management permissions (Owner OR an Editor)
  const isOwner = user?.id === noteOwnerId;
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const currentUserCollaboratorObj = collaborators.find(c => c.userId === user?.id);
  const canManagePrivileges = isOwner || currentUserCollaboratorObj?.role === 'editor';

  // Synchronization States
  const [ownerProfile, setOwnerProfile] = useState<{ email?: string; fullName?: string; avatarUrl?: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [activeSlug, setActiveSlug] = useState(shareSlug || '');
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);

  // Form Management States
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<CollaboratorRole>('editor');
  const [isInviting, setIsInviting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [removingId, setRemovingId] = useState<string | null>(null);

  const url = activeSlug ? `${typeof window !== 'undefined' ? window.location.origin : ''}/s/${activeSlug}` : '';

  // Lifecycle Sync
  useEffect(() => {
    let active = true;
    setLoading(true);
    getCollaborators(noteId).then((data) => {
      if (active) {
        setCollaborators(data);
        setLoading(false);
      }
    });
    return () => { active = false; };
  }, [noteId, getCollaborators]);

  useEffect(() => {
    if (!noteOwnerId) return;
    if (noteOwnerId === user?.id) {
      setOwnerProfile({
        email: user.email,
        fullName: user.user_metadata?.full_name,
        avatarUrl: user.user_metadata?.avatar_url,
      });
    } else {
      supabase.from('profiles').select('email, full_name, avatar_url').eq('id', noteOwnerId).single()
        .then(({ data }) => {
          if (data) setOwnerProfile({ email: data.email, fullName: data.full_name, avatarUrl: data.avatar_url });
        });
    }
  }, [noteOwnerId, user]);

  const handleToggleLink = async () => {
    setToggling(true);
    let currentSlug = activeSlug;
    if (!isPublic && !currentSlug) {
      currentSlug = generateSlug();
      setActiveSlug(currentSlug);
    }
    await onTogglePublicShare(noteId, !isPublic, currentSlug);
    setToggling(false);
  };

  const copyToClipboard = async () => {
    const copyTarget = url || `${window.location.origin}/shared/${noteId}`;
    await navigator.clipboard.writeText(copyTarget);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    const targetEmail = inviteEmail.trim().toLowerCase();

    if (!targetEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(targetEmail)) {
      setErrorMsg('Please input a correct email address format.');
      return;
    }
    if (targetEmail === user?.email?.toLowerCase()) {
      setErrorMsg('You are already connected to this workspace.');
      return;
    }
    if (collaborators.some(c => c.profile?.email?.toLowerCase() === targetEmail)) {
      setErrorMsg('This user already possesses explicit access overrides.');
      return;
    }

    setIsInviting(true);
    const result = await addCollaborator(noteId, targetEmail, inviteRole);
    if (result.error) {
      setErrorMsg(result.error);
    } else {
      setInviteEmail('');
      setSuccessMsg(`Access tier assigned: ${targetEmail}`);
      const updatedList = await getCollaborators(noteId);
      setCollaborators(updatedList);
      setTimeout(() => setSuccessMsg(''), 3500);
    }
    setIsInviting(false);
  };

  const changeCollaboratorRole = async (targetUserId: string, nextRole: CollaboratorRole) => {
    setActiveDropdown(null);
    setCollaborators(prev => prev.map(c => c.userId === targetUserId ? { ...c, role: nextRole } : c));
    await updateCollaborator(noteId, targetUserId, nextRole);
  };

  const handleRemoveUser = async (targetUserId: string) => {
    setRemovingId(targetUserId);
    await removeCollaborator(noteId, targetUserId);
    setCollaborators(prev => prev.filter(c => c.userId !== targetUserId));
    setRemovingId(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 15 }}
        className="relative w-full max-w-[480px] max-h-[85vh] flex flex-col rounded-2xl bg-[#0b0c10] border border-white/5 shadow-2xl text-slate-200 overflow-hidden"
      >
        {/* Header Section */}
        <div className="p-5 border-b border-white/5 flex items-center justify-between flex-shrink-0">
          <div>
            <h3 className="text-sm font-semibold tracking-wide uppercase text-slate-400">Access Management Cockpit</h3>
            <p className="text-xs text-slate-500 truncate max-w-[340px] mt-0.5">{noteTitle || 'Document settings'}</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors text-slate-400 hover:text-white"
          >
            <X size={16} />
          </button>
        </div>

        {/* Content Configuration Panel */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">

          {/* Public Link Sharing Toggle Card */}
          <div className={`p-4 rounded-xl border transition-all ${isPublic ? 'bg-violet-950/10 border-violet-500/20' : 'bg-white/[0.02] border-white/5'}`}>
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isPublic ? 'bg-violet-500/20 text-violet-400' : 'bg-white/5 text-slate-500'}`}>
                  {isPublic ? <Globe size={15} /> : <Lock size={15} />}
                </div>
                <div>
                  <h4 className="text-xs font-semibold text-slate-200">Public Link Overrides</h4>
                  <p className="text-[11px] text-slate-500 mt-0.5">Allows global link lookup resolution</p>
                </div>
              </div>

              <button
                type="button"
                disabled={!canManagePrivileges || toggling}
                onClick={handleToggleLink}
                className={`w-10 h-5.5 rounded-full p-0.5 transition-colors flex items-center ${isPublic ? 'bg-violet-600' : 'bg-white/10'} ${!canManagePrivileges ? 'opacity-40 cursor-not-allowed' : ''}`}
              >
                <motion.div
                  className="w-4 h-4 rounded-full bg-white shadow-md"
                  animate={{ x: isPublic ? 20 : 2 }}
                  transition={{ type: "spring", stiffness: 500, damping: 30 }}
                />
              </button>
            </div>

            <AnimatePresence>
              {isPublic && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                  <div className="mt-4 pt-3 border-t border-white/5 space-y-2">
                    <div className="flex gap-2">
                      <div className="flex-1 rounded-lg bg-black/40 border border-white/5 px-3 py-2 text-xs font-mono text-slate-400 truncate flex items-center gap-2">
                        <LinkIcon size={12} className="text-slate-600 flex-shrink-0" />
                        <span className="truncate">{url || `${window.location.origin}/shared/${noteId}`}</span>
                      </div>
                      <button
                        onClick={copyToClipboard}
                        className={`px-3 py-2 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors ${copied ? 'bg-emerald-500/20 text-emerald-400' : 'bg-white/5 hover:bg-white/10 text-slate-300'}`}
                      >
                        {copied ? <Check size={13} /> : <Copy size={13} />}
                        {copied ? 'Copied' : 'Copy'}
                      </button>
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <button type="button" onClick={() => setShowQR(!showQR)} className={`text-[11px] font-medium flex items-center gap-1 ${showQR ? 'text-violet-400' : 'text-slate-500 hover:text-slate-400'}`}>
                        <QrCode size={12} /> {showQR ? 'Hide Matrix' : 'Generate QR Entry'}
                      </button>
                      <a href={`mailto:?subject=Shared Link&body=${encodeURIComponent(url)}`} className="text-[11px] text-slate-500 hover:text-slate-400 flex items-center gap-1">
                        <Mail size={12} /> Share via Email
                      </a>
                    </div>

                    {showQR && (
                      <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="flex flex-col items-center justify-center p-4 bg-black/30 rounded-lg border border-white/5 mt-2">
                        <div className="bg-white p-2 rounded-lg">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={`https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(url || window.location.origin)}&size=120x120&margin=2`} alt="Access QR Matrix" className="w-28 h-28 select-none" />
                        </div>
                      </motion.div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Collaborator Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-semibold tracking-wider uppercase text-slate-500 flex items-center gap-1.5">
                <Users size={12} /> Collaborators & Access Controls
              </h4>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 border border-white/5 text-slate-400 font-mono">
                {collaborators.length + 1} Managed Users
              </span>
            </div>

            {/* FIXED CONDITION: Render the creation box for both Workspace Owners and Editors */}
            {canManagePrivileges && (
              <form onSubmit={handleSendInvite} className="space-y-2 p-3 bg-white/[0.01] border border-white/5 rounded-xl">
                <p className="text-[10px] text-slate-400 font-medium tracking-wide uppercase px-0.5">Grant Explicit Access Controls</p>
                <div className="flex gap-2">
                  <div className="flex-1 relative flex items-center">
                    <input
                      type="email"
                      placeholder="Enter identity email address..."
                      value={inviteEmail}
                      onChange={(e) => { setInviteEmail(e.target.value); setErrorMsg(''); }}
                      className="w-full bg-black/40 border border-white/5 rounded-lg px-3 py-2 text-xs text-slate-200 placeholder:text-slate-600 outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/20"
                    />
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center bg-[#0b0c10] border border-white/5 rounded px-1.5 py-0.5">
                      <select
                        value={inviteRole}
                        onChange={(e) => setInviteRole(e.target.value as CollaboratorRole)}
                        className="bg-transparent border-none text-[10px] font-semibold text-slate-300 outline-none pr-3 cursor-pointer appearance-none uppercase tracking-wider"
                      >
                        <option value="editor">Editor</option>
                        <option value="viewer">Viewer</option>
                      </select>
                      <ChevronDown size={10} className="text-slate-500 absolute right-1 pointer-events-none" />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isInviting || !inviteEmail.trim()}
                    className="px-3.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold flex items-center gap-1.5 disabled:opacity-40 transition-all flex-shrink-0"
                  >
                    {isInviting ? <Loader2 size={12} className="animate-spin" /> : <UserPlus size={12} />}
                    <span>Add</span>
                  </button>
                </div>
              </form>
            )}

            {/* Error/Success Feedback components */}
            <AnimatePresence>
              {errorMsg && (
                <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="p-2.5 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center gap-2 text-xs text-red-400">
                  <AlertCircle size={13} /> {errorMsg}
                </motion.div>
              )}
              {successMsg && (
                <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center gap-2 text-xs text-emerald-400">
                  <UserCheck size={13} /> {successMsg}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Active Members Ledger Stacks */}
            <div className="space-y-1.5 pt-1">

              {/* Workspace Owner Base Node Card */}
              <div className="p-3 rounded-xl border border-amber-500/10 bg-amber-500/[0.02] flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs ${getAvatarStyles(noteOwnerId || '')}`}>
                    {(ownerProfile?.fullName || ownerProfile?.email || 'O').charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-slate-200 truncate">
                      {ownerProfile?.fullName || ownerProfile?.email || 'Workspace Owner'}
                      {user?.id === noteOwnerId && <span className="text-[10px] text-slate-500 font-normal ml-1.5">(You)</span>}
                    </p>
                    <p className="text-[10px] text-slate-500 truncate mt-0.5">{ownerProfile?.email || 'Primary Administrator'}</p>
                  </div>
                </div>
                <div className="px-2 py-0.5 rounded-md border border-amber-500/20 bg-amber-500/10 text-amber-400 text-[10px] font-semibold flex items-center gap-1">
                  <Crown size={10} /> Owner
                </div>
              </div>

              {/* Loop Rendering Invited Collaborators */}
              {loading ? (
                <div className="p-4 flex items-center justify-center gap-2 text-xs text-slate-500">
                  <Loader2 size={13} className="animate-spin" /> Fetching database access controls...
                </div>
              ) : (
                collaborators.map((member) => {
                  const roleConfig = ROLES[member.role];
                  const dropdownOpen = activeDropdown === member.userId;
                  const isTargetMe = user?.id === member.userId;

                  return (
                    <div
                      key={member.userId}
                      className={`p-3 rounded-xl border border-white/5 bg-white/[0.01] flex items-center justify-between gap-3 relative transition-opacity ${removingId === member.userId ? 'opacity-30 pointer-events-none' : ''}`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs ${getAvatarStyles(member.userId)}`}>
                          {(member.profile?.fullName || member.profile?.email || 'M').charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-slate-200 truncate">
                            {member.profile?.fullName || member.profile?.email || 'Collaborator'}
                            {isTargetMe && <span className="text-[10px] text-slate-500 font-normal ml-1.5">(You)</span>}
                          </p>
                          <p className="text-[10px] text-slate-500 truncate mt-0.5">{member.profile?.email || 'Assigned User'}</p>
                        </div>
                      </div>

                      {/* Dropdown triggers & action anchors updates */}
                      <div className="flex items-center gap-1.5 relative z-20">

                        {/* FIXED CONDITION: Owners or Editors can alter privileges of other accounts */}
                        {canManagePrivileges && !isTargetMe ? (
                          <div className="relative">
                            <button
                              type="button"
                              onClick={() => setActiveDropdown(dropdownOpen ? null : member.userId)}
                              className={`px-2 py-1 rounded-md border ${roleConfig.bg} text-[10px] font-semibold flex items-center gap-1 transition-colors`}
                            >
                              {roleConfig.icon} <span>{roleConfig.label}</span>
                              <ChevronDown size={10} className="opacity-60" />
                            </button>

                            <AnimatePresence>
                              {dropdownOpen && (
                                <>
                                  <div className="fixed inset-0 z-30" onClick={() => setActiveDropdown(null)} />
                                  <motion.div
                                    initial={{ opacity: 0, y: 5, scale: 0.95 }}
                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                    exit={{ opacity: 0, y: 5, scale: 0.95 }}
                                    className="absolute right-0 top-full mt-1.5 bg-[#12141c] border border-white/10 rounded-lg shadow-xl overflow-hidden z-40 w-44"
                                  >
                                    {(Object.keys(ROLES) as CollaboratorRole[]).map((r) => (
                                      <button
                                        key={r}
                                        type="button"
                                        onClick={() => changeCollaboratorRole(member.userId, r)}
                                        className="w-full px-3 py-2 text-left text-[11px] text-slate-300 hover:bg-white/5 hover:text-white transition-colors font-medium flex flex-col gap-0.5"
                                      >
                                        <div className="flex items-center gap-1.5 font-semibold text-slate-200">
                                          {ROLES[r].icon} {ROLES[r].label}
                                        </div>
                                        <div className="text-[9px] text-slate-500 font-normal ml-4">{ROLES[r].description}</div>
                                      </button>
                                    ))}
                                  </motion.div>
                                </>
                              )}
                            </AnimatePresence>
                          </div>
                        ) : (
                          <div className={`px-2 py-1 rounded-md border ${roleConfig.bg} text-[10px] font-semibold flex items-center gap-1`}>
                            {roleConfig.icon} <span>{roleConfig.label}</span>
                          </div>
                        )}

                        {/* FIXED CONDITION: Revoke validation access block */}
                        {canManagePrivileges && !isTargetMe && (
                          <button
                            type="button"
                            onClick={() => handleRemoveUser(member.userId)}
                            title="Revoke explicit access privileges"
                            className="w-6 h-6 rounded-md flex items-center justify-center border border-white/5 text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                          >
                            {removingId === member.userId ? <Loader2 size={11} className="animate-spin" /> : <Trash2 size={11} />}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Footer row bar */}
        <div className="p-4 bg-white/[0.01] border-t border-white/5 flex items-center justify-between text-[11px] text-slate-500 flex-shrink-0">
          <span className="flex items-center gap-1"><Settings2 size={12} /> Changes are automatically updated</span>
          <span className="font-mono text-[10px] opacity-40">ID: {noteId.slice(0, 8)}</span>
        </div>
      </motion.div>
    </div>
  );
}