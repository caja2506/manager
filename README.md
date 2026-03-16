# AutoBOM Pro — Engineering Management Platform

> **Version:** 4.0  
> **Stack:** React 19 + Vite + Firebase (Firestore, Auth, Cloud Functions v2)  
> **Status:** Production — active development

---

## What This Is

An internal operating system for an automation engineering department. Originally a BOM management tool, it has evolved into a full engineering platform covering task management, time tracking, weekly planning, risk detection, audit compliance, and AI-assisted insights.

## Modules

| Module | Status | Key Files |
|--------|--------|-----------|
| **BOM Management** | ✅ Production | `BomProjects.jsx`, `BomProjectDetail.jsx`, `Catalog.jsx` |
| **Task Management** (Kanban + Table) | ✅ Production | `TaskManager.jsx`, `MainTable.jsx`, components/tasks/ |
| **Weekly Planner** | ✅ Production | `WeeklyPlanner.jsx`, components/planner/, `plannerService.js` |
| **Project Gantt** | ✅ Production | `ProjectGantt.jsx`, components/gantt/ |
| **Time Tracking** | ✅ Production | `WorkLogs.jsx`, components/time/, `timeService.js` |
| **My Work** (Personal dashboard) | ✅ Production | `MyWork.jsx`, components/mywork/ |
| **Delay & Risk Management** | ✅ Production | `delayService.js`, `riskService.js` |
| **Reports** (Daily/Weekly) | ✅ Production | `DailyReports.jsx`, `WeeklyReports.jsx`, `reportService.js` |
| **Audit Engine** (Rule-based) | ✅ Production | core/audit/, core/rules/, `AuditFindings.jsx` |
| **Analytics & Snapshots** | ✅ Production | core/analytics/, `EngineeringAnalytics.jsx` |
| **Control Tower** (Executive) | ✅ Production | `ControlTower.jsx` |
| **Dashboard** (Obeya) | ✅ Production | `Dashboard.jsx` |
| **Team Overview** | ✅ Production | `Team.jsx` |
| **Notifications** | ✅ Production | `Notifications.jsx` |
| **Auth & RBAC** | ✅ Production | `AuthContext.jsx`, `RoleContext.jsx`, `firestore.rules` |
| **Managed Lists** | ✅ Production | `ManagedListsPage.jsx` |
| **AI Import** (PDF/Excel) | ✅ Production | Cloud Functions (Gemini) |
| **Gemini Copilot** | ✅ Production | core/ai/, components/audit/AIInsightsPanel |
| **Settings** | ⚠️ Placeholder | `Settings.jsx` |

## Tech Stack

- **Frontend:** React 19.2 + Vite 7.3 + Tailwind CSS
- **Backend:** Firebase Cloud Functions v2 (Node.js)
- **Database:** Cloud Firestore (17+ collections)
- **Auth:** Firebase Auth (Google Sign-In)
- **AI:** Gemini 2.5 Flash (PDF analysis, insights, weekly briefs)
- **Hosting:** Firebase Hosting

## Getting Started

```bash
npm install
npm run dev          # Dev server at localhost:5173
```

### Cloud Functions

```bash
cd functions && npm install
firebase deploy --only functions
```

### Deploy

```bash
npm run build
firebase deploy
```

## Governance Docs

| File | Purpose |
|------|---------|
| `blueprint.md` | Master spec: modules, data model, roadmap |
| `architecture.md` | Technical architecture: file structure, data flows, security |
| `GEMINI.md` | AI development guidelines |
| `remediation-plan.md` | Audit remediation status |
