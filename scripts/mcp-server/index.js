import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, ".env") });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env");
  process.exit(1);
}

// Initialize Supabase Client
const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  }
});

// Camel to Snake mapping dictionary (backward compatibility)
const CAMEL_TO_SNAKE = {
  assignedTo: "assigned_to",
  projectId: "project_id",
  parentTaskId: "parent_task_id",
  taskTypeId: "task_type_id",
  dueDate: "due_date",
  startDate: "start_date",
  completedDate: "completed_date",
  estimatedHours: "estimated_hours",
  actualHours: "actual_hours",
  sortOrder: "sort_order",
  createdAt: "created_at",
  updatedAt: "updated_at",
  createdBy: "created_by",
  stationId: "station_id",
  workAreaId: "work_area_id",
  milestoneId: "milestone_id",
  peerReviewRequired: "peer_review_required",
  peerReviewStatus: "peer_review_status",
  peerReviewDiscipline: "peer_review_discipline",
  peerReviewerId: "peer_reviewer_id",
  taskId: "task_id",
  userId: "user_id",
  startTime: "start_time",
  endTime: "end_time",
  totalHours: "total_hours",
  totalHoursGross: "total_hours_gross",
  breakHoursDeducted: "break_hours_deducted",
  autoStopped: "auto_stopped",
  manualEntry: "manual_entry",
  overtimeHours: "overtime_hours",
  displayName: "display_name",
  teamRole: "team_role",
  operationalRole: "operational_role",
  rbacRole: "rbac_role",
  telegramChatId: "telegram_chat_id",
  isAutomationParticipant: "is_automation_participant",
  reportsTo: "reports_to",
  providerLinks: "provider_links",
  totalBudget: "total_budget",
  completedAt: "completed_at",
  completedBy: "completed_by",
  causeName: "cause_name",
  causeId: "cause_id",
};

const SNAKE_TO_CAMEL = {};
for (const [camel, snake] of Object.entries(CAMEL_TO_SNAKE)) {
  SNAKE_TO_CAMEL[snake] = camel;
}

function toCamel(row) {
  if (!row) return row;
  const result = {};
  for (const [key, value] of Object.entries(row)) {
    const camelKey = SNAKE_TO_CAMEL[key] || key;
    result[camelKey] = value;
  }
  return result;
}

function mapRows(rows) {
  return (rows || []).map(toCamel);
}

