import React from 'react';
import PlaceholderPage from './PlaceholderPage';
import { Bell } from 'lucide-react';

export default function Notifications() {
    return (
        <PlaceholderPage
            icon={Bell}
            title="Notificaciones"
            description="Centro de notificaciones del sistema con alertas de tareas, riesgos y reportes."
            phase={8}
            features={[
                'Notificaciones de tareas asignadas',
                'Alertas de cambio de estado',
                'Avisos de tareas bloqueadas',
                'Alertas de riesgo de proyecto',
                'Notificaciones de horas extra excesivas',
                'Marcar como leído/no leído',
            ]}
        />
    );
}
