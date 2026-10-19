# Importar y configurar el workflow n8n

`workflow-n8n.json` contiene un workflow diseñado para importar en n8n. En este entorno n8n no está instalado: el archivo se validó como JSON y se revisaron sus referencias y estructura localmente, pero importación, ejecución y compatibilidad con la versión de la instancia quedan **pendientes de verificar en n8n**.

## Qué hace

El Chat Trigger recibe el texto real del usuario. El AI Agent usa DeepSeek para extraer el pedido o reconocer una consulta de cobertura por IP sola; no calcula ni decide y no tiene conexiones `ai_tool` ni memoria. Desde la rama con IP salen dos HTTP Request GET en paralelo, IP-API e IPinfo, ambas con la misma IP. Cada salida se etiqueta (`geo_ipapi`, `geo_ipinfo`) y el Merge las combina por posición antes de evaluación, por lo que campos como `country` y `city` permanecen separados. El Code carga las clases existentes y delega en `PoliticaEnvio`. Una consulta de IP no requiere pedido y nunca ejecuta PATCH: responde si está en zona, fuera o si no fue posible verificar; cuando las APIs lo devuelven, muestra ciudad, región/estado, país, coordenadas e IP. Es una ubicación estimada por IP, no una dirección física exacta. En pedidos, el IF y HTTP Request guardan `cuerpoPatch`; la respuesta final distingue actualización confirmada, 404 y fallo técnico.

## Nodos

| Nodo | Propósito | Entrada | Salida |
|---|---|---|---|
| Chat Trigger | Recibir el mensaje del chat | Texto del usuario | `chatInput` |
| AI Agent | Extraer pedido o clasificar consulta de cobertura sin completar datos | `chatInput` real | JSON `{ modo, pedido, errores }` |
| DeepSeek Chat Model | Modelo nativo conectado al puerto de modelo del agente | Prompt del agente | Respuesta JSON; sin tools conectadas |
| Preparar pedido (Code) | Analizar JSON y obtener `pedido.ip`; reportar JSON inválido sin llamar APIs | Salida del agente | `pedido`, `ip`, `errores`, indicadores de parseo |
| ¿Hay IP? (IF) | Omitir consultas si no hay IP textual | Salida de Preparar pedido | Rama sí: consultas; rama no: evaluación sin geolocalización |
| IP-API (HTTP Request) | GET IP-API, conserva body, status y headers; continúa ante errores | IP de Preparar pedido | Respuesta original, status o error |
| IPinfo (HTTP Request) | GET IPinfo paralelo con la misma expresión de IP; conserva body, status y headers | Misma salida de Preparar pedido | Respuesta original, status o error |
| Etiquetar IP-API / Etiquetar IPinfo (Code) | Encapsular cada salida HTTP sin modificarla bajo `geo_ipapi` o `geo_ipinfo` | Un item HTTP por rama | Campo de origen único para evitar colisiones |
| Merge geolocalizacion | Combinar Input 1 e Input 2 por posición | Dos items etiquetados, uno por rama | Un item `{ geo_ipapi, geo_ipinfo }` |
| Evaluar pedido (Code) | Ejecutar `nodo-code.js`, leer pedido/errores de `AI Agent` y ambas respuestas del item Merge | Salida del Merge; la rama sin IP del IF evita Merge | Resultado de `PoliticaEnvio`, incluido `cuerpoPatch` y `persistir` |
| ¿Se puede persistir? (IF) | Comprobar `persistir === true` calculado por Code | Resultado del evaluador | PATCH o salida sin PATCH |
| PATCH JSON Server (HTTP Request) | Enviar `PATCH /pedidos/{id}` con `cuerpoPatch` en JSON | Resultado del evaluador | Body, HTTP status o error |
| Respuesta final (Code) | Convertir resultado y PATCH en mensaje para chat | Evaluación y output PATCH si ejecutó | `output` legible y estado de persistencia |

Los nodos adicionales respecto a las cuatro etapas conceptuales (chat, agente, evaluación y respuesta) son necesarios porque las peticiones HTTP no son tools del agente: se requieren dos GET normales, dos etiquetas de salida y Merge. Además, hace falta preparar/validar el JSON, saltar GET cuando no hay IP, hacer PATCH después de evaluar, omitirlo sin ID y formar una respuesta final que inspeccione el 404. El nodo DeepSeek es una conexión de modelo, no un tool.