// Instantiate Server
const server = new Server(
  {
    name: "autobom-mcp-server",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Define MCP Tools
const tools = [
  {
    name: "get_all_projects",
    description: "Lista todos los proyectos activos con su estado y progreso.",
    inputSchema: {
      type: "object",
      properties: {}
    }
  },
  {
    name: "get_my_tasks",
    description: "Obtiene las tareas asignadas a un usuario específico, con estado y prioridad.",
    inputSchema: {
      type: "object",
      properties: {
        userId: { type: "string", description: "ID del usuario de Firebase/Supabase" }
      },
      required: ["userId"]
    }
  },
  {
    name: "get_task_details",
    description: "Obtiene el detalle completo de una tarea específica, incluyendo subtareas.",
    inputSchema: {
      type: "object",
      properties: {
        taskId: { type: "string", description: "ID único de la tarea" }
      },
      required: ["taskId"]
    }
  },
  {
    name: "get_team_status",
    description: "Obtiene el estado general del equipo: tareas activas, bloqueadas y vencidas por persona.",
    inputSchema: {
      type: "object",
      properties: {}
    }
  },
  {
    name: "get_overdue_tasks",
    description: "Obtiene todas las tareas vencidas (pasadas de fecha de entrega) del equipo.",
    inputSchema: {
      type: "object",
      properties: {}
    }
  },
  {
    name: "get_project_metrics",
    description: "Obtiene métricas clave de un proyecto específico: progreso, tareas totales, bloqueadas y riesgo.",
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "string", description: "ID único del proyecto" }
      },
      required: ["projectId"]
    }
  },
  {
    name: "get_my_hours_today",
    description: "Obtiene las horas registradas por un usuario hoy y el estado del temporizador activo.",
    inputSchema: {
      type: "object",
      properties: {
        userId: { type: "string", description: "ID del usuario" }
      },
      required: ["userId"]
    }
  },
  {
    name: "get_gantt_status",
    description: "Obtiene el estado del cronograma Gantt: fechas planificadas, desviaciones en días y porcentaje de avance.",
    inputSchema: {
      type: "object",
      properties: {}
    }
  },
  {
    name: "get_team_workload",
    description: "Obtiene la carga de trabajo semanal del equipo: horas estimadas asignadas vs capacidad de cada miembro.",
    inputSchema: {
      type: "object",
      properties: {}
    }
  },
  {
    name: "get_upcoming_deadlines",
    description: "Obtiene las tareas que vencen en los próximos N días (por defecto 7 días).",
    inputSchema: {
      type: "object",
      properties: {
        days: { type: "integer", description: "Número de días de margen", default: 7 }
      }
    }
  },
  {
    name: "get_project_risks",
    description: "Obtiene los niveles de riesgo y factores críticos de todos los proyectos activos.",
    inputSchema: {
      type: "object",
      properties: {}
    }
  },
  {
    name: "get_project_milestones",
    description: "Obtiene las fases o hitos (milestones) de un proyecto con sus fechas y semáforo de estado.",
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "string", description: "ID del proyecto" }
      },
      required: ["projectId"]
    }
  },
  {
    name: "get_project_delays",
    description: "Obtiene el historial de retrasos de un proyecto con sus causas y duraciones.",
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "string", description: "ID del proyecto" }
      },
      required: ["projectId"]
    }
  }
];

// Register List Tools Handler
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools };
});

