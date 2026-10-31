import { describe, it, expect } from "vitest";
import {
  validarTurno,
  type ContextoValidacion,
} from "../src/modules/tutor/artefactos";
// Matriz por artefacto: un caso válido aceptado y, como mínimo, uno inválido descartado con su motivo.
const FRAG = "11111111-1111-4111-8111-111111111111";
const AJENO = "22222222-2222-4222-8222-222222222222";
const ctx = (extra: Partial<ContextoValidacion> = {}): ContextoValidacion => ({
  concepto: "porcentajes",
  nodos: new Set(["n1", "n2", "n3"]),
  aristas: [],
  totalNodos: 3,
  maxNodos: 60,
  maxAristas: 120,
  textosEstudiante: ["Respondí 100 porque +20 y −20 se cancelan"],
  respuestaEstudiante: "100",
  fragmentos: new Set([FRAG]),
  respuestaActiva: null,
  ...extra,
});
const bloque = (b: unknown, c = ctx()) =>
  validarTurno({ mensaje: "Hola", bloques: [b], grafo_ops: [] }, c);
const op = (o: unknown, c = ctx()) =>
  validarTurno({ mensaje: "Hola", bloques: [], grafo_ops: [o] }, c);
type Caso = {
  nombre: string;
  valido: unknown;
  invalidos: {
    caso: string;
    valor: unknown;
    motivo: RegExp;
    ctx?: Partial<ContextoValidacion>;
  }[];
};
const FORMA = /Forma inválida/;
const BLOQUES: Caso[] = [
  {
    nombre: "pregunta_socratica",
    valido: {
      tipo: "pregunta_socratica",
      texto: "¿Sobre qué base?",
      respuestas_rapidas: ["a", "b"],
    },
    invalidos: [
      {
        caso: "más de 4 respuestas rápidas",
        valor: {
          tipo: "pregunta_socratica",
          texto: "¿?",
          respuestas_rapidas: ["a", "b", "c", "d", "e"],
        },
        motivo: FORMA,
      },
      {
        caso: "sin texto",
        valor: { tipo: "pregunta_socratica" },
        motivo: FORMA,
      },
    ],
  },
  {
    nombre: "contraste",
    valido: {
      tipo: "contraste",
      tuyo: ["se cancelan"],
      correcto: ["100 × 1,20 × 0,80 = 96"],
    },
    invalidos: [
      {
        caso: "cuenta que no cierra",
        valor: {
          tipo: "contraste",
          tuyo: ["Respondí 100"],
          correcto: ["120 - 24 = 95"],
        },
        motivo: /no cierra/,
      },
      {
        caso: "atribución inventada",
        valor: { tipo: "contraste", tuyo: ["Sumaste mal"], correcto: ["96"] },
        motivo: /no aparece/,
      },
      {
        caso: "filtra la clave activa",
        valor: {
          tipo: "contraste",
          tuyo: ["Respondí 100"],
          correcto: ["El resultado es 96"],
        },
        motivo: /respuesta de la comprobación activa/,
        ctx: { respuestaActiva: 96 },
      },
    ],
  },
  {
    nombre: "razonamiento_anotado",
    valido: {
      tipo: "razonamiento_anotado",
      pasos: [
        {
          texto: "Asumes que se anulan",
          estado: "revisar",
          cita: "se cancelan",
        },
      ],
    },
    invalidos: [
      {
        caso: "cita que el estudiante no escribió",
        valor: {
          tipo: "razonamiento_anotado",
          pasos: [{ texto: "x", estado: "ok", cita: "dividí entre cuatro" }],
        },
        motivo: /no escribió/,
      },
      {
        caso: "estado desconocido",
        valor: {
          tipo: "razonamiento_anotado",
          pasos: [{ texto: "x", estado: "mal", cita: "se cancelan" }],
        },
        motivo: FORMA,
      },
      {
        caso: "sin pasos",
        valor: { tipo: "razonamiento_anotado", pasos: [] },
        motivo: FORMA,
      },
    ],
  },
  {
    nombre: "prediccion",
    valido: {
      tipo: "prediccion",
      pregunta: "¿Qué pasará?",
      plantilla: "porcentaje_encadenado",
      semilla: 3,
    },
    invalidos: [
      {
        caso: "plantilla de otro concepto",
        valor: {
          tipo: "prediccion",
          pregunta: "¿?",
          plantilla: "proporcion_directa",
          semilla: 3,
        },
        motivo: /no corresponde/,
      },
      {
        caso: "plantilla inexistente",
        valor: {
          tipo: "prediccion",
          pregunta: "¿?",
          plantilla: "inventada",
          semilla: 3,
        },
        motivo: FORMA,
      },
      {
        caso: "semilla negativa",
        valor: {
          tipo: "prediccion",
          pregunta: "¿?",
          plantilla: "porcentaje_encadenado",
          semilla: -1,
        },
        motivo: FORMA,
      },
    ],
  },
  {
    nombre: "ejemplo_paso_a_paso",
    valido: {
      tipo: "ejemplo_paso_a_paso",
      pasos: [
        { texto: "Aumento", cuenta: "100 × 20% = 20" },
        { texto: "Baja" },
      ],
    },
    invalidos: [
      {
        caso: "cuenta falsa en un paso",
        valor: {
          tipo: "ejemplo_paso_a_paso",
          pasos: [{ texto: "Aumento", cuenta: "100 × 20% = 25" }],
        },
        motivo: /no cierra/,
      },
      {
        caso: "más de 8 pasos",
        valor: {
          tipo: "ejemplo_paso_a_paso",
          pasos: Array.from({ length: 9 }, () => ({ texto: "x" })),
        },
        motivo: FORMA,
      },
    ],
  },
  {
    nombre: "visual/cadena_porcentual",
    valido: {
      tipo: "visual",
      forma: "cadena_porcentual",
      pasos: [{ valor: 100 }, { op: "+20%", valor: 120 }],
    },
    invalidos: [
      {
        caso: "cuenta falsa",
        valor: {
          tipo: "visual",
          forma: "cadena_porcentual",
          pasos: [{ valor: 100 }, { op: "+20%", valor: 125 }],
        },
        motivo: /no cierra/,
      },
      {
        caso: "paso sin operación porcentual",
        valor: {
          tipo: "visual",
          forma: "cadena_porcentual",
          pasos: [{ valor: 100 }, { op: "doble", valor: 200 }],
        },
        motivo: /operación porcentual/,
      },
    ],
  },
  {
    nombre: "visual/barra_de_partes",
    valido: {
      tipo: "visual",
      forma: "barra_de_partes",
      total: 24,
      partes: 8,
      marcadas: 3,
      fraccion: "3/8",
    },
    invalidos: [
      {
        caso: "más marcadas que partes",
        valor: {
          tipo: "visual",
          forma: "barra_de_partes",
          total: 24,
          partes: 8,
          marcadas: 9,
        },
        motivo: /más partes marcadas/,
      },
      {
        caso: "fracción incoherente",
        valor: {
          tipo: "visual",
          forma: "barra_de_partes",
          total: 24,
          partes: 8,
          marcadas: 3,
          fraccion: "1/2",
        },
        motivo: /fracción no coincide/,
      },
    ],
  },
  {
    nombre: "visual/tabla_proporcion",
    valido: {
      tipo: "visual",
      forma: "tabla_proporcion",
      columnas: ["a", "b"],
      filas: [
        [3, 12],
        [6, 6],
      ],
      relacion: "inversa",
    },
    invalidos: [
      {
        caso: "productos no constantes (inversa)",
        valor: {
          tipo: "visual",
          forma: "tabla_proporcion",
          columnas: ["a", "b"],
          filas: [
            [3, 12],
            [6, 12],
          ],
          relacion: "inversa",
        },
        motivo: /no cumple una relación inversa/,
      },
      {
        caso: "cocientes no constantes (directa)",
        valor: {
          tipo: "visual",
          forma: "tabla_proporcion",
          columnas: ["a", "b"],
          filas: [
            [4, 300],
            [10, 700],
          ],
          relacion: "directa",
        },
        motivo: /no cumple una relación directa/,
      },
    ],
  },
  {
    nombre: "visual/recta_numerica",
    valido: {
      tipo: "visual",
      forma: "recta_numerica",
      min: 0,
      max: 10,
      puntos: [{ valor: 5 }],
    },
    invalidos: [
      {
        caso: "punto fuera del rango",
        valor: {
          tipo: "visual",
          forma: "recta_numerica",
          min: 0,
          max: 10,
          puntos: [{ valor: 15 }],
        },
        motivo: /fuera del rango/,
      },
      {
        caso: "mínimo mayor que el máximo",
        valor: {
          tipo: "visual",
          forma: "recta_numerica",
          min: 10,
          max: 0,
          puntos: [{ valor: 5 }],
        },
        motivo: /mínimo debe ser menor/,
      },
    ],
  },
  {
    nombre: "practica",
    valido: {
      tipo: "practica",
      plantilla: "porcentaje_para_volver",
      semilla: 4,
      historia: "Una tienda ajusta sus precios.",
    },
    invalidos: [
      {
        caso: "plantilla de otro concepto",
        valor: {
          tipo: "practica",
          plantilla: "fraccion_de_cantidad",
          semilla: 4,
        },
        motivo: /no corresponde/,
      },
      {
        caso: "historia demasiado larga",
        valor: {
          tipo: "practica",
          plantilla: "porcentaje_para_volver",
          semilla: 4,
          historia: "x".repeat(401),
        },
        motivo: FORMA,
      },
    ],
  },
  {
    nombre: "en_tus_palabras",
    valido: { tipo: "en_tus_palabras", consigna: "Explica la idea" },
    invalidos: [
      {
        caso: "consigna vacía",
        valor: { tipo: "en_tus_palabras", consigna: "" },
        motivo: FORMA,
      },
      {
        caso: "filtra la clave activa",
        valor: { tipo: "en_tus_palabras", consigna: "Explica por qué da 96" },
        motivo: /respuesta de la comprobación activa/,
        ctx: { respuestaActiva: 96 },
      },
    ],
  },
  {
    nombre: "invitacion_comprobar",
    valido: {
      tipo: "invitacion_comprobar",
      texto: "Cuando quieras, comprobamos.",
    },
    invalidos: [
      {
        caso: "sin texto",
        valor: { tipo: "invitacion_comprobar" },
        motivo: FORMA,
      },
      {
        caso: "campo no admitido",
        valor: { tipo: "invitacion_comprobar", texto: "Hola", url: "http://x" },
        motivo: FORMA,
      },
    ],
  },
  {
    nombre: "cita",
    valido: { tipo: "cita", fragmento_id: FRAG },
    invalidos: [
      {
        caso: "fragmento ajeno",
        valor: { tipo: "cita", fragmento_id: AJENO },
        motivo: /no existe o no pertenece/,
      },
      {
        caso: "id que no es uuid",
        valor: { tipo: "cita", fragmento_id: "abc" },
        motivo: FORMA,
      },
    ],
  },
];
describe("matriz de validadores: bloques y visuales", () => {
  for (const c of BLOQUES)
    describe(c.nombre, () => {
      it("acepta el caso válido", () => {
        const r = bloque(c.valido);
        expect(r.descartes, JSON.stringify(r.descartes)).toEqual([]);
        expect(r.bloques).toHaveLength(1);
      });
      for (const i of c.invalidos)
        it(`descarta: ${i.caso}`, () => {
          const r = bloque(i.valor, ctx(i.ctx));
          expect(r.bloques).toHaveLength(0);
          expect(r.descartes).toHaveLength(1);
          expect(r.descartes[0].motivo).toMatch(i.motivo);
        });
    });
  it("cubre los diez tipos de bloque y las cuatro formas de visual", () => {
    const tipos = new Set(
      BLOQUES.map((c) => (c.valido as { tipo: string }).tipo),
    );
    expect(tipos.size).toBe(10);
    expect(BLOQUES.filter((c) => c.nombre.startsWith("visual/")).length).toBe(
      4,
    );
  });
});
type CasoOp = {
  nombre: string;
  valido: unknown;
  invalidos: {
    caso: string;
    valor: unknown;
    motivo: RegExp;
    ctx?: Partial<ContextoValidacion>;
  }[];
};
const OPS: CasoOp[] = [
  {
    nombre: "crear_nodo",
    valido: {
      op: "crear_nodo",
      ref_temporal: "t",
      tipo: "idea",
      titulo: "La base cambia",
      resumen: "Tras un cambio la base ya no es la inicial",
      idea_clave: "cambio-de-base",
      padre: "n1",
    },
    invalidos: [
      {
        caso: "padre ajeno",
        valor: {
          op: "crear_nodo",
          ref_temporal: "t",
          tipo: "idea",
          titulo: "x",
          resumen: "y",
          padre: "ajeno",
        },
        motivo: /padre no existe/,
      },
      {
        caso: "límite de nodos",
        valor: {
          op: "crear_nodo",
          ref_temporal: "t",
          tipo: "idea",
          titulo: "x",
          resumen: "y",
        },
        motivo: /límite de nodos/,
        ctx: { totalNodos: 60 },
      },
      {
        caso: "tipo de nodo desconocido",
        valor: {
          op: "crear_nodo",
          ref_temporal: "t",
          tipo: "raiz",
          titulo: "x",
          resumen: "y",
        },
        motivo: /Forma inválida/,
      },
    ],
  },
  {
    nombre: "relacionar",
    valido: {
      op: "relacionar",
      origen: "n1",
      destino: "n2",
      tipo: "contrasta_con",
    },
    invalidos: [
      {
        caso: "nodo ajeno",
        valor: {
          op: "relacionar",
          origen: "n1",
          destino: "ajeno",
          tipo: "relacionado",
        },
        motivo: /no existe/,
      },
      {
        caso: "ciclo en requiere",
        valor: {
          op: "relacionar",
          origen: "n2",
          destino: "n1",
          tipo: "requiere",
        },
        motivo: /ciclo/,
        ctx: { aristas: [{ origen: "n1", destino: "n2", tipo: "subtema" }] },
      },
      {
        caso: "relación duplicada",
        valor: {
          op: "relacionar",
          origen: "n1",
          destino: "n2",
          tipo: "relacionado",
        },
        motivo: /ya existe/,
        ctx: {
          aristas: [{ origen: "n1", destino: "n2", tipo: "relacionado" }],
        },
      },
      {
        caso: "tipo de arista desconocido",
        valor: {
          op: "relacionar",
          origen: "n1",
          destino: "n2",
          tipo: "amigo_de",
        },
        motivo: /Forma inválida/,
      },
    ],
  },
  {
    nombre: "editar_nodo",
    valido: { op: "editar_nodo", nodo: "n1", resumen: "Nuevo resumen" },
    invalidos: [
      {
        caso: "nodo ajeno",
        valor: { op: "editar_nodo", nodo: "ajeno", titulo: "x" },
        motivo: /no existe/,
      },
      {
        caso: "sin título ni resumen",
        valor: { op: "editar_nodo", nodo: "n1" },
        motivo: /Forma inválida/,
      },
    ],
  },
  {
    nombre: "fusionar",
    valido: { op: "fusionar", nodos: ["n1", "n2"], en: "n1" },
    invalidos: [
      {
        caso: "nodo ajeno",
        valor: { op: "fusionar", nodos: ["n1", "ajeno"], en: "n1" },
        motivo: /no existe/,
      },
      {
        caso: "el destino no está entre los fusionados",
        valor: { op: "fusionar", nodos: ["n1", "n2"], en: "n3" },
        motivo: /debe estar entre/,
      },
      {
        caso: "un solo nodo",
        valor: { op: "fusionar", nodos: ["n1"], en: "n1" },
        motivo: /Forma inválida/,
      },
    ],
  },
  {
    nombre: "enfocar",
    valido: { op: "enfocar", nodo: "n1" },
    invalidos: [
      {
        caso: "nodo ajeno",
        valor: { op: "enfocar", nodo: "ajeno" },
        motivo: /no existe/,
      },
      {
        caso: "campo extra",
        valor: { op: "enfocar", nodo: "n1", estado: "aplicado" },
        motivo: /Forma inválida/,
      },
    ],
  },
];
describe("matriz de validadores: operaciones de grafo", () => {
  for (const c of OPS)
    describe(c.nombre, () => {
      it("acepta el caso válido", () => {
        const r = op(c.valido);
        expect(r.descartes, JSON.stringify(r.descartes)).toEqual([]);
        expect(r.grafo_ops).toHaveLength(1);
      });
      for (const i of c.invalidos)
        it(`descarta: ${i.caso}`, () => {
          const r = op(i.valor, ctx(i.ctx));
          expect(r.grafo_ops).toHaveLength(0);
          expect(r.descartes).toHaveLength(1);
          expect(r.descartes[0].motivo).toMatch(i.motivo);
        });
    });
  it("el LLM no puede escribir el estado de un nodo", () => {
    const r = op({
      op: "crear_nodo",
      ref_temporal: "t",
      tipo: "idea",
      titulo: "x",
      resumen: "y",
      estado: "aplicado",
    });
    expect(r.grafo_ops).toHaveLength(0);
    expect(r.descartes[0].motivo).toMatch(FORMA);
  });
  it("una operación que contiene la clave activa se descarta", () => {
    const r = op(
      { op: "editar_nodo", nodo: "n1", resumen: "La respuesta es 96" },
      ctx({ respuestaActiva: 96 }),
    );
    expect(r.grafo_ops).toHaveLength(0);
    expect(r.descartes[0].motivo).toMatch(
      /respuesta de la comprobación activa/,
    );
  });
  it("las cinco operaciones están cubiertas", () => {
    expect(OPS.map((o) => o.nombre).sort()).toEqual([
      "crear_nodo",
      "editar_nodo",
      "enfocar",
      "fusionar",
      "relacionar",
    ]);
  });
});
