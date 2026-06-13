'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, User, Shield, Camera, Loader2, Check, AlertCircle } from 'lucide-react';
import { useAuth } from '@/components/auth-provider';
import { supabase } from '@/lib/supabaseClient';

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
}

type Tab = 'profile' | 'security';

export function SettingsModal({ open, onClose }: SettingsModalProps) {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('profile');
  
  // Profile Info States
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  
  // Security States
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingSecurity, setSavingSecurity] = useState(false);
  
  // Notice States
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync profile values when modal opens or user updates
  useEffect(() => {
    if (user) {
      setName(user.user_metadata?.name || user.user_metadata?.full_name || '');
      setEmail(user.email || '');
    }
  }, [user, open]);

  // Clean notices when tabs switch
  useEffect(() => {
    setError('');
    setSuccessMsg('');
  }, [activeTab]);

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    setSavingProfile(true);

    try {
      const { error: updateError } = await supabase.auth.updateUser({
        data: { name: name.trim() },
      });
      if (updateError) throw updateError;
      setSuccessMsg('Profile updated successfully!');
    } catch (err: any) {
      setError(err.message || 'Failed to update profile.');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleSecuritySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    if (!password) {
      setError('Please enter a password.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setSavingSecurity(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password: password,
      });
      if (updateError) throw updateError;
      setSuccessMsg('Password updated successfully!');
      setPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setError(err.message || 'Failed to update password.');
    } finally {
      setSavingSecurity(false);
    }
  };

  // Profile Image Upload Functions
  const processFile = async (file: File) => {
    if (!user) return;
    if (!file.type.startsWith('image/')) {
      setError('Only image files are allowed.');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setError('Profile image must be under 2MB.');
      return;
    }

    setUploading(true);
    setError('');
    setSuccessMsg('');

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `avatar-${Date.now()}.${fileExt}`;
      const filePath = `${user.id}/${fileName}`;

      // Upload file to Supabase storage 'avatars' bucket
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, { cacheControl: '3600', upsert: true });

      if (uploadError) throw uploadError;

      // Retrieve public URL
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      // Save public URL to user's auth metadata
      const { error: updateError } = await supabase.auth.updateUser({
        data: { avatar_url: publicUrl },
      });

      if (updateError) throw updateError;
      setSuccessMsg('Profile picture updated successfully!');
    } catch (err: any) {
      setError(err.message || 'Failed to upload profile picture.');
    } finally {
      setUploading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  };

  const handleTriggerUpload = () => {
    fileInputRef.current?.click();
  };

  const currentAvatar = user?.user_metadata?.avatar_url;
  const userNameInitials = (name || user?.email || 'U')
    .split(' ')
    .map((n) => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop overlay */}
          <motion.div
            key="settings-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
          />

          {/* Modal Container */}
          <motion.div
            key="settings-modal"
            initial={{ opacity: 0, scale: 0.98, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: 16 }}
            transition={{ type: 'spring', damping: 25, stiffness: 350 }}
            className="fixed inset-x-4 top-[15%] z-50 mx-auto max-w-lg overflow-hidden rounded-xl bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 shadow-2xl flex flex-col h-[480px]"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-zinc-800/80">
              <h2 className="text-sm font-semibold text-gray-900 dark:text-zinc-100 tracking-tight">Account Settings</h2>
              <button
                onClick={onClose}
                className="p-1 rounded-md text-gray-400 hover:text-gray-600 dark:hover:text-zinc-300 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            <div className="flex flex-1 overflow-hidden">
              {/* Sidebar Tabs */}
              <div className="w-40 border-r border-gray-100 dark:border-zinc-800/80 bg-gray-50/50 dark:bg-zinc-900/30 p-3 flex flex-col gap-1">
                <button
                  onClick={() => setActiveTab('profile')}
                  className={`flex items-center gap-2 px-3 py-2 text-xs font-medium rounded-lg transition-all ${
                    activeTab === 'profile'
                      ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-950 font-semibold'
                      : 'text-gray-500 dark:text-zinc-400 hover:bg-gray-100 dark:hover:bg-zinc-800/60'
                  }`}
                >
                  <User size={13} />
                  <span>My Profile</span>
                </button>
                <button
                  onClick={() => setActiveTab('security')}
                  className={`flex items-center gap-2 px-3 py-2 text-xs font-medium rounded-lg transition-all ${
                    activeTab === 'security'
                      ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-950 font-semibold'
                      : 'text-gray-500 dark:text-zinc-400 hover:bg-gray-100 dark:hover:bg-zinc-800/60'
                  }`}
                >
                  <Shield size={13} />
                  <span>Security</span>
                </button>
              </div>

              {/* Main Content Area */}
              <div className="flex-1 p-6 overflow-y-auto flex flex-col">
                <AnimatePresence mode="wait">
                  {activeTab === 'profile' ? (
                    <motion.div
                      key="profile-tab"
                      initial={{ opacity: 0, x: 4 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -4 }}
                      transition={{ duration: 0.15 }}
                      className="flex-1 flex flex-col gap-5"
                    >
                      {/* Avatar Upload Block */}
                      <div className="flex items-center gap-4">
                        <div className="relative group">
                          <div className="w-16 h-16 rounded-full border border-gray-200/20 bg-zinc-950 flex items-center justify-center text-zinc-100 text-lg font-bold overflow-hidden select-none">
                            {uploading ? (
                              <Loader2 size={20} className="animate-spin text-zinc-400" />
                            ) : currentAvatar ? (
                              <img src={currentAvatar} alt="Avatar" className="w-full h-full object-cover" />
                            ) : (
                              <span>{userNameInitials}</span>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={handleTriggerUpload}
                            className="absolute -bottom-1 -right-1 p-1.5 rounded-full bg-zinc-950 dark:bg-zinc-100 border border-zinc-900 dark:border-zinc-200 text-zinc-100 dark:text-zinc-900 hover:scale-105 active:scale-95 shadow-md transition-all cursor-pointer"
                            title="Upload avatar"
                            disabled={uploading}
                          >
                            <Camera size={11} />
                          </button>
                        </div>

                        {/* Drag and Drop Zone */}
                        <div
                          onDragEnter={handleDrag}
                          onDragOver={handleDrag}
                          onDragLeave={handleDrag}
                          onDrop={handleDrop}
                          onClick={handleTriggerUpload}
                          className={`flex-1 h-16 rounded-xl border border-dashed text-center flex flex-col justify-center items-center px-4 transition-colors cursor-pointer select-none ${
                            dragActive
                              ? 'border-zinc-800 dark:border-zinc-300 bg-zinc-100/10'
                              : 'border-zinc-800/40 dark:border-zinc-800 hover:border-zinc-700/60 dark:hover:border-zinc-700 hover:bg-zinc-100/5'
                          }`}
                        >
                          <span className="text-[10px] font-medium text-gray-500 dark:text-zinc-400">
                            {uploading ? 'Uploading picture...' : 'Drag new profile picture here or click to browse'}
                          </span>
                          <span className="text-[9px] text-gray-400 dark:text-zinc-600 mt-0.5">
                            JPEG or PNG (Max 2MB)
                          </span>
                        </div>
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/*"
                          onChange={handleFileChange}
                          className="hidden"
                        />
                      </div>

                      {/* Profile Settings Form */}
                      <form onSubmit={handleProfileSubmit} className="space-y-4 mt-2">
                        <div className="space-y-1.5">
                          <label className="block text-[9px] font-semibold text-gray-400 dark:text-zinc-500 uppercase tracking-widest">
                            Email Address
                          </label>
                          <input
                            type="email"
                            disabled
                            value={email}
                            className="w-full h-9 bg-zinc-50 dark:bg-zinc-950/40 text-gray-400 dark:text-zinc-500 text-xs px-3 rounded-md border border-gray-100 dark:border-zinc-800 cursor-not-allowed outline-none"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <label className="block text-[9px] font-semibold text-gray-400 dark:text-zinc-500 uppercase tracking-widest">
                            Full Name
                          </label>
                          <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="Ada Lovelace"
                            className="w-full h-9 bg-zinc-950 text-zinc-100 text-xs px-3 rounded-md border border-zinc-900 placeholder:text-zinc-700 outline-none focus:border-zinc-700 focus:ring-0 transition-colors duration-150"
                          />
                        </div>

                        <button
                          type="submit"
                          disabled={savingProfile || !name.trim()}
                          className="w-full h-9 rounded-md bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-950 font-medium text-xs flex items-center justify-center gap-2 hover:opacity-90 active:scale-[0.99] disabled:opacity-50 transition-all cursor-pointer"
                        >
                          {savingProfile ? <Loader2 size={13} className="animate-spin" /> : 'Save Changes'}
                        </button>
                      </form>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="security-tab"
                      initial={{ opacity: 0, x: 4 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -4 }}
                      transition={{ duration: 0.15 }}
                      className="flex-1 flex flex-col gap-4"
                    >
                      <form onSubmit={handleSecuritySubmit} className="space-y-4">
                        <div className="space-y-1.5">
                          <label className="block text-[9px] font-semibold text-gray-400 dark:text-zinc-500 uppercase tracking-widest">
                            New Password
                          </label>
                          <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="••••••••"
                            className="w-full h-9 bg-zinc-950 text-zinc-100 text-xs px-3 rounded-md border border-zinc-900 placeholder:text-zinc-700 outline-none focus:border-zinc-700 focus:ring-0 transition-colors duration-150"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <label className="block text-[9px] font-semibold text-gray-400 dark:text-zinc-500 uppercase tracking-widest">
                            Confirm Password
                          </label>
                          <input
                            type="password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            placeholder="••••••••"
                            className="w-full h-9 bg-zinc-950 text-zinc-100 text-xs px-3 rounded-md border border-zinc-900 placeholder:text-zinc-700 outline-none focus:border-zinc-700 focus:ring-0 transition-colors duration-150"
                          />
                        </div>

                        <button
                          type="submit"
                          disabled={savingSecurity}
                          className="w-full h-9 rounded-md bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-950 font-medium text-xs flex items-center justify-center gap-2 hover:opacity-90 active:scale-[0.99] disabled:opacity-50 transition-all cursor-pointer"
                        >
                          {savingSecurity ? <Loader2 size={13} className="animate-spin" /> : 'Update Password'}
                        </button>
                      </form>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Notifications Drawer */}
                <div className="mt-auto pt-4">
                  <AnimatePresence>
                    {error && (
                      <motion.div
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className="flex items-center gap-2 text-[11px] text-red-400 bg-red-950/20 border border-red-900/50 rounded-md px-3 py-2"
                      >
                        <AlertCircle size={13} />
                        <span className="flex-1 truncate">{error}</span>
                      </motion.div>
                    )}

                    {successMsg && (
                      <motion.div
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className="flex items-center gap-2 text-[11px] text-emerald-400 bg-emerald-950/20 border border-emerald-900/50 rounded-md px-3 py-2"
                      >
                        <Check size={13} />
                        <span className="flex-1 truncate">{successMsg}</span>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
