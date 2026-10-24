import { createHmac, timingSafeEqual } from "node:crypto";

export const DEFAULT_BASE_URL = "https://chat.wokey.pro/_keychat";

export type Action =
  | { type?: "send_command"; command: string }
  | { type: "send_message"; text: string }
  | { type: "callback"; data?: string }
  | { type: "open_url"; url: string };

export interface Button {
  id?: string; command?: string; text?: string; icon?: string; action?: Action;
  single_use?: boolean; expires_at?: string;
}
export interface ButtonGrid { rows: Button[][] }
export interface BotCommand { command: string; arguments?: string; description?: string; icon?: string }
export interface Media {
  type: "image" | "video" | "file"; url: string; name?: string; mime_type?: string;
  size?: number; width?: number; height?: number; duration_ms?: number;
}
export interface MessageContent {
  text?: string; format?: "plain" | "markdown"; attachments?: Media[];
  /** Omit to keep the current menu; null hides it. */
  menu?: ButtonGrid | null;
  /** Buttons attached below this message; null removes them on edit. */
  keyboard?: ButtonGrid | null;
  /** Omit to keep current autocomplete commands; null or [] clears them. */
  commands?: BotCommand[] | null;
}
export interface SendMessageInput {
  chat_id: string; content: MessageContent; idempotency_key?: string;
  reply_to_event_id?: string; replace_event_id?: string;
}
export interface MessageResult { event_id: string; chat_id: string; duplicate: boolean }
export interface UploadedMedia { url: string; name: string | null; mime_type: string | null; size: number }
export interface WebhookEvent<T = Record<string, unknown>> {
  api_version: "1"; id: string; type: string; occurred_at: string; bot_id: string; data: T;
}
export type WebhookHeaders = Headers | Record<string, string | string[] | undefined>;

export class KeyChatError extends Error {
  constructor(public status: number, public body: unknown) {
    super(`Key Chat API error: ${status}`); this.name = "KeyChatError";
  }
}

export class KeyChatBot {
  readonly token: string;
  readonly baseUrl: string;
  constructor(token: string, options: { baseUrl?: string } = {}) {
    if (!token) throw new TypeError("Key Chat bot token is required");
    this.token = token;
    this.baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, "");
  }

  private async request<T>(path: string, init: RequestInit): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers: { Authorization: `Bearer ${this.token}`, ...init.headers },
    });
    const body = await response.json().catch(() => null);
    if (!response.ok) throw new KeyChatError(response.status, body);
    return body as T;
  }

  sendMessage(input: SendMessageInput): Promise<MessageResult> {
    return this.request("/v1/bot/messages", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
  }
  editMessage(chatId: string, eventId: string, content: MessageContent, idempotencyKey?: string): Promise<MessageResult> {
    return this.sendMessage({ chat_id: chatId, replace_event_id: eventId, content, idempotency_key: idempotencyKey });
  }
  reply(chatId: string, eventId: string, content: MessageContent, idempotencyKey?: string): Promise<MessageResult> {
    return this.sendMessage({ chat_id: chatId, reply_to_event_id: eventId, content, idempotency_key: idempotencyKey });
  }
  async uploadMedia(file: Blob, filename = "attachment"): Promise<UploadedMedia> {
    const form = new FormData(); form.append("file", file, filename);
    return this.request("/v1/bot/media", { method: "POST", body: form });
  }
}

function header(headers: WebhookHeaders, name: string): string {
  if (headers instanceof Headers) return headers.get(name) ?? "";
  const found = Object.entries(headers).find(([key]) => key.toLowerCase() === name.toLowerCase())?.[1];
  return Array.isArray(found) ? found[0] ?? "" : found ?? "";
}

export function verifyWebhook(rawBody: string | Uint8Array, headers: WebhookHeaders, secret: string, toleranceSeconds = 300): WebhookEvent {
  const timestamp = header(headers, "x-keychat-timestamp");
  const supplied = header(headers, "x-keychat-signature").replace(/^v1=/, "");
  if (!/^\d+$/.test(timestamp) || !/^[a-f0-9]{64}$/i.test(supplied)) throw new Error("Invalid Key Chat webhook signature headers");
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > toleranceSeconds) throw new Error("Stale Key Chat webhook");
  const bytes = typeof rawBody === "string" ? Buffer.from(rawBody) : Buffer.from(rawBody);
  const expected = createHmac("sha256", secret).update(timestamp).update(".").update(bytes).digest("hex");
  if (!timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(supplied, "hex"))) throw new Error("Invalid Key Chat webhook signature");
  return JSON.parse(bytes.toString("utf8")) as WebhookEvent;
}

export async function dispatchWebhook(
  rawBody: string | Uint8Array,
  headers: WebhookHeaders,
  secret: string,
  handlers: Record<string, (event: WebhookEvent) => unknown | Promise<unknown>>,
): Promise<unknown> {
  const event = verifyWebhook(rawBody, headers, secret);
  return handlers[event.type]?.(event) ?? handlers["*"]?.(event) ?? {};
}

export const commandButton = (command: string, options: Omit<Button, "command" | "action"> = {}): Button => ({ ...options, command });
export const botCommand = (command: string, options: Omit<BotCommand, "command"> = {}): BotCommand => ({ ...options, command });
export const callbackButton = (id: string, text: string, data?: string, options: Omit<Button, "id" | "text" | "action"> = {}): Button => ({ ...options, id, text, action: { type: "callback", data } });
export const messageButton = (text: string, message: string, options: Omit<Button, "text" | "action"> = {}): Button => ({ ...options, text, action: { type: "send_message", text: message } });
export const urlButton = (text: string, url: string, options: Omit<Button, "text" | "action"> = {}): Button => ({ ...options, text, action: { type: "open_url", url } });
