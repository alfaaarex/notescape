'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Eye, EyeOff, ArrowRight, Sparkles, BookOpen, CheckSquare, CalendarDays, Loader2, GitBranch } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/components/auth-provider';

const FEATURES = [
  { icon: BookOpen, label: 'Beautiful notes' },
  { icon: CheckSquare, label: 'Smart tasks' },
  { icon: CalendarDays, label: 'Visual calendar' },
  { icon: Sparkles, label: 'AI summaries' },
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
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (signInError) {
          setError(signInError.message);
          return;
        }
      } else {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              name: name,
            },
          },
        });
        if (signUpError) {
          setError(signUpError.message);
          return;
        }
        // If email confirmation is enabled, we notify the user.
        if (data.user && !data.session) {
          setSuccess(true);
          setError('Check your email to confirm registration.');
          return;
        }
      }

      setSuccess(true);
      setTimeout(() => router.push('/'), 600);
    } catch (err: any) {
      setError(err.message || 'An authentication error occurred.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-zinc-950 text-zinc-50 flex items-center justify-center p-4 antialiased selection:bg-zinc-800">

      {/* Precision Flat Technical Grid Background */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.015] [mask-image:radial-gradient(ellipse_at_center,black,transparent_80%)]"
        style={{
          backgroundImage: 'linear-gradient(to right, #fff 1px, transparent 1px), linear-gradient(to bottom, #fff 1px, transparent 1px)',
          backgroundSize: '24px 24px'
        }}
      />

      <div className="relative z-10 w-full max-w-sm flex flex-col gap-6">

        {/* Header Block */}
        <div className="flex flex-col items-center text-center">
          <div className="w-9 h-9 rounded-md border border-zinc-800 bg-zinc-900 flex items-center justify-center mb-3">
            <Sparkles size={16} className="text-zinc-400" />
          </div>
          <h1 className="text-xl font-medium text-zinc-100 tracking-tight">Notescape</h1>
          <p className="text-xs text-zinc-500 mt-1">Enter your details to access your workspace</p>
        </div>

        {/* Feature Tags - Minimalist Pill Indicators */}
        <div className="flex flex-wrap justify-center gap-1.5">
          {FEATURES.map(({ icon: Icon, label }) => (
            <div
              key={label}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-zinc-900/50 border border-zinc-900 text-zinc-400"
            >
              <Icon size={12} className="text-zinc-500" />
              <span className="text-[11px] font-medium tracking-wide">{label}</span>
            </div>
          ))}
        </div>

        {/* Form Enclosure Container */}
        <div className="bg-zinc-900/30 border border-zinc-800 rounded-lg p-6 backdrop-blur-sm">

          {/* Flat Segmented Tab Controls */}
          <div className="grid grid-cols-2 p-1 bg-zinc-950 border border-zinc-900 rounded-md mb-5 relative">
            {(['login', 'signup'] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => { setMode(tab); setError(''); }}
                className={`z-10 py-1.5 text-xs font-medium transition-colors rounded-sm relative ${mode === tab ? 'text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'
                  }`}
              >
                {tab === 'login' ? 'Sign In' : 'Create Account'}
                {mode === tab && (
                  <motion.div
                    layoutId="flat-tab-indicator"
                    className="absolute inset-0 bg-zinc-900 border border-zinc-800 rounded-sm -z-10"
                    transition={{ type: "spring", stiffness: 380, damping: 30 }}
                  />
                )}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <AnimatePresence mode="wait">
              {mode === 'signup' && (
                <motion.div
                  key="name-field"
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.15 }}
                >
                  <InputField
                    label="Full Name"
                    type="text"
                    value={name}
                    onChange={setName}
                    placeholder="Ada Lovelace"
                    autoComplete="name"
                  />
                </motion.div>
              )}
            </AnimatePresence>

            <InputField
              label="Email Address"
              type="email"
              value={email}
              onChange={setEmail}
              placeholder="name@example.com"
              autoComplete="email"
            />

            <div className="space-y-1.5 relative">
              <InputField
                label="Password"
                type={showPass ? 'text' : 'password'}
                value={password}
                onChange={setPassword}
                placeholder="••••••••"
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              />
              <button
                type="button"
                onClick={() => setShowPass(!showPass)}
                className="absolute right-3 top-[29px] text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>

            {mode === 'login' && (
              <div className="text-right">
                <button type="button" className="text-[11px] text-zinc-400 hover:text-zinc-200 transition-colors">
                  Forgot password?
                </button>
              </div>
            )}

            {/* Error Framework Panel */}
            <AnimatePresence>
              {error && (
                <motion.p
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  className="text-xs text-red-400 bg-red-950/20 border border-red-900/50 rounded-md px-3 py-2"
                >
                  {error}
                </motion.p>
              )}
            </AnimatePresence>

            {/* Flat Solid Interactive CTA Action Button */}
            <button
              type="submit"
              disabled={loading || success}
              className="w-full h-9 rounded-md bg-zinc-50 text-zinc-950 font-medium text-xs flex items-center justify-center gap-2 hover:bg-zinc-200 active:scale-[0.99] disabled:opacity-50 transition-all"
            >
              {loading ? (
                <Loader2 size={14} className="animate-spin" />
              ) : success ? (
                <span>Success</span>
              ) : (
                <span className="flex items-center gap-1.5">
                  {mode === 'login' ? 'Continue' : 'Register'}
                  <ArrowRight size={13} />
                </span>
              )}
            </button>

            {/* Structural Rule Divider */}
            <div className="flex items-center gap-3 py-1">
              <div className="flex-1 h-[1px] bg-zinc-900" />
              <span className="text-[10px] uppercase tracking-wider text-zinc-600 font-medium">Or platform sign in</span>
              <div className="flex-1 h-[1px] bg-zinc-900" />
            </div>

            {/* Secondary Identity Providers */}
            <div className="grid grid-cols-2 gap-2">
              {/* Google Button */}
              <button
                type="button"
                onClick={signInWithGoogle}
                className="group relative flex items-center justify-center gap-2 h-9 rounded-md bg-zinc-950 border border-zinc-900 text-xs font-medium text-zinc-300 hover:bg-zinc-900/60 active:scale-[0.98] transition-all"
              >
                <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335" />
                </svg>
                <span>Google</span>
              </button>

              {/* GitHub Button */}
              <button
                type="button"
                onClick={signInWithGitHub}
                className="group relative flex items-center justify-center gap-2 h-9 rounded-md bg-zinc-950 border border-zinc-900 text-xs font-medium text-zinc-300 hover:bg-zinc-900/60 active:scale-[0.98] transition-all"
              >
                <GitBranch size={14} className="text-zinc-400 group-hover:rotate-12 transition-transform duration-200" />
                <span>GitHub</span>
              </button>
            </div>
          </form>

          {/* Institutional Privacy Terms Block */}
          <div className="mt-5 pt-4 border-t border-zinc-900 text-center">
            <p className="text-[10px] text-zinc-600 leading-relaxed">
              By proceeding, you agree to our{' '}
              <button className="text-zinc-500 hover:text-zinc-400 underline underline-offset-2">Terms of Service</button>
              {' '}and{' '}
              <button className="text-zinc-500 hover:text-zinc-400 underline underline-offset-2">Privacy Policy</button>.
            </p>
          </div>
        </div>

        {/* Footer Identity */}
        <p className="text-center text-[10px] text-zinc-600 tracking-wider font-mono">
          NOTESCAPE SYSTEMS // 2026
        </p>
      </div>
    </div>
  );
}

function InputField({
  label,
  type,
  value,
  onChange,
  placeholder,
  autoComplete,
}: {
  label: string;
  type: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  autoComplete?: string;
}) {
  return (
    <div className="space-y-1.5 w-full">
      <label className="block text-[10px] font-medium text-zinc-500 uppercase tracking-wider">
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        className="w-full h-9 bg-zinc-950 text-zinc-100 text-xs px-3 rounded-md border border-zinc-900 placeholder:text-zinc-700 outline-none focus:border-zinc-700 focus:ring-0 transition-colors duration-150"
      />
    </div>
  );
}