'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Link as LinkIcon, UserPlus, Loader2, UserCircle2 } from 'lucide-react';
import type { Collaborator, CollaboratorRole } from '@/lib/types';
import { useAuth } from '@/components/auth-provider';

interface ShareSheetProps {
  noteId: string;
  isPublic: boolean;
  onTogglePublicShare: (id: string, isPublic: boolean) => Promise<void>;
  getCollaborators: (noteId: string) => Promise<Collaborator[]>;
  addCollaborator: (noteId: string, email: string, role: CollaboratorRole) => Promise<{ error?: string; success?: boolean }>;
  removeCollaborator: (noteId: string, userId: string) => Promise<void>;
  updateCollaborator: (noteId: string, userId: string, role: CollaboratorRole) => Promise<void>;
  onClose: () => void;
}

export function ShareSheet({
  noteId,
  isPublic,
  onTogglePublicShare,
  getCollaborators,
  addCollaborator,
  removeCollaborator,
  updateCollaborator,
  onClose,
}: ShareSheetProps) {
  const { user } = useAuth();
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<CollaboratorRole>('viewer');
  const [isInviting, setIsInviting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    loadCollaborators();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noteId]);

  const loadCollaborators = async () => {
    setLoading(true);
    const cols = await getCollaborators(noteId);
    setCollaborators(cols);
    setLoading(false);
  };

  const handleCopyLink = () => {
    const url = `${window.location.origin}/shared/${noteId}`;
    navigator.clipboard.writeText(url).then(() => {
      alert('Link copied to clipboard!');
    });
  };

  const handleTogglePublic = async () => {
    await onTogglePublicShare(noteId, !isPublic);
    if (!isPublic) {
      handleCopyLink();
    }
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
    await updateCollaborator(noteId, userId, newRole);
    setCollaborators((prev) => 
      prev.map((c) => (c.userId === userId ? { ...c, role: newRole } : c))
    );
  };

  const handleRemove = async (userId: string) => {
    await removeCollaborator(noteId, userId);
    setCollaborators((prev) => prev.filter((c) => c.userId !== userId));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        className="relative w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-zinc-900"
      >
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4 dark:border-zinc-800">
          <h2 className="text-lg font-bold text-gray-900 dark:text-zinc-50">Share Note</h2>
          <button
            onClick={onClose}
            className="rounded-full p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-6">
          <form onSubmit={handleInvite} className="mb-6 flex gap-2">
            <input
              type="email"
              placeholder="Invite by email..."
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-indigo-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
            />
            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value as CollaboratorRole)}
              className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
            >
              <option value="viewer">Viewer</option>
              <option value="editor">Editor</option>
            </select>
            <button
              type="submit"
              disabled={isInviting || !inviteEmail.trim()}
              className="flex items-center justify-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:opacity-50"
            >
              {isInviting ? <Loader2 size={16} className="animate-spin" /> : 'Invite'}
            </button>
          </form>
          {error && <p className="mb-4 text-xs text-red-500">{error}</p>}

          <div className="mb-6">
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-gray-500">Collaborators</h3>
            {loading ? (
              <div className="flex justify-center py-4">
                <Loader2 size={20} className="animate-spin text-gray-400" />
              </div>
            ) : collaborators.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-zinc-400">No collaborators yet.</p>
            ) : (
              <ul className="space-y-3">
                {collaborators.map((c) => (
                  <li key={c.userId} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {c.profile?.avatarUrl ? (
                        <img src={c.profile.avatarUrl} alt="Avatar" className="h-8 w-8 rounded-full object-cover" />
                      ) : (
                        <UserCircle2 size={32} className="text-gray-300 dark:text-zinc-600" />
                      )}
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-zinc-200">
                          {c.profile?.fullName || c.profile?.email || 'Unknown User'}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-zinc-500">{c.profile?.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <select
                        value={c.role}
                        onChange={(e) => handleRoleChange(c.userId, e.target.value as CollaboratorRole)}
                        className="rounded border border-gray-200 bg-transparent px-2 py-1 text-xs outline-none dark:border-zinc-700 dark:text-zinc-300"
                      >
                        <option value="viewer">Viewer</option>
                        <option value="editor">Editor</option>
                      </select>
                      <button
                        onClick={() => handleRemove(c.userId)}
                        className="text-gray-400 hover:text-red-500"
                        title="Remove"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-xl border border-gray-100 bg-gray-50 p-4 dark:border-zinc-800 dark:bg-zinc-800/50">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-zinc-200">
                  <LinkIcon size={16} />
                  Public Link Sharing
                </h3>
                <p className="mt-1 text-xs text-gray-500 dark:text-zinc-400">
                  Anyone with the link can view this note anonymously.
                </p>
              </div>
              <button
                onClick={handleTogglePublic}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  isPublic ? 'bg-indigo-600' : 'bg-gray-200 dark:bg-zinc-700'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    isPublic ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
            {isPublic && (
              <div className="mt-3 flex gap-2">
                <input
                  type="text"
                  readOnly
                  value={`${window.location.origin}/shared/${noteId}`}
                  className="flex-1 rounded bg-white px-2 py-1 text-xs text-gray-600 outline-none dark:bg-zinc-900 dark:text-zinc-300"
                />
                <button
                  onClick={handleCopyLink}
                  className="rounded bg-gray-200 px-3 py-1 text-xs font-medium transition-colors hover:bg-gray-300 dark:bg-zinc-700 dark:hover:bg-zinc-600"
                >
                  Copy
                </button>
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
