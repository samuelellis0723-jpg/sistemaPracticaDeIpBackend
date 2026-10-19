# Progreso — Laboratorio 1 Backend

## H1 — Inspección inicial
- Antes de editar en esta sesión se encontraron `clases.js`, `main.js`, `consultar-ip.js`, `db.json`, `README.md`, `PROGRESS.md`; `agente/` no existía.
- `datos/ip-respuestas/` existía vacío (sin respuestas JSON).
- Ejecución inicial: `node main.js`, 21/21. Casos simulados en memoria.

## H2 — Lógica de clases
- Confirmados `Ubicacion.desdeIpApi(r)`, `Ubicacion.desdeIpInfo(r)`, `PoliticaEnvio.evaluar(entrada, ubicacionA, ubicacionB)` y todos los campos requeridos de salida.
- Hallazgo adversarial: no se comparaba que la IP de geolocalización fuera la IP del pedido; una ubicación válida de otra IP podía usarse. Corregido en clases: se comprueba IP de pedido/fuente y discrepancia entre fuentes; no se aprueba respuesta de otra IP. No cambiaron tarifas ni fórmulas.

## H3 — Nodo Code
- `nodo-code.js` contiene copia exacta de clases más adaptador. Admite `$json.output` string/objeto y entrada directa, valida propiedades, controla JSON inválido y unifica wrapper HTTP `statusCode/body`.
- El adaptador delega toda decisión a `PoliticaEnvio`. Modo n8n recomendado: Run Once for Each Item.

## H4 — Simulador
- `simular-nodo-code.js` ejecuta payloads sintéticos en VM; verifica los diez campos del resultado y que el bloque de clases sea igual al original.
- No consulta APIs, JSON Server ni n8n.

## H5 — Agente y tools
- Creados `agente/system-prompt.md` y `agente/tools.md`: extracción sin completar, JSON estricto, dos GET secuenciales, HTTP status/error, uso del mismo IP y Query Auth opcional para token.
- Pendiente observar en n8n si el agente usa la misma IP literal en ambas tools. `$fromAI()` deja el valor al modelo, no comparte un parámetro inmutable.

## H6 — PATCH y respuesta
- Documentación oficial de n8n confirma: Code node no puede hacer HTTP; usar HTTP Request. Chat Trigger puede entregar `text`/`output` del último nodo.
- Opción A: cuatro etapas lineales (Chat Trigger → Agent con tools → Code → respuesta Edit Fields); no persiste.
- Opción B: añadir IF (omitir PATCH sin ID) + HTTP Request PATCH; el paso Resultado final interpreta 404 y errores y crea respuesta legible. Son dos nodos lineales extra sobre cuatro principales. Los tool nodes son conectores del agente.
- Pendiente aprobación del docente para nodos extra. No se levantó JSON Server ni se verificó PATCH/404.

## H7 — README
- Incluye comandos locales, generación de fixtures reales por el estudiante, JSON Server GET/PATCH, IDs, 404, Docker/Cloud, instrucciones n8n y fuentes oficiales.
- Versión de JSON Server no comprobada en el entorno.

## H8 — Pruebas finales
- `node main.js`: 21/21, salida real a continuación.
- `node simular-nodo-code.js`: 28/28 simulados, salida real a continuación.
- Ninguna llamada a APIs; JSON Server y workflow n8n no ejecutados.

## H9 — Equivalencia
- Comparación literal por marcador entre el bloque de clases en `nodo-code.js` y `clases.js`: IGUALES, 12114/12114 caracteres en la salida del comparador.

## H10 — Árbitro adversarial
- Probados null/vacío/truncado/mal formado, array, propiedades ausentes, errores no-array, IDs numéricos, strings numéricos, ubicaciones inválidas, IP devuelta distinta, IPs fuente discrepantes, HTTP 429, respuesta envuelta, privadas/inválidas, respaldo y ambas caídas.
- 21/21 reglas y 28/28 casos del adaptador pasan. Ninguna prueba local afirma que datos de memoria sean reales.
- Límite: el agente está instruido para copiar bodies, pero un LLM puede alterar JSON; IP coincidente no certifica procedencia. Garantía más fuerte requiere llamadas deterministas fuera del agente y permiso del docente.
- Pendientes: respuestas reales, JSON Server real (incluido 404), y ejecución n8n.

## Salida real completa de `node main.js`

