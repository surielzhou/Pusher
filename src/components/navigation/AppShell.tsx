const navigationItems = [
  { label: "工作台", href: "/workbench" },
  { label: "新建文章", href: "/articles/new" },
  { label: "历史", href: "/history" },
  { label: "排期", href: "/schedule" },
  { label: "审计", href: "/audit" }
];

export default function AppShell({ children }: Readonly<{ children: unknown }>) {
  return (
    <div className="app-shell">
      <a className="skip-link" href="#page-content">
        跳到主要内容
      </a>
      <header className="app-shell__header">
        <a aria-label="Pusher 工作台首页" className="app-shell__brand" href="/workbench">
          <span aria-hidden="true" className="app-shell__brand-mark">
            P
          </span>
          <span>Pusher</span>
        </a>
        <nav aria-label="主导航" className="app-shell__nav">
          {navigationItems.map((item) => (
            <a className="app-shell__nav-link" href={item.href} key={item.href}>
              {item.label}
            </a>
          ))}
        </nav>
      </header>
      <div className="app-shell__content" id="page-content" tabIndex={-1}>
        {children}
      </div>
    </div>
  );
}
