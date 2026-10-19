# Laboratorio 1 Backend — cobertura geográfica de pedidos

Proyecto en JavaScript nativo para evaluar pedidos, verificar cobertura por geolocalización y preparar cambios compatibles con JSON Server.

## Ejecución local

```powershell
node main.js
node simular-nodo-code.js
```

Las pruebas locales usan exclusivamente datos de prueba en memoria. No consultan IP-API, IPinfo, JSON Server ni n8n. `clases.js` contiene las reglas de negocio; `nodo-code.js` es el adaptador para pegar en un Code node.

## Workflow n8n

El workflow importable está en [`workflow-n8n.json`](workflow-n8n.json). Las instrucciones para importar, asignar credenciales, definir la dirección de JSON Server y probar el flujo están en [`WORKFLOW_SETUP.md`](WORKFLOW_SETUP.md).

El AI Agent usa DeepSeek para extraer un pedido o reconocer una consulta de cobertura por IP sola. Para consultar, escribe en el chat algo como `¿La IP 8.8.8.8 está dentro de la zona de entrega?`; el flujo consulta ambas APIs y responde si está cubierta, fuera o si no pudo verificar. También muestra ciudad, región/estado, país y coordenadas cuando las APIs las devuelven. Es geolocalización estimada por IP; no proporciona una dirección física exacta. La consulta no requiere datos de pedido ni actualiza JSON Server. En pedidos, las dos consultas GET y el PATCH se ejecutan en nodos HTTP Request del flujo principal. El Code node incorpora las clases de `clases.js` y no duplica las reglas. El agente no tiene tools ni memoria conectadas.

El Code node `Evaluar pedido` contiene el mismo código de [`nodo-code.js`](nodo-code.js), configurado como **Run Once for Each Item**. Lee por nombre `AI Agent`, `IP-API` e `IPinfo` aunque el item actual venga del HTTP Request más reciente. Su campo `persistir` gobierna el IF previo al PATCH.

La importación y ejecución real en n8n, así como las solicitudes de APIs y JSON Server, siguen pendientes de probar en la instancia del estudiante. La configuración no contiene credenciales ni tokens.

## Capturar respuestas reales de geolocalización

Cuando ejecutes el proyecto desde una máquina con acceso a Internet, usa:

```powershell
node consultar-ip.js
Get-ChildItem datos/ip-respuestas
```

El script guarda cuerpos de respuesta sin editar en `datos/ip-respuestas/`. Archivos con el mismo número (`ipapi-N.json` e `ipinfo-N.json`) corresponden a la misma IP candidata; lee ambos bodies como JSON para contrastar los parsers o fijarlos como datos de entrada en la ejecución manual de n8n. El simulador local no los carga automáticamente. No se ha ejecutado en este entorno y el directorio está vacío.

## JSON Server

Levanta JSON Server en otra terminal:

```powershell
npx json-server --watch db.json --port 3000
```

Comprueba GET y 404:

```powershell
Invoke-RestMethod http://localhost:3000/pedidos/P001
try { Invoke-RestMethod http://localhost:3000/pedidos/NO-EXISTE } catch { $_.Exception.Response.StatusCode }
```

Prueba PATCH con una actualización manual:

```powershell
$body = @{ estado = 'rechazado'; motivoRechazo = 'Prueba manual'; codigoRechazo = 'DATOS_INCOMPLETOS' } | ConvertTo-Json
Invoke-RestMethod -Method Patch -Uri http://localhost:3000/pedidos/P001 -ContentType 'application/json' -Body $body
```

El workflow parte de `http://localhost:3000`; si n8n está en Docker o n8n Cloud, esa dirección debe cambiarse por una accesible desde el proceso n8n. La versión local de JSON Server no se ha verificado.

## Credenciales y decisiones docentes

En n8n asigna tu credencial DeepSeek al nodo **DeepSeek Chat Model**. Si tu plan de IPinfo requiere token, asígnalo mediante credencial **HTTP Query Auth**; no lo escribas en el workflow. No se detectaron reglas de negocio o tarifas pendientes de confirmación docente. Si la rúbrica exige una versión de n8n específica o limita el número de nodos, confirma ese requisito con el docente.

## Evidencia y estado

El detalle de las comprobaciones locales, decisiones y pendientes está en [`PROGRESS.md`](PROGRESS.md). No se presentan respuestas de API ni ejecuciones simuladas como datos reales.
