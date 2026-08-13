/**
 * Future backend contracts. Kept in one place so the Node/Express service can be
 * implemented against exactly these paths without touching any UI code.
 */
export const ENDPOINTS = {
  login: "/auth/login",
  register: "/auth/register",
  currentUser: "/auth/me",
  dashboardSummary: "/dashboard/summary",
  transactions: "/transactions",
  transaction: (id: string) => `/transactions/${id}`,
  transactionsImport: "/transactions/import",
  firms: "/firms",
  firm: (id: string) => `/firms/${id}`,
  relationships: "/relationships",
  relationship: (id: string) => `/relationships/${id}`,
  network: "/network",
  riskOverview: "/risk/overview",
  riskForFirm: (id: string) => `/risk/firms/${id}`,
  predictions: "/predictions",
  prediction: (id: string) => `/predictions/${id}`,
  scenarios: "/scenarios",
  runScenario: (id: string) => `/scenarios/${id}/run`,
  simulations: "/simulations",
  simulation: (id: string) => `/simulations/${id}`,
  deadlocks: "/deadlocks",
  deadlock: (id: string) => `/deadlocks/${id}`,
  recommendations: "/recommendations",
  optimizationRun: "/optimization/run",
  alerts: "/alerts",
  reports: "/reports",
} as const;