```text

R1 país fuera de cobertura
  Entrada: prueba en memoria: país US
  Esperado: FUERA_DE_COBERTURA
  Obtenido: FUERA_DE_COBERTURA
  OK

R2 tarifa base RESTO_PAIS
  Entrada: prueba en memoria: Guanacaste, 1 kg
  Esperado: 4500
  Obtenido: 4500
  OK

R3 recargo por exceso de peso
  Entrada: prueba en memoria: GAM, 7 kg
  Esperado: 3500
  Obtenido: 3500
  OK

R4 envío gratis en GAM
  Entrada: prueba en memoria: GAM, subtotal 50000
  Esperado: 0
  Obtenido: 0
  OK

R5 pedido procesado
  Entrada: prueba en memoria: estado aprobado
  Esperado: PEDIDO_YA_PROCESADO
  Obtenido: PEDIDO_YA_PROCESADO
  OK

R6 país discrepante
  Entrada: prueba en memoria: ip-api CR, ipinfo US
  Esperado: GEO_INCONSISTENTE
  Obtenido: GEO_INCONSISTENTE
  OK

Fuentes coinciden
  Entrada: prueba en memoria: ambas CR, región ip-api Cartago
  Esperado: GAM
  Obtenido: GAM
  OK

Solo IP-API responde
  Entrada: prueba en memoria: ubicación ip-api
  Esperado: GAM
  Obtenido: GAM
  OK

Solo ipinfo responde
  Entrada: prueba en memoria: ubicación ipinfo, provincia
  Esperado: GAM
  Obtenido: GAM
  OK

Ambas fuentes caídas
  Entrada: prueba en memoria: ambas ausentes
  Esperado: GEO_FALLIDA
  Obtenido: GEO_FALLIDA
  OK

Respuesta ip-api privada
  Entrada: prueba en memoria: error privado de API
  Esperado: IP_PRIVADA_O_RESERVADA
  Obtenido: IP_PRIVADA_O_RESERVADA
  OK

Datos incompletos
  Entrada: prueba en memoria: pedido sin IP ni artículos
  Esperado: DATOS_INCOMPLETOS
  Obtenido: DATOS_INCOMPLETOS
  OK

Entrada de ubicación inválida
  Entrada: prueba en memoria: objeto sin validar
  Esperado: GEO_FALLIDA
  Obtenido: GEO_FALLIDA
  OK

Error inesperado
  Entrada: prueba en memoria: configuración ausente
  Esperado: ERROR_INTERNO
  Obtenido: ERROR_INTERNO
  OK

Normalización de tildes y contenido
  Entrada: prueba en memoria: Provincia de San Jose
  Esperado: GAM
  Obtenido: GAM
  OK

Datos numéricos como strings
  Entrada: prueba en memoria: precio 10000 y peso 1 string
  Esperado: true
  Obtenido: true
  OK

PATCH técnico conserva estado
  Entrada: prueba en memoria: ambas fuentes ausentes
  Esperado: pendiente
  Obtenido: pendiente
  OK

ipinfo separa las coordenadas loc
  Entrada: prueba en memoria: loc 9.9,-84
  Esperado: -84
  Obtenido: -84
  OK

PATCH de aprobación tiene los cinco campos
  Entrada: prueba en memoria: pedido aprobado
  Esperado: aprobado,GAM,2500,12500,null
  Obtenido: aprobado,GAM,2500,12500,null
  OK

Pedido null no lanza
  Entrada: prueba en memoria: pedido null
  Esperado: DATOS_INCOMPLETOS
  Obtenido: DATOS_INCOMPLETOS
  OK

ipinfo status fail privado
  Entrada: prueba en memoria: status fail private range
  Esperado: IP_PRIVADA_O_RESERVADA
  Obtenido: IP_PRIVADA_O_RESERVADA
  OK

21 de 21 casos pasaron.
AVISO: todas las ubicaciones son datos de prueba en memoria; no hay consultas reales ni respuestas guardadas de las APIs.
```

## Salida real completa de `node simular-nodo-code.js`

