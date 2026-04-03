import React, { useState, useCallback, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
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
// AUTH LOADING SCREEN
// ========================================================
const LOADING_QUOTES = [
    {
        text: 'Lo que no se define no se puede medir.\nLo que no se mide, no se puede mejorar.\nLo que no se mejora, se degrada siempre.',
        author: 'Lord Kelvin',
    },
    {
        text: 'What gets measured gets managed.',
        sub: 'Lo que se mide, se gestiona.',
        author: 'Peter Drucker',
    },
];

function AuthLoadingScreen() {
    const [quote] = useState(() => LOADING_QUOTES[Math.floor(Math.random() * LOADING_QUOTES.length)]);
    return (
        <div className="fixed inset-0 z-9998 flex items-center justify-center overflow-hidden" style={{ background: 'linear-gradient(135deg, #0f0b2e 0%, #1a1050 30%, #0d1a3a 60%, #1a0f40 100%)' }}>
            {/* Ambient glow */}
            <div className="absolute rounded-full pointer-events-none" style={{
                width: 600, height: 600, top: '10%', left: '50%', transform: 'translateX(-50%)',
                background: 'radial-gradient(circle, rgba(107,63,160,0.25) 0%, transparent 70%)', filter: 'blur(100px)',
            }} />
            <div className="absolute rounded-full pointer-events-none" style={{
                width: 400, height: 400, bottom: '10%', right: '20%',
                background: 'radial-gradient(circle, rgba(0,207,255,0.12) 0%, transparent 70%)', filter: 'blur(80px)',
            }} />
            <div className="relative z-10 flex flex-col items-center text-center px-6" style={{ maxWidth: 700 }}>
                <div className="mb-8" style={{ animation: 'authload-float 3s ease-in-out infinite' }}>
                    <AnalyzeOpsLogo size={360} animate showName />
                </div>

                {/* Quote */}
                <p className="text-2xl sm:text-3xl font-light italic leading-relaxed mb-2" style={{ color: 'rgba(255,255,255,0.7)', whiteSpace: 'pre-line' }}>
                    &ldquo;{quote.text}&rdquo;
                </p>
                {quote.sub && (
                    <p className="text-lg italic mb-3" style={{ color: 'rgba(196,149,106,0.55)' }}>({quote.sub})</p>
                )}
                <p className="text-sm font-semibold tracking-widest uppercase mb-8" style={{ color: '#C4956A' }}>
                    — {quote.author}
                </p>

                {/* Loading bar */}
                <div className="w-64 h-[3px] rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
                    <div className="h-full rounded-full" style={{
                        background: 'linear-gradient(90deg, #4A1D6E, #00CFFF, #C4956A)',
                        animation: 'authload-bar 3s ease-in-out infinite',
                    }} />
                </div>
            </div>
            <style>{`
                @keyframes authload-float {
                    0%, 100% { transform: translateY(0); }
                    50% { transform: translateY(-10px); }
                }
                @keyframes authload-bar {
                    0% { width: 0%; margin-left: 0; }
                    50% { width: 60%; margin-left: 20%; }
                    100% { width: 0%; margin-left: 100%; }
                }
            `}</style>
        </div>
    );
}


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

  const isLoading = authLoading || (user && roleLoading);

  // --- Minimum loading display time (3 seconds) ---
  const [minDelayDone, setMinDelayDone] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setMinDelayDone(true), 5000);
    return () => clearTimeout(t);
  }, []);
  const showLoading = isLoading || !minDelayDone;

  // If not authenticated and done loading → show login
  if (!showLoading && !user) {
    return (
      <>
        {!splashDone && <SplashScreen onComplete={handleSplashComplete} />}
        <LoginPage />
      </>
    );
  }

  // If still loading (auth or minimum delay)
  if (showLoading) {
    return (
      <>
        {!splashDone && <SplashScreen onComplete={handleSplashComplete} />}
        {splashDone && <AuthLoadingScreen />}
        {/* Dark background underneath */}
        <div className="h-screen" style={{ background: '#0c0a1a' }} />
      </>
    );
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
