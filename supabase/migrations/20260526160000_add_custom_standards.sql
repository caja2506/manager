-- ══════════════════════════════════════════════════════════════
-- AutoBOM Pro — Add custom_standards column to timing_studies
-- Migration: 20260526160000_add_custom_standards.sql
-- Date: 2026-05-26
-- ══════════════════════════════════════════════════════════════

ALTER TABLE public.timing_studies ADD COLUMN IF NOT EXISTS custom_standards JSONB DEFAULT NULL;
