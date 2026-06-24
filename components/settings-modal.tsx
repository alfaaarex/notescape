'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, User, Shield, Camera, Loader2, Check, AlertCircle, Palette, Settings, Sun, Moon, Monitor } from 'lucide-react';
import { useAuth } from '@/components/auth-provider';
import { supabase } from '@/lib/supabaseClient';
import { useTheme, ColorMode } from '@/components/theme-provider';

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
}

type Tab = 'profile' | 'security' | 'appearance' | 'preferences';

export function SettingsModal({ open, onClose }: SettingsModalProps) {
  const { user } = useAuth();
  const { mode, setMode } = useTheme();
  const [activeTab, setActiveTab] = useState<Tab>('profile');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingSecurity, setSavingSecurity] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (user) {
      setName(user.user_metadata?.name || user.user_metadata?.full_name || '');
      setEmail(user.email || '');
    }
  }, [user, open]);

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
      const { error: updateError } = await supabase.auth.updateUser({ data: { name: name.trim() } });
      if (updateError) throw updateError;
      setSuccessMsg('Profile updated successfully!');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update profile.');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleSecuritySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    if (!password) { setError('Please enter a password.'); return; }
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return; }
    if (password !== confirmPassword) { setError('Passwords do not match.'); return; }
    setSavingSecurity(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;
      setSuccessMsg('Password updated successfully!');
      setPassword('');
      setConfirmPassword('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update password.');
    } finally {
      setSavingSecurity(false);
    }
  };

  const processFile = async (file: File) => {
    if (!user) return;
    if (!file.type.startsWith('image/')) { setError('Only image files are allowed.'); return; }
    if (file.size > 2 * 1024 * 1024) { setError('Profile image must be under 2MB.'); return; }
    setUploading(true);
    setError('');
    setSuccessMsg('');
    try {
      const fileExt = file.name.split('.').pop();
      const filePath = `${user.id}/avatar-${Date.now()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage.from('avatars').upload(filePath, file, { cacheControl: '3600', upsert: true });
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(filePath);
      const { error: updateError } = await supabase.auth.updateUser({ data: { avatar_url: publicUrl } });
      if (updateError) throw updateError;
      setSuccessMsg('Profile picture updated successfully!');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload profile picture.');
    } finally {
      setUploading(false);
    }
  };

  const currentAvatar = user?.user_metadata?.avatar_url;
  const userNameInitials = (name || user?.email || 'U').split(' ').map((n) => n[0]).join('').substring(0, 2).toUpperCase();

  const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'profile', label: 'ACCOUNT', icon: <User size={13} /> },
    { id: 'security', label: 'SECURITY', icon: <Shield size={13} /> },
    { id: 'appearance', label: 'DISPLAY', icon: <Palette size={13} /> },
    { id: 'preferences', label: 'PREFS', icon: <Settings size={13} /> },
  ];

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') setDragActive(true);
    else if (e.type === 'dragleave') setDragActive(false);
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div key="settings-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm te-noise" />
          <motion.div
            key="settings-modal"
            initial={{ opacity: 0, scale: 0.97, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 16 }}
            transition={{ type: 'spring', damping: 28, stiffness: 380 }}
            className="fixed inset-x-4 top-[8%] md:top-[12%] z-50 mx-auto max-w-2xl overflow-hidden rounded-xl te-surface shadow-2xl flex flex-col h-[min(520px,85vh)] relative"
          >
            <div className="absolute top-2.5 left-2.5 te-screw" />
            <div className="absolute top-2.5 right-2.5 te-screw" />

            <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-muted/30">
              <div className="flex items-center gap-3">
                <span className="w-2 h-2 rounded-full te-led te-led-on" />
                <h2 className="text-sm font-mono font-bold tracking-widest uppercase te-emboss">System Config</h2>
              </div>
              <button onClick={onClose} className="p-1.5 rounded te-button text-muted-foreground"><X size={16} /></button>
            </div>

            <div className="flex flex-1 overflow-hidden">
              <div className="w-44 border-r border-border bg-muted/20 p-2 flex flex-col gap-1 flex-shrink-0">
                {TABS.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-2 px-3 py-2 text-[10px] font-mono font-bold tracking-widest uppercase rounded-lg transition-all ${
                      activeTab === tab.id ? 'te-surface text-primary' : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                    }`}
                  >
                    {tab.icon}
                    {tab.label}
                  </button>
                ))}
              </div>

              <div className="flex-1 p-6 overflow-y-auto relative bg-background te-noise">
                <AnimatePresence mode="wait">
                  {activeTab === 'profile' && (
                    <motion.div key="profile" initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -8 }} className="flex flex-col gap-5">
                      <h3 className="text-lg font-bold uppercase te-emboss">Operator Profile</h3>
                      <div className="flex items-center gap-4">
                        <div className="relative">
                          <div className="w-16 h-16 rounded-full te-inset flex items-center justify-center text-lg font-mono font-bold overflow-hidden">
                            {uploading ? <Loader2 size={20} className="animate-spin text-primary" /> : currentAvatar ? <img src={currentAvatar} alt="Avatar" className="w-full h-full object-cover" /> : userNameInitials}
                          </div>
                          <button type="button" onClick={() => fileInputRef.current?.click()} className="absolute -bottom-1 -right-1 p-1.5 rounded-full te-button-primary text-white" disabled={uploading}>
                            <Camera size={11} />
                          </button>
                        </div>
                        <div onDragEnter={handleDrag} onDragOver={handleDrag} onDragLeave={handleDrag} onDrop={(e) => { e.preventDefault(); setDragActive(false); const f = e.dataTransfer.files?.[0]; if (f) processFile(f); }} onClick={() => fileInputRef.current?.click()} className={`flex-1 h-16 rounded-lg border border-dashed te-inset flex flex-col items-center justify-center cursor-pointer ${dragActive ? 'border-primary te-glow' : 'border-border'}`}>
                          <span className="text-[10px] font-mono font-bold text-muted-foreground uppercase">{uploading ? 'UPLOADING...' : 'DROP IMAGE / CLICK'}</span>
                          <span className="text-[8px] font-mono text-muted-foreground/60 mt-0.5">MAX 2MB</span>
                        </div>
                        <input ref={fileInputRef} type="file" accept="image/*" onChange={(e) => { const f = e.target.files?.[0]; if (f) processFile(f); }} className="hidden" />
                      </div>
                      <form onSubmit={handleProfileSubmit} className="space-y-4">
                        <Field label="EMAIL" value={email} disabled />
                        <div>
                          <label className="te-label">FULL NAME</label>
                          <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="ADA LOVELACE" className="w-full mt-1 te-inset text-sm font-mono font-bold px-3 py-2.5 rounded-lg border-none outline-none focus:ring-1 focus:ring-primary uppercase" />
                        </div>
                        <button type="submit" disabled={savingProfile || !name.trim()} className="w-full py-2.5 te-button-primary text-[10px] font-mono font-bold tracking-widest uppercase rounded-lg disabled:opacity-50 flex items-center justify-center gap-2">
                          {savingProfile ? <Loader2 size={13} className="animate-spin" /> : 'SAVE PROFILE'}
                        </button>
                      </form>
                    </motion.div>
                  )}

                  {activeTab === 'security' && (
                    <motion.div key="security" initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -8 }} className="flex flex-col gap-5">
                      <h3 className="text-lg font-bold uppercase te-emboss">Access Control</h3>
                      <form onSubmit={handleSecuritySubmit} className="space-y-4">
                        <div>
                          <label className="te-label">NEW ACCESS KEY</label>
                          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className="w-full mt-1 te-inset text-sm font-mono px-3 py-2.5 rounded-lg border-none outline-none focus:ring-1 focus:ring-primary" />
                        </div>
                        <div>
                          <label className="te-label">CONFIRM KEY</label>
                          <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="••••••••" className="w-full mt-1 te-inset text-sm font-mono px-3 py-2.5 rounded-lg border-none outline-none focus:ring-1 focus:ring-primary" />
                        </div>
                        <button type="submit" disabled={savingSecurity} className="w-full py-2.5 te-button-primary text-[10px] font-mono font-bold tracking-widest uppercase rounded-lg disabled:opacity-50 flex items-center justify-center gap-2">
                          {savingSecurity ? <Loader2 size={13} className="animate-spin" /> : 'UPDATE KEY'}
                        </button>
                      </form>
                    </motion.div>
                  )}

                  {activeTab === 'appearance' && (
                    <motion.div key="appearance" initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -8 }} className="flex flex-col gap-6">
                      <h3 className="text-lg font-bold uppercase te-emboss">Display Mode</h3>
                      <div className="grid grid-cols-3 gap-3">
                        {[
                          { id: 'light' as ColorMode, icon: Sun, label: 'LIGHT' },
                          { id: 'dark' as ColorMode, icon: Moon, label: 'DARK' },
                          { id: 'system' as ColorMode, icon: Monitor, label: 'AUTO' },
                        ].map((item) => (
                          <button key={item.id} onClick={() => setMode(item.id)} className={`flex flex-col items-center gap-2 py-4 rounded-xl transition-all ${mode === item.id ? 'te-surface text-primary te-glow' : 'te-inset text-muted-foreground hover:text-foreground'}`}>
                            <item.icon size={18} />
                            <span className="text-[9px] font-mono font-bold tracking-widest">{item.label}</span>
                          </button>
                        ))}
                      </div>
                      <div className="te-inset rounded-lg p-4">
                        <p className="te-label mb-2">ACCENT COLOR</p>
                        <div className="flex items-center gap-3">
                          <span className="w-8 h-8 rounded-full bg-primary border-2 border-[#D04E20] shadow-[0_0_12px_rgba(255,107,53,0.4)]" />
                          <span className="text-xs font-mono font-bold text-foreground uppercase">TE Orange / #FF6B35</span>
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {activeTab === 'preferences' && (
                    <motion.div key="preferences" initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -8 }} className="flex flex-col gap-5">
                      <h3 className="text-lg font-bold uppercase te-emboss">Preferences</h3>
                      <div className="te-inset rounded-lg p-4 flex items-center justify-between opacity-60">
                        <div>
                          <p className="text-xs font-mono font-bold uppercase tracking-wider">Compact Mode</p>
                          <p className="text-[10px] font-mono text-muted-foreground mt-1">Reduce spacing between items</p>
                        </div>
                        <div className="w-12 h-6 te-inset rounded-full p-0.5 cursor-not-allowed">
                          <div className="w-5 h-5 te-button rounded-full" />
                        </div>
                      </div>
                      <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">// More settings coming soon</p>
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="sticky bottom-0 pt-4">
                  <AnimatePresence>
                    {error && (
                      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex items-center gap-2 text-[10px] font-mono font-bold uppercase te-inset text-destructive px-3 py-2 rounded-lg mb-2">
                        <AlertCircle size={12} /> {error}
                      </motion.div>
                    )}
                    {successMsg && (
                      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex items-center gap-2 text-[10px] font-mono font-bold uppercase te-inset text-primary px-3 py-2 rounded-lg">
                        <Check size={12} /> {successMsg}
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

function Field({ label, value, disabled }: { label: string; value: string; disabled?: boolean }) {
  return (
    <div>
      <label className="te-label">{label}</label>
      <input type="text" disabled={disabled} value={value} className="w-full mt-1 te-inset text-sm font-mono font-bold px-3 py-2.5 rounded-lg border-none outline-none opacity-60 cursor-not-allowed uppercase" />
    </div>
  );
}
