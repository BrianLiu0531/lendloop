import { Show, SignInButton, SignUpButton, UserButton } from "@clerk/nextjs";
import { Suspense } from "react";
import {
  ArrowRight,
  BellRing,
  CalendarCheck2,
  HandHeart,
  ShieldCheck,
} from "lucide-react";
import { Logo } from "@/components/logo";
import { PublicToolList } from "@/components/public-tool-list";
import { buttonClass } from "@/components/ui/button-class";
import { ButtonLink } from "@/components/ui/primitives";

const STEPS = [
  {
    icon: HandHeart,
    title: "List what's in your garage",
    body: "Ladders, drills, a tent you use once a year. Add it in thirty seconds.",
  },
  {
    icon: CalendarCheck2,
    title: "Request the dates you need",
    body: "Neighbors ask for a window; you approve or decline with one tap.",
  },
  {
    icon: BellRing,
    title: "Reminders handle the awkward part",
    body: "Everyone gets notified automatically, and late returns get a friendly nudge.",
  },
];

export default function LandingPage() {
  return (
    <div className="flex min-h-full flex-col">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-5 sm:px-8">
        <Logo />
        <nav className="flex items-center gap-2">
          {/* Show reads the request's auth state, so it streams in under Suspense
              while the rest of the page stays static. */}
          <Suspense fallback={<div className="h-10 w-40" aria-hidden />}>
            <Show when="signed-out">
              <SignInButton mode="modal" forceRedirectUrl="/board">
                <button className={buttonClass("ghost", "md")}>Sign in</button>
              </SignInButton>
              <SignUpButton mode="modal" forceRedirectUrl="/board">
                <button className={buttonClass("secondary", "md")}>Join</button>
              </SignUpButton>
            </Show>
            <Show when="signed-in">
              <ButtonLink href="/board" variant="secondary">
                Open the board
              </ButtonLink>
              <UserButton />
            </Show>
          </Suspense>
        </nav>
      </header>

      <main className="flex-1">
        <section className="relative overflow-hidden">
          <div
            className="bg-grain absolute inset-0 [mask-image:linear-gradient(to_bottom,black,transparent)]"
            aria-hidden
          />
          <div className="relative mx-auto max-w-6xl px-5 pb-20 pt-14 sm:px-8 sm:pt-24">
            <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1 text-sm text-ink-soft">
              <span className="size-1.5 rounded-full bg-brand" aria-hidden />A
              tool library for your street
            </p>
            <h1 className="max-w-3xl font-display text-5xl leading-[1.05] tracking-tight text-ink sm:text-7xl">
              Borrow what you need.{" "}
              <span className="italic text-brand">
                Lend what you don&apos;t.
              </span>
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-ink-soft">
              LendLoop is a neighborhood lending board. Share the tools
              gathering dust in your shed, borrow the ones you need for a
              weekend — no buying, no storing, no awkward follow-ups.
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-3">
              <Suspense fallback={<div className="h-12 w-64" aria-hidden />}>
                <Show when="signed-out">
                  <SignInButton mode="modal" forceRedirectUrl="/board">
                    <button className={buttonClass("primary", "lg")}>
                      Sign in to lend or borrow
                      <ArrowRight className="size-4" aria-hidden />
                    </button>
                  </SignInButton>
                </Show>
                <Show when="signed-in">
                  <ButtonLink href="/board" size="lg">
                    Go to the board
                    <ArrowRight className="size-4" aria-hidden />
                  </ButtonLink>
                </Show>
              </Suspense>
              <a href="#shelf" className={buttonClass("ghost", "lg")}>
                See what&apos;s available
              </a>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-5 sm:px-8">
          <ol className="grid gap-4 sm:grid-cols-3">
            {STEPS.map((step, i) => (
              <li
                key={step.title}
                className="rounded-2xl border border-line bg-surface p-6 shadow-[var(--shadow-card)]"
              >
                <div className="mb-4 flex items-center justify-between">
                  <span className="flex size-10 items-center justify-center rounded-xl bg-brand-soft text-brand">
                    <step.icon className="size-5" aria-hidden />
                  </span>
                  <span className="font-display text-3xl text-line-strong">
                    0{i + 1}
                  </span>
                </div>
                <h2 className="font-display text-xl text-ink">{step.title}</h2>
                <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">
                  {step.body}
                </p>
              </li>
            ))}
          </ol>
        </section>

        <section
          id="shelf"
          className="mx-auto max-w-6xl scroll-mt-8 px-5 py-20 sm:px-8"
        >
          <div className="mb-8">
            <h2 className="font-display text-3xl tracking-tight text-ink sm:text-4xl">
              On the shelf right now
            </h2>
            <p className="mt-2 text-ink-soft">
              Tools your neighbors are happy to lend.
            </p>
          </div>
          <PublicToolList />
        </section>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-5 py-8 text-sm text-ink-faint sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <p>LendLoop — a fictional demo app.</p>
          <p className="flex items-center gap-1.5">
            <ShieldCheck className="size-4" aria-hidden />
            Your address and contact details are never shown publicly.
          </p>
        </div>
      </footer>
    </div>
  );
}
