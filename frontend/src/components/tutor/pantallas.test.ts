import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { ApiError } from "@/integrations/api/client";
import { opcionesDeContexto, ordenarTemas } from "@/lib/tutor/inicio";
import type { Conversacion } from "@/lib/tutor/chat";
import { ComposerTutor } from "./ComposerTutor";
import { ConversacionTutor } from "./ConversacionTutor";
import { HistorialPanel } from "./HistorialPanel";
import { InicioTutor } from "./InicioTutor";
const render = (el: ReactElement) =>
  renderToStaticMarkup(createElement(MemoryRouter, null, el));
const noop = () => undefined;
describe("pantalla inicial chat primero (S1, S7)", () => {
  const inicio = (extra: Partial<Parameters<typeof InicioTutor>[0]> = {}) =>
    render(
      createElement(InicioTutor, {
        temas: ordenarTemas(undefined),
        contextos: opcionesDeContexto({}),
        contextoClave: "",
        onContexto: noop,
        valor: "",
        onCambio: noop,
        onEnviar: noop,
        onIntencion: noop,
        intencionActiva: null,
        ocupado: false,
        error: null,
        onReintentar: noop,
        ...extra,
      }),
    );
  it("muestra el título, las cuatro tarjetas y los temas recomendados", () => {
    const html = inicio();
    expect(html).toContain("¿Qué quieres <em>aprender</em> hoy?");
    for (const t of [
      "Resolver una duda",
      "Analizar un ejercicio",
      "Practicar por tema",
      "Explorar mi grafo",
      "Temas recomendados para ti",
    ])
      expect(html).toContain(t);
    for (const t of ["Porcentajes", "Proporciones", "Fracciones"])
      expect(html).toContain(t);
  });
  it("tiene el input grande con el selector de contexto y adjuntar lleva a Mis cursos", () => {
    const html = inicio();
    expect(html).toContain("<textarea");
    expect(html).toContain(
      "Cuéntame qué quieres aprender o pega un ejercicio…",
    );
    expect(html).toContain("Sin contexto: conversación libre");
    expect(html).toContain('href="/cursos"');
    expect(html).toContain("Enter envía");
  });
  it("el contexto suma «Mi última práctica» y el material solo si existen", () => {
    const sin = inicio();
    expect(sin).not.toContain("Mi última práctica");
    const con = inicio({
      contextos: opcionesDeContexto({
        practica: { intento_id: "i", pregunta_id: "p" },
        material: { fragmento_id: "f", nombre: "Apuntes.pdf" },
      }),
    });
    expect(con).toContain("Mi última práctica");
    expect(con).toContain("Material: Apuntes.pdf");
  });
  it("no finge funciones sin soporte", () => {
    const html = inicio().toLowerCase();
    for (const falso of [
      "ecuaciones",
      "progresiones",
      "notificaciones",
      "buscar temas",
      "adjuntar imagen",
      ">jd<",
    ])
      expect(html, falso).not.toContain(falso);
  });
  it("marca el tema con un fallo pendiente y lo ordena primero", () => {
    const temas = ordenarTemas({
      version: 1,
      foco: null,
      camino_error: [],
      aristas: [],
      nodos: [
        {
          id: "n",
          arbol_id: "a",
          tipo: "idea",
          titulo: "x",
          resumen: "",
          idea_clave: null,
          concepto: "fracciones",
          estado: "fallo",
          senal: null,
          origen: "ia",
          evidencias: 1,
        },
      ],
    });
    const html = inicio({ temas });
    expect(html.indexOf("Fracciones")).toBeLessThan(
      html.indexOf("Porcentajes"),
    );
    expect(html).toContain("Para revisar");
  });
  it("muestra el progreso y el error con reintento", () => {
    const html = inicio({ ocupado: true, error: "El tutor no respondió" });
    expect(html).toContain("preparando la primera respuesta");
    expect(html).toContain("El tutor no respondió");
    expect(html).toContain("Reintentar");
    expect(html).toContain('role="alert"');
  });
});
describe("historial de conversaciones (S2)", () => {
  const ahora = new Date(2026, 9, 31, 15, 0);
  const item = (
    id: string,
    titulo: string,
    dias: number,
    concepto: string | null,
  ) => ({
    id,
    titulo,
    concepto,
    created_at: new Date(2026, 9, 31 - dias, 10).toISOString(),
  });
  it("agrupa por fecha, muestra título y tema y enlaza a cada conversación", () => {
    const html = render(
      createElement(HistorialPanel, {
        items: [
          item("a", "Variaciones sucesivas", 0, "porcentajes"),
          item("b", "Regla de tres", 1, "proporciones"),
          item("c", "Fracciones de cantidad", 4, null),
        ],
        activoId: "a",
        ahora,
      }),
    );
    for (const t of ["Historial", "Hoy", "Ayer", "Esta semana"])
      expect(html).toContain(t);
    expect(html).toContain("Variaciones sucesivas");
    expect(html).toContain("Porcentajes");
    expect(html).toContain("General");
    expect(html).toContain('href="/tutor/a"');
    expect(html).toContain('aria-current="page"');
    expect(html).toContain('aria-label="Nueva conversación"');
  });
  it("sin conversaciones, cargando y con error se explica", () => {
    expect(render(createElement(HistorialPanel, { items: [] }))).toContain(
      "Todavía no hay conversaciones",
    );
    expect(render(createElement(HistorialPanel, { cargando: true }))).toContain(
      "Cargando tus conversaciones",
    );
    expect(
      render(
        createElement(HistorialPanel, {
          error: "Sin conexión",
          onReintentar: noop,
        }),
      ),
    ).toContain("Reintentar");
  });
  it("solo ofrece lo que el backend soporta: nada de renombrar ni borrar", () => {
    const html = render(
      createElement(HistorialPanel, {
        items: [item("a", "x", 0, null)],
        ahora,
      }),
    ).toLowerCase();
    expect(html).not.toContain("renombrar");
    expect(html).not.toContain("eliminar");
    expect(html).not.toContain("borrar");
  });
});
describe("conversación (S3)", () => {
  const conv: Conversacion = {
    id: "c1",
    arbol_id: "a1",
    mensajes: [
      {
        id: "m1",
        orden: 1,
        rol: "estudiante",
        texto: "Yo puse 100",
        bloques: [],
        degradado: false,
        descartes: 0,
      },
      {
        id: "m2",
        orden: 2,
        rol: "tutor",
        texto: "¿Sobre qué base?",
        bloques: [],
        degradado: true,
        descartes: 0,
      },
    ],
  };
  const vista = (
    extra: Partial<Parameters<typeof ConversacionTutor>[0]> = {},
  ) =>
    render(
      createElement(ConversacionTutor, {
        conv,
        cargando: false,
        pensando: false,
        pendiente: null,
        error: null,
        onReintentar: noop,
        borrador: "",
        onBorrador: noop,
        onEnviar: noop,
        activa: null,
        ocupado: false,
        temaActual: "porcentajes",
        onComprobar: noop,
        ...extra,
      }),
    );
  it("distingue las burbujas del estudiante y del tutor", () => {
    const html = vista();
    expect(html).toContain("tc-msg--estudiante");
    expect(html).toContain("tc-msg--tutor");
    expect(html).toContain("Tu tutor CALIBRA");
    expect(html).toContain("Yo puse 100");
  });
  it("las acciones rápidas no rompen palabras: son un solo texto sin saltos", () => {
    const html = vista();
    for (const t of [
      "Analizar error",
      "Explicar concepto",
      "Dame una comprobación",
    ])
      expect(html).toContain(t);
    expect(html).not.toContain("<br");
    expect(html).not.toMatch(/Analizarerror|Explicarconcepto|unacomprobación/);
  });
  it("avisa del turno degradado", () => {
    expect(vista()).toContain("Respondí solo con texto");
  });
  it("muestra el mensaje en vuelo y el indicador «pensando»", () => {
    const html = vista({ pendiente: "Mi nuevo mensaje", pensando: true });
    expect(html).toContain("Mi nuevo mensaje");
    expect(html).toContain("El tutor está pensando");
  });
  it("con una comprobación activa fija el aviso y bloquea las acciones rápidas", () => {
    const html = vista({ activa: { arbol_id: "a1" } });
    expect(html).toContain("Comprobación en curso: sin ayudas del tutor");
    expect(html).toContain('href="/aprender/a1"');
    expect(html.match(/class="tc-chip"[^>]*disabled/g)?.length).toBe(3);
  });
  it("explica el límite de uso del proveedor y permite reintentar", () => {
    const html = vista({
      error: new ApiError("El proveedor de IA alcanzó su límite de uso.", 429),
      borrador: "Mi mensaje",
    });
    expect(html).toContain("El tutor no pudo responder ahora.");
    expect(html).toContain("límite de uso");
    expect(html).toContain("Tu mensaje quedó guardado");
    expect(html).toContain("Reintentar");
  });
  it("un error común no se confunde con el del proveedor", () => {
    const html = vista({ error: new ApiError("Algo salió mal", 400) });
    expect(html).toContain("No se pudo completar la acción.");
  });
  it("el compositor dice cómo enviar", () => {
    const html = render(
      createElement(ComposerTutor, {
        id: "x",
        etiqueta: "Tu mensaje",
        valor: "",
        onCambio: noop,
        onEnviar: noop,
        placeholder: "Escribe…",
      }),
    );
    expect(html).toContain("Enter envía · Shift+Enter, salto de línea");
    expect(html).toContain('aria-label="Enviar mensaje"');
  });
});
