# Release Checklist — Engineering Management Platform

> Ejecutar antes de cada deploy a producción.  
> Fecha de creación: 2026-03-14

---

## Pre-requisitos

- [ ] `npm run build` completa sin errores
- [ ] `npm test` pasa (vitest, todos los suites)
- [ ] `firebase deploy --only firestore:rules` ejecutado si hubo cambios en rules
- [ ] `firebase deploy --only functions` ejecutado si hubo cambios en CFs

---

## 1. Autenticación

| # | Verificación | Estado |
|---|-------------|--------|
| 1.1 | Login con Google Sign-In funciona | ☐ |
| 1.2 | Usuario nuevo recibe rol `viewer` automáticamente | ☐ |
| 1.3 | Logout redirige a login | ☐ |

## 2. Roles y Permisos

| # | Verificación | Estado |
|---|-------------|--------|
| 2.1 | Admin puede acceder al User Admin Panel | ☐ |
| 2.2 | Admin puede cambiar roles de otros usuarios | ☐ |
| 2.3 | Viewer no ve botones de edición/eliminación | ☐ |
| 2.4 | Editor puede crear/editar pero no eliminar | ☐ |

## 3. Gestión de Tareas

| # | Verificación | Estado |
|---|-------------|--------|
| 3.1 | Crear tarea desde el Kanban (título, proyecto, asignado) | ☐ |
| 3.2 | Mover tarea por drag-and-drop en Kanban | ☐ |
| 3.3 | Abrir editor de tarea (TaskDetailModal) | ☐ |
| 3.4 | Editar campos: prioridad, fecha, horas estimadas | ☐ |
| 3.5 | Vista Main Table muestra tareas agrupadas | ☐ |

## 4. Workflow (Transiciones de Estado)

| # | Verificación | Estado |
|---|-------------|--------|
| 4.1 | Transición válida (in_progress → validation) funciona | ☐ |
| 4.2 | Transición inválida (backlog → completed) es rechazada | ☐ |
| 4.3 | Bloquear tarea requiere `blockedReason` | ☐ |
| 4.4 | Completar tarea genera warning si no hay horas | ☐ |
| 4.5 | Reabrir tarea completada genera warning | ☐ |

## 5. Auditoría

| # | Verificación | Estado |
|---|-------------|--------|
| 5.1 | Transición de tarea genera `auditEvent` en Firestore | ☐ |
| 5.2 | Página AuditFindings muestra hallazgos | ☐ |
| 5.3 | Audit run manual (desde ControlTower) completa sin error | ☐ |

## 6. Weekly Planner

| # | Verificación | Estado |
|---|-------------|--------|
| 6.1 | Crear plan item en slot de tiempo | ☐ |
| 6.2 | Editar plan item existente | ☐ |
| 6.3 | Eliminar plan item | ☐ |
| 6.4 | Solapes detectados (warning visual) | ☐ |
| 6.5 | Item sin taskId o assignedTo es rechazado | ☐ |

## 7. Dashboard y Control Tower

| # | Verificación | Estado |
|---|-------------|--------|
| 7.1 | Dashboard carga sin errores JS en console | ☐ |
| 7.2 | KPI cards muestran números razonables | ☐ |
| 7.3 | ControlTower carga sin errores | ☐ |
| 7.4 | Compliance scores se muestran (no N/A ni undefined) | ☐ |

## 8. Reportes y Analytics

| # | Verificación | Estado |
|---|-------------|--------|
| 8.1 | Daily Reports carga lista de reportes | ☐ |
| 8.2 | Weekly Reports carga sin error | ☐ |
| 8.3 | Engineering Analytics muestra gráficas | ☐ |

## 9. Team y Notifications

| # | Verificación | Estado |
|---|-------------|--------|
| 9.1 | Team page muestra miembros con métricas reales | ☐ |
| 9.2 | Notifications page carga (vacía OK si no hay notificaciones) | ☐ |
| 9.3 | Marcar notificación como leída funciona | ☐ |

## 10. BOM (No Regresión)

| # | Verificación | Estado |
|---|-------------|--------|
| 10.1 | Crear proyecto BOM | ☐ |
| 10.2 | Abrir proyecto BOM existente → ver items | ☐ |
| 10.3 | Agregar item al BOM desde catálogo | ☐ |
| 10.4 | Catálogo maestro carga y filtra correctamente | ☐ |
| 10.5 | Importar PDF funciona (Gemini) | ☐ |

## 11. Gestión de Listas

| # | Verificación | Estado |
|---|-------------|--------|
| 11.1 | Managed Lists page carga | ☐ |
| 11.2 | Agregar/editar marca, categoría o proveedor | ☐ |

## 12. Time Tracking

| # | Verificación | Estado |
|---|-------------|--------|
| 12.1 | WorkLogs page carga historial | ☐ |
| 12.2 | Registrar nueva entrada de tiempo | ☐ |

---

## Post-Deploy

- [ ] Verificar que la app carga en la URL de producción
- [ ] Verificar login en producción
- [ ] Confirmar que no hay errores en la consola de Firebase Functions
- [ ] Registrar la versión y fecha del deploy

---

> **Firmado por:** _______________  
> **Fecha del release:** _______________  
> **Versión:** _______________
