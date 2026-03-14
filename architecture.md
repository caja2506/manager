# AutoBOM Pro — Engineering Management Platform Architecture

> **Version:** 1.0  
> **Last Updated:** 2026-03-11

---

## 1. High-Level Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                        CLIENT (Browser)                       │
│                                                               │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │                    React Application                      │ │
│  │                   (Vite 7.3 + React 19.2)                │ │
│  │                                                           │ │
│  │  ┌─────────────┐  ┌──────────┐  ┌─────────────────────┐ │ │
│  │  │  Contexts    │  │  Pages   │  │  Components         │ │ │
│  │  │  (Auth/Role) │  │  (Router)│  │  (UI/Feature)       │ │ │
│  │  └──────┬──────┘  └────┬─────┘  └──────────┬──────────┘ │ │
│  │         │              │                     │            │ │
│  │         └──────────────┼─────────────────────┘            │ │
│  │                        │                                  │ │
│  │              ┌─────────▼─────────┐                       │ │
│  │              │   Firebase SDK     │                       │ │
│  │              │  (Firestore/Auth)  │                       │ │
│  │              └─────────┬─────────┘                       │ │
│  └────────────────────────┼──────────────────────────────────┘ │
└───────────────────────────┼──────────────────────────────────┘
                            │
                  ┌─────────▼─────────┐
                  │   Firebase Cloud    │
                  │                     │
                  │ ┌───────────────┐   │
                  │ │ Firestore DB  │   │
                  │ └───────────────┘   │
                  │ ┌───────────────┐   │
                  │ │ Cloud Fns v2  │   │
                  │ └───────────────┘   │
                  │ ┌───────────────┐   │
                  │ │ Auth (Google) │   │
                  │ └───────────────┘   │
                  └─────────────────────┘
                            │
                  ┌─────────▼─────────┐
                  │  External APIs     │
                  │                    │
                  │ • Gemini 2.5 Flash │
                  │ • Google CSE       │
                  └────────────────────┘
