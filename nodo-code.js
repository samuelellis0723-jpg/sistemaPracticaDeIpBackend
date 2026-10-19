class ErrorNegocio extends Error {
  constructor(codigo, mensaje, detalleTecnico = '') {
    super(mensaje);
    this.name = 'ErrorNegocio';
    this.codigo = codigo;
    this.detalleTecnico = detalleTecnico;
  }
}

class Ubicacion {
  constructor({ pais, codigoPais, region, ciudad, lat, lon, ip, fuente } = {}) {
    Object.assign(this, { pais, codigoPais, region, ciudad, lat, lon, ip, fuente });
  }
  static desdeIpApi(r) {
    if (!r || typeof r !== 'object' || Array.isArray(r)) throw new ErrorNegocio('GEO_FALLIDA', 'IP-API no devolvió una respuesta válida.', 'Respuesta ausente o con formato inválido.');
    if (r.status !== 'success') {
      const mensaje = String(r.message || 'respuesta sin mensaje');
      const codigo = /private|reserved|bogon/i.test(mensaje) ? 'IP_PRIVADA_O_RESERVADA' : 'IP_INVALIDA';
      throw new ErrorNegocio(codigo, 'No se pudo verificar la ubicación de la conexión.', `IP-API: ${mensaje}`);
    }
    const codigoPais = String(r.countryCode || '').trim();
    const ip = String(r.query || '').trim();
    if (!codigoPais || !ip || !r.country) throw new ErrorNegocio('GEO_FALLIDA', 'La respuesta de IP-API está incompleta.', `Campos obligatorios ausentes: ${[!r.country && 'country', !codigoPais && 'countryCode', !ip && 'query'].filter(Boolean).join(', ')}.`);
    return new Ubicacion({ pais: String(r.country), codigoPais: codigoPais.toUpperCase(), region: r.regionName || '', ciudad: r.city || '', lat: r.lat ?? null, lon: r.lon ?? null, ip, fuente: 'ip-api' });
  }
  static desdeIpInfo(r) {
    if (!r || typeof r !== 'object' || Array.isArray(r)) throw new ErrorNegocio('GEO_FALLIDA', 'ipinfo no devolvió una respuesta válida.', 'Respuesta ausente o con formato inválido.');
    if (r.status === 'fail') {
      const mensaje = String(r.message || 'respuesta sin mensaje');
      const codigo = /private|reserved|bogon/i.test(mensaje) ? 'IP_PRIVADA_O_RESERVADA' : 'IP_INVALIDA';
      throw new ErrorNegocio(codigo, 'No se pudo verificar la ubicación de la conexión.', `ipinfo: ${mensaje}`);
    }
    if (r.bogon === true) throw new ErrorNegocio('IP_PRIVADA_O_RESERVADA', 'La IP es privada o está reservada.', `ipinfo: bogon=true para ${r.ip || 'IP desconocida'}.`);
    if (r.error) {
      const mensaje = String(r.error.message || r.error.title || 'respuesta de error');
      const codigo = /private|reserved|bogon/i.test(mensaje) ? 'IP_PRIVADA_O_RESERVADA' : 'IP_INVALIDA';
      throw new ErrorNegocio(codigo, 'No se pudo verificar la ubicación de la conexión.', `ipinfo: ${mensaje}`);
    }
    const codigoPais = String(r.country || '').trim();
    const ip = String(r.ip || '').trim();
    if (!codigoPais || !ip) throw new ErrorNegocio('GEO_FALLIDA', 'La respuesta de ipinfo está incompleta.', `Campos obligatorios ausentes: ${[!codigoPais && 'country', !ip && 'ip'].filter(Boolean).join(', ')}.`);
    let lat = null, lon = null;
    if (r.loc !== undefined && r.loc !== null && r.loc !== '') {
      const partes = String(r.loc).split(',').map(x => Number(x.trim()));
      if (partes.length !== 2 || !partes.every(Number.isFinite)) throw new ErrorNegocio('GEO_FALLIDA', 'Las coordenadas de ipinfo son inválidas.', `loc recibido: ${r.loc}`);
      [lat, lon] = partes;
    }
    return new Ubicacion({ pais: codigoPais.toUpperCase() === 'CR' ? 'Costa Rica' : codigoPais.toUpperCase(), codigoPais: codigoPais.toUpperCase(), region: r.region || '', ciudad: r.city || '', lat, lon, ip, fuente: 'ipinfo' });
  }
  esValida() { return Boolean(typeof this.codigoPais === 'string' && this.codigoPais.trim() && typeof this.ip === 'string' && this.ip.trim()); }
  esPaisSoportado() { return String(this.codigoPais || '').trim().toUpperCase() === 'CR'; }
}

