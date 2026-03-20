# AutoBOM Pro — Engineering Management Platform Blueprint

> **Version:** 4.1 — Full Platform + Modularization Phase 1  
> **Last Updated:** 2026-03-20  
> **Status:** All core modules implemented — modularization and hardening in progress

---

## Table of Contents

1. [System Vision](#1-system-vision)
2. [Platform Evolution](#2-platform-evolution)
3. [Current System (AutoBOM Pro v3.4)](#3-current-system-autobom-pro-v34)
4. [Methodology Framework](#4-methodology-framework)
5. [Team Structure & Roles](#5-team-structure--roles)
6. [Module Architecture](#6-module-architecture)
7. [Task Workflow Model](#7-task-workflow-model)
8. [Time Tracking Model](#8-time-tracking-model)
9. [Delay Management](#9-delay-management)
10. [Daily Engineering Reports](#10-daily-engineering-reports)
11. [Dashboard (Obeya Style)](#11-dashboard-obeya-style)
12. [Project Risk System](#12-project-risk-system)
13. [Firestore Data Architecture](#13-firestore-data-architecture)
14. [Application Pages & Navigation](#14-application-pages--navigation)
15. [Export Requirements](#15-export-requirements)
16. [Technology Stack](#16-technology-stack)
17. [Development Roadmap](#17-development-roadmap)
18. [Audit Remediation Program](#18-audit-remediation-program)

---

## 1. System Vision

Create an **Engineering Management Platform** designed to operate as an internal operating system for an automation engineering department.

The platform must manage:

- Engineering projects (including BOM management — existing functionality)
- Engineering tasks
- Technician tasks
- Time tracking
- Overtime tracking
- Delay causes
- Engineering performance metrics
- Project risk detection
- Daily engineering reports

This system will initially be used **internally** but must be architected so that it can evolve in the future into a **SaaS platform** for automation teams.

### Core Problems Solved

| Problem | Solution |
|---------|----------|
| Work tracked informally | Structured task management with Kanban workflow |
| Partial use of Excel | Centralized digital platform |
| Lack of centralized visibility | Obeya-style dashboard |
| Project risks detected late | Automated risk scoring system |
| Overtime not fully tracked | Built-in time & overtime tracking per user |
| Limited historical metrics | Engineering analytics module |
| Low traceability | Full linkage between tasks, time, projects, and delays |

---

## 2. Platform Evolution

The platform evolves from the existing **AutoBOM Pro** BOM management application. The evolution preserves all existing AutoBOM functionality while adding engineering management capabilities.

### Evolution Strategy

```
┌─────────────────────────────────────────────────────┐
│              AutoBOM Pro (Existing)                  │
│  ┌─────────────┐  ┌──────────┐  ┌───────────────┐  │
│  │  Projects    │  │ Catalog  │  │ BOM Items     │  │
│  │  (BOM)       │  │ Master   │  │ Management    │  │
│  └─────────────┘  └──────────┘  └───────────────┘  │
│  ┌─────────────┐  ┌──────────┐  ┌───────────────┐  │
│  │  AI PDF     │  │ Excel    │  │ Managed Lists │  │
│  │  Import     │  │ Import   │  │ (Brands/Cat)  │  │
│  └─────────────┘  └──────────┘  └───────────────┘  │
├─────────────────────────────────────────────────────┤
│         Engineering Management (New)                 │
│  ┌─────────────┐  ┌──────────┐  ┌───────────────┐  │
│  │  Task       │  │ Time     │  │ Delay         │  │
│  │  Manager    │  │ Tracking │  │ Management    │  │
│  └─────────────┘  └──────────┘  └───────────────┘  │
│  ┌─────────────┐  ┌──────────┐  ┌───────────────┐  │
│  │  Dashboard  │  │ Reports  │  │ Risk          │  │
│  │  (Obeya)    │  │ (D/W)    │  │ Detection     │  │
│  └─────────────┘  └──────────┘  └───────────────┘  │
│  ┌─────────────┐  ┌──────────┐                      │
│  │  Analytics  │  │ Team     │                      │
│  │  Engine     │  │ Mgmt     │                      │
│  └─────────────┘  └──────────┘                      │
└─────────────────────────────────────────────────────┘
```

---

## 3. Current System (AutoBOM Pro v3.4)

### Existing Functionality (PRESERVED)

AutoBOM Pro is a Bill of Materials management application designed for engineers and hardware development teams.

#### Current Features

- **Projects:** Create and manage BOM projects with name, description, and cost tracking
- **Master Catalog:** Centralized database of unique parts (P/N as logical primary key, uppercase, no spaces)
- **BOM Items:** Link catalog parts to projects with quantity, pricing, and lead time
- **AI PDF Import:** Upload PDF quotations → extract text via pdf.js → send to Gemini AI → review → import
- **Excel Import:** Bulk import catalog items from Excel files
- **Managed Lists:** Brands (marcas), Categories (categorías), Providers (proveedores)
- **Image Management:** Search and assign product images via Google Custom Search
- **Filtering:** Multi-criteria filtering on BOM and Catalog views
- **RBAC:** Role-based access control (admin, editor, viewer)
- **Google Auth:** Authentication via Google sign-in

#### Current Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19.2 (Vite 7.3) |
| Styling | Tailwind CSS 4.2 |
| Icons | lucide-react |
| Database | Cloud Firestore |
| Auth | Firebase Auth (Google) |
| AI | Gemini 2.5 Flash (via Cloud Functions) |
| PDF | pdfjs-dist |
| Excel | xlsx (SheetJS) |
| Functions | Firebase Cloud Functions v2 |

#### Current Firestore Collections

| Collection | Purpose |
|------------|---------|
| `proyectos_bom` | BOM project records |
| `catalogo_maestro` | Master parts catalog |
| `items_bom` | BOM line items per project |
| `marcas` | Managed brands list |
| `categorias` | Managed categories list |
| `proveedores` | Managed providers list |
| `users_roles` | User role assignments |

#### Current Component Structure

> **Note:** As of Phase M.1 (2026-03-20), the single-file mandate for `App.jsx` has been officially eliminated. The application is now structured using multi-file modularization across `src/services/`, `src/hooks/`, `src/components/`, and `src/pages/`.

```
src/
├── App.jsx                          # Route definitions only (133 lines)
├── App.css                          # Legacy CSS (mostly unused)
├── main.jsx                         # Entry point with AuthProvider + RoleProvider
├── firebase.js                      # Firebase SDK init + ensureSession() utility
├── index.css                        # Base styles
├── services/
│   └── aiService.js                 # [Phase M.1] PDF/Excel import + Gemini AI logic
├── hooks/
│   └── useAutoBomData.js            # [Phase M.1] BOM Firestore subscriptions + handlers
├── contexts/
│   ├── AuthContext.jsx              # Firebase auth state
│   ├── RoleContext.jsx              # User role state (admin/editor/viewer)
│   └── AppDataContext.jsx           # Orchestration layer (332 lines, reduced from 727)
├── components/
│   ├── admin/
│   │   └── UserAdminPanel.jsx       # User role management (admin only)
│   ├── auth/
│   │   └── LoginPage.jsx            # Google sign-in page
│   ├── catalog/
│   │   ├── CatalogPickerModal.jsx   # Select catalog items to add to BOM
│   │   ├── ImagePickerModal.jsx     # Image search & selection
│   │   └── MasterRecordModal.jsx    # Create/edit catalog records
│   ├── projects/
│   │   ├── BomItemEditModal.jsx     # Edit BOM line item
│   │   └── PdfReviewModal.jsx       # Review AI-extracted PDF data
│   └── ui/
│       ├── ConfirmDialog.jsx        # Confirmation dialog
│       ├── FilterPopover.jsx        # Multi-criteria filter UI
│       ├── ListManagerModal.jsx     # CRUD for managed lists
│       └── SearchableDropdown.jsx   # Searchable select component
└── utils/
    └── normalizers.js               # P/N normalization, provider matching
```

#### Current AI Data Flow

1. **Upload PDF** → user uploads quotation PDF
2. **Extract text** → pdf.js extracts plain text
3. **Cloud Function** → `analyzeQuotePdf` sends text to Gemini with structured prompt
4. **Review modal** → items classified as new/existing, supplier analyzed
5. **Batch write** → confirmed items saved to `catalogo_maestro` + `items_bom`

---

## 4. Methodology Framework

### Automation Engineering Agile Framework

A hybrid agile methodology designed specifically for engineering departments.

Combines:
- **Kanban** workflow
- **Weekly Scrumban** planning
- **Lean engineering** principles
- **Obeya** digital dashboard

### Operational Model

| Day | Activity |
|-----|----------|
| **Monday** | Engineering planning meeting: review project status, risks, priorities, team capacity |
| **Tue–Fri** | Continuous workflow execution: move tasks, track time, log overtime, report delays, update progress |

---

## 5. Team Structure & Roles

### Department Composition

| Role | Count | System Access |
|------|-------|---------------|
| Manager | 1 | Reports, dashboard summaries |
| Team Lead | 1 | Full access, overtime registration |
| Engineer | 4 | Primary users, task management, time tracking |
| Technician | 3 | Task updates, time tracking, overtime registration |

### System Roles

| Role | Capabilities |
|------|-------------|
| **Manager** | View dashboard, reports, analytics. Read-only on operational data |
| **Team Lead** | Full task management, time tracking, overtime, team oversight |
| **Engineer** | Task management, time tracking, validate & complete tasks |
| **Technician** | Update tasks (up to Validation), time tracking, overtime |
| **Admin** | System configuration, user management (existing RBAC) |

### Role Mapping (Existing → New)

The existing RBAC system (`admin`, `editor`, `viewer`) will be extended to support the new engineering roles. The `users_roles` collection will be updated to include the new role types.

---

## 6. Module Architecture

### Module Map

| Module | Status | Phase |
|--------|--------|-------|
| **AutoBOM Core** (Projects, Catalog, BOM) | ✅ Complete | Existing |
| **AI Import** (PDF, Excel) | ✅ Complete | Existing |
| **Auth & RBAC** | ✅ Complete | Existing |
| **Managed Lists** (Brands, Categories, Providers) | ✅ Complete | Existing |
| **Firestore Data Model** (new collections) | ✅ Complete | Phase 2 |
| **Navigation & Page Structure** | ✅ Complete | Phase 3 |
| **Projects & Task Management** | ✅ Complete | Phase 4 |
| **Time Tracking** | ✅ Complete | Phase 5 |
| **Delays & Risk Detection** | ✅ Complete | Phase 6 |
| **Reports (Daily/Weekly)** | ✅ Complete | Phase 7 |
| **Engineering Dashboard (Obeya)** | ✅ Complete | Phase 8 |
| **Engineering Analytics** | ✅ Complete | Phase 9 |
| **Project Gantt** | ✅ Complete | Phase 10 |
| **Management Intelligence** (Rule Engine, Audit, AI) | ✅ Complete | Phase 11 |
| **Workflow Enforcement** (CF-controlled transitions) | ✅ Complete | Phase 12 |
| **Audit Trail** (Immutable events, scheduled audits) | ✅ Complete | Phase 13 |
| **Team Overview** | ✅ Complete | Phase 14 |
| **Notifications** (Firestore-based, user-scoped) | ✅ Complete | Phase 14 |
| **Settings** | ⚠️ Placeholder | — |

### Remediation & Hardening (2026-03-14)

| Area | Action | Status |
|------|--------|--------|
| Data model: `completedAt` vs `completedDate` | Normalized to `completedDate` | ✅ Fixed |
| Data model: `blockReason` vs `blockedReason` | Normalized to `blockedReason` | ✅ Fixed |
| Planner validation (blocking + warnings) | Enforced B1-B7 blocking rules | ✅ Fixed |
| CF score placeholders (`estimationAccuracy`, `dataDiscipline`) | Replaced with real formulas | ✅ Fixed |
| `ownerOverloaded` in riskService | Implemented real overload detection | ✅ Fixed |
| Audit engine: empty planner context | Now fetches real planner data | ✅ Fixed |
| `taskNormalizer.js` for legacy docs | Created read-time normalizer | ✅ Created |
| Official field contract | Documented in `schemas.js` | ✅ Documented |

---

## 7. Task Workflow Model

### Primary Workflow

```
Backlog → Pending → In Progress → Validation → Completed
```

### Additional States

```
Blocked (can occur from any active state)
Cancelled (can occur from any state)
```

### Workflow Rules

| Rule | Description |
|------|-------------|
| Technicians → Validation | Technicians may move tasks to Validation |
| Engineers → Completed | Engineers confirm completion and move tasks to Completed |
| Blocked | Any team member can flag a task as Blocked with a reason |
| Cancelled | Requires Team Lead or Manager approval |

---

## 8. Time Tracking Model

### Individual Tracking

Each user must track time **independently**, even if multiple people work on the same task.

### Timer Operations

- **Start Timer** — begin tracking
- **Pause Timer** — temporarily suspend tracking
- **Stop Timer** — end tracking and save log

### Time Log Data Structure

| Field | Type | Description |
|-------|------|-------------|
| `taskId` | string | Reference to task |
| `projectId` | string | Reference to project |
| `userId` | string | Reference to user |
| `startTime` | timestamp | When timer started |
| `endTime` | timestamp | When timer stopped |
| `totalHours` | number | Calculated duration |
| `overtime` | boolean | Manually indicated by user |
| `overtimeHours` | number | Hours classified as overtime |
| `notes` | string | Optional notes |
| `createdAt` | timestamp | Log creation time |

### Overtime Rules

- Overtime must be **manually indicated** by the user
- Roles allowed to register overtime: **Technician, Engineer, Team Lead**

---

## 9. Delay Management

### Configurable Delay Causes

Stored in `delayCauses` collection:

- Missing materials
- Priority change
- Production support
- Engineering decision
- Technical issue
- External dependency
- Waiting for validation
- Resource unavailable

### Delay Record Structure

| Field | Type | Description |
|-------|------|-------------|
| `projectId` | string | Required — linked project |
| `taskId` | string | Optional — linked task |
| `cause` | string | Selected from delayCauses |
| `comment` | string | Additional context |
| `impact` | string | Optional impact description |
| `createdBy` | string | User who reported the delay |
| `createdAt` | timestamp | When the delay was reported |

---

## 10. Daily Engineering Reports

### Auto-Generated Reports

Data sources: `timeLogs`, `tasks`, `delays`

### Report Content (Per Engineer)

- Tasks worked on
- Hours worked
- Overtime hours
- Tasks completed
- Delays reported
- Notes summary

### Export

All reports must be exportable to **Excel** (.xlsx).

---

## 11. Dashboard (Obeya Style)

The main dashboard functions as a **digital Obeya center**.

### Dashboard Sections

#### KPI Cards
- Active projects
- Projects at risk
- Delayed tasks
- Weekly overtime
- Hours worked today

#### Project Health
- Project name
- Progress percentage
- Overtime accumulated
- Risk level indicator

#### Daily Team Activity
- Engineer/Technician name
- Hours worked today
- Overtime today
- Tasks completed today

#### Team Workload
- Team member
- Capacity (available hours)
- Assigned hours
- Utilization percentage
- Overload indicator

#### Alerts
- Delayed tasks
- Blocked tasks
- High overtime
- Projects with active delays

#### Risk Insights
- Project risk summary
- Risk factors breakdown
- Attention recommendations

---

## 12. Project Risk System

### Risk Score Formula

```
riskScore =
  (delayedTasks × 20)
  + (overtimeHours × 2)
  + (activeDelays × 15)
  + (tasksInValidation × 10)
  + (ownerOverloaded ? 15 : 0)
```

### Risk Classification

| Score Range | Level | Color |
|-------------|-------|-------|
| 0–29 | 🟢 Low | Green |
| 30–59 | 🟡 Medium | Yellow |
| 60+ | 🔴 High | Red |

### Risk Fields on Project

| Field | Type |
|-------|------|
| `riskScore` | number |
| `riskLevel` | string (low/medium/high) |
| `riskFactors` | array of strings |
| `riskSummary` | string |

> **Note:** The formula must remain configurable via the `settings` collection.

---

## 13. Firestore Data Architecture

### Complete Collections Map

#### Existing Collections (PRESERVED)

| Collection | Fields | Status |
|------------|--------|--------|
| `users_roles` | name, email, role, photoURL, createdAt | ✅ Exists — will extend with engineering roles |
| `proyectos_bom` | name, description, createdAt | ✅ Exists — will extend with risk, status fields |
| `catalogo_maestro` | name, partNumber, lastPrice, brand, category, defaultProvider, leadTimeWeeks, imageUrl | ✅ Exists |
| `items_bom` | projectId, masterPartRef, quantity, unitPrice, totalPrice, proveedor, prcr, status, leadTimeWeeks, addedAt | ✅ Exists |
| `marcas` | name | ✅ Exists |
| `categorias` | name | ✅ Exists |
| `proveedores` | name | ✅ Exists |

#### New Collections (Phase 2)

| Collection | Purpose | Key Fields |
|------------|---------|------------|
| `users` | Extended user profiles | name, email, role, department, capacity, active, createdAt |
| `projects` | Engineering projects (extends proyectos_bom concept) | name, description, client, priority, status, ownerId, startDate, dueDate, progress, riskScore, riskLevel |
| `tasks` | Engineering tasks | projectId, title, description, status, priority, engineerId, technicianId, estimatedHours, dueDate, createdAt |
| `subtasks` | Task subtasks | taskId, title, status |
| `timeLogs` | Time tracking entries | taskId, projectId, userId, startTime, endTime, totalHours, overtime, overtimeHours, notes, createdAt |
| `delayCauses` | Configurable delay reasons | name, active |
| `delays` | Delay records | projectId, taskId, cause, comment, impact, createdBy, createdAt |
| `risks` | Risk calculations | projectId, riskScore, riskLevel, riskFactors, riskSummary, calculatedAt |
| `dailyReports` | Auto-generated daily reports | date, userId, data, createdAt |
| `notifications` | System notifications | userId, type, message, read, createdAt |
| `taskTypes` | Configurable task types | name, icon, color |
| `settings` | System configuration | key, value, updatedAt |
| `auditLogs` | System audit trail | action, userId, collection, documentId, changes, timestamp |

---

## 14. Application Pages & Navigation

### Navigation Structure

| Page | Icon | Description |
|------|------|-------------|
| **Dashboard** | LayoutDashboard | Obeya-style overview (default landing) |
| **My Work** | User | Active tasks, running timers, today's summary |
| **Projects** | FolderGit2 | Engineering projects + BOM management |
| **Task Manager** | ListTodo | Kanban board, task CRUD |
| **Weekly Planner** | CalendarDays | Weekly task scheduling grid |
| **Project Gantt** | GanttChartSquare | Gantt chart (weekly/monthly) |
| **Engineering Analytics** | BarChart3 | Performance metrics and trends |
| **Work Logs** | Clock | Time entries, overtime tracking |
| **Daily Reports** | FileText | Auto-generated daily summaries |
| **Weekly Reports** | BarChart3 | Weekly analytics and trends |
| **Team** | Users | Team member overview and workload |
| **Notifications** | Bell | System alerts and updates |
| **Admin / Settings** | Settings | Configuration, user management, delay causes |

> **Design Rule:** Tasks, Weekly Planner, Gantt, and Analytics share a unified banner component (`TaskModuleBanner`) with tab navigation (see [Appendix B](#appendix-b-ui-design-standards)).

### Default Landing View ("My Work")

- User's active tasks
- Running timers
- Today's work summary
- Overtime today
- Recent activity feed

---

## 15. Export Requirements

The system must support **Excel export** for:

- Project status reports
- Work logs (time entries)
- Overtime reports
- Daily reports
- Weekly reports
- Dashboard summaries

---

## 16. Technology Stack

### Current (Preserved)

| Technology | Purpose |
|-----------|---------|
| React 19.2 + Vite 7.3 | Frontend framework & build tool |
| Tailwind CSS 4.2 | Styling |
| Cloud Firestore | Database |
| Firebase Auth | Authentication |
| Firebase Cloud Functions v2 | Server-side logic |
| lucide-react | Icons |
| pdfjs-dist | PDF text extraction |
| xlsx (SheetJS) | Excel import/export |
| Gemini 2.5 Flash | AI document analysis |

### Planned Additions

| Technology | Purpose | Phase |
|-----------|---------|-------|
| react-router-dom | Client-side routing | Phase 3 |
| recharts or @nivo/bar | Chart/graph components for dashboard | Phase 8 |
| date-fns or dayjs | Date/time utilities for time tracking | Phase 5 |
| react-beautiful-dnd or @dnd-kit | Drag-and-drop for Kanban board | Phase 4 |

---

## 17. Development Roadmap

### Phase 1 — Project Analysis & Documentation ✅
> **Status:** COMPLETE

- [x] Analyze current project structure
- [x] Identify existing modules and components
- [x] Document current Firestore collections
- [x] Map component hierarchy
- [x] Update blueprint.md with full system vision
- [x] Create architecture.md
- [x] Update GEMINI.md with new scope

### Phase 2 — Firestore Data Model ✅
> **Status:** COMPLETE

- [x] Design and document new collection schemas (`src/models/schemas.js`)
- [x] Define relationships and references between collections
- [x] Propose Firestore indexes for common queries (`firestore.indexes.json`)
- [x] Create seed data utilities (`src/utils/seedData.js`)
- [x] Prepare analytics foundation (risk calculation engine in schemas)
- [x] Update Firestore security rules for new collections (`firestore.rules`)

### Phase 3 — Navigation & Application Structure ✅
> **Status:** COMPLETE

- [x] Install and configure react-router-dom
- [x] Create page placeholder components (Dashboard, MyWork, TaskManager, WorkLogs, DailyReports, WeeklyReports, Team, Notifications)
- [x] Implement sidebar navigation with new pages (desktop + mobile)
- [x] Preserve existing AutoBOM modules (Projects, Catalog, BOM) — all functional
- [x] Begin modularizing App.jsx (1249→85 lines, extracted to AppDataContext + pages)
- [x] Add mobile-responsive navigation (bottom nav bar)

### Phase 4 — Projects & Task Management ✅
> **Status:** COMPLETE

- [x] Extend project model with engineering fields (ProjectModal + Projects page)
- [x] Create task CRUD interface (TaskDetailModal with full form)
- [x] Implement Kanban board view (5-column board with filters)
- [x] Implement subtask management (SubtaskList with checklist)
- [x] Apply workflow state machine (Backlog → Completed + Blocked/Cancelled)
- [x] Role-based task operations (canEdit/canDelete checks throughout)

### Phase 5 — Time Tracking ✅
> **Status:** COMPLETE

- [x] Build timer component (start/pause/stop) — ActiveTimer with live countdown
- [x] Create time log entries in Firestore — timeService with localStorage persistence
- [x] Implement overtime toggle and tracking — Zap badge + amber styling
- [x] Work log history view — Weekly navigation + per-entry display
- [x] Per-task and per-project time aggregation — Stats cards + POR PROYECTO breakdown

### Phase 6 — Delays & Risk Detection ✅
> **Status:** COMPLETE

- [x] Create delay causes configuration (admin)
- [x] Build delay reporting interface
- [x] Link delays to tasks and projects
- [x] Implement risk score calculation
- [x] Add risk level indicators to project views
- [x] Create risk alerts

### Phase 7 — Reports ✅
> **Status:** COMPLETE

- [x] Auto-generate daily engineering reports
- [x] Build daily report viewer
- [x] Implement weekly report aggregation
- [x] Excel export for all report types
- [x] Report filtering by date, team member, project

### Phase 8 — Engineering Dashboard ✅
> **Status:** COMPLETE

- [x] Build Obeya-style dashboard layout
- [x] Implement KPI cards with real-time data
- [x] Project health overview
- [x] Daily team activity feed
- [x] Team workload visualization
- [x] Alert panel
- [x] Risk insights section

### Phase 9 — Engineering Analytics ✅
> **Status:** COMPLETE

- [x] Historical performance metrics
- [x] Trend analysis (overtime, delays, velocity)
- [x] Team utilization analytics
- [x] Project completion forecasting
- [x] Export analytics to Excel

### Phase 10 — Project Gantt ✅
> **Status:** COMPLETE

- [x] Create `taskDependencies` + `taskTypeCategories` collection schemas
- [x] Extend `tasks` schema with Gantt fields (`plannedStartDate`, `plannedEndDate`, `percentComplete`, `showInGantt`, `milestone`, `summaryTask`, `parentTaskId`)
- [x] Create `ganttService.js` (read tasks, dependencies, update Gantt fields)
- [x] Build `GanttGrid` with dual-panel layout (task list + scrollable timeline)
- [x] Build `GanttBar` (regular, milestone ◆, summary task)
- [x] Build `DependencyArrows` SVG overlay (FS / SS links)
- [x] Build `GanttTaskEditDrawer` (quick edit: dates, % avance, showInGantt)
- [x] Build `ProjectGantt` page with Weekly / Monthly toggle + filters
- [x] Add route `/gantt` and sidebar nav item "Project Gantt"

### Phase 11 — Management Intelligence (MI) Layer ✅
> **Status:** COMPLETE

- [x] Analytics engine (`src/core/analytics/`) — snapshotBuilder, trendCalculator, teamUtilization
- [x] Rule engine (`src/core/rules/`) — ruleEvaluator, ruleCatalog, taskRules, projectRules, plannerRules, userDisciplineRules
- [x] Audit engine (`src/core/audit/`) — auditEngine, complianceScorer, findingBuilder
- [x] Workflow engine (`src/core/workflow/`) — workflowModel, transitionValidator
- [x] Gemini Copilot integration (`src/core/ai/`) — geminiService, insightGenerator
- [x] Control Tower page (`src/pages/ControlTower.jsx`)
- [x] Audit Findings page (`src/pages/AuditFindings.jsx`)
- [x] Cloud Function: `generateInsights` (Gemini proxy for MI)
- [x] Cloud Function: `scheduledAudit` (daily 6 AM CST)
- [x] Audit persistence service (`src/services/auditPersistence.js`)
- [x] Workflow transition UI (`src/components/workflow/TransitionConfirmModal.jsx`)

### Phase M.1 — Monolith Dismantling: Core Logic & Services ✅
> **Status:** COMPLETE (2026-03-20) — Build verified, 186 tests passing

- [x] Eliminate single-file mandate — multi-file architecture now official
- [x] Enhance `src/firebase.js` with `ensureSession()` auth utility
- [x] Extract PDF/Excel/Gemini logic → `src/services/aiService.js` (313 lines)
- [x] Extract BOM subscriptions + handlers → `src/hooks/useAutoBomData.js` (275 lines)
- [x] Reduce `AppDataContext.jsx` from 727 → 332 lines (orchestration layer)
- [x] Verify build (3406 modules, 0 errors) and tests (11 files, 186 tests)

### Phase R — Audit Remediation Program 📋
> **Status:** BASELINE ESTABLISHED — See [`remediation-plan.md`](file:///c:/Users/CJ00083620/.gemini/antigravity/scratch/autobom-pro/remediation-plan.md)

- [ ] Phase R.0 — Housekeeping & Documentation Consistency
- [ ] Phase R.1 — Error Boundaries & Resilience
- [ ] Phase R.2 — Test Infrastructure & Critical Path Coverage
- [/] Phase R.3 — AppDataContext Decomposition (partially addressed by Phase M.1)
- [ ] Phase R.4 — schemas.js Modularization
- [ ] Phase R.5 — Cloud Functions Modularization & Testing
- [ ] Phase R.6 — CI/CD & Build Verification

---

## 18. Audit Remediation Program

> **Reference:** [`remediation-plan.md`](file:///c:/Users/CJ00083620/.gemini/antigravity/scratch/autobom-pro/remediation-plan.md) — Full specification with Definition of Done per phase, dependency graph, regression risk matrix, and timeline.

### Purpose

Stabilize and harden the Engineering Management Platform after rapid iterative development across 11 feature phases. Focus on auditability, traceability, consistency, and regression prevention — **without breaking existing production functionality**.

### Key Findings

| Area | Current State | Target |
|------|--------------|--------|
| Test coverage | 11 test files (186 tests) | ≥ 70% on `src/core/` |
| `AppDataContext` | 332 lines (reduced from 727 by Phase M.1) | < 150 lines (fully decomposed) |
| `architecture.md` | Updated (2026-03-20) | Reflects actual structure |
| Error boundaries | Implemented at route level | All major route groups |
| CI/CD | None | Lint + Test + Build on PR |

### Protected Modules (DO NOT MODIFY)

The following modules **MUST NOT** be modified during remediation, except for mechanical import-path changes required by shared infrastructure refactoring:

- **BOM Core**: `BomProjects.jsx`, `BomProjectDetail.jsx`, `Catalog.jsx`
- **BOM Components**: `components/catalog/*`, `components/projects/*`
- **AI Import Pipeline**: `src/services/aiService.js` (extracted from AppDataContext in Phase M.1)
- **BOM Data Hook**: `src/hooks/useAutoBomData.js` (extracted from AppDataContext in Phase M.1)
- **Image Search**: `ImagePickerModal.jsx`, `searchImages` Cloud Function
- **Login/Auth**: `LoginPage.jsx`, `AuthContext.jsx`
- **Firestore Rules**: `firestore.rules`
- **Cloud Function `analyzeQuotePdf`**: Production AI pipeline

---

## Appendix A: Execution Rules

1. **Use this blueprint as the master specification** for all development phases
2. **Do not execute all phases simultaneously** — proceed one phase at a time
3. **Before each phase:** analyze the project, confirm compatibility, preserve existing functionality
4. **Never break existing AutoBOM functionality** — all changes must be additive
5. **Multi-file modularization is mandatory** — do not consolidate logic into a single file (single-file mandate eliminated as of 2026-03-20)
6. **Always analyze before implementing** — read existing code before writing new code
7. **Update this blueprint** after completing each phase
8. **Follow UI Design Standards** — use shared module banners for related pages (see Appendix B)

---

## Appendix C: Migration Notes (Phase M.1)

### Compatibility

- All 30+ consumer files that call `useAppData()` continue to work without changes
- The context value object maintains the exact same property names
- `AppDataContext.jsx` spreads `...bomData` from `useAutoBomData()` into the context value

### Import Impact

- No existing import paths were changed — `useAppData` remains the single consumer API
- New modules (`aiService.js`, `useAutoBomData.js`) are only imported by `AppDataContext.jsx`
- `firebase.js` now exports `ensureSession()` in addition to existing exports

### Known Risks

- `AppDataContext` still acts as an intermediary for BOM data — consumers do not import `useAutoBomData` directly
- `aiService.js` receives UI state callbacks as parameters; tight coupling remains at the orchestration layer
- Engineering subscriptions (tasks, projects, team) still live in `AppDataContext` — not yet extracted

### Pending Decoupling (Phase 2 — Not Implemented)

- Extract engineering Firestore subscriptions into a dedicated `useEngineeringData` hook
- Extract managed list handlers into a dedicated service
- Allow pages to import `useAutoBomData` directly instead of going through `useAppData`
- UI component extraction is explicitly out of scope until further phases

---

## Appendix B: UI Design Standards

### Shared Module Banner Pattern (TaskModuleBanner)

**Rule:** Pages that belong to the same functional module **MUST** share a common banner component with tab navigation. This replaces individual, inconsistent headers across related pages.

**Current Implementation:** `src/components/layout/TaskModuleBanner.jsx`

#### Banner Structure

```
┌──────────────────────────────────────────────────────────────────┐
│  [Icon] Title                                    [🔍] [🔔] [⚙]  [+ New Task]  [Avatar] │
│         Subtitle (active count • project count)                                        │
├──────────────────────────────────────────────────────────────────┤
│  Tareas   Weekly Planner   Gantt   Analytics   │  [page-specific toolbar ...]  │
│  ═══════                                       │                               │
└──────────────────────────────────────────────────────────────────┘
```

#### Features

| Feature | Description |
|---------|-------------|
| **Title row** | Module icon, title, subtitle with live stats, action icons, + New Task button, user avatar |
| **Tab row** | Navigation tabs between module pages, active tab has indigo underline |
| **Children slot** | Each page can inject its own controls (filters, nav, toggles) on the right side of the tab bar |
| **Auto-highlight** | Active tab detected from `location.pathname` via `react-router-dom` |

#### Pages Using the Banner

| Page | Path | Page-Specific Controls |
|------|------|------------------------|
| TaskManager | `/tasks` | Filter toggle button (collapsible filter bar) |
| WeeklyPlanner | `/planner` | Week nav (← This Week →), team/project filters, conflict badge |
| ProjectGantt | `/gantt` | View toggle (Semanal/Mensual), date nav, range label, filters, refresh |
| EngineeringAnalytics | `/analytics` | *(to be added)* |

#### Rules for Adding New Pages to a Module Banner

1. Import `TaskModuleBanner` from `../components/layout/TaskModuleBanner.jsx`
2. Pass `onNewTask` callback and `canEdit` prop
3. Use the `children` slot for page-specific controls (filters, toggles, etc.)
4. **Do not** create a separate header — all module context lives in the banner
5. Add the page's path and label to the `TABS` array inside `TaskModuleBanner.jsx`

#### When to Create a New Banner

If a group of 2+ pages share a functional domain (e.g., BOM Management, Reports), create a dedicated `<ModuleBanner>` following the same pattern:
- Row 1: Icon + Title + Stats + Actions
- Row 2: Tabs + page-specific controls via children slot
