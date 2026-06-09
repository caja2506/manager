import { describe, it, expect, vi } from 'vitest';
const path = require('path');

// 1. Configurar variables de entorno ficticias
process.env.SUPABASE_URL = "http://fake-supabase-url.com";
process.env.SUPABASE_SERVICE_ROLE_KEY = "fake-service-role-key";

// 2. Definir mocks
const coreDataReaderMock = {
    loadAllTasks: vi.fn().mockResolvedValue([
        { id: 'task-123', title: 'Manual de usuario', priority: 'medium' },
        { id: 'task-456', title: 'Instalación de sensor', priority: 'low' },
        { id: 'task-789', title: 'Dry run SE', priority: 'medium' },
    ]),
    loadUserTasks: vi.fn().mockResolvedValue([]),
    loadUser: vi.fn().mockResolvedValue({ id: 'user-789', name: 'Juan Carlos', displayName: 'Juan Carlos' }),
};

const memoryServiceMock = {
    loadUserMemory: vi.fn().mockResolvedValue("memorias vacias"),
    getRecentConversation: vi.fn().mockResolvedValue({ messages: [], summary: "" }),
    appendToConversation: vi.fn().mockResolvedValue(null),
    extractMemoriesFromConversation: vi.fn().mockResolvedValue(null),
};

const supabaseAdminMock = {
    getSupabase: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnThis(),
        insert: vi.fn().mockResolvedValue({ data: {}, error: null }),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: {}, error: null }),
    })
};

// 3. Inyectar mocks en require.cache de NodeJS para interceptar require de CommonJS
const resolveAndCache = (relPath, mockExports) => {
    const absPath = path.resolve(__dirname, relPath);
    require.cache[absPath] = {
        id: absPath,
        filename: absPath,
        loaded: true,
        exports: mockExports
    };
};

resolveAndCache('../../functions/db/coreDataReader.js', coreDataReaderMock);
resolveAndCache('../../functions/db/supabaseAdmin.js', supabaseAdminMock);
resolveAndCache('../../functions/agent/memoryService.js', memoryServiceMock);

// 4. Importar módulos bajo prueba
const intentDetector = require('../../functions/agent/intentDetector');
const { processMessage } = require('../../functions/agent/conversationEngine');

describe('ARIA Priority Extraction and Flow', () => {
    it('debe detectar la intención de cambiar prioridad y extraer los parámetros correctos', async () => {
        const message = "Aria, cambia la prioridad de la tarea 'Manual' a alta";
        const result = await intentDetector.detectWriteIntent(message, 'user-789');

        expect(result.type).toBe('write');
        expect(result.action).toBe('updateTaskPriority');
        expect(result.extractedParams.taskId).toBe('task-123');
        expect(result.extractedParams.priority).toBe('high');
    });

    it('debe extraer prioridad con coincidencias difusas', async () => {
        const message = "pon la tarea del sensor en prioridad critica";
        const result = await intentDetector.detectWriteIntent(message, 'user-789');

        expect(result.type).toBe('write');
        expect(result.action).toBe('updateTaskPriority');
        expect(result.extractedParams.taskId).toBe('task-456');
        expect(result.extractedParams.priority).toBe('critical');
    });

    it('debe extraer prioridad incluso si no se menciona la palabra tarea', async () => {
        const message = "Cambia dry run se a prioridad alta";
        const result = await intentDetector.detectWriteIntent(message, 'user-789');

        expect(result.type).toBe('write');
        expect(result.action).toBe('updateTaskPriority');
        expect(result.extractedParams.taskId).toBe('task-789');
        expect(result.extractedParams.priority).toBe('high');
    });

    it('debe generar pendingWrite en processMessage si tiene parámetros mínimos', async () => {
        const message = "Aria, cambia la prioridad de la tarea 'Manual' a alta";
        
        // Simular llamada a processMessage
        const result = await processMessage({
            userId: 'user-789',
            chatId: 'chat-999',
            userMessage: message,
            userName: 'Juan Carlos',
            userRole: 'engineer',
            keys: {}
        });

        expect(result.pendingWrite).toBeDefined();
        expect(result.pendingWrite.toolName).toBe('updateTaskPriority');
        expect(result.pendingWrite.params.taskId).toBe('task-123');
        expect(result.pendingWrite.params.priority).toBe('high');
        expect(result.response).toContain('Voy a cambiar la prioridad de esta tarea');
    });
});
