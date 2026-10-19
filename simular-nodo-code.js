// Simulación local solamente: todos los pedidos y cuerpos geográficos son sintéticos.
// No consulta APIs, no ejecuta n8n y no modifica JSON Server.
const fs = require('node:fs');
const vm = require('node:vm');
const ruta = nombre => `${__dirname}/${nombre}`;
const clases = fs.readFileSync(ruta('clases.js'), 'utf8').trimEnd();
const fuente = fs.readFileSync(ruta('nodo-code.js'), 'utf8').replace(/^\uFEFF/, '').trimEnd();
const workflow = JSON.parse(fs.readFileSync(ruta('workflow-n8n.json'), 'utf8'));
const evaluadorWorkflow = workflow.nodes.find(n => n.name === 'Evaluar pedido').parameters.jsCode.trimEnd();
const salidaWorkflow = workflow.nodes.find(n => n.name === 'Respuesta final').parameters.jsCode;
const marcador = '// Adaptador n8n';
const indice = fuente.indexOf(marcador);
const prefijoClases = indice >= 0 ? fuente.slice(0, indice).trimEnd() : '';
const clasesEquivalentes = prefijoClases === clases;
const codigoWorkflowIgual = evaluadorWorkflow === fuente;
console.log(`Comparación clases.js/nodo-code.js: ${clasesEquivalentes ? 'IGUALES' : 'DIFERENTES'} (${clases.length} / ${prefijoClases.length} caracteres)`);
console.log(`Code del workflow es nodo-code.js: ${codigoWorkflowIgual ? 'IGUAL' : 'DIFERENTE'}`);

function ejecutar(nodos) {
  const acceso = nombre => ({
    all() {
      if (!Object.prototype.hasOwnProperty.call(nodos, nombre)) throw new Error(`Nodo no disponible: ${nombre}`);
      return [{ json: nodos[nombre] }];
    }
  });
  return vm.runInNewContext(`(function () {\n${fuente}\n})()`, { $: acceso }, { timeout: 1000 });
}

function ejecutarRespuestaFinal(decision, parche) {
  const nodos = { 'Evaluar pedido': decision };
  if (parche !== undefined) nodos['PATCH JSON Server'] = parche;
  const acceso = nombre => ({ first() {
    if (!Object.prototype.hasOwnProperty.call(nodos, nombre)) throw new Error(`Nodo no disponible: ${nombre}`);
    return { json: nodos[nombre] };
  } });
  return vm.runInNewContext(`(function () {\n${salidaWorkflow}\n})()`, { $: acceso }, { timeout: 1000 });
}

const IP_PRUEBA = '203.0.113.25';
const ipapi = (region = 'Heredia', codigo = 'CR', pais = codigo === 'CR' ? 'Costa Rica' : 'United States') => ({ status: 'success', message: '', country: pais, countryCode: codigo, regionName: region, city: 'Ciudad de prueba', lat: 9.9, lon: -84, query: IP_PRUEBA });
const ipinfo = (region = 'Heredia', country = 'CR') => ({ ip: IP_PRUEBA, city: 'Ciudad de prueba', region, country, loc: '9.9,-84' });
const pedido = (id = 'T1', precio = 10000, peso = 1, estado = 'pendiente') => ({ id, cliente: 'Cliente de prueba', ip: IP_PRUEBA, items: [{ nombre: 'Artículo de prueba', cantidad: 1, precio, pesoKg: peso }], estado });
const agente = (p = pedido(), errores = []) => ({ output: JSON.stringify({ pedido: p, errores }) });
const escenario = (p = pedido(), a = ipapi(), b = ipinfo(), errores) => ({ 'AI Agent': agente(p, errores), 'IP-API': a, IPinfo: b });
const escenarios = [];
function agregar(nombre, nodos, esperado, comprobar = r => r.codigo) { escenarios.push({ nombre, nodos, esperado, comprobar }); }