## Importación y credenciales

1. En n8n importa `workflow-n8n.json` desde **Workflows → Import from File**.
2. Abre **DeepSeek Chat Model** y asigna una credencial DeepSeek creada en tu instancia. El JSON no tiene ID ni secreto de credencial. El modelo configurado es `deepseek-flash`, el identificador actual del modelo Flash en la API oficial de DeepSeek. No se configuró ningún parámetro de thinking.
3. Si tu plan de IPinfo requiere token, crea una credencial segura de tipo **HTTP Query Auth** con parámetro `token` y asígnala al nodo **IPinfo**. No pegues el token en la URL ni en el workflow exportado. Comprueba las condiciones del plan/IPinfo que uses.
4. Inicia JSON Server sirviendo el `db.json` del laboratorio. Cambia en el nodo **PATCH JSON Server** la base de URL `http://localhost:3000` si el proceso de n8n no puede alcanzar el servicio en esa dirección.
5. Revisa el registro objetivo y usa un pedido pendiente con ID, cliente, IP y artículos completos. Guarda y prueba el workflow en el chat de n8n.

El Chat Trigger está en modo chat alojado con respuesta `lastNode`. Para revisar cobertura, escribe por ejemplo `¿La IP 8.8.8.8 está dentro de la zona de entrega?`; el Agent la entrega como `modo: "consulta_cobertura"`, se consultan las dos fuentes y el último Code node responde con sí, no o que no se pudo confirmar. No se requiere ID, cliente ni artículos y no se actualiza JSON Server para esta consulta. Para procesar un pedido incluye sus datos como en el ejemplo siguiente. El último Code node devuelve `{ output: "..." }`; no se usa Respond to Webhook.

## URLs y respuestas HTTP

- **IP-API** construye `http://ip-api.com/json/{ip}` y envía `fields=status,message,country,countryCode,regionName,city,lat,lon,query` como query param. IPinfo construye `https://ipinfo.io/{misma-ip}/json`.
- Ambas ramas parten de `¿Hay IP?` salida true y usan `={{ $('Preparar pedido').first().json.ip }}` para construir su URL. Así envían la misma IP y no se encadenan entre sí.
- Ambos GET usan formato JSON, `Never Error` e `Include Response Headers and Status`; `On Error → Continue (using regular output)` permite que un error de red continúe como item hacia su Code de etiquetado. Cada etiqueta guarda todo el `$json` HTTP sin editar bajo una clave propia. Merge usa `Mode: Combine`, `Combine By: Position`, dos entradas; solo se empareja un item por consulta y las propiedades de rama no chocan. Luego `Evaluar pedido` lee `geo_ipapi` y `geo_ipinfo` del item del Merge y el pedido/errores por nombre desde `AI Agent`.
- Code devuelve `persistir`, verdadero solo si `pedidoId` es string no vacío o número finito y `cuerpoPatch` es objeto. El IF usa `={{ $json.persistir === true }}`.
- El PATCH usa `={{ 'http://localhost:3000/pedidos/' + encodeURIComponent(String($json.pedidoId)) }}`, método PATCH y body JSON `={{ $json.cuerpoPatch }}`. Tiene `Never Error`, status completo y `On Error → Continue (using regular output)`. HTTP 404 se convierte en `PEDIDO_NO_ENCONTRADO`; otros errores se reportan como no confirmados. La política ya produce un body de solo `ultimoIntento` para errores técnicos y pedidos procesados, por lo que esos PATCH no cambian `estado`.
- La consulta HTTP de n8n ejecuta desde el host/contenedor de n8n. Si JSON Server corre en el mismo host, `localhost` puede servir. Si n8n y JSON Server están en contenedores distintos, usa el nombre de servicio de Docker Compose, por ejemplo `http://json-server:3000`. Si n8n está en Docker Desktop y JSON Server en el host, suele funcionar `http://host.docker.internal:3000`. En n8n Cloud, `localhost` apunta al servicio remoto; usa un endpoint alcanzable desde Cloud. Verifica acceso desde el entorno n8n.

