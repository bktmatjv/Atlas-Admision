import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "dist",
      "**/dist/**",
      "backend/uploads/**",
      // Capturas y caché de las pruebas visuales; no son código fuente.
      ".atl/**",
      "remotion",
      // Lo genera Lovable y lo reescribe en cada sincronización: el arreglo de `f9d09ca7`
      // duró hasta el siguiente «Work in progress». Corregirlo aquí no sirve de nada.
      "src/integrations/supabase/previewAuthStorage.ts",
      // Las copias de trabajo de otras sesiones no son este código.
      ".claude/worktrees",
    ],
  },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      "@typescript-eslint/no-unused-vars": "off",
    },
  },
  {
    // Los componentes de shadcn/ui exportan su componente y sus variantes juntos (`buttonVariants`,
    // `badgeVariants`, `useSidebar`, `toast`): moverlas cambiaría decenas de imports por un aviso
    // de la recarga en caliente.
    files: ["frontend/src/components/ui/**/*.{ts,tsx}"],
    rules: { "react-refresh/only-export-components": "off" },
  },
);