agregar('Pedido aprobado con ambas fuentes', escenario(), 'aprobado', r => r.estado);
agregar('Envío gratis GAM', escenario(pedido('T2', 50000)), 0, r => r.costoEnvio);
agregar('Recargo por peso', escenario(pedido('T3', 10000, 7)), 3500, r => r.costoEnvio);
agregar('Fuera de cobertura regional', escenario(pedido('T4'), ipapi('Zona desconocida'), ipinfo('Zona desconocida')), 'FUERA_DE_COBERTURA');
agregar('País fuera de cobertura', escenario(pedido('T5'), ipapi('California', 'US', 'United States'), ipinfo('California', 'US')), 'FUERA_DE_COBERTURA');
agregar('País discrepante entre fuentes', escenario(pedido('T6'), ipapi('Heredia', 'CR'), ipinfo('Heredia', 'US')), 'GEO_INCONSISTENTE');
agregar('IP privada reportada por IP-API', escenario(pedido('T7'), { status: 'fail', message: 'private range', query: IP_PRUEBA }, null), 'IP_PRIVADA_O_RESERVADA');
agregar('IP inválida reportada por IP-API', escenario(pedido('T8'), { status: 'fail', message: 'invalid query', query: IP_PRUEBA }, null), 'IP_INVALIDA');
agregar('Datos incompletos', escenario({ id: 'T9', cliente: '', ip: '', items: [] }), 'DATOS_INCOMPLETOS');
agregar('Solo IP-API disponible', escenario(pedido('T10'), ipapi(), null), 'aprobado', r => r.estado);
agregar('Solo IPinfo disponible', escenario(pedido('T11'), null, ipinfo()), 'aprobado', r => r.estado);
agregar('HTTP 503 en IP-API permite respaldo', escenario(pedido('T12'), { statusCode: 503, body: { mensaje: 'error sintético' } }, ipinfo()), 'aprobado', r => r.estado);
agregar('HTTP 429 en IP-API permite respaldo', escenario(pedido('T13'), { statusCode: 429, body: { message: 'rate limit sintético' } }, ipinfo()), 'aprobado', r => r.estado);
agregar('Ambas APIs caídas', escenario(pedido('T14'), null, null), 'GEO_FALLIDA');
agregar('Ambas APIs responden HTTP 429', escenario(pedido('T15'), { statusCode: 429, body: {} }, { statusCode: 429, body: {} }), 'GEO_FALLIDA');
agregar('IP de IP-API no coincide con pedido', escenario(pedido('T16'), { ...ipapi(), query: '198.51.100.5' }, null), 'GEO_FALLIDA');
agregar('IP de IPinfo no coincide con pedido', escenario(pedido('T17'), null, { ...ipinfo(), ip: '198.51.100.8' }), 'GEO_FALLIDA');
agregar('Las APIs devuelven IPs distintas', escenario(pedido('T18'), ipapi(), { ...ipinfo(), ip: '198.51.100.8' }), 'GEO_INCONSISTENTE');
agregar('Pedido ya procesado', escenario(pedido('T19', 10000, 1, 'aprobado')), 'PEDIDO_YA_PROCESADO');
agregar('JSON del agente inválido', { 'AI Agent': { output: '{ pedido:' }, 'IP-API': null, IPinfo: null }, 'ERROR_INTERNO');
agregar('Salida del agente vacía', { 'AI Agent': { output: '  ' }, 'IP-API': null, IPinfo: null }, 'ERROR_INTERNO');
agregar('AI Agent null', { 'AI Agent': null, 'IP-API': null, IPinfo: null }, 'ERROR_INTERNO');
agregar('AI Agent devuelve array', { 'AI Agent': { output: '[]' }, 'IP-API': null, IPinfo: null }, 'ERROR_INTERNO');
agregar('Falta objeto pedido', { 'AI Agent': { output: JSON.stringify({ errores: [] }) }, 'IP-API': null, IPinfo: null }, 'ERROR_INTERNO');
agregar('Campos faltantes del pedido', escenario({ id: 'T20', cliente: 'Ana', ip: IP_PRUEBA, items: [] }), 'DATOS_INCOMPLETOS');
agregar('Campo errores ausente se tolera', { 'AI Agent': { output: JSON.stringify({ pedido: pedido('T21') }) }, 'IP-API': ipapi(), IPinfo: ipinfo() }, 'aprobado', r => r.estado);
agregar('Campo errores mal formado se tolera', escenario(pedido('T22'), ipapi(), ipinfo(), 'error'), 'aprobado', r => r.estado);
agregar('IP-API wrapper HTTP con body JSON', escenario(pedido('T23'), { statusCode: 200, body: JSON.stringify(ipapi()) }, null), 'aprobado', r => r.estado);
agregar('IPinfo wrapper HTTP válido', escenario(pedido('T24'), null, { statusCode: 200, body: ipinfo() }), 'aprobado', r => r.estado);
agregar('Respuesta de API como array', escenario(pedido('T25'), [], null), 'GEO_FALLIDA');
agregar('Body JSON mal formado usa respaldo', escenario(pedido('T26'), { statusCode: 200, body: '{ roto' }, ipinfo()), 'aprobado', r => r.estado);
agregar('IPinfo directo como objeto', { 'AI Agent': { output: { pedido: pedido('T27'), errores: [] } }, 'IP-API': null, IPinfo: ipinfo() }, 'aprobado', r => r.estado);
agregar('ID numérico preservado y persistible', escenario(pedido(101)), true, r => r.pedidoId === 101 && r.persistir);
agregar('ID string preservado y persistible', escenario(pedido('001')), '001', r => r.persistir && r.pedidoId);
agregar('Sin ID válido no se debe persistir', escenario(pedido(null)), false, r => r.persistir);
agregar('Error HTTP conserva estado y solo intenta log técnico', escenario(pedido('T28'), { statusCode: 429, body: {} }, null), true, r => r.estado === 'pendiente' && r.persistir && !Object.hasOwn(r.cuerpoPatch, 'estado'));

