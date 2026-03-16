import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';

// --- Auth & Roles ---
import { useAuth } from './contexts/AuthContext';
import { useRole } from './contexts/RoleContext';
import LoginPage from './components/auth/LoginPage';

// --- Layout & Error Handling ---
import AppLayout from './components/layout/AppLayout';
import ReportsLayout from './components/layout/ReportsLayout';
import ErrorBoundary from './components/ErrorBoundary';

// --- Pages ---
import Dashboard from './pages/Dashboard';
import MyWork from './pages/MyWork';
import BomProjects from './pages/BomProjects';
import BomProjectDetail from './pages/BomProjectDetail';
import Catalog from './pages/Catalog';
import TaskManager from './pages/TaskManager';
import MainTable from './pages/MainTable';
import Projects from './pages/Projects';
import WorkLogs from './pages/WorkLogs';
import DailyReports from './pages/DailyReports';
import WeeklyReports from './pages/WeeklyReports';
import EngineeringAnalytics from './pages/EngineeringAnalytics';
import WeeklyPlanner from './pages/WeeklyPlanner';
import ProjectGantt from './pages/ProjectGantt';
import Team from './pages/Team';
import Notifications from './pages/Notifications';
import SettingsPage from './pages/Settings';
import AuditFindings from './pages/AuditFindings';
import ControlTower from './pages/ControlTower';
import ManagedListsPage from './pages/ManagedListsPage';
import AutomationControlCenter from './pages/AutomationControlCenter';


// ========================================================
// APLICACIÓN PRINCIPAL
// ========================================================

export default function App() {
  const { user, loading: authLoading } = useAuth();
  const { roleLoading } = useRole();

  // --- Loading State ---
  if (authLoading || (user && roleLoading)) {
    return (
      <div className="h-screen flex items-center justify-center bg-slate-900">
        <div className="text-center space-y-4">
          <Loader2 className="w-10 h-10 text-indigo-500 animate-spin mx-auto" />
          <p className="text-sm text-slate-400 font-bold animate-pulse">
            Cargando AutoBOM Pro...
          </p>
        </div>
      </div>
    );
  }

  // --- Auth Gate ---
  if (!user) {
    return <LoginPage />;
  }

  // --- Authenticated App ---
  return (
    <ErrorBoundary module="App">
      <Routes>
        <Route element={<AppLayout />}>
          {/* Main */}
          <Route path="/" element={<ErrorBoundary module="Dashboard"><Dashboard /></ErrorBoundary>} />
          <Route path="/my-work" element={<ErrorBoundary module="Mi Trabajo"><MyWork /></ErrorBoundary>} />

          {/* AutoBOM */}
          <Route path="/bom/projects" element={<ErrorBoundary module="BOM Proyectos"><BomProjects /></ErrorBoundary>} />
          <Route path="/bom/projects/:projectId" element={<ErrorBoundary module="BOM Detalle"><BomProjectDetail /></ErrorBoundary>} />
          <Route path="/catalog" element={<ErrorBoundary module="Catálogo"><Catalog /></ErrorBoundary>} />

          {/* Engineering */}
          <Route path="/projects" element={<ErrorBoundary module="Proyectos"><Projects /></ErrorBoundary>} />
          <Route path="/tasks" element={<ErrorBoundary module="Tareas"><TaskManager /></ErrorBoundary>} />
          <Route path="/main-table" element={<ErrorBoundary module="Tabla Principal"><MainTable /></ErrorBoundary>} />

          {/* Reports & Analytics — shared layout with tabs */}
          <Route element={<ReportsLayout />}>
            <Route path="/work-logs" element={<ErrorBoundary module="Bitácora"><WorkLogs /></ErrorBoundary>} />
            <Route path="/reports/daily" element={<ErrorBoundary module="Reportes Diarios"><DailyReports /></ErrorBoundary>} />
            <Route path="/reports/weekly" element={<ErrorBoundary module="Reportes Semanales"><WeeklyReports /></ErrorBoundary>} />
            <Route path="/analytics" element={<ErrorBoundary module="Analítica"><EngineeringAnalytics /></ErrorBoundary>} />
          </Route>
          <Route path="/audit" element={<ErrorBoundary module="Auditoría"><AuditFindings /></ErrorBoundary>} />
          <Route path="/control-tower" element={<ErrorBoundary module="Control Tower"><ControlTower /></ErrorBoundary>} />
          <Route path="/planner" element={<ErrorBoundary module="Planner Semanal"><WeeklyPlanner /></ErrorBoundary>} />
          <Route path="/gantt" element={<ErrorBoundary module="Gantt"><ProjectGantt /></ErrorBoundary>} />

          {/* Team */}
          <Route path="/team" element={<ErrorBoundary module="Equipo"><Team /></ErrorBoundary>} />
          <Route path="/notifications" element={<ErrorBoundary module="Notificaciones"><Notifications /></ErrorBoundary>} />
          <Route path="/listas" element={<ErrorBoundary module="Listas"><ManagedListsPage /></ErrorBoundary>} />

          {/* Admin */}
          <Route path="/automation" element={<ErrorBoundary module="Automatización"><AutomationControlCenter /></ErrorBoundary>} />
          <Route path="/settings" element={<ErrorBoundary module="Configuración"><SettingsPage /></ErrorBoundary>} />

          {/* Catch-all redirect */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </ErrorBoundary>
  );
}

