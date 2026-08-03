# Matrimonios

Sitio web para matrimonios: los invitados escanean un QR y pueden buscar su mesa,
dejar un mensaje a los novios, subir fotos y ver el plano del lugar. Un mismo
despliegue atiende a varias bodas: cada una tiene su propia dirección, su QR, sus
invitados y sus colores.

## Requisitos

- **Node.js 20 o superior** (probado en 22). Con Node 18 Next 16 no arranca.
- No hace falta base de datos aparte: usa SQLite en un archivo local.

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

## Datos y respaldos

Todo lo importante vive en la carpeta `data/`: la base `matrimonio.db` y las
imágenes subidas en `data/uploads/`. **Copiar esa carpeta es el respaldo completo
del evento.** No se sube al repositorio.

## Acceso

- Las páginas de los invitados son públicas; no piden ninguna clave.
- Todo lo del panel (ver y editar invitados, leer mensajes, ver la galería) exige
  la cookie de sesión que entrega `ADMIN_PASSWORD`.
- Las fotos se guardan con un nombre aleatorio y solo se sirven por ese nombre.

## Despliegue

El proyecto guarda la base y las fotos en el disco local, así que necesita un
servidor con almacenamiento persistente (VPS, Fly.io con volumen, Railway o
similar). En plataformas serverless sin disco, como Vercel, se perderían los
datos entre despliegues.

Recuerda definir `ADMIN_PASSWORD` en el entorno del servidor y respaldar `data/`
con regularidad.
