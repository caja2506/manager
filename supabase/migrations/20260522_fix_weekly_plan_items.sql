-- Agregar columnas faltantes a la tabla weekly_plan_items para compatibilidad con el Planner y Daily Board
ALTER TABLE weekly_plan_items 
ADD COLUMN IF NOT EXISTS date TEXT,
ADD COLUMN IF NOT EXISTS task_title_snapshot TEXT,
ADD COLUMN IF NOT EXISTS project_name_snapshot TEXT,
ADD COLUMN IF NOT EXISTS assigned_to_name TEXT,
ADD COLUMN IF NOT EXISTS status_snapshot TEXT,
ADD COLUMN IF NOT EXISTS priority TEXT,
ADD COLUMN IF NOT EXISTS color_key TEXT;

-- Crear índice para la columna date para acelerar búsquedas y filtros por día
CREATE INDEX IF NOT EXISTS idx_weekly_plan_date ON weekly_plan_items(date);

-- Agregar plan_item_id a la tabla time_logs para poder vincular registros de tiempo con bloques de planificación
ALTER TABLE time_logs 
ADD COLUMN IF NOT EXISTS plan_item_id TEXT REFERENCES weekly_plan_items(id) ON DELETE SET NULL;

-- Crear índice para la columna plan_item_id en time_logs
CREATE INDEX IF NOT EXISTS idx_time_logs_plan_item ON time_logs(plan_item_id);