class Pedido {
  constructor(datos = {}) {
    datos = datos && typeof datos === 'object' ? datos : {};
    this.id = datos.id; this.cliente = datos.cliente; this.ip = datos.ip;
    this.items = Array.isArray(datos.items) ? datos.items : [];
    this.estado = datos.estado || 'pendiente'; this.costoEnvio = datos.costoEnvio ?? null;
    this.zona = datos.zona ?? null; this.motivoRechazo = datos.motivoRechazo ?? null;
    this.codigoRechazo = datos.codigoRechazo ?? null;
  }
  calcularSubtotal() { return this.items.reduce((s, x) => s + Number(x.cantidad) * Number(x.precio), 0); }
  calcularPesoTotal() { return this.items.reduce((s, x) => s + Number(x.pesoKg ?? 0) * Number(x.cantidad), 0); }
  estaCompleto() {
    return Boolean(this.id && typeof this.cliente === 'string' && this.cliente.trim() && typeof this.ip === 'string' && this.ip.trim() && this.items.length && this.items.every(x => x && Number.isFinite(Number(x.cantidad)) && Number(x.cantidad) > 0 && Number.isFinite(Number(x.precio)) && Number(x.precio) >= 0 && Number.isFinite(Number(x.pesoKg ?? 0)) && Number(x.pesoKg ?? 0) >= 0));
  }
  estaPendiente() { return String(this.estado).toLowerCase() === 'pendiente'; }
  aprobar(costoEnvio, zona, total) {
    if (!this.estaPendiente()) throw new ErrorNegocio('PEDIDO_YA_PROCESADO', 'Este pedido ya fue procesado.');
    this.estado = 'aprobado'; this.costoEnvio = costoEnvio; this.zona = zona; this.total = total; this.motivoRechazo = null; this.codigoRechazo = null;
  }
  rechazar(codigo, mensaje) { this.estado = 'rechazado'; this.codigoRechazo = codigo; this.motivoRechazo = mensaje; this.costoEnvio = null; }
  toJSON() { return { estado: this.estado, costoEnvio: this.costoEnvio, zona: this.zona, total: this.total ?? null, motivoRechazo: this.motivoRechazo, codigoRechazo: this.codigoRechazo }; }
}

