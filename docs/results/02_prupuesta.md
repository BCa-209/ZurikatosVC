# PROPUESTA DE PROYECTO

# Sistema web de optimización y simulación de rutas de camiones recolectores de residuos sólidos en la ciudad de Puno mediante B. Solver y transformación del VRP

## 1. Descripción general del proyecto

El proyecto consiste en desarrollar un sistema web interactivo para la optimización y simulación de rutas de camiones recolectores de residuos sólidos en un área delimitada de la ciudad de Puno.

El sistema utilizará información geográfica de OpenStreetMap (OSM) y Mapbox para representar las calles, intersecciones, sentidos de circulación y manzanas urbanas. Sobre esta información se desarrollará un modelo de optimización basado en B. Solver y una transformación del Vehicle Routing Problem (VRP), considerando que la recolección de residuos debe realizarse por cada lado de las manzanas y no solamente mediante la visita de puntos geográficos.

Se simulará el funcionamiento de cinco camiones recolectores que partirán de un único punto de origen. El algoritmo determinará la distribución de los recorridos, considerando las calles habilitadas, sus sentidos de circulación y los lados de manzana que todavía no han sido atendidos.

Cada lado de manzana tendrá un estado independiente: no visitado (verde), en recorrido (amarillo) y visitado (rojo). Cuando un camión termine la recolección de un lado, el sistema asignará aleatoriamente entre 5 y 8 kilogramos de residuos, actualizará su carga acumulada y continuará hacia su siguiente tarea.

Adicionalmente, el sistema contará con una interfaz pública para que los ciudadanos puedan consultar la ubicación simulada de los camiones, los recorridos y el avance de la recolección en los diferentes sectores.

## 2. Objetivo general

Desarrollar un sistema web que permita optimizar y simular los recorridos de cinco camiones recolectores de residuos sólidos en un área delimitada de la ciudad de Puno, mediante B. Solver y una transformación del VRP, considerando los sentidos de circulación de las vías y la atención individual de los lados de las manzanas, con la finalidad de mejorar la planificación y visualización de los recorridos de recolección.

## 3. Objetivos específicos

1. Obtener y procesar información geográfica de OpenStreetMap para representar las calles, intersecciones, sentidos de circulación y manzanas del área de estudio.
2. Identificar y segmentar los lados de las manzanas para convertirlos en unidades independientes de servicio de recolección.
3. Construir una red vial dirigida que permita representar las restricciones de circulación de los vehículos.
4. Implementar un modelo de optimización basado en B. Solver y una transformación del VRP para distribuir los lados de manzana pendientes entre cinco camiones recolectores.
5. Desarrollar un módulo de simulación que permita visualizar los desplazamientos de los camiones y actualizar los estados de los lados de manzana.
6. Simular la cantidad de residuos recolectados mediante la asignación aleatoria de valores entre 5 y 8 kilogramos por lado atendido.
7. Implementar una interfaz pública que permita a los ciudadanos consultar la ubicación simulada de los camiones y el avance de la recolección.

## 4. Alcances del sistema

### 4.1. Representación geográfica mediante Mapbox y OpenStreetMap

El sistema contará con un mapa interactivo de un área delimitada de la ciudad de Puno.

Se utilizarán las siguientes fuentes y tecnologías:

- **Mapbox:** visualización e interacción con el mapa.
- **OpenStreetMap:** información geográfica de calles, intersecciones, manzanas y restricciones viales.
- **Red vial dirigida:** representación de los sentidos permitidos de circulación.
- **Geometrías de manzanas:** identificación de los polígonos urbanos y sus lados.

Se implementarán las siguientes funcionalidades:

- Visualización de calles y manzanas.
- Representación de los sentidos de circulación mediante flechas.
- Identificación de intersecciones y esquinas.
- Identificación de los lados de cada manzana.
- Exclusión de pasajes y callejones según los criterios de filtrado establecidos.
- Visualización de los recorridos de los cinco camiones.

### 4.2. Transformación de las manzanas en unidades de servicio

Cada manzana será dividida en segmentos correspondientes a sus lados.

Cada lado será considerado una unidad independiente de recolección.

Por ejemplo, una manzana rectangular podrá contener cuatro unidades:

- Lado norte.
- Lado sur.
- Lado este.
- Lado oeste.

Las manzanas irregulares podrán tener una cantidad diferente de lados.

El sistema relacionará cada lado de manzana con el segmento vial correspondiente, considerando la geometría y la orientación de la calle.

No se considerará que una manzana completa ha sido atendida cuando el camión solamente haya recorrido uno de sus lados.

Cada lado tendrá un estado independiente.

### 4.3. Gestión de los sentidos de circulación

La red vial se construirá considerando los sentidos de circulación registrados en OpenStreetMap.

Se tendrán en cuenta:

- Calles de sentido único.
- Calles de doble sentido.
- Restricciones de circulación.
- Sentidos permitidos en las intersecciones.
- Restricciones de giro cuando estén disponibles.
- Exclusión de vías que no formen parte del recorrido operativo.

El algoritmo deberá respetar obligatoriamente las direcciones permitidas.

No se permitirá que un camión utilice una calle en sentido contrario para completar una tarea de recolección.

La red vial será representada como un grafo dirigido, en el cual:

- Los nodos representarán intersecciones y esquinas.
- Las aristas representarán segmentos viales.
- Las aristas tendrán una dirección permitida.
- Los lados de manzana estarán asociados a tareas de servicio.

### 4.4. Gestión de los cinco camiones recolectores

