"use client";

import { type ReactNode, useEffect, useMemo, useState, useTransition } from "react";
import { CertificatePreview } from "@/components/admin/certificate-preview";
import { CompanyFields, type CompanyFieldValues } from "@/components/admin/company-fields";
import { Alert, buttonClass, Card, CardHeader, inputBase, inputClass, labelClass } from "@/components/admin/ui";
import type { CertificateDocument } from "@/certificates/document";
import { companyFieldsSchema, issueProblems, MAX_PRODUCTS } from "@/certificates/draft-schema";
import { renderCertificateHtml } from "@/certificates/templates";
import { useAdminMessages } from "@/i18n/admin/client";
import { addMonths } from "@/lib/dates";
import { companyLogoAction, saveEditorAction } from "./actions";
import { importProducts } from "./product-import";
import type { EditorData, EditorIntent, EditorResult, EditorState, ProductRow } from "./types";

const STEPS = ["company", "scope", "products", "dates", "signatory", "review"] as const;
type Step = (typeof STEPS)[number];

const newKey = () => crypto.randomUUID();
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Value that follows `value` after it stopped changing for `ms` (keeps the preview iframe calm while typing). */
function useDebounced<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return debounced;
}

function companyOf(s: EditorState, data: EditorData, companies: EditorData["companies"]): CertificateDocument["company"] {
  if (s.companyMode === "new") {
    const c = s.newCompany;
    return {
      name: c.name,
      legalForm: c.legalForm || null,
      address: c.address,
      postalCode: c.postalCode || null,
      city: c.city || null,
      country: c.country.toUpperCase(),
    };
  }
  const c = companies.find((x) => x.id === s.companyId);
  return c ?? { name: "", legalForm: null, address: "", postalCode: null, city: null, country: "DE" };
}

/** The template document for the live preview — same template and data shape as the PDF. */
function previewDocument(
  s: EditorState,
  data: EditorData,
  companies: EditorData["companies"],
  verification: CertificateDocument["verification"],
  companyLogo: string | null,
): CertificateDocument {
  const signatory = data.signatories.find((x) => x.id === s.signatoryId) ?? null;
  return {
    certificateNumber: data.certificateNumber,
    revision: data.revision,
    isDraft: true,
    watermark: "draft",
    company: companyOf(s, data, companies),
    productionSite: s.productionSite.trim() || null,
    scope: s.scope,
    category: s.category.trim() || null,
    standards: data.standards
      .filter((x) => s.standardIds.includes(x.id))
      .map((x) => ({ code: x.code, title: x.title }))
      .sort((a, b) => a.code.localeCompare(b.code)),
    products: s.products
      .filter((p) => p.name.trim())
      .map((p) => ({
        name: p.name.trim(),
        brand: p.brand.trim() || null,
        articleNo: p.articleNo.trim() || null,
        description: p.description.trim() || null,
      })),
    issueDate: ISO_DATE.test(s.issueDate) ? s.issueDate : null,
    validUntil: ISO_DATE.test(s.validUntil) ? s.validUntil : null,
    auditDate: ISO_DATE.test(s.auditDate) ? s.auditDate : null,
    signatory: signatory ? { name: signatory.name, title: signatory.title } : null,
    images: { signature: signatory?.signature ?? null, stamp: signatory?.stamp ?? null, companyLogo },
    verification,
  };
}

function toPayload(s: EditorState, draftId: string | null) {
  return {
    id: draftId,
    company: s.companyMode === "existing" ? { mode: "existing", companyId: s.companyId } : { mode: "new", fields: s.newCompany },
    productionSite: s.productionSite,
    scope: s.scope,
    category: s.category,
    standardIds: s.standardIds,
    products: s.products
      .filter((p) => p.name.trim())
      .map((p) => ({ name: p.name, brand: p.brand, articleNo: p.articleNo, description: p.description })),
    issueDate: s.issueDate || null,
    validUntil: s.validUntil || null,
    auditDate: s.auditDate || null,
    signatoryId: s.signatoryId || null,
    notes: s.notes,
  };
}

