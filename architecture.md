# Architecture — Engineering Management Platform

> **Version:** 3.0  
> **Last Updated:** 2026-03-20  
> **Status:** Reflects actual codebase state (post Phase M.1 modularization)

---

## 1. High-Level Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                        CLIENT (Browser)                       │
│                                                               │
│  React 19.2 + Vite 7.3 + Tailwind CSS                       │
│                                                               │
│  Contexts ─── Pages ─── Components ─── Hooks                 │
│      │            │          │            │                    │
│      └───── Services ────── Core ────────┘                    │
│              │                │                               │
│         Firebase SDK     Rule Engine                          │
│              │           Audit Engine                         │
│              │           Analytics                            │
│              │                                               │
│         firebase.js ←── aiService.js                         │
│              ↑           useAutoBomData.js                   │
│         ensureSession()                                       │
└──────────────┼───────────────────────────────────────────────┘
               │
     ┌─────────▼─────────┐
     │   Firebase Cloud    │
     │                     │
     │ • Firestore (17+)  │
     │ • Cloud Fns v2     │
     │ • Auth (Google)    │
     │ • Hosting          │
     └─────────┬─────────┘
               │
     ┌─────────▼─────────┐
     │  Gemini 2.5 Flash  │
     │  Google CSE         │
     └────────────────────┘
