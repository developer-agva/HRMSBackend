import globals from "globals";
import pluginJs from "@eslint/js";

/** @type {import('eslint').Linter.FlatConfig[]} */
export default [
  {
    files: ["**/*.js"], 
    languageOptions: {
      sourceType: "commonjs",
      globals: globals.browser,
    },
    ...pluginJs.configs.recommended, // Merge recommended config
    rules: {
      "indent": ["error", 2], // Enforce 2-space indentation
      "quotes": ["error", "double"], // Use double quotes
      "semi": ["error", "always"], // Require semicolons
      "no-console": "off", // Allow console.log
    },
  },
];
