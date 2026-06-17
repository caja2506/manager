# Reporte de Investigación (Handoff) — Planificador Semanal y Seguimiento de Tiempo

Este reporte contiene un análisis completo de las colecciones, lógica de sincronización, máquinas de estado del temporizador y patrones de interfaz de usuario (UX) para los módulos **Weekly Planner**, **Time Tracking** y **My Work**.

---

## 1. Observaciones (Observations)

### Archivos Clave y Ubicaciones Analizadas:
- `src/pages/WeeklyPlanner.jsx`
- `src/pages/WorkLogs.jsx`
- `src/pages/MyWork.jsx`
- `src/components/time/ActiveTimer.jsx` (Componente de temporizador activo principal)
- `src/components/mywork/ActiveTimerCard.jsx` (Tarjeta de temporizador usada en My Work)
- `src/services/plannerService.js` (Resuelve la implementación activa del planificador)
- `src/services/timeService.js` (Resuelve la implementación activa de control de tiempo)
- `src/utils/plannerUtils.js` (Funciones de validación y enriquecimiento de datos de planificación)
- `src/models/schemas.js` (Esquemas de validación de dominios comunes)
- `src/modules/common/domain/collections.js` (Constantes de nombres de colecciones en Firestore/Supabase)

---

### A. Colecciones de Datos y Campos Clave

Según lo definido en `src/modules/common/domain/collections.js` y las estructuras en los modelos de dominio, las colecciones principales involucradas son:

1. **`weekly_plan_items`** (Planificador Semanal)
   Representa bloques de tiempo programados para una semana específica.
   - **Campos principales:**
     - `id` (string): Identificador único del bloque de planificación.
     - `taskId` / `task_id` (string, opcional): Referencia al documento en la colección `tasks`.
     - `projectId` / `project_id` (string, opcional): Referencia al documento en `projects`.
     - `assignedTo` / `assigned_to` (string): UID del usuario asignado.
     - `weekStartDate` / `week_start_date` (string): Fecha del lunes de la semana correspondiente en formato `YYYY-MM-DD`.
     - `date` (string): Fecha del día específico del bloque (`YYYY-MM-DD`).
     - `dayOfWeek` / `day_of_week` (number): Día de la semana (1 = lunes, 7 = domingo).
     - `startDateTime` / `start_date_time` (string): Fecha y hora de inicio en formato ISO.
     - `endDateTime` / `end_date_time` (string): Fecha y hora de finalización en formato ISO.
     - `plannedHours` / `planned_hours` (number): Duración neta del bloque planificado en horas.
     - `notes` (string, opcional): Notas informales de la planificación.
     - `createdBy` / `created_by` (string): UID del creador del bloque.
     - **Campos de Snapshot de Transición (Transitional Snapshots):** Para retrocompatibilidad y consultas rápidas, el frontend escribe campos como `taskTitleSnapshot`, `projectNameSnapshot`, `assignedToName`, `statusSnapshot`, `priority` y `colorKey`.

2. **`time_logs`** (Registros de Tiempo / Timers)
   Contiene el historial de tiempos trabajados y registros activos.
   - **Campos principales:**
     - `id` (string): Identificador único del registro.
     - `userId` / `user_id` (string): UID del usuario.
     - `taskId` / `task_id` (string, opcional): Referencia al documento en `tasks`.
     - `projectId` / `project_id` (string, opcional): Referencia a la colección `projects`.
     - `startTime` / `start_time` (string): Marca de tiempo ISO del inicio del timer.
     - `endTime` / `end_time` (string, null): Marca de tiempo ISO del fin del timer. **Si es `null`, indica que el temporizador está corriendo actualmente.**
     - `totalHours` / `total_hours` (number): Horas netas registradas (descontando descansos automáticos).
     - `totalHoursGross` / `total_hours_gross` (number, opcional): Horas brutas de duración.
     - `breakHoursDeducted` / `break_hours_deducted` (number, opcional): Horas de descanso descontadas.
     - `overtime` (boolean): Bandera para indicar si es considerado tiempo extra.
     - `overtimeHours` / `overtime_hours` (number, opcional): Cantidad de horas extra del log.
     - `notes` (string, opcional): Descripción de la actividad realizada.
     - `source` (string): Origen del registro (`manual`, `planner_auto`, `kanban_auto`, `telegram`, `open_day`).
     - `planItemId` / `plan_item_id` (string, opcional): Referencia a la planificación origen (`weekly_plan_items`).
     - `autoStopped` / `auto_stopped` (boolean, opcional): Indica si el timer fue cerrado automáticamente al final del día.
     - **Campos de Snapshot:** `task_title`, `project_name`, `display_name`.