El sistema simulará cinco camiones recolectores.

Características:

- Los cinco camiones compartirán un único punto de partida.
- Cada camión tendrá una ruta asignada por el algoritmo.
- Los recorridos se distribuirán entre los lados de manzana pendientes.
- Cada lado será asignado a un único camión.
- Se evitará la duplicidad de tareas de recolección.
- Cada camión tendrá una ubicación simulada independiente.
- Se registrará la cantidad acumulada de residuos por vehículo.

Los camiones podrán visualizarse simultáneamente en el mapa.

### 4.5. Estados de los lados de manzana

Cada lado de manzana tendrá tres estados:

|Estado|Color|Descripción|
|---|---|---|
|No visitado|Verde|El lado todavía no ha sido atendido.|
|En recorrido|Amarillo|Un camión está realizando la recolección.|
|Visitado|Rojo|La recolección del lado ha finalizado.|

La transición de estados será:

**No visitado → En recorrido → Visitado.**

Cada lado contará con información independiente:

- Identificador de manzana.
- Identificador del lado.
- Segmento vial asociado.
- Camión asignado.
- Estado actual.
- Kilogramos recolectados.
- Fecha y hora de inicio.
- Fecha y hora de finalización.

### 4.6. Simulación de los residuos recolectados

Cada vez que un camión termine la atención de un lado de manzana, el sistema asignará aleatoriamente una cantidad de residuos entre 5 y 8 kg.

La cantidad asignada será acumulada en la carga del camión correspondiente.

Se permitirá visualizar:

- Kilogramos recolectados por lado.
- Carga acumulada por camión.
- Cantidad total de residuos recolectados.
- Cantidad de lados atendidos.
- Cantidad de lados pendientes.

Los valores serán simulados y no representarán mediciones reales de generación de residuos.

Se podrá establecer una capacidad máxima configurable para cada camión.

### 4.7. Simulación del desplazamiento de los camiones

El sistema representará el movimiento de los cinco camiones sobre la red vial.

Cada camión deberá:

1. Partir del punto de origen común.
2. Recibir una ruta y una secuencia de tareas.
3. Desplazarse hacia el siguiente lado de manzana asignado.
4. Llegar al punto de inicio del segmento de servicio.
5. Cambiar el estado del lado a en recorrido.
6. Ejecutar la simulación de recolección.
7. Recibir una cantidad aleatoria de entre 5 y 8 kg.
8. Actualizar su carga acumulada.
9. Cambiar el estado del lado a visitado.
10. Continuar hacia su siguiente tarea.

La simulación finalizará cuando todos los lados de manzana incluidos en el área de estudio hayan sido atendidos.

### 4.8. Interfaz pública para los ciudadanos

El sistema contará con una interfaz de consulta pública destinada a los ciudadanos de Puno.

Esta interfaz permitirá consultar información sobre el servicio de recolección sin necesidad de modificar la configuración del sistema.

Los ciudadanos podrán:

- Visualizar la ubicación simulada de los cinco camiones.
- Consultar los recorridos que realizan.
- Identificar los sectores que ya fueron atendidos.
- Identificar los sectores pendientes de recolección.
- Consultar los lados de manzana en proceso de atención.
- Visualizar el avance general de la recolección.
- Consultar el estado de los camiones durante la simulación.

La interfaz será de solo lectura y no permitirá modificar rutas, estados ni información operativa.

La ubicación mostrada corresponderá a la simulación y no a un seguimiento GPS de vehículos reales.

## 5. Modelo de optimización

### 5.1. Enfoque del problema

Aunque se utilizará una transformación del Vehicle Routing Problem (VRP), el problema presenta características de un Arc Routing Problem (ARP).

Esto se debe a que el objetivo no consiste únicamente en visitar puntos geográficos, sino en recorrer y atender segmentos específicos de las calles correspondientes a los lados de las manzanas.

Por ello, se propone transformar cada lado de manzana en una tarea de servicio que pueda ser asignada a uno de los cinco vehículos.

El modelo deberá considerar:

- Un depósito o punto de partida común.
- Cinco vehículos.
- Una red vial dirigida.
- Tareas de recolección asociadas a los lados de manzana.
- Distancias entre nodos.
- Sentidos permitidos de circulación.
- Restricciones de acceso.
- Asignación única de cada tarea.
- Capacidad de carga de los vehículos, si se incorpora como restricción.

### 5.2. Función objetivo

Se propone minimizar la distancia total recorrida por los cinco camiones.

De manera general:

Minimizar:

**Z = Σ distancia total recorrida por cada camión**

La optimización deberá garantizar que todos los lados de manzana incluidos en el área de estudio sean atendidos exactamente una vez.

También se podrá considerar como criterio complementario el equilibrio de las cargas de trabajo entre los vehículos.

### 5.3. Restricciones principales

1. Cada lado de manzana debe ser atendido exactamente una vez.
2. Cada tarea debe asignarse a un único camión.
3. Los cinco camiones deben partir del mismo depósito.
4. Los recorridos deben respetar los sentidos de circulación.
5. No se podrán utilizar vías excluidas.
6. Los vehículos deberán desplazarse mediante conexiones válidas de la red vial.
7. Se deberá respetar la capacidad máxima de carga si se establece.
8. No se permitirá que dos camiones ejecuten simultáneamente la misma tarea.
9. La ruta debe permitir llegar al inicio y finalizar el servicio de cada lado asignado.

La optimización se realizará sobre las tareas de recolección, diferenciando los desplaz