```text
Comparación de clases nodo-code.js vs clases.js: IGUALES (12114 / 12114 caracteres)
[SIMULADO] Pedido aprobado: esperado=aprobado; obtenido=aprobado; OK
[SIMULADO] Envío gratis GAM: esperado=0; obtenido=0; OK
[SIMULADO] Recargo de peso: esperado=3500; obtenido=3500; OK
[SIMULADO] Región costarricense fuera de cobertura: esperado=FUERA_DE_COBERTURA; obtenido=FUERA_DE_COBERTURA; OK
[SIMULADO] País distinto de Costa Rica: esperado=FUERA_DE_COBERTURA; obtenido=FUERA_DE_COBERTURA; OK
[SIMULADO] IP privada: esperado=IP_PRIVADA_O_RESERVADA; obtenido=IP_PRIVADA_O_RESERVADA; OK
[SIMULADO] IP inválida: esperado=IP_INVALIDA; obtenido=IP_INVALIDA; OK
[SIMULADO] Pedido incompleto: esperado=DATOS_INCOMPLETOS; obtenido=DATOS_INCOMPLETOS; OK
[SIMULADO] APIs discrepantes: esperado=GEO_INCONSISTENTE; obtenido=GEO_INCONSISTENTE; OK
[SIMULADO] Solo IP-API disponible: esperado=aprobado; obtenido=aprobado; OK
[SIMULADO] Solo IPinfo disponible: esperado=aprobado; obtenido=aprobado; OK
[SIMULADO] Ambas APIs caídas: esperado=GEO_FALLIDA; obtenido=GEO_FALLIDA; OK
[SIMULADO] Pedido procesado: esperado=PEDIDO_YA_PROCESADO; obtenido=PEDIDO_YA_PROCESADO; OK
[SIMULADO] JSON mal formado: esperado=ERROR_INTERNO; obtenido=ERROR_INTERNO; OK
[SIMULADO] JSON truncado: esperado=ERROR_INTERNO; obtenido=ERROR_INTERNO; OK
[SIMULADO] Salida vacía: esperado=ERROR_INTERNO; obtenido=ERROR_INTERNO; OK
[SIMULADO] Salida null: esperado=ERROR_INTERNO; obtenido=ERROR_INTERNO; OK
[SIMULADO] Arreglo inesperado: esperado=ERROR_INTERNO; obtenido=ERROR_INTERNO; OK
[SIMULADO] Propiedad obligatoria ausente: esperado=ERROR_INTERNO; obtenido=ERROR_INTERNO; OK
[SIMULADO] ID numérico preservado: esperado=101; obtenido=101; OK
[SIMULADO] Error técnico conserva estado: esperado=true; obtenido=true; OK
[SIMULADO] Ubicación corresponde a otra IP: esperado=GEO_FALLIDA; obtenido=GEO_FALLIDA; OK
[SIMULADO] IP distinta entre fuentes: esperado=GEO_INCONSISTENTE; obtenido=GEO_INCONSISTENTE; OK
[SIMULADO] Respuesta del agente como objeto directo: esperado=aprobado; obtenido=aprobado; OK
[SIMULADO] Arreglo de errores mal formado: esperado=ERROR_INTERNO; obtenido=ERROR_INTERNO; OK
[SIMULADO] Wrapper HTTP 2xx de IP-API: esperado=aprobado; obtenido=aprobado; OK
[SIMULADO] HTTP 429 de IP-API y respaldo ipinfo: esperado=aprobado; obtenido=aprobado; OK
[SIMULADO] Ambas tools con HTTP 429: esperado=GEO_FALLIDA; obtenido=GEO_FALLIDA; OK

28 de 28 casos simulados pasaron.
Equivalencia literal del bloque de clases: OK.
Pendiente (no simulado): respuestas reales de API, petición 404 de JSON Server y ejecución del workflow n8n.
```

## Continuación — Workflow n8n con DeepSeek y HTTP Request

> Esta sección reemplaza el diseño anterior de tools del agente para el workflow final. `agente/system-prompt.md` y `agente/tools.md` documentaban la arquitectura anterior; el workflow actual no los conecta ni usa esas tools.

