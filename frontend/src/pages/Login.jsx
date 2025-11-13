import React, { useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

export default function Login() {
  const { login, isAuthed, loading } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const from = location.state?.from?.pathname || "/";
  const [form, setForm] = useState({ email: "", password: "" });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  if (isAuthed && !loading) {
    return <Navigate to={from} replace />;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      await login({ email: form.email, password: form.password });
      navigate(from, { replace: true });
    } catch (err) {
      setError(err?.message || "Unable to login");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-ink text-white text-2xl">
            📁
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Sign in to CAD Vault</h1>
            <p className="text-sm text-slate-500">Use your workspace credentials to continue.</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow p-6 space-y-5">
          <div>
            <label htmlFor="email" className="text-sm font-medium text-slate-600">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              className="input mt-1 w-full"
              value={form.email}
              onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
            />
          </div>
          <div>
            <label htmlFor="password" className="text-sm font-medium text-slate-600">
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              className="input mt-1 w-full"
              value={form.password}
              onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
            />
          </div>
          {error && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {error}
            </div>
          )}
          <button type="submit" className="btn btn-primary w-full" disabled={submitting}>
            {submitting ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <p className="text-center text-xs text-slate-500">
          Need help? Contact your administrator.
        </p>
      </div>
    </div>
  );
}
