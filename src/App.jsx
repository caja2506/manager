import React, { useState, useCallback } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import SplashScreen from './components/brand/SplashScreen';
import AnalyzeOpsLogo from './components/brand/AnalyzeOpsLogo';

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
import TaskActivityPage from './pages/TaskActivityPage';
import WeeklyPlanner from './pages/WeeklyPlanner';
import ProjectGantt from './pages/ProjectGantt';
import Team from './pages/Team';
import Notifications from './pages/Notifications';
import SettingsPage from './pages/Settings';
import AuditFindings from './pages/AuditFindings';
import ControlTower from './pages/ControlTower';
import ManagedListsPage from './pages/ManagedListsPage';
import AutomationControlCenter from './pages/AutomationControlCenter';
import MilestoneDetailPage from './pages/MilestoneDetailPage';
import MilestoneHistoryPage from './pages/MilestoneHistoryPage';
import AIMonitoringPage from './pages/AIMonitoringPage';
import ProjectDetailPage from './pages/ProjectDetailPage';
import DailyScrumPage from './pages/DailyScrumPage';
import PlatformOverview from './pages/PlatformOverview';
import DailyBriefing from './pages/DailyBriefing';
import DataFlowPage from './pages/DataFlowPage';


// ========================================================
// APLICACIÓN PRINCIPAL
// ========================================================

export default function App() {
  const { user, loading: authLoading } = useAuth();
  const { roleLoading } = useRole();

  // --- Splash Screen (once per session) ---
  const [splashDone, setSplashDone] = useState(() => {
    return sessionStorage.getItem('analyzeops-splash-done') === 'true';
  });
  const handleSplashComplete = useCallback(() => {
    sessionStorage.setItem('analyzeops-splash-done', 'true');
    setSplashDone(true);
  }, []);

  // Show splash on first session load
  if (!splashDone) {
    return <SplashScreen onComplete={handleSplashComplete} />;
  }

  // --- Loading State ---
  if (authLoading || (user && roleLoading)) {
    return (
      <div className="h-screen flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #0c0a1a 0%, #1a1035 35%, #0f172a 70%, #0c0a1a 100%)' }}>
        <div className="text-center space-y-4">
          <div className="flex justify-center mb-2">
            <AnalyzeOpsLogo size={48} animate />
          </div>
          <Loader2 className="w-8 h-8 animate-spin mx-auto" style={{ color: '#6B3FA0' }} />
          <p className="text-sm font-bold animate-pulse" style={{ color: '#C4956A' }}>
            Cargando AnalyzeOps...
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
          <Route path="/overview" element={<ErrorBoundary module="Cómo Funciona"><PlatformOverview /></ErrorBoundary>} />
          <Route path="/daily-briefing" element={<ErrorBoundary module="Daily Briefing"><DailyBriefing /></ErrorBoundary>} />

          {/* AutoBOM */}
          <Route path="/bom/projects" element={<ErrorBoundary module="BOM Proyectos"><BomProjects /></ErrorBoundary>} />
          <Route path="/bom/projects/:projectId" element={<ErrorBoundary module="BOM Detalle"><BomProjectDetail /></ErrorBoundary>} />
          <Route path="/catalog" element={<ErrorBoundary module="Catálogo"><Catalog /></ErrorBoundary>} />

          {/* Engineering */}
          <Route path="/projects" element={<ErrorBoundary module="Proyectos"><Projects /></ErrorBoundary>} />
          <Route path="/projects/:projectId" element={<ErrorBoundary module="Proyecto Detalle"><ProjectDetailPage /></ErrorBoundary>} />
          <Route path="/tasks" element={<ErrorBoundary module="Tareas"><TaskManager /></ErrorBoundary>} />
          <Route path="/main-table" element={<ErrorBoundary module="Tabla Principal"><MainTable /></ErrorBoundary>} />

          {/* Milestones — project-scoped routes (primary) */}
          <Route path="/projects/:projectId/milestones/:milestoneId" element={<ErrorBoundary module="Milestone Detalle"><MilestoneDetailPage /></ErrorBoundary>} />
          <Route path="/projects/:projectId/milestones/:milestoneId/history" element={<ErrorBoundary module="Milestone Historial"><MilestoneHistoryPage /></ErrorBoundary>} />
          <Route path="/projects/:projectId/milestones/:milestoneId/ai-monitoring" element={<ErrorBoundary module="AI Monitoring"><AIMonitoringPage /></ErrorBoundary>} />

          {/* Milestones — standalone routes (backward compat) */}
          <Route path="/milestones/:milestoneId" element={<ErrorBoundary module="Milestone Detalle"><MilestoneDetailPage /></ErrorBoundary>} />
          <Route path="/milestones/:milestoneId/history" element={<ErrorBoundary module="Milestone Historial"><MilestoneHistoryPage /></ErrorBoundary>} />
          <Route path="/milestones/:milestoneId/ai-monitoring" element={<ErrorBoundary module="AI Monitoring"><AIMonitoringPage /></ErrorBoundary>} />

          {/* Reports & Analytics — shared layout with tabs */}
          <Route element={<ReportsLayout />}>
            <Route path="/work-logs" element={<ErrorBoundary module="Bitácora"><WorkLogs /></ErrorBoundary>} />
            <Route path="/reports/daily" element={<ErrorBoundary module="Reportes Diarios"><DailyReports /></ErrorBoundary>} />
            <Route path="/reports/weekly" element={<ErrorBoundary module="Reportes Semanales"><WeeklyReports /></ErrorBoundary>} />
            <Route path="/analytics" element={<ErrorBoundary module="Analítica"><EngineeringAnalytics /></ErrorBoundary>} />
            <Route path="/reports/activity" element={<ErrorBoundary module="Actividad"><TaskActivityPage /></ErrorBoundary>} />
          </Route>
          <Route path="/audit" element={<ErrorBoundary module="Auditoría"><AuditFindings /></ErrorBoundary>} />
          <Route path="/control-tower" element={<ErrorBoundary module="Control Tower"><ControlTower /></ErrorBoundary>} />
          <Route path="/planner" element={<ErrorBoundary module="Planner Semanal"><WeeklyPlanner /></ErrorBoundary>} />
          <Route path="/gantt" element={<ErrorBoundary module="Gantt"><ProjectGantt /></ErrorBoundary>} />
          <Route path="/daily-scrum" element={<ErrorBoundary module="Equipo Hoy"><DailyScrumPage /></ErrorBoundary>} />

          {/* Team */}
          <Route path="/team" element={<ErrorBoundary module="Equipo"><Team /></ErrorBoundary>} />
          <Route path="/notifications" element={<ErrorBoundary module="Notificaciones"><Notifications /></ErrorBoundary>} />
          <Route path="/listas" element={<ErrorBoundary module="Listas"><ManagedListsPage /></ErrorBoundary>} />

          {/* Admin */}
          <Route path="/automation" element={<ErrorBoundary module="Automatización"><AutomationControlCenter /></ErrorBoundary>} />
          <Route path="/settings" element={<ErrorBoundary module="Configuración"><SettingsPage /></ErrorBoundary>} />
          <Route path="/system/data-flow" element={<ErrorBoundary module="Arquitectura de Datos"><DataFlowPage /></ErrorBoundary>} />

          {/* Catch-all redirect */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </ErrorBoundary>
  );
}

