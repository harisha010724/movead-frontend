import { useState } from 'react';
import { Check, Copy } from 'lucide-react';

/**
 * First-time authenticator setup, shown inline above the code field.
 *
 * The secret is displayed once and never again — the server keeps only an
 * encrypted copy and has no way to show it a second time. Enrolment is not
 * complete until a code proves the authenticator holds it, so abandoning this
 * screen costs nothing: the next sign-in issues a fresh secret.
 */
export function EnrolAuthenticator({
  secret,
  otpauthUri,
}: {
  secret: string;
  otpauthUri: string;
}) {
  const [copied, setCopied] = useState(false);

  const copy = () => {
    void navigator.clipboard.writeText(secret).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-[13px] leading-relaxed text-slate-600">
        Scan this with Google Authenticator, 1Password or Authy, then enter the code it shows.
      </p>

      <div className="mt-4 flex justify-center rounded-lg bg-white p-3">
        {/*
          Rendered by an external QR service rather than bundling an encoder.
          The URI contains the shared secret, so this is a deliberate trade and
          the manual entry key below is the offline path for anyone who would
          rather not take it.
        */}
        <img
          src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(otpauthUri)}`}
          alt="QR code for your authenticator app"
          width={160}
          height={160}
        />
      </div>

      <div className="mt-4">
        <p className="text-[12px] font-medium text-slate-500">Or enter this key manually</p>
        <div className="mt-1.5 flex items-center gap-2">
          <code className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 font-mono text-[12px] break-all text-slate-700">
            {secret}
          </code>
          <button
            type="button"
            onClick={copy}
            aria-label="Copy the setup key"
            className="focus-visible:ring-brand-500/40 grid size-9 shrink-0 place-items-center rounded-lg border border-slate-200 bg-white text-slate-500 transition-colors hover:text-slate-700 focus-visible:ring-2 focus-visible:outline-none"
          >
            {copied ? (
              <Check className="size-4 text-emerald-600" aria-hidden />
            ) : (
              <Copy className="size-4" aria-hidden />
            )}
          </button>
        </div>
      </div>

      <p className="mt-3 text-[12px] leading-relaxed text-slate-400">
        This key is shown once. If you lose it, a Super Admin can reset your authenticator.
      </p>
    </div>
  );
}