3. **`tasks`** (Tareas Maestras)
   El origen de la verdad de las tareas en Kanban y Proyectos.
   - **Campos de interés:**
     - `id` (string): Identificador único.
     - `title` (string): Nombre/Título de la tarea.
     - `status` (string): Estado actual (`backlog`, `pending`, `in_progress`, `validation`, `completed`, `blocked`, `cancelled`).
     - `assignedTo` / `assigned_to` (string): UID del usuario asignado.
     - `projectId` / `project_id` (string): ID del proyecto al que pertenece.
     - `estimatedHours` (number): Estimación planificada de la tarea.
     - `actualHours` (number): Acumulado de horas reales registradas, recalculadas automáticamente desde `time_logs`.

---

## 2. Cadena de Lógica (Logic Chain)

### A. Ciclo de Vida del Temporizador (Timer State Machine)
- **Inicio del Timer:** 
  - Al ejecutar `startTimerSafe` (`src/services/timeService.js`), el sistema primero consulta si el usuario tiene algún registro activo con `end_time == null`.
  - Si ya existe un timer activo, se lanza una confirmación al usuario (`window.confirm`). Si es aceptada, el timer viejo se detiene automáticamente (escribiendo su `end_time` y calculando horas) antes de insertar la nueva fila en `time_logs` con `startTime = now.toISOString()` y `endTime = null`.
- **Pausa del Timer:**
  - El sistema no posee un estado "pausado" nativo para un registro individual. En su lugar, pausar se implementa deteniendo el timer activo actual (lo cual guarda el bloque de tiempo trabajado hasta ese momento) y creando un nuevo registro cuando se reanuda la tarea.
- **Detención del Timer:**
  - Ejecutado mediante `stopTimer(logId)`. 
  - Se calcula la diferencia entre `startTime` y `now`. La función `getEffectiveHours(start, end)` deduce los tiempos de descanso automáticos (según políticas de la empresa e inactividad) para establecer el neto de `total_hours`.
  - Se actualiza el documento del registro asignando `endTime = now.toISOString()`, `totalHours = calculado` y guardando los metadatos.
  - Inmediatamente se dispara un recálculo en la tarea (`recalculateTaskHours(taskId)`) que realiza un *roll-up* de todos los registros completos de tiempo vinculados a esa tarea y actualiza el campo `actualHours` en el documento maestro de la tarea.

### B. Vinculación y Sincronización entre Planificación y Tiempos Registrados
1. **Capa de Enriquecimiento (Enrichment Layer):**
   - Los bloques guardados en `weekly_plan_items` no duplican permanentemente los títulos, estados o asignaciones de las tareas en la base de datos en su lectura habitual. 
   - En `WeeklyPlanner.jsx`, la función `enrichPlanItemsWithTasks(rawPlanItems, engTasks, engProjects, teamMembers)` de `plannerUtils.js` une dinámicamente cada bloque del planificador con los datos en tiempo real de la tarea (`tasks`), proyecto (`projects`) y equipo (`teamMembers`). Si la tarea fue borrada o no se encuentra, se recurre de forma segura a los snapshots denormalizados grabados en la creación.
2. **Sincronización Automática de Temporizadores (Planner-to-Timer Sync):**
   - Cuando se visualiza o modifica el planificador, se activa el hook `usePlannerTimerStatus` y la lógica de sincronización (`syncActivePlannerTimer` en `plannerService`).
   - Si un bloque de planificación coincide con la hora actual (`now >= startDateTime` y `now <= endDateTime`) y pertenece al usuario activo:
     - Si no hay un timer corriendo, el sistema inicia un temporizador de forma automática con `source = 'planner_auto'` y lo asocia al `plan_item_id`.
     - Si hay un timer activo iniciado automáticamente por otro bloque de planificación, lo detiene e inicia el del nuevo bloque para sincronizar el trabajo según la planificación diaria. Los temporizadores iniciados manualmente por el usuario no se sobrescriben para respetar la concentración (foco) del desarrollador.
     - Si el bloque de planificación expira (es decir, pasa la hora de fin), se detiene el timer asociado.
