Alcances y limitaciones del sistema

El proyecto contempla el desarrollo de un sistema web interactivo para la simulación y optimización de rutas de camiones recolectores de residuos sólidos en un área delimitada de la ciudad de Puno. Para ello, se utilizará Mapbox junto con información geográfica de OpenStreetMap (OSM), permitiendo representar la red vial, los sentidos de circulación, las manzanas urbanas y los vehículos recolectores.

La propuesta utilizará B. Solver junto con una transformación del problema de rutas de vehículos (VRP), considerando la naturaleza del problema de recolección mediante la representación de cada lado de manzana como una unidad independiente de servicio. El sistema contará con cinco camiones recolectores que compartirán un único punto de partida, desde donde se determinarán sus recorridos mediante el algoritmo de optimización.

Para la planificación de las rutas se considerarán los sentidos de circulación de las vías y se excluirán los pasajes y callejones que no formen parte del área operativa de recolección. Asimismo, se establecerá una relación entre los segmentos viales y los lados de las manzanas, permitiendo identificar cuáles deben ser atendidos por los vehículos.

Durante la simulación, cada lado de manzana contará con tres estados: no visitado (verde), en recorrido (amarillo) y visitado (rojo). Cuando un camión inicie la atención de un lado, su estado cambiará a en recorrido. Al finalizar la recolección, el sistema asignará aleatoriamente entre 5 y 8 kilogramos de residuos, actualizará la carga acumulada del vehículo y cambiará el estado del lado a visitado. Posteriormente, el camión continuará hacia su siguiente tarea asignada.

El sistema permitirá visualizar los cinco camiones, sus recorridos, los estados de los lados de manzana y los kilogramos recolectados durante la simulación.

Limitaciones:

El sistema estará orientado a una simulación computacional y no contemplará inicialmente el seguimiento GPS de vehículos reales ni la integración con sistemas municipales de gestión de residuos. Los kilogramos asignados serán valores aleatorios para fines de simulación y no representarán mediciones reales de generación de residuos. Asimismo, no se considerarán condiciones de tráfico en tiempo real, accidentes, bloqueos temporales ni variaciones reales en los tiempos de recolección. La precisión de las rutas dependerá de la calidad y actualización de los datos geográficos disponibles en OpenStreetMap y de la correcta identificación de los segmentos viales y lados de manzana del área de estudio.