```

---

## 2. Current File Structure

```
autobom-pro/
├── index.html                       # HTML entry point
├── package.json                     # Dependencies & scripts
├── vite.config.js                   # Vite + React + Tailwind plugins
├── firebase.json                    # Firebase hosting, functions, rules config
├── firestore.rules                  # Firestore security rules
├── eslint.config.js                 # ESLint configuration
│
├── src/
│   ├── main.jsx                     # React root: StrictMode → AuthProvider → RoleProvider → App
│   ├── App.jsx                      # Main application component (~1249 lines, monolithic)
│   ├── App.css                      # Legacy CSS (mostly unused)
│   ├── index.css                    # Base CSS imports (Tailwind)
│   ├── firebase.js                  # Firebase SDK initialization
│   │
│   ├── components/
│   │   ├── admin/
│   │   │   └── UserAdminPanel.jsx   # Admin panel for user role management
│   │   ├── auth/
│   │   │   └── LoginPage.jsx        # Google sign-in page
│   │   ├── catalog/
│   │   │   ├── CatalogPickerModal.jsx
│   │   │   ├── ImagePickerModal.jsx
│   │   │   └── MasterRecordModal.jsx
│   │   ├── projects/
│   │   │   ├── BomItemEditModal.jsx
│   │   │   └── PdfReviewModal.jsx
│   │   └── ui/
│   │       ├── ConfirmDialog.jsx
│   │       ├── FilterPopover.jsx
│   │       ├── ListManagerModal.jsx
│   │       └── SearchableDropdown.jsx
│   │
│   ├── contexts/
│   │   ├── AuthContext.jsx          # Firebase auth state management
│   │   └── RoleContext.jsx          # User role state (admin/editor/viewer)
│   │
│   └── utils/
│       └── normalizers.js           # P/N normalization, provider matching
│
├── functions/
│   ├── index.js                     # Cloud Functions: testGeminiConnection, analyzeQuotePdf, searchImages
│   └── package.json                 # Functions dependencies
│
├── dist/                            # Production build output
├── public/                          # Static assets
│
├── blueprint.md                     # System blueprint & roadmap
├── architecture.md                  # This file
├── GEMINI.md                        # AI development guidelines
└── README.md                        # Standard Vite readme
```

---

## 3. Planned Architecture (Post Phase 3)

### Target File Structure

```
autobom-pro/
├── src/
│   ├── main.jsx                     # Root with Router + Providers
│   ├── App.jsx                      # Layout shell + Router outlet
│   ├── firebase.js
│   │
│   ├── pages/                       # 🆕 Route-level components
│   │   ├── Dashboard.jsx            # Obeya dashboard
│   │   ├── MyWork.jsx               # Personal tasks & timers
│   │   ├── Projects.jsx             # Project list (absorbs from App.jsx)
│   │   ├── ProjectDetail.jsx        # BOM view (absorbs from App.jsx)
│   │   ├── TaskManager.jsx          # Kanban board
│   │   ├── Catalog.jsx              # Master catalog (absorbs from App.jsx)
│   │   ├── WorkLogs.jsx             # Time tracking history
│   │   ├── DailyReports.jsx         # Daily report viewer
│   │   ├── WeeklyReports.jsx        # Weekly report viewer
│   │   ├── Team.jsx                 # Team overview
│   │   ├── Notifications.jsx        # Notification center
│   │   └── Settings.jsx             # Admin settings
│   │
│   ├── components/
│   │   ├── admin/                   # Existing
│   │   ├── auth/                    # Existing
│   │   ├── catalog/                 # Existing
│   │   ├── projects/                # Existing
│   │   ├── ui/                      # Existing + enhanced
│   │   ├── dashboard/               # 🆕 Dashboard widgets
│   │   │   ├── KpiCards.jsx
│   │   │   ├── ProjectHealth.jsx
│   │   │   ├── TeamActivity.jsx
│   │   │   ├── TeamWorkload.jsx
│   │   │   ├── AlertPanel.jsx
│   │   │   └── RiskInsights.jsx
│   │   ├── tasks/                   # 🆕 Task management
│   │   │   ├── KanbanBoard.jsx
│   │   │   ├── KanbanColumn.jsx
│   │   │   ├── TaskCard.jsx
│   │   │   ├── TaskDetailModal.jsx
│   │   │   └── SubtaskList.jsx
│   │   ├── timeTracking/            # 🆕 Time tracking
│   │   │   ├── Timer.jsx
│   │   │   ├── TimeLogEntry.jsx
│   │   │   └── OvertimeToggle.jsx
│   │   ├── delays/                  # 🆕 Delay management
│   │   │   ├── DelayForm.jsx
│   │   │   └── DelayCauseManager.jsx
│   │   ├── reports/                 # 🆕 Report components
│   │   │   ├── DailyReportCard.jsx
│   │   │   └── WeeklyReportChart.jsx
│   │   └── layout/                  # 🆕 Layout components
│   │       ├── Sidebar.jsx
│   │       ├── TopBar.jsx
│   │       └── MobileNav.jsx
│   │
│   ├── contexts/
│   │   ├── AuthContext.jsx          # Existing
│   │   ├── RoleContext.jsx          # Existing (extend roles)
│   │   └── TimerContext.jsx         # 🆕 Global timer state
│   │
│   ├── hooks/                       # 🆕 Custom hooks
│   │   ├── useFirestoreCollection.js
│   │   ├── useTimer.js
│   │   ├── useRiskScore.js
│   │   └── useExcelExport.js
│   │
│   ├── services/                    # 🆕 Firebase service layer
│   │   ├── projectService.js
│   │   ├── taskService.js
│   │   ├── timeLogService.js
│   │   ├── delayService.js
│   │   ├── reportService.js
│   │   └── riskService.js
│   │
│   └── utils/
│       ├── normalizers.js           # Existing
│       ├── riskCalculator.js        # 🆕 Risk score formula
│       ├── reportGenerator.js       # 🆕 Daily report generation
│       └── excelExporter.js         # 🆕 Excel export utility
│
├── functions/
│   ├── index.js                     # Existing functions
│   ├── riskCalculation.js           # 🆕 Server-side risk calculation
│   └── reportGeneration.js          # 🆕 Scheduled report generation
```

---

## 4. Data Flow Architecture

### Authentication Flow

```
User → Google Sign-In → Firebase Auth → AuthContext
                                          │
                                 onAuthStateChanged
                                          │
                              ┌───────────▼──────────┐
                              │    RoleContext         │
                              │    users_roles/{uid}   │
                              │                        │
                              │ If !exists:            │
                              │   Create with 'viewer' │
                              │ If exists:             │
                              │   Read role             │
                              └───────────┬──────────┘
                                          │
                              ┌───────────▼──────────┐
                              │    Render App          │
                              │    (role-based views)  │
                              └────────────────────────┘
```

### Time Tracking Flow (Phase 5)

```
User clicks Start →  TimerContext.start()
                      │
                      ├── Save start time to local state
                      ├── Create pending timeLog doc (startTime set)
                      │
                      ▼
User clicks Pause →  TimerContext.pause()
                      │
                      ├── Calculate elapsed time
                      ├── Save to local state
                      │
                      ▼
User clicks Stop  →  TimerContext.stop()
                      │
                      ├── Calculate totalHours
                      ├── User toggles overtime checkbox
                      ├── Update timeLog doc (endTime, totalHours, overtime)
                      ├── Update Firestore
                      │
                      ▼
                 timeLog saved to Firestore
```

### Risk Score Calculation Flow (Phase 6)

```
Project Data Sources:
  ├── tasks (status, dueDate)
  ├── timeLogs (overtimeHours)
  ├── delays (activeDelays)
  └── users (ownerWorkload)
          │
          ▼