3. **Sincronización Bidireccional de Estados (Timer-to-Task Sync):**
   - Al iniciar un timer de manera automática para una tarea con estados iniciales (`backlog`, `pending`, `blocked`), el sistema cambia automáticamente su estado a `in_progress`.
   - Modificar manualmente el estado de una tarea a `in_progress` en la vista Kanban o en My Work inicia un timer de inmediato en segundo plano. Marcar una tarea como `completed`, `cancelled`, `blocked` o `pending` detiene el timer activo.
4. **Regla de Límite WIP (Work in Progress Limit):**
   - Para evitar el *multitasking*, un usuario solo puede tener una tarea activa en estado `in_progress` a la vez.
   - Si en `MyWork.jsx` el usuario intenta pasar una tarea a `in_progress` existiendo otra activa, se despliega el componente `WipBlockModal`. Este obliga al usuario a pasar la tarea activa a `blocked` (requiriendo una causa de retraso y un comentario para el historial de auditoría) antes de iniciar la nueva tarea.

---

## 3. Advertencias (Caveats)

- **Entorno de Red / Ejecución:** El entorno actual está configurado en `CODE_ONLY` y el ejecutable global de `npm` no se encuentra configurado en la variable de entorno `PATH` por defecto en Windows, por lo que las pruebas no pudieron correrse mediante `npm test` en consola. No obstante, las suites de pruebas unitarias locales en el backend (`functions/tests/phase5_quality_tests.js`) se revisaron estáticamente y son correctas.
- **Transición de Proveedor (Firestore vs Supabase):** Se observan implementaciones paralelas tanto para Firebase (`timeService.firebase.js`, `plannerService.firebase.js`) como para Supabase (`timeService.supabase.js`, `plannerService.supabase.js`). Los archivos de exportación principales (`timeService.js`, `plannerService.js`) actúan como un puente (bridge) dinámico redirigiendo las llamadas al proveedor configurado en la aplicación.

---

## 4. Conclusión (Conclusion)

El sistema de planificación semanal y seguimiento de horas trabaja de manera estrechamente acoplada gracias a tres capas de sincronización:
1. **Capa de Datos:** Enriquecimiento al vuelo (`enrichPlanItemsWithTasks`) de bloques de planificación con la colección de tareas principales.
2. **Capa Temporal:** Automatización de inicio/parada de timers basado en el calendario activo (`usePlannerTimerStatus` / `syncActivePlannerTimer`).
3. **Capa Operativa:** Control del flujo de estados (WIP Limit y transiciones de estados de Kanban a temporizadores).

Esta arquitectura desacopla el almacenamiento del historial (snapshots denormalizados para consultas rápidas) de los datos transaccionales activos (relaciones dinámicas a través de IDs en el cliente).

---

## 5. Método de Verificación (Verification Method)

Para realizar una inspección independiente de esta lógica de integración, revise los siguientes fragmentos en el código:

1. **Enriquecimiento Dinámico de Planificación:**
   - Ubicación: `src/utils/plannerUtils.js`
   - Función: `enrichPlanItemsWithTasks`
   - Compruebe que mapea los arreglos de tareas y proyectos inyectando referencias actualizadas en los bloques de planificación.
2. **Flujo de Bloqueo WIP:**
   - Ubicación: `src/pages/MyWork.jsx`, líneas 92–142.
   - Compruebe la lógica de control del estado `in_progress` que detona la apertura del `WipBlockModal`.
3. **Código de Seguridad de Eliminación:**
   - Ubicación: `src/pages/WorkLogs.jsx`, líneas 439–515.
   - Verifique que la acción del botón de confirmación de eliminación de log está condicionada a la expresión `confirmCode === '1234'`.
