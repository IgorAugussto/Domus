// src/App.tsx
import { Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";

import { DashboardPage } from "./components/DashboardPage";
import ExpensesPage from "./components/ExpensesPage";
import IncomePage from "./components/IncomePage";
import InvestmentsPage from "./components/InvestmentsPage";
import LoginPage from "./components/LoginPage";
import PrivateLayout from "./layouts/PrivateLayout";
import { Payments } from "./components/Payments";
import { CreditCardsPage } from "./components/CreditCardsPage";
import { StatementReconciliationPage } from "./components/StatementReconciliationPage";
import { NotificationReviewPage } from "./components/NotificationReviewPage";



// === APP PRINCIPAL ===
export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/" element={<Navigate to="/login" />} />
        <Route path="/login" element={<LoginPage />} />

        {/* ROTAS PROTEGIDAS COM NAVEGAÇÃO */}
        <Route element={<PrivateLayout />}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/income" element={<IncomePage />} />
          <Route path="/expenses" element={<ExpensesPage />} />
          <Route path="/investments" element={<InvestmentsPage />} />
          <Route path="/payments" element={<Payments />} />
          <Route path="/cards" element={<CreditCardsPage />} />
          <Route path="/statements" element={<StatementReconciliationPage />} />
          <Route path="/review" element={<NotificationReviewPage />} />
        </Route>
      </Routes>
    </AuthProvider>
  );
}
