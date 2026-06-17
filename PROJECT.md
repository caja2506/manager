# Project: Integración de Planificador Semanal y Registro de Horas (AnalyzeOps/AutoBOM Pro)

## Architecture
- **Weekly Planner (`src/pages/WeeklyPlanner.jsx`)**: Permite planificar tareas por semana. Utiliza `src/services/plannerService.js` y `src/utils/plannerUtils.js` para validaciones.
- **Time Tracking (`src/pages/WorkLogs.jsx`, `src/components/time/TimerWidget.jsx`)**: Registra horas en tiempo real o de forma manual. Utiliza `src/services/timeService.js` para persistencia.
- **My Work (`src/pages/MyWork.jsx`)**: Vista unificada del trabajo diario del ingeniero/técnico, que combina tareas y timers.
- **Firestore Schema (`src/models/schemas.js`)**: Define las colecciones `tasks`, `timeLogs`, `weeklyPlanItems`, etc.

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|--------------|--------|
| 1 | M1: Investigación y Análisis | Investigar código actual de planner, timers, logs y esquemas | None | DONE |
| 2 | M2: Redacción del Reporte | Crear `docs/time_tracking_integration_analysis.md` con matrices y estrategias | M1 | DONE |
| 3 | M3: Integración de Diseños | Agregar mockups en formato código/diagrama y flujo Mermaid de resolución de conflictos | M2 | DONE |
| 4 | M4: Revisión de Calidad | Validar el reporte con el Reviewer y refinar el contenido | M3 | DONE |
| 5 | M5: Cierre y Entrega | Completar el reporte final y notificar al Sentinel | M4 | DONE |

## Interface Contracts
- **Entrada de Tiempo**: Manual > Kanban > Planner (Regla de prioridad)
- **Motor de Sincronización**: Al arrancar un timer en My Work o actualizar Kanban, se actualiza el Planner de forma asíncrona; cambios en Planner no sobrescriben registros manuales.
