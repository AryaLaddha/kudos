import Link from "next/link";
import { ArrowRight, Heart, Sparkles, TrendingUp, Users, Zap, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

const features = [
  {
    icon: Heart,
    title: "Meaningful recognition",
    description: "Send personalised shoutouts with points attached. Make appreciation tangible.",
  },
  {
    icon: Users,
    title: "Company-wide feed",
    description: "Watch the culture of recognition unfold in real time across your whole organisation.",
  },
  {
    icon: TrendingUp,
    title: "Points that matter",
    description: "Each team member gets a monthly allowance to give. Recipients redeem for real rewards.",
  },
  {
    icon: Zap,
    title: "Instant & effortless",
    description: "Give kudos in under 10 seconds. No forms, no approvals — just genuine appreciation.",
  },
];

const testimonials = [
  {
    quote: "Kudos changed how our remote team connects. Recognition is finally a daily habit.",
    author: "Sarah Chen",
    role: "People & Culture Lead",
    company: "Finova",
    initials: "SC",
    color: "bg-violet-100 text-violet-700",
  },
  {
    quote: "Retention improved measurably within the first quarter of rolling out Kudos.",
    author: "Marcus Webb",
    role: "Head of Engineering",
    company: "Stackr",
    initials: "MW",
    color: "bg-indigo-100 text-indigo-700",
  },
  {
    quote: "Our team actually looks forward to Monday mornings now. The feed is addictive.",
    author: "Priya Nair",
    role: "CEO",
    company: "Lune Health",
    initials: "PN",
    color: "bg-sky-100 text-sky-700",
  },
];

const plans = [
  {
    name: "Starter",
    price: "Free",
    description: "Perfect for small teams getting started.",
    features: ["Up to 10 members", "Recognition feed", "100 pts/month allowance", "Email support"],
    cta: "Get started free",
    highlight: false,
  },
  {
    name: "Growth",
    price: "$4",
    per: "/ user / month",
    description: "Everything your growing team needs.",
    features: ["Unlimited members", "Custom allowances", "Rewards catalog", "Analytics dashboard", "Slack integration", "Priority support"],
    cta: "Start free trial",
    highlight: true,
  },
  {
    name: "Enterprise",
    price: "Custom",
    description: "Tailored for large organisations.",
    features: ["SSO & SAML", "Custom branding", "Dedicated CSM", "SLA guarantee", "Advanced analytics", "API access"],
    cta: "Contact sales",
    highlight: false,
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Nav */}
      <header className="sticky top-0 z-50 border-b border-slate-100 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600">
              <Sparkles className="h-4 w-4 text-white" />
            </div>
            <span className="text-lg font-bold text-slate-900">Kudos</span>
          </div>
          <nav className="hidden items-center gap-8 md:flex">
            <a href="#features" className="text-sm text-slate-500 hover:text-slate-900 transition-colors">Features</a>
            <a href="#testimonials" className="text-sm text-slate-500 hover:text-slate-900 transition-colors">Reviews</a>
            <a href="#pricing" className="text-sm text-slate-500 hover:text-slate-900 transition-colors">Pricing</a>
          </nav>
          <div className="flex items-center gap-3">
            <Link href="/auth/login">
              <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700 text-white">Sign in</Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden px-6 pt-24 pb-20 text-center">
        <div className="pointer-events-none absolute inset-0 flex items-start justify-center">
          <div className="h-[600px] w-[900px] rounded-full bg-indigo-50 opacity-60 blur-3xl" />
        </div>
        <div className="relative mx-auto max-w-3xl">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-indigo-100 bg-indigo-50 px-4 py-1.5 text-xs font-semibold text-indigo-600">
            <Sparkles className="h-3 w-3" />
            Recognition that actually means something
          </div>
          <h1 className="mb-6 text-5xl font-extrabold leading-tight tracking-tight text-slate-900 md:text-6xl">
            Build a culture where{" "}
            <span className="text-indigo-600">people feel seen</span>
          </h1>
          <p className="mx-auto mb-10 max-w-xl text-lg text-slate-500 leading-relaxed">
            Kudos is the simplest way for teams to recognise each other with points, shoutouts, and genuine appreciation — every single day.
          </p>
          <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link href="/auth/login">
              <Button size="lg" className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-8 h-12">
                Sign in <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>

        {/* Mock feed preview */}
        <div className="relative mx-auto mt-16 max-w-2xl">
          <div className="rounded-2xl border border-slate-100 bg-white shadow-2xl shadow-slate-100 overflow-hidden">
            {/* browser bar */}
            <div className="flex items-center gap-1.5 border-b border-slate-100 bg-slate-50 px-4 py-3">
              <span className="h-2.5 w-2.5 rounded-full bg-red-300" />
              <span className="h-2.5 w-2.5 rounded-full bg-yellow-300" />
              <span className="h-2.5 w-2.5 rounded-full bg-green-300" />
              <span className="ml-3 text-xs text-slate-400">app.kudos.io/feed</span>
            </div>
            {/* mock cards */}
            <div className="space-y-px bg-slate-50 p-4">
              {[
                { from: "Alex M.", to: "Jordan P.", msg: "Shipped the new onboarding flow flawlessly. The team is amazed!", pts: 25, tag: "#shipping", emoji: "🚀", color: "bg-violet-100 text-violet-700", color2: "bg-sky-100 text-sky-700" },
                { from: "Priya S.", to: "Chris T.", msg: "Thank you for staying late to help debug the production issue. Hero!", pts: 50, tag: "#teamwork", emoji: "🙌", color: "bg-rose-100 text-rose-700", color2: "bg-amber-100 text-amber-700" },
              ].map((item, i) => (
                <div key={i} className="rounded-xl bg-white p-4 border border-slate-100">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold ${item.color}`}>
                        {item.from[0]}
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">
                          <span className="font-semibold text-slate-800">{item.from}</span>
                          {" → "}
                          <span className="font-semibold text-slate-800">{item.to}</span>
                        </p>
                        <p className="mt-1 text-sm text-slate-700">{item.msg}</p>
                        <span className="mt-1.5 inline-block text-xs text-indigo-500 font-medium">{item.tag}</span>
                      </div>
                    </div>
                    <div className="flex-shrink-0 rounded-full bg-indigo-50 px-3 py-1 text-xs font-bold text-indigo-600">
                      +{item.pts} pts
                    </div>
                  </div>
                  <div className="mt-3 flex gap-2">
                    <span className="rounded-full border border-slate-100 bg-slate-50 px-2.5 py-1 text-xs">{item.emoji} 4</span>
                    <span className="rounded-full border border-slate-100 bg-slate-50 px-2.5 py-1 text-xs">❤️ 7</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="bg-slate-50 px-6 py-24">
        <div className="mx-auto max-w-6xl">
          <div className="mb-14 text-center">
            <p className="mb-3 text-xs font-bold uppercase tracking-widest text-indigo-500">Why Kudos</p>
            <h2 className="text-4xl font-extrabold text-slate-900">Recognition made ridiculously simple</h2>
          </div>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {features.map((f) => (
              <div key={f.title} className="rounded-2xl border border-slate-100 bg-white p-7 shadow-sm hover:shadow-md transition-shadow">
                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-50">
                  <f.icon className="h-5 w-5 text-indigo-600" />
                </div>
                <h3 className="mb-2 text-base font-semibold text-slate-900">{f.title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed">{f.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section id="testimonials" className="px-6 py-24">
        <div className="mx-auto max-w-6xl">
          <div className="mb-14 text-center">
            <p className="mb-3 text-xs font-bold uppercase tracking-widest text-indigo-500">Social proof</p>
            <h2 className="text-4xl font-extrabold text-slate-900">Loved by teams everywhere</h2>
          </div>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {testimonials.map((t) => (
              <div key={t.author} className="flex flex-col rounded-2xl border border-slate-100 bg-white p-8 shadow-sm">
                <p className="flex-1 text-slate-600 text-sm leading-relaxed italic mb-6">&ldquo;{t.quote}&rdquo;</p>
                <div className="flex items-center gap-3">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold ${t.color}`}>
                    {t.initials}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{t.author}</p>
                    <p className="text-xs text-slate-400">{t.role} · {t.company}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="bg-slate-50 px-6 py-24">
        <div className="mx-auto max-w-5xl">
          <div className="mb-14 text-center">
            <p className="mb-3 text-xs font-bold uppercase tracking-widest text-indigo-500">Pricing</p>
            <h2 className="text-4xl font-extrabold text-slate-900">Simple, transparent pricing</h2>
          </div>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {plans.map((plan) => (
              <div
                key={plan.name}
                className={`relative flex flex-col rounded-2xl border p-8 ${
                  plan.highlight
                    ? "border-indigo-500 bg-indigo-600 text-white shadow-2xl shadow-indigo-200 scale-105"
                    : "border-slate-100 bg-white shadow-sm"
                }`}
              >
                {plan.highlight && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-indigo-100 px-4 py-1 text-xs font-bold text-indigo-700">
                    Most popular
                  </div>
                )}
                <p className={`text-sm font-semibold mb-1 ${plan.highlight ? "text-indigo-200" : "text-slate-500"}`}>{plan.name}</p>
                <div className="flex items-end gap-1 mb-2">
                  <span className={`text-4xl font-extrabold ${plan.highlight ? "text-white" : "text-slate-900"}`}>{plan.price}</span>
                  {plan.per && <span className={`text-sm mb-1 ${plan.highlight ? "text-indigo-200" : "text-slate-400"}`}>{plan.per}</span>}
                </div>
                <p className={`text-sm mb-6 ${plan.highlight ? "text-indigo-100" : "text-slate-500"}`}>{plan.description}</p>
                <ul className="flex-1 space-y-2.5 mb-8">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-sm">
                      <CheckCircle className={`h-4 w-4 flex-shrink-0 ${plan.highlight ? "text-indigo-200" : "text-indigo-500"}`} />
                      <span className={plan.highlight ? "text-indigo-50" : "text-slate-600"}>{f}</span>
                    </li>
                  ))}
                </ul>
                <Link href="/auth/login">
                  <Button
                    className={`w-full ${
                      plan.highlight
                        ? "bg-white text-indigo-600 hover:bg-indigo-50"
                        : "bg-indigo-600 text-white hover:bg-indigo-700"
                    }`}
                  >
                    Sign in
                  </Button>
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-6 py-24 text-center">
        <div className="mx-auto max-w-2xl">
          <div className="mb-4 flex items-center justify-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-600">
              <Sparkles className="h-7 w-7 text-white" />
            </div>
          </div>
          <h2 className="mb-4 text-4xl font-extrabold text-slate-900">Ready to start recognising?</h2>
          <p className="mb-8 text-lg text-slate-500">Join thousands of teams building healthier, happier cultures with Kudos.</p>
          <Link href="/auth/login">
            <Button size="lg" className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-10 h-12">
              Sign in <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-100 px-6 py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 md:flex-row">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-indigo-600">
              <Sparkles className="h-3 w-3 text-white" />
            </div>
            <span className="text-sm font-bold text-slate-900">Kudos</span>
          </div>
          <p className="text-xs text-slate-400">© {new Date().getFullYear()} Kudos. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
