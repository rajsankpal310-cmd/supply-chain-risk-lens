# NEXUS-CFR REST API Documentation

Base URL: `http://localhost:5000/api`

## Authentication

All protected endpoints require an `Authorization` header:
`Authorization: Bearer <JWT_TOKEN>`

### 1. Auth Endpoints
- **`POST /api/auth/login`**
  - **Body**: `{ "email": "demo@nexuscfr.in", "password": "demo1234" }`
  - **Response**: `{ "success": true, "data": { "user": { ... }, "token": "JWT..." } }`
- **`POST /api/auth/register`**
  - **Body**: `{ "fullName": "...", "companyName": "...", "email": "...", "password": "...", "industry": "...", "companySize": "..." }`
  - **Response**: `{ "success": true, "data": { "user": { ... }, "token": "JWT..." } }`
- **`GET /api/auth/me`**
  - **Headers**: `Authorization: Bearer <token>`
  - **Response**: `{ "success": true, "data": { "id": "...", "fullName": "...", "email": "...", "role": "SME_ADMIN" } }`

---

### 2. Dashboard Endpoints
- **`GET /api/dashboard/summary`**
  - **Description**: Aggregates risk metrics, KPIs, historical trends, and top risky firms from the database.

---

### 3. Transaction Endpoints
- **`GET /api/transactions`**
  - **Query Parameters**: `search`, `status`, `risk`, `buyerId`, `supplierId`, `from`, `to`, `page`, `limit`, `sortBy`, `sortDir`
  - **Response**: `{ "success": true, "data": [...], "pagination": { "page": 1, "limit": 10, "total": 200, "totalPages": 20 } }`
- **`GET /api/transactions/:id`**
- **`POST /api/transactions`** (SME_ADMIN only)
- **`PUT /api/transactions/:id`** (SME_ADMIN only)
- **`DELETE /api/transactions/:id`** (SME_ADMIN only)
- **`POST /api/transactions/import`** (SME_ADMIN only)

---

### 4. Firm Endpoints
- **`GET /api/firms`**
  - **Query Parameters**: `search`, `industry`, `riskLevel`, `status`
- **`GET /api/firms/:id`**
- **`GET /api/firms/:id/transactions`**
- **`GET /api/firms/:id/relationships`**
- **`POST /api/firms`** (SME_ADMIN only)
- **`PUT /api/firms/:id`** (SME_ADMIN only)
- **`DELETE /api/firms/:id`** (SME_ADMIN only)

---

### 5. Relationship Endpoints
- **`GET /api/relationships`**
- **`GET /api/relationships/:id`**
- **`POST /api/relationships`** (SME_ADMIN only)
- **`PUT /api/relationships/:id`** (SME_ADMIN only)
- **`DELETE /api/relationships/:id`** (SME_ADMIN only)

---

### 6. Risk Endpoints
- **`GET /api/risk/overview`**
- **`GET /api/risk/firms/:id`**

---

### 7. Prediction Endpoints
- **`GET /api/predictions`**
- **`GET /api/predictions/:id`**

---

### 8. Network Graph Endpoints
- **`GET /api/network`**
  - **Response**: `{ "success": true, "data": { "nodes": [...], "edges": [...] } }`

---

### 9. Scenario & Simulation Endpoints
- **`GET /api/scenarios`**
- **`POST /api/scenarios`** (SME_ADMIN, ANALYST)
- **`POST /api/scenarios/:id/run`** (SME_ADMIN, ANALYST)
- **`GET /api/simulations`**
- **`GET /api/simulations/:id`**

---

### 10. Financial Deadlock Endpoints
- **`GET /api/deadlocks`**
- **`GET /api/deadlocks/:id`**
- **`POST /api/deadlocks/:id/resolve`** (SME_ADMIN, ANALYST)

---

### 11. Recommendation Endpoints
- **`GET /api/recommendations`**
- **`PUT /api/recommendations/:id/status`** (SME_ADMIN, ANALYST)

---

### 12. Support Optimization Endpoints
- **`POST /api/optimization/run`** (SME_ADMIN, ANALYST)
  - **Body**: `{ "budget": 1000000 }`
- **`GET /api/optimization/:id`**

---

### 13. Report Endpoints
- **`GET /api/reports`**
- **`POST /api/reports/:id/generate`** (SME_ADMIN, ANALYST)

---

### 14. Alert Endpoints
- **`GET /api/alerts`**
- **`PUT /api/alerts/:id/read`**
- **`PUT /api/alerts/read-all`**
- **`PUT /api/alerts/:id/archive`**

---

### 15. Health Check
- **`GET /health`**
  - **Response**: `{ "success": true, "status": "healthy", "timestamp": "...", "environment": "development" }`
