import React from 'react';
import PlaceholderPage from './PlaceholderPage';
import { Users } from 'lucide-react';

export default function Team() {
    return (
        <PlaceholderPage
            icon={Users}
            title="Equipo"
            description="Vista general del equipo de ingeniería con carga de trabajo, capacidad y roles asignados."
            phase={4}
            features={[
                'Listado de ingenieros y técnicos con rol de equipo',
                'Capacidad semanal vs horas asignadas',
                'Porcentaje de utilización por persona',
                'Indicador de sobrecarga',
                'Historial de desempeño',
            ]}
        />
    );
}
