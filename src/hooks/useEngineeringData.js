/**
 * useEngineeringData — Domain hook for real-time engineering data.
 * ================================================================
 * [Phase M.3] Extracted from AppDataContext to establish clear ownership
 * over the 10 core Firestore subscriptions that power the engineering modules.
 *
 * This hook provides ALL real-time engineering data:
 *   - engProjects, engTasks, engSubtasks (core entities)
 *   - taskTypes, workAreaTypes, milestoneTypes (configuration)
 *   - teamMembers (operational profiles from 'users' collection)
 *   - timeLogs (time tracking records)
 *   - delayCauses, delays (delay management)
 *
 * AppDataContext now delegates to this hook instead of managing subscriptions directly.
 * Consumers that only need engineering data can import this hook directly,
 * reducing their dependency on the global useAppData().
 *
 * @module hooks/useEngineeringData
 */

import { useState, useEffect } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { COLLECTIONS } from '../models/schemas';
import { db } from '../firebase';

const safeLocaleCompare = (a, b, field) =>
    String(a[field] || '').localeCompare(String(b[field] || ''));

export function useEngineeringData() {
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

    useEffect(() => {
        const unsubEngProjects = onSnapshot(collection(db, COLLECTIONS.PROJECTS), s =>
            setEngProjects(s.docs.map(d => ({ ...d.data(), id: d.id })).sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)))
        );
        const unsubEngTasks = onSnapshot(collection(db, COLLECTIONS.TASKS), s =>
            setEngTasks(s.docs.map(d => ({ ...d.data(), id: d.id })))
        );
        const unsubEngSubtasks = onSnapshot(collection(db, COLLECTIONS.SUBTASKS), s =>
            setEngSubtasks(s.docs.map(d => ({ ...d.data(), id: d.id })))
        );
        const unsubTaskTypes = onSnapshot(collection(db, COLLECTIONS.TASK_TYPES), s =>
            setTaskTypes(s.docs.map(d => ({ ...d.data(), id: d.id })).sort((a, b) => safeLocaleCompare(a, b, 'name')))
        );
        const unsubWorkAreaTypes = onSnapshot(collection(db, COLLECTIONS.WORK_AREA_TYPES), s =>
            setWorkAreaTypes(s.docs.map(d => ({ ...d.data(), id: d.id })).sort((a, b) => safeLocaleCompare(a, b, 'name')))
        );
        const unsubMilestoneTypes = onSnapshot(collection(db, COLLECTIONS.MILESTONE_TYPES), s =>
            setMilestoneTypes(s.docs.map(d => ({ ...d.data(), id: d.id })).sort((a, b) => safeLocaleCompare(a, b, 'name')))
        );
        // IMPORTANT: Loads from `users` collection (operational profiles),
        // NOT from `users_roles` (RBAC only). This ensures teamRole and
        // weeklyCapacityHours are available to dashboards, analytics, and planner.
        const unsubTeamMembers = onSnapshot(collection(db, COLLECTIONS.USERS), s =>
            setTeamMembers(s.docs.map(d => ({ ...d.data(), uid: d.id })))
        );
        const unsubTimeLogs = onSnapshot(collection(db, COLLECTIONS.TIME_LOGS), s =>
            setTimeLogs(s.docs.map(d => ({ ...d.data(), id: d.id })).sort((a, b) => new Date(b.startTime || 0) - new Date(a.startTime || 0)))
        );
        const unsubDelayCauses = onSnapshot(collection(db, COLLECTIONS.DELAY_CAUSES), s =>
            setDelayCauses(s.docs.map(d => ({ ...d.data(), id: d.id })).sort((a, b) => (a.order || 0) - (b.order || 0)))
        );
        const unsubDelays = onSnapshot(collection(db, COLLECTIONS.DELAYS), s =>
            setDelays(s.docs.map(d => ({ ...d.data(), id: d.id })).sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)))
        );

        return () => {
            unsubEngProjects(); unsubEngTasks(); unsubEngSubtasks();
            unsubTaskTypes(); unsubWorkAreaTypes(); unsubMilestoneTypes();
            unsubTeamMembers(); unsubTimeLogs();
            unsubDelayCauses(); unsubDelays();
        };
    }, []);

    return {
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
    };
}
