import {
  ErrorProveedor,
  type EntradaIA,
  type OpcionesLlamada,
  type ProveedorIA,
  type RespuestaIA,
} from "./tipos-ia.js";
// Router de modelos: un ProveedorIA que prueba una cadena ordenada de destinos
// (proveedor:modelo) y pasa al siguiente cuando uno agota su cuota o falla.
// Todo su estado vive en memoria: el backend corre como una sola instancia.
export type DestinoRouter = {
  proveedor: string;
  modelo: string;
  adaptador: ProveedorIA;
  // false: el destino no resuelve herramientas y solo se usa en llamadas sin ellas.
  herramientas?: boolean;
};
export type OpcionesRouter = {
  destinos: DestinoRouter[];
  timeoutLlamadaMs: number;
  timeoutTotalMs: number;
  maxConcurrencia: number;
  maxEsperaColaMs: number;
  enfriamientoMs: number;
  fallosParaAbrir: number;
  backoffBaseMs?: number;
  azar?: () => number;
  // Sin prompts, mensajes del estudiante ni claves: solo metadatos de la llamada.
  log?: (
    nivel: "info" | "warn" | "error",
    evento: Record<string, unknown>,
  ) => void;
};
export type EstadoDisyuntor = "CERRADO" | "ABIERTO" | "SEMIABIERTO";
export type EstadoDestino = {
  id: string;
  proveedor: string;
  modelo: string;
  herramientas: boolean;
  estado: EstadoDisyuntor;
  // Hasta cuándo está abierto (ISO). null si no aplica o si es hasta reiniciar.
  hasta: string | null;
  motivo: "limite" | "fallos" | "mal_configurado" | null;
  ocupados: number;
  en_cola: number;
};
type Motivo = NonNullable<EstadoDestino["motivo"]>;
const ESPERA_SONDA_MS = 1000;
// Semáforo con cola FIFO y espera máxima. No bloquea el event loop: solo promesas y timers.
class Semaforo {
  private libres: number;
  private cola: {
    entregar: (liberar: () => void) => void;
    timer: ReturnType<typeof setTimeout>;
  }[] = [];
  constructor(private max: number) {
    this.libres = max;
  }
  get ocupados() {
    return this.max - this.libres;
  }
  get enCola() {
    return this.cola.length;
  }
  adquirir(esperaMaxMs: number): Promise<(() => void) | null> {
    if (this.libres > 0 && !this.cola.length) {
      this.libres--;
      return Promise.resolve(this.liberador());
    }
    if (esperaMaxMs <= 0) return Promise.resolve(null);
    return new Promise((resolver) => {
      const espera = {
        entregar: (liberar: () => void) => resolver(liberar),
        timer: setTimeout(() => {
          this.cola = this.cola.filter((w) => w !== espera);
          resolver(null);
        }, esperaMaxMs),
      };
      this.cola.push(espera);
    });
  }
  private liberador() {
    let usado = false;
    return () => {
      if (usado) return;
      usado = true;
      const siguiente = this.cola.shift();
      if (siguiente) {
        clearTimeout(siguiente.timer);
        siguiente.entregar(this.liberador()); // el lugar pasa directo al primero de la cola
      } else this.libres++;
    };
  }
}
// Disyuntor por destino. La apertura vencida se resuelve de forma perezosa al consultar.
class Disyuntor {
  private abiertoHasta: number | null = null;
  private sondeando = false;
  private fallos = 0;
  motivo: Motivo | null = null;
  private permanente = false;
  private semiabierto = false;
  estado(ahora: number): EstadoDisyuntor {
    if (this.permanente) return "ABIERTO";
    if (this.semiabierto) return "SEMIABIERTO";
    if (this.abiertoHasta === null) return "CERRADO";
    return ahora >= this.abiertoHasta ? "SEMIABIERTO" : "ABIERTO";
  }
  get hasta() {
    return this.permanente ? null : this.abiertoHasta;
  }
  get malConfigurado() {
    return this.permanente;
  }
  // Pide permiso para llamar. En SEMIABIERTO solo una llamada de prueba a la vez.
  reservar(ahora: number): "libre" | "sonda" | "no" {
    const e = this.estado(ahora);
    if (e === "CERRADO") return "libre";
    if (e === "ABIERTO") return "no";
    this.semiabierto = true;
    if (this.sondeando) return "no";
    this.sondeando = true;
    return "sonda";
  }
  // Cuánto falta para poder usarlo; null si no se recuperará solo.
  recuperacionMs(ahora: number): number | null {
    if (this.permanente) return null;
    const e = this.estado(ahora);
    if (e === "ABIERTO") return Math.max(0, this.abiertoHasta! - ahora);
    if (e === "SEMIABIERTO" && this.sondeando) return ESPERA_SONDA_MS;
    return 0;
  }
  exito() {
    this.abiertoHasta = null;
    this.sondeando = false;
    this.semiabierto = false;
    this.fallos = 0;
    this.motivo = null;
  }
  abrir(ahora: number, ms: number, motivo: Motivo) {
    this.abiertoHasta = ahora + ms;
    this.sondeando = false;
    this.semiabierto = false;
    this.fallos = 0;
    this.motivo = motivo;
  }
  fallaTransitoria(ahora: number, ms: number, umbral: number) {
    // Una prueba fallida reabre de inmediato.
    if (this.semiabierto || this.sondeando)
      return this.abrir(ahora, ms, "fallos");
    this.fallos++;
    if (this.fallos >= umbral) this.abrir(ahora, ms, "fallos");
  }
  // La llamada de prueba terminó sin información sobre la salud del destino.
  soltarSonda() {
    this.sondeando = false;
  }
  marcarMalConfigurado() {
    this.permanente = true;
    this.sondeando = false;
    this.motivo = "mal_configurado";
  }
}
type Clase =
  | "cuota"
  | "transitorio"
  | "invalida"
  | "credenciales"
  | "contexto"
  | "solicitud";
