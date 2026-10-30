/**
 * Universidades, carreras y la estructura real de los exámenes de admisión.
 *
 * **Los pesos de esta tabla no son inventados.** Son la cantidad de preguntas que cada
 * asignatura tiene en el Examen General de Admisión de la UNMSM 2026-I, por área
 * académico-profesional. Eso importa porque el flujo le promete al postulante que Atlas
 * «prioriza los temas con más peso en tu examen»: si el peso fuera un número redondeado a
 * ojo, la promesa sería decorado. Con la distribución real, priorizar significa
 * literalmente empezar por Biología si postulas a Salud —8 preguntas— y no por
 * Trigonometría —2—.
 *
 * Fuente: estructura publicada del examen UNMSM 2026-I. 100 preguntas totales = 30 de las
 * secciones comunes (actitudinal, habilidad verbal, habilidad lógico-matemática) + 70 de
 * conocimientos repartidas entre 16 asignaturas según el área.
 *
 * Para las universidades que no son la UNMSM se usa el área equivalente, y la interfaz lo
 * dice —ver `structureNote`—. Es una aproximación razonable, porque los exámenes de
 * admisión peruanos comparten asignaturas y reparto dentro de una misma área, pero
 * presentarla como dato exacto de esa universidad sería mentir.
 */

/** Área académico-profesional. Son las cinco de la UNMSM. */
export type AreaId = "salud" | "basicas" | "ingenieria" | "economicas" | "humanidades";

export interface Subject {
  name: string;
  /** Preguntas que esta asignatura tiene en el examen del área. */
  questions: number;
}

export interface Area {
  id: AreaId;
  label: string;
  subjects: Subject[];
}

/** Las tres secciones que van iguales en todas las áreas: 30 preguntas. */
export const COMMON_SECTIONS: Subject[] = [
  { name: "Actitudinal", questions: 10 },
  { name: "Habilidad verbal", questions: 10 },
  { name: "Habilidad lógico-matemática", questions: 10 },
];

export const AREAS: Record<AreaId, Area> = {
  salud: {
    id: "salud",
    label: "Ciencias de la Salud",
    subjects: [
      { name: "Biología", questions: 8 },
      { name: "Química", questions: 7 },
      { name: "Lenguaje", questions: 7 },
      { name: "Psicología", questions: 6 },
      { name: "Física", questions: 5 },
      { name: "Aritmética", questions: 4 },
      { name: "Literatura", questions: 4 },
      { name: "Educación Cívica", questions: 4 },
      { name: "Geografía", questions: 4 },
      { name: "Economía", questions: 4 },
      { name: "Filosofía", questions: 4 },
      { name: "Geometría", questions: 3 },
      { name: "Álgebra", questions: 3 },
      { name: "Historia del Perú", questions: 3 },
      { name: "Trigonometría", questions: 2 },
      { name: "Historia Universal", questions: 2 },
    ],
  },
  basicas: {
    id: "basicas",
    label: "Ciencias Básicas",
    subjects: [
      { name: "Física", questions: 7 },
      { name: "Química", questions: 7 },
      { name: "Biología", questions: 7 },
      { name: "Lenguaje", questions: 6 },
      { name: "Aritmética", questions: 4 },
      { name: "Geometría", questions: 4 },
      { name: "Álgebra", questions: 4 },
      { name: "Literatura", questions: 4 },
      { name: "Psicología", questions: 4 },
      { name: "Educación Cívica", questions: 4 },
      { name: "Geografía", questions: 4 },
      { name: "Economía", questions: 4 },
      { name: "Filosofía", questions: 4 },
      { name: "Trigonometría", questions: 3 },
      { name: "Historia del Perú", questions: 2 },
      { name: "Historia Universal", questions: 2 },
    ],
  },
  ingenieria: {
    id: "ingenieria",
    label: "Ingenierías",
    subjects: [
      { name: "Física", questions: 7 },
      { name: "Lenguaje", questions: 7 },
      { name: "Química", questions: 6 },
      { name: "Biología", questions: 6 },
      { name: "Aritmética", questions: 4 },
      { name: "Geometría", questions: 4 },
      { name: "Álgebra", questions: 4 },
      { name: "Literatura", questions: 4 },
      { name: "Psicología", questions: 4 },
      { name: "Educación Cívica", questions: 4 },
      { name: "Geografía", questions: 4 },
      { name: "Economía", questions: 4 },
      { name: "Filosofía", questions: 4 },
      { name: "Trigonometría", questions: 3 },
      { name: "Historia del Perú", questions: 3 },
      { name: "Historia Universal", questions: 2 },
    ],
  },
  economicas: {
    id: "economicas",
    label: "Ciencias Económicas y de la Gestión",
    subjects: [
      { name: "Lenguaje", questions: 8 },
      { name: "Economía", questions: 8 },
      { name: "Psicología", questions: 6 },
      { name: "Aritmética", questions: 4 },
      { name: "Geometría", questions: 4 },
      { name: "Álgebra", questions: 4 },
      { name: "Literatura", questions: 4 },
      { name: "Educación Cívica", questions: 4 },
      { name: "Geografía", questions: 4 },
      { name: "Filosofía", questions: 4 },
      { name: "Física", questions: 4 },
      { name: "Química", questions: 4 },
      { name: "Biología", questions: 4 },
      { name: "Historia del Perú", questions: 3 },
      { name: "Historia Universal", questions: 3 },
      { name: "Trigonometría", questions: 2 },
    ],
  },
  humanidades: {
    id: "humanidades",
    label: "Humanidades y Ciencias Jurídicas y Sociales",
    subjects: [
      { name: "Lenguaje", questions: 8 },
      { name: "Literatura", questions: 6 },
      { name: "Psicología", questions: 6 },
      { name: "Filosofía", questions: 6 },
      { name: "Historia del Perú", questions: 5 },
      { name: "Historia Universal", questions: 5 },
      { name: "Geografía", questions: 5 },
      { name: "Economía", questions: 5 },
      { name: "Educación Cívica", questions: 4 },
      { name: "Física", questions: 4 },
      { name: "Química", questions: 4 },
      { name: "Biología", questions: 4 },
      { name: "Aritmética", questions: 2 },
      { name: "Geometría", questions: 2 },
      { name: "Álgebra", questions: 2 },
      { name: "Trigonometría", questions: 2 },
    ],
  },
};

