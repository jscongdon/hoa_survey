module.exports = {
  root: true,
  plugins: ["@typescript-eslint"],
  parser: "@typescript-eslint/parser",
  extends: ["next", "next/core-web-vitals"],
  parserOptions: {
    ecmaVersion: 2024,
    sourceType: "module",
    project: "./tsconfig.json",
  },
  env: {
    browser: true,
    node: true,
    es2024: true,
  },
  rules: {
    // project-specific overrides can be added here
  },
};
