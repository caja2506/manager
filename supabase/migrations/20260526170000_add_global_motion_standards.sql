-- ══════════════════════════════════════════════════════════════
-- AutoBOM Pro — Initial Global Motion Standards configuration
-- Migration: 20260526170000_add_global_motion_standards.sql
-- Date: 2026-05-26
-- ══════════════════════════════════════════════════════════════

INSERT INTO public.settings (key, value, description, category)
VALUES (
  'global_motion_standards',
  '{
    "motionTimeValues": {
      "controller_scan_network": 80,
      "valve_response": 30,
      "handshake_response": 200,
      "vision_camera_response": 15,
      "rf_tag_read": 25,
      "shock_absorber_deceleration": 1000,
      "small_gripper": 150,
      "large_gripper": 200,
      "vacuum_gripper": 400,
      "guided_cylinder": 200,
      "standard_pneumatic_cylinder": 300,
      "rodless_cylinder": 350,
      "short_large_bore_cylinder": 450,
      "small_rotary_actuator": 600,
      "large_rotary_actuator": 2400,
      "escapement_tic_toc": 500,
      "pneumatic_rotary_clamp": 1000,
      "servo_belt_driven": 500,
      "servo_ballscrew_direct_coupled": 500,
      "servo_timing_belt_driven": 1000,
      "servo_linear_motor": 2000,
      "epson_t3_robot": 1500,
      "c6_robot": 1000
    },
    "classifiers": [
      { "id": "c1", "deviceType": "CYL PNEU", "deviceAction": "EXT", "motionValueId": "standard_pneumatic_cylinder" },
      { "id": "c2", "deviceType": "CYL PNEU", "deviceAction": "RET", "motionValueId": "standard_pneumatic_cylinder" },
      { "id": "c3", "deviceType": "ROT PNEU", "deviceAction": "CW", "motionValueId": "small_rotary_actuator" },
      { "id": "c4", "deviceType": "ROT PNEU", "deviceAction": "CCW", "motionValueId": "small_rotary_actuator" },
      { "id": "c5", "deviceType": "GPR", "deviceAction": "*", "motionValueId": "small_gripper" },
      { "id": "c6", "deviceType": "GPR SO", "deviceAction": "*", "motionValueId": "small_gripper" },
      { "id": "c7", "deviceType": "GPR SC", "deviceAction": "*", "motionValueId": "large_gripper" },
      { "id": "c8", "deviceType": "SV", "deviceAction": "*", "motionValueId": "servo_timing_belt_driven" }
    ]
  }'::jsonb,
  'Estándares globales de tiempos de movimientos y clasificadores para estudios de tiempos',
  'timing_standards'
)
ON CONFLICT (key) DO UPDATE 
SET value = EXCLUDED.value, 
    description = EXCLUDED.description, 
    category = EXCLUDED.category;
