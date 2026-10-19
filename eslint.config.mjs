import js from "@eslint/js";
import { defineConfig } from "eslint/config";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";

export default defineConfig([
  { linterOptions: { reportUnusedDisableDirectives: "error" } },
  {
    files: ["backend/src/**/*.ts", "frontend/src/**/*.{ts,tsx}"],
    extends: [js.configs.recommended, tseslint.configs.recommended],
  },
  {
    files: ["frontend/src/**/*.{ts,tsx}"],
    languageOptions: { globals: globals.browser },
    plugins: { "react-hooks": reactHooks },
    rules: {
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "error",
    },
  },
  {
    files: ["backend/src/**/*.ts", "scripts/*.mjs", "eslint.config.mjs"],
    languageOptions: { globals: globals.node },
  },
  {
    files: ["scripts/*.mjs", "eslint.config.mjs"],
    extends: [js.configs.recommended],
  },
]);
