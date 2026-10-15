import { Link, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Bell,
  Building2,
  ChevronLeft,
  Database,
  FileText,
  GitBranch,
  Gauge,
  History,
  LayoutDashboard,
  Lightbulb,
  LogOut,
  Menu,
  Moon,
  Network,
  Search,
  Settings,
  Share2,
  Sliders,
  Sun,
  Table2,
  TrendingUp,
  Upload,
  User as UserIcon,
  X,
  HelpCircle,
  Compass,
  BookOpen,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { DemoDataBadge } from "@/components/common/badges";
import { FirstTimeOnboardingModal } from "@/components/common/FirstTimeOnboardingModal";
import { SystemGuideModal } from "@/components/common/SystemGuideModal";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import { useQuery } from "@tanstack/react-query";
import { alertService } from "@/services/decisionServices";
import { cn } from "@/lib/utils";
import * as db from "@/mocks/data";
import type { UserRole } from "@/types";

export function getRoleLabel(role?: string): string {
  if (role === "SME_ADMIN") return "SME Admin";
  if (role === "ANALYST") return "Risk Analyst";
  if (role === "VIEWER") return "Executive";
  return role ? role.replace("_", " ") : "User";
}

const SME_ADMIN_NAV = [
  {
    label: "Overview",
    items: [{ to: "/app/dashboard", label: "Dashboard", icon: LayoutDashboard }],
  },
  {
    label: "Data Operations",
    items: [
      { to: "/app/transactions", label: "Transactions", icon: Table2 },
      { to: "/app/upload", label: "Upload Data", icon: Upload },
      { to: "/app/firms", label: "Firms", icon: Building2 },
      { to: "/app/relationships", label: "Relationships", icon: Share2 },
    ],
  },
  {
    label: "Risk & Exposure",
    items: [
      { to: "/app/risk", label: "Portfolio Risk", icon: Gauge },
      { to: "/app/predictions", label: "Predictions", icon: TrendingUp },
      { to: "/app/network", label: "Supply Chain Network", icon: Network },
    ],
  },
  {
    label: "Decisions & Actions",
    items: [
      { to: "/app/recommendations", label: "Recommendations", icon: Lightbulb },
      { to: "/app/simulator", label: "Scenario Simulator", icon: Activity },
    ],
  },
  {
    label: "Monitoring",
    items: [
      { to: "/app/alerts", label: "Alerts", icon: Bell },
      { to: "/app/reports", label: "Reports", icon: FileText },
    ],
  },
  {
    label: "Administration",
    items: [{ to: "/app/settings", label: "Settings & Team", icon: Settings }],
  },
] as const;

const ANALYST_NAV = [
  {
    label: "Overview",
    items: [{ to: "/app/dashboard", label: "Dashboard", icon: LayoutDashboard }],
  },
  {
    label: "Data",
    items: [
      { to: "/app/transactions", label: "Transactions", icon: Table2 },
      { to: "/app/firms", label: "Firms", icon: Building2 },
      { to: "/app/relationships", label: "Relationships", icon: Share2 },
    ],
  },
  {
    label: "Risk Analysis",
    items: [
      { to: "/app/risk", label: "Portfolio Risk", icon: Gauge },
      { to: "/app/predictions", label: "Predictions", icon: TrendingUp },
      { to: "/app/network", label: "Supply Chain Network", icon: Network },
      { to: "/app/deadlocks", label: "Financial Deadlock", icon: GitBranch },
    ],
  },
  {
    label: "Decision Support",
    items: [
      { to: "/app/recommendations", label: "Recommendations", icon: Lightbulb },
      { to: "/app/simulator", label: "Scenario Simulator", icon: Activity },
    ],
  },
  {
    label: "Monitoring",
    items: [
      { to: "/app/alerts", label: "Alerts", icon: Bell },
      { to: "/app/reports", label: "Reports", icon: FileText },
    ],
  },
] as const;

const VIEWER_NAV = [
  {
    label: "Overview",
    items: [{ to: "/app/dashboard", label: "Executive Dashboard", icon: LayoutDashboard }],
  },
  {
    label: "Portfolio & Network",
    items: [
      { to: "/app/risk", label: "Portfolio Risk", icon: Gauge },
      { to: "/app/network", label: "Supply Chain Network", icon: Network },
    ],
  },
  {
    label: "Actions & Monitoring",
    items: [
      { to: "/app/recommendations", label: "Recommendations", icon: Lightbulb },
      { to: "/app/alerts", label: "Alerts", icon: Bell },
      { to: "/app/reports", label: "Reports", icon: FileText },
    ],
  },
] as const;

function canRoleAccess(role: UserRole | undefined, path: string): boolean {
  if (!role || role === "SME_ADMIN") {
    // SME Admin has full operational access
    return true;
  }
  if (role === "ANALYST") {
    // Analyst cannot manage uploads or organization settings
    if (path === "/app/upload" || path === "/app/settings") return false;
    return true;
  }
  if (role === "VIEWER") {
    // Executive viewer has read-only executive visibility
    const allowed = [
      "/app/dashboard",
      "/app/risk",
      "/app/network",
      "/app/recommendations",
      "/app/alerts",
      "/app/reports",
      "/app/profile",
    ];
    return allowed.some((prefix) => path.startsWith(prefix));
  }
  return true;
}

const TITLES: Record<string, string> = {
  "/app/dashboard": "Dashboard",
  "/app/transactions": "Transactions",
  "/app/upload": "Upload Data",
  "/app/firms": "Firms",
  "/app/relationships": "Relationships",
  "/app/risk": "Portfolio Risk",
  "/app/predictions": "Predictions",
  "/app/network": "Supply Chain Network",
  "/app/simulator": "Scenario Simulator",
  "/app/deadlocks": "Financial Deadlock",
  "/app/simulations": "Scenario Simulator",
  "/app/recommendations": "Recommendations & Budget",
  "/app/optimization": "Smart Budget Allocation",
  "/app/reports": "Reports",
  "/app/alerts": "Alerts",
  "/app/settings": "Settings & Team",
  "/app/profile": "Profile",
};

export function AppLayout() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [guideOpen, setGuideOpen] = useState(false);
  const [tourOpen, setTourOpen] = useState(false);

  useEffect(() => setMobileOpen(false), [location.pathname]);

  const activeNavGroups = useMemo(() => {
    if (user?.role === "ANALYST") return ANALYST_NAV;
    if (user?.role === "VIEWER") return VIEWER_NAV;
    return SME_ADMIN_NAV;
  }, [user?.role]);

  const filteredNavGroups = useMemo(() => {
    return activeNavGroups.map((group) => ({
      ...group,
      items: group.items.filter((item) => canRoleAccess(user?.role, item.to)),
    })).filter((group) => group.items.length > 0);
  }, [activeNavGroups, user?.role]);

  const results = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (term.length < 2) return [];
    const firms = db.firms
      .filter((f) => f.name.toLowerCase().includes(term) || f.industry.toLowerCase().includes(term))
      .slice(0, 4)
      .map((f) => ({ id: f.id, label: f.name, sub: `Firm · ${f.industry}`, to: "/app/firms" as const }));
    const txns = db.transactions
      .filter((t) => t.id.toLowerCase().includes(term))
      .slice(0, 3)
      .map((t) => ({ id: t.id, label: t.id, sub: "Transaction", to: "/app/transactions" as const }));
    const alerts = db.alerts
      .filter((a) => a.title.toLowerCase().includes(term))
      .slice(0, 3)
      .map((a) => ({ id: a.id, label: a.title, sub: "Alert", to: "/app/alerts" as const }));
    return [...firms, ...txns, ...alerts];
  }, [query]);

  const alertsQuery = useQuery({
    queryKey: ["alerts"],
    queryFn: alertService.getAlerts,
    staleTime: 30000,
  });
  const unread = alertsQuery.data ? alertsQuery.data.filter((a) => !a.read && !a.archived).length : 0;
  const title = TITLES[location.pathname] ?? "NEXUS-CFR";
  const crumbGroup = activeNavGroups.find((g) => g.items.some((i) => location.pathname.startsWith(i.to)))?.label ?? "Overview";

  const [searchMobileOpen, setSearchMobileOpen] = useState(false);

  async function handleLogout() {
    await logout();
    toast.success("Signed out");
    navigate({ to: "/login", replace: true });
  }

  const renderSidebar = (isMobile = false) => (
    <div
      className={cn(
        "bg-sidebar border-sidebar-border flex h-full flex-col border-r transition-[width]",
        isMobile ? "w-72 max-w-[85vw]" : collapsed ? "w-[74px]" : "w-64"
      )}
    >
      <div className="border-sidebar-border flex h-16 items-center gap-2 border-b px-4">
        <div className="bg-primary text-primary-foreground grid size-8 shrink-0 place-items-center rounded-md font-bold">N</div>
        {(!collapsed || isMobile) && (
          <div className="min-w-0 flex-1">
            <p className="text-sidebar-foreground truncate text-sm font-semibold tracking-tight">NEXUS-CFR</p>
            <p className="text-muted-foreground truncate text-[10px] tracking-wide uppercase">Supply Chain Resilience</p>
          </div>
        )}
        {!isMobile ? (
          <Button variant="ghost" size="icon" className="ml-auto hidden lg:inline-flex" onClick={() => setCollapsed((c) => !c)} aria-label="Toggle sidebar">
            <ChevronLeft className={cn("size-4 transition-transform", collapsed && "rotate-180")} aria-hidden />
          </Button>
        ) : (
          <Button variant="ghost" size="icon" className="ml-auto lg:hidden" onClick={() => setMobileOpen(false)} aria-label="Close navigation">
            <X className="size-5" aria-hidden />
          </Button>
        )}
      </div>

      <nav className="flex-1 space-y-4 overflow-y-auto px-3 py-4" aria-label="Main navigation">
        {filteredNavGroups.map((group) => (
          <div key={group.label}>
            {(!collapsed || isMobile) && (
              <p className="text-muted-foreground px-2.5 pb-1.5 text-[10px] font-semibold tracking-wider uppercase">{group.label}</p>
            )}
            <ul className="space-y-1">
              {group.items.map((item) => (
                <li key={item.to}>
                  <Link
                    to={item.to}
                    title={item.label}
                    onClick={() => {
                      if (isMobile) setMobileOpen(false);
                    }}
                    className={cn(
                      "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground data-[status=active]:bg-primary/15 data-[status=active]:text-primary flex items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors data-[status=active]:font-semibold",
                      isMobile ? "min-h-[44px] py-2.5 text-sm" : "py-2"
                    )}
                    activeProps={{ "aria-current": "page" }}
                  >
                    <item.icon className="size-4 shrink-0" aria-hidden />
                    {(!collapsed || isMobile) && <span className="truncate">{item.label}</span>}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-sidebar-border border-t p-3">
        <Link
          to="/app/profile"
          onClick={() => {
            if (isMobile) setMobileOpen(false);
          }}
          className="hover:bg-sidebar-accent flex min-h-[44px] items-center gap-3 rounded-md p-2 transition-colors"
        >
          <Avatar className="size-8 shrink-0">
            <AvatarFallback className="bg-primary/15 text-primary text-xs font-semibold">{user?.avatarInitials}</AvatarFallback>
          </Avatar>
          {(!collapsed || isMobile) && (
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{user?.fullName}</p>
              <p className="text-muted-foreground truncate text-[11px]">{getRoleLabel(user?.role)}</p>
            </div>
          )}
        </Link>
        <Button
          variant="ghost"
          className="text-muted-foreground hover:text-foreground mt-1 w-full justify-start gap-3 px-2 min-h-[44px]"
          onClick={handleLogout}
        >
          <LogOut className="size-4 shrink-0" aria-hidden />
          {(!collapsed || isMobile) && "Log out"}
        </Button>
      </div>
    </div>
  );

  // Bottom navigation items for quick mobile access
  const mobileBottomNavItems = useMemo(() => {
    return [
      { to: "/app/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { to: "/app/transactions", label: "Ledger", icon: Table2 },
      { to: "/app/network", label: "Network", icon: Network },
      { to: "/app/risk", label: "Risk", icon: Gauge },
      { to: "/app/alerts", label: "Alerts", icon: Bell, badge: unread > 0 ? unread : null },
    ].filter((item) => canRoleAccess(user?.role, item.to));
  }, [user?.role, unread]);

  return (
    <div className="bg-background flex min-h-screen">
      <aside className="sticky top-0 hidden h-screen lg:block">{renderSidebar(false)}</aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="bg-background/80 fixed inset-0 backdrop-blur-sm transition-opacity"
            onClick={() => setMobileOpen(false)}
            aria-hidden
          />
          <div className="fixed inset-y-0 left-0 z-50 shadow-2xl animate-in slide-in-from-left duration-200">
            {renderSidebar(true)}
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="border-border bg-background/90 sticky top-0 z-40 flex h-16 items-center gap-2 border-b px-3 backdrop-blur sm:px-4 md:px-6">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden shrink-0 touch-target"
            onClick={() => setMobileOpen(true)}
            aria-label="Open navigation"
          >
            <Menu className="size-5" aria-hidden />
          </Button>

          <div className="min-w-0 flex-1 pr-1">
            <nav aria-label="Breadcrumb" className="text-muted-foreground hidden text-[11px] md:block truncate">
              NEXUS-CFR / {crumbGroup} / <span className="text-foreground">{title}</span>
            </nav>
            <h2 className="truncate text-sm font-semibold sm:text-base leading-tight">{title}</h2>
          </div>

          {/* Desktop Search Bar */}
          <div className="relative ml-auto hidden w-64 lg:w-72 md:block">
            <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" aria-hidden />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search firms, txns, alerts"
              className="pl-9 h-9 text-xs"
              aria-label="Global search"
            />
            {results.length > 0 && (
              <div className="border-border bg-popover absolute top-full right-0 left-0 z-50 mt-1 overflow-hidden rounded-lg border shadow-lg">
                {results.map((r) => (
                  <button
                    key={`${r.sub}-${r.id}`}
                    type="button"
                    className="hover:bg-muted flex w-full flex-col items-start px-3 py-2 text-left"
                    onClick={() => {
                      setQuery("");
                      navigate({ to: r.to });
                    }}
                  >
                    <span className="truncate text-sm">{r.label}</span>
                    <span className="text-muted-foreground text-[11px]">{r.sub}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Mobile Search Button */}
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden shrink-0"
            onClick={() => setSearchMobileOpen((o) => !o)}
            aria-label="Toggle mobile search"
          >
            <Search className="size-4 text-muted-foreground" aria-hidden />
          </Button>

          {/* Data Environment / Demo Mode Indicator */}
          {user?.organizationId === "ORG-001" || user?.email?.includes("demo") ? (
            <div className="hidden xl:flex items-center gap-1.5 px-3 py-1 rounded-full border border-purple-500/35 bg-purple-500/10 text-xs text-purple-700 dark:text-purple-300 shrink-0">
              <span className="size-2 rounded-full bg-purple-500 animate-pulse" />
              <span className="font-semibold text-[11px]">Demo Mode</span>
            </div>
          ) : user?.organizationName && user.organizationName !== "Operational Workspace" ? (
            <div className="hidden xl:flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-primary/25 bg-primary/5 text-xs text-muted-foreground shrink-0">
              <span className="size-1.5 rounded-full bg-emerald-500" />
              <span className="font-medium text-foreground text-[11px]">Org:</span>
              <span className="text-[11px] truncate max-w-32">{user.organizationName}</span>
            </div>
          ) : (
            <div className="hidden xl:flex items-center gap-1.5 px-3 py-1 rounded-full border border-amber-500/30 bg-amber-500/10 text-xs text-amber-700 dark:text-amber-300 shrink-0">
              <span className="size-1.5 rounded-full bg-amber-500" />
              <span className="font-medium text-[11px]">Waiting for Data</span>
            </div>
          )}

          {/* Help & System Tour Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="gap-1.5 text-xs text-muted-foreground hover:text-foreground hidden sm:inline-flex shrink-0"
                title="System Guide, Glossary & Product Tour"
              >
                <HelpCircle className="size-4 text-primary" />
                <span className="hidden lg:inline">Help & Tour</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="text-xs">Self-Explanatory Guidance</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => setTourOpen(true)}>
                <Compass className="size-4 text-primary" />
                <span>Product Walkthrough</span>
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setGuideOpen(true)}>
                <BookOpen className="size-4 text-primary" />
                <span>How It Works & Glossary</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Theme Switcher */}
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
            title={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
            className="shrink-0"
          >
            {theme === "dark" ? <Sun className="size-4 sm:size-5" aria-hidden /> : <Moon className="size-4 sm:size-5" aria-hidden />}
          </Button>

          {/* Alerts Bell Button */}
          <Button
            variant="ghost"
            size="icon"
            className="relative shrink-0"
            onClick={() => navigate({ to: "/app/alerts" })}
            aria-label={`Alerts, ${unread} unread`}
          >
            <Bell className="size-4 sm:size-5" aria-hidden />
            {unread > 0 && (
              <span className="bg-risk-critical text-background absolute top-1 right-1 grid size-4 place-items-center rounded-full text-[9px] font-bold">
                {unread}
              </span>
            )}
          </Button>

          {/* User Profile Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="gap-2 px-1 sm:px-2 shrink-0">
                <Avatar className="size-7">
                  <AvatarFallback className="bg-primary/15 text-primary text-[11px] font-semibold">{user?.avatarInitials}</AvatarFallback>
                </Avatar>
                <span className="hidden max-w-36 truncate text-sm font-medium xl:inline">{user?.organizationName || user?.companyName}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64 max-w-[calc(100vw-2rem)]">
              <DropdownMenuLabel className="flex flex-col">
                <span className="truncate">{user?.fullName}</span>
                <span className="text-muted-foreground text-xs font-normal truncate">{user?.email}</span>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <div className="px-2 py-1 flex items-center justify-between">
                <span className="text-muted-foreground text-[11px] uppercase font-semibold">Organization</span>
                <span className="text-xs font-medium truncate max-w-[120px]" title={user?.organizationName || user?.companyName}>
                  {user?.organizationName || user?.companyName}
                </span>
              </div>
              <div className="px-2 py-1 flex items-center justify-between">
                <span className="text-muted-foreground text-[11px] uppercase font-semibold">Assigned Role</span>
                <Badge variant="secondary" className="font-mono text-[10px] tracking-wide">
                  {getRoleLabel(user?.role)}
                </Badge>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => setTourOpen(true)}>
                <Compass className="size-4 text-primary" /> Quick Tour
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setGuideOpen(true)}>
                <BookOpen className="size-4 text-primary" /> Product Guide
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => navigate({ to: "/app/profile" })}>
                <UserIcon className="size-4" aria-hidden /> Profile
              </DropdownMenuItem>
              {canRoleAccess(user?.role, "/app/settings") && (
                <DropdownMenuItem onSelect={() => navigate({ to: "/app/settings" })}>
                  <Settings className="size-4" aria-hidden /> Settings
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onSelect={() => navigate({ to: "/app/reports" })}>
                <BarChart3 className="size-4" aria-hidden /> Reports
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={handleLogout}>
                <LogOut className="size-4" aria-hidden /> Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>

        {/* Mobile Search Overlay Input */}
        {searchMobileOpen && (
          <div className="border-border bg-background border-b p-3 md:hidden">
            <div className="relative">
              <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" aria-hidden />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search firms, transactions, alerts..."
                className="pl-9 h-10 text-sm"
                autoFocus
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1"
                >
                  <X className="size-4" />
                </button>
              )}
            </div>
            {results.length > 0 && (
              <div className="border-border bg-popover mt-2 overflow-hidden rounded-lg border shadow-lg max-h-60 overflow-y-auto">
                {results.map((r) => (
                  <button
                    key={`${r.sub}-${r.id}`}
                    type="button"
                    className="hover:bg-muted flex w-full flex-col items-start px-3 py-2 text-left border-b border-border/40 last:border-0"
                    onClick={() => {
                      setQuery("");
                      setSearchMobileOpen(false);
                      navigate({ to: r.to });
                    }}
                  >
                    <span className="truncate text-sm font-medium">{r.label}</span>
                    <span className="text-muted-foreground text-[11px]">{r.sub}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Main Content Area */}
        <main className="min-w-0 flex-1 p-3.5 sm:p-4 md:p-6 pb-24 lg:pb-6 overflow-x-hidden">
          <Outlet />
        </main>

        {/* Mobile Bottom Navigation Bar (Android & Mobile Touchscreens) */}
        <nav
          className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-background/95 backdrop-blur-md border-t border-border/80 px-2 py-1 safe-pb shadow-lg"
          aria-label="Mobile quick navigation"
        >
          <div className="flex items-center justify-around">
            {mobileBottomNavItems.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className="flex flex-col items-center justify-center py-1.5 px-2 rounded-lg text-muted-foreground hover:text-foreground data-[status=active]:text-primary data-[status=active]:font-semibold min-w-[56px] min-h-[48px] touch-target transition-colors relative"
                activeProps={{ "aria-current": "page" }}
              >
                <div className="relative">
                  <item.icon className="size-5 shrink-0" aria-hidden />
                  {item.badge != null && (
                    <span className="bg-risk-critical text-background absolute -top-1 -right-2 grid size-4 place-items-center rounded-full text-[9px] font-bold">
                      {item.badge}
                    </span>
                  )}
                </div>
                <span className="text-[10px] tracking-tight mt-0.5">{item.label}</span>
              </Link>
            ))}
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="flex flex-col items-center justify-center py-1.5 px-2 rounded-lg text-muted-foreground hover:text-foreground min-w-[56px] min-h-[48px] touch-target transition-colors"
              aria-label="Open all navigation options"
            >
              <Menu className="size-5 shrink-0" aria-hidden />
              <span className="text-[10px] tracking-tight mt-0.5">More</span>
            </button>
          </div>
        </nav>
      </div>

      {/* Self-Explanatory Modals */}
      <FirstTimeOnboardingModal forceOpen={tourOpen} onClose={() => setTourOpen(false)} />
      <SystemGuideModal open={guideOpen} onOpenChange={setGuideOpen} />
    </div>
  );
}

export function PermissionNotice({ permission }: { permission: string }) {
  return (
    <Badge variant="outline" className="text-muted-foreground gap-1.5">
      <AlertTriangle className="size-3.5" aria-hidden />
      Your role cannot {permission}
    </Badge>
  );
}

export { Database };
