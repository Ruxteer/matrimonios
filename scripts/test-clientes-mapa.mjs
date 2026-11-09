// Clientes y mapa interactivo. Ejecutar contra una instancia local, nunca producción:
// VENITO_TEST_URL=http://localhost:3106 VENITO_TEST_PASSWORD=... node scripts/test-clientes-mapa.mjs
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const base = process.env.VENITO_TEST_URL || "http://127.0.0.1:3106";
assert(["127.0.0.1", "localhost", "[::1]"].includes(new URL(base).hostname), "Solo se permite un servidor local de pruebas");
assert(process.env.VENITO_TEST_PASSWORD, "Define VENITO_TEST_PASSWORD");

const json = (data) => ({ headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
const request = (path, options = {}, cookie = "") =>
  fetch(`${base}${path}`, { redirect: "manual", ...options, headers: { ...options.headers, ...(cookie ? { Cookie: cookie } : {}) } });
async function expected(response, status) {
  const text = await response.text();
  assert.equal(response.status, status, `${response.url}: ${response.status} ${text.slice(0, 200)}`);
  return text ? JSON.parse(text) : null;
}

let admin = "";
let cliente = null;
let evento = null;
try {
  assert.equal((await request("/api/clientes")).status, 401, "Los clientes son solo del administrador");
  const login = await request("/api/admin/login", { method: "POST", ...json({ password: process.env.VENITO_TEST_PASSWORD }) });
  assert.equal(login.status, 200);
  admin = login.headers.get("set-cookie").split(";")[0];

  // Venito siempre está, primero, y no se puede borrar ni duplicar su dirección.
  const lista = await expected(await request("/api/clientes", {}, admin), 200);
  assert.equal(lista[0].slug, "venito");
  await expected(await request("/api/clientes/venito", { method: "DELETE" }, admin), 400);
  await expected(await request("/api/clientes", { method: "POST", ...json({ nombre: "  " }) }, admin), 400);

  cliente = await expected(await request("/api/clientes", { method: "POST", ...json({ nombre: `Agencia Prueba ${Date.now()}`, color: "#123456" }) }, admin), 201);
  assert.equal(cliente.color, "#123456");
  const tocado = await expected(await request(`/api/clientes/${cliente.slug}`, { method: "PATCH", ...json({ color: "rojo", logo: "https://afuera.example/logo.png" }) }, admin), 200);
  assert.equal(tocado.color, "#123456", "Un color inválido no se guarda");
  assert.equal(tocado.logo, "", "Un logo que no es un archivo subido no se guarda");

  // El evento nace dentro del cliente y aparece solo en su lista.
  evento = await expected(await request("/api/eventos", { method: "POST", ...json({ tipo: "activacion", titulo: "Mapa de prueba", cliente: cliente.slug }) }, admin), 201);
  assert.equal(evento.cliente_id, cliente.id);
  await expected(await request("/api/eventos", { method: "POST", ...json({ tipo: "activacion", titulo: "x", cliente: "no-existe" }) }, admin), 400);
  const suyos = await expected(await request(`/api/eventos?cliente=${cliente.slug}`, {}, admin), 200);
  assert.deepEqual(suyos.map((e) => e.slug), [evento.slug]);
  const deVenito = await expected(await request("/api/eventos?cliente=venito", {}, admin), 200);
  assert(!deVenito.some((e) => e.slug === evento.slug));

  // Plano, zonas y leyenda: el servidor limpia lo que llega.
  const fd = new FormData();
  fd.append("file", new Blob([await readFile("public/design/marco-movil.png")], { type: "image/png" }), "plano.png");
  const { archivo } = await expected(await request("/api/archivos", { method: "POST", body: fd }, admin), 201);
  const path = `/api/eventos/${evento.slug}`;
  const guardado = await expected(await request(path, { method: "PATCH", ...json({
    mapa: archivo,
    modulos: [{ id: "mapa", activo: true }, { id: "registro", activo: false }],
    mapa_config: {
      zonas: [
        { nombre: "Escenario", x: 20, y: 30, icono: "escenario", descripcion: "Shows", imagen: archivo, detalles: [{ icono: "microfono", texto: "Música en vivo" }, { icono: "musica", texto: "" }] },
        { nombre: "Escenario", x: 150, y: -3, icono: "no-existe", imagen: "/api/eventos/x/registro?formato=csv" },
      ],
      leyenda: [{ icono: "banos", texto: "Baños" }],
    },
  }) }, admin), 200);
  const mapa = JSON.parse(guardado.mapa_config);
  assert.deepEqual(mapa.zonas.map((z) => z.id), ["escenario", "escenario-2"], "Los ids salen del nombre y no se repiten");
  assert.deepEqual([mapa.zonas[1].x, mapa.zonas[1].y], [100, 0], "La posición queda dentro del plano");
  assert.equal(mapa.zonas[1].icono, "punto", "Un ícono desconocido cae al punto");
  assert.equal(mapa.zonas[1].imagen, "", "Solo se aceptan imágenes subidas");
  assert.equal(mapa.zonas[0].detalles.length, 1, "Los detalles sin texto se descartan");
  assert.equal(guardado.cliente.slug, cliente.slug);

  // Lo que ve el invitado.
  const pagina = await (await request(`/${evento.slug}/mapa`)).text();
  assert(pagina.includes("Toca cada zona del mapa"), "Con zonas aparece la invitación a tocarlas");
  assert(pagina.includes(`/${evento.slug}/mapa/escenario-2`));
  assert.equal((await request(`/${evento.slug}/mapa/escenario`)).status, 200);
  assert.equal((await request(`/${evento.slug}/mapa/no-existe`)).status, 404);

  // El organizador con clave propia edita su mapa, pero no cambia el cliente.
  await expected(await request(path, { method: "PATCH", ...json({ clave: "prueba-mapa-123" }) }, admin), 200);
  const loginOrg = await request("/api/admin/login", { method: "POST", ...json({ password: "prueba-mapa-123", slug: evento.slug }) });
  assert.equal(loginOrg.status, 200);
  const org = loginOrg.headers.get("set-cookie").split(";")[0];
  await expected(await request(path, { method: "PATCH", ...json({ cliente: "venito" }) }, org), 403);
  const delOrg = await expected(await request(path, { method: "PATCH", ...json({ cliente_id: 0, mapa_config: { zonas: [] } }) }, org), 200);
  assert.equal(delOrg.cliente_id, cliente.id, "El id del cliente no se acepta desde afuera");
  assert.equal(delOrg.cliente, undefined);
  assert.equal((await request("/api/clientes", {}, org)).status, 401);

  // Borrar el cliente no borra sus eventos: pasan a Venito.
  await expected(await request(`/api/clientes/${cliente.slug}`, { method: "DELETE" }, admin), 200);
  cliente = null;
  const huerfano = await expected(await request(path, {}, admin), 200);
  assert.equal(huerfano.cliente_id, 0);
  assert.equal(huerfano.cliente.slug, "venito");

  assert.equal((await request("/")).headers.get("location")?.endsWith("/admin"), true, "La portada lleva al panel");
  console.log("PASS: clientes (Venito fijo, crear, validar, filtrar, mover a Venito al borrar), mapa interactivo (limpieza, páginas de zona) y permisos del organizador.");
} finally {
  if (evento) await request(`/api/eventos/${evento.slug}`, { method: "DELETE" }, admin).catch(() => {});
  if (cliente) await request(`/api/clientes/${cliente.slug}`, { method: "DELETE" }, admin).catch(() => {});
}