export function clasificar(e: ErrorProveedor): Clase {
  switch (e.codigo) {
    case "limite":
      return "cuota";
    case "timeout":
    case "red":
      return "transitorio";
    case "respuesta_invalida":
      return "invalida";
    case "http": {
      const s = e.estado;
      if (s === 401 || s === 403 || s === 404) return "credenciales";
      if (s === 429) return "cuota";
      if (s === 413 || (s === 400 && e.contextoLargo)) return "contexto";
      if (s === 400) return "solicitud";
      if (s !== undefined && (s >= 500 || s === 408)) return "transitorio";
      return s === undefined ? "invalida" : "solicitud";
    }
  }
}
const aTexto = (ms: number) => {
  const s = Math.max(1, Math.ceil(ms / 1000));
  if (s < 120) return `${s} s`;
  if (s < 7200) return `${Math.ceil(s / 60)} min`;
  return `${Math.ceil(s / 3600)} h`;
};
type Falla = { destino: string; motivo: string; estado?: number };
class Destino {
  readonly id: string;
  readonly disyuntor = new Disyuntor();
  readonly semaforo: Semaforo;
  constructor(
    readonly d: DestinoRouter,
    maxConcurrencia: number,
  ) {
    this.id = `${d.proveedor}:${d.modelo}`;
    this.semaforo = new Semaforo(maxConcurrencia);
  }
  get herramientas() {
    return this.d.herramientas !== false;
  }
}
export class RouterIA implements ProveedorIA {
  private destinos: Destino[];
  private backoffBaseMs: number;
  private azar: () => number;
  constructor(private o: OpcionesRouter) {
    this.destinos = o.destinos.map((d) => new Destino(d, o.maxConcurrencia));
    this.backoffBaseMs = o.backoffBaseMs ?? 400;
    this.azar = o.azar ?? Math.random;
  }
  // Para /salud: sin claves ni datos de cuentas.
  estado(): EstadoDestino[] {
    const ahora = Date.now();
    return this.destinos.map((x) => {
      const estado = x.disyuntor.estado(ahora);
      const hasta = x.disyuntor.hasta;
      return {
        id: x.id,
        proveedor: x.d.proveedor,
        modelo: x.d.modelo,
        herramientas: x.herramientas,
        estado,
        hasta:
          estado === "ABIERTO" && hasta !== null
            ? new Date(hasta).toISOString()
            : null,
        motivo: x.disyuntor.motivo,
        ocupados: x.semaforo.ocupados,
        en_cola: x.semaforo.enCola,
      };
    });
  }
  private log(
    nivel: "info" | "warn" | "error",
    evento: Record<string, unknown>,
  ) {
    this.o.log?.(nivel, { evento: "llm_router", ...evento });
  }
  private disyuntores() {
    const ahora = Date.now();
    return Object.fromEntries(
      this.destinos.map((x) => [x.id, x.disyuntor.estado(ahora)]),
    );
  }
  async completar(e: EntradaIA, _op?: OpcionesLlamada): Promise<RespuestaIA> {
    const inicio = Date.now();
    const limite = inicio + this.o.timeoutTotalMs;
    const fallas: Falla[] = [];
    let intentos = 0;
    let esperaCola = 0;
    let ultimo: ErrorProveedor | null = null;
    let colaLlena = false;
    const conHerramientas = !!e.herramientas?.length;
    const terminar = (error: ErrorProveedor, destino: string | null = null) => {
      this.log(
        error.codigo === "http" && error.estado === 400 ? "error" : "warn",
        {
          ok: false,
          destino,
          error: error.codigo,
          estado: error.estado ?? null,
          intentos,
          failovers: fallas,
          latencia_ms: Date.now() - inicio,
          espera_cola_ms: esperaCola,
          disyuntor: this.disyuntores(),
        },
      );
      return error;
    };
    for (const x of this.destinos) {
      if (Date.now() >= limite) break;
      if (conHerramientas && !x.herramientas) {
        fallas.push({ destino: x.id, motivo: "sin_herramientas" });
        continue;
      }
      const permiso = x.disyuntor.reservar(Date.now());
      if (permiso === "no") {
        fallas.push({ destino: x.id, motivo: "disyuntor_abierto" });
        continue;
      }
      const t0 = Date.now();
      const liberar = await x.semaforo.adquirir(
        Math.min(this.o.maxEsperaColaMs, limite - t0),
      );
      esperaCola += Date.now() - t0;
      if (!liberar) {
        // Saturado: no es una falla del destino, el disyuntor no cambia.
        if (permiso === "sonda") x.disyuntor.soltarSonda();
        colaLlena = true;
        fallas.push({ destino: x.id, motivo: "cola_llena" });
        continue;
      }
      try {
        const { respuesta, usados } = await this.intentar(x, e, limite);
        intentos += usados;
        x.disyuntor.exito();
        this.log("info", {
          ok: true,
          destino: x.id,
          intentos,
          failovers: fallas,
          latencia_ms: Date.now() - inicio,
          espera_cola_ms: esperaCola,
          ...(respuesta.uso ? { tokens: respuesta.uso } : {}),
          disyuntor: this.disyuntores(),
        });
        return { ...respuesta, destino: x.id };
      } catch (err) {
        const error = this.aError(err);
        intentos += (err as { usados?: number }).usados ?? 1;
        ultimo = error;
        if ((err as { sinTiempo?: boolean }).sinTiempo) {
          // Se acabó el tiempo total antes de llamar: no es una falla de este destino.
          x.disyuntor.soltarSonda();
          break;
        }
        const clase = clasificar(error);
        const ahora = Date.now();
        fallas.push({
          destino: x.id,
          motivo:
            error.codigo === "http"
              ? `http_${error.estado ?? "?"}`
              : error.codigo,
          ...(error.estado ? { estado: error.estado } : {}),
        });
        if (clase === "cuota")
          x.disyuntor.abrir(
            ahora,
            error.esperaMs ?? this.o.enfriamientoMs,
            "limite",
          );
        else if (clase === "transitorio" || clase === "invalida")
          x.disyuntor.fallaTransitoria(
            ahora,
            this.o.enfriamientoMs,
            this.o.fallosParaAbrir,
          );
        else if (clase === "credenciales") {
          x.disyuntor.marcarMalConfigurado();
          this.log("error", {
            aviso: "destino_mal_configurado",
            destino: x.id,
            estado: error.estado ?? null,
          });
        } else x.disyuntor.soltarSonda();
        if (clase === "solicitud")
          // Un 400 es un bug de la solicitud: otro modelo no lo arregla. Se registra y se propaga.
          throw terminar(error, x.id);
      } finally {
        liberar();
      }
    }
    throw terminar(this.errorFinal(ultimo, colaLlena));
  }
  // Un solo reintento en el mismo destino, solo para fallos transitorios y dentro del tiempo total.
  private async intentar(
    x: Destino,
    e: EntradaIA,
    limite: number,
  ): Promise<{ respuesta: RespuestaIA; usados: number }> {
    for (let n = 0; ; n++) {
      const restante = limite - Date.now();
      if (restante <= 0)
        throw Object.assign(
          new ErrorProveedor(
            "timeout",
            "La consulta a la IA superó el tiempo máximo.",
          ),
          { usados: n, sinTiempo: true },
        );
      try {
        const r = await this.conLimite(
          x.d.adaptador.completar(e, {
            timeoutMs: Math.min(this.o.timeoutLlamadaMs, restante),
          }),
          Math.min(this.o.timeoutLlamadaMs, restante),
        );
        if (!r.texto?.trim() && !r.llamadas.length)
          throw new ErrorProveedor(
            "respuesta_invalida",
            "El proveedor de IA devolvió una respuesta vacía.",
          );
        return { respuesta: r, usados: n + 1 };
      } catch (err) {
        const error = this.aError(err);
        if (n === 0 && clasificar(error) === "transitorio") {
          const espera = Math.max(
            this.backoffBaseMs * 2 ** n * (0.5 + this.azar()),
            error.esperaMs ?? 0,
          );
          if (Date.now() + espera < limite) {
            await new Promise((r) => setTimeout(r, espera));
            continue;
          }
        }
        throw Object.assign(error, { usados: n + 1 });
      }
    }
  }
  private conLimite<T>(p: Promise<T>, ms: number): Promise<T> {
    return new Promise<T>((resolver, rechazar) => {
      const timer = setTimeout(
        () =>
          rechazar(
            new ErrorProveedor(
              "timeout",
              "El proveedor de IA tardó demasiado en responder.",
            ),
          ),
        ms,
      );
      p.then(
        (v) => {
          clearTimeout(timer);
          resolver(v);
        },
        (err: unknown) => {
          clearTimeout(timer);
          rechazar(err);
        },
      );
    });
  }
  // Un fallo inesperado de un adaptador no debe escapar sin clasificar.
  private aError(err: unknown): ErrorProveedor {
    if (err instanceof ErrorProveedor) return err;
    return new ErrorProveedor(
      "respuesta_invalida",
      "El proveedor de IA devolvió un fallo inesperado.",
    );
  }
  private errorFinal(
    ultimo: ErrorProveedor | null,
    colaLlena: boolean,
  ): ErrorProveedor {
    const ahora = Date.now();
    const esperas = this.destinos
      .map((x) => x.disyuntor.recuperacionMs(ahora))
      .filter((v): v is number => v !== null && v > 0);
    if (esperas.length) {
      const ms = Math.min(...esperas);
      return new ErrorProveedor(
        "limite",
        `Los modelos de IA alcanzaron su límite de uso o no están disponibles ahora. Se recuperarán en unos ${aTexto(ms)}.`,
        undefined,
        { esperaMs: ms },
      );
    }
    if (colaLlena)
      return new ErrorProveedor(
        "limite",
        "Los modelos de IA están ocupados con otras consultas. Espera unos segundos y reintenta.",
      );
    if (ultimo) return ultimo;
    return new ErrorProveedor(
      "http",
      "Ningún modelo de IA está disponible: revisa la configuración del servidor (credenciales o modelos).",
    );
  }
}
