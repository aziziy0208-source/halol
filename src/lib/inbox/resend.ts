import "server-only";
import { serverEnv } from "@/lib/env";

/** Minimal client for Resend's receiving API (https://resend.com/docs/api-reference/emails). */
const API = "https://api.resend.com";

export class InboxNotConfiguredError extends Error {
  constructor() {
    super("RESEND_API_KEY is not set");
  }
}

export type ResendAttachmentSummary = {
  id: string;
  filename: string | null;
  content_type: string | null;
  content_disposition: string | null;
  content_id: string | null;
  size: number;
};

export type ResendReceivedListItem = {
  id: string;
  from: string;
  to: string[] | null;
  subject: string | null;
  created_at: string;
};

export type ResendReceivedEmail = ResendReceivedListItem & {
  html: string | null;
  text: string | null;
  cc: string[] | null;
  reply_to: string[] | null;
  message_id: string | null;
  authentication: { spf?: string; dkim?: string; dmarc?: string } | null;
  attachments: ResendAttachmentSummary[] | null;
};

type List<T> = { object: "list"; has_more: boolean; data: T[] };
export type ResendAttachment = ResendAttachmentSummary & { download_url: string };

export function inboxConfigured(): boolean {
  return Boolean(serverEnv().RESEND_API_KEY);
}

async function get<T>(path: string): Promise<T> {
  const key = serverEnv().RESEND_API_KEY;
  if (!key) throw new InboxNotConfiguredError();
  const response = await fetch(`${API}${path}`, {
    headers: { Authorization: `Bearer ${key}`, "User-Agent": "whu-halal-website/1.0", Accept: "application/json" },
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new Error(`Resend GET ${path.split("?")[0]} failed: HTTP ${response.status}`);
  return (await response.json()) as T;
}

export function listReceived(after?: string, limit = 50): Promise<List<ResendReceivedListItem>> {
  const query = new URLSearchParams({ limit: String(limit) });
  if (after) query.set("after", after);
  return get(`/emails/receiving?${query}`);
}

export function retrieveReceived(id: string): Promise<ResendReceivedEmail> {
  return get(`/emails/receiving/${encodeURIComponent(id)}?html_format=data_uri`);
}

export function listReceivedAttachments(id: string): Promise<List<ResendAttachment>> {
  return get(`/emails/receiving/${encodeURIComponent(id)}/attachments?limit=100`);
}

/** Signed attachment URL from Resend's CDN (valid for one hour). */
export async function downloadAttachment(url: string, maxBytes: number): Promise<Buffer | null> {
  const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(30_000) });
  if (!response.ok) return null;
  const length = Number(response.headers.get("content-length") ?? 0);
  if (length > maxBytes) return null;
  const body = Buffer.from(await response.arrayBuffer());
  return body.length > maxBytes ? null : body;
}
