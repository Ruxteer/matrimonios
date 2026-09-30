# Venito: matrimonios y activaciones

Sitio web para matrimonios y activaciones: los participantes escanean un QR y encuentran todo lo del
evento en su teléfono. Un mismo despliegue atiende a varias bodas: cada una tiene
su propia dirección, su QR, sus invitados, sus colores y sus módulos.

## Módulos

El sitio de cada matrimonio se arma con módulos que se encienden y ordenan desde
el panel (pestaña **Módulos**). Ninguno es obligatorio:

| Módulo | Qué hace | Dirección |
|---|---|---|
| Registro | Contactos, consentimientos y confirmación sin cuenta | `/<evento>/registro` |
| Mesa | Cada invitado busca su nombre y ve su mesa | `/<boda>/mesa` |
| Mensajes | Saludos escritos para los novios | `/<boda>/mensaje` |
| Fotos | Galería colaborativa | `/<boda>/foto` |
| Mapa | El plano del lugar (necesita una imagen subida) | `/<boda>/mapa` |
| Agenda | El programa del día | `/<boda>/agenda` |
| Encuestas | Preguntas configurables y sus resultados | `/<boda>/encuesta` |
| Votaciones | Alternativas, votos y resultados en vivo | `/<boda>/votacion` |
| Sorteos | Ganadores al azar entre invitados o participantes | `/<boda>/sorteo` |
| Trivia | Juego de preguntas con puntaje y ranking | `/<boda>/trivia` |

Un módulo apagado desaparece del inicio, de los atajos y del panel, y su
dirección responde 404. Los módulos nuevos que se agreguen al producto aparecen
apagados en las bodas que ya existían (ver `lib/modulos.ts`).

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
3. En **Módulos** eliges qué ve el invitado y en qué orden: enciendes o apagas
   cada módulo y lo subes o bajas en la lista.
4. En **Ajustes** puedes cambiar los nombres, la fecha, la dirección web, la
   **paleta de colores** (hay paletas listas o los cinco colores a mano, con
   vista previa), subir un banner propio y el plano del lugar, y descargar el
   **QR** en PNG o SVG para imprimirlo.
5. Cada módulo encendido tiene su pestaña en el panel para cargar su contenido
   (actividades de la agenda, encuestas, votaciones, sorteos, trivia).
6. Los invitados escanean ese QR y llegan al sitio de esa boda.

El Excel se lee de forma flexible: busca la fila de encabezados dentro de las
primeras filas y reconoce columnas como `Nombre completo`, `Nombre`, `Apellido`,
`Mesa asignada`, `Estado invitación`, `Teléfono`, `Correo`, `Grupo` y `Cupos`.
Reimportar la misma lista actualiza a los invitados existentes (se comparan por
nombre) en vez de duplicarlos.

## Estructura