export interface Career {
  id: string;
  name: string;
  area: AreaId;
}

export const CAREERS: Career[] = [
  { id: "medicina", name: "Medicina Humana", area: "salud" },
  { id: "enfermeria", name: "Enfermería", area: "salud" },
  { id: "odontologia", name: "Odontología", area: "salud" },
  { id: "psicologia", name: "Psicología", area: "salud" },
  { id: "nutricion", name: "Nutrición", area: "salud" },
  { id: "farmacia", name: "Farmacia y Bioquímica", area: "salud" },
  { id: "veterinaria", name: "Medicina Veterinaria", area: "salud" },
  { id: "obstetricia", name: "Obstetricia", area: "salud" },

  { id: "matematica", name: "Matemática", area: "basicas" },
  { id: "fisica", name: "Física", area: "basicas" },
  { id: "quimica", name: "Química", area: "basicas" },
  { id: "biologia", name: "Ciencias Biológicas", area: "basicas" },

  { id: "ing-sistemas", name: "Ingeniería de Sistemas", area: "ingenieria" },
  { id: "ing-civil", name: "Ingeniería Civil", area: "ingenieria" },
  { id: "ing-industrial", name: "Ingeniería Industrial", area: "ingenieria" },
  { id: "ing-mecanica", name: "Ingeniería Mecánica", area: "ingenieria" },
  { id: "ing-electronica", name: "Ingeniería Electrónica", area: "ingenieria" },
  { id: "ing-ambiental", name: "Ingeniería Ambiental", area: "ingenieria" },
  { id: "ing-software", name: "Ingeniería de Software", area: "ingenieria" },
  { id: "arquitectura", name: "Arquitectura", area: "ingenieria" },

  { id: "administracion", name: "Administración", area: "economicas" },
  { id: "contabilidad", name: "Contabilidad", area: "economicas" },
  { id: "economia", name: "Economía", area: "economicas" },
  { id: "marketing", name: "Marketing", area: "economicas" },
  { id: "negocios", name: "Negocios Internacionales", area: "economicas" },

  { id: "derecho", name: "Derecho", area: "humanidades" },
  { id: "comunicacion", name: "Ciencias de la Comunicación", area: "humanidades" },
  { id: "educacion", name: "Educación", area: "humanidades" },
  { id: "literatura", name: "Literatura", area: "humanidades" },
  { id: "historia", name: "Historia", area: "humanidades" },
  { id: "sociologia", name: "Sociología", area: "humanidades" },
];

