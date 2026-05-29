/**
 * useEngineeringData — Supabase Implementation
 * ==============================================
 * Drop-in replacement for useEngineeringData.jsx (Firestore version).
 *
 * KEY DIFFERENCES:
 * - Uses Supabase Realtime channels instead of Firestore onSnapshot
 * - Maps snake_case DB columns → camelCase for frontend compatibility
 * - Same API contract: { engTasks, engProjects, teamMembers, isReady, ... }
 *
 * Supabase Realtime listens to PostgreSQL changes via WAL (Write-Ahead Log),
 * so we get INSERT/UPDATE/DELETE events automatically.
 *
 * @module hooks/useEngineeringData.supabase
 */

import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../supabase';
import { useAuth } from '../contexts/AuthContext';

const safeLocaleCompare = (a, b, field) =>
    String(a[field] || '').localeCompare(String(b[field] || ''));

const TOTAL_TABLES = 12;

// ── Context ──
const EngineeringDataContext = createContext(null);

export function useEngineeringData() {
    const context = useContext(EngineeringDataContext);
    if (!context) {
        throw new Error(
            'useEngineeringData() must be used within an <EngineeringDataProvider>. '
        );
    }
    return context;
}

export function EngineeringDataProvider({ children }) {
    const { user } = useAuth();
    const [engProjects, setEngProjects] = useState([]);
    const [engTasks, setEngTasks] = useState([]);
    const [engSubtasks, setEngSubtasks] = useState([]);
    const [taskTypes, setTaskTypes] = useState([]);
    const [workAreaTypes, setWorkAreaTypes] = useState([]);
    const [milestoneTypes, setMilestoneTypes] = useState([]);
    const [teamMembers, setTeamMembers] = useState([]);
    const [timeLogs, setTimeLogs] = useState([]);
    const [delayCauses, setDelayCauses] = useState([]);
    const [delays, setDelays] = useState([]);
    const [timingActions, setTimingActions] = useState([]);
    const [motionProfiles, setMotionProfiles] = useState([]);

    // --- Global Task Filters ---
    const [taskSearch, setTaskSearch] = useState('');
    const [taskFilterProject, setTaskFilterProject] = useState('');
    const [taskFilterAssignee, setTaskFilterAssignee] = useState('');
    const [taskFilterPriority, setTaskFilterPriority] = useState('');
    const [taskFilterArea, setTaskFilterArea] = useState('');



    const [isReady, setIsReady] = useState(false);
    const loadedCountRef = useRef(0);
    const readyFiredRef = useRef(false);

    const markLoaded = useCallback(() => {
        loadedCountRef.current += 1;
        if (!readyFiredRef.current && loadedCountRef.current >= TOTAL_TABLES) {
            readyFiredRef.current = true;
            setIsReady(true);
        }
    }, []);

    // ── Refetch: on-demand data refresh for specific tables ──
    // Components call refetch('tasks') after mutations to guarantee instant UI update.
    const refetchTable = useCallback(async (tableName) => {
        const config = {
            projects:       { query: 'projects',        setter: setEngProjects,   mapper: mapProject,     sort: (a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0) },
            tasks:          { query: 'tasks',            setter: setEngTasks,      mapper: mapTask },
            subtasks:       { query: 'subtasks',         setter: setEngSubtasks,   mapper: mapSubtask },
            task_types:     { query: 'task_types',       setter: setTaskTypes,     mapper: mapTaskType,    sort: (a, b) => safeLocaleCompare(a, b, 'name') },
            work_area_types:{ query: 'work_area_types',  setter: setWorkAreaTypes, mapper: r => ({ ...r, defaultTaskTypes: r.default_task_types || [] }),sort: (a, b) => safeLocaleCompare(a, b, 'name') },
            milestone_types:{ query: 'milestone_types',  setter: setMilestoneTypes,mapper: r => ({ ...r, defaultWorkAreas: r.default_work_areas || [] }),sort: (a, b) => safeLocaleCompare(a, b, 'name') },
            users:          { query: 'users',            setter: setTeamMembers,   mapper: mapUser },
            time_logs:      { query: 'time_logs',        setter: setTimeLogs,      mapper: mapTimeLog,     sort: (a, b) => new Date(b.startTime || 0) - new Date(a.startTime || 0) },
            delay_causes:   { query: 'delay_causes',     setter: setDelayCauses,   mapper: mapDelayCause,  sort: (a, b) => (a.order || 0) - (b.order || 0) },
            delays:         { query: 'delays',           setter: setDelays,        mapper: mapDelay,       sort: (a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0) },
        };
        const c = config[tableName];
        if (!c) { console.warn(`[refetch] Unknown table: ${tableName}`); return; }
        const { data, error } = await supabase.from(c.query).select('*');
        if (error) { console.error(`[refetch] ${tableName}:`, error.message); return; }
        const mapped = (data || []).map(c.mapper);
        c.setter(c.sort ? mapped.sort(c.sort) : mapped);
    }, []);

    useEffect(() => {
        // ── Initial data fetch ──
        // Supabase Realtime only pushes CHANGES. We need to fetch initial state first.

        async function fetchInitial() {
            const [
                { data: proj }, { data: tasks }, { data: subs },
                { data: tt }, { data: wa }, { data: mt },
                { data: users }, { data: tl }, { data: dc }, { data: del },
                { data: ta },
                { data: mp },
            ] = await Promise.all([
                supabase.from('projects').select('*'),
                supabase.from('tasks').select('*'),
                supabase.from('subtasks').select('*'),
                supabase.from('task_types').select('*'),
                supabase.from('work_area_types').select('*'),
                supabase.from('milestone_types').select('*'),
                supabase.from('users').select('*'),
                supabase.from('time_logs').select('*'),
                supabase.from('delay_causes').select('*'),
                supabase.from('delays').select('*'),
                supabase.from('timing_actions').select('*'),
                supabase.from('motion_profiles').select('*'),
            ]);

            setEngProjects((proj || []).map(mapProject).sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)));
            markLoaded();
            setEngTasks((tasks || []).map(mapTask));
            markLoaded();
            setEngSubtasks((subs || []).map(mapSubtask));
            markLoaded();
            setTaskTypes((tt || []).map(mapTaskType).sort((a, b) => safeLocaleCompare(a, b, 'name')));
            markLoaded();
            setWorkAreaTypes((wa || []).map(r => ({ ...r, defaultTaskTypes: r.default_task_types || [] })).sort((a, b) => safeLocaleCompare(a, b, 'name')));
            markLoaded();
            setMilestoneTypes((mt || []).map(r => ({ ...r, defaultWorkAreas: r.default_work_areas || [] })).sort((a, b) => safeLocaleCompare(a, b, 'name')));
            markLoaded();
            setTeamMembers((users || []).map(mapUser));
            markLoaded();
            setTimeLogs((tl || []).map(mapTimeLog).sort((a, b) => new Date(b.startTime || 0) - new Date(a.startTime || 0)));
            markLoaded();
            setDelayCauses((dc || []).map(mapDelayCause).sort((a, b) => (a.order || 0) - (b.order || 0)));
            markLoaded();
            setDelays((del || []).map(mapDelay).sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)));
            markLoaded();
            setTimingActions((ta || []).map(r => ({ id: r.id, name: r.name, description: r.description || '' })).sort((a, b) => safeLocaleCompare(a, b, 'name')));
            markLoaded();
            setMotionProfiles((mp || []).map(r => ({ id: r.id, name: r.name, value: r.value, unit: r.unit })).sort((a, b) => safeLocaleCompare(a, b, 'name')));
            markLoaded();
        }

        fetchInitial().catch(err => {
            console.error('[useEngineeringData.sb] Initial fetch failed:', err);
        });

        // ── Realtime subscriptions ──
        const channel = supabase.channel('engineering-data');

        // Helper: apply realtime event to a state array
        function applyEvent(setter, mapper, event) {
            if (event.eventType === 'DELETE') {
                const deletedId = event.old?.id || event.old?.uid;
                if (deletedId) {
                    setter(prev => prev.filter(item => (item.id || item.uid) !== deletedId));
                }
                return;
            }

            const record = event.new;
            if (!record) return;

            const mapped = mapper(record);
            const mappedId = mapped.id || mapped.uid;
            if (!mappedId) return;

            if (event.eventType === 'INSERT') {
                setter(prev => {
                    if (prev.some(item => (item.id || item.uid) === mappedId)) {
                        return prev;
                    }
                    return [...prev, mapped];
                });
            } else if (event.eventType === 'UPDATE') {
                setter(prev => prev.map(item => {
                    const itemId = item.id || item.uid;
                    return itemId === mappedId ? mapped : item;
                }));
            }
        }

        const tableConfig = {
            'projects': { setter: setEngProjects, mapper: mapProject },
            'tasks': { setter: setEngTasks, mapper: mapTask },
            'subtasks': { setter: setEngSubtasks, mapper: mapSubtask },
            'task_types': { setter: setTaskTypes, mapper: mapTaskType },
            'work_area_types': { setter: setWorkAreaTypes, mapper: r => ({ ...r, defaultTaskTypes: r.default_task_types || [] }) },
            'milestone_types': { setter: setMilestoneTypes, mapper: r => ({ ...r, defaultWorkAreas: r.default_work_areas || [] }) },
            'users': { setter: setTeamMembers, mapper: mapUser },
            'time_logs': { setter: setTimeLogs, mapper: mapTimeLog },
            'delay_causes': { setter: setDelayCauses, mapper: mapDelayCause },
            'delays': { setter: setDelays, mapper: mapDelay },
            'timing_actions': { setter: setTimingActions, mapper: r => ({ id: r.id, name: r.name, description: r.description || '' }) },
            'motion_profiles': { setter: setMotionProfiles, mapper: r => ({ id: r.id, name: r.name, value: r.value, unit: r.unit }) },
        };

        channel.on(
            'postgres_changes',
            { event: '*', schema: 'public' },
            (payload) => {
                const config = tableConfig[payload.table];
                if (config) {
                    applyEvent(config.setter, config.mapper, payload);
                }
            }
        );

        channel.subscribe((status) => {
            if (status === 'SUBSCRIBED') {
                console.log('[useEngineeringData.sb] ✅ Realtime subscribed');
            }
        });

        return () => {
            supabase.removeChannel(channel);
        };
    }, [markLoaded, user?.uid]);

    const value = {
        engProjects, engTasks, engSubtasks,
        taskTypes, workAreaTypes, milestoneTypes,
        teamMembers, timeLogs, delayCauses, delays,
        timingActions, setTimingActions,
        motionProfiles, setMotionProfiles,
        isReady,
        refetch: refetchTable,
        // Global Filters
        taskSearch, setTaskSearch,
        taskFilterProject, setTaskFilterProject,
        taskFilterAssignee, setTaskFilterAssignee,
        taskFilterPriority, setTaskFilterPriority,
        taskFilterArea, setTaskFilterArea,
    };

    return (
        <EngineeringDataContext.Provider value={value}>
            {children}
        </EngineeringDataContext.Provider>
    );
}

