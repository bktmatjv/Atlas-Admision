import { describe, expect, it } from "vitest";
import { repararMarkdown } from "./reparar-markdown";

/** La respuesta real del 14-10-2026 a «¿Qué es Linux y en qué se diferencia de Windows?». */
const TABLA_EN_UNA_LINEA =
  "| Criterio | Linux | Windows | | :--- | :--- | :--- | | Método de configuración | Archivos de texto distribuidos por el sistema. | Registro centralizado (base de datos binaria). | | Superusuario | Cuenta root (privilegios máximos absolutos). | Cuenta Administrator / Administradores locales. |";

describe("repararMarkdown: una tabla escrita en una sola línea", () => {
  it("la parte en filas, con su separador", () => {
    expect(repararMarkdown(`En la administración destacan diferencias clave:\n\n${TABLA_EN_UNA_LINEA}\n\nImagina…`)).toBe(
      [
        "En la administración destacan diferencias clave:",
        "",
        "| Criterio | Linux | Windows |",
        "| :--- | :--- | :--- |",
        "| Método de configuración | Archivos de texto distribuidos por el sistema. | Registro centralizado (base de datos binaria). |",
        "| Superusuario | Cuenta root (privilegios máximos absolutos). | Cuenta Administrator / Administradores locales. |",
        "",
        "Imagina…",
      ].join("\n"),
    );
  });

  it("una tabla pegada al párrafo de encima se separa con una línea en blanco (si no, markdown no la ve)", () => {
    expect(repararMarkdown("Mira:\n| a | b |\n| --- | --- |\n| 1 | 2 |")).toBe("Mira:\n\n| a | b |\n| --- | --- |\n| 1 | 2 |");
  });

  it("una tabla bien escrita no se toca", () => {
    const bien = "| a | b |\n| --- | --- |\n| 1 | 2 |";
    expect(repararMarkdown(bien)).toBe(bien);
  });

  it("una línea con barras que no es una tabla rota no se toca", () => {
    for (const t of ["x | y | z", "| solo | una | fila |", "la media es | x | en valor absoluto"]) {
      expect(repararMarkdown(t), t).toBe(t);
    }
  });

  it("si las celdas no cuadran con el separador, mejor dejarla como está", () => {
    const rara = "| a | b | | :--- | :--- | | 1 | 2 | 3 |";
    expect(repararMarkdown(rara)).toBe(rara);
  });

  it("no toca nada dentro de un bloque de código", () => {
    const codigo = "```\n| a | b | | --- | --- | | 1 | 2 |\n```";
    expect(repararMarkdown(codigo)).toBe(codigo);
  });
});

describe("repararMarkdown: comillas invertidas a la vista", () => {
  it("``  `systemd` `` pasa a `systemd`", () => {
    expect(repararMarkdown("servicios (como `` `systemd` ``), un gestor")).toBe("servicios (como `systemd`), un gestor");
    expect(repararMarkdown("como ``systemd``")).toBe("como `systemd`");
  });

  it("un código con una comilla invertida de verdad dentro se respeta", () => {
    expect(repararMarkdown("escribe `` a`b `` así")).toBe("escribe `` a`b `` así");
  });
});
