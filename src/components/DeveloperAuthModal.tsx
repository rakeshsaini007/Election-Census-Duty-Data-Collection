import React, { useState } from 'react';
import { Lock, ShieldCheck, X } from 'lucide-react';
import { DEVELOPER_ADMIN_EMAIL } from '../config/gasConfig';
import { verifyDeveloperCredentials } from '../services/gasApi';

interface DeveloperAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAuthenticated: (email: string, passcode: string, sheetUrl: string) => void;
}

export const DeveloperAuthModal: React.FC<DeveloperAuthModalProps> = ({
  isOpen,
  onClose,
  onAuthenticated,
}) => {
  const [email, setEmail] = useState(DEVELOPER_ADMIN_EMAIL);
  const [passcode, setPasscode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (email.trim().toLowerCase() !== DEVELOPER_ADMIN_EMAIL.toLowerCase()) {
      setError(`Access Denied: Only App Developer (${DEVELOPER_ADMIN_EMAIL}) is authorized.`);
      return;
    }
    setLoading(true);
    try {
      const result = await verifyDeveloperCredentials(email, passcode);
      if (!result.success) {
        setError(result.error || 'Authentication failed.');
      } else {
        onAuthenticated(email.trim(), passcode.trim(), result.sheetUrl);
        setPasscode('');
        onClose();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to verify credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="dev-auth-title"
    >
      <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-800">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <h2 id="dev-auth-title" className="text-base font-semibold text-slate-900">
                App Developer Access
              </h2>
              <p className="text-xs text-slate-500">
                Restricted role authentication for Google Sheet controls
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
            aria-label="Close authentication modal"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs font-medium text-red-700">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="dev-email" className="block text-xs font-medium text-slate-700">
              Developer Email
            </label>
            <input
              id="dev-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={DEVELOPER_ADMIN_EMAIL}
              className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-700/15"
            />
          </div>

          <div>
            <label htmlFor="dev-passcode" className="block text-xs font-medium text-slate-700">
              Admin Passcode
            </label>
            <div className="relative mt-1.5">
              <input
                id="dev-passcode"
                type="password"
                required
                value={passcode}
                onChange={(e) => setPasscode(e.target.value)}
                placeholder="Enter App Developer passcode"
                className="w-full rounded-lg border border-slate-300 bg-white py-2 pr-3 pl-9 font-mono text-sm text-slate-900 focus:border-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-700/15"
              />
              <Lock className="pointer-events-none absolute top-2.5 left-3 h-4 w-4 text-slate-400" />
            </div>
            <p className="mt-1.5 text-xs text-slate-500">
              Only authorized App Developer credentials configured in{' '}
              <span className="font-mono text-slate-700">code.js</span> can unlock Google Sheet access.
            </p>
          </div>

          <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 whitespace-nowrap shrink-0"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="rounded-lg bg-blue-900 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-blue-800 disabled:opacity-60 whitespace-nowrap shrink-0"
            >
              {loading ? 'Verifying...' : 'Unlock Admin Access'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