// ══════════════════════════════════════════════
// MAPPERS: snake_case → camelCase
// ══════════════════════════════════════════════

function mapProject(r) {
    if (!r) return {};
    return {
        id: r.id, name: r.name, description: r.description,
        client: r.client, priority: r.priority, status: r.status,
        ownerId: r.owner_id, teamMemberIds: r.team_member_ids,
        startDate: r.start_date, dueDate: r.due_date,
        completedDate: r.completed_date, progress: r.progress,
        bomProjectId: r.bom_project_id, tags: r.tags,
        riskScore: r.risk_score, riskLevel: r.risk_level,
        riskFactors: r.risk_factors, riskSummary: r.risk_summary,
        riskUpdatedAt: r.risk_updated_at,
        createdAt: r.created_at, createdBy: r.created_by,
        updatedAt: r.updated_at,
    };
}

function mapTask(r) {
    if (!r) return {};
    return {
        id: r.id, projectId: r.project_id,
        title: r.title, description: r.description,
        status: r.status, priority: r.priority,
        taskTypeId: r.task_type_id,
        assignedTo: r.assigned_to, assignedBy: r.assigned_by,
        estimatedHours: r.estimated_hours, actualHours: r.actual_hours,
        dueDate: r.due_date, completedDate: r.completed_date,
        tags: r.tags, stationId: r.station_id,
        milestoneId: r.milestone_id, areaId: r.area_id,
        workAreaTypeId: r.area_id, // legacy alias used by MainTable
        countsForScore: r.counts_for_score,
        peerReviewRequired: r.peer_review_required,
        peerReviewDiscipline: r.peer_review_discipline,
        peerReviewStatus: r.peer_review_status,
        peerReviewCycles: r.peer_review_cycles,
        currentPeerReviewId: r.current_peer_review_id,
        lastPeerReviewerId: r.last_peer_reviewer_id,
        lastPeerReviewAt: r.last_peer_review_at,
        showInGantt: r.show_in_gantt,
        plannedStartDate: r.planned_start_date,
        plannedEndDate: r.planned_end_date,
        plannedDurationHours: r.planned_duration_hours,
        percentComplete: r.percent_complete,
        milestone: r.milestone, summaryTask: r.summary_task,
        parentTaskId: r.parent_task_id,
        ganttViewModeDefault: r.gantt_view_mode_default,
        networkPath: r.network_path,
        blockedReason: r.blocked_reason,
        blockedByUserId: r.blocked_by_user_id,
        blockedByName: r.blocked_by_name,
        blockedAt: r.blocked_at,
        unblockedAt: r.unblocked_at,
        totalBlockedHours: r.total_blocked_hours,
        sortOrder: r.sort_order,
        createdAt: r.created_at, createdBy: r.created_by,
        updatedAt: r.updated_at,
    };
}

