-- Agregar columna de estado 'status' a la tabla time_logs para admitir borradores y registros reales
ALTER TABLE public.time_logs 
ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'confirmed';

-- Crear índice para mejorar consultas de filtrado por estado
CREATE INDEX IF NOT EXISTS idx_time_logs_status ON public.time_logs(status);