### Continuación posterior — H1 preedición
- En esta sesión se leyeron los archivos listados por la nueva tarea, incluyendo `workflow-n8n.json` y `WORKFLOW_SETUP.md`.
- Antes de editar: `node main.js` terminó con `21 de 21 casos pasaron`; `node simular-nodo-code.js` terminó con `28 de 28 casos simulados pasaron` y equivalencia exacta de clases.
- Las respuestas en `datos/ip-respuestas/` están ausentes (directorio vacío). No se consultaron servicios externos ni se llamó a JSON Server o n8n.
- Contrato confirmado: `PoliticaEnvio.evaluar(entrada, ubicacionA, ubicacionB)` toma un pedido y dos `Ubicacion`/errores/nulos, y devuelve los campos de decisión más `cuerpoPatch`. Workflow nombra las APIs `IP-API` e `IPinfo`; ambas responses llevan `body`, `statusCode`, `headers` en éxito, y errores pueden llegar como item `error` por `continueRegularOutput`.
- H2: el adaptador usará los nombres existentes exactos `AI Agent`, `IP-API` e `IPinfo`; aceptará body directo o `{statusCode, body}` y tratará error de transporte/estado no 2xx como fuente ausente. Añadirá `persistir` derivado solo de ID apto y `cuerpoPatch` objeto para que IF y pruebas lo puedan consumir sin repetir reglas de negocio.

### Continuación posterior — H3 Code adaptado
- `nodo-code.js` ahora obtiene la salida del agente por `$('AI Agent').all()` y las respuestas por nombre `IP-API`/`IPinfo`; no toma el pedido de `$json`, que puede ser el resultado del HTTP Request más reciente.
- Admite respuesta directa, JSON string, `{statusCode, body}`, error técnico del nodo, 429, cuerpo ausente/JSON inválido, null y arrays inesperados. Usa parsers `Ubicacion` y delega decisión a `PoliticaEnvio.evaluar`.
- Conserva la verificación de IP de las clases. Produce los campos existentes, `cuerpoPatch` y `persistir` para el IF; el Code no hace HTTP.
- Workflow `Evaluar pedido` actualizado para usar textualmente `nodo-code.js` en modo Run Once for Each Item. El IF usa `persistir === true`.

### Continuación posterior — H4 simulador actualizado
- `simular-nodo-code.js` ahora construye contextos sintéticos separados de AI Agent, IP-API e IPinfo como en el workflow; el test de HTTP 404 ejecuta el script real del nodo final obtenido de `workflow-n8n.json`.
- Añadidos escenarios de salida aprobada, gratis, recargo, fuera de cobertura, discrepancia, fallback, ambas caídas/429, IP incorrecta, pedido procesado, malformed/null/array/campos faltantes, ID numérico/string, omisión de persistencia y PATCH 404/200 simulado.
- Resultado de esta ejecución: 39/39 simulaciones pasaron. El simulador verifica además que el Code del workflow sea igual a `nodo-code.js`.

### Continuación posterior — H5 equivalencia
- Comparación literal: `clases.js` y prefijo de clases en `nodo-code.js` iguales, 12114 caracteres. El Code del workflow coincide literalmente con `nodo-code.js`. No se modificó `clases.js`.

### Continuación posterior — H6 Persistencia y respuesta
- Confirmado en el export: el IF usa `={{ $json.persistir === true }}`; PATCH usa `pedidoId` codificado como segmento y body JSON `={{ $json.cuerpoPatch }}`. Esto conserva IDs tipo texto, como `P001`.
- El HTTP PATCH usa response con status completo y `Never Error`, además de `onError: continueRegularOutput`; el Code final lee 404 y errores de transporte. `nodo-code.js` no contiene solicitudes HTTP.
- La tabla y expresiones de `WORKFLOW_SETUP.md` se actualizaron con el contrato de salida actual. 404 probado solo en simulación explícita; no hay JSON Server real.

### Continuación posterior — H7 Documentación
- `README.md` describe arquitectura DeepSeek sin tools, ambas GET, Code compartido, PATCH, comandos de main/simulación, cómo ejecutar `consultar-ip.js`, cómo usar los pares de fixtures numerados, comandos JSON Server GET/PATCH/404, credenciales y pendientes.
- `WORKFLOW_SETUP.md` explica además la tabla de nodos, la dirección según host/Docker/Cloud, setup de n8n y las variables/credenciales a asignar. No hay decisiones de reglas/tarifas por confirmar; la versión n8n o el límite de nodos de la rúbrica sí deben consultarse con el docente si aplican.