Risk Calculation Engine:
  riskScore = (delayedTasks × 20)
            + (overtimeHours × 2)
            + (activeDelays × 15)
            + (tasksInValidation × 10)
            + (ownerOverloaded ? 15 : 0)
          │
          ▼
Risk Classification:
  0–29   → Low    (🟢)
  30–59  → Medium (🟡)
  60+    → High   (🔴)
          │
          ▼
Update project document:
  riskScore, riskLevel, riskFactors, riskSummary
```

---

## 5. Security Architecture

### Current Firestore Rules

```
Authentication Required: YES (all reads)

users_roles/{userId}:
  create: auth.uid == userId && role == 'viewer'
  update/delete: admin only

proyectos_bom, catalogo_maestro, items_bom:
  create/update: admin or editor
  delete: admin only

marcas, categorias, proveedores:
  create/update: admin or editor
  delete: admin only
```

### Planned Security Extensions (Phase 2)

```
New collections will follow this pattern:

tasks:
  create/update: admin, team_lead, engineer
  delete: admin, team_lead
  read: all authenticated

timeLogs:
  create: all authenticated (own logs only)
  update: own logs or admin
  delete: admin only
  read: all authenticated

delays:
  create: all authenticated
  update: creator or admin
  delete: admin only

dailyReports:
  read: all authenticated
  write: system only (Cloud Functions)

settings:
  read: all authenticated
  write: admin only
```

---

## 6. State Management Strategy

### Current State

| State | Method | Scope |
|-------|--------|-------|
| Auth state | Context (AuthContext) | Global |
| User role | Context (RoleContext) | Global |
| All other state | useState in App.jsx | App-level |

### Evolving Strategy

| State | Method | Scope | Phase |
|-------|--------|-------|-------|
| Auth | Context (AuthContext) | Global | Existing |
| User role | Context (RoleContext) | Global | Existing, extend |
| Timer | Context (TimerContext) | Global | Phase 5 |
| Navigation | react-router-dom | Global | Phase 3 |
| Page data | Custom hooks | Page-level | Phase 3+ |
| Form state | useState | Component-level | All phases |

### Principle

Use the **simplest appropriate solution**:
1. `useState` for local component state
2. `useContext` for shared state across a few components
3. Custom hooks for reusable Firestore subscriptions
4. Consider Zustand only if state complexity grows beyond context capability

---

## 7. Modularization Plan

### Current Issue

`App.jsx` is **1,249 lines** containing all application logic, state, event handlers, and rendering. This must be modularized incrementally.

### Modularization Steps (Phase 3)

1. **Extract layout** → `Sidebar.jsx`, `TopBar.jsx`, `MobileNav.jsx`
2. **Extract pages** → Move each `activeTab` view to its own page component
3. **Extract data logic** → Move Firestore subscriptions to custom hooks
4. **Extract handlers** → Move event handlers to service modules
5. **Keep App.jsx** as the layout shell with Router configuration

### Critical Rule

> **Never break existing functionality.** Each extraction step must be tested independently before moving to the next.

---

## 8. API / Cloud Functions Architecture

### Existing Functions

| Function | Type | Purpose |
|----------|------|---------|
| `testGeminiConnection` | onCall | Test Gemini API connectivity |
| `analyzeQuotePdf` | onCall | Analyze PDF text with Gemini AI |
| `searchImages` | onCall | Proxy Google Custom Search for images |

### Planned Functions (Future Phases)

| Function | Type | Purpose | Phase |
|----------|------|---------|-------|
| `calculateProjectRisk` | onCall/scheduled | Recalculate risk scores | Phase 6 |
| `generateDailyReport` | scheduled | Auto-generate daily reports | Phase 7 |
| `sendNotification` | triggered | Send notifications on events | Phase 8 |

---

## 9. Design System

### Current Design Language

- **Color Palette:** Slate-based with Indigo accents, Green for success/money
- **Typography:** System font stack via Tailwind
- **Spacing:** Tailwind utility-based
- **Components:** Custom-built with Tailwind classes
- **Animations:** Tailwind `animate-in`, `fade-in`, `slide-in`, `zoom-in`
- **Border Radius:** Heavy rounding (`rounded-2xl`, `rounded-3xl`)
- **Shadows:** Multi-layer shadows for depth

### Design Tokens (Informal)

| Token | Value | Usage |
|-------|-------|-------|
| Primary | indigo-600 | Buttons, active states, links |
| Background | slate-50 | Main content area |
| Sidebar | slate-900 | Navigation sidebar |
| Card | white | Content cards |
| Success | green-600/700 | Prices, positive metrics |
| Warning | amber-400/500 | Edit actions, attention |
| Danger | red-500/600 | Delete actions, errors |
| Info | teal-700 | Lead time, supplementary info |
