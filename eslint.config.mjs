import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Служебные каталоги рабочей среды и скрипты вне приложения
    ".cache/**",
    ".config/**",
    ".npm/**",
    ".npm-global/**",
    ".claude/**",
    ".pki/**",
    ".ssh/**",
    "supabase/tests/**",
  ]),
]);

export default eslintConfig;
