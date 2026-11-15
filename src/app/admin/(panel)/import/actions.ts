"use server";

import { refresh } from "next/cache";
import { importLegacyRows, parseLegacyCsv } from "@/certificates/legacy-import";
import { adminT } from "@/i18n/admin/server";
import { actionContext, errorState, text } from "@/lib/admin-actions";

// 4 MB: serverless hosts (Vercel) reject request bodies above 4.5 MB.
const MAX_FILE_BYTES = 4 * 1024 * 1024;
const MAX_LISTED_PROBLEMS = 50;

export type ImportState = {
  status: "idle" | "success" | "error";
  message?: string;
  missingColumns?: string[];
  problems?: { line: number; message: string }[];
  moreProblems?: number;
  /** Valid rows when the file has no problems. */
  ready?: number;
  preview?: { line: number; number: string; company: string; validUntil: string; status: string }[];
  imported?: number;
};

/**
 * Legacy CSV import (permission import.run). mode=check validates only; mode=run
 * validates again and imports all rows in one transaction, or nothing.
 */
export async function legacyImportAction(_prev: ImportState, formData: FormData): Promise<ImportState> {
  const t = (await adminT()).importer;
  const access = await actionContext("import.run");
  if (!access.ok) return { status: "error", message: access.state.message };
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { status: "error", message: t.noFile };
  if (file.size > MAX_FILE_BYTES) return { status: "error", message: t.tooLarge };
  const mode = text(formData, "mode") === "run" ? "run" : "check";

  try {
    const parsed = await parseLegacyCsv(await file.text());
    if (parsed.missingColumns.length) return { status: "error", message: t.missingColumns(parsed.missingColumns) };
    if (parsed.errors.length) {
      return {
        status: "error",
        message: t.problems(parsed.errors.length),
        problems: parsed.errors.slice(0, MAX_LISTED_PROBLEMS),
        moreProblems: Math.max(0, parsed.errors.length - MAX_LISTED_PROBLEMS),
      };
    }
    if (parsed.rows.length === 0) return { status: "error", message: t.empty };
    if (mode === "check") {
      return {
        status: "success",
        message: t.ready(parsed.rows.length),
        ready: parsed.rows.length,
        preview: parsed.rows.slice(0, 8).map((r) => ({
          line: r.line,
          number: r.revision ? `${r.certificateNumber} / Rev. ${r.revision}` : r.certificateNumber,
          company: r.company.name,
          validUntil: r.validUntil,
          status: r.status,
        })),
      };
    }
    const imported = await importLegacyRows(parsed.rows, access.ctx);
    refresh();
    return { status: "success", message: t.done(imported), imported };
  } catch (error) {
    const state = await errorState(error);
    return { status: "error", message: state.message };
  }
}
