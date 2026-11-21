import React, { useState } from "react";
import { Link, Navigate, useSearchParams } from "react-router-dom";
import "./SignInPage.css";

function CredentialsForm({ auth, creating }) {
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function submit(event) {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    setError("");
    setSubmitting(true);
    try {
      await auth.authenticate({
        username: fields.get("username"),
        password: fields.get("password"),
      }, creating);
    } catch (problem) {
      setError(problem.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="credentials-form" method="post" onSubmit={submit}>
      <label htmlFor="account-username">Username</label>
      <input id="account-username" name="username" autoComplete="username" autoCapitalize="none"
        spellCheck={false} required maxLength={24} />

      <label htmlFor="account-password">Password</label>
      <div className="password-field">
        <input id="account-password" type={showPassword ? "text" : "password"} name="password"
          autoComplete={creating ? "new-password" : "current-password"} required
        />
        <button type="button" className="password-visibility" aria-controls="account-password" aria-label={showPassword ? "Hide password" : "Show password"}
          onClick={() => setShowPassword(!showPassword)}>
          {showPassword ? "Hide" : "Show"}
        </button>
      </div>
      {error && <p className="sign-in-error" role="alert">{error}</p>}
      <button className="credentials-submit" type="submit" disabled={auth.loading || submitting}>
        {submitting ? (creating ? "Creating account…" : "Logging in…") : (creating ? "Create account" : "Log in")}
      </button>
    </form>
  );
}

export default function SignInPage({ auth, creating = false }) {
  const [search] = useSearchParams();
  const returnTo = search.get("returnTo") === "/history" ? "/history" : "/";
  if (auth.user) return <Navigate to={returnTo} replace />;

  const returnQuery = returnTo === "/history" ? "?returnTo=%2Fhistory" : "";
  return (
    <main className="sign-in-page">
      <section className="sign-in-card" aria-labelledby="account-heading">
        <h1 id="account-heading">{creating ? "Create an account" : "Log in"}</h1>
        <CredentialsForm key={String(creating)} auth={auth} creating={creating} />
        <p className="account-switch">
          {creating ? "Already have an account?" : "Don't have an account?"}{" "}
          <Link to={(creating ? "/login" : "/signup") + returnQuery}>{creating ? "Log in" : "Sign up"}</Link>
        </p>
        <Link className="guest-return" to="/">Continue as guest</Link>
      </section>
    </main>
  );
}