```

---

## 2. Actual File Structure

```
autobom-pro/
├── src/
│   ├── main.jsx                         # StrictMode → AuthProvider → RoleProvider → AppDataProvider → App
│   ├── App.jsx                          # Route definitions only (133 lines)
│   ├── firebase.js                      # Firebase SDK init + ensureSession() utility [Phase M.1]
│   ├── index.css                        # Tailwind base
│   │
│   ├── pages/                           # 24 route-level components
│   │   ├── Dashboard.jsx                # Obeya-style KPI dashboard
│   │   ├── ControlTower.jsx             # Executive command center
│   │   ├── MyWork.jsx                   # Personal task + planner view
│   │   ├── TaskManager.jsx              # Kanban board
│   │   ├── MainTable.jsx                # Table/grid task view
│   │   ├── WeeklyPlanner.jsx            # Drag-and-drop weekly scheduler
│   │   ├── ProjectGantt.jsx             # Gantt chart
│   │   ├── WorkLogs.jsx                 # Time tracking history
│   │   ├── DailyReports.jsx             # Daily engineering reports
│   │   ├── WeeklyReports.jsx            # Weekly summaries
│   │   ├── EngineeringAnalytics.jsx     # Analytics dashboard
│   │   ├── AuditFindings.jsx            # Compliance findings
│   │   ├── Team.jsx                     # Team overview with metrics
│   │   ├── Notifications.jsx            # Notification center
│   │   ├── Projects.jsx                 # Engineering project list
│   │   ├── ProjectDetailPage.jsx        # Project detail view
│   │   ├── BomProjects.jsx              # BOM project list
│   │   ├── BomProjectDetail.jsx         # BOM detail + items
│   │   ├── Catalog.jsx                  # Master parts catalog
│   │   ├── ManagedListsPage.jsx         # Brands/Categories/Providers
│   │   ├── AutomationControlCenter.jsx  # Automation management
│   │   ├── MilestoneDetailPage.jsx      # Milestone detail view
│   │   ├── MilestoneHistoryPage.jsx     # Milestone history
│   │   ├── AIMonitoringPage.jsx         # AI monitoring dashboard
│   │   ├── DailyScrumPage.jsx           # Daily scrum view
│   │   ├── PlatformOverview.jsx         # Platform overview / how it works
│   │   ├── Settings.jsx                 # ⚠️ Placeholder
│   │   └── PlaceholderPage.jsx          # Placeholder template
│   │
│   ├── components/                      # 14 feature directories
│   │   ├── admin/                       # UserAdminPanel, SuperAdminRecovery
│   │   ├── audit/                       # ComplianceScoreCards, FindingsTable, AIInsightsPanel
│   │   ├── auth/                        # LoginPage
│   │   ├── catalog/                     # CatalogPickerModal, ImagePickerModal, MasterRecordModal
│   │   ├── delays/                      # DelayReportModal
│   │   ├── gantt/                       # GanttChart, GanttBar, GanttControlBar, GanttMilestone
│   │   ├── layout/                      # Sidebar, TopBar, MobileNav, TaskManagementBanner
│   │   ├── mywork/                      # TaskSection, TimeSection, PlannerSection, etc.
│   │   ├── planner/                     # PlannerGrid, PlannerSidebar, PlannerTaskModal, etc.
│   │   ├── projects/                    # BomItemEditModal, PdfReviewModal
│   │   ├── tasks/                       # KanbanBoard, TaskCard, TaskDetailModal, TaskHeader, editor/*
│   │   ├── time/                        # TimerWidget, TimeLogEntry
│   │   ├── ui/                          # ConfirmDialog, FilterPopover, ListManagerModal, SearchableDropdown
│   │   └── workflow/                    # WorkflowTransitionButton
│   │
│   ├── contexts/                        # 3 contexts
│   │   ├── AuthContext.jsx              # Firebase Auth state
│   │   ├── RoleContext.jsx              # RBAC (admin/editor/viewer) + super admin recovery
│   │   └── AppDataContext.jsx           # Orchestration layer (332 lines — reduced from 727 by Phase M.1)
│   │
│   ├── hooks/                           # 6 custom hooks
│   │   ├── useAutoBomData.js            # [Phase M.1] BOM Firestore subscriptions + CRUD handlers
│   │   ├── useAnalyticsData.js          # Analytics snapshot generation
│   │   ├── useAuditData.js              # Audit engine orchestration
│   │   ├── useGeminiInsights.js         # AI insight generation
│   │   ├── useMyWorkData.js             # Personal dashboard data
│   │   └── useWorkflowTransition.js     # Task status transition with validation
│   │
│   ├── services/                        # 19 service modules
│   │   ├── aiService.js                 # [Phase M.1] PDF/Excel import + Gemini AI connectivity
│   │   ├── taskService.js               # Task CRUD (protected fields via CF)
│   │   ├── plannerService.js            # Weekly plan items CRUD + validation
│   │   ├── timeService.js               # Time log CRUD + timer
│   │   ├── delayService.js              # Delay reporting
│   │   ├── reportService.js             # Report generation
│   │   ├── riskService.js               # Project risk calculation
│   │   ├── ganttService.js              # Gantt data operations
│   │   ├── auditPersistence.js          # Audit result persistence
│   │   ├── userProfileService.js        # User profile management
│   │   ├── milestoneService.js          # Milestone operations
│   │   ├── workAreaService.js           # Work area management
│   │   ├── ganttPlannerSync.js          # Gantt-planner synchronization
│   │   ├── resourceAssignmentService.js # Resource assignment
│   │   ├── mappingService.js            # Data mapping
│   │   ├── aiGovernanceService.js       # AI governance
│   │   ├── aiTraceService.js            # AI tracing
│   │   ├── auditTrailService.js         # Audit trail operations
│   │   └── userSettingsHelpers.js       # User settings utilities
│   │
│   ├── core/                            # 5 engine directories
│   │   ├── ai/                          # geminiService, insightGenerator, promptBuilder
│   │   ├── analytics/                   # snapshotBuilder, teamUtilization, index, analyticsEngine
│   │   ├── audit/                       # auditEngine, complianceScorer, findingBuilder
│   │   ├── rules/                       # taskRules, projectRules, plannerRules, userDisciplineRules, ruleEvaluator
│   │   └── workflow/                    # workflowModel, transitionValidator, workflowConfig
│   │
│   ├── models/
│   │   └── schemas.js                   # All Firestore document schemas + constants
│   │
│   └── utils/
│       ├── normalizers.js               # P/N normalization
│       ├── plannerUtils.js              # Planner validation engine (B1-B7, W1-W5)
│       └── taskNormalizer.js            # Legacy field normalization
│
├── functions/
│   ├── index.js                         # Cloud Functions: transitionTaskStatus, scheduledAudit, weeklyBriefGenerator, + BOM functions
│   └── package.json
│
├── firestore.rules                      # Security rules (17+ collections)
├── blueprint.md                         # Master spec
├── architecture.md                      # This file
├── GEMINI.md                            # AI dev guidelines
└── remediation-plan.md                  # Audit remediation tracking
```

---

## 3. Modularization History

### Phase M.1 — Core Logic & Services (2026-03-20)

**Before:**

| File | Lines | Role |
|------|-------|------|
| `AppDataContext.jsx` | 727 | Monolith: all Firestore subs, PDF/Excel/AI logic, BOM CRUD, modals, engineering subs |
| `firebase.js` | 22 | Firebase SDK init only |

**After:**

| File | Lines | Role |
|------|-------|------|
| `firebase.js` | 63 | Firebase SDK init + `ensureSession()` auth utility |
| `services/aiService.js` | 313 | PDF text extraction, Gemini analysis, Excel import, batch writes (stateless, React-free) |
| `hooks/useAutoBomData.js` | 275 | BOM Firestore subscriptions, computed values, CRUD handlers |
| `AppDataContext.jsx` | 332 | Orchestration layer: imports from new modules, keeps engineering subs + managed lists |

**Rule change:** The single-file mandate for `App.jsx` / `AppDataContext.jsx` was officially eliminated. Multi-file modularization is now mandatory. This is the only rule that was modified; all other rules, restrictions, and conventions remain intact.

---

## 4. Module Responsibilities (Post Phase M.1)

### `src/firebase.js`

- Firebase SDK initialization (`initializeApp`, `getFirestore`, `getFunctions`, `getAuth`)
- `GoogleAuthProvider` instance
- `ensureSession(timeoutMs)` — returns a Promise that resolves with the authenticated user once auth state is confirmed; rejects on timeout

### `src/services/aiService.js`

- `extractPdfText(file)` — PDF.js text extraction from uploaded file
- `analyzePdfWithAI(text)` — sends text to `analyzeQuotePdf` Cloud Function
- `buildReviewItems(aiData, currentCatalog, providers)` — matches AI results against catalog
- `handlePdfUpload(file, project, providers, callbacks)` — full PDF upload pipeline
- `executePdfImport(reviewedData, activeProject)` — batch Firestore write after review
- `executeExcelImport(file, callbacks)` — full Excel import pipeline
- `testGeminiConnection(callbacks)` — Gemini API connectivity test

All functions are stateless. UI state side effects (`setIsProcessing`, `setProcessingStatus`, etc.) are injected via a `callbacks` parameter.

### `src/hooks/useAutoBomData.js`

- Owns BOM state: `proyectos`, `catalogo`, `bomItems`, `managedLists`
- Firestore subscriptions: `proyectos_bom`, `catalogo_maestro`, `items_bom`, `categorias`, `proveedores`, `marcas`
- Computed values: `brandOptions`, `categoryOptions`, `providerOptions`
- Modal state: master record modal, image picker, lightbox
- CRUD handlers: `handleSaveProject`, `saveMasterRecord`, `handleUpdateBomItem`, `handleAddFromCatalog`, `handleImageSelect`, `handleEditClick`
- Refs: `pdfInputRef`, `excelInputRef`

### `src/contexts/AppDataContext.jsx` (Orchestration Layer)

**What it still owns:**
- Engineering Firestore subscriptions: `projects`, `tasks`, `subtasks`, `taskTypes`, `workAreaTypes`, `milestoneTypes`, `users`, `timeLogs`, `delayCauses`, `delays`
- Processing state: `isProcessing`, `processingStatus`, `isDiagnosticOpen`, `lastError`
- Shared modal state: `confirmDelete`, `listManager`, `isPdfReviewOpen`, `pdfReviewData`, `pdfSupplierAnalysis`, `isDelayReportOpen`, `delayReportTarget`
- Managed list handlers for: `taskType`, `workAreaType`, `milestoneType`, `category`, `provider`, `brand`
- Wrapper functions that connect `aiService` to UI state callbacks

**What it delegates:**
- BOM data → `useAutoBomData()` (spread via `...bomData` into context value)
- AI/PDF/Excel logic → `aiService.js` functions called with UI state callbacks

---

## 5. Dependency Graph (Post Phase M.1)

```
┌─────────────┐
│  firebase.js │ ← Foundation: SDK init, auth, Firestore, Functions
└──────┬──────┘
       │
       ├──────────────────────┐
       │                      │
