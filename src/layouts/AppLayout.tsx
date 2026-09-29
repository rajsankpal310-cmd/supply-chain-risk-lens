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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import { cn } from "@/lib/utils";
import * as db from "@/mocks/data";
import type { UserRole } from "@/types";

const NAV_GROUPS = [
  {
    label: "Overview",
    items: [{ to: "/app/dashboard", label: "Dashboard", icon: LayoutDashboard }],
  },
  {
    label: "Data",
    items: [
      { to: "/app/transactions", label: "Transactions", icon: Table2 },
      { to: "/app/upload", label: "Upload Data", icon: Upload },
      { to: "/app/firms", label: "Firms", icon: Building2 },
      { to: "/app/relationships", label: "Relationships", icon: Share2 },
    ],
  },
  {
    label: "Intelligence",
    items: [
      { to: "/app/risk", label: "Portfolio Risk", icon: Gauge },
      { to: "/app/predictions", label: "Predictions", icon: TrendingUp },
      { to: "/app/network", label: "Supply Chain Network", icon: Network },
    ],
  },
  {
    label: "Simulation",
    items: [
      { to: "/app/simulator", label: "Scenario Simulator", icon: Activity },
      { to: "/app/deadlocks", label: "Financial Deadlock", icon: GitBranch },
      { to: "/app/simulations", label: "Simulation History", icon: History },
    ],
  },
  {
    label: "Decision Support",
    items: [
      { to: "/app/recommendations", label: "Recommendations", icon: Lightbulb },
      { to: "/app/optimization", label: "Optimization", icon: Sliders },
    ],
  },
  {
    label: "Reports",
    items: [
      { to: "/app/reports", label: "Reports", icon: FileText },
      { to: "/app/alerts", label: "Alerts", icon: Bell },
    ],
  },
  {
    label: "System",
    items: [{ to: "/app/settings", label: "Settings", icon: Settings }],
  },
] as const;

