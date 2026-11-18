declare module "*.sql" {
  const sql: string;
  export default sql;
}

// Uniwind's theme entry, imported once by the root layout for its side effect.
declare module "*.css";
