"use client";

import { useAdminMessages } from "@/i18n/admin/client";
import { type CompanyFieldValues, EMPTY_COMPANY } from "./company-values";
import { inputClass, labelClass } from "./ui";

export type { CompanyFieldValues };

type FieldDef = { key: keyof CompanyFieldValues; required?: boolean; max: number; type?: string; className?: string };

const FIELDS: FieldDef[] = [
  { key: "name", required: true, max: 300, className: "md:col-span-2" },
  { key: "legalForm", max: 60 },
  { key: "registrationNo", max: 80 },
  { key: "address", required: true, max: 300, className: "md:col-span-2" },
  { key: "postalCode", max: 20 },
  { key: "city", max: 120 },
  { key: "country", required: true, max: 2 },
  { key: "contactPerson", max: 120 },
  { key: "email", max: 254, type: "email" },
  { key: "phone", max: 60, type: "tel" },
];

/**
 * Company inputs, used by the company form (uncontrolled, posted as FormData)
 * and by the certificate editor (controlled via `values` + `onChange`).
 */
export function CompanyFields({
  idPrefix,
  defaults,
  values,
  onChange,
  readOnly = false,
}: {
  idPrefix: string;
  defaults?: Partial<CompanyFieldValues>;
  values?: CompanyFieldValues;
  onChange?: (key: keyof CompanyFieldValues, value: string) => void;
  readOnly?: boolean;
}) {
  const t = useAdminMessages().companies;
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {FIELDS.map((f) => {
        const id = `${idPrefix}-${f.key}`;
        const controlled = values && onChange;
        return (
          <div key={f.key} className={f.className}>
            <label htmlFor={id} className={labelClass}>
              {t[f.key]}
              {f.required ? <span className="text-red-600"> *</span> : null}
            </label>
            <input
              id={id}
              name={f.key}
              type={f.type ?? "text"}
              required={f.required}
              maxLength={f.max}
              readOnly={readOnly}
              autoComplete="off"
              className={`${inputClass} ${f.key === "country" ? "w-24 uppercase" : ""} ${readOnly ? "bg-slate-50" : ""}`}
              {...(controlled
                ? { value: values[f.key], onChange: (e) => onChange(f.key, e.target.value) }
                : { defaultValue: defaults?.[f.key] ?? EMPTY_COMPANY[f.key] })}
            />
          </div>
        );
      })}
    </div>
  );
}
