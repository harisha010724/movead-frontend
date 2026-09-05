import { type ComponentType, type ReactNode } from 'react';
import { Check } from 'lucide-react';
import { AuthArtwork } from './AuthArtwork';
import { PositioningText } from './Positioning';

/**
 * The signed-out shell: brand panel on the left, whatever you have to do on the
 * right.
 *
 * Shared by signing in and by accepting an invitation because those are the two
 * screens a customer can meet before they have an account, and the second is
 * quite literally their first impression of MoveAd. A set-password page that
 * looked like a different product would read as a phishing attempt — which is
 * exactly the instinct we want people to have about links in email.
 */
export interface AuthLayoutProps {
  icon: ComponentType<{ className?: string }>;
  wordmark: string;
  tagline: string;
  /** Supporting paragraph under the positioning line. */
  pitch: string;
  /** Three short proof points beneath the pitch. */
  points: readonly string[];
  footnote: ReactNode;
  children: ReactNode;
}

export function AuthLayout({
  icon: Icon,
  wordmark,
  tagline,
  pitch,
  points,
  footnote,
  children,
}: AuthLayoutProps) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
      <aside className="relative hidden overflow-hidden bg-sidebar lg:block">
        <AuthArtwork />
        {/*
          Keeps the copy legible wherever a route happens to be passing. Only
          over the lower half: across the whole panel it dimmed the map itself
          and turned the white vehicles grey.
        */}
        <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-sidebar via-sidebar/75 to-transparent" />

        <div className="relative flex h-full flex-col justify-between p-10 xl:p-12">
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-xl bg-brand-500">
              <Icon className="size-5 text-white" />
            </div>
            <span className="text-[17px] font-semibold tracking-tight text-white">
              {wordmark}
            </span>
          </div>

          <div>
            {/*
              Unclamped so the headline can use the whole panel. Held to a
              narrower measure it broke into three or four short lines with
              half the panel left empty. The body below keeps a readable
              measure, which is a different constraint from the headline's.
            */}
            <h2 className="text-[27px] leading-[1.25] font-semibold tracking-tight text-white">
              <PositioningText accentClassName="text-brand-300" />
            </h2>
            <p className="mt-5 max-w-lg text-[15px] leading-relaxed text-slate-300">{pitch}</p>

            <ul className="mt-8 space-y-3">
              {points.map((point) => (
                <li key={point} className="flex items-center gap-3 text-[13px] text-slate-300">
                  <span className="grid size-5 shrink-0 place-items-center rounded-full bg-brand-500/20">
                    <Check className="size-3 text-brand-300" aria-hidden />
                  </span>
                  {point}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </aside>

      <main className="flex items-center justify-center bg-white px-6 py-12">
        <div className="w-full max-w-sm">
          {/*
            The brand panel is hidden on small screens, so the mark and the
            positioning line move here rather than being lost with it.
          */}
          <div className="mb-9 lg:hidden">
            <div className="flex items-center gap-3">
              <div className="grid size-10 place-items-center rounded-xl bg-brand-500">
                <Icon className="size-5 text-white" />
              </div>
              <div>
                <p className="text-[17px] leading-tight font-semibold tracking-tight text-slate-900">
                  {wordmark}
                </p>
                <p className="text-[12px] text-slate-500">{tagline}</p>
              </div>
            </div>

            <p className="mt-5 text-[13px] leading-relaxed text-slate-500">
              <PositioningText accentClassName="text-brand-600 font-medium" />
            </p>
          </div>

          {children}

          <p className="mt-10 text-[12px] leading-relaxed text-slate-400">{footnote}</p>
        </div>
      </main>
    </div>
  );
}
