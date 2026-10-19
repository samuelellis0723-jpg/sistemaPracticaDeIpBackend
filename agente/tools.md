# Tools HTTP del AI Agent

Adjunta dos nodos **HTTP Request** al conector Tools del AI Agent. Los dos son GET, consultan la misma IP extraída por el agente y deben devolver respuesta JSON completa. Configura el agente con Prompt = entrada del Chat Trigger (`chatInput`), usa el System Message de `system-prompt.md` y desactiva **Return Intermediate Steps** para que la salida final solo sea el objeto contratado. El adaptador admite la salida en `$json.output`.

En cada nodo HTTP Request define el valor dinámico con `$fromAI()`. En n8n esta función completa parámetros de tools conectadas al AI Agent; no es una variable de contexto compartida entre tools, por lo que el prompt exige volver a usar literalmente la misma IP. La llamada secuencial y la identidad del argumento deben confirmarse en las ejecuciones de n8n del estudiante.

## Tool 1 — `consultar_ipapi`

- Method: `GET`
- URL (Expression):

```text
={{ 'http://ip-api.com/json/' + encodeURIComponent($fromAI('ip', 'IP copiada literalmente del pedido; usa la misma para ambas consultas', 'string')) }}
```

- Send Query Parameters: activado
- Query parameter `fields`:

```text
status,message,country,countryCode,regionName,city,lat,lon,query
```

- Response Format: `JSON` o autodetect
- Response: activa `Include Response Headers and Status` y `Never Error` para que el agente pueda reconocer un HTTP no 2xx. En Settings usa **On Error → Continue** para que un fallo de conexión de IP-API no impida intentar IPinfo.
- Si la respuesta llega envuelta con `statusCode` y `body`, entrega solo `body` como `geo_ipapi`; el adaptador también entiende el wrapper por si el modelo lo conserva.
- No requiere credencial ni API key.

## Tool 2 — `consultar_ipinfo`

- Method: `GET`
- URL (Expression):

```text
={{ 'https://ipinfo.io/' + encodeURIComponent($fromAI('ip', 'La misma IP literal enviada a consultar_ipapi', 'string')) + '/json' }}
```

- Response Format: `JSON` o autodetect
- Response: activa `Include Response Headers and Status` y `Never Error`; en Settings usa **On Error → Continue** para que el agente pueda registrar el fallo.
- Si la respuesta llega envuelta con `statusCode` y `body`, entrega solo `body` como `geo_ipinfo`; el adaptador también entiende el wrapper por si el modelo lo conserva.
- Sin token, la URL cumple con el endpoint indicado por el laboratorio. Si vas a usar el token opcional de ipinfo, crea en n8n una credencial genérica **Query Auth** con nombre de parámetro `token` y el token real como valor, y selecciónala en este nodo. No escribas el token en este archivo, el prompt, las expresiones ni el workflow exportado.

## Límites y comprobación

- Las tools solo consultan ubicación. No consultan JSON Server ni modifican pedidos.
- No habilites salidas optimizadas/truncadas; las clases necesitan los campos completos de ambas respuestas.
- El modelo puede equivocarse al construir el JSON o al repetir el argumento de tool. `nodo-code.js` valida el contrato y no confía en el veredicto del agente.
- No se ha creado ni ejecutado un workflow n8n en este proyecto; prueba ambas tools y confirma en el registro de ejecución que enviaron la misma IP.