export interface University {
  id: string;
  name: string;
  /** Sigla, para los escudos del interstitial y el resumen del formulario. */
  short: string;
  careers: string[];
  /**
   * `true` si los pesos que mostramos son los de su propio examen. En las demás, la
   * interfaz avisa de que la estructura es la de referencia del área.
   */
  ownStructure?: boolean;
}

const TODAS = CAREERS.map((c) => c.id);
const DE_AREA = (...areas: AreaId[]) =>
  CAREERS.filter((c) => areas.includes(c.area)).map((c) => c.id);

export const UNIVERSITIES: University[] = [
  {
    id: "unmsm",
    name: "Universidad Nacional Mayor de San Marcos",
    short: "UNMSM",
    careers: TODAS,
    ownStructure: true,
  },
  { id: "uni", name: "Universidad Nacional de Ingeniería", short: "UNI", careers: DE_AREA("ingenieria", "basicas") },
  { id: "unfv", name: "Universidad Nacional Federico Villarreal", short: "UNFV", careers: TODAS },
  { id: "pucp", name: "Pontificia Universidad Católica del Perú", short: "PUCP", careers: TODAS },
  { id: "unalm", name: "Universidad Nacional Agraria La Molina", short: "UNALM", careers: DE_AREA("basicas", "ingenieria") },
  { id: "uncp", name: "Universidad Nacional del Centro del Perú", short: "UNCP", careers: TODAS },
  { id: "unt", name: "Universidad Nacional de Trujillo", short: "UNT", careers: TODAS },
  { id: "unsa", name: "Universidad Nacional de San Agustín", short: "UNSA", careers: TODAS },
  { id: "upc", name: "Universidad Peruana de Ciencias Aplicadas", short: "UPC", careers: TODAS },
  { id: "ulima", name: "Universidad de Lima", short: "ULima", careers: TODAS },
  { id: "usmp", name: "Universidad de San Martín de Porres", short: "USMP", careers: TODAS },
  { id: "cayetano", name: "Universidad Peruana Cayetano Heredia", short: "UPCH", careers: DE_AREA("salud") },
];

export function findUniversity(id: string | null): University | null {
  return UNIVERSITIES.find((u) => u.id === id) ?? null;
}

export function findCareer(id: string | null): Career | null {
  return CAREERS.find((c) => c.id === id) ?? null;
}

/** Las carreras que ofrece una universidad, en el orden del catálogo. */
export function careersFor(universityId: string | null): Career[] {
  const university = findUniversity(universityId);
  if (!university) return [];
  const offered = new Set(university.careers);
  return CAREERS.filter((c) => offered.has(c.id));
}

export function areaFor(careerId: string | null): Area | null {
  const career = findCareer(careerId);
  return career ? AREAS[career.area] : null;
}

/**
 * Las asignaturas del examen, **de más peso a menos**, con las secciones comunes al final.
 *
 * El orden es el corazón de la priorización: recorrer esta lista de arriba abajo es
 * exactamente lo que significa «empezar por lo que más pesa». Las comunes van al final no
 * por ser menos importantes —30 de 100 preguntas es mucho— sino porque no dependen del
 * temario que hay que estudiar: son habilidad, se entrenan en paralelo.
 */
export function subjectsByWeight(careerId: string | null): Subject[] {
  const area = areaFor(careerId);
  if (!area) return [];
  return [...area.subjects].sort((a, b) => b.questions - a.questions);
}

/** Preguntas de conocimientos del área: 70 en la estructura de la UNMSM. */
export function knowledgeQuestions(careerId: string | null): number {
  const area = areaFor(careerId);
  return area ? area.subjects.reduce((sum, s) => sum + s.questions, 0) : 0;
}

/** Preguntas del examen completo, comunes incluidas: 100. */
export function totalQuestions(careerId: string | null): number {
  const knowledge = knowledgeQuestions(careerId);
  if (knowledge === 0) return 0;
  return knowledge + COMMON_SECTIONS.reduce((sum, s) => sum + s.questions, 0);
}

/**
 * Aviso a pie de plan cuando los pesos no son los de esa universidad.
 *
 * Se muestra en la interfaz. Callarlo sería dejar creer que tenemos el prospecto de las
 * doce universidades, y el primero que compare con el suyo descubriría que no.
 */
export function structureNote(universityId: string | null): string | null {
  const university = findUniversity(universityId);
  if (!university || university.ownStructure) return null;
  return `Estructura de referencia del área, basada en el examen de la UNMSM. La de ${university.short} puede variar.`;
}
