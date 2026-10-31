import { leerTabla } from "@/integrations/local/almacen";
import type { GeckoMood } from "./CalibraGeckoSvg";

export interface GeckoMessage {
  id: string;
  tag: string;
  texto: string;
  mood?: GeckoMood;
  accion?: {
    label: string;
    href: string;
  };
}

interface IntentoSimple {
  id: string;
  estado: "en_curso" | "entregado" | "abandonado";
  modo: string;
  created_at?: string;
}

interface PerfilSimple {
  carrera_id?: string | null;
  universidad?: string | null;
}

/**
 * Obtiene la lista de mensajes contextuales de Gecko según la ruta activa
 * y las lecturas seguras del almacenamiento local (sin métricas inventadas).
 */
export function getGeckoMessages(pathname: string): GeckoMessage[] {
  const mensajes: GeckoMessage[] = [];

  // 1. LECTURAS REALES DEL ALMACENAMIENTO (Sin métricas falsas)
  let intentoEnCurso: IntentoSimple | undefined;
  let perfil: PerfilSimple | undefined;

  try {
    const intentos = leerTabla<IntentoSimple>("admision_intentos");
    intentoEnCurso = intentos.find((i) => i.estado === "en_curso");

    const perfiles = leerTabla<PerfilSimple>("admision_perfil");
    perfil = perfiles[0];
  } catch {
    // Si el almacenamiento local está restringido, se continúa sin datos
  }

  // 2. PRIORIDAD ALTA: Recordatorio de intento activo
  if (intentoEnCurso) {
    mensajes.push({
      id: "intento-activo",
      tag: "RECORDATORIO ACTIVO",
      texto: "Dejaste un entrenamiento en pausa. ¿Volvemos a calibrar esas ideas?",
      mood: "focused",
      accion: {
        label: "Retomar intento",
        href: `/admision/intento/${intentoEnCurso.id}`,
      },
    });
  }

  // 3. PRIORIDAD ALTA: Carrera no configurada en Admisión
  if (pathname.startsWith("/admision") && (!perfil || !perfil.carrera_id)) {
    mensajes.push({
      id: "elegir-carrera",
      tag: "CALIBRACIÓN",
      texto: "Elegir tu carrera en San Marcos nos ayudará a medir tu meta con precisión.",
      mood: "curious",
      accion: {
        label: "Configurar carrera",
        href: "/admision",
      },
    });
  }

  // 4. MENSAJES CONTEXTUALES SEGÚN RUTA (SOCRÁTICOS Y DE ENFOQUE)
  if (pathname.startsWith("/aprender")) {
    mensajes.push(
      {
        id: "aprender-1",
        tag: "COMPRENSIÓN",
        texto: "No busques memorizar la fórmula; pregúntate por qué funciona.",
        mood: "focused",
      },
      {
        id: "aprender-2",
        tag: "CONEXIÓN DE IDEAS",
        texto: "Una buena duda vale más que diez respuestas rápidas. ¿Qué idea conectamos hoy?",
        mood: "curious",
      },
      {
        id: "aprender-3",
        tag: "APRENDIZAJE AUTÓNOMO",
        texto: "Si puedes explicarlo con tus propias palabras, ya es tuyo.",
        mood: "celebrating",
      }
    );
  } else if (pathname.startsWith("/cursos")) {
    mensajes.push(
      {
        id: "cursos-1",
        tag: "TU MATERIAL",
        texto: "Tus propios apuntes son el mejor mapa. Súbelos y pongámoslos a prueba.",
        mood: "curious",
      },
      {
        id: "cursos-2",
        tag: "APLICACIÓN REAL",
        texto: "Leer da sensación de saber; resolver sin ayuda demuestra que aprendiste.",
        mood: "focused",
      }
    );
  } else if (pathname.startsWith("/admision/temas")) {
    mensajes.push(
      {
        id: "temas-1",
        tag: "TEMARIO OFICIAL",
        texto: "Explora el temario oficial. Identifica qué temas vienen más en tu área.",
        mood: "curious",
      },
      {
        id: "temas-2",
        tag: "PASO A PASO",
        texto: "Divide el temario en pasos pequeños: domina un tema a la vez.",
        mood: "focused",
      }
    );
  } else if (pathname.startsWith("/admision")) {
    mensajes.push(
      {
        id: "admision-1",
        tag: "MENTALIDAD DE CRECIMIENTO",
        texto: "Un error en el simulacro de hoy es un punto seguro en el examen real.",
        mood: "celebrating",
      },
      {
        id: "admision-2",
        tag: "DISCIPLINA",
        texto: "La consistencia vence al talento cuando el talento no entrena. ¿Hacemos 10 preguntas?",
        mood: "focused",
      },
      {
        id: "admision-3",
        tag: "ESTRATEGIA SAN MARCOS",
        texto: "Enfócate en el razonamiento detrás de cada distractor.",
        mood: "focused",
      }
    );
  }

  // 5. MANTRAS SOCRÁTICOS GENERALES DE CALIBRA (Fallback universal)
  mensajes.push(
    {
      id: "mantra-1",
      tag: "APRENDE A PENSAR",
      texto: "Aprender sin pensar es tiempo perdido; pensar mientras aprendes te hace autónomo.",
      mood: "focused",
    },
    {
      id: "mantra-2",
      tag: "CALIBRACIÓN",
      texto: "El error no es una falla, es un dato valioso para saber dónde afinar.",
      mood: "curious",
    }
  );

  return mensajes;
}

