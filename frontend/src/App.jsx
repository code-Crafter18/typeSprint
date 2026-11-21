import React, { Suspense, lazy, useEffect, useState } from "react";
import { Navigate, Routes, Route, useSearchParams } from "react-router-dom";
import { TypingTest } from "./TypingTest";
import { apiRequest } from "./api.js";

const ResultPage = lazy(() => import("./ResultPage"));
const HistoryPage = lazy(() => import("./HistoryPage"));
const SignInPage = lazy(() => import("./SignInPage"));

function PreviousSignInRoute() {
  const [search] = useSearchParams();
  const next = new URLSearchParams(search);
  const pathname = next.get("mode") === "register" ? "/signup" : "/login";
  next.delete("mode");
  return <Navigate replace to={{ pathname, search: next.toString() }} />;
}

function RouteFallback() {
  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: "#9ca3af" }}>
      Loading sprint...
    </div>
  );
}

export function App() {
  const [results, setResults] = useState(null);
  const [session, setSession] = useState({ loading: true });
  const [sessionRevision, setSessionRevision] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    apiRequest("/api/auth/session", { signal: controller.signal })
      .then(({ user }) => {
        if (!controller.signal.aborted) setSession({ user });
      })
      .catch(() => {
        if (!controller.signal.aborted) setSession({ unavailable: true });
      });
    return () => controller.abort();
  }, [sessionRevision]);

  const auth = {
    ...session,
    reload() {
      setSession({ loading: true });
      setSessionRevision((value) => value + 1);
    },
    async authenticate({ username, password }, creating) {
      const { user } = await apiRequest(creating ? "/api/auth/register" : "/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      setSession((current) => ({ ...current, user, unavailable: false }));
    },
    async signOut() {
      await apiRequest("/api/auth/logout", { method: "POST" });
      setSession((current) => ({ ...current, user: null }));
      setResults(null);
    },
  };

  return (
    <Suspense fallback={<RouteFallback />}>
      <Routes>
        <Route index element={<TypingTest auth={auth} onResult={setResults} />} />
        <Route path="/results" element={<ResultPage results={results} auth={auth} />} />
        <Route path="/history" element={<HistoryPage auth={auth} />} />
        <Route path="/login" element={<SignInPage auth={auth} />} />
        <Route path="/signup" element={<SignInPage auth={auth} creating />} />
        <Route path="/sign-in" element={<PreviousSignInRoute />} />
      </Routes>
    </Suspense>
  );
}

export default App;
