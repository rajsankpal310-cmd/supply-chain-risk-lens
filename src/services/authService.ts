import { ApiError, USE_MOCK_API, apiClient, mockDelay } from "@/api/client";
import { ENDPOINTS } from "@/api/contracts";
import { demoUser } from "@/mocks/data";
import type { Credentials, RegisterInput, User } from "@/types";

const STORAGE_KEY = "nexus-cfr.session";

/** Storage is isolated here so the UI never touches localStorage directly. */
const sessionStore = {
  read(): User | null {
    if (typeof window === "undefined") return null;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      return raw ? (JSON.parse(raw) as User) : null;
    } catch {
      return null;
    }
  },
  write(user: User | null) {
    if (typeof window === "undefined") return;
    if (user) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
    else window.localStorage.removeItem(STORAGE_KEY);
  },
};

export const DEMO_CREDENTIALS = { email: "demo@nexuscfr.in", password: "demo1234" };

export const authService = {
  async login({ email, password }: Credentials): Promise<User> {
    if (!USE_MOCK_API) {
      const res = await apiClient.post<{ user: User; token: string } | User>(ENDPOINTS.login, { email, password });
      const user = "user" in res ? res.user : res;
      const token = "token" in res ? res.token : null;
      if (token && typeof window !== "undefined") {
        window.localStorage.setItem("nexus-cfr.token", token);
      }
      sessionStore.write(user);
      return user;
    }
    await mockDelay(600);
    if (password.length < 6) throw new ApiError("Incorrect email or password. Please try again.", 401);
    const user: User =
      email.trim().toLowerCase() === DEMO_CREDENTIALS.email
        ? demoUser
        : {
            ...demoUser,
            id: `USR-${email.length}`,
            email: email.trim(),
            fullName: email.split("@")[0]!.replace(/[._]/g, " "),
            avatarInitials: email.slice(0, 2).toUpperCase(),
          };
    sessionStore.write(user);
    return user;
  },

  async register(input: RegisterInput): Promise<User> {
    if (!USE_MOCK_API) {
      const res = await apiClient.post<{ user: User; token: string } | User>(ENDPOINTS.register, input);
      const user = "user" in res ? res.user : res;
      const token = "token" in res ? res.token : null;
      if (token && typeof window !== "undefined") {
        window.localStorage.setItem("nexus-cfr.token", token);
      }
      sessionStore.write(user);
      return user;
    }
    await mockDelay(700);
    const user: User = {
      id: `USR-${Date.now()}`,
      fullName: input.fullName,
      email: input.email,
      companyName: input.companyName,
      industry: input.industry,
      companySize: input.companySize,
      role: "SME_ADMIN",
      avatarInitials: input.fullName
        .split(" ")
        .map((p) => p[0])
        .slice(0, 2)
        .join("")
        .toUpperCase(),
    };
    sessionStore.write(user);
    return user;
  },

  async requestPasswordReset(email: string): Promise<{ sent: true }> {
    await mockDelay(600);
    if (!email.includes("@")) throw new ApiError("Enter a valid email address.", 400);
    return { sent: true };
  },

  async logout(): Promise<void> {
    await mockDelay(120);
    if (typeof window !== "undefined") {
      window.localStorage.removeItem("nexus-cfr.token");
    }
    sessionStore.write(null);
  },

  getCurrentUser(): User | null {
    return sessionStore.read();
  },

  updateProfile(patch: Partial<User>): User {
    const current = sessionStore.read() ?? demoUser;
    const next = { ...current, ...patch };
    sessionStore.write(next);
    return next;
  },

  async getTeamUsers(): Promise<User[]> {
    if (!USE_MOCK_API) {
      return apiClient.get<User[]>(ENDPOINTS.teamUsers);
    }
    await mockDelay(300);
    const currentUser = sessionStore.read() ?? demoUser;
    return [
      currentUser,
      {
        ...demoUser,
        id: "USR-ANALYST-01",
        email: "analyst@nexus-cfr.demo",
        fullName: "Rahul Varma",
        role: "ANALYST",
        avatarInitials: "RV",
      },
      {
        ...demoUser,
        id: "USR-VIEWER-01",
        email: "viewer@nexus-cfr.demo",
        fullName: "Priya Nair",
        role: "VIEWER",
        avatarInitials: "PN",
      },
    ];
  },

  async createTeamUser(input: {
    fullName: string;
    email: string;
    password: string;
    role: "ANALYST" | "VIEWER";
  }): Promise<User> {
    if (!USE_MOCK_API) {
      return apiClient.post<User>(ENDPOINTS.teamUsers, input);
    }
    await mockDelay(400);
    const newUser: User = {
      ...demoUser,
      id: `USR-${Date.now()}`,
      fullName: input.fullName,
      email: input.email,
      role: input.role,
      avatarInitials: input.fullName
        .split(" ")
        .map((p) => p[0])
        .slice(0, 2)
        .join("")
        .toUpperCase(),
    };
    return newUser;
  },

  async removeTeamUser(userId: string): Promise<void> {
    if (!USE_MOCK_API) {
      return apiClient.delete<void>(ENDPOINTS.teamUser(userId));
    }
    await mockDelay(300);
  },
};
