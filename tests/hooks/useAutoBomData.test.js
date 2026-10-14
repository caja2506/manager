// @vitest-environment jsdom
import { act, createElement, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
    auth: { user: null, loading: true },
    rows: {},
    gate: null,
    requests: [],
    channels: [],
}));

vi.mock('../../src/contexts/AuthContext', () => ({ useAuth: () => state.auth }));
vi.mock('../../src/supabase', () => ({
    supabase: {
        from: vi.fn((table) => {
            const rows = [...(state.rows[table] || [])];
            const gate = state.gate;
            const request = { table, signal: null, start: 0, end: Infinity };
            state.requests.push(request);
            const query = {
                select: () => query,
                order: () => query,
                range: (start, end) => {
                    Object.assign(request, { start, end });
                    return query;
                },
                abortSignal: (signal) => {
                    request.signal = signal;
                    return query;
                },
                // Deliberately allow late responses even after abort, so the test
                // verifies the hook also ignores results from an old session.
                then: (resolve, reject) => Promise.resolve(gate)
                    .then(() => ({ data: rows.slice(request.start, request.end + 1), error: null }))
                    .then(resolve, reject),
            };
            return query;
        }),
        channel: vi.fn((topic) => {
            const channel = {
                topic,
                handlers: {},
                removed: false,
                on: (_event, filter, callback) => {
                    channel.handlers[filter.table] = callback;
                    return channel;
                },
                subscribe: () => channel,
            };
            state.channels.push(channel);
            return channel;
        }),
        removeChannel: vi.fn((channel) => { channel.removed = true; }),
    },
}));

import { useAutoBomData } from '../../src/hooks/useAutoBomData';

let root;
let container;
let latest;

function Harness() {
    const data = useAutoBomData();
    useEffect(() => { latest = data; });
    return null;
}

async function render() {
    await act(async () => { root.render(createElement(Harness)); });
}

function signedIn(uid = 'owner') {
    state.auth = { user: { uid }, loading: false };
}

beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    state.auth = { user: null, loading: true };
    state.rows = {
        proyectos_bom: [{ id: 'project-1', name: 'Project', created_at: '2026-10-13' }],
        catalogo_maestro: [{ id: 'part-1', name: 'Part', part_number: 'PN-1', last_price: '12' }],
        items_bom: [{ id: 'item-1', project_id: 'project-1', quantity: '2', unit_price: '12' }],
        categorias: [{ id: 'category-1', name: 'Category' }],
        proveedores: [{ id: 'provider-1', name: 'Provider' }],
        marcas: [{ id: 'brand-1', name: 'Brand' }],
    };
    state.gate = null;
    state.requests = [];
    state.channels = [];
    vi.clearAllMocks();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
});

afterEach(async () => {
    await act(async () => { root.unmount(); });
    container.remove();
});

describe('BOM data follows the authenticated session', () => {
    it('does not query protected tables or subscribe while signed out', async () => {
        await render();
        state.auth = { user: null, loading: false };
        await render();
        expect(state.requests).toHaveLength(0);
        expect(state.channels).toHaveLength(0);
    });

    it('loads all BOM data when a delayed login finishes, without remounting', async () => {
        await render();
        expect(state.requests).toHaveLength(0);
        signedIn();
        await render();
        expect(state.requests.map(r => r.table).sort()).toEqual(Object.keys(state.rows).sort());
        expect(latest.proyectos).toEqual([expect.objectContaining({ id: 'project-1', createdAt: '2026-10-13' })]);
        expect(latest.catalogo[0]).toMatchObject({ partNumber: 'PN-1', lastPrice: 12 });
        expect(latest.bomItems[0]).toMatchObject({ projectId: 'project-1', quantity: 2, unitPrice: 12 });
        expect(latest.managedLists.categories).toHaveLength(1);
        expect(latest.managedLists.providers).toHaveLength(1);
        expect(latest.managedLists.brands).toHaveLength(1);
        expect(state.channels).toHaveLength(1);
    });

    it('waits for auth loading to finish even when a user is already present', async () => {
        state.auth = { user: { uid: 'owner' }, loading: true };
        await render();
        expect(state.requests).toHaveLength(0);
        signedIn();
        await render();
        expect(latest.proyectos).toHaveLength(1);
    });

    it('keeps pagination and realtime updates working for a restored session', async () => {
        signedIn();
        state.rows.items_bom = Array.from({ length: 1001 }, (_, i) => ({ id: `item-${i}` }));
        await render();
        expect(latest.bomItems).toHaveLength(1001);
        expect(state.requests.filter(r => r.table === 'items_bom').map(r => r.start)).toEqual([0, 1000]);
        state.rows.proyectos_bom.push({ id: 'project-2', name: 'Second' });
        await act(async () => { await state.channels[0].handlers.proyectos_bom(); });
        expect(latest.proyectos).toHaveLength(2);
    });

    it('clears cached data and removes subscriptions on logout, then reloads on login', async () => {
        signedIn();
        await render();
        const requestsBeforeLogout = state.requests.length;
        const previousChannel = state.channels[0];
        state.auth = { user: null, loading: false };
        await render();
        expect(latest.proyectos).toEqual([]);
        expect(latest.catalogo).toEqual([]);
        expect(latest.bomItems).toEqual([]);
        expect(latest.managedLists).toEqual({ categories: [], providers: [], brands: [] });
        expect(previousChannel.removed).toBe(true);
        expect(state.requests).toHaveLength(requestsBeforeLogout);
        signedIn();
        await render();
        expect(latest.proyectos).toHaveLength(1);
        expect(state.channels).toHaveLength(2);
        expect(new Set(state.channels.map(channel => channel.topic)).size).toBe(2);
    });

    it('discards in-flight results when the session changes', async () => {
        let finishOldRequests;
        state.gate = new Promise(resolve => { finishOldRequests = resolve; });
        signedIn('first-user');
        await render();
        const oldRequests = [...state.requests];
        state.gate = null;
        state.rows.proyectos_bom = [{ id: 'second-project', name: 'New session' }];
        signedIn('second-user');
        await render();
        expect(latest.proyectos.map(p => p.id)).toEqual(['second-project']);
        await act(async () => { finishOldRequests(); });
        expect(latest.proyectos.map(p => p.id)).toEqual(['second-project']);
        expect(oldRequests.every(r => r.signal?.aborted)).toBe(true);
        expect(state.channels[0].removed).toBe(true);
    });
});
