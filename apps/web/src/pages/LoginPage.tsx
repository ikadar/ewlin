import { useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppDispatch } from '../store';
import { setCredentials } from '../store/slices/authSlice';
import { useLoginMutation } from '../store/api/authApi';
import { getErrorMessage } from '../store/api/errorNormalization';

/**
 * Login page — dark-themed, centered card.
 * Rendered outside RootLayout (no sidebar/nav).
 */
export function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const [login, { isLoading }] = useLoginMutation();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setErrorMsg('');

    try {
      const result = await login({ email, password }).unwrap();
      dispatch(setCredentials(result));
      navigate('/flux', { replace: true });
    } catch (err) {
      setErrorMsg(getErrorMessage(err));
    }
  }

  return (
    <div className="min-h-screen bg-flux-base flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-semibold text-flux-text-primary">Flux Scheduler</h1>
          <p className="text-sm text-flux-text-muted mt-1">Connectez-vous pour continuer</p>
        </div>

        {/* Card */}
        <form
          onSubmit={handleSubmit}
          className="bg-flux-surface border border-flux-border rounded-xl p-6 space-y-4"
        >
          {/* Error message */}
          {errorMsg && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2 text-sm text-red-400">
              {errorMsg}
            </div>
          )}

          {/* Email */}
          <div>
            <label htmlFor="email" className="block text-sm text-flux-text-secondary mb-1">
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-flux-elevated border border-flux-border rounded-lg px-3 py-2 text-sm text-flux-text-primary placeholder:text-flux-text-muted focus:outline-none focus:ring-2 focus:ring-white/20 focus:border-transparent"
              placeholder="user@example.com"
            />
          </div>

          {/* Password */}
          <div>
            <label htmlFor="password" className="block text-sm text-flux-text-secondary mb-1">
              Mot de passe
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-flux-elevated border border-flux-border rounded-lg px-3 py-2 text-sm text-flux-text-primary placeholder:text-flux-text-muted focus:outline-none focus:ring-2 focus:ring-white/20 focus:border-transparent"
              placeholder="••••••••"
            />
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-white/10 hover:bg-white/15 disabled:opacity-50 disabled:cursor-not-allowed text-flux-text-primary text-sm font-medium rounded-lg px-4 py-2.5 transition-colors focus:outline-none focus:ring-2 focus:ring-white/20"
          >
            {isLoading ? 'Connexion…' : 'Se connecter'}
          </button>
        </form>
      </div>
    </div>
  );
}
