# Architecture — Engineering Management Platform

> **Version:** 2.0  
> **Last Updated:** 2026-03-14  
> **Status:** Reflects actual codebase state

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
│   ├── App.jsx                          # Layout shell + react-router-dom Router
│   ├── firebase.js                      # Firebase SDK init
│   ├── index.css                        # Tailwind base
│   │
│   ├── pages/                           # 21 route-level components
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
│   │   ├── BomProjects.jsx              # BOM project list
│   │   ├── BomProjectDetail.jsx         # BOM detail + items
│   │   ├── Catalog.jsx                  # Master parts catalog
│   │   ├── ManagedListsPage.jsx         # Brands/Categories/Providers
│   │   ├── Settings.jsx                 # ⚠️ Placeholder
│   │   └── PlaceholderPage.jsx          # Placeholder template (used by Settings only)
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
│   │   └── AppDataContext.jsx           # Centralized Firestore subscriptions + handlers
│   │
│   ├── hooks/                           # 5 custom hooks
│   │   ├── useAnalyticsData.js          # Analytics snapshot generation
│   │   ├── useAuditData.js              # Audit engine orchestration
│   │   ├── useGeminiInsights.js         # AI insight generation
│   │   ├── useMyWorkData.js             # Personal dashboard data
│   │   └── useWorkflowTransition.js     # Task status transition with validation
│   │
│   ├── services/                        # 9 service modules
│   │   ├── taskService.js               # Task CRUD (protected fields via CF)
│   │   ├── plannerService.js            # Weekly plan items CRUD + validation
│   │   ├── timeService.js               # Time log CRUD + timer
│   │   ├── delayService.js              # Delay reporting
│   │   ├── reportService.js             # Report generation
│   │   ├── riskService.js               # Project risk calculation
│   │   ├── ganttService.js              # Gantt data operations
│   │   ├── auditPersistence.js          # Audit result persistence
│   │   └── userProfileService.js        # User profile management
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

## 3. Source of Truth by Domain

| Domain | Source of Truth | Location | Notes |
|--------|---------------|----------|-------|
| **Authentication** | Firebase Auth | `AuthContext.jsx` | Google Sign-In |
| **RBAC** (admin/editor/viewer) | `users_roles/{uid}` | `RoleContext.jsx`, `firestore.rules` | Separate from team roles |
| **Team Profile** | `users/{uid}` | `userProfileService.js` | `teamRole`, `weeklyCapacityHours`, `displayName` |
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

## 4. Workflow: Task Status Transitions

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

## 5. Audit Trail Strategy

| Layer | What it produces | Persistence | Official? |
|-------|-----------------|-------------|-----------|
| **CF `transitionTaskStatus`** | `auditEvent` per status change | Same batch as status write | ✅ Yes — guaranteed atomicity |
| **CF `scheduledAudit`** | `auditFindings` + compliance scores | Batch write | ✅ Yes — server source |
| **Client `auditEngine`** | Findings + scores (via `useAuditData`) | Optional (`saveToFirestore`) | ⚠️ Advisory — for UI feedback |

**Immutability:** `auditEvents` collection has no update/delete rules. Append-only.

---

## 6. Security Architecture (Actual)

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

## 7. Data Field Contract

Official field names for `tasks` collection (see `schemas.js` for full contract):

| Field | Official Name | Deprecated Aliases |
|-------|--------------|-------------------|
| Completion timestamp | `completedDate` | ~~`completedAt`~~ |
| Blocked reason | `blockedReason` | ~~`blockReason`~~ |
| Status "Planned" | `pending` (DB) | Display: "Planificado" |
| Status "Review" | `validation` (DB) | Display: "En Revisión" |

Legacy documents are normalized at read-time via `taskNormalizer.js`.

---

## 8. Cloud Functions

| Function | Type | Purpose |
|----------|------|---------|
| `transitionTaskStatus` | onCall | Official task status transitions + audit event |
| `scheduledAudit` | onSchedule (daily 6AM) | Rule evaluation + findings + compliance scores |
| `weeklyBriefGenerator` | onSchedule (Mon 7AM) | Gemini-generated executive brief |
| `testGeminiConnection` | onCall | Gemini API connectivity test |
| `analyzeQuotePdf` | onCall | PDF text analysis with Gemini |
| `searchImages` | onCall | Google CSE image proxy |
