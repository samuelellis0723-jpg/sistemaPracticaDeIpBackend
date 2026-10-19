# Importar y configurar el workflow n8n

`workflow-n8n.json` contiene un workflow diseñado para importar en n8n. En este entorno n8n no está instalado: el archivo se validó como JSON y se revisaron sus referencias y estructura localmente, pero importación, ejecución y compatibilidad con la versión de la instancia quedan **pendientes de verificar en n8n**.

## Qué hace

El Chat Trigger recibe el texto real del usuario. El AI Agent usa el nodo nativo DeepSeek Chat Model para extraer los campos del pedido a JSON; no calcula ni decide y no tiene conexiones `ai_tool` ni memoria. Dos HTTP Request GET consultan IP-API e IPinfo usando la misma IP extraída. El Code node carga las clases existentes y delega en `PoliticaEnvio`. Un IF omite el PATCH cuando falta un ID válido; otro nodo HTTP Request aplica exactamente `cuerpoPatch`. La respuesta final distingue actualización confirmada, 404 y fallo técnico y devuelve el campo `output` que lee Chat Trigger en modo `lastNode`.

## Nodos

| Nodo | Propósito | Entrada | Salida |
|---|---|---|---|
| Chat Trigger | Recibir el mensaje del chat | Texto del usuario | `chatInput` |
| AI Agent | Extraer pedido y errores sin completar datos | `chatInput` real | JSON `{ pedido, errores }` |
| DeepSeek Chat Model | Modelo nativo conectado al puerto de modelo del agente | Prompt del agente | Respuesta JSON; sin tools conectadas |
| Preparar pedido (Code) | Analizar JSON y obtener `pedido.ip`; reportar JSON inválido sin llamar APIs | Salida del agente | `pedido`, `ip`, `errores`, indicadores de parseo |
| ¿Hay IP? (IF) | Omitir consultas si no hay IP textual | Salida de Preparar pedido | Rama sí: consultas; rama no: evaluación sin geolocalización |
| IP-API (HTTP Request) | GET IP-API, conserva body, status y headers; continúa ante errores | IP de Preparar pedido | Respuesta original, status o error |
| IPinfo (HTTP Request) | GET IPinfo con la misma expresión de IP; conserva body, status y headers | Misma IP de Preparar pedido | Respuesta original, status o error |
| Evaluar pedido (Code) | Cargar las clases del proyecto y evaluar respuestas identificadas por nombre de nodo | Pedido y outputs de ambas APIs | Resultado de `PoliticaEnvio`, incluido `cuerpoPatch` |
| ¿Se puede persistir? (IF) | Comprobar ID no vacío y `cuerpoPatch` objeto | Resultado del evaluador | PATCH o salida sin PATCH |
| PATCH JSON Server (HTTP Request) | Enviar `PATCH /pedidos/{id}` con `cuerpoPatch` en JSON | Resultado del evaluador | Body, HTTP status o error |
| Respuesta final (Code) | Convertir resultado y PATCH en mensaje para chat | Evaluación y output PATCH si ejecutó | `output` legible y estado de persistencia |

Los nodos adicionales respecto a las cuatro etapas conceptuales (chat, agente, evaluación y respuesta) son necesarios porque las peticiones HTTP no son tools del agente: se requieren dos GET normales. Además, hace falta preparar/validar el JSON, saltar GET cuando no hay IP, hacer PATCH después de evaluar, omitirlo sin ID y formar una respuesta final que inspeccione el 404. El nodo DeepSeek es una conexión de modelo, no un tool.

## Importación y credenciales

1. En n8n importa `workflow-n8n.json` desde **Workflows → Import from File**.
2. Abre **DeepSeek Chat Model** y asigna una credencial DeepSeek creada en tu instancia. El JSON no tiene ID ni secreto de credencial. El modelo configurado es `deepseek-flash`, el identificador actual del modelo Flash en la API oficial de DeepSeek. No se configuró ningún parámetro de thinking.
3. Si tu plan de IPinfo requiere token, crea una credencial segura de tipo **HTTP Query Auth** con parámetro `token` y asígnala al nodo **IPinfo**. No pegues el token en la URL ni en el workflow exportado. Comprueba las condiciones del plan/IPinfo que uses.
4. Inicia JSON Server sirviendo el `db.json` del laboratorio. Cambia en el nodo **PATCH JSON Server** la base de URL `http://localhost:3000` si el proceso de n8n no puede alcanzar el servicio en esa dirección.
5. Revisa el registro objetivo y usa un pedido pendiente con ID, cliente, IP y artículos completos. Guarda y prueba el workflow en el chat de n8n.

El Chat Trigger está en modo chat alojado con respuesta `lastNode`. El último Code node devuelve `{ output: "..." }`; no se usa Respond to Webhook.

## URLs y respuestas HTTP

