import { Show, SignInButton, SignUpButton, UserButton } from "@clerk/nextjs";
import Image, { type StaticImageData } from "next/image";
import { Suspense } from "react";
import { ArrowRight, ShieldCheck } from "lucide-react";
import circularSaw from "@/assets/hero/circular-saw.webp";
import standMixer from "@/assets/hero/stand-mixer.webp";
import tent from "@/assets/hero/tent.webp";
import { Logo } from "@/components/logo";
import { PublicToolList, ShelfCount } from "@/components/public-tool-list";
import { buttonClass } from "@/components/ui/button-class";
import { Badge, ButtonLink } from "@/components/ui/primitives";

/** Each step carries one of the app's 3D illustrations (Microsoft Fluent Emoji, MIT). */
const STEPS = [
  {
    art: "/art/toolbox.png",
    title: "List what's in your garage",
    body: "Ladders, drills, a tent you use once a year. Add a photo and it's on the board in under a minute.",
  },
  {
    art: "/art/handshake.png",
    title: "Request the dates you need",
    body: "Neighbors ask for a window; the owner approves or declines with one tap. Overlapping bookings are refused.",
  },
  {
    art: "/art/house.png",
    title: "Reminders handle the awkward part",
    body: "Both sides get an email at every step, and a late return gets a friendly nudge, so nobody has to chase.",
  },
];

type HeroPhoto = {
  src: StaticImageData;
  alt: string;
  /** object-cover crops, so the requested width follows the tile's height too. */
  sizes: string;
  badge: { tone: "brand" | "warn"; label: string };
};

/** Listing photos from the demo board (openly licensed, credited in the footer). */
const HERO: HeroPhoto[] = [
  { src: circularSaw, alt: "A circular saw cutting a board", sizes: "(min-width: 640px) 48rem, 36rem", badge: { tone: "brand", label: "Available" } },
  { src: tent, alt: "A grey camping tent pitched on grass", sizes: "(min-width: 1024px) 24rem, 50vw", badge: { tone: "warn", label: "On loan until Sat" } },
  { src: standMixer, alt: "A white stand mixer on a kitchen counter", sizes: "(min-width: 1024px) 24rem, 50vw", badge: { tone: "brand", label: "Free until Nov 20" } },
];

const CREDITS = [
  { what: "Circular saw", by: "Mark Hunter", license: "CC BY 2.0", href: "https://commons.wikimedia.org/wiki/File:DeWalt_circular_saw.jpg" },
  { what: "Tent", by: "Sarathlal N", license: "CC0 1.0", href: "https://wordpress.org/photos/photo/81866f5185/" },
  { what: "Stand mixer", by: "Your Best Digs", license: "CC BY 2.0", href: "https://commons.wikimedia.org/wiki/File:White_KitchenAid_mixer_(KSM150PSWH).jpg" },
];

function HeroPhotoTile({ photo, priority, className }: { photo: HeroPhoto; priority?: boolean; className?: string }) {
  return (
    <figure className={`relative overflow-hidden rounded-[var(--radius-card)] border border-line bg-sunken ${className ?? ""}`}>
      <Image
        src={photo.src}
        alt={photo.alt}
        fill
        priority={priority}
        sizes={photo.sizes}
        className="object-cover"
      />
      {/* The same status badge the board shows, so the hero previews the real product. */}
      <Badge tone={photo.badge.tone} className="absolute bottom-3 left-3 border border-line/60">
        {photo.badge.tone === "brand" && <span className="size-1.5 rounded-full bg-brand" aria-hidden />}
        {photo.badge.label}
      </Badge>
    </figure>
  );
}

