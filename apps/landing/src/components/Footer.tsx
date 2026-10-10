// Every link here goes somewhere real. The footer also renders on /blog, /vs
// and /for pages, so in-page sections are addressed as "/#section".
const COLUMNS: { title: string; links: { label: string; href: string; external?: boolean }[] }[] = [
  {
    title: "Product",
    links: [
      { label: "How it works", href: "/#how-it-works" },
      { label: "Features", href: "/#features" },
      { label: "Pricing", href: "/#pricing" },
      { label: "FAQ", href: "/#faq" },
    ],
  },
  {
    title: "Resources",
    links: [
      { label: "Blog", href: "/blog" },
      { label: "API Docs", href: "https://api.qampi.com/api/public/v1/docs", external: true },
    ],
  },
  {
    title: "Legal",
    links: [{ label: "Extension Privacy", href: "/extension-privacy" }],
  },
];

export function Footer() {
  return (
    <footer className="border-t border-slate-200/80 bg-white">
      <div className="mx-auto max-w-6xl px-4 pb-8 pt-16 sm:px-6 lg:px-8">
        <div className="grid gap-12 md:grid-cols-12">
          <div className="md:col-span-5">
            <a href="/" className="inline-flex items-center gap-2">
              <img src="/logo.png" alt="" className="h-9 w-9 object-contain" />
              <span className="text-xl font-semibold tracking-tight text-slate-900">Qampi</span>
            </a>
            <p className="mt-4 max-w-sm text-[15px] leading-relaxed text-slate-500">
              AI-personalized LinkedIn and cold email outreach. Find prospects, write messages worth replying
              to, and keep every conversation in one inbox.
            </p>
          </div>

          <nav aria-label="Footer" className="grid grid-cols-2 gap-8 sm:grid-cols-3 md:col-span-7">
            {COLUMNS.map((col) => (
              <div key={col.title}>
                <h4 className="text-sm font-semibold text-slate-900">{col.title}</h4>
                <ul className="mt-4 space-y-3 text-sm">
                  {col.links.map((item) => (
                    <li key={item.label}>
                      <a
                        href={item.href}
                        {...(item.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                        className="text-slate-500 transition-colors hover:text-primary"
                      >
                        {item.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </div>

        <div className="mt-14 flex flex-col items-center justify-between gap-4 border-t border-slate-200/80 pt-8 text-sm text-slate-500 md:flex-row">
          <p>© {new Date().getFullYear()} Qampi. Built for closers.</p>
          <a href="https://app.qampi.com/register" className="font-semibold text-primary hover:text-violet-800">
            Get started free →
          </a>
        </div>
      </div>
    </footer>
  );
}
