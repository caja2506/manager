import React, { useState, useRef, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, Zap, AlertTriangle, ArrowRightLeft, Loader2 } from 'lucide-react';
import { getWorkingSlots, getWorkingDays } from '../../services/autoPlannerService';
import { plannerService } from '../../services/plannerService';
import { getBreakBands } from '../../utils/breakTimeUtils';

/**
 * AvailabilityCalendar — hotel-booking style date picker.
 *
 * Each cell shows the remaining available hours for the assignee
 * with a traffic-light color code:
 *   🟢 ≥4h available (green)
 *   🟡 1–4h available (yellow/amber)
 *   🔴 <1h available  (red)
 *   ⬛ Weekend / disabled
 *
 * When a "full" day is clicked, suggests overtime instead of blocking.
 */

// ── Helpers ────────────────────────────────────────────────────

const DAYS_SHORT = ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá', 'Do'];
const MONTHS = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

function fmtDate(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${dd}`;
}

function isSameDay(a, b) {
    return a.getFullYear() === b.getFullYear()
        && a.getMonth() === b.getMonth()
        && a.getDate() === b.getDate();
}

function isWeekend(d) {
    const dow = d.getDay();
    return dow === 0 || dow === 6;
}

// ── Main Component ──────────────────────────────────────────────

export default function AvailabilityCalendar({
    value,           // YYYY-MM-DD string
    onChange,         // (YYYY-MM-DD) => void
    planItems = [],  // all weeklyPlanItems for the assignee
    assignedTo,      // uid to filter planItems
    minDate,         // optional Date — no selection before this
    disabled = false,
    onPlanItemsChanged, // optional callback when displacement modifies plan items
}) {
    const [open, setOpen] = useState(false);
    const [viewMonth, setViewMonth] = useState(() => {
        if (value) {
            const d = new Date(value + 'T00:00:00');
            return { year: d.getFullYear(), month: d.getMonth() };
        }
        const now = new Date();
        return { year: now.getFullYear(), month: now.getMonth() };
    });
    const [overtimePrompt, setOvertimePrompt] = useState(null);
    const [popoverPos, setPopoverPos] = useState({ top: 0, left: 0 });
    const [isDisplacing, setIsDisplacing] = useState(false);

    const triggerRef = useRef(null);
    const popoverRef = useRef(null);

    // Compute popover position when opening
    useEffect(() => {
        if (!open || !triggerRef.current) return;
        const r = triggerRef.current.getBoundingClientRect();
        const spaceBelow = window.innerHeight - r.bottom;
        setPopoverPos({
            top: spaceBelow > 380 ? r.bottom + 6 : r.top - 380,
            left: Math.min(r.left, window.innerWidth - 330),
        });
    }, [open]);

    // Close on outside click
    useEffect(() => {
        if (!open) return;
        const handler = (e) => {
            if (popoverRef.current && !popoverRef.current.contains(e.target)
                && triggerRef.current && !triggerRef.current.contains(e.target)) {
                setOpen(false);
                setOvertimePrompt(null);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [open]);

    // ── Capacity calculation ───────────────────────────────────
    const dailyCapacity = useMemo(() => {
        const bands = getBreakBands();
        const slots = getWorkingSlots(bands);
        return slots.reduce((sum, s) => sum + s.hours, 0);
    }, []);

    // Build a map: dateStr → hours already planned for this assignee
    const occupiedMap = useMemo(() => {
        const map = {};
        for (const item of planItems) {
            if (assignedTo && item.assignedTo !== assignedTo) continue;
            const d = item.date;
            if (!d) continue;
            map[d] = (map[d] || 0) + (item.plannedHours || 0);
        }
        return map;
    }, [planItems, assignedTo]);

    function getAvailableHours(dateStr) {
        const occupied = occupiedMap[dateStr] || 0;
        return Math.max(0, dailyCapacity - occupied);
    }

    // ── Calendar grid ──────────────────────────────────────────

    const { year, month } = viewMonth;
    const firstOfMonth = new Date(year, month, 1);
    const lastOfMonth = new Date(year, month + 1, 0);

    // Monday = 0 in our grid (ISO week)
    let startDow = firstOfMonth.getDay() - 1;
    if (startDow < 0) startDow = 6;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const cells = [];

    // Empty cells before first day
    for (let i = 0; i < startDow; i++) {
        cells.push({ type: 'empty', key: `e-${i}` });
    }

    // Day cells
    for (let d = 1; d <= lastOfMonth.getDate(); d++) {
        const date = new Date(year, month, d);
        const dateStr = fmtDate(date);
        const wk = isWeekend(date);
        const available = wk ? 0 : getAvailableHours(dateStr);
        const isPast = date < today;
        const isToday = isSameDay(date, today);
        const isSelected = value === dateStr;
        const isDisabled = disabled || (minDate && date < minDate);

        cells.push({
            type: 'day',
            key: dateStr,
            day: d,
            date,
            dateStr,
            wk,
            available,
            isPast,
            isToday,
            isSelected,
            isDisabled,
        });
    }

    function handleDayClick(cell) {
        if (cell.isDisabled || cell.isPast) return;

        if (cell.wk) {
            // Weekend — suggest overtime
            setOvertimePrompt({
                dateStr: cell.dateStr,
                available: 0,
                reason: 'weekend',
                message: `📅 ${cell.day}/${month + 1} es fin de semana. ¿Planificar como overtime?`
            });
            return;
        }

        if (cell.available < 1) {
            // Full day — suggest overtime
            setOvertimePrompt({
                dateStr: cell.dateStr,
                available: cell.available,
                reason: 'full',
                message: `⚡ ${cell.day}/${month + 1} está lleno (${cell.available.toFixed(1)}h libre). ¿Planificar como overtime?`
            });
            return;
        }

        // Normal selection
        onChange(cell.dateStr);
        setOpen(false);
        setOvertimePrompt(null);
    }

    function confirmOvertime() {
        if (overtimePrompt) {
            onChange(overtimePrompt.dateStr);
            setOpen(false);
            setOvertimePrompt(null);
        }
    }

    async function confirmDisplace() {
        if (!overtimePrompt || isDisplacing) return;
        setIsDisplacing(true);
        try {
            const dateStr = overtimePrompt.dateStr;
            // Get items on that day for this assignee
            const dayItems = planItems.filter(p =>
                p.date === dateStr && (!assignedTo || p.assignedTo === assignedTo)
            );

            if (dayItems.length === 0) {
                // Nothing to displace — just select
                onChange(dateStr);
                setOpen(false);
                setOvertimePrompt(null);
                setIsDisplacing(false);
                return;
            }

            // Find next available working days starting from day after selected
            const startFrom = new Date(dateStr + 'T00:00:00');
            startFrom.setDate(startFrom.getDate() + 1);
            const futureDays = getWorkingDays(startFrom, null, 30);

            // Build capacity map for future days
            const futureOccupied = {};
            for (const item of planItems) {
                if (assignedTo && item.assignedTo !== assignedTo) continue;
                const d = item.date;
                if (d) futureOccupied[d] = (futureOccupied[d] || 0) + (item.plannedHours || 0);
            }

            // Move each item to the next day with available capacity
            for (const item of dayItems) {
                const hours = item.plannedHours || 1;
                let moved = false;

                for (const futureDay of futureDays) {
                    const futureDateStr = fmtDate(futureDay);
                    const occupied = futureOccupied[futureDateStr] || 0;
                    const available = dailyCapacity - occupied;

                    if (available >= hours) {
                        // Calculate new start/end times
                        const startHour = 8 + occupied;
                        const endHour = startHour + hours;
                        const newStart = `${futureDateStr}T${String(Math.floor(startHour)).padStart(2, '0')}:${startHour % 1 === 0.5 ? '30' : '00'}:00`;
                        const newEnd = `${futureDateStr}T${String(Math.floor(endHour)).padStart(2, '0')}:${endHour % 1 === 0.5 ? '30' : '00'}:00`;

                        await plannerService.updatePlanItem(item.id, {
                            date: futureDateStr,
                            startDateTime: newStart,
                            endDateTime: newEnd,
                        });

                        futureOccupied[futureDateStr] = occupied + hours;
                        moved = true;
                        break;
                    }
                }

                if (!moved) {
                    console.warn(`[AvailabilityCalendar] Could not find space for item ${item.id}`);
                }
            }

            // Notify parent that plan items changed
            if (onPlanItemsChanged) onPlanItemsChanged();

            // Select the now-freed date
            onChange(dateStr);
            setOpen(false);
            setOvertimePrompt(null);
        } catch (err) {
            console.error('[AvailabilityCalendar] Displacement error:', err);
        }
        setIsDisplacing(false);
    }

    function prevMonth() {
        setViewMonth(({ year: y, month: m }) => m === 0 ? { year: y - 1, month: 11 } : { year: y, month: m - 1 });
        setOvertimePrompt(null);
    }
    function nextMonth() {
        setViewMonth(({ year: y, month: m }) => m === 11 ? { year: y + 1, month: 0 } : { year: y, month: m + 1 });
        setOvertimePrompt(null);
    }

    // ── Color helpers ──────────────────────────────────────────
    function getCellColor(cell) {
        if (cell.wk) return 'bg-slate-800/40 text-slate-600';
        if (cell.isPast) return 'bg-slate-800/20 text-slate-700';
        if (cell.isSelected) return 'bg-indigo-600 text-white ring-2 ring-indigo-400';
        if (cell.available >= 4) return 'bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25';
        if (cell.available >= 1) return 'bg-amber-500/15 text-amber-300 hover:bg-amber-500/25';
        return 'bg-red-500/15 text-red-300 hover:bg-red-500/25';
    }

    function getDotColor(available, wk) {
        if (wk) return 'bg-slate-700';
        if (available >= 4) return 'bg-emerald-400';
        if (available >= 1) return 'bg-amber-400';
        return 'bg-red-400';
    }

    // ── Render ──────────────────────────────────────────────────

    const displayValue = value || '';

    const popoverContent = open ? (
        <div
            ref={popoverRef}
            className="fixed z-[99999] bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl p-4 w-[320px] animate-in fade-in zoom-in-95 duration-150"
            style={{
                top: popoverPos.top,
                left: popoverPos.left,
            }}
        >
            {/* Month navigation */}
            <div className="flex items-center justify-between mb-3">
                <button type="button" onClick={prevMonth} className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors">
                    <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-sm font-black text-slate-200 tracking-wide">
                    {MONTHS[month]} {year}
                </span>
                <button type="button" onClick={nextMonth} className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors">
                    <ChevronRight className="w-4 h-4" />
                </button>
            </div>

            {/* Day headers */}
            <div className="grid grid-cols-7 gap-0.5 mb-1">
                {DAYS_SHORT.map(d => (
                    <div key={d} className="text-center text-[9px] font-black text-slate-500 uppercase tracking-widest py-1">
                        {d}
                    </div>
                ))}
            </div>

            {/* Day cells */}
            <div className="grid grid-cols-7 gap-0.5">
                {cells.map(cell => {
                    if (cell.type === 'empty') {
                        return <div key={cell.key} className="h-11" />;
                    }

                    const clickable = !cell.isDisabled && !cell.isPast;

                    return (
                        <button
                            key={cell.key}
                            type="button"
                            onClick={() => clickable && handleDayClick(cell)}
                            disabled={!clickable}
                            className={`h-11 rounded-lg flex flex-col items-center justify-center transition-all relative ${getCellColor(cell)} ${
                                clickable ? 'cursor-pointer active:scale-95' : 'cursor-not-allowed opacity-50'
                            } ${cell.isToday ? 'ring-1 ring-indigo-500/50' : ''}`}
                        >
                            <span className={`text-xs font-bold leading-none ${cell.isSelected ? 'text-white' : ''}`}>
                                {cell.day}
                            </span>
                            {!cell.wk && !cell.isPast && (
                                <>
                                    <div className={`w-1.5 h-1.5 rounded-full mt-0.5 ${getDotColor(cell.available, cell.wk)}`} />
                                    <span className={`text-[7px] font-bold leading-none mt-0 ${
                                        cell.isSelected ? 'text-white/80' : 'opacity-60'
                                    }`}>
                                        {cell.available.toFixed(0)}h
                                    </span>
                                </>
                            )}
                        </button>
                    );
                })}
            </div>

            {/* Legend */}
            <div className="flex items-center justify-center gap-3 mt-3 pt-3 border-t border-slate-800">
                <span className="flex items-center gap-1 text-[8px] text-slate-400">
                    <span className="w-2 h-2 rounded-full bg-emerald-400" /> ≥4h
                </span>
                <span className="flex items-center gap-1 text-[8px] text-slate-400">
                    <span className="w-2 h-2 rounded-full bg-amber-400" /> 1–4h
                </span>
                <span className="flex items-center gap-1 text-[8px] text-slate-400">
                    <span className="w-2 h-2 rounded-full bg-red-400" /> &lt;1h
                </span>
                <span className="flex items-center gap-1 text-[8px] text-slate-400">
                    <span className="w-2 h-2 rounded-full bg-slate-700" /> N/D
                </span>
            </div>

            {/* Capacity footer */}
            <div className="text-center mt-2 text-[9px] text-slate-500">
                Capacidad: {dailyCapacity.toFixed(1)}h/día neto (sin breaks)
            </div>

            {/* Overtime prompt */}
            {overtimePrompt && (
                <div className="mt-3 p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl animate-in fade-in slide-in-from-bottom-2 duration-200">
                    <div className="flex items-start gap-2">
                        {overtimePrompt.reason === 'weekend'
                            ? <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                            : <Zap className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                        }
                        <p className="text-[11px] text-amber-300 font-medium leading-snug">
                            {overtimePrompt.message}
                        </p>
                    </div>
                    <div className="flex gap-2 mt-2">
                        <button
                            type="button"
                            onClick={() => setOvertimePrompt(null)}
                            disabled={isDisplacing}
                            className="px-2 py-1.5 text-[10px] font-bold bg-slate-800 text-slate-400 rounded-lg hover:bg-slate-700 transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            type="button"
                            onClick={confirmOvertime}
                            disabled={isDisplacing}
                            className="flex-1 px-2 py-1.5 text-[10px] font-bold bg-amber-600 text-white rounded-lg hover:bg-amber-500 transition-colors flex items-center justify-center gap-1"
                        >
                            <Zap className="w-3 h-3" /> Overtime
                        </button>
                        {overtimePrompt.reason !== 'weekend' && (
                            <button
                                type="button"
                                onClick={confirmDisplace}
                                disabled={isDisplacing}
                                className="flex-1 px-2 py-1.5 text-[10px] font-bold bg-indigo-600 text-white rounded-lg hover:bg-indigo-500 transition-colors flex items-center justify-center gap-1"
                            >
                                {isDisplacing
                                    ? <><Loader2 className="w-3 h-3 animate-spin" /> Moviendo...</>
                                    : <><ArrowRightLeft className="w-3 h-3" /> Desplazar</>
                                }
                            </button>
                        )}
                    </div>
                </div>
            )}
        </div>
    ) : null;

    return (
        <div className="relative">
            {/* Trigger — styled like the existing date inputs */}
            <button
                ref={triggerRef}
                type="button"
                onClick={(e) => { e.stopPropagation(); !disabled && setOpen(!open); }}
                disabled={disabled}
                className={`w-full px-2.5 py-1.5 border rounded-lg text-xs text-left outline-none transition-all flex items-center justify-between gap-1 ${
                    disabled
                        ? 'border-slate-700/50 bg-slate-800/50 text-slate-500 cursor-not-allowed'
                        : open
                            ? 'border-indigo-500 ring-2 ring-indigo-500 bg-slate-800 text-slate-200'
                            : 'border-slate-700 bg-slate-800 text-slate-200 hover:border-slate-600'
                }`}
            >
                <span className={displayValue ? 'text-slate-200' : 'text-slate-500'}>
                    {displayValue || 'Seleccionar...'}
                </span>
                <svg className="w-3.5 h-3.5 text-slate-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
            </button>

            {/* Portal the popover to body to avoid overflow clipping */}
            {popoverContent && createPortal(popoverContent, document.body)}
        </div>
    );
}
