export type ToolDef = { name: string; description: string; input_schema: Record<string, unknown> };
export type ToolCall = { id: string; name: string; input: Record<string, unknown> };
export type Block =
  | { type: "text"; text: string }
  | { type: "tool_use"; id: string; name: string; input: Record<string, unknown> }
  | { type: "tool_result"; tool_use_id: string; content: string; is_error?: boolean };
export type Message = { role: "user" | "assistant"; content: string | Block[] };
export type ChatInput = { system?: string; messages: Message[]; tools?: ToolDef[] };
export type ChatResult = { text: string; toolCalls: ToolCall[] };
export type ExtractInput = { system?: string; input: string; schema: Record<string, unknown> };

export interface AiProvider {
  chat(i: ChatInput): Promise<ChatResult>;
  extract(i: ExtractInput): Promise<Record<string, unknown>>;
}

/** Provider not usable (e.g. missing API key); routes map this to 503. */
export class AiUnavailableError extends Error {}
