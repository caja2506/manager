/**
 * useMilestoneScore — V5 Phase 4
 * =================================
 * Hook that loads milestone data, work areas, tasks, and computes
 * the full score using the score engine. Provides all data needed
 * for the MilestoneDetailPage.
 *
 * V5: Score uses PERSISTED areaId on tasks, NOT runtime taskFilter matching.
 *
 * @module hooks/useMilestoneScore
 */

import { useState, useEffect, useMemo } from 'react';
import { doc, onSnapshot, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { COLLECTIONS } from '../models/schemas';
import { computeFullScore } from '../services/milestoneService';

/**
 * @param {string} milestoneId
 * @returns {{ milestone, workAreas, tasks, scoreResult, ranking, loading, error }}
 */
export default function useMilestoneScore(milestoneId) {
    const [milestone, setMilestone] = useState(null);
    const [workAreas, setWorkAreas] = useState([]);
    const [tasks, setTasks] = useState([]);
    const [snapshots, setSnapshots] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // 1. Subscribe to milestone document
    useEffect(() => {
        if (!milestoneId) return;
        setLoading(true);

        const unsub = onSnapshot(
            doc(db, COLLECTIONS.MILESTONES, milestoneId),
            (snap) => {
                if (snap.exists()) {
                    setMilestone({ id: snap.id, ...snap.data() });
                } else {
                    setError('Milestone no encontrado');
                }
            },
            (err) => setError(err.message)
        );

        return () => unsub();
    }, [milestoneId]);

    // 2. Load work areas + tasks + snapshots when milestone loads
    useEffect(() => {
        if (!milestone?.projectId) return;

        async function loadData() {
            try {
                // Work areas for this milestone
                const areasQ = query(
                    collection(db, COLLECTIONS.WORK_AREAS),
                    where('milestoneId', '==', milestoneId)
                );
                const areasSnap = await getDocs(areasQ);
                const areas = areasSnap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (a.order || 0) - (b.order || 0));
                setWorkAreas(areas);

                // V5: Load tasks that belong to THIS milestone (via persisted milestoneId)
                const tasksQ = query(
                    collection(db, COLLECTIONS.TASKS),
                    where('milestoneId', '==', milestoneId)
                );
                const tasksSnap = await getDocs(tasksQ);
                const milestoneTasks = tasksSnap.docs.map(d => ({ id: d.id, ...d.data() }));
                setTasks(milestoneTasks);

                // Score snapshots for trend
                const snapQ = query(
                    collection(db, COLLECTIONS.SCORE_SNAPSHOTS),
                    where('milestoneId', '==', milestoneId)
                );
                const snapSnap = await getDocs(snapQ);
                setSnapshots(snapSnap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (b.capturedAt || '').localeCompare(a.capturedAt || '')));

                setLoading(false);
            } catch (err) {
                setError(err.message);
                setLoading(false);
            }
        }

        loadData();
    }, [milestone?.projectId, milestoneId]);

    // 3. Compute scores using PERSISTED areaId (V5 — no runtime filtering)
    const scoreResult = useMemo(() => {
        if (!milestone || workAreas.length === 0) return null;

        // V5: Build tasks-by-area using persisted areaId + countsForScore
        const tasksByArea = {};
        for (const area of workAreas) {
            tasksByArea[area.id] = tasks.filter(
                t => t.areaId === area.id && t.countsForScore === true
            );
        }

        return computeFullScore(milestone, workAreas, tasksByArea, { snapshots });
    }, [milestone, workAreas, tasks, snapshots]);

    // 4. Build attention ranking
    const ranking = useMemo(() => {
        if (!scoreResult?.areas) return [];

        return Object.entries(scoreResult.areas)
            .map(([areaId, result]) => ({
                areaId,
                name: result.areaName || areaId,
                score: result.score,
                trend: result.trend,
                trafficLight: result.trafficLight?.value,
                locks: result.locks || [],
                topBlocker: result.explanation?.blockers?.[0] || null,
                topImprovement: result.explanation?.improvements?.[0] || null,
            }))
            .sort((a, b) => {
                const colorOrder = { red: 0, yellow: 1, green: 2 };
                const colorDiff = (colorOrder[a.trafficLight] || 2) - (colorOrder[b.trafficLight] || 2);
                if (colorDiff !== 0) return colorDiff;

                const trendOrder = { declining: 0, stable: 1, improving: 2 };
                const trendDiff = (trendOrder[a.trend] || 1) - (trendOrder[b.trend] || 1);
                if (trendDiff !== 0) return trendDiff;

                return a.score - b.score;
            })
            .slice(0, 5);
    }, [scoreResult]);

    return {
        milestone,
        workAreas,
        tasks,
        scoreResult,
        ranking,
        loading,
        error,
    };
}