class PoliticaEnvio {
  constructor(config) { this.config = config; }
  normalizar(texto) { return String(texto || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase(); }
  estaEnCobertura(ubicacion) { return Boolean(ubicacion && ubicacion.esPaisSoportado() && this.obtenerZona(ubicacion)); }
  obtenerZona(ubicacion) {
    if (!ubicacion || !ubicacion.esPaisSoportado()) return null;
    const region = this.normalizar(ubicacion.region);
    if (!region) return null;
    for (const [zona, regiones] of Object.entries(this.config.regionesPorZona || {})) {
      if (regiones.some(alias => { const a = this.normalizar(alias); return region === a || region.includes(a); })) return zona;
    }
    return null;
  }
  calcularCostoEnvio(pedido, zona) {
    if (zona === 'GAM' && pedido.calcularSubtotal() >= this.config.envioGratisDesde) return 0;
    const base = Number(this.config.tarifas[zona]);
    if (!Number.isFinite(base)) throw new ErrorNegocio('FUERA_DE_COBERTURA', 'No tenemos cobertura para esta zona.');
    return base + Math.max(0, Math.ceil(pedido.calcularPesoTotal() - Number(this.config.pesoIncluidoKg))) * Number(this.config.recargoPorKg);
  }
  salida(pedidoId, aprobado, estado, zona, costoEnvio, total, codigo, motivo, detalleTecnico, cuerpoPatch) {
    return { pedidoId: pedidoId ?? null, aprobado, estado, zona: zona ?? null, costoEnvio: costoEnvio ?? null, total: total ?? null, codigo: codigo ?? null, motivo: motivo || '', detalleTecnico: detalleTecnico || '', cuerpoPatch };
  }
  evaluar(entrada, ubicacionA, ubicacionB) {
    let pedido, pedidoId = entrada && typeof entrada === 'object' ? entrada.id ?? null : null;
    try {
      pedido = entrada instanceof Pedido ? entrada : new Pedido(entrada);
      pedidoId = pedido.id ?? null;
      if (!pedido.estaPendiente()) {
        const codigo = 'PEDIDO_YA_PROCESADO', motivo = 'El pedido ya fue procesado.';
        return this.salida(pedidoId, false, pedido.estado, pedido.zona, pedido.costoEnvio, null, codigo, motivo, `Estado recibido: ${pedido.estado}.`, { ultimoIntento: { codigo, motivo, fecha: new Date().toISOString() } });
      }
      if (!pedido.estaCompleto()) {
        const codigo = 'DATOS_INCOMPLETOS', motivo = 'Faltan datos válidos para procesar el pedido.';
        pedido.rechazar(codigo, motivo);
        return this.salida(pedidoId, false, 'rechazado', null, null, null, codigo, motivo, 'Se requiere id, cliente, IP y artículos con cantidad, precio y peso válidos.', { estado: 'rechazado', motivoRechazo: motivo, codigoRechazo: codigo });
      }
      const validar = (u, etiqueta) => {
        if (u === null || u === undefined) return null;
        if (u instanceof ErrorNegocio) throw u;
        if (!(u instanceof Ubicacion) || !u.esValida()) throw new ErrorNegocio('GEO_FALLIDA', `${etiqueta} no contiene una ubicación validada.`, 'Objeto de ubicación inválido o de tipo inesperado.');
        return u;
      };
      let a = validar(ubicacionA, 'IP-API'), b = validar(ubicacionB, 'ipinfo');
      if (!a && !b) throw new ErrorNegocio('GEO_FALLIDA', 'No fue posible verificar la ubicación. Intente de nuevo.', 'Ninguna fuente de geolocalización está disponible.');
      if (a && b && a.codigoPais.toUpperCase() !== b.codigoPais.toUpperCase()) throw new ErrorNegocio('GEO_INCONSISTENTE', 'Las fuentes de ubicación no coinciden. No podemos validar la cobertura.', `IP-API: ${a.codigoPais}; ipinfo: ${b.codigoPais}.`);
      const normalizarIp = valor => String(valor || '').trim().toLowerCase();
      if (a && b && normalizarIp(a.ip) !== normalizarIp(b.ip)) throw new ErrorNegocio('GEO_INCONSISTENTE', 'Las fuentes no devolvieron la misma IP consultada.', `IP-API: ${a.ip}; ipinfo: ${b.ip}.`);
      const ipPedido = normalizarIp(pedido.ip);
      if (a && normalizarIp(a.ip) !== ipPedido) {
        if (b && normalizarIp(b.ip) === ipPedido) a = null;
        else throw new ErrorNegocio('GEO_FALLIDA', 'La ubicación recibida no corresponde a la IP del pedido.', `IP del pedido: ${pedido.ip}; IP-API: ${a.ip}.`);
      }
      if (b && normalizarIp(b.ip) !== ipPedido) {
        if (a && normalizarIp(a.ip) === ipPedido) b = null;
        else throw new ErrorNegocio('GEO_FALLIDA', 'La ubicación recibida no corresponde a la IP del pedido.', `IP del pedido: ${pedido.ip}; ipinfo: ${b.ip}.`);
      }
      if (!a && !b) throw new ErrorNegocio('GEO_FALLIDA', 'No fue posible verificar la ubicación. Intente de nuevo.', 'Ninguna respuesta de geolocalización coincide con la IP del pedido.');
      const elegida = a || b;
      if (!elegida.esPaisSoportado()) throw new ErrorNegocio('FUERA_DE_COBERTURA', 'Por el momento solo entregamos en Costa Rica.', `País: ${elegida.pais} (${elegida.codigoPais}).`);
      const fuenteZona = a && a.region ? a : b && b.region ? b : elegida;
      const zona = this.obtenerZona(fuenteZona);
      if (!zona) throw new ErrorNegocio('FUERA_DE_COBERTURA', 'No tenemos cobertura para esta región.', `Región: ${fuenteZona.region || '(sin región)'}.`);
      const costoEnvio = this.calcularCostoEnvio(pedido, zona), total = pedido.calcularSubtotal() + costoEnvio;
      pedido.aprobar(costoEnvio, zona, total);
      return this.salida(pedidoId, true, 'aprobado', zona, costoEnvio, total, null, 'Pedido aprobado.', `País verificado por ${a && b ? 'ambas fuentes' : (a || b).fuente}; zona tomada de ${fuenteZona.fuente}.`, { estado: 'aprobado', zona, costoEnvio, total, motivoRechazo: null });
    } catch (error) {
      const codigo = error instanceof ErrorNegocio ? error.codigo : 'ERROR_INTERNO';
      const motivo = error instanceof ErrorNegocio ? error.message : 'No pudimos procesar el pedido. Intente de nuevo.';
      const detalle = error instanceof ErrorNegocio ? error.detalleTecnico : String(error && error.message || error);
      const negocio = ['FUERA_DE_COBERTURA', 'GEO_INCONSISTENTE', 'IP_PRIVADA_O_RESERVADA', 'IP_INVALIDA', 'DATOS_INCOMPLETOS'].includes(codigo);
      if (negocio) {
        if (pedido instanceof Pedido && pedido.estaPendiente()) pedido.rechazar(codigo, motivo);
        return this.salida(pedidoId, false, 'rechazado', null, null, null, codigo, motivo, detalle, { estado: 'rechazado', motivoRechazo: motivo, codigoRechazo: codigo });
      }
      const estado = pedido instanceof Pedido ? pedido.estado : null;
      return this.salida(pedidoId, false, estado, pedido instanceof Pedido ? pedido.zona : null, pedido instanceof Pedido ? pedido.costoEnvio : null, null, codigo, motivo, detalle, { ultimoIntento: { codigo, motivo, fecha: new Date().toISOString() } });
    }
  }
}
// Adaptador n8n para el workflow con HTTP Request fuera del AI Agent.
// Nombres confirmados en workflow-n8n.json: AI Agent, IP-API e IPinfo.
// Configure este nodo en modo "Run Once for Each Item". No hace solicitudes HTTP.
const CONFIG_ENVIO = {
  regionesPorZona: {
    GAM: ['San José', 'San Jose', 'San José Province', 'San Jose Province', 'Provincia de San José', 'Provincia de San Jose', 'Heredia', 'Heredia Province', 'Provincia de Heredia', 'Alajuela', 'Alajuela Province', 'Provincia de Alajuela', 'Cartago', 'Cartago Province'],
    RESTO_PAIS: ['Guanacaste', 'Guanacaste Province', 'Provincia de Guanacaste', 'Puntarenas', 'Puntarenas Province', 'Provincia de Puntarenas', 'Limón', 'Limon', 'Limon Province', 'Provincia de Limón', 'Provincia de Limon']
  },
  tarifas: { GAM: 2500, RESTO_PAIS: 4500 },
  pesoIncluidoKg: 5,
  recargoPorKg: 500,
  envioGratisDesde: 50000
};

function leerNodo(nombre) {
  try {
    const items = $(nombre).all();
    if (!Array.isArray(items) || !items.length || !items[0] || !items[0].json) return null;
    return items[0].json;
  } catch (_) {
    return null;
  }
}

function errorInterno(pedido, detalle) {
  const objeto = pedido && typeof pedido === 'object' && !Array.isArray(pedido) ? pedido : null;
  const pedidoId = objeto ? objeto.id ?? null : null;
  const codigo = 'ERROR_INTERNO';
  const motivo = 'No se pudo interpretar la salida del AI Agent. Revise los datos e intente de nuevo.';
  const patch = { ultimoIntento: { codigo, motivo, fecha: new Date().toISOString() } };
  const persistir = (typeof pedidoId === 'string' && pedidoId.trim() !== '') || (typeof pedidoId === 'number' && Number.isFinite(pedidoId));
  return {
    pedidoId,
    aprobado: false,
    estado: objeto ? objeto.estado ?? null : null,
    zona: objeto ? objeto.zona ?? null : null,
    costoEnvio: objeto ? objeto.costoEnvio ?? null : null,
    total: null,
    codigo,
    motivo,
    detalleTecnico: String(detalle || 'Salida del agente vacía o inválida.').slice(0, 500),
    cuerpoPatch: patch,
    persistir
  };
}

function leerPedidoAgente(salida) {
  if (!salida || typeof salida !== 'object' || Array.isArray(salida)) throw new Error('El nodo AI Agent no entregó un objeto de salida.');
  let bruto = Object.prototype.hasOwnProperty.call(salida, 'output') ? salida.output : salida;
  if (typeof bruto === 'string') {
    if (!bruto.trim()) throw new Error('La salida del agente está vacía.');
    bruto = JSON.parse(bruto);
  }
  if (!bruto || typeof bruto !== 'object' || Array.isArray(bruto)) throw new Error('La salida del agente debe ser un objeto JSON.');
  if (!bruto.pedido || typeof bruto.pedido !== 'object' || Array.isArray(bruto.pedido)) throw new Error('Falta el objeto pedido en la salida del agente.');
  const errores = Array.isArray(bruto.errores) ? bruto.errores : [];
  const modo = bruto.modo === 'consulta_cobertura' ? 'consulta_cobertura' : 'pedido';
  return { pedido: bruto.pedido, errores, modo };
}

function leerUbicacion(respuesta, lector, nombreFuente, fallos) {
  if (respuesta === null || respuesta === undefined) {
    fallos.push(nombreFuente + ': sin respuesta disponible.');
    return null;
  }
  if (typeof respuesta !== 'object' || Array.isArray(respuesta)) {
    fallos.push(nombreFuente + ': respuesta con formato inválido.');
    return null;
  }

  let cuerpo = respuesta;
  const tieneEstadoHttp = Object.prototype.hasOwnProperty.call(respuesta, 'statusCode');
  const errorRespuesta = respuesta.error;
  const pareceErrorTransporte = errorRespuesta && (typeof errorRespuesta !== 'object' || !errorRespuesta.title);
  if (errorRespuesta && !tieneEstadoHttp && !Object.prototype.hasOwnProperty.call(respuesta, 'body') && !('ip' in respuesta) && !('query' in respuesta) && !('country' in respuesta) && pareceErrorTransporte) {
    fallos.push(nombreFuente + ': ' + String(errorRespuesta.message || errorRespuesta.description || errorRespuesta));
    return null;
  }
  if (tieneEstadoHttp) {
    const estadoHttp = Number(respuesta.statusCode);
    if (!Number.isFinite(estadoHttp) || estadoHttp < 200 || estadoHttp >= 300) {
      fallos.push(nombreFuente + ': HTTP ' + String(respuesta.statusCode) + (respuesta.error && respuesta.error.message ? ' (' + respuesta.error.message + ')' : '') + '.');
      return null;
    }
    if (!Object.prototype.hasOwnProperty.call(respuesta, 'body')) {
      fallos.push(nombreFuente + ': wrapper HTTP sin body.');
      return null;
    }
    cuerpo = respuesta.body;
  } else if (Object.prototype.hasOwnProperty.call(respuesta, 'body') && !('ip' in respuesta) && !('query' in respuesta)) {
    cuerpo = respuesta.body;
  }

  if (typeof cuerpo === 'string') {
    try { cuerpo = JSON.parse(cuerpo); }
    catch (_) { fallos.push(nombreFuente + ': el body no contiene JSON válido.'); return null; }
  }
  if (!cuerpo || typeof cuerpo !== 'object' || Array.isArray(cuerpo)) {
    fallos.push(nombreFuente + ': body ausente o con formato inválido.');
    return null;
  }

  try {
    return lector(cuerpo);
  } catch (error) {
    if (error instanceof ErrorNegocio && error.codigo === 'GEO_FALLIDA') {
      fallos.push(nombreFuente + ': ' + error.detalleTecnico);
      return null;
    }
    if (error instanceof ErrorNegocio) return error;
    fallos.push(nombreFuente + ': error al interpretar la respuesta.');
    return null;
  }
}

let resultado;
let pedidoParseado = null;
try {
  const salidaAgente = leerNodo('AI Agent');
  if (!salidaAgente) throw new Error('No fue posible leer la salida del nodo AI Agent.');
  const datosAgente = leerPedidoAgente(salidaAgente);
  pedidoParseado = datosAgente.pedido;
  const esConsultaCobertura = datosAgente.modo === 'consulta_cobertura';
  const fallos = [];

  const respuestaIpApi = leerNodo('IP-API');
  const respuestaIpInfo = leerNodo('IPinfo');
  // Alias opcional para instalaciones que renombren IP-API a ip-api.
  const respuestaIpApiFinal = respuestaIpApi === null ? leerNodo('ip-api') : respuestaIpApi;
  const ubicacionA = leerUbicacion(respuestaIpApiFinal, r => Ubicacion.desdeIpApi(r), 'IP-API', fallos);
  const ubicacionB = leerUbicacion(respuestaIpInfo, r => Ubicacion.desdeIpInfo(r), 'IPinfo', fallos);

  const politica = new PoliticaEnvio(CONFIG_ENVIO);
  if (esConsultaCobertura && !(typeof datosAgente.pedido.ip === 'string' && datosAgente.pedido.ip.trim())) {
    resultado = {
      pedidoId: null, aprobado: false, estado: 'consulta_cobertura', zona: null,
      costoEnvio: null, total: null, codigo: 'DATOS_INCOMPLETOS',
      motivo: 'Escribe una direccion IP para consultar la cobertura.',
      detalleTecnico: 'La consulta de cobertura requiere una IP textual.',
      cuerpoPatch: null, persistir: false, tipoResultado: 'consulta_cobertura'
    };
  } else {
    const pedidoEvaluado = esConsultaCobertura ? {
      id: '__consulta_cobertura__', cliente: 'Consulta de cobertura', ip: datosAgente.pedido.ip,
      items: [{ cantidad: 1, precio: 0, pesoKg: 0 }]
    } : datosAgente.pedido;
    resultado = politica.evaluar(pedidoEvaluado, ubicacionA, ubicacionB);
    if (esConsultaCobertura) {
      const decisionCobertura = resultado;
      const ipConsultada = datosAgente.pedido.ip.trim();
      const fuenteUbicacion = ubicacionA instanceof Ubicacion
        ? ubicacionA
        : ubicacionB instanceof Ubicacion ? ubicacionB : null;
      const fuenteRegion = ubicacionA instanceof Ubicacion && ubicacionA.region
        ? ubicacionA
        : ubicacionB instanceof Ubicacion && ubicacionB.region ? ubicacionB : fuenteUbicacion;
      const ubicacionConsulta = fuenteUbicacion ? {
        ip: ipConsultada,
        ciudad: (ubicacionA instanceof Ubicacion && ubicacionA.ciudad) || (ubicacionB instanceof Ubicacion && ubicacionB.ciudad) || null,
        region: fuenteRegion && fuenteRegion.region || null,
        pais: (ubicacionA instanceof Ubicacion && ubicacionA.pais) || (ubicacionB instanceof Ubicacion && ubicacionB.pais) || null,
        codigoPais: (ubicacionA instanceof Ubicacion && ubicacionA.codigoPais) || (ubicacionB instanceof Ubicacion && ubicacionB.codigoPais) || null,
        lat: (ubicacionA instanceof Ubicacion && ubicacionA.lat !== null ? ubicacionA.lat : null) ?? (ubicacionB instanceof Ubicacion ? ubicacionB.lat : null),
        lon: (ubicacionA instanceof Ubicacion && ubicacionA.lon !== null ? ubicacionA.lon : null) ?? (ubicacionB instanceof Ubicacion ? ubicacionB.lon : null),
        fuente: ubicacionA instanceof Ubicacion && ubicacionB instanceof Ubicacion ? 'ip-api e ipinfo' : fuenteUbicacion.fuente
      } : null;
      const motivoCobertura = decisionCobertura.aprobado
        ? 'La IP ' + ipConsultada + ' esta dentro de la zona de entrega ' + decisionCobertura.zona + '.'
        : decisionCobertura.codigo === 'FUERA_DE_COBERTURA'
          ? 'La IP ' + ipConsultada + ' esta fuera de la zona de entrega.'
          : 'No se pudo confirmar la cobertura de la IP ' + ipConsultada + ': ' + decisionCobertura.motivo;
      resultado = {
        pedidoId: null, aprobado: decisionCobertura.aprobado, estado: 'consulta_cobertura',
        zona: decisionCobertura.zona, costoEnvio: null, total: null,
        codigo: decisionCobertura.aprobado ? 'COBERTURA_DISPONIBLE' : decisionCobertura.codigo,
        motivo: motivoCobertura, detalleTecnico: decisionCobertura.detalleTecnico,
        ubicacion: ubicacionConsulta, cuerpoPatch: null, persistir: false, tipoResultado: 'consulta_cobertura'
      };
    }
  }
  if (datosAgente.errores.length && !resultado.aprobado) {
    const resumen = datosAgente.errores.map(e => typeof e === 'string' ? e : e && (e.mensaje || e.message || e.codigo) || 'error de extracción').join('; ').slice(0, 500);
    fallos.push('AI Agent: ' + resumen);
  }
  if (!ubicacionA && !ubicacionB && fallos.length) {
    resultado.detalleTecnico = [resultado.detalleTecnico, fallos.join(' ')].filter(Boolean).join(' ').slice(0, 1000);
  }
} catch (error) {
  resultado = errorInterno(pedidoParseado, error && error.message ? error.message : 'Error de entrada inesperado.');
}

const idValido = (typeof resultado.pedidoId === 'string' && resultado.pedidoId.trim() !== '') || (typeof resultado.pedidoId === 'number' && Number.isFinite(resultado.pedidoId));
resultado.persistir = idValido && Boolean(resultado.cuerpoPatch && typeof resultado.cuerpoPatch === 'object' && !Array.isArray(resultado.cuerpoPatch));
return { json: resultado };
