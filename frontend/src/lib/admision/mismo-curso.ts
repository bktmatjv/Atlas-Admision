/** Un curso del examen y su carpeta de apuntes se reconocen por el nombre, sin importar mayúsculas. */
export const mismoCurso = (a: string, b: string) =>
  a.trim().toLocaleLowerCase("es") === b.trim().toLocaleLowerCase("es");
