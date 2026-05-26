/**
 * ARIA Agent — Tool Registry
 * =============================
 * Tools that ARIA can use to query and act on system data.
 * Each tool has a description (for the LLM) and an execute function.
 *
 * The conversation engine detects tool calls from the LLM response
 * and executes them, then feeds results back into the conversation.
 */

const coreReader = require("../db/coreDataReader");

/**
 * Registry of tools available to ARIA.
 * Each tool has:
 *   - name: unique identifier
 *   - description: what it does (shown to the LLM)
 *   - parameters: expected inputs
 *   - execute: async function that returns data
 */
const TOOL_REGISTRY = {

    getMyTasks: {
        name: "getMyTasks",
        description: "Obtiene las tareas asignadas al usuario actual, con estado y prioridad.",
        parameters: "userId (string)",
        execute: async (userId) => {
            const tasks = await coreReader.loadUserTasks(userId);
            return tasks.map(t => ({
                title: t.title,
                status: t.status,
                priority: t.priority,
                dueDate: t.dueDate,
                estimatedHours: t.estimatedHours,
                actualHours: t.actualHours,
            }));
        },
    },

    getTaskDetails: {
        name: "getTaskDetails",
        description: "Obtiene el detalle completo de una tarea específica, incluyendo subtareas.",
        parameters: "taskId (string)",
        execute: async (taskId) => {
            const task = await coreReader.loadTask(taskId);
            if (!task) return { error: "Tarea no encontrada" };
            const subtasks = await coreReader.loadTaskSubtasks(taskId);
            return { ...task, subtasks };
        },
    },

    getTeamStatus: {
        name: "getTeamStatus",
        description: "Obtiene el estado general del equipo: tareas activas, bloqueadas, vencidas por persona.",
        parameters: "none",
        execute: async () => {
            const [users, tasks] = await Promise.all([
                coreReader.loadAllUsers(),
                coreReader.loadAllTasks(),
            ]);

            const today = new Date().toISOString().split("T")[0];
            const activeUsers = users.filter(u => u.active !== false);

            return activeUsers.map(user => {
                const userTasks = tasks.filter(t => t.assignedTo === user.id);
                const inProgress = userTasks.filter(t => t.status === "in_progress").length;
                const blocked = userTasks.filter(t => t.status === "blocked").length;
                const overdue = userTasks.filter(t => t.dueDate && t.dueDate < today && !["completed", "cancelled"].includes(t.status)).length;
                const completed = userTasks.filter(t => t.status === "completed").length;

                return {
                    name: user.name || user.displayName || user.email,
                    role: user.operationalRole || user.teamRole,
                    inProgress,
                    blocked,
                    overdue,
                    completed,
                    totalActive: userTasks.filter(t => !["completed", "cancelled"].includes(t.status)).length,
                };
            });
        },
    },

    getOverdueTasks: {
        name: "getOverdueTasks",
        description: "Obtiene todas las tareas vencidas (pasadas de fecha) del equipo.",
        parameters: "none",
        execute: async () => {
            const tasks = await coreReader.loadAllTasks();
            const today = new Date().toISOString().split("T")[0];

            return tasks
                .filter(t => t.dueDate && t.dueDate < today && !["completed", "cancelled"].includes(t.status))
                .map(t => ({
                    title: t.title,
                    assignedTo: t.assignedTo,
                    dueDate: t.dueDate,
                    status: t.status,
                    daysOverdue: Math.floor((Date.now() - new Date(t.dueDate).getTime()) / 86400000),
                }));
        },
    },

    getProjectMetrics: {
        name: "getProjectMetrics",
        description: "Obtiene métricas de un proyecto: progreso, tareas, horas, riesgo.",
        parameters: "projectId (string)",
        execute: async (projectId) => {
            const [project, tasks] = await Promise.all([
                coreReader.loadProject(projectId),
                coreReader.loadAllTasks(),
            ]);

            if (!project) return { error: "Proyecto no encontrado" };

            const projectTasks = tasks.filter(t => t.projectId === projectId);
            const completed = projectTasks.filter(t => t.status === "completed").length;
            const total = projectTasks.length;

            return {
                name: project.name,
                status: project.status,
                progress: total > 0 ? Math.round((completed / total) * 100) : 0,
                totalTasks: total,
                completedTasks: completed,
                blockedTasks: projectTasks.filter(t => t.status === "blocked").length,
                riskScore: project.riskScore,
                riskLevel: project.riskLevel,
            };
        },
    },

    getMyHoursToday: {
        name: "getMyHoursToday",
        description: "Obtiene las horas registradas del usuario hoy.",
        parameters: "userId (string)",
        execute: async (userId) => {
            const logs = await coreReader.loadUserTimeLogs(userId);
            const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Costa_Rica" });

            let totalHours = 0;
            let activeTimer = null;
            const todayLogs = [];

            for (const log of logs) {
                const logDate = log.startTime
                    ? new Date(log.startTime).toLocaleDateString("en-CA", { timeZone: "America/Costa_Rica" })
                    : null;

                if (logDate !== today) continue;

                if (log.endTime && log.totalHours) {
                    totalHours += log.totalHours;
                    todayLogs.push({ taskId: log.taskId, hours: log.totalHours });
                } else if (!log.endTime) {
                    const elapsed = (Date.now() - new Date(log.startTime).getTime()) / 3600000;
                    activeTimer = { taskId: log.taskId, runningHours: parseFloat(elapsed.toFixed(2)) };
                }
            }

            return {
                totalHours: parseFloat(totalHours.toFixed(2)),
                activeTimer,
                logs: todayLogs,
            };
        },
    },

    getAllProjects: {
        name: "getAllProjects",
        description: "Lista todos los proyectos activos con su estado y progreso.",
        parameters: "none",
        execute: async () => {
            const projects = await coreReader.loadAllProjects();
            return projects
                .filter(p => p.status !== "cancelled")
                .map(p => ({
                    name: p.name,
                    status: p.status,
                    priority: p.priority,
                    riskLevel: p.riskLevel,
                    progress: p.progress,
                }));
        },
    },

    // ─── ARIA Intelligence Tools (Phase 3) ───

    getGanttStatus: {
        name: "getGanttStatus",
        description: "Obtiene el estado de las tareas con cronograma Gantt: fechas planificadas, % avance, desviaciones.",
        parameters: "none",
        execute: async () => {
            const ganttTasks = await coreReader.loadGanttTasks();
            const today = new Date().toISOString().split("T")[0];
            return ganttTasks.map(t => {
                const drift = t.plannedEndDate && t.dueDate
                    ? Math.floor((new Date(t.dueDate).getTime() - new Date(t.plannedEndDate).getTime()) / 86400000)
                    : null;
                const isOverdue = t.plannedEndDate && t.plannedEndDate < today && t.status !== "completed";
                return {
                    title: t.title,
                    status: t.status,
                    plannedStart: t.plannedStartDate,
                    plannedEnd: t.plannedEndDate,
                    percentComplete: t.percentComplete || 0,
                    driftDays: drift,
                    isOverdue,
                    assignedTo: t.assignedTo,
                    projectId: t.projectId,
                };
            });
        },
    },

    getTaskDependencies: {
        name: "getTaskDependencies",
        description: "Obtiene las dependencias entre tareas — qué tarea bloquea a cuál.",
        parameters: "projectId (string, optional)",
        execute: async (projectId) => {
            const deps = await coreReader.loadTaskDependencies(projectId || undefined);
            return deps.map(d => ({
                from: d.predecessorId || d.fromTaskId,
                to: d.successorId || d.toTaskId,
                type: d.dependencyType || "FS",
                projectId: d.projectId,
            }));
        },
    },

    getTeamWorkload: {
        name: "getTeamWorkload",
        description: "Obtiene la carga de trabajo del equipo: tareas activas y horas estimadas por persona vs su capacidad.",
        parameters: "none",
        execute: async () => {
            return await coreReader.calculateTeamWorkload();
        },
    },

    getUpcomingDeadlines: {
        name: "getUpcomingDeadlines",
        description: "Obtiene las tareas con fecha de entrega en los próximos 7 días.",
        parameters: "days (number, default 7)",
        execute: async (days) => {
            const tasks = await coreReader.loadUpcomingDeadlines(days || 7);
            return tasks.map(t => ({
                title: t.title,
                dueDate: t.dueDate,
                status: t.status,
                priority: t.priority,
                assignedTo: t.assignedTo,
                projectId: t.projectId,
                daysRemaining: Math.ceil((new Date(t.dueDate).getTime() - Date.now()) / 86400000),
            }));
        },
    },

    getProjectRisks: {
        name: "getProjectRisks",
        description: "Obtiene los riesgos de todos los proyectos activos: score, nivel, y factores de riesgo.",
        parameters: "none",
        execute: async () => {
            const projects = await coreReader.loadAllProjects();
            return projects
                .filter(p => p.status !== "cancelled" && p.status !== "completed")
                .map(p => ({
                    name: p.name,
                    projectId: p.id,
                    riskScore: p.riskScore || 0,
                    riskLevel: p.riskLevel || "low",
                    riskFactors: p.riskFactors || [],
                    progress: p.progress || 0,
                    dueDate: p.dueDate,
                }))
                .sort((a, b) => (b.riskScore || 0) - (a.riskScore || 0));
        },
    },

    // ─── ARIA Roadmap Tools (Fase A) ───

    getProjectMilestones: {
        name: "getProjectMilestones",
        description: "Obtiene los milestones (hitos/fases) de un proyecto con fechas, estado, score y semáforo.",
        parameters: "projectId (string)",
        execute: async (projectId) => {
            const milestones = await coreReader.loadProjectMilestones(projectId);
            return milestones.map(m => ({
                id: m.id,
                name: m.name,
                status: m.status,
                startDate: m.startDate,
                dueDate: m.dueDate,
                completedDate: m.completedDate,
                score: m.score,
                trafficLight: m.trafficLight,
                description: m.description,
            }));
        },
    },

    getProjectRisksDetail: {
        name: "getProjectRisksDetail",
        description: "Obtiene los riesgos documentados de un proyecto: descripción, impacto, mitigación, responsable.",
        parameters: "projectId (string)",
        execute: async (projectId) => {
            const risks = await coreReader.loadProjectRisks(projectId);
            return risks.map(r => ({
                id: r.id,
                title: r.title || r.description,
                category: r.category,
                probability: r.probability,
                impact: r.impact,
                riskLevel: r.riskLevel,
                mitigation: r.mitigation,
                owner: r.ownerId || r.owner,
                status: r.status,
                createdAt: r.createdAt,
            }));
        },
    },

    getDailyPlan: {
        name: "getDailyPlan",
        description: "Obtiene el plan diario de un ingeniero: qué tareas debería estar trabajando hoy.",
        parameters: "userId (string), date (string YYYY-MM-DD)",
        execute: async (userId, date) => {
            const today = date || new Date().toLocaleDateString("en-CA", { timeZone: "America/Costa_Rica" });
            const plan = await coreReader.loadDailyPlan(userId, today);
            return plan.map(p => ({
                taskId: p.taskId,
                taskTitle: p.taskTitle || p.title,
                plannedHours: p.plannedHours,
                status: p.status,
                order: p.order,
                notes: p.notes,
            }));
        },
    },

    getProjectComments: {
        name: "getProjectComments",
        description: "Obtiene los últimos 20 comentarios de un proyecto — discusiones del equipo sobre tareas.",
        parameters: "projectId (string)",
        execute: async (projectId) => {
            const comments = await coreReader.loadRecentComments(projectId);
            return comments.map(c => ({
                taskId: c.taskId,
                userId: c.userId,
                content: (c.content || "").substring(0, 200),
                createdAt: c.createdAt,
            }));
        },
    },

    getProjectDelays: {
        name: "getProjectDelays",
        description: "Obtiene los retrasos registrados en un proyecto con causa y duración.",
        parameters: "projectId (string)",
        execute: async (projectId) => {
            const delays = await coreReader.loadDelaysByProject(projectId);
            return delays.map(d => ({
                id: d.id,
                taskId: d.taskId,
                cause: d.delayCauses?.name || d.cause || d.reason,
                durationHours: d.durationHours || d.hours,
                description: d.description,
                createdAt: d.createdAt,
            }));
        },
    },
};

