/**
 * useMilestoneHistory — V5 Phase 5
 * ===================================
 * Hook that loads score snapshots for a milestone and processes
 * them into chart-ready data, area summaries, and events.
 */

import { useState, useEffect, useMemo } from 'react';
import { collection, query, where, orderBy, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { COLLECTIONS } from '../models/schemas';
import { subDays, format, isWithinInterval, startOfDay, endOfDay } from 'date-fns';
import { es } from 'date-fns/locale';

export default function useMilestoneHistory(milestoneId) {
    const [milestone, setMilestone] = useState(null);
    const [snapshots, setSnapshots] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Filters
    const [dateFrom, setDateFrom] = useState(format(subDays(new Date(), 30), 'yyyy-MM-dd'));
    const [dateTo, setDateTo] = useState(format(new Date(), 'yyyy-MM-dd'));
    const [showAreas, setShowAreas] = useState(false);
    const [selectedAreas, setSelectedAreas] = useState([]);

    // Load milestone + snapshots
    useEffect(() => {
        if (!milestoneId) return;
        setLoading(true);

        async function load() {
            try {
                // Milestone doc
                const msSnap = await getDoc(doc(db, COLLECTIONS.MILESTONES, milestoneId));
                if (!msSnap.exists()) { setError('Milestone no encontrado'); setLoading(false); return; }
                setMilestone({ id: msSnap.id, ...msSnap.data() });

                // Snapshots
                const q = query(
                    collection(db, COLLECTIONS.SCORE_SNAPSHOTS),
                    where('milestoneId', '==', milestoneId)
                );
                const snap = await getDocs(q);
                setSnapshots(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (a.capturedAt || '').localeCompare(b.capturedAt || '')));
                setLoading(false);
            } catch (err) {
                setError(err.message);
                setLoading(false);
            }
        }

        load();
    }, [milestoneId]);

    // Process chart data
    const chartData = useMemo(() => {
        if (snapshots.length === 0) return [];

        const start = startOfDay(new Date(dateFrom + 'T00:00:00'));
        const end = endOfDay(new Date(dateTo + 'T00:00:00'));

        return snapshots
            .filter(s => {
                if (!s.capturedAt) return false;
                const d = new Date(s.capturedAt);
                return isWithinInterval(d, { start, end });
            })
            .map((s, i, arr) => {
                const date = new Date(s.capturedAt);
                const prev = i > 0 ? arr[i - 1] : null;
                const delta = prev ? s.milestoneScore - prev.milestoneScore : 0;

                // Build area lines if enabled
                const areaScores = {};
                if (s.areaScores) {
                    s.areaScores.forEach(a => {
                        areaScores[`area_${a.areaId}`] = a.score;
                        areaScores[`areaName_${a.areaId}`] = a.name || a.areaId;
                    });
                }

                return {
                    date: format(date, 'dd MMM', { locale: es }),
                    fullDate: format(date, 'dd MMM yyyy HH:mm', { locale: es }),
                    score: s.milestoneScore,
                    trafficLight: s.milestoneTrafficLight,
                    trend: s.trend || 'stable',
                    changeReason: s.changeReason || '',
                    comment: s.comment || '',
                    delta,
                    locks: s.activeLocks || [],
                    snapshotType: s.snapshotType || 'unknown',
                    triggeredBy: s.triggeredBy || 'system',
                    isReconstructed: s.snapshotType === 'reconstructed',
                    ...areaScores,
                    _raw: s,
                };
            });
    }, [snapshots, dateFrom, dateTo]);

    // Available area IDs for filter
    const areaOptions = useMemo(() => {
        if (snapshots.length === 0) return [];
        const last = snapshots[snapshots.length - 1];
        return (last?.areaScores || []).map(a => ({
            value: a.areaId,
            label: a.name || a.areaId,
        }));
    }, [snapshots]);

    // Area summaries (latest snapshot)
    const areaSummaries = useMemo(() => {
        if (snapshots.length === 0) return [];
        const latest = snapshots[snapshots.length - 1];
        const prev = snapshots.length > 1 ? snapshots[snapshots.length - 2] : null;

        return (latest?.areaScores || []).map(a => {
            const prevArea = prev?.areaScores?.find(pa => pa.areaId === a.areaId);
            return {
                areaId: a.areaId,
                name: a.name || a.areaId,
                score: a.score,
                trafficLight: a.trafficLight,
                trend: a.trend || 'stable',
                delta: prevArea ? a.score - prevArea.score : 0,
            };
        });
    }, [snapshots]);

    // Events (notable changes)
    const events = useMemo(() => {
        return chartData
            .filter(d => Math.abs(d.delta) >= 5 || d.locks.length > 0 || d.comment)
            .map(d => ({
                date: d.fullDate,
                delta: d.delta,
                reason: d.changeReason,
                comment: d.comment,
                locks: d.locks,
                trafficLight: d.trafficLight,
                isReconstructed: d.isReconstructed,
            }));
    }, [chartData]);

    // Presets
    const applyPreset = (days) => {
        setDateTo(format(new Date(), 'yyyy-MM-dd'));
        setDateFrom(format(subDays(new Date(), days), 'yyyy-MM-dd'));
    };

    return {
        milestone, snapshots, chartData, areaSummaries, areaOptions, events,
        loading, error,
        dateFrom, setDateFrom, dateTo, setDateTo,
        showAreas, setShowAreas, selectedAreas, setSelectedAreas,
        applyPreset,
    };
}