function mapSubtask(r) {
    if (!r) return {};
    return {
        id: r.id, taskId: r.task_id,
        title: r.title, completed: r.completed,
        completedAt: r.completed_at, order: r.order,
        createdAt: r.created_at,
    };
}

function mapTaskType(r) {
    if (!r) return {};
    return {
        id: r.id, firestoreId: r.firestore_id,
        name: r.name, icon: r.icon, color: r.color,
        active: r.active, sortOrder: r.sort_order,
        peerReviewRequired: r.peer_review_required,
        peerReviewSections: r.peer_review_sections,
    };
}

function mapUser(r) {
    if (!r) return {};
    return {
        uid: r.id, id: r.id,
        displayName: r.display_name, email: r.email,
        teamRole: r.team_role, rbacRole: r.rbac_role,
        department: r.department,
        reportsTo: r.reports_to,
        weeklyCapacityHours: r.weekly_capacity_hours,
        photoURL: r.photo_url,
        active: r.active, theme: r.theme,
    };
}

function mapTimeLog(r) {
    if (!r) return {};
    return {
        id: r.id, taskId: r.task_id, projectId: r.project_id,
        userId: r.user_id, startTime: r.start_time, endTime: r.end_time,
        totalHours: r.total_hours, totalHoursGross: r.total_hours_gross,
        breakHoursDeducted: r.break_hours_deducted,
        overtime: r.overtime, overtimeHours: r.overtime_hours,
        notes: r.notes, taskTitle: r.task_title,
        projectName: r.project_name, displayName: r.display_name,
        source: r.source, autoStopped: r.auto_stopped,
        createdAt: r.created_at,
    };
}

function mapDelayCause(r) {
    if (!r) return {};
    return {
        id: r.id, name: r.name, description: r.description,
        active: r.active, order: r.sort_order,
    };
}

function mapDelay(r) {
    if (!r) return {};
    return {
        id: r.id, projectId: r.project_id, taskId: r.task_id,
        causeId: r.cause_id, causeName: r.cause_name,
        comment: r.comment, impact: r.impact,
        resolved: r.resolved, resolvedAt: r.resolved_at,
        createdBy: r.created_by, createdAt: r.created_at,
    };
}
