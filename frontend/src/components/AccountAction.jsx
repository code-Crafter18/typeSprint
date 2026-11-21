import React, { useState } from "react";
import { Link } from "react-router-dom";

export function AccountAction({ auth, returnTo = "/" }) {
  const [signingOut, setSigningOut] = useState(false);
  const [signOutFailed, setSignOutFailed] = useState(false);

  const signOut = async () => {
    setSigningOut(true);
    setSignOutFailed(false);
    try {
      await auth.signOut();
    } catch {
      setSignOutFailed(true);
    } finally {
      setSigningOut(false);
    }
  };

  if (auth.user) {
    return (
      <div className="account-action">
        <button type="button" className="account-button" title={auth.user.displayName}
          disabled={signingOut} onClick={signOut}>
          {signingOut ? "Signing out…" : "Sign out"}
        </button>
        {signOutFailed && <small role="alert">Sign-out failed. Try again.</small>}
      </div>
    );
  }

  const to = returnTo === "/history" ? "/login?returnTo=%2Fhistory" : "/login";
  return <Link className="account-button sign-in-button" to={to}>Log in</Link>;
}
