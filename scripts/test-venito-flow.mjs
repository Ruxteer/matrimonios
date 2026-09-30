// Ejecutar contra una instancia local con datos de prueba, nunca producción.
// VENITO_TEST_URL=http://127.0.0.1:3106 VENITO_TEST_PASSWORD=... node scripts/test-venito-flow.mjs
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const base = process.env.VENITO_TEST_URL || 'http://127.0.0.1:3106';
assert(['127.0.0.1', 'localhost', '[::1]'].includes(new URL(base).hostname), 'Solo se permite un servidor local de pruebas');
assert(process.env.VENITO_TEST_PASSWORD, 'Define VENITO_TEST_PASSWORD');
let admin = '';
let participante = '';
let slug = '';
const created = [];
const json = (data) => ({ headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
async function request(path, options = {}, cookie = '') {
  return fetch(`${base}${path}`, { ...options, headers: { ...options.headers, ...(cookie ? { Cookie: cookie } : {}) } });
}
const expected = async (response, status) => {
  assert.equal(response.status, status, `${response.url}: ${response.status} ${response.status === status ? '' : await response.text()}`);
  return response;
};
const consent = {
  terminos_url: 'https://example.com/terminos', privacidad_url: 'https://example.com/privacidad',
  consentimiento_texto: 'Consentimiento de prueba para datos ficticios.',
  informacion_texto: 'Recibir información y fotos del evento.', marketing_texto: 'Recibir promociones.',
  fotos_por_participante: 1, fotos_requiere_registro: true, fotos_moderacion: true,
};
try {
  const login = await expected(await request('/api/admin/login', { method: 'POST', ...json({ password: process.env.VENITO_TEST_PASSWORD }) }), 200);
  admin = login.headers.get('set-cookie').split(';')[0];
  const create = await expected(await request('/api/eventos', { method: 'POST', ...json({ tipo: 'activacion', titulo: `Prueba Venito ${Date.now()}`, descripcion: 'Datos ficticios para verificar el flujo.' }) }, admin), 201);
  const event = await create.json(); slug = event.slug; created.push(slug);
  assert.equal(event.tipo, 'activacion');
  const path = `/api/eventos/${slug}`;
  await expected(await request(path, { method: 'PATCH', ...json({ registro_config: consent }) }, admin), 200);
  const qr = await expected(await request(`${path}/qr`), 200);
  assert.match(qr.headers.get('content-type'), /image/);
  await expected(await request(`${path}/registro?admin=1`), 401);
  await expected(await request(`${path}/registro?formato=csv`), 401);
  const personal = { nombre: 'Participante Prueba', email: 'venito-flow@example.invalid', telefono: '+56912345678', consentimiento_legal: true, consentimiento_informacion: true, consentimiento_marketing: false, campos_extra: {} };
  await expected(await request(`${path}/registro`, { method: 'POST', ...json({ ...personal, consentimiento_legal: false }) }), 400);
  const registration = await expected(await request(`${path}/registro`, { method: 'POST', ...json(personal) }), 201);
  participante = registration.headers.get('set-cookie').split(';')[0];
  assert.match(registration.headers.get('set-cookie'), /HttpOnly/i);
  await expected(await request(`${path}/registro`, { method: 'POST', ...json(personal) }), 409);
  const own = await (await expected(await request(`${path}/registro`, {}, participante), 200)).json();
  assert.equal(own.participante.email, personal.email);
  assert.equal((await (await request(`${path}/registro`)).json()).participante, null);
  const upload = async (cookie) => {
    const fd = new FormData();
    fd.append('file', new Blob([await readFile('public/design/marco-movil.png')], { type: 'image/png' }), 'foto-prueba.png');
    return request(`${path}/photos`, { method: 'POST', body: fd }, cookie);
  };
  assert((await upload('')).status >= 400, 'La foto asociada requiere registro');
  await expected(await upload(participante), 201);
  assert((await upload(participante)).status >= 400, 'Se debe respetar el máximo de fotos');
  const photos = await (await expected(await request(`${path}/photos`, {}, admin), 200)).json();
  assert.equal(photos.length, 1);
  const photo = photos[0]; assert.equal(photo.estado, 'pendiente');
  const screen = `${path}/pantalla?k=${event.pantalla_token}`;
  assert.equal((await (await request(screen)).json()).fotos.length, 0);
  await expected(await request(`/api/archivos/${photo.archivo}`), 404);
  await expected(await request(`/api/archivos/${photo.archivo}`, {}, participante), 200);
  await expected(await request(`${path}/photos/${photo.id}`, { method: 'PATCH', ...json({ estado: 'aprobada' }) }, admin), 200);
  const visible = await (await request(screen)).json();
  assert.equal(visible.fotos.length, 1);
  await expected(await request(visible.fotos[0].url), 200);
  await expected(await request(`${path}/photos/${photo.id}`, { method: 'PATCH', ...json({ estado: 'rechazada' }) }, admin), 200);
  assert.equal((await (await request(screen)).json()).fotos.length, 0);
  await expected(await request(visible.fotos[0].url), 404);
  const csv = await expected(await request(`${path}/registro?formato=csv`, {}, admin), 200);
  assert.match(await csv.text(), /venito-flow@example.invalid/);
  const excel = await expected(await request(`${path}/registro?formato=xlsx`, {}, admin), 200);
  assert.match(excel.headers.get('content-type'), /spreadsheetml/);
  const zip = await expected(await request(`${path}/photos/archivo`, {}, admin), 200);
  assert.match(zip.headers.get('content-type'), /zip/);
  assert((await zip.arrayBuffer()).byteLength > 100);
  console.log('PASS: QR, registro sin cuenta, consentimiento, privacidad, límite de fotos, moderación, pantalla, CSV, Excel y ZIP.');
} finally {
  for (const eventSlug of created) await request(`/api/eventos/${eventSlug}`, { method: 'DELETE' }, admin);
}
