# Plan de Implementación: Transición de Estado y Estandarización de Alertas

Este plan detalla los cambios para:
1. Permitir la transición directa a **Completado** desde **Backlog** y asegurar que también sea posible desde **Pendiente**. De acuerdo con tus comentarios, **no** se permitirá la transición directa desde los estados especiales (**Bloqueado** y **Cancelado**).
2. Estandarizar el reporte de errores en las transiciones de estado en todas las pantallas del sistema (Detalle de Tarea, My Work, Tabla Principal), asegurando que el usuario reciba un mensaje claro (`alert`) si el cambio no cumple las reglas de negocio.

## Cambios Propuestos

---

### Módulo de Workflow Compartido

Modificaremos la máquina de estados compartida que regula las transiciones válidas.

#### [MODIFY] [taskWorkflow.cjs](file:///c:/Users/CJ00083620/.gemini/antigravity/scratch/autobom-pro/shared/taskWorkflow.cjs)

- Agregar `STATUS.COMPLETED` a los destinos válidos de `STATUS.BACKLOG`.
- Asegurar que `STATUS.COMPLETED` esté presente en los destinos de `STATUS.PENDING` (ya está definido de forma nativa en la máquina de estados).
- Dejar intactos los estados especiales `STATUS.BLOCKED` y `STATUS.CANCELLED` para no permitir su transición directa a completado (como indicaste, no se cambia el flujo para estos estados).

---

### Estandarización de Alertas en Pantallas del Frontend

Modificaremos los manejadores de cambios de estado para que capturen los errores lanzados por el servidor o el cliente y los muestren de forma estándar mediante un `alert()`.

#### [MODIFY] [TaskDetailModal.jsx](file:///c:/Users/CJ00083620/.gemini/antigravity/scratch/autobom-pro/src/components/tasks/TaskDetailModal.jsx)

- En `_executeStatusChange` (línea 486), envolver la llamada `await updateTaskStatus(...)` en un bloque `try...catch`. En caso de error, mostrar un mensaje al usuario con la razón exacta:
  ```javascript
  try {
      await updateTaskStatus(task.id, newStatus, task.projectId || form.projectId);
  } catch (err) {
      console.error('Error al actualizar estado:', err);
      alert('No se pudo cambiar el estado: ' + (err.message || 'Error desconocido'));
      // Revertir estado en el formulario local
      setForm(f => ({ ...f, status: oldStatus }));
  }
  ```
- En `handleWipConfirm` (línea 540) y en el callback de confirmación de transición en `TransitionConfirmModal` (línea 925), asegurar el mismo tratamiento de errores en la llamada a `updateTaskStatus` para alertar en caso de fallo.

#### [MODIFY] [MyWork.jsx](file:///c:/Users/CJ00083620/.gemini/antigravity/scratch/autobom-pro/src/pages/MyWork.jsx)

- En `handleStatusChange` (línea 92), modificar el bloque `catch` para alertar al usuario del error en lugar de solo imprimir en consola:
  ```javascript
  try {
      await updateTaskStatus(task.id, newStatus, task.projectId);
  } catch (e) {
      console.error('Error updating status:', e);
      alert('No se pudo cambiar el estado: ' + (e.message || 'Error desconocido'));
  }
  ```
- En `handleWipConfirm` (línea 111), envolver los llamados a `updateTaskStatus` en un bloque `try...catch` con su respectivo `alert` en caso de error.

#### [MODIFY] [MainTable.jsx](file:///c:/Users/CJ00083620/.gemini/antigravity/scratch/autobom-pro/src/pages/MainTable.jsx)

- En `saveField` (línea 577), al capturar un error en la actualización si el campo es `status`, alertar al usuario:
  ```javascript
  try {
      if (field === 'status') {
          await updateTaskStatus(task.id, value);
      } else {
          await updateTask(task.id, { [field]: value });
      }
      ...
  } catch (err) {
      console.error(`Failed to save ${field}:`, err);
      if (field === 'status') {
          alert('No se pudo cambiar el estado: ' + (err.message || 'Error desconocido'));
      } else {
          alert('No se pudo guardar el campo: ' + (err.message || 'Error desconocido'));
      }
  }
  ```

---

### Pruebas Unitarias

#### [MODIFY] [workflowModel.test.js](file:///c:/Users/CJ00083620/.gemini/antigravity/scratch/autobom-pro/tests/unit/workflowModel.test.js)

- Cambiar la aserción de `['backlog', 'completed', false]` a `true`.
- Asegurar que existe y pasa la aserción `['pending', 'completed', true]`.
- Mantener `['cancelled', 'completed', false]` y `['blocked', 'completed', false]` como `false`.

#### [MODIFY] [transitionValidator.test.js](file:///c:/Users/CJ00083620/.gemini/antigravity/scratch/autobom-pro/tests/unit/transitionValidator.test.js)

- En el test `blocks backlog → completed`, modificarlo para esperar que sea una transición permitida (`allows backlog → completed`).
- En el test `canTransitionQuick`, actualizar el caso de `backlog` → `completed` para esperar `true`.

## Plan de Verificación

### Pruebas Automatizadas
- Ejecutar el comando `npx.cmd vitest run` para verificar que todas las pruebas pasen satisfactoriamente.

### Verificación Manual
- **Transición Backlog -> Completado**: Tomar una tarea en "Backlog", abrirla o editarla e intentar pasarla a "Completado". Debería permitirse sin errores de transición de flujo.
- **Transición Pendiente -> Completado**: Verificar que se puede pasar de "Pendiente" a "Completado" directamente en la tabla, detalle y My Work.
- **Estandarización de Alertas**: Forzar un error en otra pantalla (por ejemplo, intentar pasar una tarea en la Tabla Principal o en "My Work" a un estado para el que no cumple los campos obligatorios). Verificar que se muestre el cuadro de diálogo `alert()` del navegador informando del problema.
