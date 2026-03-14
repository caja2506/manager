import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';

// --- Auth & Roles ---
import { useAuth } from './contexts/AuthContext';
import { useRole } from './contexts/RoleContext';
import LoginPage from './components/auth/LoginPage';

// --- Layout ---
import AppLayout from './components/layout/AppLayout';

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
    <Routes>
      <Route element={<AppLayout />}>
        {/* Main */}
        <Route path="/" element={<Dashboard />} />
        <Route path="/my-work" element={<MyWork />} />

        {/* AutoBOM */}
        <Route path="/bom/projects" element={<BomProjects />} />
        <Route path="/bom/projects/:projectId" element={<BomProjectDetail />} />
        <Route path="/catalog" element={<Catalog />} />

        {/* Engineering */}
        <Route path="/projects" element={<Projects />} />
        <Route path="/tasks" element={<TaskManager />} />
        <Route path="/main-table" element={<MainTable />} />
        <Route path="/work-logs" element={<WorkLogs />} />
        <Route path="/reports/daily" element={<DailyReports />} />
        <Route path="/reports/weekly" element={<WeeklyReports />} />
        <Route path="/analytics" element={<EngineeringAnalytics />} />
        <Route path="/audit" element={<AuditFindings />} />
        <Route path="/control-tower" element={<ControlTower />} />
        <Route path="/planner" element={<WeeklyPlanner />} />
        <Route path="/gantt" element={<ProjectGantt />} />

        {/* Team */}
        <Route path="/team" element={<Team />} />
        <Route path="/notifications" element={<Notifications />} />
        <Route path="/listas" element={<ManagedListsPage />} />

        {/* Admin */}
        <Route path="/settings" element={<SettingsPage />} />

        {/* Catch-all redirect */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
