# Documento de Requerimientos: Timing Study Manager & KPIs

Este documento establece las especificaciones críticas de diseño y comportamiento para el componente `TimingStudyManager.jsx`. Estas directrices deben ser respetadas estrictamente en futuras modificaciones para evitar la pérdida de funciones críticas o problemas de diseño visual.

---

## 1. Diagrama Didáctico de Flujo (Flujo Lógico de Diseño y Capacidad)

Este es un widget visual e interactivo situado en la parte superior del módulo de estudios de tiempo.

* **Función**: Mapear y guiar al usuario a través del proceso lógico de diseño del estudio de tiempo (Tiempos Físicos, Tiempos Lógicos, Disponibilidad, Eficiencia, Calidad y Capacidad Final).
* **Restricción de Modificación**: **NUNCA** debe ser eliminado, compactado en una sola columna o simplificado a menos que el usuario lo solicite explícitamente por escrito. Es un requerimiento visual central para la toma de decisiones.

---

## 2. Layout y Comportamiento de Tarjetas de KPIs

Las tarjetas de KPIs muestran información clave de productividad como el Objetivo/Día, la Capacidad Teórica, Disponibilidad, Eficiencia y Calidad.

### 2.1 Tooltip de "Objetivo / Día" (card-objDia)
* **Problema anterior**: El tooltip centrado (`left-1/2 -translate-x-1/2`) colisionaba con el menú lateral de la aplicación web (sidebar), ocultando la mitad de la información útil.
* **Requerimiento**: El contenedor de este tooltip debe estar alineado permanentemente al extremo izquierdo de la tarjeta (`left-0`), y su flecha decorativa/indicadora debe estar desplazada ligeramente a la derecha (`left-6`) para apuntar al icono correspondiente.

### 2.2 Stacking Context (Profundidad de Tooltips)
* **Problema anterior**: Al desplegarse los tooltips de las tarjetas de KPIs, quedaban ocultos por debajo del panel de configuración general inferior debido a contextos de apilamiento incorrectos.
* **Requerimiento**:
  * El contenedor superior de KPIs debe poseer la clase `relative z-20`.
  * El contenedor del panel inferior de configuración general debe poseer la clase `relative z-10`.
  * De esta forma, cualquier tooltip o menú flotante originado en las tarjetas de KPIs pasará por encima de los controles de abajo.

---

## 3. Integridad del Código y Compilación
* **Validación JSX**: Todo cambio en el JSX debe pasar un análisis sintáctico antes de ser guardado para evitar etiquetas huérfanas o IIFEs residuales.
* **Build de Producción**: La aplicación debe ser compilable mediante `npm run build` sin advertencias críticas de empaquetado ni fallos en Vite.
* **Estrategia de Control**: Realizar commits continuos a Git en cada etapa del desarrollo para asegurar un punto de retorno seguro en caso de fallos.