- **IP-API** construye `http://ip-api.com/json/{ip}` y envía `fields=status,message,country,countryCode,regionName,city,lat,lon,query` como query param. IPinfo construye `https://ipinfo.io/{misma-ip}/json`.
- Ambos GET usan formato JSON, `Never Error` y `Include Response Headers and Status`; el ajuste de nodo `On Error → Continue (using regular output)` permite que los errores de red alcancen Code. El evaluador obtiene cada respuesta por nombre (`IP-API`, `IPinfo`) y no depende de emparejar items por orden.
- El PATCH usa `={{ 'http://localhost:3000/pedidos/' + encodeURIComponent(String($json.pedidoId)) }}`, método PATCH y body JSON `={{ $json.cuerpoPatch }}`. Tiene `Never Error`, status completo y `On Error → Continue (using regular output)`. HTTP 404 se convierte en `PEDIDO_NO_ENCONTRADO`; otros errores se reportan como no confirmados. La política ya produce un body de solo `ultimoIntento` para errores técnicos y pedidos procesados, por lo que esos PATCH no cambian `estado`.
- La consulta HTTP de n8n ejecuta desde el host/contenedor de n8n. Si JSON Server corre en el mismo host, `localhost` puede servir. Si n8n y JSON Server están en contenedores distintos, usa el nombre de servicio de Docker Compose, por ejemplo `http://json-server:3000`. Si n8n está en Docker Desktop y JSON Server en el host, suele funcionar `http://host.docker.internal:3000`. En n8n Cloud, `localhost` apunta al servicio remoto; usa un endpoint alcanzable desde Cloud. Verifica acceso desde el entorno n8n.

La versión de JSON Server no está fijada ni comprobada aquí. Su formato de recursos debe exponer `pedidos` como colección para que `/pedidos/{id}` responda.

## Prueba de chat

Ejemplo de mensaje:

> Procesa el pedido P001 de Ana. Su IP es 190.10.0.1. Lleva 1 teclado, precio 18000 CRC, peso 1 kg.

El resultado esperado del **agente** es únicamente un JSON de extracción con `pedido.id`, `pedido.cliente`, `pedido.ip`, `pedido.items` y `errores: []`; no se fija una respuesta de geolocalización ni de política para esa IP. El resultado final real depende de las respuestas de ambas APIs y del contenido actual de JSON Server. Si el registro existe y el PATCH responde 2xx, el mensaje indicará si el pedido quedó aprobado o rechazado y mostrará zona, costo, total y motivo. Si la fila no existe, indicará `PEDIDO_NO_ENCONTRADO`.

Para ejercitar resultados esperados sin red, usa `node main.js` y `node simular-nodo-code.js`: todos sus escenarios están rotulados como datos de prueba en memoria; no ejecutan este workflow.

## Validación de versiones

El workspace no trae instalación ni versión local de n8n, así que no se puede certificar la importación contra la versión del estudiante. Para preparar el export se revisaron fuentes oficiales de n8n que muestran los tipos y versiones usados: Chat Trigger 1.3, AI Agent 2.2, DeepSeek Chat Model 1, Code 2, HTTP Request 4.2 e IF 2.2. La definición fuente del modelo expone `model` y `options.responseFormat`; se eligió `json_object`. El nombre del tipo es `@n8n/n8n-nodes-langchain.lmChatDeepSeek`. Confirma en tu instancia que esos nodos estén disponibles y que el selector acepte `deepseek-flash`; una instancia anterior puede necesitar actualizar n8n o ajustar su export desde el editor.

Fuentes de referencia consultadas:

- [Código oficial del nodo DeepSeek Chat Model](https://github.com/n8n-io/n8n/blob/master/packages/%40n8n/nodes-langchain/nodes/llms/LmChatDeepSeek/LmChatDeepSeek.node.ts)
- [Código oficial del AI Agent v2](https://github.com/n8n-io/n8n/blob/master/packages/%40n8n/nodes-langchain/nodes/agents/Agent/V2/AgentV2.node.ts)
- [Código oficial del Chat Trigger](https://github.com/n8n-io/n8n/blob/master/packages/%40n8n/nodes-langchain/nodes/trigger/ChatTrigger/ChatTrigger.node.ts)
- [Código oficial de HTTP Request v3](https://github.com/n8n-io/n8n/blob/master/packages/nodes-base/nodes/HttpRequest/V3/HttpRequestV3.node.ts)
- [Documentación oficial HTTP Request](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.httprequest/)
- [Documentación oficial del Code node](https://docs.n8n.io/build/code-in-n8n/using-the-code-node/)
- [Guía oficial DeepSeek API: modelo Flash](https://api-docs.deepseek.com/guides/search_fetch)

## Pendiente de ejecutar

En esta instancia de trabajo no se instaló ni ejecutó n8n, no se llamó a IP-API/IPinfo y no se hizo PATCH a JSON Server. Para probar el sistema completo debes importar y configurar el flujo, iniciar JSON Server, proporcionar las credenciales requeridas y ejecutar desde la interfaz chat de n8n.
