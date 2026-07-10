export function Footer() {
  const cols = [
    {
      title: 'Product',
      links: ['Download', 'Features', 'Pricing', 'Roadmap'],
    },
    {
      title: 'Company',
      links: ['About', 'Careers', 'Contact', 'Security'],
    },
    {
      title: 'Community',
      links: ['X'],
    },
  ];
  return (
    <footer className="relative overflow-hidden pt-20">
      <div className="mb-16 grid gap-10 pl-4 md:grid-cols-[1.4fr_repeat(3,1fr)]">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="text-lg font-semibold tracking-tight">Rush</span>
          </div>
          <p className="text-muted-foreground mt-4 max-w-xs text-sm leading-relaxed">
            The agentic desktop video editor. Built by editors, for editors who
            ship every day.
          </p>
        </div>
        {cols.map((c) => (
          <div key={c.title}>
            <div className="text-muted-foreground mb-4 font-mono text-[10px] tracking-widest uppercase">
              {c.title}
            </div>
            <ul className="space-y-2.5 text-sm">
              {c.links.map((l) => (
                <li key={l}>
                  <a
                    href="#"
                    className="text-foreground/70 hover:text-foreground transition-colors"
                  >
                    {l}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {/* Giant faded wordmark */}
      <div
        aria-hidden
        className="pointer-events-none overflow-hidden text-center select-none"
      >
        <div className="from-primary/10 bg-gradient-to-b to-transparent bg-clip-text text-[20vw] leading-[0.85] font-semibold tracking-tighter text-transparent">
          RUSH
        </div>
      </div>
    </footer>
  );
}