```
app/[slug]/          sitio público de cada matrimonio (una carpeta por módulo)
app/admin/           panel: lista de matrimonios y administración de cada uno
app/api/eventos/     API por matrimonio (invitados, QR y el contenido de cada módulo)
components/          interfaz compartida (components/admin/ es el panel)
lib/modulos.ts       catálogo de módulos: agregar uno aquí lo deja disponible en el panel
lib/                 base de datos, autenticación, archivos, colores y lógica de eventos
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
entregan por `/api/archivos/<nombre>` con comprobación de acceso para fotografías.
Los banners y planos asociados al evento son públicos.

En desarrollo todo queda en `data/`, así que copiar esa carpeta es el respaldo
completo. No se sube al repositorio.

## Acceso

- Las páginas de los invitados son públicas; no piden ninguna clave.
- Todo lo del panel (ver y editar invitados, leer mensajes, ver la galería) exige
  la cookie de sesión que entrega `ADMIN_PASSWORD`.
- Las fotos solo se entregan al panel autorizado, al participante que las subió o a la pantalla con su enlace válido (solo aprobadas).

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

## Registro Venito y activaciones

Además de matrimonios, el panel permite crear una **Activación de marca o evento**.
Estas experiencias usan un título y un mensaje propios, banners para móvil y
escritorio, colores configurables y el mismo QR. Al activar **Registro**, el QR
abre directamente el formulario en las activaciones. En matrimonios, Registro
aparece como un módulo más.

### Diseño Corrida Carozzi

Las activaciones usan una interfaz sans serif con colores azules, tarjetas claras
sobre el banner y botones grandes para el celular. En **Ajustes**, **Usar diseño
Corrida Carozzi** carga la identidad de la referencia; guarda los cambios para
aplicarla. El registro y el paso de compartir foto muestran banners distintos.
La pantalla en vivo usa la misma identidad y conserva el QR visible.

Los archivos `public/design/carozzi-registro.webp` y `carozzi-foto.webp` son
recortes de las imágenes incluidas en las páginas 5 y 6 de `ppto venito - Tpg.pdf`.
`carozzi-corredora.webp` es un recorte de esa referencia para pruebas visuales.
Los formularios son componentes reales y accesibles, no imágenes del mockup.
La marca se aplica de forma explícita desde el preset: otras activaciones pueden
usar sus propios banners y colores. La identidad de los matrimonios se conserva.

### Preparar una experiencia

1. Crea el evento en `/admin` y configura su identidad en **Ajustes**.
2. En **Módulos**, activa Registro y, si corresponde, Fotos.
3. En **Participantes y registro**, configura el formulario, los campos adicionales,
   el mensaje de confirmación y las instrucciones siguientes.
4. Añade los enlaces reales a Términos y Condiciones y Política de Privacidad y
   el texto de consentimiento aprobado por el organizador. Sin esos enlaces,
   el formulario no admite registros. No se generan documentos legales.
5. Define si pedir teléfono, fechas de apertura/cierre, cupo de participantes,
   límite de fotos (por defecto una), asociación al registro y moderación.
   Las fechas se introducen en la zona horaria del navegador y se guardan en UTC.
6. Prueba el QR y el flujo con datos de prueba antes de abrir la experiencia.

Los participantes no crean una cuenta ni una contraseña. El registro usa una
cookie privada en ese navegador para vincular sus fotos. El mismo correo no crea
registros duplicados dentro del evento. Si se pierde esa cookie, escribir el
correo de otra persona no concede acceso a sus datos ni a su registro.

El consentimiento obligatorio para participar se conserva junto con el texto
aceptado y la fecha. Las opciones para recibir información/fotos y marketing
son independientes y comienzan desmarcadas. **Se guardan contactos y permisos;
esta versión no envía correos, WhatsApp ni álbumes automáticamente.** El panel
permite descargar Excel y CSV para el proceso de comunicación que configure
el organizador.

### Fotografías y pantalla en vivo

Las nuevas fotos pasan por moderación de forma predeterminada. En **Fotos** se
pueden aprobar, rechazar, eliminar y descargar individualmente o como ZIP.
La pantalla en vivo muestra únicamente fotos aprobadas. Las fotos antiguas
conservan el estado aprobado al migrar la base.

Cuando Registro y la asociación están activos, se requiere completar el registro
antes de subir una imagen. El límite se aplica en el servidor, incluso ante
cargas simultáneas. La cámara y la galería del dispositivo son accesos separados.
El panel sigue protegido por su clave; los participantes acceden sin login.

### Operación antes de un evento real

El código sigue usando Turso y Vercel Blob en cloud, o SQLite y disco local para
pruebas. Esta actualización no aprovisiona infraestructura ni cambia un despliegue.
Antes de operar, el responsable debe definir volumen, concurrencia, duración,
almacenamiento y política de conservación, que el presupuesto deja por confirmar.

- Base y archivos deben respaldarse juntos. Para una base local en uso, utiliza
  el mecanismo de backup de SQLite; evita copiar solo el archivo principal mientras
  hay escrituras. En cloud, configura y verifica los respaldos del proveedor.
- Verifica la restauración en un entorno separado y conserva los originales.
- Activa alertas del hosting para errores HTTP, latencia y almacenamiento. El
  endpoint `/api/health` comprueba disponibilidad de la base sin exponer datos.
- Realiza una prueba de carga con la concurrencia acordada y verifica cuotas del
  proveedor, límites de tamaño y tiempo de las peticiones y descarga de archivos.
- Asigna a una persona la moderación y el soporte durante la jornada. La pantalla
  física y la conectividad del recinto requieren preparación propia.

No se han asumido garantías de concurrencia ni períodos de monitoreo que el
presupuesto no especifica.

### Verificación local

Las pruebas de integración solo aceptan una URL local y crean y eliminan sus
propios eventos de prueba. Inicia una instancia con una **base descartable** y
una clave distinta de producción. No cargues las variables de Turso/Blob reales.

```bash
ADMIN_PASSWORD=clave-solo-para-pruebas npm run dev -- --port 3106
# En otra terminal:
REGISTRO_TEST_URL=http://127.0.0.1:3106 REGISTRO_TEST_PASSWORD=clave-solo-para-pruebas npm run test:registro
VENITO_TEST_URL=http://127.0.0.1:3106 VENITO_TEST_PASSWORD=clave-solo-para-pruebas npm run test:flow
npm run typecheck
npm run lint
npm run build
```

Las pruebas cubren validación, consentimiento, aislamiento entre eventos,
duplicados, cupos simultáneos, exportaciones privadas y el recorrido desde el
registro hasta la aprobación de la fotografía en pantalla. La carga de imágenes
admite hasta **4 MB** por archivo; la descarga ZIP se transmite progresivamente.
