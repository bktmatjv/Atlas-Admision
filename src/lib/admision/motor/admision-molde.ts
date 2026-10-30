/**
 * El molde del examen de San Marcos 2026-I por área (spec §3), copiado de src/lib/onboarding/catalog.ts
 * porque src/ no se despliega con las edge functions. admision-molde.test.ts exige que coincidan.
 * Letras (cabecera de los cuadernillos): A = Ciencias de la Salud, B = Básicas, C = Ingenierías,
 * D = Económicas y de la Gestión, E = Humanidades y Ciencias Jurídicas y Sociales. Medicina usa A.
 */
/**
 * De dónde sale el molde: la estructura publicada para 2026-I. Coincide curso a curso con la de Audix Admisión.
 * El reglamento oficial solo se descarga pagando: por verificar (scripts/admision/unmsm/FUENTES.md).
 */
export const MOLDE_FUENTE = {
  fuente: "Infobae, 15-08-2025 (2026-I, preguntas por curso y área) y 23-02-2026 (3 horas)",
  verificado: false,
} as const;

export type AreaExamen = "A" | "B" | "C" | "D" | "E" | "medicina";
export interface Hueco { curso: string; preguntas: number }

export const MOLDE_COMUN: Hueco[] = [
  { curso: "actitudinal", preguntas: 10 },
  { curso: "habilidad-verbal", preguntas: 10 },
  { curso: "habilidad-logico-matematica", preguntas: 10 },
];

export const MOLDES: Record<Exclude<AreaExamen, "medicina">, Hueco[]> = {
  A: [
    { curso: "biologia", preguntas: 8 },
    { curso: "quimica", preguntas: 7 },
    { curso: "lenguaje", preguntas: 7 },
    { curso: "psicologia", preguntas: 6 },
    { curso: "fisica", preguntas: 5 },
    { curso: "aritmetica", preguntas: 4 },
    { curso: "literatura", preguntas: 4 },
    { curso: "educacion-civica", preguntas: 4 },
    { curso: "geografia", preguntas: 4 },
    { curso: "economia", preguntas: 4 },
    { curso: "filosofia", preguntas: 4 },
    { curso: "geometria", preguntas: 3 },
    { curso: "algebra", preguntas: 3 },
    { curso: "historia-del-peru", preguntas: 3 },
    { curso: "trigonometria", preguntas: 2 },
    { curso: "historia-universal", preguntas: 2 },
  ],
  B: [
    { curso: "fisica", preguntas: 7 },
    { curso: "quimica", preguntas: 7 },
    { curso: "biologia", preguntas: 7 },
    { curso: "lenguaje", preguntas: 6 },
    { curso: "aritmetica", preguntas: 4 },
    { curso: "geometria", preguntas: 4 },
    { curso: "algebra", preguntas: 4 },
    { curso: "literatura", preguntas: 4 },
    { curso: "psicologia", preguntas: 4 },
    { curso: "educacion-civica", preguntas: 4 },
    { curso: "geografia", preguntas: 4 },
    { curso: "economia", preguntas: 4 },
    { curso: "filosofia", preguntas: 4 },
    { curso: "trigonometria", preguntas: 3 },
    { curso: "historia-del-peru", preguntas: 2 },
    { curso: "historia-universal", preguntas: 2 },
  ],
  C: [
    { curso: "fisica", preguntas: 7 },
    { curso: "lenguaje", preguntas: 7 },
    { curso: "quimica", preguntas: 6 },
    { curso: "biologia", preguntas: 6 },
    { curso: "aritmetica", preguntas: 4 },
    { curso: "geometria", preguntas: 4 },
    { curso: "algebra", preguntas: 4 },
    { curso: "literatura", preguntas: 4 },
    { curso: "psicologia", preguntas: 4 },
    { curso: "educacion-civica", preguntas: 4 },
    { curso: "geografia", preguntas: 4 },
    { curso: "economia", preguntas: 4 },
    { curso: "filosofia", preguntas: 4 },
    { curso: "trigonometria", preguntas: 3 },
    { curso: "historia-del-peru", preguntas: 3 },
    { curso: "historia-universal", preguntas: 2 },
  ],
  D: [
    { curso: "lenguaje", preguntas: 8 },
    { curso: "economia", preguntas: 8 },
    { curso: "psicologia", preguntas: 6 },
    { curso: "aritmetica", preguntas: 4 },
    { curso: "geometria", preguntas: 4 },
    { curso: "algebra", preguntas: 4 },
    { curso: "literatura", preguntas: 4 },
    { curso: "educacion-civica", preguntas: 4 },
    { curso: "geografia", preguntas: 4 },
    { curso: "filosofia", preguntas: 4 },
    { curso: "fisica", preguntas: 4 },
    { curso: "quimica", preguntas: 4 },
    { curso: "biologia", preguntas: 4 },
    { curso: "historia-del-peru", preguntas: 3 },
    { curso: "historia-universal", preguntas: 3 },
    { curso: "trigonometria", preguntas: 2 },
  ],
  E: [
    { curso: "lenguaje", preguntas: 8 },
    { curso: "literatura", preguntas: 6 },
    { curso: "psicologia", preguntas: 6 },
    { curso: "filosofia", preguntas: 6 },
    { curso: "historia-del-peru", preguntas: 5 },
    { curso: "historia-universal", preguntas: 5 },
    { curso: "geografia", preguntas: 5 },
    { curso: "economia", preguntas: 5 },
    { curso: "educacion-civica", preguntas: 4 },
    { curso: "fisica", preguntas: 4 },
    { curso: "quimica", preguntas: 4 },
    { curso: "biologia", preguntas: 4 },
    { curso: "aritmetica", preguntas: 2 },
    { curso: "geometria", preguntas: 2 },
    { curso: "algebra", preguntas: 2 },
    { curso: "trigonometria", preguntas: 2 },
  ],
};

export function moldeDe(area: AreaExamen): Hueco[] {
  return [...MOLDE_COMUN, ...MOLDES[area === "medicina" ? "A" : area]];
}
