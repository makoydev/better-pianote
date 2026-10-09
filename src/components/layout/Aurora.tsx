/** Slow-drifting coloured light behind everything, like stage lights. */
export function Aurora() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,#1b1947_0%,#0d0c24_55%,#08071a_100%)]" />
      <div
        className="absolute -left-[15%] -top-[20%] h-[65vmax] w-[65vmax] animate-float rounded-full opacity-[0.22] blur-[90px]"
        style={{ background: 'radial-gradient(circle, #7b5cff 0%, transparent 65%)' }}
      />
      <div
        className="absolute -right-[20%] top-[10%] h-[55vmax] w-[55vmax] animate-float rounded-full opacity-[0.16] blur-[90px]"
        style={{ background: 'radial-gradient(circle, #ff7b6b 0%, transparent 65%)', animationDelay: '-3s', animationDuration: '11s' }}
      />
      <div
        className="absolute -bottom-[30%] left-[20%] h-[60vmax] w-[60vmax] animate-float rounded-full opacity-[0.14] blur-[100px]"
        style={{ background: 'radial-gradient(circle, #2fd6c0 0%, transparent 65%)', animationDelay: '-6s', animationDuration: '13s' }}
      />
      <div
        className="absolute inset-0 opacity-[0.05] mix-blend-overlay"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
        }}
      />
    </div>
  )
}
