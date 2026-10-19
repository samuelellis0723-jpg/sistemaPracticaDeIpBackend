// Todas las respuestas geográficas de este archivo son DATOS DE PRUEBA EN MEMORIA.
// No se realizan llamadas de red ni se presentan como resultados reales de APIs.
const fs = require('node:fs');
const vm = require('node:vm');
const fuente = fs.readFileSync(__dirname + '/clases.js', 'utf8') + '\nglobalThis.__clases = { ErrorNegocio, Ubicacion, Pedido, PoliticaEnvio };';
const contexto = { console };
vm.runInNewContext(fuente, contexto);
const { ErrorNegocio, Ubicacion, Pedido, PoliticaEnvio } = contexto.__clases;
const CONFIG = {
  regionesPorZona: {
    GAM: ['San José', 'San Jose', 'San José Province', 'Provincia de San José', 'Provincia de San Jose', 'Heredia', 'Provincia de Heredia', 'Alajuela', 'Provincia de Alajuela', 'Cartago', 'Provincia de Cartago'],
    RESTO_PAIS: ['Guanacaste', 'Provincia de Guanacaste', 'Puntarenas', 'Provincia de Puntarenas', 'Limón', 'Limon', 'Provincia de Limón', 'Provincia de Limon']
  },
  tarifas: { GAM: 2500, RESTO_PAIS: 4500 }, pesoIncluidoKg: 5, recargoPorKg: 500, envioGratisDesde: 50000
};
const politica = new PoliticaEnvio(CONFIG);
const api = (region, countryCode = 'CR', country = 'Costa Rica') => Ubicacion.desdeIpApi({ status: 'success', country, countryCode, regionName: region, city: 'Ciudad de prueba', lat: 9.9, lon: -84, query: '203.0.113.10' });
const info = (region, country = 'CR') => Ubicacion.desdeIpInfo({ ip: '203.0.113.10', city: 'Ciudad de prueba', region, country, loc: '9.9,-84' });
const pedido = (id, precio = 10000, pesoKg = 1, estado = 'pendiente') => new Pedido({ id, cliente: 'Cliente de prueba', ip: '203.0.113.10', items: [{ nombre: 'Artículo de prueba', cantidad: '1', precio: String(precio), pesoKg: String(pesoKg) }], estado });
const casos = [];
function caso(nombre, entrada, esperado, ejecutar) { casos.push({ nombre, entrada, esperado, ejecutar }); }
caso('R1 país fuera de cobertura', 'prueba en memoria: país US', 'FUERA_DE_COBERTURA', () => politica.evaluar(pedido('R1'), api('California', 'US', 'United States')).codigo);
caso('R2 tarifa base RESTO_PAIS', 'prueba en memoria: Guanacaste, 1 kg', 4500, () => politica.evaluar(pedido('R2'), api('Guanacaste')).costoEnvio);
caso('R3 recargo por exceso de peso', 'prueba en memoria: GAM, 7 kg', 3500, () => politica.evaluar(pedido('R3', 10000, 7), api('San José')).costoEnvio);
caso('R4 envío gratis en GAM', 'prueba en memoria: GAM, subtotal 50000', 0, () => politica.evaluar(pedido('R4', 50000), api('Heredia')).costoEnvio);
caso('R5 pedido procesado', 'prueba en memoria: estado aprobado', 'PEDIDO_YA_PROCESADO', () => politica.evaluar(pedido('R5', 10000, 1, 'aprobado'), api('Cartago')).codigo);
caso('R6 país discrepante', 'prueba en memoria: ip-api CR, ipinfo US', 'GEO_INCONSISTENTE', () => politica.evaluar(pedido('R6'), api('Heredia'), info('Heredia', 'US')).codigo);
caso('Fuentes coinciden', 'prueba en memoria: ambas CR, región ip-api Cartago', 'GAM', () => politica.evaluar(pedido('G1'), api('Cartago'), info('Limón')).zona);
caso('Solo IP-API responde', 'prueba en memoria: ubicación ip-api', 'GAM', () => politica.evaluar(pedido('G2'), api('San Jose Province'), null).zona);
caso('Solo ipinfo responde', 'prueba en memoria: ubicación ipinfo, provincia', 'GAM', () => politica.evaluar(pedido('G3'), null, info('Provincia de San José')).zona);
caso('Ambas fuentes caídas', 'prueba en memoria: ambas ausentes', 'GEO_FALLIDA', () => politica.evaluar(pedido('G4'), null, undefined).codigo);
caso('Respuesta ip-api privada', 'prueba en memoria: error privado de API', 'IP_PRIVADA_O_RESERVADA', () => { try { Ubicacion.desdeIpApi({ status: 'fail', message: 'private range', query: '192.168.1.10' }); } catch (e) { return politica.evaluar(pedido('G5'), e, null).codigo; } });
caso('Datos incompletos', 'prueba en memoria: pedido sin IP ni artículos', 'DATOS_INCOMPLETOS', () => politica.evaluar(new Pedido({ id: 'S1', cliente: 'Prueba', ip: '', items: [] }), api('Heredia')).codigo);
caso('Entrada de ubicación inválida', 'prueba en memoria: objeto sin validar', 'GEO_FALLIDA', () => politica.evaluar(pedido('S2'), { codigoPais: 'CR', ip: 'x', region: 'Heredia' }, null).codigo);
caso('Error inesperado', 'prueba en memoria: configuración ausente', 'ERROR_INTERNO', () => new PoliticaEnvio(null).evaluar(pedido('S3'), api('Heredia')).codigo);
caso('Normalización de tildes y contenido', 'prueba en memoria: Provincia de San Jose', 'GAM', () => politica.obtenerZona(info('Provincia de San Jose')));
caso('Datos numéricos como strings', 'prueba en memoria: precio 10000 y peso 1 string', true, () => politica.evaluar(pedido('S4', 10000, 1), api('Heredia')).aprobado);
caso('PATCH técnico conserva estado', 'prueba en memoria: ambas fuentes ausentes', 'pendiente', () => { const p = pedido('S5'); const r = politica.evaluar(p, null, null); return r.cuerpoPatch.ultimoIntento && p.estado; });
caso('ipinfo separa las coordenadas loc', 'prueba en memoria: loc 9.9,-84', -84, () => info('Heredia').lon);
caso('PATCH de aprobación tiene los cinco campos', 'prueba en memoria: pedido aprobado', 'aprobado,GAM,2500,12500,null', () => { const r = politica.evaluar(pedido('S6'), api('Heredia')); return [r.cuerpoPatch.estado, r.cuerpoPatch.zona, r.cuerpoPatch.costoEnvio, r.cuerpoPatch.total, r.cuerpoPatch.motivoRechazo ?? 'null'].join(','); });
caso('Pedido null no lanza', 'prueba en memoria: pedido null', 'DATOS_INCOMPLETOS', () => politica.evaluar(null, null, null).codigo);
caso('ipinfo status fail privado', 'prueba en memoria: status fail private range', 'IP_PRIVADA_O_RESERVADA', () => { try { Ubicacion.desdeIpInfo({ status: 'fail', message: 'private range', ip: '192.168.1.10' }); } catch (e) { return politica.evaluar(pedido('S7'), e, null).codigo; } });

let pasaron = 0;
for (const c of casos) {
  let obtenido;
  try { obtenido = c.ejecutar(); } catch (e) { obtenido = `EXCEPCIÓN: ${e.message}`; }
  const ok = obtenido === c.esperado; if (ok) pasaron++;
  console.log(`\n${c.nombre}\n  Entrada: ${c.entrada}\n  Esperado: ${c.esperado}\n  Obtenido: ${obtenido}\n  ${ok ? 'OK' : 'FALLA'}`);
}
console.log(`\n${pasaron} de ${casos.length} casos pasaron.`);
console.log('AVISO: todas las ubicaciones son datos de prueba en memoria; no hay consultas reales ni respuestas guardadas de las APIs.');
if (pasaron !== casos.length) process.exitCode = 1;
