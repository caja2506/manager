-- Migration: Add motion_profile_id to timing_steps + actuator_groups in settings
-- ================================================================================

-- 1. Agregar motion_profile_id a timing_steps
ALTER TABLE public.timing_steps
    ADD COLUMN IF NOT EXISTS motion_profile_id TEXT DEFAULT NULL;

COMMENT ON COLUMN public.timing_steps.motion_profile_id IS
    'ID del perfil de velocidad seleccionado (referencia a actuator_groups.profiles[].id)';

-- 2. Insertar configuración por defecto de actuator_groups en tabla settings
-- Usa UPSERT para no duplicar si ya existe
INSERT INTO public.settings (key, value, description, category, updated_at)
VALUES (
    'actuator_groups',
    '{
        "groups": [
            {
                "id": "grp_cyl",
                "code": "CYL",
                "label": "Cilindro",
                "needsLinearDistance": true,
                "needsAngularDistance": false,
                "needsValve": true,
                "subtypes": ["CYL PNEU", "CYL ELEC", "CYL HYD"],
                "actions": ["EXT", "RET"],
                "profiles": [
                    { "id": "standard_pneumatic_cylinder", "name": "Cilindro Estándar", "value": 300, "unit": "mm/s", "applicableSubtypes": ["CYL PNEU"] },
                    { "id": "guided_cylinder", "name": "Cilindro Guiado", "value": 200, "unit": "mm/s", "applicableSubtypes": ["CYL PNEU"] },
                    { "id": "rodless_cylinder", "name": "Sin Vástago", "value": 350, "unit": "mm/s", "applicableSubtypes": ["CYL PNEU"] },
                    { "id": "short_large_bore_cylinder", "name": "Carrera Corta", "value": 450, "unit": "mm/s", "applicableSubtypes": ["CYL PNEU"] },
                    { "id": "elec_cyl_standard", "name": "Cil. Eléctrico Estándar", "value": 400, "unit": "mm/s", "applicableSubtypes": ["CYL ELEC"] },
                    { "id": "elec_cyl_fast", "name": "Cil. Eléctrico Rápido", "value": 800, "unit": "mm/s", "applicableSubtypes": ["CYL ELEC"] },
                    { "id": "hyd_cyl_standard", "name": "Cil. Hidráulico Estándar", "value": 100, "unit": "mm/s", "applicableSubtypes": ["CYL HYD"] }
                ]
            },
            {
                "id": "grp_gpr",
                "code": "GPR",
                "label": "Gripper / Pinza",
                "needsLinearDistance": false,
                "needsAngularDistance": false,
                "needsValve": true,
                "subtypes": ["GPR", "GPR SO", "GPR SC"],
                "actions": ["OPN", "CLS"],
                "profiles": [
                    { "id": "small_gripper", "name": "Pinza Chica", "value": 150, "unit": "ms", "applicableSubtypes": ["GPR", "GPR SC"] },
                    { "id": "large_gripper", "name": "Pinza Grande", "value": 200, "unit": "ms", "applicableSubtypes": ["GPR"] },
                    { "id": "vacuum_gripper", "name": "Ventosa de Vacío", "value": 400, "unit": "ms", "applicableSubtypes": ["GPR SO"] }
                ]
            },
            {
                "id": "grp_rot",
                "code": "ROT",
                "label": "Rotativo",
                "needsLinearDistance": false,
                "needsAngularDistance": true,
                "needsValve": true,
                "subtypes": ["ROT PNEU", "ROT ELEC"],
                "actions": ["CW", "CCW"],
                "profiles": [
                    { "id": "small_rotary_actuator", "name": "Rotativo Chico", "value": 600, "unit": "deg/s", "applicableSubtypes": ["ROT PNEU"] },
                    { "id": "large_rotary_actuator", "name": "Rotativo Grande", "value": 2400, "unit": "deg/s", "applicableSubtypes": ["ROT PNEU"] },
                    { "id": "elec_rotary", "name": "Rotativo Eléctrico", "value": 3600, "unit": "deg/s", "applicableSubtypes": ["ROT ELEC"] }
                ]
            },
            {
                "id": "grp_sv",
                "code": "SV",
                "label": "Servo",
                "needsLinearDistance": true,
                "needsAngularDistance": false,
                "needsValve": false,
                "subtypes": ["SV"],
                "actions": ["ADV", "RTN", "HOR"],
                "profiles": [
                    { "id": "servo_belt_driven", "name": "Banda", "value": 500, "unit": "mm/s", "applicableSubtypes": [] },
                    { "id": "servo_ballscrew_direct_coupled", "name": "Husillo", "value": 500, "unit": "mm/s", "applicableSubtypes": [] },
                    { "id": "servo_timing_belt_driven", "name": "Banda de Tiempo", "value": 1000, "unit": "mm/s", "applicableSubtypes": [] },
                    { "id": "servo_linear_motor", "name": "Motor Lineal", "value": 2000, "unit": "mm/s", "applicableSubtypes": [] }
                ]
            },
            {
                "id": "grp_robot",
                "code": "ROBOT",
                "label": "Robot",
                "needsLinearDistance": false,
                "needsAngularDistance": false,
                "needsValve": false,
                "subtypes": ["ROBOT"],
                "actions": ["*", "WAIT", "DELAY"],
                "profiles": [
                    { "id": "epson_t3_robot", "name": "Epson T3", "value": 1500, "unit": "ms", "applicableSubtypes": [] },
                    { "id": "c6_robot", "name": "C6", "value": 1000, "unit": "ms", "applicableSubtypes": [] }
                ]
            },
            {
                "id": "grp_feeder",
                "code": "FEEDER",
                "label": "Alimentador",
                "needsLinearDistance": false,
                "needsAngularDistance": false,
                "needsValve": false,
                "subtypes": ["FEEDER", "VIB"],
                "actions": ["ADV", "RTN", "ON", "OFF"],
                "profiles": [
                    { "id": "escapement_tic_toc", "name": "Escapement", "value": 500, "unit": "ms", "applicableSubtypes": [] }
                ]
            }
        ]
    }'::jsonb,
    'Grupos de actuadores con sus subtipos, acciones y perfiles de velocidad',
    'actuator_config',
    now()
)
ON CONFLICT (key) DO UPDATE
    SET value = EXCLUDED.value,
        updated_at = now();
