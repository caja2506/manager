# Plan de Trabajo — Integración de Planificador Semanal y Registro de Horas

Este plan detalla el proceso para realizar el análisis de diseño, UX y estrategia organizacional para integrar el Weekly Planner y el Time Tracking en la plataforma AnalyzeOps/AutoBOM Pro.

## Fase 1: Investigación y Análisis del Estado Actual
- **Objetivo**: Comprender la estructura de datos, componentes y lógica existente en la plataforma relacionados con el planificador semanal (`WeeklyPlanner.jsx`, `plannerService.js`, `plannerUtils.js`) y el registro de horas (`WorkLogs.jsx`, `timeService.js`, `MyWork.jsx`, `schemas.js`).
- **Responsable**: Explorer (`teamwork_preview_explorer`).
- **Verificación**: Un reporte técnico con los hallazgos de cómo funcionan el planificador actual y el registro de horas en Firestore y el frontend.

## Fase 2: Redacción del Reporte de Análisis Estratégico y de UX
- **Objetivo**: Crear el documento de análisis `docs/time_tracking_integration_analysis.md` que contenga:
  - Matriz detallada de Pros y Contras por Rol (Manager, Team Lead, Ingeniero/Técnico) enfocada en fricción y beneficios.
  - Estrategia de gestión del cambio en 5 fases (Sensibilización, Priorización de Entrada, Periodo de Gracia, Retroalimentación Activa, Adopción Completa).
  - Propuesta del motor de sincronización conceptual (reglas de negocio, flujo de datos con Firestore, prioridad de entradas: Manual > Kanban > Planner).
- **Responsable**: Worker (`teamwork_preview_worker`).
- **Verificación**: Borrador inicial del archivo markdown guardado en `docs/time_tracking_integration_analysis.md`.

## Fase 3: Diseño Visual y Diagramas de Flujo
- **Objetivo**: Diseñar y plasmar los entregables visuales requeridos:
  - Al menos 3 mockups conceptuales (ej. timeline unificada del Planner con barras de colores mostrando tiempo real registrado vs planeado).
  - Diagrama de flujo Mermaid que represente de forma exacta la resolución de conflictos (ej. cuando un ingeniero cambia de actividad manualmente teniendo otra planeada).
- **Responsable**: Worker (`teamwork_preview_worker`).
- **Verificación**: Inclusión de los diagramas Mermaid y los diseños de componentes dentro del archivo del reporte.

## Fase 4: Revisión de Calidad y Refinamiento
- **Objetivo**: Validar el cumplimiento de todos los criterios de aceptación, la coherencia de la estrategia y el diseño de la interfaz unificada.
- **Responsable**: Reviewer (`teamwork_preview_reviewer`).
- **Verificación**: Informe de revisión sin vetos y validación de que el archivo final cumple con todas las directrices.

## Fase 5: Cierre del Proyecto
- **Objetivo**: Entregar el reporte definitivo al Sentinel y al usuario.
- **Responsable**: Project Orchestrator.
