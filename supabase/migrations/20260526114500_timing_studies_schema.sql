-- ══════════════════════════════════════════════════════════════
-- AutoBOM Pro — Timing Studies & Steps Schema
-- Migration: 20260526114500_timing_studies_schema.sql
-- Date: 2026-05-26
-- ══════════════════════════════════════════════════════════════

-- Create timing_studies Table
CREATE TABLE IF NOT EXISTS public.timing_studies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firestore_id TEXT,
  project_id TEXT NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  customer TEXT,
  machine_name TEXT,
  station_name TEXT,
  target_ppm NUMERIC DEFAULT 20,
  station_qty NUMERIC DEFAULT 1,
  efficiency_target NUMERIC DEFAULT 1,
  main_index_enabled BOOLEAN DEFAULT true,
  main_index_time_ms NUMERIC DEFAULT 0,
  nest_count INT DEFAULT 1,
  positions_per_nest INT DEFAULT 1,
  cycle_output_qty NUMERIC DEFAULT 1,
  machine_cycle_time_ms NUMERIC DEFAULT 0,
  machine_cycle_time_sec NUMERIC DEFAULT 0,
  calculated_ppm NUMERIC DEFAULT 0,
  bottleneck_station_id TEXT REFERENCES public.project_stations(id) ON DELETE SET NULL,
  bottleneck_station_label TEXT,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'planning', 'active', 'completed', 'DRAFT', 'OK', 'WARNING', 'FAIL')),
  notes TEXT,
  active BOOLEAN DEFAULT true,
  created_by TEXT,
  updated_by TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create timing_steps Table
CREATE TABLE IF NOT EXISTS public.timing_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firestore_id TEXT,
  timing_study_id UUID NOT NULL REFERENCES public.timing_studies(id) ON DELETE CASCADE,
  project_id TEXT NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  station_id TEXT REFERENCES public.project_stations(id) ON DELETE SET NULL,
  station_label TEXT,
  device_letter TEXT,
  device_type TEXT,
  device_action TEXT,
  device_qty NUMERIC DEFAULT 1,
  sensor_letter TEXT,
  sensor_type TEXT,
  sensor_qty NUMERIC DEFAULT 0,
  linear_distance_mm NUMERIC DEFAULT 0,
  angular_distance_deg NUMERIC DEFAULT 0,
  task_description TEXT,
  trigger_condition TEXT,
  dependency_step_ids UUID[] DEFAULT '{}',
  lag_ms NUMERIC DEFAULT 0,
  start_time_ms NUMERIC DEFAULT 0,
  duration_ms NUMERIC DEFAULT 0,
  finish_time_ms NUMERIC DEFAULT 0,
  sequence_group TEXT,
  can_run_in_parallel BOOLEAN DEFAULT false,
  waits_for_main_index BOOLEAN DEFAULT false,
  can_run_during_index BOOLEAN DEFAULT false,
  is_critical_path BOOLEAN DEFAULT false,
  is_bottleneck BOOLEAN DEFAULT false,
  cylinder_attitude TEXT,
  actuator_motion_type TEXT,
  bore TEXT,
  rod_dia TEXT,
  cushion TEXT,
  port_size_style TEXT,
  valve_type TEXT,
  regulator TEXT,
  flow_controls TEXT,
  check_valves TEXT,
  quick_exhaust TEXT,
  notes TEXT,
  sort_order INT DEFAULT 0,
  active BOOLEAN DEFAULT true,
  created_by TEXT,
  updated_by TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create Indexes for performance
CREATE INDEX IF NOT EXISTS idx_timing_studies_project ON public.timing_studies(project_id);
CREATE INDEX IF NOT EXISTS idx_timing_studies_active ON public.timing_studies(active);
CREATE INDEX IF NOT EXISTS idx_timing_steps_project ON public.timing_steps(project_id);
CREATE INDEX IF NOT EXISTS idx_timing_steps_study ON public.timing_steps(timing_study_id);
CREATE INDEX IF NOT EXISTS idx_timing_steps_station ON public.timing_steps(station_id);
CREATE INDEX IF NOT EXISTS idx_timing_steps_sort ON public.timing_steps(sort_order);
CREATE INDEX IF NOT EXISTS idx_timing_steps_active ON public.timing_steps(active);

-- Triggers for auto updated_at
CREATE TRIGGER trg_timing_studies_updated_at
  BEFORE UPDATE ON public.timing_studies
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_timing_steps_updated_at
  BEFORE UPDATE ON public.timing_steps
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Enable Row Level Security (RLS)
ALTER TABLE public.timing_studies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.timing_steps ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS studies_select ON public.timing_studies;
DROP POLICY IF EXISTS studies_insert ON public.timing_studies;
DROP POLICY IF EXISTS studies_update ON public.timing_studies;
DROP POLICY IF EXISTS studies_delete ON public.timing_studies;

DROP POLICY IF EXISTS steps_select ON public.timing_steps;
DROP POLICY IF EXISTS steps_insert ON public.timing_steps;
DROP POLICY IF EXISTS steps_update ON public.timing_steps;
DROP POLICY IF EXISTS steps_delete ON public.timing_steps;

-- Define Policies matching project pattern (is_editor(), is_admin())
CREATE POLICY studies_select ON public.timing_studies FOR SELECT TO authenticated USING (true);
CREATE POLICY studies_insert ON public.timing_studies FOR INSERT TO authenticated WITH CHECK (is_editor());
CREATE POLICY studies_update ON public.timing_studies FOR UPDATE TO authenticated USING (is_editor());
CREATE POLICY studies_delete ON public.timing_studies FOR DELETE TO authenticated USING (is_admin());

CREATE POLICY steps_select ON public.timing_steps FOR SELECT TO authenticated USING (true);
CREATE POLICY steps_insert ON public.timing_steps FOR INSERT TO authenticated WITH CHECK (is_editor());
CREATE POLICY steps_update ON public.timing_steps FOR UPDATE TO authenticated USING (is_editor());
CREATE POLICY steps_delete ON public.timing_steps FOR DELETE TO authenticated USING (is_admin());
