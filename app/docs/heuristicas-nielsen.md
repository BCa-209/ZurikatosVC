# Heurísticas de Nielsen en el frontend

Esta tabla establece criterios observables para la base inicial. Las verificaciones automáticas cubren flujos concretos; la evaluación completa requiere también revisión con usuarios y con la cartografía real.

Referencia: Jakob Nielsen, [10 Usability Heuristics for User Interface Design, Nielsen Norman Group](https://www.nngroup.com/articles/ten-usability-heuristics/), revisión del 30 de enero de 2024. Las aplicaciones al proyecto de esta tabla son decisiones de diseño de esta implementación.

| Heurística | Implementación | Cómo comprobarla |
| --- | --- | --- |
| 1. Visibilidad del estado del sistema | Estado de simulación, indicadores de avance, cinco camiones, cargas, conexión, última sincronización y botones de procesamiento. | Iniciar, pausar y desconectar la API; la vista conserva los datos y señala cuando están desactualizados. |
| 2. Relación con el mundo real | Español, manzanas, lados, camiones, depósito y kg. La simulación se identifica explícitamente. | Verificar que el usuario distingue datos simulados de mediciones reales. Horas en America/Lima. |
| 3. Control y libertad | Pausar/reanudar, cancelar diálogos, cerrar con Escape, limpiar filtros y deseleccionar rutas. | Cancelar un reinicio conserva el recorrido. La pausa congela posición, tiempo y carga. |
| 4. Consistencia y estándares | Términos, botones y estados uniformes; verde/no visitado, amarillo/en recorrido y rojo/visitado según la propuesta. | Contrastar leyenda, mapa, tabla y detalle. Los colores se acompañan de nombres y trazos distintos. |
| 5. Prevención de errores | Confirmación de reinicio, validación de capacidad, acciones deshabilitadas durante peticiones y acceso público de solo lectura también en la API. | Intentar operar sin clave, configurar capacidad insuficiente y cancelar cambios destructivos. |
| 6. Reconocer antes que recordar | Leyenda visible, rutas seleccionables, estados y capacidad visibles, detalle contextual por lado. | Identificar un lado sin memorizar códigos de colores o consultar otra pantalla. |
| 7. Flexibilidad y eficiencia | Buscar por manzana/lado/camión, filtrar por estado, cambiar velocidad, teclado y atajo `?` para ayuda. | Probar Tab, Enter, Espacio, Escape, filtros combinados y selección de camión. |
| 8. Diseño estético y minimalista | Resumen de cuatro métricas, mapa como centro, detalle bajo demanda y diseño adaptable a móvil. | Revisar escritorio y móvil; la tabla tiene desplazamiento horizontal propio. |
| 9. Reconocimiento y recuperación de errores | Mensajes en español, clave incorrecta recuperable, reintento de conexión y conservación de sesión si un plan falla. | Introducir clave incorrecta, reintentar y enviar una configuración inviable. |
| 10. Ayuda y documentación | Guía de uso accesible desde navegación y cabecera; explica consulta, estados, operación y limitaciones. | Abrir ayuda con botón y `?`, recorrerla con teclado y cerrarla con Escape. |

## Accesibilidad incorporada

- HTML semántico, etiquetas de campos y controles con nombres accesibles.
- Enlace para saltar al contenido y foco visible en enlaces, botones, formularios y segmentos del esquema.
- Diálogos nativos que contienen el foco y lo devuelven al control de origen.
- Textos y patrones además de color para los estados; tabla como alternativa al mapa.
- Avisos de acciones con `role=status` y errores con `role=alert`.
- Respeto por `prefers-reduced-motion`, tipografía adaptable y diseños para pantallas pequeñas.

Las pruebas de navegador verifican consulta pública, búsqueda, selección, detalle, acceso operativo, errores de clave, inicio, pausa, cancelación de reinicio, configuración, salida, ayuda por teclado y ausencia de desbordamiento global en móvil. El modo Mapbox necesita un token y revisión adicional; las pruebas locales usan el esquema sin credenciales.

Se incluye una revisión automática con axe para las reglas WCAG A/AA seleccionadas en escritorio, móvil y acceso operativo. Esto detecta problemas concretos de accesibilidad; no equivale a una certificación de accesibilidad ni a una evaluación completa de usabilidad.