function canRoleAccess(role: UserRole | undefined, path: string): boolean {
  if (!role || role === "SME_ADMIN") return true;
  if (role === "ANALYST") {
    if (path === "/app/upload" || path === "/app/settings") return false;
    return true;
  }
  if (role === "VIEWER") {
    const allowed = [
      "/app/dashboard",
      "/app/transactions",
      "/app/firms",
      "/app/relationships",
      "/app/risk",
      "/app/predictions",
      "/app/network",
      "/app/reports",
      "/app/alerts",
      "/app/profile",
    ];
    return allowed.includes(path);
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
  "/app/simulations": "Simulation History",
  "/app/recommendations": "Recommendations",
  "/app/optimization": "Optimization",
  "/app/reports": "Reports",
  "/app/alerts": "Alerts",
  "/app/settings": "Settings",
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

  const filteredNavGroups = useMemo(() => {
    return NAV_GROUPS.map((group) => ({
      ...group,
      items: group.items.filter((item) => canRoleAccess(user?.role, item.to)),
    })).filter((group) => group.items.length > 0);
  }, [user?.role]);

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

  const unread = db.alerts.filter((a) => !a.read).length;
  const title = TITLES[location.pathname] ?? "NEXUS-CFR";
  const crumbGroup = NAV_GROUPS.find((g) => g.items.some((i) => location.pathname.startsWith(i.to)))?.label ?? "Overview";

  async function handleLogout() {
    await logout();
    toast.success("Signed out");
    navigate({ to: "/login", replace: true });
  }

  const sidebar = (
    <div className={cn("bg-sidebar border-sidebar-border flex h-full flex-col border-r transition-[width]", collapsed ? "w-[74px]" : "w-64")}>
      <div className="border-sidebar-border flex h-16 items-center gap-2 border-b px-4">
        <div className="bg-primary text-primary-foreground grid size-8 shrink-0 place-items-center rounded-md font-bold">N</div>
        {!collapsed && (
          <div className="min-w-0">
            <p className="text-sidebar-foreground truncate text-sm font-semibold tracking-tight">NEXUS-CFR</p>
            <p className="text-muted-foreground truncate text-[10px] tracking-wide uppercase">Supply Chain Resilience</p>
          </div>
        )}
        <Button variant="ghost" size="icon" className="ml-auto hidden lg:inline-flex" onClick={() => setCollapsed((c) => !c)} aria-label="Toggle sidebar">
          <ChevronLeft className={cn("size-4 transition-transform", collapsed && "rotate-180")} aria-hidden />
        </Button>
        <Button variant="ghost" size="icon" className="ml-auto lg:hidden" onClick={() => setMobileOpen(false)} aria-label="Close navigation">
          <X className="size-4" aria-hidden />
        </Button>
      </div>

      <nav className="flex-1 space-y-4 overflow-y-auto px-3 py-4" aria-label="Main navigation">
        {filteredNavGroups.map((group) => (
          <div key={group.label}>
            {!collapsed && <p className="text-muted-foreground px-2 pb-1.5 text-[10px] font-semibold tracking-wider uppercase">{group.label}</p>}
            <ul className="space-y-0.5">
              {group.items.map((item) => (
                <li key={item.to}>
                  <Link
                    to={item.to}
                    title={item.label}
                    className="text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground data-[status=active]:bg-primary/12 data-[status=active]:text-primary flex items-center gap-3 rounded-md px-2.5 py-2 text-sm font-medium transition-colors data-[status=active]:font-semibold"
                    activeProps={{ "aria-current": "page" }}
                  >
                    <item.icon className="size-4 shrink-0" aria-hidden />
                    {!collapsed && <span className="truncate">{item.label}</span>}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-sidebar-border border-t p-3">
        <Link to="/app/profile" className="hover:bg-sidebar-accent flex items-center gap-3 rounded-md p-2 transition-colors">
          <Avatar className="size-8">
            <AvatarFallback className="bg-primary/15 text-primary text-xs font-semibold">{user?.avatarInitials}</AvatarFallback>
          </Avatar>
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{user?.fullName}</p>
              <p className="text-muted-foreground truncate text-[11px]">{user?.role.replace("_", " ")}</p>
            </div>
          )}
        </Link>
        <Button variant="ghost" className="text-muted-foreground hover:text-foreground mt-1 w-full justify-start gap-3 px-2" onClick={handleLogout}>
          <LogOut className="size-4" aria-hidden />
          {!collapsed && "Log out"}
        </Button>
      </div>
    </div>
  );

  return (
    <div className="bg-background flex min-h-screen">
      <aside className="sticky top-0 hidden h-screen lg:block">{sidebar}</aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="bg-background/70 absolute inset-0" onClick={() => setMobileOpen(false)} aria-hidden />
          <div className="absolute inset-y-0 left-0">{sidebar}</div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="border-border bg-background/85 sticky top-0 z-40 flex h-16 items-center gap-3 border-b px-4 backdrop-blur md:px-6">
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setMobileOpen(true)} aria-label="Open navigation">
            <Menu className="size-5" aria-hidden />
          </Button>

          <div className="min-w-0">
            <nav aria-label="Breadcrumb" className="text-muted-foreground hidden text-[11px] md:block">
              NEXUS-CFR / {crumbGroup} / <span className="text-foreground">{title}</span>
            </nav>
            <h2 className="truncate text-sm font-semibold md:text-base">{title}</h2>
          </div>

          <div className="relative ml-auto hidden w-72 md:block">
            <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" aria-hidden />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search firms, transactions, alerts"
              className="pl-9"
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

          <DemoDataBadge className="hidden xl:inline-flex" />

          {/* Help & System Tour Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="gap-1.5 text-xs text-muted-foreground hover:text-foreground hidden sm:inline-flex"
                title="System Guide, Glossary & Product Tour"
              >
                <HelpCircle className="size-4 text-primary" />
                <span>Help & Tour</span>
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
          >
            {theme === "dark" ? <Sun className="size-5" aria-hidden /> : <Moon className="size-5" aria-hidden />}
          </Button>

          <Button variant="ghost" size="icon" className="relative" onClick={() => navigate({ to: "/app/alerts" })} aria-label={`Alerts, ${unread} unread`}>
            <Bell className="size-5" aria-hidden />
            {unread > 0 && <span className="bg-risk-critical text-background absolute top-1 right-1 grid size-4 place-items-center rounded-full text-[9px] font-bold">{unread}</span>}
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="gap-2 px-2">
                <Avatar className="size-7">
                  <AvatarFallback className="bg-primary/15 text-primary text-[11px] font-semibold">{user?.avatarInitials}</AvatarFallback>
                </Avatar>
                <span className="hidden max-w-44 truncate text-sm font-medium md:inline">{user?.organizationName || user?.companyName}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <DropdownMenuLabel className="flex flex-col">
                <span>{user?.fullName}</span>
                <span className="text-muted-foreground text-xs font-normal">{user?.email}</span>
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
                  {user?.role.replace("_", " ")}
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

        <main className="min-w-0 flex-1 p-4 md:p-6">
          <Outlet />
        </main>
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
