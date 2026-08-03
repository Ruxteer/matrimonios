# Matrimonios

Sitio web para matrimonios: los invitados escanean un QR y pueden buscar su mesa,
dejar un mensaje a los novios, subir fotos y ver el plano del lugar. Un mismo
despliegue atiende a varias bodas: cada una tiene su propia dirección, su QR, sus
invitados y sus colores.

## Requisitos

- **Node.js 20 o superior** (probado en 22). Con Node 18 Next 16 no arranca.
- Para desarrollar no hace falta nada más: la base es un archivo SQLite local.

## Puesta en marcha

```bash
npm install
```

Crea un archivo `.env.local` en la raíz con la contraseña del panel:

```
ADMIN_PASSWORD=una-contraseña-larga-y-propia
```

Sin esa variable el panel queda cerrado (nadie puede entrar). Cambiarla cierra
todas las sesiones abiertas.

```bash
npm run dev     # desarrollo en http://localhost:3000
npm run build   # compilar para producción
npm start       # servir lo compilado
```

La primera vez que se usa se crea sola la base en `data/matrimonio.db`.

## Cómo se usa

1. Entra a `/admin`, ingresa la contraseña y crea un matrimonio con los nombres
   de los novios. Queda con una dirección propia, por ejemplo `/camila-y-juan`.
2. En la pestaña **Invitados**, importa la lista desde Excel (hay una plantilla
   descargable) o agrégalos a mano. Cualquier celda se edita haciendo clic.
3. En **Ajustes** puedes cambiar los nombres, la fecha, la dirección web, los
   colores del sitio, subir un banner propio y el plano del lugar, y descargar
   el **QR** en PNG o SVG para imprimirlo.
4. Los invitados escanean ese QR y llegan al sitio de esa boda.

El Excel se lee de forma flexible: busca la fila de encabezados dentro de las
primeras filas y reconoce columnas como `Nombre completo`, `Nombre`, `Apellido`,
`Mesa asignada`, `Estado invitación`, `Teléfono`, `Correo`, `Grupo` y `Cupos`.
Reimportar la misma lista actualiza a los invitados existentes (se comparan por
nombre) en vez de duplicarlos.

## Estructura

```
app/[slug]/          sitio público de cada matrimonio (inicio, mesa, mensaje, foto, mapa)
app/admin/           panel: lista de matrimonios y administración de cada uno
app/api/eventos/     API por matrimonio (invitados, mensajes, fotos, mesa, QR)
components/          interfaz compartida
lib/                 base de datos, autenticación, archivos y lógica de eventos
public/design/       marco floral y textos del diseño
data/                base de datos y archivos subidos (no se versiona)
```

## Dónde se guardan los datos

El proyecto funciona igual en dos modos, según las variables de entorno:

| | Desarrollo (sin variables) | Producción |
|---|---|---|
| Base de datos | archivo `data/matrimonio.db` | Turso (`TURSO_DATABASE_URL`) |
| Imágenes | carpeta `data/uploads/` | Vercel Blob (store **privado**) |

En los dos casos la base guarda solo el nombre del archivo y las imágenes se
entregan por `/api/archivos/<nombre>`, nunca por una URL pública: las fotos que
suben los invitados no quedan expuestas a quien adivine la dirección.

En desarrollo todo queda en `data/`, así que copiar esa carpeta es el respaldo
completo. No se sube al repositorio.

## Acceso

- Las páginas de los invitados son públicas; no piden ninguna clave.
- Todo lo del panel (ver y editar invitados, leer mensajes, ver la galería) exige
  la cookie de sesión que entrega `ADMIN_PASSWORD`.
- Las fotos se guardan con un nombre aleatorio y solo se sirven por ese nombre.

## Despliegue en Vercel

Vercel no tiene disco donde escribir, por eso la base va a **Turso** (SQLite
alojado) y las imágenes a **Vercel Blob**.

1. **Base de datos.** Crea una cuenta en [turso.tech](https://turso.tech), crea
   una base y copia su URL (`libsql://…`) y un token de acceso.
2. **Imágenes.** En el panel de Vercel, pestaña *Storage* → *Create Database* →
   **Blob**, con acceso **Private**, y conéctalo al proyecto. Vercel agrega solas
   las credenciales. Ojo: el modo de acceso del store no se puede cambiar después
   de crearlo.
3. **Variables de entorno** del proyecto en Vercel (*Settings → Environment
   Variables*):

   ```
   ADMIN_PASSWORD=una-contraseña-larga-y-propia
   TURSO_DATABASE_URL=libsql://tu-base.turso.io
   TURSO_AUTH_TOKEN=el-token-de-turso
   ```

4. **Datos que ya tienes.** Si venías trabajando en local, sube esa base con:

   ```bash
   node scripts/subir-a-turso.mjs
   ```

   Lee `.env.local`, copia el esquema y las filas, y se niega a pisar una base
   remota que ya tenga invitados (usa `--forzar` para reemplazarla).

Las tablas se crean solas la primera vez, así que también puedes empezar de cero
sin ejecutar nada.

### Otros servidores

En un servidor con disco propio (VPS, Fly.io con volumen, Railway) no hace falta
nada de lo anterior: sin las variables de Turso y Blob, la base y las imágenes
quedan en `data/`.
