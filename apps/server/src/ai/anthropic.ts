import { AiUnavailableError, type AiProvider, type Block, type ToolCall } from "./types.ts";

const URL = "https://api.anthropic.com/v1/messages";

export function anthropicProvider(opts: {
  apiKey: string;
  model: string;
  fetch?: typeof fetch;
  maxTokens?: number;
}): AiProvider {
  const f = opts.fetch ?? fetch;
  async function call(body: Record<string, unknown>): Promise<Block[]> {
    if (!opts.apiKey) throw new AiUnavailableError("ANTHROPIC_API_KEY is not set on the server");
    const res = await f(URL, {
      method: "POST",
      headers: {
        "x-api-key": opts.apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({ model: opts.model, max_tokens: opts.maxTokens ?? 1024, ...body }),
    });
    if (!res.ok)
      throw new Error(`Anthropic API ${res.status}: ${(await res.text()).slice(0, 200)}`);
    return ((await res.json()) as { content: Block[] }).content;
  }
  return {
    async chat({ system, messages, tools }) {
      const content = await call({ system, messages, ...(tools?.length ? { tools } : {}) });
      const text = content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
      const toolCalls = content.flatMap((b): ToolCall[] =>
        b.type === "tool_use" ? [{ id: b.id, name: b.name, input: b.input }] : [],
      );
      return { text, toolCalls };
    },
    async extract({ system, input, schema }) {
      const content = await call({
        system,
        messages: [{ role: "user", content: input }],
        tools: [
          { name: "extract", description: "Return the extracted data.", input_schema: schema },
        ],
        tool_choice: { type: "tool", name: "extract" },
      });
      const out = content.find((b) => b.type === "tool_use" && b.name === "extract");
      if (out?.type !== "tool_use") throw new Error("model returned no extract tool call");
      // ponytail: required-keys check only, not full JSON Schema validation; add ajv if schemas get strict.
      const required = Array.isArray(schema.required) ? (schema.required as string[]) : [];
      const missing = required.filter((k) => !(k in out.input));
      if (missing.length) throw new Error(`extract result missing keys: ${missing.join(", ")}`);
      return out.input;
    },
  };
}
