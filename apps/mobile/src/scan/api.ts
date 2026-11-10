import { loadConfig } from "../sync";
import { scanParts, type Scan, type ScanKind, type Upload, tzOffsetMin } from "./scan";

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  const cfg = await loadConfig();
  if (!cfg) throw new Error("Set the server URL and token in Settings first.");
  const res = await fetch(`${cfg.url.replace(/\/+$/, "")}/api/scans${path}`, {
    ...init,
    headers: { ...(init.headers as object), authorization: `Bearer ${cfg.token}` },
  });
  const body = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) throw new Error(body.error ?? `Server error ${res.status}`);
  return body as T;
}

export function uploadScan(file: Upload, kind: ScanKind, text: string) {
  const form = new FormData();
  for (const [k, v] of scanParts({ file, kind, text, tzOffsetMin: tzOffsetMin() })) form.append(k, v as never);
  return call<Scan>("", { method: "POST", body: form });
}

export const getScan = (id: string) => call<Scan>(`/${id}`);

export const decide = (id: string, approve: string[], reject: string[]) =>
  call<Scan>(`/${id}/decision`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ approve, reject }),
  });
