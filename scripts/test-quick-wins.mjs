// Prueba de punta a punta de los "quick wins": participantes (agregar, eliminar
// con historial, restaurar, Excel), pantalla (cuántos a la vez), aprobación de
// fotos, agenda con imagen, encuesta de emojis, votación con registro y su
// pantalla, sorteo por QR con cuenta regresiva, trivia con fotos y selección
// única, aprobación de mensajes, descargas por módulo y textos editables.
// Ejecutar contra una instancia local con datos de prueba, nunca producción.
// VENITO_TEST_URL=http://127.0.0.1:3106 VENITO_TEST_PASSWORD=... node scripts/test-quick-wins.mjs
import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';

const base = process.env.VENITO_TEST_URL || 'http://127.0.0.1:3106';
assert(['127.0.0.1', 'localhost', '[::1]'].includes(new URL(base).hostname), 'Solo se permite un servidor local de pruebas');
assert(process.env.VENITO_TEST_PASSWORD, 'Define VENITO_TEST_PASSWORD');

let admin = '';
let slug = '';
const json = (data, method = 'POST') => ({ method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
async function request(path, options = {}, cookie = '') {
  return fetch(`${base}${path}`, { redirect: 'manual', ...options, headers: { ...options.headers, ...(cookie ? { Cookie: cookie } : {}) } });
}
async function expected(response, status) {
  const cuerpo = response.status === status ? '' : await response.text();
  assert.equal(response.status, status, `${response.url}: ${response.status} ${cuerpo.slice(0, 300)}`);
  return response;
}
const paso = (texto) => console.log(`✓ ${texto}`);
// Para HTML: el mensaje de error dice qué faltaba sin volcar la página entera.
const contiene = (html, texto, donde) => assert(html.includes(texto), `${donde}: falta «${texto}»`);

// Un PNG de 1x1 válido: alcanza para la firma que revisa el servidor.
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
async function subirImagen() {
  const form = new FormData();
  form.append('file', new Blob([PNG], { type: 'image/png' }), 'prueba.png');
  const res = await expected(await request('/api/archivos', { method: 'POST', body: form }, admin), 201);
  return (await res.json()).archivo;
}

try {
  const login = await expected(await request('/api/admin/login', json({ password: process.env.VENITO_TEST_PASSWORD })), 200);
  admin = login.headers.get('set-cookie').split(';')[0];
  const creado = await (await expected(await request('/api/eventos', json({ tipo: 'activacion', titulo: `Quick wins ${Date.now()}` }), admin), 201)).json();
  slug = creado.slug;
  const api = `/api/eventos/${slug}`;
  const modulos = ['mesa', 'mensajes', 'fotos', 'agenda', 'encuestas', 'votaciones', 'sorteos', 'trivia'].map((id) => ({ id, activo: true }));
  const evento = await (await expected(await request(api, json({ modulos }, 'PATCH'), admin), 200)).json();
  const k = encodeURIComponent(evento.pantalla_token);
  assert(evento.pantalla_token, 'el panel recibe la clave de la pantalla');

  // ---------------------------------------------------------- participantes
  const ana = await (await expected(await request(`${api}/guests`, json({ nombre: 'Ana Prueba', mesa: 'VIP' }), admin), 201)).json();
  await expected(await request(`${api}/guests`, json({ nombre: '   ' }), admin), 400);
  await expected(await request(`${api}/guests/${ana.id}`, { method: 'DELETE' }, admin), 200);
  let lista = await (await request(`${api}/guests`, {}, admin)).json();
  assert(!lista.some((g) => g.id === ana.id), 'el eliminado sale de la lista');
  let eliminados = await (await request(`${api}/guests?eliminados=1`, {}, admin)).json();
  const eliminado = eliminados.find((g) => g.id === ana.id);
  assert(eliminado?.eliminado_at, 'queda en el historial con fecha y hora');
  await expected(await request(`${api}/guests/${ana.id}`, json({ restaurar: true }, 'PATCH'), admin), 200);
  lista = await (await request(`${api}/guests`, {}, admin)).json();
  assert(lista.some((g) => g.id === ana.id && g.mesa === 'VIP'), 'restaurar lo devuelve con su sector');
  const excel = await expected(await request(`${api}/guests/excel`, {}, admin), 200);
  assert.match(excel.headers.get('content-type'), /spreadsheetml/);
  assert.match(excel.headers.get('content-disposition'), /participantes-/);
  await expected(await request(`${api}/guests/excel`), 401);
  await expected(await request(`${api}/guests/${ana.id}`, { method: 'DELETE' }, admin), 200);
  await expected(await request(`${api}/guests/${ana.id}?definitivo=1`, { method: 'DELETE' }, admin), 200);
  eliminados = await (await request(`${api}/guests?eliminados=1`, {}, admin)).json();
  assert(!eliminados.some((g) => g.id === ana.id), 'borrar definitivamente lo saca del historial');
  paso('Participantes: agregar, eliminar con historial, restaurar, Excel');

  // ---------------------------------------------------------- pantalla y fotos
  let actualizado = await (await expected(await request(api, json({ pantalla_config: { fotos: 3 } }, 'PATCH'), admin), 200)).json();
  actualizado = await (await expected(await request(api, json({ pantalla_config: { mensajes: 9 } }, 'PATCH'), admin), 200)).json();
  const config = JSON.parse(actualizado.pantalla_config);
  assert.equal(config.fotos, 3);
  assert.equal(config.mensajes, 1, 'un valor fuera de 1-4 no se guarda');
  const pantalla = await (await expected(await request(`${api}/pantalla?k=${k}`), 200)).json();
  assert.deepEqual(pantalla.config, { fotos: 3, mensajes: 1 });
  const aprobadas = await (await expected(await request(`${api}/photos`, json({ accion: 'aprobar_pendientes' }, 'PATCH'), admin), 200)).json();
  assert.equal(aprobadas.aprobadas, 0);
  const vivo = await (await expected(await request(`/pantalla/${slug}?k=${k}`), 200)).text();
  contiene(vivo, 'En vivo', 'pantalla principal');
  paso('Pantalla: cantidad a la vez, EN VIVO y aprobación masiva de fotos');

  // ---------------------------------------------------------- agenda con imagen
  const foto = await subirImagen();
  const actividad = await (await expected(await request(`${api}/agenda`, json({ titulo: 'Charla', hora: '18:00' }), admin), 201)).json();
  await expected(await request(`${api}/agenda/${actividad.id}`, json({ imagen: foto }, 'PATCH'), admin), 200);
  await expected(await request(`/api/archivos/${foto}`), 200); // pública porque la usa la agenda
  const agenda = await (await expected(await request(`/${slug}/agenda`), 200)).text();
  contiene(agenda, foto, 'agenda');
  paso('Agenda: imagen opcional por actividad');

  // ---------------------------------------------------------- encuesta de emojis
  const encuesta = await (await expected(await request(`${api}/encuestas`, json({ titulo: '¿Qué tal?' }), admin), 201)).json();
  await expected(await request(`${api}/encuestas/${encuesta.id}`, json({ preguntas: [{ texto: '¿Cómo lo pasaste?', tipo: 'emoji', opciones: ['😍', 'hola', '😄', '😍', '🙂', '😐', '😢', '🎉'] }] }, 'PATCH'), admin), 200);
  const encuestas = await (await request(`${api}/encuestas`, {}, admin)).json();
  const pregunta = encuestas.find((e) => e.id === encuesta.id).preguntas[0];
  assert.equal(pregunta.tipo, 'emoji');
  const opciones = Array.isArray(pregunta.opciones) ? pregunta.opciones : JSON.parse(pregunta.opciones);
  assert.deepEqual(opciones, ['😍', '😄', '🙂', '😐', '😢'], 'solo emojis, sin repetir y hasta 5');
  paso('Encuesta: respuesta con emojis');

  // ---------------------------------------------------------- votación
  const votacion = await (await expected(await request(`${api}/votaciones`, json({ titulo: 'Mejor stand' }), admin), 201)).json();
  const conOpciones = await (await expected(await request(`${api}/votaciones/${votacion.id}`, json({ pide_datos: 1, opciones: [{ texto: 'Rojo', imagen: foto }, { texto: 'Azul' }] }, 'PATCH'), admin), 200)).json();
  const rojo = conOpciones.opciones.find((o) => o.texto === 'Rojo');
  const votar = `${api}/votaciones/${votacion.id}/votar`;
  await expected(await request(votar, json({ opciones: [rojo.id], sesion: 's1' })), 400);
  await expected(await request(votar, json({ opciones: [rojo.id], sesion: 's1', nombre: 'Luis', email: 'LUIS@example.invalid' })), 201);
  await expected(await request(votar, json({ opciones: [rojo.id], sesion: 's2', nombre: 'Luis', email: 'luis@example.invalid' })), 409);
  await expected(await request(`${api}/votaciones/${votacion.id}/pantalla`), 401);
  const enVivo = await (await expected(await request(`${api}/votaciones/${votacion.id}/pantalla?k=${k}`), 200)).json();
  assert.equal(enVivo.total, 1);
  assert.equal(enVivo.votantes, 1);
  assert(enVivo.opciones.find((o) => o.texto === 'Rojo').imagen.includes(foto));
  const csv = await (await expected(await request(`${api}/votaciones/${votacion.id}/votantes`, {}, admin), 200)).text();
  assert.match(csv, /luis@example\.invalid/);
  await expected(await request(`${api}/votaciones/${votacion.id}/votantes`), 401);
  const paginaVotacion = await (await expected(await request(`/pantalla/${slug}/votacion/${votacion.id}?k=${k}`), 200)).text();
  contiene(paginaVotacion, 'Escanea y vota', 'pantalla de votación');
  const sinClave = await (await request(`/pantalla/${slug}/votacion/${votacion.id}`)).text();
  contiene(sinClave, 'no es válida', 'pantalla sin clave');
  paso('Votación: con registro (un voto por correo), pantalla en vivo con QR, CSV');

  // ---------------------------------------------------------- sorteo por QR
  const sorteo = await (await expected(await request(`${api}/sorteos`, json({ titulo: '¡Gana un viaje!', premio: 'Un viaje a Italia', fuente: 'inscritos' }), admin), 201)).json();
  const sorteoApi = `${api}/sorteos/${sorteo.id}`;
  const enUnaHora = new Date(Date.now() + 3600_000).toISOString();
  await expected(await request(sorteoApi, json({ fecha_sorteo: enUnaHora, imagen: foto }, 'PATCH'), admin), 200);
  await expected(await request(`${sorteoApi}/inscribir`, json({ nombre: 'Carla Prueba', email: 'carla@example.invalid' })), 201);
  const repetido = await (await expected(await request(`${sorteoApi}/inscribir`, json({ nombre: 'Carla', email: 'CARLA@example.invalid ' })), 200)).json();
  assert.equal(repetido.repetido, true, 'el mismo correo no suma otra oportunidad');
  await expected(await request(`${sorteoApi}/inscribir`, json({ nombre: 'X', email: 'malo' })), 400);
  await expected(await request(`${sorteoApi}/inscribir`, json({ nombre: 'Diego Prueba', email: 'diego@example.invalid' })), 201);
  let estado = await (await expected(await request(`${sorteoApi}/pantalla?k=${k}&nombres=1`), 200)).json();
  assert.equal(estado.participantes, 2);
  assert.equal(estado.inscripcion, true);
  assert(!JSON.stringify(estado).includes('@'), 'la pantalla no recibe correos');
  await expected(await request(`${sorteoApi}/pantalla?k=${k}`, { method: 'POST' }), 409); // falta para la hora
  await expected(await request(`${sorteoApi}/pantalla`, { method: 'POST' }), 401);
  const paginaSorteo = await (await expected(await request(`/pantalla/${slug}/sorteo/${sorteo.id}?k=${k}`), 200)).text();
  contiene(paginaSorteo, 'Escanea y participa', 'pantalla del sorteo');
  const inscripcion = await (await expected(await request(`/${slug}/sorteo/${sorteo.id}`), 200)).text();
  contiene(inscripcion, 'Participar', 'inscripción al sorteo');
  // Llega la hora: se cierran las inscripciones y la pantalla puede sortear una vez.
  await expected(await request(sorteoApi, json({ fecha_sorteo: new Date(Date.now() - 1000).toISOString() }, 'PATCH'), admin), 200);
  await expected(await request(`${sorteoApi}/inscribir`, json({ nombre: 'Tarde Prueba', email: 'tarde@example.invalid' })), 409);
  estado = await (await expected(await request(`${sorteoApi}/pantalla?k=${k}`, { method: 'POST' }), 200)).json();
  assert.equal(estado.ganadores.length, 1);
  assert(['Carla Prueba', 'Diego Prueba'].includes(estado.ganadores[0]));
  await expected(await request(`${sorteoApi}/pantalla?k=${k}`, { method: 'POST' }), 409); // no se sortea dos veces desde la pantalla
  await expected(await request(`${sorteoApi}/ejecutar`, { method: 'POST' }, admin), 200); // el panel sí puede repetir
  const inscritos = await (await expected(await request(`${sorteoApi}/inscritos`, {}, admin), 200)).text();
  assert.match(inscritos, /carla@example\.invalid/);
  await expected(await request(`/api/archivos/${foto}`), 200);
  paso('Sorteo: inscripción por QR, cuenta regresiva, sorteo único desde la pantalla');

  // ---------------------------------------------------------- trivia con fotos
  const trivia = await (await expected(await request(`${api}/trivias`, json({ titulo: '¿Cuánto sabes?' }), admin), 201)).json();
  const fotoTrivia = await subirImagen();
  const guardada = await (await expected(await request(`${api}/trivias/${trivia.id}`, json({
    abierta: 1,
    preguntas: [
      { id: 0, enunciado: '¿Cuál es el logo?', multiple: false, correctas: [1, 2], opciones: [{ texto: '', imagen: '' }, { texto: '', imagen: fotoTrivia }, { texto: 'B', imagen: '' }, { texto: 'C', imagen: '' }] },
      { id: 0, enunciado: '¿Cuáles son colores?', multiple: true, correctas: [0, 1], opciones: ['Rojo', 'Azul', 'Perro'] },
    ],
  }, 'PATCH'), admin), 200)).json();
  const [unica, varias] = guardada.preguntas;
  assert.equal(unica.multiple, false);
  assert.deepEqual(unica.opciones, ['', 'B', 'C'], 'la alternativa vacía sin foto se descarta');
  assert.deepEqual(unica.imagenes, [fotoTrivia, '', '']);
  assert.deepEqual(unica.correctas, [0], 'los índices se corren y con selección única queda una correcta');
  assert.equal(varias.multiple, true);
  const publica = await (await request(`${api}/trivias`)).json();
  assert(!('correctas' in publica[0].preguntas[0]), 'las correctas no salen antes de jugar');
  assert.equal(publica[0].preguntas[0].imagenes[0], fotoTrivia);
  await expected(await request(`/api/archivos/${fotoTrivia}`), 200);
  const partida = await (await expected(await request(`${api}/trivias/${trivia.id}/jugar`, json({
    participante: 'Jugador', sesion: 's1',
    respuestas: [{ pregunta_id: unica.id, elegidas: [0, 1] }, { pregunta_id: varias.id, elegidas: [0, 1] }],
  })), 200)).json();
  assert.equal(partida.puntaje, 2, 'en selección única cuenta solo la primera marca');
  const paginaTrivia = await (await expected(await request(`/${slug}/trivia`), 200)).text();
  contiene(paginaTrivia, fotoTrivia, 'trivia');
  paso('Trivia: alternativas con foto, selección única o múltiple');

  // ---------------------------------------------------------- aprobación de mensajes
  const mensajeLibre = await (await expected(await request(`${api}/messages`, json({ nombre: 'Tía Marta', mensaje: 'Sale altiro' })), 201)).json();
  assert.equal(mensajeLibre.estado, 'aprobada', 'sin aprobación el mensaje sale apenas llega');
  await expected(await request(api, json({ registro_config: { ...JSON.parse(evento.registro_config || '{}'), mensajes_moderacion: true } }, 'PATCH'), admin), 200);
  const enEspera = await (await expected(await request(`${api}/messages`, json({ nombre: 'Primo', mensaje: 'Espero revisión' })), 201)).json();
  assert.equal(enEspera.estado, 'pendiente');
  let enPantalla = await (await expected(await request(`${api}/pantalla?k=${k}`), 200)).json();
  assert.deepEqual(enPantalla.mensajes.map((m) => m.mensaje), ['Sale altiro'], 'el pendiente no sale en la pantalla');
  let losMensajes = await (await expected(await request(`${api}/messages`, {}, admin), 200)).json();
  const pendiente = losMensajes.find((m) => m.estado === 'pendiente');
  await expected(await request(`${api}/messages/${pendiente.id}`, json({ estado: 'aprobada' }, 'PATCH')), 401);
  await expected(await request(`${api}/messages/${pendiente.id}`, json({ estado: 'otro' }, 'PATCH'), admin), 400);
  await expected(await request(`${api}/messages/${pendiente.id}`, json({ estado: 'aprobada' }, 'PATCH'), admin), 200);
  const libre = losMensajes.find((m) => m.mensaje === 'Sale altiro');
  await expected(await request(`${api}/messages/${libre.id}`, json({ estado: 'rechazada' }, 'PATCH'), admin), 200);
  enPantalla = await (await expected(await request(`${api}/pantalla?k=${k}`), 200)).json();
  assert.deepEqual(enPantalla.mensajes.map((m) => m.mensaje), ['Espero revisión'], 'el rechazado deja de salir');
  assert.equal(enPantalla.totales.mensajes, 1);
  await expected(await request(`${api}/messages`, json({ nombre: 'Otro', mensaje: 'También espera' })), 201);
  const masiva = await (await expected(await request(`${api}/messages`, json({ accion: 'aprobar_pendientes' }, 'PATCH'), admin), 200)).json();
  assert.equal(masiva.aprobadas, 1);
  await expected(await request(`${api}/messages/${libre.id}`, { method: 'DELETE' }, admin), 200);
  losMensajes = await (await expected(await request(`${api}/messages`, {}, admin), 200)).json();
  assert.equal(losMensajes.length, 2);
  assert(losMensajes.every((m) => m.estado === 'aprobada'));
  paso('Mensajes: con aprobación o publicación automática, aprobar, rechazar y eliminar');

  // ---------------------------------------------------------- descargas por módulo
  await expected(await request(`${api}/encuestas/${encuesta.id}/respuestas`, json({ participante: 'Marta', sesion: 'e1', valores: [{ pregunta_id: pregunta.id, valor: '😍' }] })), 201);
  const libroDe = async (modulo) => {
    const res = await expected(await request(`${api}/exportar/${modulo}?formato=xlsx`, {}, admin), 200);
    assert.match(res.headers.get('content-type'), /spreadsheetml/);
    assert.match(res.headers.get('content-disposition'), new RegExp(`${modulo}-${slug}\\.xlsx`));
    const libro = new ExcelJS.Workbook();
    await libro.xlsx.load(Buffer.from(await res.arrayBuffer()));
    return libro;
  };
  const csvDe = async (modulo) => {
    const res = await expected(await request(`${api}/exportar/${modulo}?formato=csv`, {}, admin), 200);
    assert.match(res.headers.get('content-type'), /text\/csv/);
    return res.text();
  };
  const filas = (hoja) => hoja.getSheetValues().slice(1).map((f) => (f ?? []).slice(1));

  let libro = await libroDe('encuestas');
  assert.deepEqual(libro.worksheets.map((h) => h.name), ['¿Qué tal'], 'una hoja por encuesta (sin «?», que Excel no acepta)');
  assert.deepEqual(filas(libro.worksheets[0])[1].slice(1, 2).concat(filas(libro.worksheets[0])[1].slice(3)), ['Marta', '😍']);
  assert.match(await csvDe('encuestas'), /"¿Qué tal\?";"1";"Marta";"[^"]+";"¿Cómo lo pasaste\?";"😍"/);

  libro = await libroDe('mensajes');
  assert.deepEqual(filas(libro.getWorksheet('Mensajes')).slice(1).map((f) => f.slice(0, 3)), [['Primo', 'Espero revisión', 'Aprobado'], ['Otro', 'También espera', 'Aprobado']]);
  assert.match(await csvDe('mensajes'), /"Nombre";"Mensaje";"Estado";"Fecha"\r\n"Primo";"Espero revisión";"Aprobado"/);

  libro = await libroDe('votaciones');
  assert.deepEqual(libro.worksheets.map((h) => h.name), ['Resultados', 'Votos']);
  assert.deepEqual(filas(libro.getWorksheet('Resultados')).slice(1), [['Mejor stand', 'Rojo', 1, '100%'], ['Mejor stand', 'Azul', 0, '0%']]);
  assert.match(await csvDe('votaciones'), /"Mejor stand";"Rojo";"Luis";"luis@example\.invalid"/);

  libro = await libroDe('sorteos');
  assert.deepEqual(libro.worksheets.map((h) => h.name), ['Sorteos', 'Resultados', 'Inscritos con QR']);
  assert.equal(filas(libro.getWorksheet('Sorteos'))[1][3], 'Realizado');
  assert.equal(filas(libro.getWorksheet('Inscritos con QR')).length, 3);
  const csvSorteos = await csvDe('sorteos');
  assert.match(csvSorteos, /"¡Gana un viaje!";"Un viaje a Italia";"Ganador";"1";"(Carla|Diego) Prueba";"Correo: (carla|diego)@example\.invalid"/);

  libro = await libroDe('trivia');
  assert.deepEqual(filas(libro.getWorksheet('Partidas'))[1].slice(0, 6), ['¿Cuánto sabes?', 1, 'Jugador', 2, 2, '100%']);
  assert.match(await csvDe('trivia'), /"Jugador";"2";"2";"100%"/);

  await expected(await request(`${api}/exportar/trivia?formato=xlsx`), 401);
  await expected(await request(`${api}/exportar/registro?formato=xlsx`, {}, admin), 404);
  await expected(await request(`${api}/exportar/trivia?formato=pdf`, {}, admin), 400);
  paso('Descargas: Excel y CSV de mensajes, encuestas, votaciones, sorteos y trivia');

  // ---------------------------------------------------------- textos editables
  await expected(await request(api, json({ textos: { saludo: 'Bienvenidos al stand', modulos: { votaciones: { titulo: 'Elige al MVP', boton: 'Votar ya' }, mesa: { titulo: 'Encuentra tu zona' } } } }, 'PATCH'), admin), 200);
  const inicio = await (await expected(await request(`/${slug}`), 200)).text();
  contiene(inicio, 'Bienvenidos al stand', 'inicio');
  contiene(inicio, 'Votar ya', 'inicio');
  contiene(inicio, 'Encuentra tu zona', 'inicio');
  const paginaVotos = await (await expected(await request(`/${slug}/votacion`), 200)).text();
  contiene(paginaVotos, 'Elige al MVP', 'página de votación');
  // Un texto igual al predeterminado no se guarda.
  const conDefault = await (await expected(await request(api, json({ textos: { modulos: { votaciones: { titulo: 'Vota y elige tu favorita' } } } }, 'PATCH'), admin), 200)).json();
  assert.deepEqual(JSON.parse(conDefault.textos).modulos, {});
  paso('Textos editables por módulo y del inicio');

  console.log('Quick wins OK');
} finally {
  if (slug) {
    const res = await request(`/api/eventos/${slug}`, { method: 'DELETE' }, admin);
    if (res.status !== 200) console.error(`No se pudo borrar ${slug}: ${res.status}`);
  }
}
