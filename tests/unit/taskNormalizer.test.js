/**
 * Task Normalizer — Unit Tests
 * ============================
 * Tests legacy field normalization for backward compatibility.
 */

import { describe, it, expect } from 'vitest';
import { normalizeTask, normalizeTasks } from '../../src/utils/taskNormalizer';

describe('taskNormalizer', () => {

    describe('normalizeTask', () => {
        it('returns null for null input', () => {
            expect(normalizeTask(null)).toBeNull();
        });

        it('maps completedAt → completedDate when completedDate is absent', () => {
            const raw = { id: 't1', completedAt: '2026-03-10T12:00:00Z' };
            const result = normalizeTask(raw);
            expect(result.completedDate).toBe('2026-03-10T12:00:00Z');
        });

        it('does NOT overwrite existing completedDate', () => {
            const raw = { id: 't1', completedAt: 'old', completedDate: 'official' };
            const result = normalizeTask(raw);
            expect(result.completedDate).toBe('official');
        });

        it('maps blockReason → blockedReason when blockedReason is absent', () => {
            const raw = { id: 't1', blockReason: 'typo field' };
            const result = normalizeTask(raw);
            expect(result.blockedReason).toBe('typo field');
        });

        it('does NOT overwrite existing blockedReason', () => {
            const raw = { id: 't1', blockReason: 'old', blockedReason: 'official' };
            const result = normalizeTask(raw);
            expect(result.blockedReason).toBe('official');
        });

        it('passes through clean docs unchanged', () => {
            const raw = { id: 't1', status: 'completed', completedDate: '2026-03-10T12:00:00Z' };
            const result = normalizeTask(raw);
            expect(result).toEqual(raw);
        });
    });

    describe('normalizeTasks', () => {
        it('normalizes an array of tasks', () => {
            const tasks = [
                { id: 't1', completedAt: '2026-03-10T12:00:00Z' },
                { id: 't2', blockReason: 'waiting' },
            ];
            const results = normalizeTasks(tasks);
            expect(results[0].completedDate).toBe('2026-03-10T12:00:00Z');
            expect(results[1].blockedReason).toBe('waiting');
        });

        it('returns non-array input as-is', () => {
            expect(normalizeTasks(null)).toBeNull();
        });
    });
});