┌──────▼──────┐    ┌──────────▼─────────┐
│ aiService.js │    │ useAutoBomData.js   │
│ (stateless)  │    │ (React hook)        │
└──────┬──────┘    └──────────┬──────────┘
       │                      │
       └──────────┬───────────┘
                  │
         ┌────────▼────────┐
         │ AppDataContext   │
         │ (orchestration)  │
         └────────┬────────┘
                  │
         ┌────────▼────────┐
         │  useAppData()    │ ← 30+ consumer files (pages, components, hooks)
         └─────────────────┘
```

**Key constraint:** All consumers still access data exclusively through `useAppData()`. The new modules are internal to `AppDataContext` and not imported directly by pages or components.

---

## 6. Source of Truth by Domain

| Domain | Source of Truth | Location | Notes |
|--------|---------------|----------|-------|
| **Authentication** | Firebase Auth | `AuthContext.jsx` | Google Sign-In |
| **RBAC** (admin/editor/viewer) | `users_roles/{uid}` | `RoleContext.jsx`, `firestore.rules` | Separate from team roles |
| **Team Profile** | `users/{uid}` | `userProfileService.js` | `teamRole`, `weeklyCapacityHours`, `displayName` |
| **BOM Data** | `proyectos_bom`, `catalogo_maestro`, `items_bom` | `useAutoBomData.js` [Phase M.1] | Subscriptions + CRUD |
| **BOM Managed Lists** | `marcas`, `categorias`, `proveedores` | `useAutoBomData.js` [Phase M.1] | Subscriptions; CRUD in AppDataContext |
| **AI/PDF/Excel Import** | Cloud Function + client | `aiService.js` [Phase M.1] | Stateless service |
| **Tasks** | `tasks` collection | `taskService.js`, CF `transitionTaskStatus` | Status transitions enforced by CF |
| **Task Status Machine** | `workflowModel.js` | `src/core/workflow/` | Canonical: CF mirrors this model |
| **Planner** | `weeklyPlanItems` | `plannerService.js` | Validated by `plannerUtils.js` (B1-B7 blocking) |
| **Audit Events** | `auditEvents` | CF `transitionTaskStatus` | Immutable append-only trail |
| **Audit Findings** | `auditFindings` | CF `scheduledAudit` + client | Server is official; client is advisory |
| **Analytics Snapshots** | `analyticsSnapshots` | CF `scheduledAudit` | Server-generated periodic snapshots |
| **Risk Scores** | `projects.riskScore` | `riskService.js` | Client-calculated, stored on project doc |
| **Notifications** | `notifications` | `Notifications.jsx` | User-scoped, system-generated |
| **Time Logs** | `timeLogs` | `timeService.js` | User-created, admin-editable |

---

## 7. Workflow: Task Status Transitions

```
Backlog → Planned(pending) → In Progress → Review(validation) → Completed
                                    ↕                ↕
                                 Blocked          Blocked
                                    ↕
                                Cancelled        Completed → In Progress (reopen)
                                                 Cancelled → Backlog (reactivate)