### Si la rúbrica limita nodos

El diseño de Reto 2 requiere Merge y dos nodos de etiquetado, además de los dos HTTP Request. No se recibió una prohibición docente de agregar nodos. Si el docente limita el conteo, confirma primero qué nodos permite: se puede reemplazar el Merge y las etiquetas por un Code que lea las dos salidas HTTP por nombre, pero esa variante **no cumpliría el requisito explícito de combinar con Merge**.

La versión de JSON Server no está fijada ni comprobada aquí. Su formato de recursos debe exponer `pedidos` como colección para que `/pedidos/{id}` responda.

## Prueba de chat

Ejemplo de mensaje:

> Procesa el pedido P001 de Ana. Su IP es 190.10.0.1. Lleva 1 teclado, precio 18000 CRC, peso 1 kg.

El resultado esperado del **agente** es únicamente un JSON de extracción con `pedido.id`, `pedido.cliente`, `pedido.ip`, `pedido.items` y `errores: []`; no se fija una respuesta de geolocalización ni de política para esa IP. El resultado final real depende de las respuestas de ambas APIs y del contenido actual de JSON Server. Si el registro existe y el PATCH responde 2xx, el mensaje indicará si el pedido quedó aprobado o rechazado y mostrará zona, costo, total y motivo. Si la fila no existe, indicará `PEDIDO_NO_ENCONTRADO`.

Para ejercitar resultados esperados sin red, usa `node main.js` y `node simular-nodo-code.js`: todos sus escenarios están rotulados como datos de prueba en memoria; no ejecutan este workflow.

## Validación de versiones

El workspace no trae instalación ni versión local de n8n, así que no se puede certificar la importación contra la versión del estudiante. El Merge exportado es `n8n-nodes-base.merge` versión 3.2 con parámetros documentados en la definición oficial: `mode: combine` y `combineBy: combineByPosition`. La documentación oficial señala que Position empareja los items por orden; las dos respuestas se encapsulan primero bajo claves diferentes, evitando cualquier colisión. Tipos/versiones del export: Chat Trigger 1.3, AI Agent 2.2, DeepSeek Chat Model 1, Code 2, HTTP Request 4.2, IF 2.2, Merge 3.2. `Evaluar pedido` está en modo **Run Once for Each Item** y su `jsCode` es idéntico a `nodo-code.js`. El modelo usa `deepseek-flash` y `json_object`. Confirma en tu instancia que esas versiones/tipos estén disponibles.

Fuentes de referencia consultadas:

- [Código oficial del nodo DeepSeek Chat Model](https://github.com/n8n-io/n8n/blob/master/packages/%40n8n/nodes-langchain/nodes/llms/LmChatDeepSeek/LmChatDeepSeek.node.ts)
- [Código oficial del AI Agent v2](https://github.com/n8n-io/n8n/blob/master/packages/%40n8n/nodes-langchain/nodes/agents/Agent/V2/AgentV2.node.ts)
- [Código oficial del Chat Trigger](https://github.com/n8n-io/n8n/blob/master/packages/%40n8n/nodes-langchain/nodes/trigger/ChatTrigger/ChatTrigger.node.ts)
- [Código oficial de HTTP Request v3](https://github.com/n8n-io/n8n/blob/master/packages/nodes-base/nodes/HttpRequest/V3/HttpRequestV3.node.ts)
- [Documentación oficial HTTP Request](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.httprequest/)
- [Documentación oficial del Code node](https://docs.n8n.io/build/code-in-n8n/using-the-code-node/)
- [Documentación oficial del Merge node](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.merge/)
- [Esquema oficial Merge v3](https://github.com/n8n-io/n8n/blob/master/packages/nodes-base/nodes/Merge/v3/actions/versionDescription.ts)
- [Guía oficial DeepSeek API: modelo Flash](https://api-docs.deepseek.com/guides/search_fetch)

## Pendiente de ejecutar

En esta instancia de trabajo no se instaló ni ejecutó n8n, no se llamó a IP-API/IPinfo y no se hizo PATCH a JSON Server. Para probar el sistema completo debes importar y configurar el flujo, iniciar JSON Server, proporcionar las credenciales requeridas y ejecutar desde la interfaz chat de n8n.
