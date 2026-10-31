import { describe, it, expect } from "vitest";
import {
  MENSAJE_FILTRADO,
  validarForma,
  validarLectura,
  validarTurno,
  type ContextoValidacion,
} from "../src/modules/tutor/artefactos";
const FRAG = "11111111-1111-4111-8111-111111111111";
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
const turno = (
  bloques: unknown[] = [],
  grafo_ops: unknown[] = [],
  mensaje = "Hola",
) => ({
  mensaje,
  bloques,
  grafo_ops,
});
const motivos = (r: ReturnType<typeof validarTurno>) =>
  r.descartes.map((d) => d.motivo);
describe("capa 1: forma", () => {
  it("exige un mensaje y tolera que falten bloques y operaciones", () => {
    expect(validarForma({ mensaje: "x" })).toMatchObject({
      ok: true,
      turno: { bloques: [], grafo_ops: [] },
    });
    const mal = validarForma({ bloques: [] });
    expect(mal.ok).toBe(false);
    expect(validarForma({ mensaje: "" }).ok).toBe(false);
    expect(validarForma("texto suelto").ok).toBe(false);
  });
  it("descarta tipos desconocidos y bloques con forma inválida, y conserva el resto", () => {
    const r = validarTurno(
      turno([
        { tipo: "holograma", x: 1 },
        { tipo: "pregunta_socratica" },
        {
          tipo: "pregunta_socratica",
          texto: "¿Sobre qué cantidad calculaste?",
        },
        { tipo: "en_tus_palabras", consigna: "Explícalo", extra: 1 },
      ]),
      ctx(),
    );
    expect(r.bloques).toHaveLength(1);
    expect(r.descartes).toHaveLength(3);
  });
  it("limita la cantidad de bloques y de operaciones por turno", () => {
    const b = Array.from({ length: 9 }, () => ({
      tipo: "en_tus_palabras",
      consigna: "Cuéntame",
    }));
    expect(validarTurno(turno(b), ctx()).bloques).toHaveLength(6);
    const ops = Array.from({ length: 11 }, () => ({
      op: "enfocar",
      nodo: "n1",
    }));
    expect(validarTurno(turno([], ops), ctx()).grafo_ops).toHaveLength(8);
  });
  it("valida predicción y práctica contra una plantilla del concepto", () => {
    const ok = {
      tipo: "practica",
      plantilla: "porcentaje_encadenado",
      semilla: 3,
    };
    const otro = {
      tipo: "practica",
      plantilla: "proporcion_directa",
      semilla: 3,
    };
    const falsa = {
      tipo: "prediccion",
      pregunta: "¿?",
      plantilla: "inventada",
      semilla: 1,
    };
    const r = validarTurno(turno([ok, otro, falsa]), ctx());
    expect(r.bloques).toHaveLength(1);
    expect(r.descartes).toHaveLength(2);
  });
});
describe("capa 3: matemática", () => {
  const cadena = (pasos: unknown[]) => ({
    tipo: "visual",
    forma: "cadena_porcentual",
    pasos,
  });
  it("acepta una cadena porcentual correcta", () => {
    const r = validarTurno(
      turno([
        cadena([
          { valor: 100 },
          { op: "+20%", valor: 120 },
          { op: "-20%", valor: 96 },
        ]),
      ]),
      ctx(),
    );
    expect(r.bloques).toHaveLength(1);
  });
  it("descarta una cadena con cuentas falsas", () => {
    const r = validarTurno(
      turno([
        cadena([
          { valor: 100 },
          { op: "+20%", valor: 120 },
          { op: "-20%", valor: 100 },
        ]),
      ]),
      ctx(),
    );
    expect(r.bloques).toHaveLength(0);
    expect(motivos(r)[0]).toMatch(/no cierra/);
  });
  it("verifica barra de partes, tabla de proporción y recta numérica", () => {
    const buenas = [
      {
        tipo: "visual",
        forma: "barra_de_partes",
        total: 24,
        partes: 8,
        marcadas: 3,
        fraccion: "3/8",
      },
      {
        tipo: "visual",
        forma: "tabla_proporcion",
        columnas: ["Máquinas", "Horas"],
        filas: [
          [3, 12],
          [6, 6],
          [4, 9],
        ],
        relacion: "inversa",
      },
      {
        tipo: "visual",
        forma: "tabla_proporcion",
        columnas: ["Personas", "Gramos"],
        filas: [
          [4, 300],
          [10, 750],
        ],
        relacion: "directa",
      },
      {
        tipo: "visual",
        forma: "recta_numerica",
        min: 0,
        max: 10,
        puntos: [{ valor: 5 }],
      },
    ];
    expect(validarTurno(turno(buenas), ctx()).bloques).toHaveLength(4);
    const malas = [
      {
        tipo: "visual",
        forma: "barra_de_partes",
        total: 24,
        partes: 8,
        marcadas: 9,
      },
      {
        tipo: "visual",
        forma: "barra_de_partes",
        total: 24,
        partes: 8,
        marcadas: 3,
        fraccion: "1/2",
      },
      {
        tipo: "visual",
        forma: "tabla_proporcion",
        columnas: ["a", "b"],
        filas: [
          [3, 12],
          [6, 12],
        ],
        relacion: "inversa",
      },
      {
        tipo: "visual",
        forma: "tabla_proporcion",
        columnas: ["a", "b"],
        filas: [
          [4, 300],
          [10, 700],
        ],
        relacion: "directa",
      },
      {
        tipo: "visual",
        forma: "recta_numerica",
        min: 0,
        max: 10,
        puntos: [{ valor: 15 }],
      },
    ];
    const r = validarTurno(turno(malas), ctx());
    expect(r.bloques).toHaveLength(0);
    expect(r.descartes).toHaveLength(5);
  });
  it("descarta un contraste cuyo paso correcto no cierra", () => {
    const base = { tipo: "contraste", tuyo: ["Respondí 100"] };
    const mal = validarTurno(
      turno([{ ...base, correcto: ["120 - 24 = 95"] }]),
      ctx(),
    );
    expect(mal.bloques).toHaveLength(0);
    expect(motivos(mal)[0]).toMatch(/120 - 24 = 95/);
    const bien = validarTurno(
      turno([{ ...base, correcto: ["100 × 1,20 × 0,80 = 96"] }]),
      ctx(),
    );
    expect(bien.bloques).toHaveLength(1);
  });
  it("verifica las cuentas de un ejemplo paso a paso", () => {
    const paso = (cuenta: string) => ({
      tipo: "ejemplo_paso_a_paso",
      pasos: [{ texto: "Paso", cuenta }],
    });
    expect(
      validarTurno(turno([paso("100 × 20% = 20")]), ctx()).bloques,
    ).toHaveLength(1);
    expect(
      validarTurno(turno([paso("100 × 20% = 25")]), ctx()).bloques,
    ).toHaveLength(0);
  });
});
describe("capa 4: atribución", () => {
  it("acepta un contraste que contiene la respuesta real o texto literal del estudiante", () => {
    const a = {
      tipo: "contraste",
      tuyo: ["Tu resultado fue 100"],
      correcto: ["96"],
    };
    const b = {
      tipo: "contraste",
      tuyo: ["+20 y −20 se cancelan"],
      correcto: ["No se cancelan"],
    };
    expect(validarTurno(turno([a, b]), ctx()).bloques).toHaveLength(2);
  });
  it("descarta atribuciones inventadas", () => {
    const inventada = {
      tipo: "contraste",
      tuyo: ["Sumaste mal los descuentos"],
      correcto: ["Era otra cosa"],
    };
    const r = validarTurno(turno([inventada]), ctx());
    expect(r.bloques).toHaveLength(0);
    expect(motivos(r)[0]).toMatch(/no aparece/);
  });
  it("sin respuesta del estudiante no hay nada que atribuir", () => {
    const c = { tipo: "contraste", tuyo: ["Respondí 100"], correcto: ["96"] };
    expect(
      validarTurno(
        turno([c]),
        ctx({ textosEstudiante: [], respuestaEstudiante: null }),
      ).bloques,
    ).toHaveLength(0);
  });
  it("el razonamiento anotado exige citas literales", () => {
    const paso = (cita: string) => ({
      tipo: "razonamiento_anotado",
      pasos: [{ texto: "Asumes que se compensan", estado: "revisar", cita }],
    });
    expect(
      validarTurno(turno([paso("+20 y −20 se cancelan")]), ctx()).bloques,
    ).toHaveLength(1);
    expect(
      validarTurno(turno([paso("dividí entre cuatro")]), ctx()).bloques,
    ).toHaveLength(0);
  });
});
describe("capa 2: referencias del grafo", () => {
  it("acepta operaciones sobre nodos propios y refs temporales del mismo turno", () => {
    const r = validarTurno(
      turno(
        [],
        [
          {
            op: "crear_nodo",
            ref_temporal: "t1",
            tipo: "error",
            titulo: "Compensar",
            resumen: "Creer que +20 y −20 se anulan",
            idea_clave: "cambio-de-base",
            padre: "n1",
          },
          {
            op: "relacionar",
            origen: "t1",
            destino: "n2",
            tipo: "confusion_con",
          },
          { op: "editar_nodo", nodo: "n1", resumen: "Nuevo resumen" },
          { op: "enfocar", nodo: "t1" },
        ],
      ),
      ctx(),
    );
    expect(r.grafo_ops).toHaveLength(4);
  });
  it("descarta nodos ajenos o inexistentes", () => {
    const r = validarTurno(
      turno(
        [],
        [
          { op: "enfocar", nodo: "ajeno" },
          { op: "editar_nodo", nodo: "ajeno", titulo: "x" },
          {
            op: "relacionar",
            origen: "n1",
            destino: "ajeno",
            tipo: "relacionado",
          },
          {
            op: "crear_nodo",
            ref_temporal: "t",
            tipo: "idea",
            titulo: "x",
            resumen: "y",
            padre: "ajeno",
          },
          { op: "fusionar", nodos: ["n1", "ajeno"], en: "n1" },
        ],
      ),
      ctx(),
    );
    expect(r.grafo_ops).toHaveLength(0);
    expect(r.descartes).toHaveLength(5);
  });
  it("ignora una idea clave fuera del catálogo del concepto", () => {
    const r = validarTurno(
      turno(
        [],
        [
          {
            op: "crear_nodo",
            ref_temporal: "t",
            tipo: "idea",
            titulo: "x",
            resumen: "y",
            idea_clave: "valor-unitario",
          },
        ],
      ),
      ctx(),
    );
    expect(r.grafo_ops[0]).toMatchObject({ idea_clave: null });
  });
  it("rechaza ciclos en subtema/requiere, duplicados y autorrelaciones", () => {
    const base = ctx({
      aristas: [{ origen: "n1", destino: "n2", tipo: "subtema" }],
    });
    const r = validarTurno(
      turno(
        [],
        [
          { op: "relacionar", origen: "n2", destino: "n1", tipo: "requiere" },
          { op: "relacionar", origen: "n1", destino: "n2", tipo: "subtema" },
          {
            op: "relacionar",
            origen: "n3",
            destino: "n3",
            tipo: "relacionado",
          },
          {
            op: "relacionar",
            origen: "n2",
            destino: "n1",
            tipo: "relacionado",
          },
        ],
      ),
      base,
    );
    expect(r.grafo_ops).toHaveLength(1);
    expect(motivos(r)).toEqual(
      expect.arrayContaining([
        "La relación crearía un ciclo",
        "La relación ya existe",
        "No se relaciona un nodo consigo mismo",
      ]),
    );
  });
  it("respeta el límite de nodos", () => {
    const op = {
      op: "crear_nodo",
      ref_temporal: "t",
      tipo: "idea",
      titulo: "x",
      resumen: "y",
    };
    expect(
      validarTurno(turno([], [op]), ctx({ totalNodos: 60 })).grafo_ops,
    ).toHaveLength(0);
  });
  it("verifica que la cita apunte a un fragmento propio", () => {
    const propio = { tipo: "cita", fragmento_id: FRAG };
    const ajeno = {
      tipo: "cita",
      fragmento_id: "22222222-2222-4222-8222-222222222222",
    };
    expect(validarTurno(turno([propio, ajeno]), ctx()).bloques).toHaveLength(1);
  });
});
describe("capa 5: filtración de la clave activa", () => {
  const activa = ctx({ respuestaActiva: 96 });
  it("reemplaza un mensaje que contiene la respuesta", () => {
    const r = validarTurno(turno([], [], "El resultado es 96 soles"), activa);
    expect(r.mensaje).toBe(MENSAJE_FILTRADO);
  });
  it("descarta bloques y operaciones que la contienen", () => {
    const r = validarTurno(
      turno(
        [{ tipo: "en_tus_palabras", consigna: "Explica por qué da 96,0" }],
        [{ op: "editar_nodo", nodo: "n1", resumen: "La respuesta es 96" }],
      ),
      activa,
    );
    expect(r.bloques).toHaveLength(0);
    expect(r.grafo_ops).toHaveLength(0);
    expect(r.mensaje).toBe("Hola");
  });
  it("sin comprobación activa el mismo texto es válido", () => {
    expect(
      validarTurno(turno([], [], "El resultado es 96 soles"), ctx()).mensaje,
    ).toContain("96");
  });
  it("no confunde números distintos", () => {
    expect(
      validarTurno(turno([], [], "Tienes 960 y 9,6"), activa).mensaje,
    ).toBe("Tienes 960 y 9,6");
  });
});
describe("lectura provisional (§4.3)", () => {
  const lectura = (extra = {}) => ({
    ideas_detectadas: ["cambio-de-base"],
    posible_confusion: "cambio-de-base",
    cita_del_estudiante: "+20 y -20 se cancelan",
    confianza: "media",
    ...extra,
  });
  const textos = ["Respondí 100 porque +20 y −20 se cancelan"];
  it("se acepta cuando la cita está literalmente en lo escrito", () => {
    expect(validarLectura(lectura(), "porcentajes", textos)).toMatchObject({
      confianza: "media",
    });
  });
  it("se rechaza una cita inventada, una idea ajena o una confianza inválida", () => {
    expect(
      validarLectura(
        lectura({ cita_del_estudiante: "no entendí el descuento" }),
        "porcentajes",
        textos,
      ),
    ).toBeNull();
    expect(
      validarLectura(
        lectura({ posible_confusion: "valor-unitario" }),
        "porcentajes",
        textos,
      ),
    ).toBeNull();
    expect(
      validarLectura(
        lectura({ ideas_detectadas: ["inventada"] }),
        "porcentajes",
        textos,
      ),
    ).toBeNull();
    expect(
      validarLectura(lectura({ confianza: "total" }), "porcentajes", textos),
    ).toBeNull();
    expect(validarLectura("hola", "porcentajes", textos)).toBeNull();
  });
});
