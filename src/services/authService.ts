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
      const user = await apiClient.post<User>(ENDPOINTS.login, { email, password });
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
      const user = await apiClient.post<User>(ENDPOINTS.register, input);
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
};
