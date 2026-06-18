import React from 'react';
import { PLANNER_START_HOUR, PLANNER_END_HOUR, SLOT_HEIGHT_PX } from './plannerConstants';

export default function PlannerSkeleton({ weekDays }) {
    const hours = Array.from({ length: PLANNER_END_HOUR - PLANNER_START_HOUR }, (_, i) => PLANNER_START_HOUR + i);

    return (
        <div className="flex flex-col h-full animate-pulse">
            {/* Header Skeleton */}
            <div className="flex shrink-0 border-b border-slate-700 bg-slate-900/50 sticky top-0 z-30">
                <div className="w-16 shrink-0 border-r border-slate-800" />
                <div className="flex flex-1 min-w-0">
                    {weekDays.map((_, i) => (
                        <div key={i} className="flex-1 border-r border-slate-800 last:border-r-0 py-4 flex flex-col items-center gap-2">
                            <div className="w-8 h-2 bg-slate-800 rounded" />
                            <div className="w-6 h-6 bg-slate-800 rounded-full" />
                        </div>
                    ))}
                </div>
            </div>

            {/* Grid Skeleton */}
            <div className="flex-1 flex overflow-hidden">
                {/* Time Ruler Skeleton */}
                <div className="w-16 shrink-0 border-r border-slate-800 bg-slate-800/30">
                    {hours.map(h => (
                        <div key={h} className="border-b border-slate-800 flex items-start justify-end pr-2 pt-1" style={{ height: SLOT_HEIGHT_PX }}>
                            <div className="w-6 h-2 bg-slate-800/50 rounded" />
                        </div>
                    ))}
                </div>

                {/* Columns Skeleton */}
                <div className="flex flex-1 min-w-0">
                    {weekDays.map((_, i) => (
                        <div key={i} className="flex-1 border-r border-slate-800 last:border-r-0 relative">
                            {hours.map(h => (
                                <div key={h} className="border-b border-slate-800/50" style={{ height: SLOT_HEIGHT_PX }} />
                            ))}
                            {/* Fake blocks */}
                            {i % 2 === 0 && (
                                <div 
                                    className="absolute left-2 right-2 bg-indigo-500/10 border border-indigo-500/20 rounded-xl"
                                    style={{ top: SLOT_HEIGHT_PX * 2, height: SLOT_HEIGHT_PX * 1.5 }}
                                />
                            )}
                            {i % 3 === 0 && (
                                <div 
                                    className="absolute left-2 right-2 bg-slate-700/20 border border-slate-700/30 rounded-xl"
                                    style={{ top: SLOT_HEIGHT_PX * 5, height: SLOT_HEIGHT_PX * 2 }}
                                />
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