// Register Call Tool Handler
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case "get_all_projects": {
        const { data, error } = await supabase
          .from("projects")
          .select("*")
          .not("status", "eq", "cancelled");

        if (error) throw error;
        const projects = mapRows(data).map(p => ({
          name: p.name,
          status: p.status,
          priority: p.priority,
          riskLevel: p.riskLevel,
          progress: p.progress,
        }));
        return { content: [{ type: "text", text: JSON.stringify(projects, null, 2) }] };
      }

      case "get_my_tasks": {
        const { userId } = args;
        const { data, error } = await supabase
          .from("tasks")
          .select("*")
          .eq("assigned_to", userId);

        if (error) throw error;
        const tasks = mapRows(data).map(t => ({
          title: t.title,
          status: t.status,
          priority: t.priority,
          dueDate: t.dueDate,
          estimatedHours: t.estimatedHours,
          actualHours: t.actualHours,
        }));
        return { content: [{ type: "text", text: JSON.stringify(tasks, null, 2) }] };
      }

      case "get_task_details": {
        const { taskId } = args;
        const { data: taskData, error: taskError } = await supabase
          .from("tasks")
          .select("*")
          .eq("id", taskId)
          .single();

        if (taskError) throw taskError;
        const task = toCamel(taskData);

        const { data: subtaskData, error: subtaskError } = await supabase
          .from("subtasks")
          .select("*")
          .eq("task_id", taskId)
          .order("order", { ascending: true });

        const subtasks = subtaskError ? [] : mapRows(subtaskData);

        return { content: [{ type: "text", text: JSON.stringify({ ...task, subtasks }, null, 2) }] };
      }

      case "get_team_status": {
        const { data: usersData, error: usersError } = await supabase.from("users").select("*");
        const { data: tasksData, error: tasksError } = await supabase.from("tasks").select("*");

        if (usersError) throw usersError;
        if (tasksError) throw tasksError;

        const users = mapRows(usersData).filter(u => u.active !== false);
        const tasks = mapRows(tasksData);
        const today = new Date().toISOString().split("T")[0];

        const status = users.map(user => {
          const userTasks = tasks.filter(t => t.assignedTo === user.id);
          const inProgress = userTasks.filter(t => t.status === "in_progress").length;
          const blocked = userTasks.filter(t => t.status === "blocked").length;
          const overdue = userTasks.filter(t => t.dueDate && t.dueDate < today && !["completed", "cancelled"].includes(t.status)).length;
          const completed = userTasks.filter(t => t.status === "completed").length;

          return {
            name: user.displayName || user.name || user.email,
            role: user.operationalRole || user.teamRole,
            inProgress,
            blocked,
            overdue,
            completed,
            totalActive: userTasks.filter(t => !["completed", "cancelled"].includes(t.status)).length,
          };
        });

        return { content: [{ type: "text", text: JSON.stringify(status, null, 2) }] };
      }

      case "get_overdue_tasks": {
        const { data, error } = await supabase.from("tasks").select("*");
        if (error) throw error;

        const today = new Date().toISOString().split("T")[0];
        const overdue = mapRows(data)
          .filter(t => t.dueDate && t.dueDate < today && !["completed", "cancelled"].includes(t.status))
          .map(t => ({
            title: t.title,
            assignedTo: t.assignedTo,
            dueDate: t.dueDate,
            status: t.status,
            daysOverdue: Math.floor((Date.now() - new Date(t.dueDate).getTime()) / 86400000),
          }));

        return { content: [{ type: "text", text: JSON.stringify(overdue, null, 2) }] };
      }

      case "get_project_metrics": {
        const { projectId } = args;
        const { data: projectData, error: projError } = await supabase
          .from("projects")
          .select("*")
          .eq("id", projectId)
          .single();

        if (projError) throw projError;
        const project = toCamel(projectData);

        const { data: tasksData, error: tasksError } = await supabase
          .from("tasks")
          .select("*")
          .eq("project_id", projectId);

        const projectTasks = tasksError ? [] : mapRows(tasksData);
        const completed = projectTasks.filter(t => t.status === "completed").length;
        const total = projectTasks.length;

        const metrics = {
          name: project.name,
          status: project.status,
          progress: total > 0 ? Math.round((completed / total) * 100) : 0,
          totalTasks: total,
          completedTasks: completed,
          blockedTasks: projectTasks.filter(t => t.status === "blocked").length,
          riskScore: project.riskScore,
          riskLevel: project.riskLevel,
        };

        return { content: [{ type: "text", text: JSON.stringify(metrics, null, 2) }] };
      }

      case "get_my_hours_today": {
        const { userId } = args;
        const { data, error } = await supabase
          .from("time_logs")
          .select("*")
          .eq("user_id", userId);

        if (error) throw error;
        const logs = mapRows(data);
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

        const hoursInfo = {
          totalHours: parseFloat(totalHours.toFixed(2)),
          activeTimer,
          logs: todayLogs,
        };
        return { content: [{ type: "text", text: JSON.stringify(hoursInfo, null, 2) }] };
      }

      case "get_gantt_status": {
        const { data, error } = await supabase
          .from("tasks")
          .select("id, title, status, assigned_to, project_id, priority, due_date, planned_start_date, planned_end_date, percent_complete, estimated_hours, actual_hours")
          .not("planned_start_date", "is", null);

        if (error) throw error;
        const today = new Date().toISOString().split("T")[0];

        const gantt = mapRows(data).map(t => {
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

        return { content: [{ type: "text", text: JSON.stringify(gantt, null, 2) }] };
      }

      case "get_team_workload": {
        const { data: usersData, error: usersError } = await supabase.from("users").select("*");
        const { data: tasksData, error: tasksError } = await supabase.from("tasks").select("*");

        if (usersError) throw usersError;
        if (tasksError) throw tasksError;

        const users = mapRows(usersData).filter(u => u.active !== false);
        const tasks = mapRows(tasksData);
        const activeStatuses = ["backlog", "pending", "in_progress", "blocked", "validation"];

        const workload = users.map(u => {
          const userTasks = tasks.filter(t => t.assignedTo === u.id && activeStatuses.includes(t.status));
          const estimatedHours = userTasks.reduce((sum, t) => sum + (t.estimatedHours || 0), 0);
          return {
            userId: u.id,
            name: u.displayName || u.name || u.email,
            role: u.operationalRole || u.teamRole,
            activeTasks: userTasks.length,
            estimatedHours,
            capacity: u.capacity || 40,
          };
        });

        return { content: [{ type: "text", text: JSON.stringify(workload, null, 2) }] };
      }

      case "get_upcoming_deadlines": {
        const days = args.days || 7;
        const today = new Date().toISOString().split("T")[0];
        const future = new Date(Date.now() + days * 86400000).toISOString().split("T")[0];

        const { data, error } = await supabase
          .from("tasks")
          .select("id, title, status, assigned_to, project_id, priority, due_date, estimated_hours, actual_hours")
          .gte("due_date", today)
          .lte("due_date", future)
          .not("status", "in", "(completed,cancelled)");

        if (error) throw error;

        const deadlines = mapRows(data).map(t => ({
          title: t.title,
          dueDate: t.dueDate,
          status: t.status,
          priority: t.priority,
          assignedTo: t.assignedTo,
          projectId: t.projectId,
          daysRemaining: Math.ceil((new Date(t.dueDate).getTime() - Date.now()) / 86400000),
        }));

        return { content: [{ type: "text", text: JSON.stringify(deadlines, null, 2) }] };
      }

      case "get_project_risks": {
        const { data, error } = await supabase
          .from("projects")
          .select("*")
          .not("status", "in", "(cancelled,completed)");

        if (error) throw error;

        const risks = mapRows(data)
          .map(p => ({
            name: p.name,
            projectId: p.id,
            riskScore: p.riskScore || 0,
            riskLevel: p.riskLevel || "low",
            riskFactors: p.riskFactors || [],
            progress: p.progress || 0,
            dueDate: p.dueDate,
          }))
          .sort((a, b) => b.riskScore - a.riskScore);

        return { content: [{ type: "text", text: JSON.stringify(risks, null, 2) }] };
      }

      case "get_project_milestones": {
        const { projectId } = args;
        const { data, error } = await supabase
          .from("milestones")
          .select("id, project_id, name, description, status, start_date, due_date, completed_date, score, traffic_light")
          .eq("project_id", projectId)
          .order("start_date", { ascending: true });

        if (error) throw error;
        const milestones = mapRows(data);
        return { content: [{ type: "text", text: JSON.stringify(milestones, null, 2) }] };
      }

      case "get_project_delays": {
        const { projectId } = args;
        const { data, error } = await supabase
          .from("delays")
          .select("*, delay_causes(*)")
          .eq("project_id", projectId)
          .order("created_at", { ascending: false });

        if (error) throw error;

        const delays = mapRows(data).map(d => ({
          id: d.id,
          taskId: d.taskId,
          cause: d.delayCauses?.name || d.cause || d.reason,
          durationHours: d.durationHours || d.hours,
          description: d.description,
          createdAt: d.createdAt,
        }));

        return { content: [{ type: "text", text: JSON.stringify(delays, null, 2) }] };
      }

      default:
        return {
          content: [{ type: "text", text: `Error: Tool ${name} not found` }],
          isError: true,
        };
    }
  } catch (err) {
    return {
      content: [{ type: "text", text: `Error executing ${name}: ${err.message}` }],
      isError: true,
    };
  }
});

// Run Server on STDIO
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("AutoBOM MCP Server running on Stdio transport");
}

main().catch((err) => {
  console.error("Fatal error in MCP Server:", err);
  process.exit(1);
});
