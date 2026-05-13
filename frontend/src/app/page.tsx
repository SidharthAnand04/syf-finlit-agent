"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, GlassPanel } from "@/components/ui/panel";
import { cn } from "@/lib/cn";

const FEATURES = [
  {
    title: "Grounded financial education",
    body: "Answers are shaped from vetted Synchrony public content, with source-aware explanations for confusing credit topics.",
  },
  {
    title: "Operator-ready governance",
    body: "Admin workflows keep sources, FAQs, tone, and insight reports visible in one polished control plane.",
  },
  {
    title: "Content gap intelligence",
    body: "Insights highlight weak coverage, risk-heavy questions, low citation patterns, and high-value next fixes.",
  },
];

const METRICS = [
  ["98%", "Grounding coverage target"],
  ["<3s", "Fast answer experience"],
  ["24/7", "Always-on education layer"],
];

const STEPS = [
  "Customer asks a plain-language credit question.",
  "The assistant retrieves the most relevant source material.",
  "The response explains the concept clearly and routes sensitive needs safely.",
];

export default function LandingPage() {
  return (
    <main className="app-canvas relative min-h-screen overflow-hidden font-sans">
      <div className="premium-grid pointer-events-none absolute inset-0 opacity-70" />
      <div className="pointer-events-none absolute -left-28 -top-36 h-[30rem] w-[30rem] rounded-full bg-syf-gold/20 blur-3xl" />
      <div className="pointer-events-none absolute right-[-10rem] top-20 h-[34rem] w-[34rem] rounded-full bg-accent-cyan/14 blur-3xl" />
      <div className="pointer-events-none absolute bottom-16 left-1/3 h-80 w-80 rounded-full bg-accent-violet/14 blur-3xl" />

      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-7xl flex-col px-5 py-5 sm:px-8 lg:px-10">
        <nav className="glass-panel-dark sticky top-4 z-20 flex items-center justify-between rounded-full px-4 py-3">
          <Link href="/" className="flex items-center gap-3 text-syf-cream no-underline">
            <span className="grid h-9 w-9 place-items-center rounded-full border border-syf-gold/40 bg-canvas-950/80 text-sm font-black text-syf-gold shadow-glass-soft">
              S
            </span>
            <span className="hidden text-sm font-black tracking-tight sm:inline">Synchrony FinLit Assistant</span>
          </Link>
          <div className="flex items-center gap-2">
            <Link href="/admin" className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "hidden sm:inline-flex")}>
              Admin
            </Link>
            <Link href="/chat" className={buttonVariants({ variant: "primary", size: "sm" })}>
              Open assistant
            </Link>
          </div>
        </nav>

        <section className="grid flex-1 items-center gap-10 py-16 lg:grid-cols-[1.02fr_0.98fr] lg:py-20">
          <div className="max-w-3xl animate-glass-in">
            <Badge variant="gold" className="mb-5">
              Financial education, grounded in trusted content
            </Badge>
            <h1 className="text-5xl font-black leading-[0.96] tracking-tight text-syf-cream sm:text-6xl lg:text-7xl">
              Synchrony Financial Literacy Assistant
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-white/70">
              A premium embedded assistant and admin intelligence layer for explaining credit products clearly,
              safely, and consistently across customer journeys.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/chat" className={buttonVariants({ variant: "primary", size: "lg" })}>
                Try the assistant
              </Link>
              <Link href="/admin/overview" className={buttonVariants({ variant: "secondary", size: "lg" })}>
                View dashboard
              </Link>
            </div>
            <div className="mt-10 grid max-w-xl grid-cols-3 gap-3">
              {METRICS.map(([value, label]) => (
                <GlassPanel key={label} className="glass-panel-dark rounded-3xl p-4">
                  <div className="text-2xl font-black text-syf-cream">{value}</div>
                  <div className="mt-1 text-[11px] font-bold uppercase tracking-[0.08em] text-white/48">{label}</div>
                </GlassPanel>
              ))}
            </div>
          </div>

          <div className="relative animate-glass-in lg:pl-4" style={{ animationDelay: "90ms" }}>
            <div className="pointer-events-none absolute -inset-8 rounded-[2.5rem] bg-gradient-to-br from-syf-gold/18 via-accent-cyan/12 to-accent-violet/12 blur-2xl" />
            <GlassPanel className="glass-panel-dark relative overflow-hidden rounded-[2rem] p-4 shadow-glass">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <div className="text-sm font-black text-syf-cream">Executive console</div>
                  <div className="text-xs text-white/48">Live content health preview</div>
                </div>
                <Badge variant="info">AI report ready</Badge>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                {["Coverage", "Citation", "Risk"].map((label, i) => (
                  <Card key={label} className="p-4">
                    <div className="text-[11px] font-black uppercase tracking-[0.08em] text-syf-muted">{label}</div>
                    <div className="mt-3 text-3xl font-black text-syf-charcoal">{[92, 87, 14][i]}%</div>
                    <div className="mt-3 h-2 rounded-full border border-white/50 bg-white/50">
                      <div
                        className={cn("h-full rounded-full", i === 2 ? "bg-red-500" : "bg-syf-gold")}
                        style={{ width: `${[92, 87, 14][i]}%` }}
                      />
                    </div>
                  </Card>
                ))}
              </div>
              <Card className="mt-3 p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-black text-syf-charcoal">Priority fixes</div>
                    <div className="text-xs text-syf-muted">Ranked by demand, risk, and missing content</div>
                  </div>
                  <Badge variant="light">3 actions</Badge>
                </div>
                <div className="space-y-2">
                  {["Deferred interest payoff clarity", "Payment allocation FAQ", "Promotional balance citations"].map((item, i) => (
                    <div key={item} className="flex items-center gap-3 rounded-2xl border border-white/50 bg-white/46 p-3">
                      <span className="grid h-7 w-7 place-items-center rounded-full bg-canvas-900 text-xs font-black text-syf-gold">{i + 1}</span>
                      <span className="min-w-0 flex-1 truncate text-sm font-bold text-syf-charcoal">{item}</span>
                      <span className="h-2 w-2 rounded-full bg-syf-gold shadow-[0_0_16px_rgba(251,198,0,0.7)]" />
                    </div>
                  ))}
                </div>
              </Card>
            </GlassPanel>
          </div>
        </section>

        <section className="grid gap-4 pb-12 md:grid-cols-3">
          {FEATURES.map((feature, i) => (
            <Card key={feature.title} interactive className="animate-glass-in p-6" style={{ animationDelay: `${120 + i * 70}ms` }}>
              <div className="mb-4 h-1.5 w-12 rounded-full bg-gradient-to-r from-syf-gold to-accent-cyan" />
              <h2 className="text-lg font-black text-syf-charcoal">{feature.title}</h2>
              <p className="mt-3 text-sm leading-6 text-syf-muted">{feature.body}</p>
            </Card>
          ))}
        </section>

        <section className="grid gap-4 pb-14 lg:grid-cols-[0.8fr_1.2fr]">
          <GlassPanel className="glass-panel-dark rounded-glass p-6">
            <Badge variant="neutral" className="mb-4">How it works</Badge>
            <h2 className="text-3xl font-black tracking-tight text-syf-cream">Clear answers with operational visibility.</h2>
          </GlassPanel>
          <div className="grid gap-3">
            {STEPS.map((step, i) => (
              <Card key={step} className="flex items-center gap-4 p-4">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl border border-syf-gold/35 bg-syf-gold/18 text-sm font-black text-syf-charcoal">
                  {i + 1}
                </span>
                <p className="text-sm font-semibold leading-6 text-syf-charcoal">{step}</p>
              </Card>
            ))}
          </div>
        </section>

        <footer className="border-t border-white/10 py-7 text-center text-xs leading-6 text-white/45">
          For general financial education only. Not financial advice.
          <br />
          Prototype - TMGT 461 - University of Illinois
        </footer>
      </div>
    </main>
  );
}