### Continuación posterior — H8 Pruebas finales de esta sesión
- `node main.js` → `21 de 21 casos pasaron.` y aviso explícito de que las ubicaciones son datos de prueba en memoria.
- `node simular-nodo-code.js` → `39 de 39 casos simulados pasaron.`; clases iguales; Code del workflow igual a `nodo-code.js`; pendientes de APIs reales, JSON Server y n8n.
- `node --check main.js`, `node --check simular-nodo-code.js` y `node --check consultar-ip.js` terminaron sin errores. El JSON del workflow parsea y los tres scripts Code pasan verificación de sintaxis JavaScript envueltos como Code node.
- Los resultados completos están en la salida de terminal de esta sesión; no se ejecutó `consultar-ip.js`.

### Continuación posterior — H9 Árbitro adversarial
- Agente: el adaptador lee únicamente su salida por nombre; casos de salida vacía/null/array/JSON inválido/missing `pedido` devuelven el esquema controlado, sin excepción no manejada.
- HTTP: acepta bodies directos/string y wrappers; trata 429/503 y error de transporte como fuente ausente para fallback; distingue body de error de IPinfo y usa los códigos de clase.
- Política: pruebas sintéticas verifican ambas fuentes, una fuente, ambas caídas, IP retornada diferente, IPs discordantes y pedido procesado; la fuente no válida no puede provocar aprobación fuera de reglas de `clases.js`.
- Persistencia: ID string/número conservado, ID ausente no persiste; PATCH de prueba 404 produce `PEDIDO_NO_ENCONTRADO`; 200 se marca persistido. Error técnico deja `estado` fuera de `cuerpoPatch`.
- Workflow: ambos GET conservan la misma IP de `Preparar pedido`; Agent no conecta `ai_tool`; el Chat Trigger responde desde la salida `output` del último nodo. Node names del export (`IP-API`) y alias `ip-api` se soportan.
- Límite sin resolver: n8n, APIs y JSON Server no están disponibles en esta sesión; importar, asignar credenciales y observar la respuesta real del PATCH siguen pendientes, no simulados.

### H1 — Inspección y compatibilidad
- Revisados `clases.js`, `nodo-code.js`, `db.json`, `README.md` y este archivo. El Code de evaluación consume `pedido`, ubicaciones `Ubicacion` validadas y llama `PoliticaEnvio.evaluar(entrada, ubicacionA, ubicacionB)`; la salida incluye `pedidoId`, decisión, errores y `cuerpoPatch`.
- `db.json` tiene IDs de texto `P001` a `P008` y una colección `pedidos`. No se comprobó una versión instalada de JSON Server.
- `node --version`: `v24.19.0`. n8n no está instalado en el workspace y no se conoce la versión de la instancia destino.
- Fuentes oficiales consultadas: definiciones fuente n8n para DeepSeek Chat Model, AI Agent v2, Chat Trigger, Code y HTTP Request; documentación oficial de HTTP Request; documentación oficial de DeepSeek para el identificador Flash. La guía anota versiones exportadas: Chat Trigger 1.3, AI Agent 2.2, DeepSeek 1, Code 2, HTTP Request 4.2, IF 2.2. La importación en la versión del estudiante sigue pendiente.

### H2 — Diseño del flujo
- El Agent usa `={{ $json.chatInput }}` como texto, tiene prompt de extracción de pedido, y solo conexión `ai_languageModel` al nodo DeepSeek nativo. No hay conexión `ai_tool` ni memoria.
- DeepSeek se configura con `model: deepseek-flash` y `options.responseFormat: json_object`. No se agregó parámetro de thinking.
- Las llamadas normales GET toman ambas la misma IP del nodo `Preparar pedido`. El IF previo evita llamar APIs si el JSON no contiene IP textual.
- Los HTTP Request conservan body/status, usan `Never Error` y `onError: continueRegularOutput`. El Code de evaluación recupera cada respuesta por nombre de nodo; una fuente ausente/error llega como ausencia para que la política existente aplique respaldo o `GEO_FALLIDA`.
- El IF de persistencia permite solo ID string no vacío o número finito, y un `cuerpoPatch` objeto. El PATCH es HTTP Request separado. El último Code transforma 404 en `PEDIDO_NO_ENCONTRADO` y otros fallos en error técnico.

### H3 — Archivo y validación estructural
- Creado `workflow-n8n.json` con 11 nodos, credenciales omitidas y `localhost:3000` editable para JSON Server.
- El JSON se parseó localmente. Se validaron nombres únicos, referencias de conexiones existentes, presencia de los tres scripts de Code y sintaxis JS de los scripts al envolverlos en su contexto de función.
- Revisiones adversariales estáticas: AI Agent sin `ai_tool`; entrada de usuario referenciada; ambos GET `method: GET` y con la misma referencia IP; Code final de chat conectado a ambas ramas PATCH/no PATCH; ningún token o ID de credencial exportado.

