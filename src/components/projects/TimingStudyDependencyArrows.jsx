import React from 'react';

/**
 * TimingStudyDependencyArrows
 * ==========================
 * SVG overlay that draws arrows between dependent steps (FS).
 * Arrows are rendered as horizontal-then-vertical-then-horizontal paths.
 */
export default function TimingStudyDependencyArrows({ dependencies, taskRowMap, rowHeight, svgWidth, svgHeight }) {
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

        // Finish-to-Start: from right edge of predecessor to left edge of successor
        x1 = pred.left + pred.width;
        y1 = pred.top + midY;
        x2 = succ.left;
        y2 = succ.top + midY;

        const gap = 10;
        let d;
        if (x2 > x1 + gap * 2) {
            // Simple elbow: right → down/up → right
            const midX = x1 + gap;
            d = `M ${x1} ${y1} H ${midX} V ${y2} H ${x2}`;
        } else {
            // U-shape loop around if successor starts before predecessor finishes
            const loopX = Math.max(x1, x2) + 20;
            d = `M ${x1} ${y1} H ${loopX} V ${y2} H ${x2}`;
        }

        paths.push(
            <path
                key={`${dep.predecessorTaskId}-${dep.successorTaskId}`}
                d={d}
                fill="none"
                stroke={ARROW_COLOR}
                strokeWidth={1.5}
                strokeDasharray="5,3"
                markerEnd="url(#timing-arrowhead)"
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
                    id="timing-arrowhead"
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
