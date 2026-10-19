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
  static desdeIpApi(r) { return normalizarFuenteGeografica(new FuenteIpApi(), r); }
  static desdeIpInfo(r) { return normalizarFuenteGeografica(new FuenteIpInfo(), r); }
  esValida() { return Boolean(typeof this.codigoPais === 'string' && this.codigoPais.trim() && typeof this.ip === 'string' && this.ip.trim()); }
  esPaisSoportado() { return String(this.codigoPais || '').trim().toUpperCase() === 'CR'; }
}

class FuenteGeografica {
  normalizarRespuesta() {
    throw new ErrorNegocio('GEO_FALLIDA', 'La fuente geográfica no implementa la normalización.', 'Debe usarse una clase concreta de geolocalizacion.');
  }
}

class FuenteIpApi extends FuenteGeografica {
  normalizarRespuesta(r) {
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
}

class FuenteIpInfo extends FuenteGeografica {
  normalizarRespuesta(r) {
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
    const codigoNormalizado = codigoPais.toUpperCase();
    return new Ubicacion({ pais: codigoNormalizado === 'CR' ? 'Costa Rica' : codigoNormalizado, codigoPais: codigoNormalizado, region: r.region || '', ciudad: r.city || '', lat, lon, ip, fuente: 'ipinfo' });
  }
}

function normalizarFuenteGeografica(fuente, respuesta) {
  if (!(fuente instanceof FuenteGeografica)) throw new ErrorNegocio('GEO_FALLIDA', 'La fuente geográfica no es válida.', 'Se esperaba una instancia de FuenteGeografica.');
  return fuente.normalizarRespuesta(respuesta);
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
  estaEnCobertura(ubicación) { return Boolean(ubicación && ubicación.esPaisSoportado() && this.obtenerZona(ubicación)); }
  obtenerZona(ubicación) {
    if (!ubicación || !ubicación.esPaisSoportado()) return null;
    const region = this.normalizar(ubicación.region);
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
  evaluar(entrada, ubicaciónA, ubicaciónB) {
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
      const válidar = (u, etiqueta) => {
        if (u === null || u === undefined) return null;
        if (u instanceof ErrorNegocio) throw u;
        if (!(u instanceof Ubicacion) || !u.esValida()) throw new ErrorNegocio('GEO_FALLIDA', `${etiqueta} no contiene una ubicación válidada.`, 'Objeto de ubicación inválido o de tipo inesperado.');
        return u;
      };
      let a = válidar(ubicaciónA, 'IP-API'), b = válidar(ubicaciónB, 'ipinfo');
      if (!a && !b) throw new ErrorNegocio('GEO_FALLIDA', 'No fue posible verificar la ubicación. Intente de nuevo.', 'Ninguna fuente de geolocalización está disponible.');
      if (a && b && a.codigoPais.toUpperCase() !== b.codigoPais.toUpperCase()) throw new ErrorNegocio('GEO_INCONSISTENTE', 'Las fuentes de ubicación no coinciden. No podemos válidar la cobertura.', `IP-API: ${a.codigoPais}; ipinfo: ${b.codigoPais}.`);
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
