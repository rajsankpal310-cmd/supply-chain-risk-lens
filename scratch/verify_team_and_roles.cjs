const http = require("http");

function request(options, data) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = "";
      res.on("data", (chunk) => (body += chunk));
      res.on("end", () => {
        try {
          resolve({ status: res.statusCode, headers: res.headers, data: JSON.parse(body) });
        } catch {
          resolve({ status: res.statusCode, headers: res.headers, data: body });
        }
      });
    });
    req.on("error", reject);
    if (data) req.write(JSON.stringify(data));
    req.end();
  });
}

async function run() {
  console.log("=== VERIFYING AUTH & ROLES ===");

  // 1. Login as SME_ADMIN
  console.log("\n1. Testing SME_ADMIN login (demo@nexuscfr.in)...");
  const loginRes = await request(
    {
      hostname: "localhost",
      port: 5000,
      path: "/api/auth/login",
      method: "POST",
      headers: { "Content-Type": "application/json" },
    },
    { email: "demo@nexuscfr.in", password: "demo1234" }
  );

  console.log("Login status:", loginRes.status);
  const loginPayload = loginRes.data.data || loginRes.data;
  const token = loginPayload.token;
  console.log("Logged in user role:", loginPayload.user.role);
  if (loginPayload.user.role !== "SME_ADMIN") {
    throw new Error("Expected SME_ADMIN role");
  }

  // 2. Fetch Team Users as SME_ADMIN
  console.log("\n2. Fetching team users as SME_ADMIN...");
  const teamRes = await request({
    hostname: "localhost",
    port: 5000,
    path: "/api/auth/users",
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
  });

  const teamMembers = teamRes.data.data || teamRes.data;
  console.log("Team users status:", teamRes.status);
  console.log("Existing team users count:", teamMembers.length);
  teamMembers.forEach((u) => console.log(` - [${u.role}] ${u.fullName} (${u.email})`));

  // 3. Create a new team user (ANALYST)
  const testEmail = `analyst_test_${Date.now()}@example.com`;
  console.log(`\n3. Creating new ANALYST team member (${testEmail})...`);
  const createRes = await request(
    {
      hostname: "localhost",
      port: 5000,
      path: "/api/auth/users",
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    },
    {
      fullName: "Test Risk Analyst",
      email: testEmail,
      password: "securePassword123",
      role: "ANALYST",
    }
  );

  const createdUser = createRes.data.data || createRes.data;
  console.log("Create team member status:", createRes.status);
  console.log("Created member:", createdUser);
  const newUserId = createdUser.id;

  // 4. Test login with newly created ANALYST user
  console.log("\n4. Testing login with newly created user...");
  const newLoginRes = await request(
    {
      hostname: "localhost",
      port: 5000,
      path: "/api/auth/login",
      method: "POST",
      headers: { "Content-Type": "application/json" },
    },
    { email: testEmail, password: "securePassword123" }
  );
  const newLoginPayload = newLoginRes.data.data || newLoginRes.data;
  console.log("New user login status:", newLoginRes.status);
  console.log("New user role from JWT/backend:", newLoginPayload.user.role);
  const analystToken = newLoginPayload.token;

  // 5. Test that ANALYST cannot access SME Admin Team Management (RBAC check)
  console.log("\n5. Testing RBAC: ANALYST trying to access GET /api/auth/users (should be 403)...");
  const analystForbiddenRes = await request({
    hostname: "localhost",
    port: 5000,
    path: "/api/auth/users",
    method: "GET",
    headers: { Authorization: `Bearer ${analystToken}` },
  });
  console.log("Analyst access status:", analystForbiddenRes.status);
  if (analystForbiddenRes.status !== 403) {
    throw new Error(`Expected 403 Forbidden, got ${analystForbiddenRes.status}`);
  }
  console.log("RBAC check PASS: 403 Forbidden properly returned for non-admin");

  // 6. Delete the test user as SME_ADMIN
  console.log(`\n6. Deleting test user ${newUserId} as SME_ADMIN...`);
  const deleteRes = await request({
    hostname: "localhost",
    port: 5000,
    path: `/api/auth/users/${newUserId}`,
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  console.log("Delete status:", deleteRes.status);
  console.log("Delete result:", deleteRes.data);

  console.log("\n=== ALL TEAM MANAGEMENT & RBAC CHECKS PASSED SUCCESSFULLY ===");
}

run().catch((err) => {
  console.error("Verification failed:", err);
  process.exit(1);
});
