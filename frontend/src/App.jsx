import React from "react";
import { Routes, Route } from "react-router-dom";
import { TypingTest } from "./TypingTest";
import { ResultPage } from "./ResultPage";
import { HistoryPage } from "./HistoryPage";

export function App() {
  return (
    <Routes>
      <Route index element={<TypingTest />} />
      <Route path="/results" element={<ResultPage />} />
      <Route path="/history" element={<HistoryPage />} />
    </Routes>
  );
}

export default App;