```

**Enforcement:** Status changes go through CF `transitionTaskStatus` which:
1. Validates transition is allowed (mirrors `workflowModel.js`)
2. Checks required fields (e.g., `blockedReason` for blocked)
3. Sets `completedDate` on completion, clears on reopen
4. Writes immutable `auditEvent` per transition
5. Firestore rules block direct client writes to `status`, `completedDate`, `updatedAt`

---

## 8. Audit Trail Strategy

| Layer | What it produces | Persistence | Official? |
|-------|-----------------|-------------|-----------|
| **CF `transitionTaskStatus`** | `auditEvent` per status change | Same batch as status write | ✅ Yes — guaranteed atomicity |
| **CF `scheduledAudit`** | `auditFindings` + compliance scores | Batch write | ✅ Yes — server source |
| **Client `auditEngine`** | Findings + scores (via `useAuditData`) | Optional (`saveToFirestore`) | ⚠️ Advisory — for UI feedback |

**Immutability:** `auditEvents` collection has no update/delete rules. Append-only.

---

## 9. Security Architecture (Actual)

| Collection | Read | Create | Update | Delete |
|------------|------|--------|--------|--------|
| `users_roles` | auth'd | self only (viewer) | admin | admin |
| `users` | auth'd | self bootstrap | self or admin | admin |
| `tasks` | auth'd | auth'd | auth'd (non-protected) | admin |
| `tasks.status` (protected) | — | — | CF only | — |
| `weeklyPlanItems` | auth'd | auth'd | auth'd | auth'd |
| `timeLogs` | auth'd | auth'd | auth'd | auth'd |
| `delays` | auth'd | auth'd | auth'd | admin |
| `auditEvents` | auth'd | auth'd | ❌ blocked | ❌ blocked |
| `auditFindings` | auth'd | auth'd | admin | admin |
| `notifications` | own only | admin/CF | own (`read` field only) | admin |
| BOM collections | auth'd | editor+ | editor+ | admin |

---

## 10. Data Field Contract

Official field names for `tasks` collection (see `schemas.js` for full contract):

| Field | Official Name | Deprecated Aliases |
|-------|--------------|-------------------|
| Completion timestamp | `completedDate` | ~~`completedAt`~~ |
| Blocked reason | `blockedReason` | ~~`blockReason`~~ |
| Status "Planned" | `pending` (DB) | Display: "Planificado" |
| Status "Review" | `validation` (DB) | Display: "En Revisión" |

Legacy documents are normalized at read-time via `taskNormalizer.js`.

---

## 11. Cloud Functions

| Function | Type | Purpose |
|----------|------|---------|
| `transitionTaskStatus` | onCall | Official task status transitions + audit event |
| `scheduledAudit` | onSchedule (daily 6AM) | Rule evaluation + findings + compliance scores |
| `weeklyBriefGenerator` | onSchedule (Mon 7AM) | Gemini-generated executive brief |
| `testGeminiConnection` | onCall | Gemini API connectivity test |
| `analyzeQuotePdf` | onCall | PDF text analysis with Gemini |
| `searchImages` | onCall | Google CSE image proxy |

---

## 12. Migration Notes (Phase M.1)

### Compatibility

- All 30+ consumer files that call `useAppData()` continue to work without changes
- The context value object maintains the exact same property names
- `AppDataContext.jsx` spreads `...bomData` from `useAutoBomData()` into the context value

### Import Impact

- No existing import paths were changed — `useAppData` remains the single consumer API
- New modules (`aiService.js`, `useAutoBomData.js`) are only imported by `AppDataContext.jsx`
- `firebase.js` now exports `ensureSession()` in addition to existing exports (`db`, `functions`, `auth`, `googleProvider`)

### Known Risks

- `AppDataContext` still acts as an intermediary for BOM data — consumers do not import `useAutoBomData` directly
- `aiService.js` receives UI state callbacks as parameters; tight coupling remains at the orchestration layer
- Engineering subscriptions (tasks, projects, team, etc.) still live in `AppDataContext` — not yet extracted
- Managed list handlers span both BOM and engineering scopes — clean separation requires further analysis

### Recommended Next Steps (Not Implemented)

- Extract engineering Firestore subscriptions into a dedicated `useEngineeringData` hook
- Extract managed list handlers into a dedicated service
- Allow pages to import `useAutoBomData` directly instead of going through `useAppData`
- UI component extraction is explicitly out of scope until further phases
