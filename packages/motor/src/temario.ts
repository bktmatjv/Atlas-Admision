/**
 * La lista cerrada de cursos y temas del examen de San Marcos. La IA solo puede
 * etiquetar con lo que hay aquí: un tema inventado descarta la pregunta.
 * Los nombres de curso coinciden con los de src/lib/onboarding/catalog.ts.
 */
export type Bloque = "actitudinal" | "verbal" | "logico_matematica" | "conocimientos";

export interface Tema {
  id: string;
  nombre: string;
}

export interface Curso {
  id: string;
  nombre: string;
  bloque: Bloque;
  temas: Tema[];
}

function temas(...pares: [string, string][]): Tema[] {
  return pares.map(([id, nombre]) => ({ id, nombre }));
}

export const CURSOS: Curso[] = [
  {
    id: "actitudinal", nombre: "Actitudinal", bloque: "actitudinal",
    temas: temas(["etica-y-valores", "Ética y valores"], ["convivencia", "Convivencia y ciudadanía"],
      ["vocacion-universitaria", "Vocación y vida universitaria"], ["resolucion-de-conflictos", "Resolución de conflictos"]),
  },
  {
    id: "habilidad-verbal", nombre: "Habilidad verbal", bloque: "verbal",
    temas: temas(["comprension-de-lectura", "Comprensión de lectura"], ["series-verbales", "Series verbales"],
      ["eliminacion-de-oraciones", "Eliminación de oraciones"], ["lectura-en-ingles", "Lectura en inglés"],
      ["textos-mixtos", "Textos mixtos e infografías"]),
  },
  {
    id: "habilidad-logico-matematica", nombre: "Habilidad lógico-matemática", bloque: "logico_matematica",
    temas: temas(["razonamiento-logico", "Razonamiento lógico"], ["sucesiones", "Sucesiones y analogías"],
      ["planteo-de-ecuaciones", "Planteo de ecuaciones"], ["conteo-y-probabilidad", "Conteo y probabilidad"],
      ["razonamiento-geometrico", "Razonamiento geométrico"], ["operadores-matematicos", "Operadores matemáticos"],
      ["interpretacion-de-graficos", "Interpretación de gráficos y tablas"], ["cronometria", "Cronometría y edades"]),
  },
  {
    id: "aritmetica", nombre: "Aritmética", bloque: "conocimientos",
    temas: temas(["numeracion", "Numeración"], ["divisibilidad", "Divisibilidad y números primos"],
      ["mcd-mcm", "MCD y MCM"], ["fracciones", "Fracciones y decimales"], ["razones-y-proporciones", "Razones y proporciones"],
      ["regla-de-tres", "Regla de tres y porcentajes"], ["interes", "Interés y mezclas"], ["estadistica", "Estadística"],
      ["probabilidades", "Probabilidades"], ["conjuntos", "Conjuntos y lógica"]),
  },
  {
    id: "algebra", nombre: "Álgebra", bloque: "conocimientos",
    temas: temas(["leyes-de-exponentes", "Leyes de exponentes"], ["polinomios", "Polinomios y productos notables"],
      ["factorizacion", "Factorización"], ["ecuaciones", "Ecuaciones"], ["inecuaciones", "Inecuaciones y valor absoluto"],
      ["sistemas", "Sistemas de ecuaciones"], ["funciones", "Funciones"], ["logaritmos", "Logaritmos y exponenciales"],
      ["matrices", "Matrices y determinantes"], ["sucesiones-y-series", "Sucesiones y series"]),
  },
  {
    id: "geometria", nombre: "Geometría", bloque: "conocimientos",
    temas: temas(["segmentos-y-angulos", "Segmentos y ángulos"], ["triangulos", "Triángulos"],
      ["poligonos", "Polígonos y cuadriláteros"], ["circunferencia", "Circunferencia"], ["semejanza", "Semejanza y relaciones métricas"],
      ["areas", "Áreas"], ["geometria-del-espacio", "Geometría del espacio"], ["geometria-analitica", "Geometría analítica"]),
  },
  {
    id: "trigonometria", nombre: "Trigonometría", bloque: "conocimientos",
    temas: temas(["angulos-trigonometricos", "Ángulos y sistemas de medida"], ["razones-trigonometricas", "Razones trigonométricas"],
      ["circunferencia-trigonometrica", "Circunferencia trigonométrica"], ["identidades", "Identidades"],
      ["ecuaciones-trigonometricas", "Ecuaciones trigonométricas"], ["resolucion-de-triangulos", "Resolución de triángulos"],
      ["funciones-trigonometricas", "Funciones trigonométricas"]),
  },
  {
    id: "lenguaje", nombre: "Lenguaje", bloque: "conocimientos",
    temas: temas(["comunicacion", "Comunicación y lenguaje"], ["fonetica-y-fonologia", "Fonética y fonología"],
      ["ortografia", "Ortografía y acentuación"], ["morfologia", "Morfología"], ["categorias-gramaticales", "Categorías gramaticales"],
      ["sintaxis", "Sintaxis de la oración"], ["semantica", "Semántica"], ["redaccion", "Redacción y puntuación"]),
  },
  {
    id: "literatura", nombre: "Literatura", bloque: "conocimientos",
    temas: temas(["teoria-literaria", "Teoría literaria"], ["literatura-universal", "Literatura universal"],
      ["literatura-espanola", "Literatura española"], ["literatura-hispanoamericana", "Literatura hispanoamericana"],
      ["literatura-peruana", "Literatura peruana"]),
  },
  {
    id: "psicologia", nombre: "Psicología", bloque: "conocimientos",
    temas: temas(["psicologia-como-ciencia", "Psicología como ciencia"], ["bases-biologicas", "Bases biológicas de la conducta"],
      ["sensacion-y-percepcion", "Sensación y percepción"], ["aprendizaje-y-memoria", "Aprendizaje y memoria"],
      ["pensamiento-e-inteligencia", "Pensamiento e inteligencia"], ["motivacion-y-emocion", "Motivación y emoción"],
      ["personalidad", "Personalidad"], ["desarrollo-humano", "Desarrollo humano"], ["salud-mental", "Salud mental y sexualidad"]),
  },
  {
    id: "educacion-civica", nombre: "Educación Cívica", bloque: "conocimientos",
    temas: temas(["derechos-humanos", "Derechos humanos"], ["constitucion-y-estado", "Constitución y Estado"],
      ["ciudadania-y-participacion", "Ciudadanía y participación"], ["defensa-nacional", "Seguridad y defensa nacional"],
      ["organismos-internacionales", "Organismos internacionales"], ["identidad-y-diversidad", "Identidad y diversidad cultural"]),
  },
  {
    id: "historia-del-peru", nombre: "Historia del Perú", bloque: "conocimientos",
    temas: temas(["peru-prehispanico", "Perú prehispánico"], ["incas", "Los incas"], ["conquista-y-virreinato", "Conquista y virreinato"],
      ["independencia", "Emancipación e independencia"], ["republica-siglo-xix", "República en el siglo XIX"],
      ["siglo-xx", "Perú en el siglo XX"], ["peru-contemporaneo", "Perú contemporáneo"]),
  },
  {
    id: "historia-universal", nombre: "Historia Universal", bloque: "conocimientos",
    temas: temas(["prehistoria-y-antiguedad", "Prehistoria y antigüedad"], ["grecia-y-roma", "Grecia y Roma"],
      ["edad-media", "Edad Media"], ["edad-moderna", "Edad Moderna"], ["revoluciones", "Revoluciones y siglo XIX"],
      ["guerras-mundiales", "Guerras mundiales"], ["mundo-contemporaneo", "Mundo contemporáneo"]),
  },
  {
    id: "geografia", nombre: "Geografía", bloque: "conocimientos",
    temas: temas(["cartografia", "Cartografía y orientación"], ["universo-y-tierra", "Universo y la Tierra"],
      ["relieve", "Relieve y geomorfología"], ["clima-y-ecosistemas", "Clima y ecosistemas"], ["hidrografia", "Hidrografía"],
      ["recursos-y-ambiente", "Recursos naturales y ambiente"], ["poblacion", "Población y territorio"], ["geografia-del-peru", "Regiones del Perú"]),
  },
  {
    id: "economia", nombre: "Economía", bloque: "conocimientos",
    temas: temas(["conceptos-basicos", "Necesidades, bienes y factores"], ["mercado", "Mercado, oferta y demanda"],
      ["empresa-y-costos", "Empresa y costos"], ["dinero-y-banca", "Dinero, banca e inflación"],
      ["comercio-internacional", "Comercio internacional"], ["cuentas-nacionales", "PBI y cuentas nacionales"],
      ["sector-publico", "Sector público y tributos"]),
  },
  {
    id: "filosofia", nombre: "Filosofía", bloque: "conocimientos",
    temas: temas(["introduccion", "Introducción a la filosofía"], ["filosofia-antigua", "Filosofía antigua"],
      ["filosofia-medieval-y-moderna", "Filosofía medieval y moderna"], ["filosofia-contemporanea", "Filosofía contemporánea"],
      ["logica", "Lógica"], ["etica", "Ética"], ["epistemologia", "Epistemología"], ["estetica", "Estética"]),
  },
  {
    id: "fisica", nombre: "Física", bloque: "conocimientos",
    temas: temas(["analisis-dimensional-y-vectores", "Análisis dimensional y vectores"], ["cinematica", "Cinemática"],
      ["estatica", "Estática"], ["dinamica", "Dinámica"], ["trabajo-y-energia", "Trabajo, energía y potencia"],
      ["hidrostatica", "Hidrostática"], ["calor", "Calor y termodinámica"], ["electricidad", "Electrostática y electrodinámica"],
      ["magnetismo", "Magnetismo"], ["ondas-y-optica", "Ondas y óptica"], ["fisica-moderna", "Física moderna"]),
  },
  {
    id: "quimica", nombre: "Química", bloque: "conocimientos",
    temas: temas(["materia", "Materia y energía"], ["estructura-atomica", "Estructura atómica"], ["tabla-periodica", "Tabla periódica"],
      ["enlace-quimico", "Enlace químico"], ["nomenclatura", "Nomenclatura inorgánica"], ["reacciones", "Reacciones químicas"],
      ["estequiometria", "Estequiometría"], ["gases", "Gases"], ["soluciones", "Soluciones"], ["equilibrio-y-acidos", "Equilibrio, ácidos y bases"],
      ["electroquimica", "Electroquímica"], ["quimica-organica", "Química orgánica"]),
  },
  {
    id: "biologia", nombre: "Biología", bloque: "conocimientos",
    temas: temas(["bioquimica", "Bioquímica"], ["celula", "Célula"], ["metabolismo", "Metabolismo celular"],
      ["division-celular", "División celular"], ["genetica", "Genética"], ["evolucion", "Evolución"], ["taxonomia", "Taxonomía y biodiversidad"],
      ["botanica", "Botánica"], ["anatomia-y-fisiologia", "Anatomía y fisiología humana"], ["salud-y-enfermedad", "Salud y enfermedad"],
      ["ecologia", "Ecología"]),
  },
];

export function cursoPorId(id: string): Curso | undefined {
  return CURSOS.find((c) => c.id === id);
}

export function temaValido(cursoId: string, temaId: string): boolean {
  return cursoPorId(cursoId)?.temas.some((t) => t.id === temaId) ?? false;
}

/** La IA a veces copia el formato del prompt («geometria: circunferencia», o una lista de temas): se queda el
 *  curso antes de los dos puntos y el primer tema después. */
export function limpiarClasificacion(curso: string, tema: string): { curso: string; tema: string } {
  const sinCurso = tema.includes(":") ? tema.slice(tema.indexOf(":") + 1) : tema;
  return { curso: curso.split(":")[0].trim(), tema: sinCurso.split(",")[0].trim() };
}

/** Una línea por curso, «curso: tema1, tema2…», para pegar en el prompt. */
export function temarioParaPrompt(): string {
  return CURSOS.map((c) => `${c.id}: ${c.temas.map((t) => t.id).join(", ")}`).join("\n");
}