let pasaron = 0;
const camposSalida = ['pedidoId', 'aprobado', 'estado', 'zona', 'costoEnvio', 'total', 'codigo', 'motivo', 'detalleTecnico', 'cuerpoPatch', 'persistir'];
for (const c of escenarios) {
  let salida, valor, formaOk = false;
  try {
    salida = ejecutar(c.nodos);
    formaOk = Boolean(salida && salida.json && camposSalida.every(k => Object.prototype.hasOwnProperty.call(salida.json, k)));
    valor = formaOk ? c.comprobar(salida.json) : 'ESQUEMA INCOMPLETO';
  } catch (error) { valor = `EXCEPCIÓN: ${error.message}`; }
  const ok = formaOk && valor === c.esperado;
  if (ok) pasaron++;
  console.log(`[SIMULADO] ${c.nombre}: esperado=${c.esperado}; obtenido=${valor}; ${ok ? 'OK' : 'FALLA'}`);
}

const decision404 = ejecutarRespuestaFinal(ejecutar(escenario()).json, { statusCode: 404, body: {} })[0];
const caso404Ok = decision404.json.codigo === 'PEDIDO_NO_ENCONTRADO' && decision404.json.persistido === false;
console.log(`[SIMULADO] PATCH HTTP 404: esperado=PEDIDO_NO_ENCONTRADO; obtenido=${decision404.json.codigo}; ${caso404Ok ? 'OK' : 'FALLA'}`);
const respuestaPatchOk = ejecutarRespuestaFinal(ejecutar(escenario()).json, { statusCode: 200, body: {} })[0];
const casoPatchOk = respuestaPatchOk.json.persistido === true;
console.log(`[SIMULADO] PATCH HTTP 200: esperado=persistido; obtenido=${respuestaPatchOk.json.persistido}; ${casoPatchOk ? 'OK' : 'FALLA'}`);

const total = escenarios.length + 2;
if (caso404Ok) pasaron++;
if (casoPatchOk) pasaron++;
console.log(`\n${pasaron} de ${total} casos simulados pasaron.`);
console.log(`Equivalencia literal del bloque de clases: ${clasesEquivalentes ? 'OK' : 'FALLA'}.`);
console.log(`Equivalencia del Code node de workflow: ${codigoWorkflowIgual ? 'OK' : 'FALLA'}.`);
console.log('Pendiente (no simulado): respuestas reales de API, GET/PATCH/404 real de JSON Server e importación/ejecución n8n.');
if (pasaron !== total || !clasesEquivalentes || !codigoWorkflowIgual) process.exitCode = 1;
