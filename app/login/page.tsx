'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Eye, EyeOff, ArrowRight, Sparkles, BookOpen, CheckSquare, CalendarDays, Loader2 } from 'lucide-react';
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
  // TODO: Implement social login buttons
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
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An authentication error occurred.';
      setError(message);
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