function Field({ id, label, hint, children }: { id: string; label: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className={labelClass}>
        {label}
      </label>
      {children}
      {hint ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
    </div>
  );
}

export function CertificateEditor({ data }: { data: EditorData }) {
  const messages = useAdminMessages();
  const t = messages.editor;
  const tw = messages.workflow;
  const [s, setS] = useState<EditorState>(data.initial);
  const [step, setStep] = useState<Step>("company");
  const [draftId, setDraftId] = useState(data.draftId);
  const [companies, setCompanies] = useState(data.companies);
  const [verification, setVerification] = useState(data.verification);
  // Logos of existing companies, loaded on demand for the preview (data: URIs).
  const [logos, setLogos] = useState<Record<string, string | null>>({});
  const [result, setResult] = useState<EditorResult | null>(null);
  const [busy, setBusy] = useState<EditorIntent | null>(null);
  const [dirty, setDirty] = useState(false);
  const [filter, setFilter] = useState("");
  const [importNote, setImportNote] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [, startTransition] = useTransition();

  const update = (patch: Partial<EditorState>) => {
    setS((prev) => ({ ...prev, ...patch }));
    setDirty(true);
  };

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const logoCompanyId = s.companyMode === "existing" ? s.companyId : "";
  useEffect(() => {
    if (!logoCompanyId || logoCompanyId in logos) return;
    let cancelled = false;
    companyLogoAction(logoCompanyId).then(
      (logo) => {
        if (!cancelled) setLogos((prev) => ({ ...prev, [logoCompanyId]: logo }));
      },
      () => undefined,
    );
    return () => {
      cancelled = true;
    };
  }, [logoCompanyId, logos]);
  const companyLogo = logoCompanyId ? (logos[logoCompanyId] ?? null) : null;

  const debounced = useDebounced(s, 350);
  const html = useMemo(
    () =>
      renderCertificateHtml(data.templateVersion, previewDocument(debounced, data, companies, verification, companyLogo), {
        assetBase: "",
        mode: "preview",
      }),
    [debounced, data, companies, verification, companyLogo],
  );

  const problems = useMemo(() => {
    const list: string[] = issueProblems({
      scope: s.scope,
      standardIds: s.standardIds,
      issueDate: s.issueDate || null,
      validUntil: s.validUntil || null,
      signatoryId: s.signatoryId || null,
    }).map((p) => messages.problems[p]);
    if (s.companyMode === "existing" && !s.companyId) list.unshift(t.companyMissing);
    return list;
  }, [s, t.companyMissing, messages.problems]);

  const issueBlockedByFourEyes = data.fourEyes && data.isCreator;
  const mayIssue = data.canIssue && !issueBlockedByFourEyes;

  const filteredCompanies = useMemo(() => {
    const q = filter.trim().toLowerCase();
    const list = q
      ? companies.filter((c) => `${c.name} ${c.postalCode ?? ""} ${c.city ?? ""}`.toLowerCase().includes(q))
      : companies;
    return list.slice(0, 300);
  }, [companies, filter]);

  function precheck(): string | null {
    if (s.companyMode === "existing" && !s.companyId) {
      setStep("company");
      return t.companyMissing;
    }
    if (s.companyMode === "new" && !companyFieldsSchema.safeParse(s.newCompany).success) {
      setStep("company");
      return t.companyInvalid;
    }
    return null;
  }

  function run(intent: EditorIntent) {
    if (intent === "issue" && !window.confirm(t.confirmIssue)) return;
    const pre = precheck();
    if (pre) {
      setResult({ ok: false, message: pre });
      return;
    }
    setBusy(intent);
    setResult(null);
    const payload = toPayload(s, draftId);
    const companyFields: CompanyFieldValues = s.newCompany;
    startTransition(async () => {
      let res: EditorResult;
      try {
        res = await saveEditorAction(payload, intent);
      } catch {
        res = { ok: false, message: messages.common.unexpected };
      }
      if (res.id && res.id !== draftId) {
        setDraftId(res.id);
        window.history.replaceState(null, "", `/admin/certificates/${res.id}/edit`);
      }
      if (res.saved) {
        const saved = res.saved;
        setVerification(saved.verification);
        if (payload.company.mode === "new") {
          // The company exists now: further saves must not create it again.
          setCompanies((list) =>
            list.some((c) => c.id === saved.companyId)
              ? list
              : [
                  ...list,
                  {
                    id: saved.companyId,
                    name: companyFields.name.trim(),
                    legalForm: companyFields.legalForm.trim() || null,
                    address: companyFields.address.trim(),
                    postalCode: companyFields.postalCode.trim() || null,
                    city: companyFields.city.trim() || null,
                    country: companyFields.country.trim().toUpperCase(),
                  },
                ].sort((a, b) => a.name.localeCompare(b.name)),
          );
          setS((prev) => ({ ...prev, companyMode: "existing", companyId: saved.companyId }));
        }
      }
      if (res.id) setDirty(false);
      if (res.ok && res.redirectTo) {
        window.location.assign(res.redirectTo);
        return;
      }
      setResult(res);
      setBusy(null);
    });
  }

  // ─── Products ────────────────────────────────────────────────────────────
  const setProduct = (key: string, patch: Partial<ProductRow>) =>
    update({ products: s.products.map((p) => (p.key === key ? { ...p, ...patch } : p)) });

  async function onImport(file: File | undefined) {
    if (!file) return;
    const imported = await importProducts(file);
    if ("error" in imported) {
      setImportNote({ tone: "error", text: imported.error === "noNameColumn" ? t.products.noNameColumn : t.products.importFailed });
      return;
    }
    const room = MAX_PRODUCTS - s.products.length;
    if (imported.products.length > room) {
      setImportNote({ tone: "error", text: t.products.tooMany(MAX_PRODUCTS) });
      return;
    }
    update({ products: [...s.products, ...imported.products.map((p) => ({ ...p, key: newKey() }))] });
    setImportNote({ tone: "success", text: t.products.imported(imported.products.length, imported.skipped) });
  }

  // ─── Steps ───────────────────────────────────────────────────────────────
  const stepIndex = STEPS.indexOf(step);
  const selectedCompany = companies.find((c) => c.id === s.companyId);

  const panels: Record<Step, ReactNode> = {
    company: (
      <div className="space-y-4">
        <fieldset className="flex flex-wrap gap-4 text-sm">
          <legend className="sr-only">{t.steps.company}</legend>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="companyMode"
              checked={s.companyMode === "existing"}
              onChange={() => update({ companyMode: "existing" })}
              className="accent-brand-ink"
            />
            {t.company.existing}
          </label>
          {data.canCreateCompany ? (
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="companyMode"
                checked={s.companyMode === "new"}
                onChange={() => update({ companyMode: "new" })}
                className="accent-brand-ink"
              />
              {t.company.new}
            </label>
          ) : null}
        </fieldset>
        {s.companyMode === "existing" ? (
          <div className="space-y-2">
            <Field id="company-filter" label={t.company.filter}>
              <input
                id="company-filter"
                type="search"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className={inputClass}
                autoComplete="off"
              />
            </Field>
            <Field id="company-select" label={t.company.choose}>
              <select
                id="company-select"
                size={8}
                value={s.companyId}
                onChange={(e) => update({ companyId: e.target.value })}
                className={`${inputClass} py-1`}
              >
                {selectedCompany && !filteredCompanies.includes(selectedCompany) ? (
                  <option value={selectedCompany.id}>{selectedCompany.name}</option>
                ) : null}
                {filteredCompanies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} — {[c.postalCode, c.city].filter(Boolean).join(" ")}, {c.country}
                  </option>
                ))}
              </select>
            </Field>
            {filteredCompanies.length === 0 ? <p className="text-xs text-slate-500">{t.company.noMatch}</p> : null}
            {selectedCompany ? (
              <p className="rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-700">
                <span className="font-medium">{selectedCompany.name}</span>
                <br />
                {selectedCompany.address}, {[selectedCompany.postalCode, selectedCompany.city].filter(Boolean).join(" ")},{" "}
                {selectedCompany.country}
              </p>
            ) : null}
          </div>
        ) : (
          <CompanyFields
            idPrefix="new-company"
            values={s.newCompany}
            onChange={(key, value) => update({ newCompany: { ...s.newCompany, [key]: value } })}
          />
        )}
      </div>
    ),
    scope: (
      <div className="space-y-4">
        <Field id="scope" label={t.scope.scope} hint={t.scope.scopeHint}>
          <textarea
            id="scope"
            rows={3}
            maxLength={1000}
            value={s.scope}
            onChange={(e) => update({ scope: e.target.value })}
            className={inputClass}
          />
        </Field>
        <div className="grid gap-4 md:grid-cols-2">
          <Field id="category" label={t.scope.category} hint={t.scope.categoryHint}>
            <input
              id="category"
              maxLength={200}
              value={s.category}
              onChange={(e) => update({ category: e.target.value })}
              className={inputClass}
            />
          </Field>
          <Field id="productionSite" label={t.scope.productionSite}>
            <input
              id="productionSite"
              maxLength={500}
              value={s.productionSite}
              onChange={(e) => update({ productionSite: e.target.value })}
              className={inputClass}
            />
          </Field>
        </div>
        <fieldset>
          <legend className={labelClass}>{t.scope.standards}</legend>
          {data.standards.length === 0 ? <p className="text-sm text-amber-700">{t.scope.noStandards}</p> : null}
          <div className="space-y-1.5">
            {data.standards.map((st) => (
              <label key={st.id} className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={s.standardIds.includes(st.id)}
                  onChange={(e) =>
                    update({
                      standardIds: e.target.checked ? [...s.standardIds, st.id] : s.standardIds.filter((x) => x !== st.id),
                    })
                  }
                  className="mt-0.5 h-4 w-4 accent-brand-ink"
                />
                <span>
                  <span className="font-medium">{st.code}</span> — <span className="text-slate-600">{st.title}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      </div>
    ),
    products: (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className={buttonClass.secondary}
            disabled={s.products.length >= MAX_PRODUCTS}
            onClick={() => update({ products: [...s.products, { key: newKey(), name: "", brand: "", articleNo: "", description: "" }] })}
          >
            + {t.products.add}
          </button>
          <label className={`${buttonClass.secondary} cursor-pointer`}>
            {t.products.import}
            <input
              type="file"
              accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              className="sr-only"
              onChange={(e) => {
                void onImport(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
          </label>
          {s.products.length ? (
            <button
              type="button"
              className={buttonClass.danger}
              onClick={() => {
                if (window.confirm(t.products.confirmRemoveAll)) update({ products: [] });
              }}
            >
              {t.products.removeAll}
            </button>
          ) : null}
          <span className="ml-auto text-sm text-slate-500 tabular-nums">{t.products.count(s.products.length)}</span>
        </div>
        <p className="text-xs text-slate-500">{t.products.importHint}</p>
        {importNote ? <Alert tone={importNote.tone}>{importNote.text}</Alert> : null}
        {s.products.length === 0 ? (
          <p className="text-sm text-slate-500">{t.products.empty}</p>
        ) : (
          <div className="max-h-[60vh] overflow-auto rounded-md border border-slate-200">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 bg-slate-50 text-xs text-slate-500 uppercase">
                <tr>
                  <th className="w-8 px-2 py-2 font-medium">#</th>
                  <th className="min-w-48 px-2 py-2 font-medium">{t.products.name} *</th>
                  <th className="min-w-28 px-2 py-2 font-medium">{t.products.brand}</th>
                  <th className="min-w-24 px-2 py-2 font-medium">{t.products.articleNo}</th>
                  <th className="min-w-40 px-2 py-2 font-medium">{t.products.description}</th>
                  <th className="px-2 py-2">
                    <span className="sr-only">{t.products.remove}</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {s.products.map((p, i) => (
                  <tr key={p.key}>
                    <td className="px-2 py-1 text-xs text-slate-400 tabular-nums">{i + 1}</td>
                    {(["name", "brand", "articleNo", "description"] as const).map((field) => (
                      <td key={field} className="px-1 py-1">
                        <input
                          aria-label={`${t.products[field]} ${i + 1}`}
                          value={p[field]}
                          maxLength={field === "name" ? 300 : field === "description" ? 500 : 120}
                          onChange={(e) => setProduct(p.key, { [field]: e.target.value })}
                          className={`${inputBase} w-full px-2 py-1`}
                        />
                      </td>
                    ))}
                    <td className="px-1 py-1">
                      <button
                        type="button"
                        aria-label={`${t.products.remove} ${i + 1}`}
                        className="rounded px-2 py-1 text-red-700 hover:bg-red-50"
                        onClick={() => update({ products: s.products.filter((x) => x.key !== p.key) })}
                      >
                        ×
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    ),
    dates: (
      <div className="grid gap-4 md:grid-cols-3">
        <Field id="issueDate" label={t.dates.issueDate}>
          <input
            id="issueDate"
            type="date"
            value={s.issueDate}
            onChange={(e) => {
              const issueDate = e.target.value;
              const follow = !s.validUntilTouched && ISO_DATE.test(issueDate);
              update({ issueDate, ...(follow ? { validUntil: addMonths(issueDate, data.defaultValidityMonths) } : {}) });
            }}
            className={inputClass}
          />
        </Field>
        <Field id="validUntil" label={t.dates.validUntil} hint={t.dates.validUntilHint(data.defaultValidityMonths)}>
          <input
            id="validUntil"
            type="date"
            value={s.validUntil}
            onChange={(e) => update({ validUntil: e.target.value, validUntilTouched: true })}
            className={inputClass}
          />
        </Field>
        <Field id="auditDate" label={t.dates.auditDate}>
          <input
            id="auditDate"
            type="date"
            value={s.auditDate}
            onChange={(e) => update({ auditDate: e.target.value })}
            className={inputClass}
          />
        </Field>
      </div>
    ),
    signatory: (
      <div className="space-y-4">
        <fieldset>
          <legend className={labelClass}>{t.signatory.label}</legend>
          {data.signatories.length === 0 ? <p className="text-sm text-amber-700">{t.signatory.none}</p> : null}
          <div className="space-y-2">
            {data.signatories.map((sg) => (
              <label
                key={sg.id}
                className={`flex items-center gap-3 rounded-md border px-3 py-2 text-sm ${
                  s.signatoryId === sg.id ? "border-brand bg-sky-50" : "border-slate-200"
                }`}
              >
                <input
                  type="radio"
                  name="signatory"
                  checked={s.signatoryId === sg.id}
                  onChange={() => update({ signatoryId: sg.id })}
                  className="accent-brand-ink"
                />
                <span className="flex-1">
                  <span className="font-medium">{sg.name}</span>
                  <span className="block text-xs text-slate-500">{sg.title}</span>
                  {!sg.signature && !sg.stamp ? (
                    <span className="block text-xs text-amber-700">{t.signatory.missingImages}</span>
                  ) : null}
                </span>
                {[sg.signature, sg.stamp].map((src, i) =>
                  src ? (
                    // eslint-disable-next-line @next/next/no-img-element -- private data: URI
                    <img
                      key={i}
                      src={src}
                      alt={i === 0 ? t.signatory.signature : t.signatory.stamp}
                      className="h-10 w-16 object-contain"
                    />
                  ) : null,
                )}
              </label>
            ))}
          </div>
        </fieldset>
        <Field id="notes" label={t.signatory.notes}>
          <textarea
            id="notes"
            rows={3}
            maxLength={2000}
            value={s.notes}
            onChange={(e) => update({ notes: e.target.value })}
            className={inputClass}
          />
        </Field>
      </div>
    ),
    review: (
      <div className="space-y-4 text-sm">
        {problems.length === 0 ? (
          <Alert tone="success">{t.review.ready}</Alert>
        ) : (
          <Alert tone="info">
            <p className="font-medium">{t.review.problems}</p>
            <ul className="mt-1 list-disc pl-5">
              {problems.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          </Alert>
        )}
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5">
          <dt className="text-slate-500">{t.steps.company}</dt>
          <dd>{companyOf(s, data, companies).name || "—"}</dd>
          <dt className="text-slate-500">{tw.standards}</dt>
          <dd>
            {data.standards
              .filter((x) => s.standardIds.includes(x.id))
              .map((x) => x.code)
              .join(", ") || "—"}
          </dd>
          <dt className="text-slate-500">{t.steps.products}</dt>
          <dd>{t.products.count(s.products.filter((p) => p.name.trim()).length)}</dd>
          <dt className="text-slate-500">{t.dates.validUntil}</dt>
          <dd>{s.validUntil || "—"}</dd>
          <dt className="text-slate-500">{t.signatory.label}</dt>
          <dd>{data.signatories.find((x) => x.id === s.signatoryId)?.name ?? "—"}</dd>
        </dl>
        {!data.canIssue ? <p className="text-slate-600">{t.review.issuerHint}</p> : null}
        {data.canIssue && issueBlockedByFourEyes ? <p className="text-slate-600">{t.review.fourEyes}</p> : null}
        <div className="flex flex-wrap gap-2 border-t border-slate-200 pt-4">
          <button
            type="button"
            disabled={busy !== null || problems.length > 0}
            onClick={() => run("submit")}
            className={mayIssue ? buttonClass.secondary : buttonClass.primary}
          >
            {t.submit}
          </button>
          {mayIssue ? (
            <button
              type="button"
              disabled={busy !== null || problems.length > 0}
              onClick={() => run("issue")}
              className={buttonClass.primary}
            >
              {busy === "issue" ? t.issuing : t.issue}
            </button>
          ) : null}
        </div>
      </div>
    ),
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
      <div className="min-w-0 space-y-4">
        {data.revision > 0 && data.certificateNumber ? (
          <Alert tone="info">{t.revisionNote(data.certificateNumber, data.revision)}</Alert>
        ) : null}
        {data.status === "PENDING_APPROVAL" ? <Alert tone="info">{t.returnedNote}</Alert> : null}

        <nav aria-label={t.stepOf(stepIndex + 1, STEPS.length)}>
          <ol className="flex flex-wrap gap-1.5">
            {STEPS.map((key, i) => (
              <li key={key}>
                <button
                  type="button"
                  onClick={() => setStep(key)}
                  aria-current={key === step ? "step" : undefined}
                  className={`rounded-full px-3 py-1.5 text-xs font-medium ${
                    key === step ? "bg-brand-ink text-white" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"
                  }`}
                >
                  {i + 1}. {t.steps[key]}
                </button>
              </li>
            ))}
          </ol>
        </nav>

        <Card>
          <CardHeader title={`${stepIndex + 1}. ${t.steps[step]}`}>
            <span className="text-xs text-slate-500">{t.stepOf(stepIndex + 1, STEPS.length)}</span>
          </CardHeader>
          <div className="p-5">{panels[step]}</div>
          <div className="flex flex-wrap items-center gap-2 border-t border-slate-200 px-5 py-3">
            <button
              type="button"
              className={buttonClass.secondary}
              disabled={stepIndex === 0}
              onClick={() => setStep(STEPS[stepIndex - 1]!)}
            >
              ← {t.back}
            </button>
            {stepIndex < STEPS.length - 1 ? (
              <button type="button" className={buttonClass.secondary} onClick={() => setStep(STEPS[stepIndex + 1]!)}>
                {t.next} →
              </button>
            ) : null}
            <button type="button" className={`${buttonClass.primary} ml-auto`} disabled={busy !== null} onClick={() => run("save")}>
              {busy === "save" ? t.saving : t.save}
            </button>
          </div>
        </Card>

        {result ? (
          <Alert tone={result.ok ? "success" : "error"}>
            {result.message}
            {!result.ok && result.issues?.length ? (
              <ul className="mt-1 list-disc pl-5 text-xs">
                {result.issues.map((i) => (
                  <li key={i}>{i}</li>
                ))}
              </ul>
            ) : null}
          </Alert>
        ) : null}
        {busy === "issue" ? <Alert tone="info">{tw.issuing}</Alert> : null}

        <button type="button" className={`${buttonClass.secondary} xl:hidden`} onClick={() => setShowPreview((v) => !v)}>
          {showPreview ? t.hidePreview : t.showPreview}
        </button>
      </div>

      <div className={`${showPreview ? "" : "hidden"} min-w-0 xl:block`}>
        <Card className="xl:sticky xl:top-4">
          <CardHeader title={t.preview}>
            <span className="text-xs text-slate-500">{t.previewHint}</span>
          </CardHeader>
          <div className="p-3">
            <CertificatePreview html={html} title={t.preview} />
          </div>
        </Card>
      </div>
    </div>
  );
}
