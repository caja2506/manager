/**
 * useEngineeringData — Shared Context Provider for real-time engineering data.
 * =============================================================================
 * [Phase M.9] PERFORMANCE REMEDIATION
 *
 * BEFORE: Each call to useEngineeringData() created 10 independent onSnapshot
 * listeners. With 35+ consumers (3 always-mounted layout components + pages +
 * modals + derived hooks), this resulted in 50-90 redundant Firestore WebSocket
 * connections for the same 10 collections.
 *
 * AFTER: A single EngineeringDataProvider at the app root manages exactly 10
 * listeners. All consumers read from React Context — zero additional listeners.
 *
 * API CONTRACT (unchanged):
 *   const { engTasks, engProjects, teamMembers, ... } = useEngineeringData();
 *
 * COLLECTIONS SUBSCRIBED (10 total):
 *   projects, tasks, subtasks, taskTypes, workAreaTypes,
 *   milestoneTypes, users, timeLogs, delayCauses, delays
 *
 * @module hooks/useEngineeringData
 */

import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { COLLECTIONS } from '../models/schemas';
import { db } from '../firebase';

const safeLocaleCompare = (a, b, field) =>
    String(a[field] || '').localeCompare(String(b[field] || ''));

// Total number of Firestore subscriptions managed by this provider
const TOTAL_SUBSCRIPTIONS = 10;

// ── Context ──
const EngineeringDataContext = createContext(null);

/**
 * Hook to consume shared engineering data.
 * Must be used within an <EngineeringDataProvider>.
 *
 * API is identical to the previous pure-hook version:
 *   const { engTasks, engProjects, teamMembers, isReady } = useEngineeringData();
 */
export function useEngineeringData() {
    const context = useContext(EngineeringDataContext);
    if (!context) {
        throw new Error(
            'useEngineeringData() must be used within an <EngineeringDataProvider>. ' +
            'Wrap your app with <EngineeringDataProvider> in App.jsx.'
        );
    }
    return context;
}

/**
 * EngineeringDataProvider — Singleton provider for all engineering data.
 *
 * Place this ONCE at the app root (inside auth guard, outside routes).
 * Creates exactly 10 Firestore onSnapshot listeners that are shared by
 * all consumers via React Context.
 *
 * Usage in App.jsx:
 *   <EngineeringDataProvider>
 *     <AppLayout />
 *   </EngineeringDataProvider>
 */
export function EngineeringDataProvider({ children }) {
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

    // Track readiness: all subscriptions must fire at least once
    const [isReady, setIsReady] = useState(false);
    const loadedCountRef = useRef(0);
    const readyFiredRef = useRef(false);

    const markLoaded = useCallback(() => {
        loadedCountRef.current += 1;
        if (!readyFiredRef.current && loadedCountRef.current >= TOTAL_SUBSCRIPTIONS) {
            readyFiredRef.current = true;
            setIsReady(true);
        }
    }, []);

    useEffect(() => {
        const unsubEngProjects = onSnapshot(collection(db, COLLECTIONS.PROJECTS), s => {
            setEngProjects(s.docs.map(d => ({ ...d.data(), id: d.id })).sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)));
            markLoaded();
        });
        const unsubEngTasks = onSnapshot(collection(db, COLLECTIONS.TASKS), s => {
            setEngTasks(s.docs.map(d => ({ ...d.data(), id: d.id })));
            markLoaded();
        });
        const unsubEngSubtasks = onSnapshot(collection(db, COLLECTIONS.SUBTASKS), s => {
            setEngSubtasks(s.docs.map(d => ({ ...d.data(), id: d.id })));
            markLoaded();
        });
        const unsubTaskTypes = onSnapshot(collection(db, COLLECTIONS.TASK_TYPES), s => {
            setTaskTypes(s.docs.map(d => ({ ...d.data(), id: d.id })).sort((a, b) => safeLocaleCompare(a, b, 'name')));
            markLoaded();
        });
        const unsubWorkAreaTypes = onSnapshot(collection(db, COLLECTIONS.WORK_AREA_TYPES), s => {
            setWorkAreaTypes(s.docs.map(d => ({ ...d.data(), id: d.id })).sort((a, b) => safeLocaleCompare(a, b, 'name')));
            markLoaded();
        });
        const unsubMilestoneTypes = onSnapshot(collection(db, COLLECTIONS.MILESTONE_TYPES), s => {
            setMilestoneTypes(s.docs.map(d => ({ ...d.data(), id: d.id })).sort((a, b) => safeLocaleCompare(a, b, 'name')));
            markLoaded();
        });
        // IMPORTANT: Loads from `users` collection (operational profiles),
        // NOT from `users_roles` (RBAC only). This ensures teamRole and
        // weeklyCapacityHours are available to dashboards, analytics, and planner.
        const unsubTeamMembers = onSnapshot(collection(db, COLLECTIONS.USERS), s => {
            setTeamMembers(s.docs.map(d => ({ ...d.data(), uid: d.id })));
            markLoaded();
        });
        const unsubTimeLogs = onSnapshot(collection(db, COLLECTIONS.TIME_LOGS), s => {
            setTimeLogs(s.docs.map(d => ({ ...d.data(), id: d.id })).sort((a, b) => new Date(b.startTime || 0) - new Date(a.startTime || 0)));
            markLoaded();
        });
        const unsubDelayCauses = onSnapshot(collection(db, COLLECTIONS.DELAY_CAUSES), s => {
            setDelayCauses(s.docs.map(d => ({ ...d.data(), id: d.id })).sort((a, b) => (a.order || 0) - (b.order || 0)));
            markLoaded();
        });
        const unsubDelays = onSnapshot(collection(db, COLLECTIONS.DELAYS), s => {
            setDelays(s.docs.map(d => ({ ...d.data(), id: d.id })).sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)));
            markLoaded();
        });

        return () => {
            unsubEngProjects(); unsubEngTasks(); unsubEngSubtasks();
            unsubTaskTypes(); unsubWorkAreaTypes(); unsubMilestoneTypes();
            unsubTeamMembers(); unsubTimeLogs();
            unsubDelayCauses(); unsubDelays();
        };
    }, [markLoaded]);

    const value = {
        engProjects,
        engTasks,
        engSubtasks,
        taskTypes,
        workAreaTypes,
        milestoneTypes,
        teamMembers,
        timeLogs,
        delayCauses,
        delays,
        isReady,
    };

    return (
        <EngineeringDataContext.Provider value={value}>
            {children}
        </EngineeringDataContext.Provider>
    );
}