### H4 — Guía de configuración
- Creado `WORKFLOW_SETUP.md` con tabla de nodos, importación, credenciales, manejo de errores HTTP, dirección local/Docker/Cloud, mensaje de prueba y explicación de nodos extra.
- `README.md` reemplazado para apuntar al workflow y guía actuales, y no recomendar la arquitectura anterior como flujo final.

### H5 — Reutilización de clases
- El script del nodo `Evaluar pedido` contiene `clases.js` byte por byte como prefijo y luego declara el mismo `CONFIG` de tarifas/zonas de `main.js`. No duplica fórmulas ni decisiones de negocio. El resto del script solo adapta respuestas HTTP por nombre y llama `PoliticaEnvio.evaluar`.

### H6 — Verificación local, sin afirmar ejecución n8n
- `node main.js`: 21/21 casos pasaron; el propio programa marca los datos geográficos como datos de prueba en memoria.
- `node simular-nodo-code.js`: 28/28 casos simulados pasaron; clases copiadas iguales (12114 caracteres).
- Un harness local con respuestas HTTP sintéticas ejecutó los Code embebidos: ambas fuentes sintéticas aprobaron en GAM; una API sintéticamente caída usó la otra (zona RESTO_PAIS); dos fallos sintéticos dieron `GEO_FALLIDA`; un PATCH sintético 404 devolvió `PEDIDO_NO_ENCONTRADO`; JSON inválido del agente dejó IP nula.
- Estas verificaciones no ejecutaron n8n, API externas ni JSON Server. La importación y ejecución real están **pendientes de verificar en n8n**.

### H7 — Árbitro adversarial y límites
- Las ramas de Code capturan nodos HTTP omitidos/no disponibles con `try/catch`; las consultas usan el mismo campo de IP; la respuesta 404 es distinguible; el PATCH no se habilita para IDs objeto, booleanos, vacíos ni no finitos.
- La salida del Agent puede incumplir su prompt; el modo JSON y el parseo rechazan JSON inválido, pero la conducta del modelo solo se confirma al ejecutar en la instancia.
- IPinfo puede requerir token según plan. Se debe crear una credencial Query Auth en n8n si aplica; no se exportó un token.
- Pendiente: importar el JSON en la versión de n8n destino, confirmar el modelo en su selector, probar credenciales DeepSeek/IPinfo, hacer una ejecución real, observar respuesta HTTP y comprobar 2xx/404 contra JSON Server. No se inventaron salidas reales.

### H8 — Consulta de cobertura por IP desde el chat
- El prompt del Agent distingue `modo: "consulta_cobertura"` cuando el usuario solo pregunta por una IP; `Preparar pedido` conserva la IP y el Code de evaluación lee el modo directamente desde `AI Agent`.
- El adaptador usa un pedido sintético solo dentro de la evaluación existente, elimina su ID del resultado y devuelve `tipoResultado: "consulta_cobertura"`, sin `cuerpoPatch` y con `persistir: false`. El mensaje final indica dentro, fuera o verificación no disponible. La ruta normal de pedidos mantiene su comportamiento.
- Evidencia local: `node main.js` pasó 21/21; `node simular-nodo-code.js` ejercitó consulta IP sola cubierta, fuera, sin geolocalización y sin IP, además de comprobar mensaje final sin PATCH. Todos los datos geográficos de esos casos son datos de prueba en memoria.
- Limitación: no está comprobada la clasificación del modelo ni la respuesta en n8n real; la importación y asignación de credenciales siguen pendientes.

### H9 — Mostrar ubicación estimada en la respuesta de chat
- La consulta de cobertura ahora adjunta ciudad, región, país/código, coordenadas, IP y fuente(s) disponibles a la decisión. Prefiere región de IP-API para mantener la regla de zonas; completa los otros campos con la respuesta de ipinfo si faltan.
- El mensaje final incluye esos datos y aclara que se trata de ubicación estimada por IP, no de dirección física exacta.
- Verificación sintética añadida al simulador: comprueba ciudad, Heredia, Costa Rica, latitud/longitud y ambas fuentes en la salida final; no ejecuta APIs reales.
