// Columnas de la planilla de participantes: las usa la plantilla vacía y la
// descarga con datos. Los encabezados calzan con lo que entiende la
// importación, así que la misma planilla se puede editar y volver a subir.
export const COLUMNAS_PLANILLA = [
  { header: "Nombre", key: "nombre", width: 30 },
  { header: "Telefono", key: "telefono", width: 16 },
  { header: "Email", key: "email", width: 28 },
  { header: "Grupo", key: "grupo", width: 20 },
  { header: "Sector", key: "mesa", width: 12 },
  { header: "Cupos", key: "cupos", width: 8 },
  { header: "Estado", key: "estado", width: 12 },
  { header: "Asistentes", key: "asistentes", width: 11 },
  { header: "Nota", key: "nota", width: 30 },
  { header: "Actualizado", key: "actualizado", width: 20 },
];

export const EJEMPLO_PLANILLA = {
  nombre: "Ej: María Pérez",
  telefono: "+56 9 1234 5678",
  email: "maria@ejemplo.com",
  grupo: "Familia",
  mesa: "1",
  cupos: 2,
  estado: "pendiente",
  asistentes: 0,
  nota: "",
  actualizado: "",
};
