import next from "eslint-config-next";

const config = [{ ignores: [".next/**", "node_modules/**", "drizzle/**"] }, ...next];

export default config;
