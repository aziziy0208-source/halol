"use client";

import Link from "next/link";
import { useActionState, useRef, useState, useTransition } from "react";
import { Alert, buttonClass, labelClass } from "@/components/admin/ui";
import { useAdminMessages } from "@/i18n/admin/client";
import { type ImportState, legacyImportAction } from "./actions";

const SAMPLE = [
  "certificateNumber;revision;company;address;postalCode;city;country;scope;category;standards;products;issueDate;validUntil;auditDate;status",
  "H-202023.0042-1;0;Beispiel Gewürze GmbH;Musterstraße 1;80331;München;DE;Herstellung von Gewürzmischungen;Lebensmittel;OIC/SMIIC 1:2019;Curry|Paprika edelsüß;15.03.2023;14.03.2026;01.03.2023;ACTIVE",
].join("\r\n");

export function LegacyImportForm() {
  const messages = useAdminMessages();
  const t = messages.importer;
  const [file, setFile] = useState<File | null>(null);
  const [state, action, pending] = useActionState(legacyImportAction, { status: "idle" } as ImportState);
  const [, startTransition] = useTransition();
  const [lastMode, setLastMode] = useState<"check" | "run">("check");
  const [checkedFile, setCheckedFile] = useState<File | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const submit = (mode: "check" | "run") => {
    // Read the input itself: a file chosen before hydration never fired onChange.
    const file = inputRef.current?.files?.[0] ?? null;
    setFile(file);
    if (mode === "run" && !window.confirm(t.confirm)) return;
    const formData = new FormData();
    if (file) formData.set("file", file); // without a file the server answers "choose a file"
    formData.set("mode", mode);
    setLastMode(mode);
    if (mode === "check") setCheckedFile(file);
    startTransition(() => action(formData));
  };

  const downloadSample = () => {
    const url = URL.createObjectURL(new Blob(["\uFEFF" + SAMPLE], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "whu-legacy-import-sample.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  // The check result stays in `state` while the import runs, so the button can show progress.
  const canRun = state.status === "success" && !!state.ready && !state.imported && checkedFile === file;

  return (
    <div className="space-y-4 p-5">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor="legacy-file" className={labelClass}>
            {t.file}
          </label>
          <input
            id="legacy-file"
            ref={inputRef}
            type="file"
            accept=".csv,text/csv"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="block text-sm text-slate-600 file:mr-3 file:rounded file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-slate-700"
          />
        </div>
        <button type="button" disabled={pending} className={buttonClass.secondary} onClick={() => submit("check")}>
          {pending && lastMode === "check" ? t.checking : t.check}
        </button>
        {canRun ? (
          <button type="button" disabled={pending} className={buttonClass.primary} onClick={() => submit("run")}>
            {pending && lastMode === "run" ? t.importing : t.run(state.ready!)}
          </button>
        ) : null}
        <button type="button" className={`${buttonClass.link} ml-auto`} onClick={downloadSample}>
          {t.template}
        </button>
      </div>

      {state.status !== "idle" && state.message ? (
        <Alert tone={state.status === "error" ? "error" : "success"}>
          {state.message}
          {state.imported ? (
            <>
              {" "}
              <Link href="/admin/certificates" className="font-medium underline">
                {messages.nav.certificates}
              </Link>
            </>
          ) : null}
        </Alert>
      ) : null}

      {state.problems?.length ? (
        <div className="overflow-x-auto rounded-md border border-red-200">
          <table className="w-full text-left text-sm">
            <thead className="bg-red-50 text-xs text-red-800 uppercase">
              <tr>
                <th className="px-3 py-2 font-medium">{t.line}</th>
                <th className="px-3 py-2 font-medium">{messages.audit.details}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-red-100">
              {state.problems.map((p) => (
                <tr key={p.line}>
                  <td className="px-3 py-1.5 align-top tabular-nums">{p.line}</td>
                  <td className="px-3 py-1.5">{p.message}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {state.moreProblems ? <p className="px-3 py-2 text-xs text-red-800">{t.moreProblems(state.moreProblems)}</p> : null}
        </div>
      ) : null}

      {canRun && state.preview?.length ? (
        <div className="overflow-x-auto rounded-md border border-slate-200">
          <table className="w-full text-left text-sm">
            <caption className="px-3 py-2 text-left text-xs text-slate-500">{t.preview}</caption>
            <tbody className="divide-y divide-slate-100">
              {state.preview.map((r) => (
                <tr key={r.line}>
                  <td className="px-3 py-1.5 text-xs text-slate-400 tabular-nums">{r.line}</td>
                  <td className="px-3 py-1.5 font-mono">{r.number}</td>
                  <td className="px-3 py-1.5">{r.company}</td>
                  <td className="px-3 py-1.5 tabular-nums">{r.validUntil}</td>
                  <td className="px-3 py-1.5 text-xs">{r.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
