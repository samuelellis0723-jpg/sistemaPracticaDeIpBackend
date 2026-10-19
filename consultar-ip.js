// Consultas manuales a ambas APIs. No se ejecuta desde main.js.
// Las dos IP marcadas CR son candidatas no verificadas hasta recibir resultados.
const fs = require('node:fs/promises');
const path = require('node:path');
const ips = [
  { valor: '190.10.0.1', etiqueta: 'candidata CR, zona por confirmar' },
  { valor: '201.192.0.1', etiqueta: 'candidata CR, zona por confirmar' },
  { valor: '8.8.8.8', etiqueta: 'IP pública de otro país esperada, verificar respuesta' },
  { valor: '192.168.1.10', etiqueta: 'IP privada de prueba' },
  { valor: 'not-an-ip', etiqueta: 'IP inválida de prueba' }
];
const dir = path.join(__dirname, 'datos', 'ip-respuestas');
const campos = 'status,message,country,countryCode,regionName,city,lat,lon,query';
const pausa = ms => new Promise(resolve => setTimeout(resolve, ms));

async function consultar(url, archivo, nombre, ip) {
  try {
    const respuesta = await fetch(url, { signal: AbortSignal.timeout(15000) });
    const cuerpo = await respuesta.text();
    // Se conserva el cuerpo textual devuelto por la API, sin parsear ni reserializar.
    await fs.writeFile(path.join(dir, archivo), cuerpo, 'utf8');
    if (!respuesta.ok) {
      console.error(`${nombre} ${ip}: FALLÓ HTTP ${respuesta.status}; cuerpo guardado en ${archivo}`);
      return false;
    }
    console.log(`${nombre} ${ip}: HTTP ${respuesta.status}; respuesta guardada en ${archivo}`);
    return true;
  } catch (error) {
    console.error(`${nombre} ${ip}: FALLÓ la consulta (${error.message}); no hubo cuerpo que guardar.`);
    return false;
  }
}

(async () => {
  await fs.mkdir(dir, { recursive: true });
  let exitosas = 0, fallidas = 0, n = 0;
  for (const elemento of ips) {
    console.log(`\nIP ${elemento.valor} — ${elemento.etiqueta}`);
    const ip = encodeURIComponent(elemento.valor);
    const urlApi = `http://ip-api.com/json/${ip}?fields=${campos}`;
    const urlInfo = `https://ipinfo.io/${ip}/json`;
    n++;
    if (await consultar(urlApi, `ipapi-${n}.json`, 'ip-api', elemento.valor)) exitosas++; else fallidas++;
    await pausa(1600); // 5 consultas ip-api quedan muy por debajo de 45 por minuto.
    if (await consultar(urlInfo, `ipinfo-${n}.json`, 'ipinfo', elemento.valor)) exitosas++; else fallidas++;
    if (n < ips.length) await pausa(1600);
  }
  console.log(`\nResumen de consultas: ${exitosas} exitosas; ${fallidas} fallidas; ${ips.length * 2} intentos.`);
  if (fallidas) process.exitCode = 1;
})().catch(error => { console.error(`Fallo preparando consultas: ${error.message}`); process.exitCode = 1; });
