## 2026-06-17T04:49:51Z
Create a detailed analysis markdown report at c:\Users\CJ00083620\.gemini\antigravity\scratch\autobom-pro\docs\time_tracking_integration_analysis.md. The report must be written in Spanish and must fully address the user's request.

Here are the requirements for the report:
1. **R1. Matriz de Pros y Contras por Rol**:
   - Analizar detalladamente para tres roles: Manager / Directivo, Team Lead / Líder de Proyecto, e Ingeniero / Técnico.
   - Detallar sus necesidades específicas, los pros de la integración, los contras / puntos de fricción, y cómo mitigar la fricción.
   - Estructurar esto en formato de tablas comparativas de fácil lectura.

2. **R2. Estrategia de Gestión del Cambio y Comunicación**:
   - Diseñar un plan de 5 fases estructuradas:
     1. **Sensibilización**: Comunicar el propósito de automatizar el registro de horas a través del planificador semanal (para reducir la carga administrativa del 80% de registro manual).
     2. **Priorización de Entrada**: Explicar la jerarquía de prioridad: Entrada Manual (usuario) > Kanban (estado de la tarea) > Planner (programación del planificador), empoderando al usuario.
     3. **Periodo de Gracia / Pruebas**: Período de simulación temporal donde las desviaciones no afectan métricas de desempeño o IPS.
     4. **Retroalimentación Activa**: Reuniones y encuestas de pulido con el equipo técnico para ajustar la tolerancia de los timers y deducir inactividad.
     5. **Adopción Completa**: Entrada en vigor del sistema integrado con reportes automatizados.

3. **R3. Propuesta de Flujo de Trabajo Conceptual**:
   - Explicar el funcionamiento técnico del motor de sincronización entre el planificador semanal (`weekly_plan_items`), los registros de tiempo (`time_logs`), y las tareas (`tasks`) en Firestore/Supabase.
   - Describir cómo se comporta el sistema cuando un plan cambia en tiempo real, se inicia un timer manual, o se cambia el estado de una tarea a `in_progress` (gatillando el temporizador y verificando el límite de 1 tarea activa WIP, abriendo el modal `WipBlockModal` si hay conflicto).
   - Detallar cómo el timer calcula las horas netas deduciendo descansos y realiza el rollup a la tarea (`actualHours`).

4. **Visuales y Mockups**:
   - Incluir al menos 3 mockups conceptuales en formato de código, diagramas de caja de texto enriquecido o esquemas visuales ASCII/HTML de componentes:
     - **Mockup 1: Línea de tiempo unificada (Unified Timeline)**: Muestra bloques planificados (ej. de 9:00 a 11:00) superpuestos con barras de colores que representan el tiempo realmente registrado (ej. verde para tiempo en curso, azul para tiempo manual, rojo/naranja para tiempo inactivo o desviación).
     - **Mockup 2: Panel de Control del Temporizador Activo (Active Timer Widget)**: Muestra el tiempo corriendo, controles de pausa/parada, y campos interactivos para asociar a la tarea y registrar notas rápidas.
     - **Mockup 3: WipBlockModal (Modal de bloqueo de WIP)**: Interfaz que aparece al intentar activar una segunda tarea, mostrando la tarea activa actual y forzando al usuario a justificar su bloqueo (con selector de causas de retraso y comentarios) para poder continuar.
   - Incluir un diagrama de flujo en formato Mermaid que ilustre la resolución de conflictos cuando un ingeniero cambia de actividad manualmente mientras tenía otra programada en el planificador (ej. el sistema detecta que el bloque planificado sigue activo, pero el timer manual del usuario toma precedencia y pausa/detiene el timer automático anterior, registrando la desviación para análisis de planificación).
