import type { Metadata } from "next";
import { redirect } from "next/navigation";
import QRCode from "qrcode";
import { Suspense } from "react";
import { HardRedirect } from "@/components/admin/hard-redirect";
import { buttonClass, Spinner } from "@/components/admin/ui";
import { adminT } from "@/i18n/admin/server";
import { decryptSecret, encryptSecret } from "@/lib/auth/crypto";
import { getSession } from "@/lib/auth/current-user";
import { safeNextPath } from "@/lib/auth/login";
import { requiresTwoFactor } from "@/lib/auth/permissions";
import { formatSecretForDisplay, generateTotpSecret, otpauthUri } from "@/lib/auth/totp";
import { prisma } from "@/lib/db";
import { CodeForm, LogoutButton } from "../../forms";

export const metadata: Metadata = { title: "Set up two-factor authentication" };

export default function TwoFactorSetupPage({ searchParams }: PageProps<"/admin/2fa/setup">) {
  return (
    <Suspense fallback={<Spinner />}>
      <SetupStep searchParams={searchParams} />
    </Suspense>
  );
}

async function SetupStep({ searchParams }: Pick<PageProps<"/admin/2fa/setup">, "searchParams">) {
  const t = (await adminT());
  const session = await getSession();
  if (!session) redirect("/admin/login");
  const { user } = session;
  const next = safeNextPath((await searchParams).next);
  // Already enrolled — also the state right after a successful setup (the action
  // re-renders this page). Re-enrolment over an existing authenticator needs a
  // super-admin reset first, so this page never shows a new secret then.
  if (user.totpEnabledAt) {
    if (!session.twoFactorVerified) redirect("/admin/2fa");
    const to = user.mustChangePassword ? "/admin/account?required=password" : next;
    return <HardRedirect to={to} label={t.common.redirecting} />;
  }

  // The secret lives (encrypted) in this session until the user confirms a code.
  // Conditional write: if two tabs load at once, only the first secret is kept and both show it.
  let sealed = session.pendingTotpSecret;
  if (!sealed) {
    const candidate = encryptSecret(generateTotpSecret());
    await prisma.session.updateMany({
      where: { id: session.id, pendingTotpSecret: null },
      data: { pendingTotpSecret: candidate },
    });
    const stored = await prisma.session.findUnique({ where: { id: session.id }, select: { pendingTotpSecret: true } });
    if (!stored?.pendingTotpSecret) redirect("/admin/login");
    sealed = stored.pendingTotpSecret;
  }
  const secret = decryptSecret(sealed);
  const uri = otpauthUri(secret, user.email, t.appName);
  const qrSvg = await QRCode.toString(uri, { type: "svg", errorCorrectionLevel: "M", margin: 1, width: 200 });

  return (
    <>
      <h1 className="mb-1 font-sans text-xl font-semibold text-slate-900">{t.twoFactor.setupTitle}</h1>
      {requiresTwoFactor({ role: user.role, totpEnabledAt: null }) ? (
        <p className="mb-3 text-sm text-slate-500">{t.twoFactor.setupRequired}</p>
      ) : null}
      <ol className="mb-4 list-decimal space-y-1 pl-5 text-sm text-slate-700">
        {t.twoFactor.setupSteps.map((stepText) => (
          <li key={stepText}>{stepText}</li>
        ))}
      </ol>
      <div
        className="mx-auto mb-3 h-[200px] w-[200px]"
        role="img"
        aria-label="QR code for the authenticator app"
        // SVG generated on our server from the otpauth URI above.
        dangerouslySetInnerHTML={{ __html: qrSvg }}
      />
      <p className="mb-1 text-xs text-slate-500">{t.twoFactor.manualKey}</p>
      <p className="mb-5 rounded bg-slate-100 px-3 py-2 text-center font-mono text-sm tracking-wider break-all text-slate-800 select-all">
        {formatSecretForDisplay(secret)}
      </p>
      <CodeForm
        mode="setup"
        next={next}
        labels={{ code: t.twoFactor.code, submit: t.twoFactor.confirm, submitting: t.twoFactor.submitting }}
      />
      {!session.twoFactorVerified ? (
        <div className="mt-4 text-center">
          <LogoutButton label={t.twoFactor.signOut} className={buttonClass.link} />
        </div>
      ) : null}
    </>
  );
}