/**
 * Get tool descriptions formatted for the LLM system prompt.
 * Includes both read-only and write tools.
 * @returns {string}
 */
function getToolDescriptionsForPrompt() {
    const tools = Object.values(TOOL_REGISTRY);
    const readDescriptions = tools.map(t =>
        `- <b>${t.name}</b>(${t.parameters}): ${t.description}`
    ).join("\n");

    // Include write tools if available
    let writeDescriptions = "";
    try {
        const { getWriteToolDescriptionsForPrompt } = require("./writeTools");
        writeDescriptions = "\n\n<b>Herramientas de escritura (requieren confirmación):</b>\n" + getWriteToolDescriptionsForPrompt();
    } catch (err) {
        // writeTools not available — read-only mode
    }

    return readDescriptions + writeDescriptions;
}

/**
 * Execute a tool by name.
 * @param {string} toolName
 * @param {*} args - Arguments to pass to the tool
 * @returns {Promise<*>}
 */
async function executeTool(toolName, ...args) {
    const tool = TOOL_REGISTRY[toolName];
    if (!tool) {
        return { error: `Tool "${toolName}" not found` };
    }
    try {
        return await tool.execute(...args);
    } catch (err) {
        console.error(`[toolRegistry] Error executing ${toolName}:`, err.message);
        return { error: `Tool execution failed: ${err.message}` };
    }
}

/**
 * List available tool names.
 * @returns {string[]}
 */
function listTools() {
    return Object.keys(TOOL_REGISTRY);
}

module.exports = {
    TOOL_REGISTRY,
    getToolDescriptionsForPrompt,
    executeTool,
    listTools,
};
