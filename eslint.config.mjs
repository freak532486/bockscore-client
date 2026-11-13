import js from "@eslint/js";
import prettier from "eslint-config-prettier";
import { defineConfig, globalIgnores } from "eslint/config";
import globals from "globals";
import tseslint from "typescript-eslint";

export default defineConfig(
    globalIgnores(["dist/", "node_modules/"]),
    js.configs.recommended,
    tseslint.configs.recommended,
    {
        languageOptions: {
            globals: globals.browser,
        },
    },
    prettier,
);
