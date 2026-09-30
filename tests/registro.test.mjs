import test from "node:test";
import assert from "node:assert/strict";

// Integración contra un servidor de desarrollo local con una base descartable.
// REGISTRO_TEST_PASSWORD debe coincidir con ADMIN_PASSWORD de ese servidor.
const base = new URL(process.env.REGISTRO_TEST_URL ?? "http://localhost:3106");
if (!["localhost", "127.0.0.1", "[::1]"].includes(base.hostname)) throw new Error("Estas pruebas solo pueden usar un servidor local.");
const password = process.env.REGISTRO_TEST_PASSWORD;
if (!password) throw new Error("Define REGISTRO_TEST_PASSWORD para el servidor de pruebas local.");

test("registro por evento, consentimiento, cupo y exportaciones privadas", async (t) => {
  const login = await fetch(new URL("/api/admin/login", base), {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password }),
  });
  assert.equal(login.status, 200);
  const admin = login.headers.get("set-cookie").split(";")[0];
  const eventos = [];
  const req = (ruta, method = "GET", body, cookie = "") => fetch(new URL(ruta, base), {
    method, headers: { ...(body ? { "Content-Type": "application/json" } : {}), ...(cookie ? { Cookie: cookie } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const config = {
    abierto: true, telefono_obligatorio: true, terminos_url: "https://example.com/terminos",
    privacidad_url: "https://example.com/privacidad", consentimiento_texto: "Texto de consentimiento solo para pruebas.",
    campos_extra: [{ id: "empresa", label: "Empresa", obligatorio: true }],
  };
  const datos = (email, nombre = "Camila Prueba") => ({
    nombre, email, telefono: "+56 9 1234 5678", consentimiento_legal: true,
    consentimiento_informacion: false, consentimiento_marketing: false, campos_extra: { empresa: "@Texto de prueba" },
  });
  const crear = async (sufijo, capacidad = 0) => {
    const respuesta = await req("/api/eventos", "POST", { tipo: "activacion", titulo: `Prueba registro ${sufijo}`, slug: `test-registro-${Date.now()}-${sufijo}` }, admin);
    assert.equal(respuesta.status, 201);
    const evento = await respuesta.json();
    eventos.push(evento.slug);
    assert.equal(evento.tipo, "activacion");
    const guardado = await req(`/api/eventos/${evento.slug}`, "PATCH", { registro_config: { ...config, capacidad } }, admin);
    assert.equal(guardado.status, 200);
    return evento;
  };
  try {
    const a = await crear("a");
    const b = await crear("b");
    const api = `/api/eventos/${a.slug}/registro`;
    let cookie;

    await t.test("validación y consentimiento obligatorio", async () => {
      for (const body of [
        { ...datos("test@example.com"), consentimiento_legal: false },
        { ...datos("test@example.com"), consentimiento_legal: "true" },
        { ...datos("test@example.com"), email: "incorrecto" },
        { ...datos("test@example.com"), telefono: "123" },
        { ...datos("test@example.com"), campos_extra: {} },
      ]) assert.equal((await req(api, "POST", body)).status, 400);
    });

    await t.test("cookie opaca, voluntariedad y ausencia de PII pública", async () => {
      const registro = await req(api, "POST", datos("CAMI@example.com", "+Camila Prueba"));
      assert.equal(registro.status, 201);
      const setCookie = registro.headers.get("set-cookie");
      assert.match(setCookie, /HttpOnly/i);
      assert.match(setCookie, /SameSite=Lax/i);
      cookie = setCookie.split(";")[0];
      const data = await registro.json();
      assert.equal(data.participante.consentimiento_informacion, false);
      assert.equal(data.participante.consentimiento_marketing, false);
      assert.equal(data.participante.token_hash, undefined);
      const publico = await req(api);
      assert.equal(publico.headers.get("cache-control"), "private, no-store");
      assert.deepEqual(await publico.json(), { participante: null, fotos: 0 });
      const propio = await (await req(api, "GET", undefined, cookie)).json();
      assert.equal(propio.participante.email, "CAMI@example.com");
      assert.deepEqual(await (await req(`/api/eventos/${b.slug}/registro`, "GET", undefined, cookie)).json(), { participante: null, fotos: 0 });
    });

    await t.test("correo repetido no reasigna la identidad", async () => {
      const duplicado = await req(api, "POST", datos("cami@example.com", "Otra Persona"));
      assert.equal(duplicado.status, 409);
      assert.equal(duplicado.headers.get("set-cookie"), null);
      const data = await duplicado.json();
      assert.deepEqual(Object.keys(data), ["error"]);
      assert.ok(!JSON.stringify(data).includes("Camila"));
      const editado = await req(api, "POST", { ...datos("cami@example.com", "+Camila Editada"), consentimiento_informacion: true }, cookie);
      assert.equal(editado.status, 200);
      assert.equal((await editado.json()).participante.consentimiento_informacion, true);
      assert.equal((await req(api, "POST", datos("otra@example.com", "Otra Persona"))).status, 201);
      assert.equal((await req(api, "POST", datos("otra@example.com"), cookie)).status, 409);
      assert.equal((await (await req(api, "GET", undefined, cookie)).json()).participante.email, "cami@example.com");
      assert.equal((await req(`/api/eventos/${b.slug}/registro`, "POST", datos("cami@example.com"))).status, 201);
    });

    await t.test("panel y exportación CSV/XLSX requieren autorización", async () => {
      for (const query of ["?admin=1", "?formato=csv", "?formato=xlsx"]) assert.equal((await req(api + query)).status, 401);
      const lista = await req(api + "?admin=1&buscar=Camila", "GET", undefined, admin);
      assert.equal(lista.headers.get("cache-control"), "private, no-store");
      const data = await lista.json();
      assert.equal(data.total, 1);
      assert.equal(data.participantes[0].token_hash, undefined);
      assert.equal(data.participantes[0].campos_extra.empresa, "@Texto de prueba");
      await req(`/api/eventos/${a.slug}`, "PATCH", { registro_config: { ...config, campos_extra: [] } }, admin);
      const csv = await req(api + "?formato=csv", "GET", undefined, admin);
      assert.equal(csv.status, 200);
      const texto = await csv.text();
      assert.ok(texto.includes("'+Camila Editada"));
      assert.ok(texto.includes("'@Texto de prueba"));
      assert.ok(texto.includes('"empresa"'));
      assert.ok(texto.includes("Texto de consentimiento solo para pruebas."));
      assert.ok(!texto.includes("token_hash"));
      const xlsx = await req(api + "?formato=xlsx", "GET", undefined, admin);
      assert.equal(xlsx.status, 200);
      assert.match(xlsx.headers.get("content-type"), /spreadsheetml/);
      const bytes = new Uint8Array(await xlsx.arrayBuffer());
      assert.equal(bytes[0], 80);
      assert.equal(bytes[1], 75);
      await req(`/api/eventos/${a.slug}`, "PATCH", { registro_config: config }, admin);
    });

    await t.test("cupo atómico bajo solicitudes simultáneas", async () => {
      const limitado = await crear("cupo", 1);
      const respuestas = await Promise.all([
        req(`/api/eventos/${limitado.slug}/registro`, "POST", datos("uno@example.com")),
        req(`/api/eventos/${limitado.slug}/registro`, "POST", datos("dos@example.com")),
      ]);
      assert.deepEqual(respuestas.map((r) => r.status).sort(), [201, 409]);
      const lista = await (await req(`/api/eventos/${limitado.slug}/registro?admin=1`, "GET", undefined, admin)).json();
      assert.equal(lista.total, 1);
    });

    await t.test("configuración inválida, ventana temporal y módulo apagado", async () => {
      for (const registro_config of [
        { ...config, inicio: "fecha inválida" },
        { ...config, inicio: "2026-12-10T00:00:00Z", fin: "2026-12-01T00:00:00Z" },
        { ...config, campos_extra: [{ id: "__proto__", label: "Peligroso", obligatorio: false }] },
      ]) assert.equal((await req(`/api/eventos/${a.slug}`, "PATCH", { registro_config }, admin)).status, 400);
      await req(`/api/eventos/${a.slug}`, "PATCH", { registro_config: { ...config, inicio: "2099-01-01T00:00:00Z" } }, admin);
      assert.equal((await req(api, "POST", datos("nuevo@example.com"))).status, 403);
      await req(`/api/eventos/${a.slug}`, "PATCH", { registro_config: { ...config, terminos_url: "javascript:alert(1)" } }, admin);
      assert.equal((await req(api, "POST", datos("nuevo@example.com"))).status, 403);
      await req(`/api/eventos/${a.slug}`, "PATCH", { modulos: [{ id: "registro", activo: false }] }, admin);
      assert.equal((await req(api)).status, 404);
      assert.equal((await req(api, "POST", datos("nuevo@example.com"))).status, 404);
      assert.equal((await req(api + "?admin=1", "GET", undefined, admin)).status, 200);
    });
  } finally {
    for (const slug of eventos) {
      const eliminado = await req(`/api/eventos/${slug}`, "DELETE", undefined, admin);
      assert.equal(eliminado.status, 200, `No se pudo limpiar ${slug}`);
    }
  }
});
