/**
 * DependencyArrows
 * ================
 * SVG overlay that draws arrows between dependent tasks (FS / SS).
 * Arrows are rendered as horizontal-then-vertical-then-horizontal paths.
 */

import React from 'react';

/**
 * @param {{
 *   dependencies: Array<{ predecessorTaskId, successorTaskId, type }>,
 *   taskRowMap: Map<string, { top: number, left: number, width: number }>,
 *                 // taskId → computed position in the timeline
 *   rowHeight: number,
 *   svgWidth: number,
 *   svgHeight: number,
 * }} props
 */
export default function DependencyArrows({ dependencies, taskRowMap, rowHeight, svgWidth, svgHeight }) {
    if (!dependencies?.length || !taskRowMap) return null;

    const ARROW_COLOR = '#6366f1'; // indigo-500
    const MARKER_SIZE = 6;

    const paths = [];

    for (const dep of dependencies) {
        const pred = taskRowMap.get(dep.predecessorTaskId);
        const succ = taskRowMap.get(dep.successorTaskId);
        if (!pred || !succ) continue;

        const midY = rowHeight / 2;
        let x1, y1, x2, y2;

        const type = dep.type || 'FS';
        let d;

        if (type === 'SS') {
            // Start-to-Start: from left edge of predecessor to left edge of successor
            x1 = pred.left;
            y1 = pred.top + midY;
            x2 = succ.left;
            y2 = succ.top + midY;

            const leftX = x2 > x1 ? x1 - 10 : x2 - 10;
            d = `M ${x1} ${y1} H ${leftX} V ${y2} H ${x2}`;
        } else if (type === 'FF') {
            // Finish-to-Finish: from right edge of predecessor to right edge of successor
            x1 = pred.left + pred.width;
            y1 = pred.top + midY;
            x2 = succ.left + succ.width;
            y2 = succ.top + midY;

            const rightX = x2 > x1 ? x2 + 10 : x1 + 10;
            d = `M ${x1} ${y1} H ${rightX} V ${y2} H ${x2}`;
        } else if (type === 'SF') {
            // Start-to-Finish: from left edge of predecessor to right edge of successor
            x1 = pred.left;
            y1 = pred.top + midY;
            x2 = succ.left + succ.width;
            y2 = succ.top + midY;

            if (x2 > x1 + 15) {
                const rightX = x2 + 10;
                d = `M ${x1} ${y1} H ${rightX} V ${y2} H ${x2}`;
            } else {
                const leftX = x1 - 10;
                const rightX = x2 + 10;
                const midY2 = (y1 + y2) / 2;
                d = `M ${x1} ${y1} H ${leftX} V ${midY2} H ${rightX} V ${y2} H ${x2}`;
            }
        } else {
            // Finish-to-Start (default): from right edge of predecessor to left edge of successor
            x1 = pred.left + pred.width;
            y1 = pred.top + midY;
            x2 = succ.left;
            y2 = succ.top + midY;

            if (x2 > x1 + 15) {
                const midX = (x1 + x2) / 2;
                d = `M ${x1} ${y1} H ${midX} V ${y2} H ${x2}`;
            } else {
                const rightX = x1 + 10;
                const leftX = x2 - 10;
                const midY2 = (y1 + y2) / 2;
                d = `M ${x1} ${y1} H ${rightX} V ${midY2} H ${leftX} V ${y2} H ${x2}`;
            }
        }


        paths.push(
            <path
                key={`${dep.predecessorTaskId}-${dep.successorTaskId}`}
                d={d}
                fill="none"
                stroke={ARROW_COLOR}
                strokeWidth={1.5}
                strokeDasharray="5,3"
                markerEnd="url(#arrowhead)"
                opacity={0.7}
            />
        );
    }

    return (
        <svg
            className="absolute inset-0 pointer-events-none"
            width={svgWidth}
            height={svgHeight}
            style={{ overflow: 'visible', zIndex: 4 }}
        >
            <defs>
                <marker
                    id="arrowhead"
                    markerWidth={MARKER_SIZE}
                    markerHeight={MARKER_SIZE}
                    refX={MARKER_SIZE - 1}
                    refY={MARKER_SIZE / 2}
                    orient="auto"
                >
                    <path
                        d={`M 0 0 L ${MARKER_SIZE} ${MARKER_SIZE / 2} L 0 ${MARKER_SIZE} Z`}
                        fill={ARROW_COLOR}
                        opacity={0.7}
                    />
                </marker>
            </defs>
            {paths}
        </svg>
    );
}
