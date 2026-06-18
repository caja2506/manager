import { describe, it, expect } from 'vitest';
import {
    excelDateToISO,
    normalizeName,
    getSimilarity,
    matchUser,
    parseDependsOn,
    parseEffortToHours,
    matchExistingTask,
    matchExistingMilestone
} from '../../src/services/plannerExcelParser';

describe('Planner Excel Parser Unit Tests', () => {

    describe('excelDateToISO', () => {
        it('should convert Excel serial numbers to ISO date strings', () => {
            expect(excelDateToISO(46069.375)).toBe('2026-02-16');
            expect(excelDateToISO(46125.7083333333)).toBe('2026-04-13');
        });

        it('should pass through valid ISO strings', () => {
            expect(excelDateToISO('2026-06-18')).toBe('2026-06-18');
            expect(excelDateToISO('2026-06-18T10:00:00Z')).toBe('2026-06-18');
        });

        it('should handle Date objects', () => {
            const date = new Date(2026, 5, 18); // 18 de junio (mes indexado en 0)
            expect(excelDateToISO(date)).toBe('2026-06-18');
        });

        it('should return null for invalid values', () => {
            expect(excelDateToISO(null)).toBeNull();
            expect(excelDateToISO(undefined)).toBeNull();
            expect(excelDateToISO('')).toBeNull();
            expect(excelDateToISO('not-a-date')).toBeNull();
        });
    });

    describe('normalizeName', () => {
        it('should clean and normalize names', () => {
            expect(normalizeName('  Jorge Arce Rodríguez  ')).toBe('jorge arce rodriguez');
            expect(normalizeName('Isaac Gonzalez Chaves')).toBe('isaac gonzalez chaves');
            expect(normalizeName('Testing  Multiple   Spaces')).toBe('testing multiple spaces');
        });
    });

    describe('getSimilarity (Sorensen-Dice)', () => {
        it('should return 1.0 for identical strings', () => {
            expect(getSimilarity('Jorge Arce', 'Jorge Arce')).toBe(1.0);
        });

        it('should return 1.0 for normalized matches', () => {
            expect(getSimilarity('Jorge Arce Rodríguez', 'jorge arce rodriguez')).toBe(1.0);
        });

        it('should calculate high similarity for minor differences', () => {
            const sim = getSimilarity('Isaac Gonzalez Chaves', 'Isaac Gonzalez Ch.');
            expect(sim).toBeGreaterThanOrEqual(0.70);
        });

        it('should return 0.0 for completely different short strings', () => {
            expect(getSimilarity('a', 'b')).toBe(0.0);
        });
    });

    describe('matchUser', () => {
        const teamMembers = [
            { id: 'usr-1', displayName: 'Jorge Arce Rodríguez', email: 'jorge.arce@icu.com' },
            { id: 'usr-2', displayName: 'Isaac Gonzalez Chaves', email: 'isaac.gonzalez@icu.com' },
            { id: 'usr-3', displayName: 'Allan Cascante', email: 'allan.cascante@icu.com' }
        ];

        it('should successfully match user with high similarity name', () => {
            const match = matchUser('Jorge Arce Rodriguez', teamMembers);
            expect(match).not.toBeNull();
            expect(match.user.id).toBe('usr-1');
            expect(match.similarity).toBe(1.0);
        });

        it('should match user with minor misspelling above 75%', () => {
            const match = matchUser('Isaac Gonzales Chaves', teamMembers, 0.75);
            expect(match).not.toBeNull();
            expect(match.user.id).toBe('usr-2');
            expect(match.similarity).toBeGreaterThanOrEqual(0.75);
        });

        it('should match user based on email username', () => {
            const match = matchUser('allan.cascante', teamMembers);
            expect(match).not.toBeNull();
            expect(match.user.id).toBe('usr-3');
        });

        it('should return null if similarity is below threshold', () => {
            const match = matchUser('John Doe', teamMembers, 0.75);
            expect(match).toBeNull();
        });
    });

    describe('parseDependsOn', () => {
        it('should parse simple Finish-to-Start dependencies', () => {
            const deps = parseDependsOn('2FS');
            expect(deps).toHaveLength(1);
            expect(deps[0]).toEqual({ predecessorTaskNumber: 2, type: 'FS', lagHours: 0 });
        });

        it('should parse multiple dependencies', () => {
            const deps = parseDependsOn('2FS, 3FS, 10SS');
            expect(deps).toHaveLength(3);
            expect(deps[0]).toEqual({ predecessorTaskNumber: 2, type: 'FS', lagHours: 0 });
            expect(deps[1]).toEqual({ predecessorTaskNumber: 3, type: 'FS', lagHours: 0 });
            expect(deps[2]).toEqual({ predecessorTaskNumber: 10, type: 'SS', lagHours: 0 });
        });

        it('should assume FS if type is missing', () => {
            const deps = parseDependsOn('2');
            expect(deps).toHaveLength(1);
            expect(deps[0]).toEqual({ predecessorTaskNumber: 2, type: 'FS', lagHours: 0 });
        });

        it('should parse lag in days and convert to hours', () => {
            const deps = parseDependsOn('2FS+3, 4FS-1');
            expect(deps).toHaveLength(2);
            expect(deps[0]).toEqual({ predecessorTaskNumber: 2, type: 'FS', lagHours: 72 });
            expect(deps[1]).toEqual({ predecessorTaskNumber: 4, type: 'FS', lagHours: -24 });
        });
    });

    describe('parseEffortToHours', () => {
        it('should parse hours format', () => {
            expect(parseEffortToHours('376 hours')).toBe(376);
            expect(parseEffortToHours('80 hr')).toBe(80);
            expect(parseEffortToHours('8h')).toBe(8);
        });

        it('should parse days format and convert using 8 hours/day', () => {
            expect(parseEffortToHours('2 days')).toBe(16);
            expect(parseEffortToHours('3d')).toBe(24);
        });

        it('should parse plain numbers', () => {
            expect(parseEffortToHours(40)).toBe(40);
            expect(parseEffortToHours('40')).toBe(40);
        });

        it('should return null for empty/invalid values', () => {
            expect(parseEffortToHours('')).toBeNull();
            expect(parseEffortToHours(null)).toBeNull();
            expect(parseEffortToHours(undefined)).toBeNull();
        });
    });

    describe('matchExistingTask and matchExistingMilestone', () => {
        const existingTasks = [
            { id: 'task-1', title: 'Start Debugging' },
            { id: 'task-2', title: 'Initial Project Documents' }
        ];

        const existingMilestones = [
            { id: 'm-1', name: 'Design Phase' },
            { id: 'm-2', name: 'Testing & Commissioning' }
        ];

        it('should match existing tasks with minor spelling variations', () => {
            // "Start Debubbing" (errata) vs "Start Debugging"
            const match = matchExistingTask('Start Debubbing', existingTasks, 0.75);
            expect(match).not.toBeNull();
            expect(match.id).toBe('task-1');

            // Completamente diferente
            const noMatch = matchExistingTask('Procurement Phase', existingTasks, 0.75);
            expect(noMatch).toBeNull();
        });

        it('should match existing milestones with spelling variations', () => {
            // "Design Phasee" vs "Design Phase"
            const match = matchExistingMilestone('Design Phasee', existingMilestones, 0.75);
            expect(match).not.toBeNull();
            expect(match.id).toBe('m-1');

            // "Testing & Commisioning" (con una 'm') vs "Testing & Commissioning"
            const match2 = matchExistingMilestone('Testing & Commisioning', existingMilestones, 0.75);
            expect(match2).not.toBeNull();
            expect(match2.id).toBe('m-2');
        });
    });

});
