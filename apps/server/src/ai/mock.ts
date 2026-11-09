import type { AiProvider, Message } from "./types.ts";

const lastUserText = (messages: Message[]) => {
  const m = [...messages].reverse().find((x) => x.role === "user");
  if (!m) return "";
  return typeof m.content === "string"
    ? m.content
    : m.content
        .map((b) => (b.type === "text" ? b.text : b.type === "tool_result" ? b.content : ""))
        .join("\n");
};

export const mockProvider: AiProvider = {
  async chat({ messages }) {
    const text = lastUserText(messages);
    const tool = /\[tool:([\w-]+)\]/.exec(text)?.[1];
    if (tool) return { text: "", toolCalls: [{ id: `mock_${tool}`, name: tool, input: {} }] };
    return { text: `Mock reply: ${text.slice(0, 80)}`, toolCalls: [] };
  },
  async extract({ schema }) {
    const required = Array.isArray(schema.required) ? (schema.required as string[]) : [];
    return Object.fromEntries(required.map((k) => [k, ""]));
  },
};
