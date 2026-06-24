'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Eye, EyeOff, ArrowRight, Radio, BookOpen, CheckSquare, CalendarDays, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/components/auth-provider';

const FEATURES = [
  { icon: BookOpen, label: 'NOTES' },
  { icon: CheckSquare, label: 'TASKS' },
  { icon: CalendarDays, label: 'CALENDAR' },
  { icon: Radio, label: 'ANALYZE' },
];

export default function LoginPage() {
  const router = useRouter();
  const { signInWithGoogle, signInWithGitHub } = useAuth();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess(false);

    if (!email || !password) { setError('Please fill in all fields.'); return; }
    if (mode === 'signup' && !name) { setError('Please enter your name.'); return; }
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return; }

    setLoading(true);
    try {
      if (mode === 'login') {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
        if (signInError) { setError(signInError.message); return; }
      } else {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { name } },
        });
        if (signUpError) { setError(signUpError.message); return; }
        if (data.user && !data.session) {
          setSuccess(true);
          setError('Check your email to confirm registration.');
          return;
        }
      }
      setSuccess(true);
      setTimeout(() => router.push('/'), 600);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An authentication error occurred.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 te-chassis te-grid-bg te-noise">
      <div className="relative z-10 w-full max-w-md">
        {/* Hardware device frame */}
        <div className="te-bezel rounded-2xl overflow-hidden shadow-2xl relative">
          <div className="absolute top-3 left-3 te-screw z-10" />
          <div className="absolute top-3 right-3 te-screw z-10" />
          <div className="absolute bottom-3 left-3 te-screw z-10" />
          <div className="absolute bottom-3 right-3 te-screw z-10" />

          {/* LCD header strip */}
          <div className="te-inset px-6 py-4 border-b border-border flex items-center justify-between">
            <div>
              <p className="te-module-label mb-1">NOTESCAPE SYSTEMS</p>
              <h1 className="font-mono text-sm font-bold tracking-[0.25em] uppercase te-emboss">NS-01</h1>
            </div>
            <div className="te-lcd rounded px-3 py-1.5 text-[10px] font-bold tracking-widest">
              {mode === 'login' ? 'AUTH' : 'REG'}
            </div>
          </div>

          <div className="bg-background p-6 sm:p-8">
            {/* Feature module indicators */}
            <div className="flex justify-center gap-2 mb-6">
              {FEATURES.map(({ icon: Icon, label }) => (
                <div key={label} className="flex flex-col items-center gap-1 te-inset rounded-lg px-3 py-2 min-w-[64px]">
                  <Icon size={14} className="text-primary" />
                  <span className="text-[8px] font-mono font-bold tracking-widest text-muted-foreground">{label}</span>
                </div>
              ))}
            </div>

            {/* Mode rocker switch */}
            <div className="flex te-inset rounded-lg p-1 mb-6 font-mono">
              {(['login', 'signup'] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => { setMode(tab); setError(''); }}
                  className={`flex-1 py-2 text-[10px] font-bold tracking-widest uppercase rounded-md transition-all ${
                    mode === tab ? 'te-surface text-primary' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {tab === 'login' ? 'SIGN IN' : 'REGISTER'}
                </button>
              ))}
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <AnimatePresence mode="wait">
                {mode === 'signup' && (
                  <motion.div
                    key="name-field"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                  >
                    <InputField label="OPERATOR NAME" type="text" value={name} onChange={setName} placeholder="ADA LOVELACE" autoComplete="name" />
                  </motion.div>
                )}
              </AnimatePresence>

              <InputField label="EMAIL ADDRESS" type="email" value={email} onChange={setEmail} placeholder="name@example.com" autoComplete="email" />
              <div className="relative">
                <InputField label="ACCESS KEY" type={showPass ? 'text' : 'password'} value={password} onChange={setPassword} placeholder="••••••••" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} />
                <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-3 top-[30px] te-button p-1 rounded text-muted-foreground">
                  {showPass ? <EyeOff size={13} /> : <Eye size={13} />}
                </button>
              </div>

              {mode === 'login' && (
                <div className="text-right">
                  <button type="button" className="text-[10px] font-mono font-bold tracking-widest text-muted-foreground hover:text-primary uppercase transition-colors">
                    Reset Key
                  </button>
                </div>
              )}

              <AnimatePresence>
                {error && (
                  <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-[10px] font-mono font-bold uppercase te-inset text-destructive px-3 py-2 rounded-lg border-destructive/30">
                    // {error}
                  </motion.p>
                )}
              </AnimatePresence>

              <button
                type="submit"
                disabled={loading || success}
                className="w-full py-3 te-button-primary text-[11px] font-mono font-bold tracking-widest uppercase rounded-lg flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {loading ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : success ? (
                  'ACCESS GRANTED'
                ) : (
                  <>
                    {mode === 'login' ? 'INITIATE SESSION' : 'CREATE ACCOUNT'}
                    <ArrowRight size={13} />
                  </>
                )}
              </button>
            </form>

            <div className="mt-6 pt-4 border-t border-border te-divider">
              <p className="text-[9px] font-mono text-muted-foreground text-center leading-relaxed uppercase tracking-wider">
                By proceeding you agree to Terms of Service and Privacy Policy
              </p>
            </div>
          </div>

          {/* Bottom status bar */}
          <div className="te-inset px-6 py-2 flex items-center justify-between border-t border-border">
            <span className="te-module-label">REV 1.0</span>
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full te-led te-led-on" />
              <span className="text-[9px] font-mono font-bold text-muted-foreground tracking-widest">READY</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function InputField({
  label, type, value, onChange, placeholder, autoComplete,
}: {
  label: string; type: string; value: string; onChange: (v: string) => void;
  placeholder: string; autoComplete?: string;
}) {
  return (
    <div className="space-y-1.5 w-full">
      <label className="te-label">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        className="w-full te-inset text-sm font-mono font-bold text-foreground px-3 py-2.5 rounded-lg border-none outline-none placeholder:text-muted-foreground/40 focus:ring-1 focus:ring-primary uppercase"
      />
    </div>
  );
}