export default function LandingPage() {
  return (
    <div className="flex min-h-full flex-col">
      <header className="border-b border-line bg-paper">
        <div className="relative mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-5 sm:px-8">
          <a
            href="#main"
            className="absolute left-5 top-3 z-10 -translate-y-20 rounded-lg bg-ink px-3 py-2 text-sm text-paper focus:translate-y-0 sm:left-8"
          >
            Skip to content
          </a>
          <Logo />
          <nav className="flex items-center gap-2" aria-label="Account">
            {/* Show reads the request's auth state, so it streams in under Suspense
                while the rest of the page stays static. */}
            <Suspense fallback={<div className="h-10 w-40" aria-hidden />}>
              <Show when="signed-out">
                <SignInButton mode="modal" forceRedirectUrl="/board">
                  <button className={buttonClass("ghost", "md", "h-11 sm:h-10")}>Sign in</button>
                </SignInButton>
                <SignUpButton mode="modal" forceRedirectUrl="/board">
                  <button className={buttonClass("secondary", "md", "h-11 sm:h-10")}>Join</button>
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
        </div>
      </header>

      <main id="main" className="flex-1">
        <section className="mx-auto grid max-w-6xl items-center gap-12 px-5 pb-20 pt-12 sm:px-8 sm:pt-16 lg:min-h-[calc(100svh-4rem)] lg:grid-cols-[1.1fr_1fr] lg:pb-16">
          <div className="animate-fade-up">
            <ShelfCount />
            <h1 className="max-w-2xl font-display text-[2.75rem] leading-[1.04] tracking-[-0.025em] text-ink sm:text-7xl">
              Borrow your neighbors&apos; tools. <span className="italic text-brand">Lend yours.</span>
            </h1>
            <p className="mt-6 max-w-[34rem] text-lg leading-relaxed text-ink-soft">
              LendLoop is a lending board for neighbors. The drill in your shed, the ladder you used once, the
              tent that waits for summer: list them, book what you need for the weekend, and let the reminders do
              the follow-up.
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-3">
              <Suspense fallback={<div className="h-12 w-64" aria-hidden />}>
                <Show when="signed-out">
                  <SignInButton mode="modal" forceRedirectUrl="/board">
                    <button className={buttonClass("primary", "lg")}>
                      Sign in to borrow
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
              <a href="#shelf" className={buttonClass("secondary", "lg")}>
                See what&apos;s on the shelf
              </a>
            </div>
          </div>

          <div className="grid h-[22rem] grid-cols-[1.25fr_1fr] grid-rows-2 gap-3 sm:h-[28rem] lg:h-[32rem]">
            <HeroPhotoTile photo={HERO[0]} priority className="row-span-2" />
            <HeroPhotoTile photo={HERO[1]} priority />
            <HeroPhotoTile photo={HERO[2]} />
          </div>
        </section>

        <section className="border-y border-line bg-surface" aria-labelledby="how">
          <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8 lg:py-24">
            <h2 id="how" className="font-display text-3xl tracking-tight text-ink sm:text-4xl">
              How lending works
            </h2>
            <ol className="mt-12 grid gap-10 sm:grid-cols-3 sm:gap-8">
              {STEPS.map((step, i) => (
                <li key={step.title} className="border-t border-line-strong pt-6">
                  <div className="flex items-end justify-between">
                    {/* eslint-disable-next-line @next/next/no-img-element -- static decorative art */}
                    <img src={step.art} alt="" width={88} height={88} className="size-[88px]" draggable={false} />
                    <span className="font-mono text-[13px] tabular-nums text-ink-faint">Step {i + 1}</span>
                  </div>
                  <h3 className="mt-5 font-display text-xl leading-snug text-ink sm:text-2xl">{step.title}</h3>
                  <p className="mt-2 leading-relaxed text-ink-soft">{step.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section id="shelf" className="mx-auto max-w-6xl scroll-mt-8 px-5 py-20 sm:px-8 lg:py-24" aria-labelledby="shelf-h">
          <div className="mb-10">
            <h2 id="shelf-h" className="font-display text-3xl tracking-tight text-ink sm:text-4xl">
              On the shelf right now
            </h2>
            <p className="mt-2 text-lg text-ink-soft">Tools your neighbors are happy to lend.</p>
          </div>
          <PublicToolList />
          <Suspense fallback={null}>
            <Show when="signed-out">
              <div className="mt-8 flex justify-center">
                <SignUpButton mode="modal" forceRedirectUrl="/board">
                  <button className={buttonClass("primary", "lg")}>
                    Join to borrow
                    <ArrowRight className="size-4" aria-hidden />
                  </button>
                </SignUpButton>
              </div>
            </Show>
          </Suspense>
        </section>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-5 py-8 text-sm text-ink-faint sm:px-8">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p>LendLoop, a fictional demo app.</p>
            <p className="flex items-center gap-1.5">
              <ShieldCheck className="size-4" aria-hidden />
              Your address and contact details are never shown publicly.
            </p>
          </div>
          <details>
            <summary className="flex min-h-11 w-fit cursor-pointer list-none items-center select-none hover:text-ink sm:min-h-0 [&::-webkit-details-marker]:hidden">
              Photo credits +
            </summary>
            <p className="mt-2 leading-relaxed">
              {CREDITS.map((c, i) => (
                <span key={c.what}>
                  {i > 0 && " · "}
                  <a href={c.href} className="underline underline-offset-2 hover:text-ink" rel="noreferrer" target="_blank">
                    {c.what}
                  </a>{" "}
                  by {c.by} ({c.license})
                </span>
              ))}
              {" · "}Category illustrations: Microsoft Fluent Emoji (MIT).
            </p>
          </details>
        </div>
      </footer>
    </div>
  );
}
