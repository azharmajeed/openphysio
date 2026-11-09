import { loadNotes, searchNotes } from "@openphysio/catalog/knowledge";
import { Hono } from "hono";

export function knowledgeRoutes(notes = loadNotes()) {
  const r = new Hono();
  r.get("/search", (c) => {
    const limit = Math.min(Math.max(Number(c.req.query("limit")) || 5, 1), 20);
    return c.json({ results: searchNotes(notes, c.req.query("q") ?? "", limit) });
  });
  return r;
}
