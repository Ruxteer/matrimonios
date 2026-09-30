// Verifica seguridad y concurrencia usando solamente un servidor local y datos ficticios.
// VENITO_TEST_PASSWORD=... npm run test:fotos
import assert from 'node:assert/strict';
import JSZip from 'jszip';

const base = process.env.VENITO_TEST_URL || 'http://127.0.0.1:3106';
assert(['127.0.0.1', 'localhost', '[::1]'].includes(new URL(base).hostname), 'Solo se permite un servidor local de pruebas');
assert(process.env.VENITO_TEST_PASSWORD, 'Define VENITO_TEST_PASSWORD');
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aG1sAAAAASUVORK5CYII=', 'base64');
let admin = '';
const creados = [];
const json = (body) => ({ headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
const request = (path, options = {}, cookie = '') => fetch(`${base}${path}`, {
  ...options, headers: { ...options.headers, ...(cookie ? { Cookie: cookie } : {}) },
});
async function expected(res, status) {
  assert.equal(res.status, status, `${res.url}: ${res.status} ${res.status === status ? '' : await res.text()}`);
  return res;
}
const cookie = (res) => res.headers.get('set-cookie').split(';')[0];
const consentimiento = {
  terminos_url: 'https://example.com/terminos', privacidad_url: 'https://example.com/privacidad',
  consentimiento_texto: 'Texto de prueba para datos ficticios.',
  fotos_por_participante: 1, fotos_moderacion: true, fotos_requiere_registro: true,
};
async function crear(titulo, tipo = 'activacion') {
  const res = await expected(await request('/api/eventos', { method: 'POST', ...json({ tipo, titulo, nombre1: titulo, nombre2: 'Prueba' }) }, admin), 201);
  const evento = await res.json();
  creados.push(evento.slug);
  await expected(await request(`/api/eventos/${evento.slug}`, { method: 'PATCH', ...json({ registro_config: consentimiento }) }, admin), 200);
  return evento;
}
async function registrar(evento, nombre, email) {
  const res = await expected(await request(`/api/eventos/${evento.slug}/registro`, {
    method: 'POST', ...json({ nombre, email, telefono: '+56912345678', consentimiento_legal: true }),
  }), 201);
  return { cookie: cookie(res), participante: (await res.json()).participante };
}
function subir(evento, sesion = '', bytes = png, tipo = 'image/png') {
  const form = new FormData();
  form.append('file', new Blob([bytes], { type: tipo }), 'foto-prueba.png');
  return request(`/api/eventos/${evento.slug}/photos`, { method: 'POST', body: form }, sesion);
}
try {
  admin = cookie(await expected(await request('/api/admin/login', { method: 'POST', ...json({ password: process.env.VENITO_TEST_PASSWORD }) }), 200));
  const sufijo = Date.now();
  const a = await crear(`Fotos A ${sufijo}`);
  const b = await crear(`Fotos B ${sufijo}`);
  const pa = await registrar(a, '=1+1', 'foto-a@example.invalid');
  const pb = await registrar(b, 'Participante B', 'foto-b@example.invalid');
  const path = `/api/eventos/${a.slug}`;

  await expected(await subir(a, pa.cookie, '<html>archivo disfrazado</html>'), 400);
  await expected(await subir(a, pa.cookie, png, 'image/jpeg'), 400);
  await expected(await subir(a, pa.cookie, new Uint8Array()), 400);
  await expected(await subir(a, pa.cookie, png, 'image/heic'), 400);
  const excesiva = await subir(a, pa.cookie, new Uint8Array(4 * 1024 * 1024 + 1));
  assert([400, 413].includes(excesiva.status), 'Debe rechazarse una foto sobre 4 MB');
  assert.equal((await (await request(`${path}/photos`, {}, admin)).json()).length, 0);
  await expected(await subir(b, pa.cookie), 401);
  await expected(await subir(a, pb.cookie), 401);

  const simultaneas = await Promise.all([subir(a, pa.cookie), subir(a, pa.cookie)]);
  assert.deepEqual(simultaneas.map((r) => r.status).sort(), [201, 409], 'Dos solicitudes no pueden consumir el mismo último cupo');
  const lista = await expected(await request(`${path}/photos`, {}, admin), 200);
  assert.match(lista.headers.get('cache-control'), /no-store/);
  const fotos = await lista.json();
  assert.equal(fotos.length, 1);
  const foto = fotos[0];
  assert.equal(foto.participante_id, pa.participante.id);
  assert.equal(foto.participante_email, 'foto-a@example.invalid');
  assert.equal(foto.estado, 'pendiente');

  await expected(await request(`/api/eventos/${b.slug}`, { method: 'PATCH', ...json({ clave: 'clave-fotos-local-b' }) }, admin), 200);
  const adminB = cookie(await expected(await request('/api/admin/login', { method: 'POST', ...json({ slug: b.slug, password: 'clave-fotos-local-b' }) }), 200));
  await expected(await request(`${path}/photos`, {}, adminB), 401);
  await expected(await request(`${path}/photos/archivo`, {}, adminB), 401);
  await expected(await request(`${path}/photos/${foto.id}`, {}, adminB), 401);
  await expected(await request(`${path}/photos/${foto.id}`, { method: 'PATCH', ...json({ estado: 'aprobada' }) }, adminB), 401);
  await expected(await request(`${path}/photos/${foto.id}`, { method: 'DELETE' }, adminB), 401);
  await expected(await request(`/api/archivos/${foto.archivo}`, {}, adminB), 404);
  await expected(await request(`/api/archivos/${foto.archivo}`, {}, pb.cookie), 404);
  await expected(await request(`/api/archivos/${foto.archivo}`, {}, pa.cookie), 200);
  await expected(await request(`${path}/photos/${foto.id}`, { method: 'PATCH', ...json({ estado: 'aprobada' }) }, admin), 200);
  await expected(await request(`/api/archivos/${foto.archivo}?evento=${a.slug}&k=${b.pantalla_token}`), 404);
  await expected(await request(`/api/archivos/${foto.archivo}?evento=${b.slug}&k=${a.pantalla_token}`), 404);
  await expected(await request(`/api/archivos/${foto.archivo}`), 404);
  const imagen = await expected(await request(`/api/archivos/${foto.archivo}?evento=${a.slug}&k=${a.pantalla_token}`), 200);
  assert.match(imagen.headers.get('cache-control'), /no-store/);
  const individual = await expected(await request(`${path}/photos/${foto.id}`, {}, admin), 200);
  assert.match(individual.headers.get('content-disposition'), /attachment/);
  assert.deepEqual(Buffer.from(await individual.arrayBuffer()), png);

  const descarga = await expected(await request(`${path}/photos/archivo`, {}, admin), 200);
  const zip = await JSZip.loadAsync(await descarga.arrayBuffer());
  const manifest = await zip.file('fotos.csv').async('string');
  assert.match(manifest, /foto-a@example.invalid/);
  assert.match(manifest, /"'=1\+1"/, 'La planilla debe escapar fórmulas');
  const entrada = Object.values(zip.files).find((f) => !f.dir && f.name.startsWith('fotos/'));
  assert(entrada);
  assert.deepEqual(await entrada.async('nodebuffer'), png, 'El ZIP debe contener la imagen original');

  await expected(await request(`${path}/photos/${foto.id}`, { method: 'PATCH', ...json({ estado: 'rechazada' }) }, admin), 200);
  await expected(await subir(a, pa.cookie), 409);
  await expected(await request(path, { method: 'PATCH', ...json({ modulos: [{ id: 'registro', activo: true }, { id: 'fotos', activo: false }] }) }, admin), 200);
  await expected(await subir(a, pa.cookie), 404);
  const pantalla = await expected(await request(`${path}/pantalla?k=${a.pantalla_token}`), 200);
  assert.equal((await pantalla.json()).fotos.length, 0);

  const legacy = await crear(`Fotos matrimonio ${sufijo}`, 'matrimonio');
  await expected(await subir(legacy), 201);
  assert.equal((await (await request(`/api/eventos/${legacy.slug}/photos`, {}, admin)).json())[0].estado, 'pendiente');
  await expected(await request(`/api/eventos/${b.slug}`, { method: 'PATCH', ...json({ registro_config: { ...consentimiento, fotos_requiere_registro: false, fotos_moderacion: false } }) }, admin), 200);
  await expected(await subir(b), 201);
  assert.equal((await (await request(`/api/eventos/${b.slug}/photos`, {}, admin)).json())[0].estado, 'aprobada');
  console.log('PASS: límite atómico, archivos falsificados/tamaño/HEIC, aislamiento entre eventos, descargas originales, CSV seguro, módulos y compatibilidad de fotos sin registro.');
} finally {
  for (const slug of creados) await expected(await request(`/api/eventos/${slug}`, { method: 'DELETE' }, admin), 200);
}
