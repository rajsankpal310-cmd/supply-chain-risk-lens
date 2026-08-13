# Nexus Risk Navigator

BUILD THE COMPLETE WORKING FRONTEND APPLICATION NOW.

Do NOT just create a visual mockup, wireframe, static landing page, or prototype.

Build a fully functional, production-quality frontend for the project described below.

IMPORTANT:

- This is FRONTEND-FIRST development.

- Backend, database, ML models, simulation engine, Redis, queues, and real APIs will be connected later through Antigravity.

- Therefore, create a clean API-ready frontend architecture with typed interfaces, mock services, realistic mock data, loading states, error states, empty states, and clearly separated data/service layers.

- Do NOT hardcode business logic directly into UI components.

- Do NOT create fake API calls that pretend to be real backend calls.

- Use a mock service layer that can later be replaced by real REST APIs without changing the UI.

- The entire frontend must work when run locally.

- Every button, navigation item, form, filter, modal, tab, upload flow, simulation flow, and interaction should actually work on the frontend using mock data.

- Do not leave dead buttons or "coming soon" placeholders for core functionality.

==================================================

1. PROJECT NAME

==================================================

NEXUS-CFR

Full title:

NEXUS-CFR:

Data-Driven SME Financial Risk Prediction & Supply Chain Resilience Platform

Tagline:

"Predict financial risk before it becomes a supply-chain crisis."

==================================================

2. CORE PROJECT IDEA

==================================================

NEXUS-CFR is a data-driven platform for Small and Medium Enterprises (SMEs).

The platform uses SME transactional data such as:

- Buyer/Supplier

- Invoice amount

- Invoice date

- Due date

- Actual payment date

- Payment delay

- Credit period

- Outstanding amount

- Payment status

- Buyer/supplier relationships

The system will eventually use this data to:

1. Analyze historical transactions.

2. Predict future payment delays.

3. Predict financial stress.

4. Visualize supplier-buyer relationships as a network.

5. Identify how financial problems can spread through the supply chain.

6. Detect potential financial bottlenecks/deadlocks.

7. Run "what-if" financial shock scenarios.

8. Estimate cascade/contagion risk.

9. Recommend suitable financial or supply-chain interventions.

10. Optimize limited support/buffer allocation.

The frontend must be designed around these capabilities.

==================================================

3. VERY IMPORTANT PRODUCT POSITIONING

==================================================

Do NOT present NEXUS-CFR as:

- a loan provider

- an insurance company

- a replacement for TReDS

- a payment gateway

- an accounting software

- an ERP

Instead present it as:

A predictive decision-support platform that combines:

REAL TRANSACTION DATA

+

PAYMENT RISK PREDICTION

+

SUPPLY-CHAIN NETWORK ANALYSIS

+

FINANCIAL CONTAGION / IMPACT ANALYSIS

+

DEADLOCK DETECTION

+

SCENARIO SIMULATION

+

ACTIONABLE RECOMMENDATIONS

Existing financial mechanisms such as financing, credit lines, payment rescheduling, invoice financing/TReDS, alternate suppliers, and cash-buffer strategies can appear as possible recommendations.

==================================================

4. TECHNOLOGY REQUIREMENTS

==================================================

Use:

- React

- TypeScript

- Tailwind CSS

- Modern component architecture

- Reusable UI components

- React Router

- React Query/TanStack Query or an equivalent clean data-fetching abstraction

- Form validation

- D3.js or React Flow for network visualization

- Recharts or equivalent for charts

- Lucide icons

- Toast notifications

- Responsive design

Prefer a clean modern architecture that can later connect to a Node.js/Express backend.

Do NOT introduce unnecessary libraries.

==================================================

5. DESIGN DIRECTION

==================================================

Design must feel like a serious B2B fintech / risk intelligence platform.

Visual personality:

- Professional

- Modern

- Trustworthy

- Data-driven

- Clean

- Premium

- Technical but understandable

- Not flashy

- Not like a generic admin template

Use a strong visual hierarchy.

The UI should communicate:

DATA → INSIGHT → RISK → IMPACT → ACTION

Avoid excessive gradients, excessive glassmorphism, cartoon illustrations, and unnecessary animations.

Use subtle animations only where useful.

==================================================

6. GLOBAL APPLICATION STRUCTURE

==================================================

Create:

1. Public Landing Page

2. Login

3. Register

4. Forgot Password

5. Main Application

6. Dashboard

7. Transactions

8. Data Upload

9. Firms / SMEs

10. Supply Chain Network

11. Risk Intelligence

12. Predictions

13. Scenario Simulator

14. Financial Deadlock

15. Recommendations

16. Optimization

17. Reports

18. Alerts

19. Settings

20. Profile

Use protected routes for authenticated application pages.

==================================================

7. PUBLIC LANDING PAGE

==================================================

Create a professional landing page.

Sections:

### Hero

Headline:

"Predict Financial Risk Before It Becomes a Supply-Chain Crisis."

Subheadline:

"NEXUS-CFR transforms SME transaction data into payment-risk predictions, supply-chain impact analysis, and actionable financial recommendations."

Buttons:

- Explore Platform

- View Demo

### Problem Section

Explain:

A financial problem in one SME can affect connected buyers and suppliers.

Show a simple visual:

Buyer → SME → Supplier → Supplier

Then demonstrate:

Payment Delay

↓

Cash Flow Stress

↓

Payment Delay

↓

Supply Chain Impact

### Solution Section

Show four main pillars:

- Predict

- Trace

- Simulate

- Resolve

### How It Works

Real Transaction Data

→ Data Analysis

→ Risk Prediction

→ Network Analysis

→ Scenario Simulation

→ Recommendation

### Key Features

- Transaction Intelligence

- Payment Delay Prediction

- Financial Stress Prediction

- Supply Chain Graph

- Cascade Risk Analysis

- Financial Deadlock Detection

- Scenario Simulation

- Resolution Recommendations

- Support Allocation Optimization

### Why NEXUS-CFR

Explain that the platform brings transaction intelligence, network analysis and actionable resolution into one workflow.

### CTA

"Start Risk Analysis"

==================================================

8. AUTHENTICATION

==================================================

Create functional frontend-only authentication using mock auth service.

Login fields:

- Email

- Password

Register:

- Full Name

- Company Name

- Email

- Password

- Confirm Password

- Industry

- Company Size

Forgot password screen.

Implement:

- validation

- password visibility toggle

- loading state

- error state

- success state

- remember session using mock/local storage

Create an AuthContext or equivalent authentication abstraction.

IMPORTANT:

Do not tightly couple UI to localStorage.

Create:

authService.login()

authService.register()

authService.logout()

authService.getCurrentUser()

These will later be replaced with real APIs.

==================================================

9. MAIN APPLICATION LAYOUT

==================================================

Create:

### Sidebar

Logo:

NEXUS-CFR

Navigation:

Overview

Dashboard

Data

- Transactions

- Upload Data

- Firms

- Relationships

Intelligence

- Risk Intelligence

- Predictions

- Supply Chain Network

Simulation

- Scenario Simulator

- Financial Deadlock

- Simulation History

Decision Support

- Recommendations

- Optimization

Reports

- Reports

- Alerts

System

- Settings

Bottom:

- User profile

- Logout

Sidebar must be collapsible.

Mobile navigation must work.

==================================================

10. TOP NAVBAR

==================================================

Include:

- Page title

- Breadcrumb

- Search

- Notification icon

- User avatar

- User menu

- Current company/SME selector if applicable

Global search should work against mock data.

==================================================

11. MAIN DASHBOARD

==================================================

This is the most important screen.

Create a high-quality executive dashboard.

Top KPI cards:

1. Overall Risk Score

2. Payment Delay Risk

3. Financial Stress Risk

4. At-Risk Firms

5. Potential Cascade Risk

6. Outstanding Receivables

Each card should show:

- value

- trend

- comparison

- status

- tooltip

Example:

Overall Risk

72 / 100

HIGH

Payment Delay Risk

68%

+8.2% this month

At-Risk Firms

12

+3 this week

Potential Cascade Risk

72%

High

==================================================

12. DASHBOARD CHARTS

==================================================

Create:

### Payment Delay Trend

Line chart:

Date vs average payment delay.

### Outstanding Amount

Area/bar chart showing outstanding amount over time.

### Risk Distribution

Donut chart:

Low

Medium

High

Critical

### Financial Stress Trend

Historical stress score.

### Top Risky Buyers

Table:

Buyer

Transactions

Avg Delay

Outstanding

Risk

### Top Risky Suppliers

Same structure.

### Recent Alerts

Show latest risk events.

### Recommended Actions

Show top 3 recommendations.

==================================================

13. TRANSACTIONS PAGE

==================================================

Create a complete transaction management interface.

Features:

- Search

- Filter

- Sort

- Pagination

- Date range

- Buyer filter

- Supplier filter

- Payment status filter

- Risk filter

Table columns:

Transaction ID

SME

Buyer

Supplier

Invoice Amount

Invoice Date

Due Date

Payment Date

Delay

Outstanding

Status

Risk

Status examples:

Paid

Pending

Delayed

Critical

Risk:

Low

Medium

High

Critical

Clicking a transaction opens a detailed drawer/page.

==================================================

14. TRANSACTION DETAIL

==================================================

Show:

Transaction overview

Amount

Invoice date

Due date

Actual payment date

Payment delay

Payment status

Buyer information

Supplier information

Historical relationship

Payment history chart

Risk assessment

Related transactions

Potential supply-chain impact

Recommended action

==================================================

15. DATA UPLOAD PAGE

==================================================

This is extremely important.

Create a professional CSV/Excel upload workflow.

Steps:

STEP 1:

Upload File

STEP 2:

Map Columns

STEP 3:

Validate Data

STEP 4:

Preview

STEP 5:

Import

STEP 6:

Analysis Started

Support drag-and-drop.

Show accepted format:

CSV / XLSX

Expected columns:

transaction_id

sme_id

buyer_id

supplier_id

invoice_amount

invoice_date

due_date

payment_date

credit_period

outstanding_amount

payment_status

Column mapping interface must allow users to map their own column names to expected fields.

Validation should show:

- valid rows

- invalid rows

- missing fields

- duplicate rows

- invalid dates

- invalid amounts

Show preview table.

Allow:

Cancel

Back

Continue

Import

For frontend demo, use mock parsing/sample data.

Create downloadable sample CSV template button.

==================================================

16. FIRMS PAGE

==================================================

Show all connected companies.

Columns:

Firm ID

Firm Name

Industry

Role

Transactions

Buyers

Suppliers

Avg Payment Delay

Risk

Financial Stress

Firm detail page should include:

- profile

- financial overview

- buyers

- suppliers

- transaction history

- risk history

- network connections

- recommendations

==================================================

17. RELATIONSHIPS PAGE

==================================================

Manage buyer-supplier relationships.

Fields:

Source Firm

Target Firm

Relationship Type

Average Transaction Value

Credit Period

Dependency Level

Criticality

Show relationship table.

Allow add/edit/delete using frontend mock service.

==================================================

18. SUPPLY CHAIN NETWORK PAGE

==================================================

This is a flagship screen.

Create an interactive graph.

Nodes = firms.

Edges = supplier/buyer relationships.

Node size = transaction volume.

Node color/status = risk.

Edge thickness = exposure/transaction volume.

Interactions:

- zoom

- pan

- click node

- hover

- search node

- filter risk

- filter industry

- filter relationship

- isolate node

- reset view

When a node is selected, show:

Firm Name

Risk

Payment Delay

Financial Stress

Total Exposure

Connected Firms

Potential Impact

Allow switching:

Network View

Risk View

Exposure View

Impact View

==================================================

19. RISK INTELLIGENCE PAGE

==================================================

Create an overall risk analysis screen.

Sections:

### Risk Overview

Overall risk score.

### Risk Categories

Payment Risk

Financial Stress

Dependency Risk

Supply Chain Risk

Cascade Risk

### Risk Drivers

Explain WHY the score is high.

Example:

- 4 repeated payment delays

- 62% dependency on one buyer

- High outstanding amount

- Low cash buffer

Do not only show a number.

The UI must explain the reason behind risk.

==================================================

20. PREDICTIONS PAGE

==================================================

Create dedicated prediction interface.

Prediction cards:

### Payment Delay Prediction

Buyer:

B01

Probability:

82%

Expected Delay:

27 days

Confidence:

High

### Financial Stress Prediction

SME:

SME-02

Risk:

78%

Status:

High

### Prediction Timeline

Show predicted risk over next:

7 days

30 days

60 days

90 days

Include charts.

Add:

"Prediction explanation"

Show factors influencing prediction.

IMPORTANT:

For now use mock prediction results.

Create a clean predictionService abstraction.

Later backend will replace mock prediction API.

==================================================

21. SCENARIO SIMULATOR

==================================================

Create a complete "What-If" simulator.

Scenario types:

1. Buyer Payment Delay

2. Supplier Failure

3. Major Buyer Loss

4. Cash Flow Shock

5. Natural Disaster

6. Custom Scenario

Scenario configuration:

Affected Firm

Shock Type

Delay Days

Amount

Severity

Duration

Recovery Rate

Example:

Buyer Payment Delay

Firm:

Buyer B01

Delay:

60 days

Amount:

₹50,00,000

Severity:

High

Buttons:

Run Simulation

Reset

Save Scenario

Show simulation progress.

After completion show:

### Results

Affected Firms

Potential Defaults

Cascade Probability

Expected Loss

Maximum Impact

Recovery Estimate

Show before/after network.

Highlight affected nodes.

==================================================

22. SIMULATION RESULT PAGE

==================================================

Show:

Scenario Summary

Initial Shock

Propagation Path

Affected Firms

Risk Changes

Timeline

Network Graph

Probability Distribution

Expected Loss

Potential Default Count

Recovery

Recommended Intervention

Include:

Export Report

Save Scenario

Run Again

==================================================

23. FINANCIAL DEADLOCK PAGE

==================================================

Create a dedicated page for identifying financial bottlenecks.

Show chains like:

A → B → C → D

Example:

A owes B ₹10L

B owes C ₹7L

C owes D ₹5L

If A delays:

B becomes stressed

C becomes stressed

D becomes exposed

Display:

Deadlock Risk

Severity

Root Firm

Affected Firms

Total Exposure

Estimated Impact

Provide a visual chain.

Add:

"Resolve This Deadlock"

button.

==================================================

24. RECOMMENDATIONS PAGE

==================================================

This is a key decision-support screen.

Show recommendations such as:

Invoice Financing

TReDS

Credit Line

Payment Rescheduling

Alternate Supplier

Alternate Buyer

Cash Buffer

Dependency Reduction

Each recommendation must have:

Title

Risk Addressed

Reason

Expected Impact

Estimated Cost/Requirement

Priority

Confidence

Example:

RECOMMENDED ACTION

Invoice Financing

Why:

Buyer B01 has repeated delayed payments and SME has high receivable exposure.

Expected impact:

Reduce short-term liquidity stress.

Priority:

HIGH

Do NOT claim that the platform itself provides these financial products.

It only recommends appropriate options.

==================================================

25. OPTIMIZATION PAGE

==================================================

Create a resource allocation interface.

Input:

Available Support Budget

Example:

₹10,00,000

Show:

At-Risk Firms

Firm

Risk

Required Support

Impact Reduction

Priority

Then show recommended allocation:

SME01 → ₹4L

SME03 → ₹3L

SME07 → ₹2L

SME09 → ₹1L

Show:

Before Optimization

After Optimization

Cascade Risk Reduction

Expected Loss Reduction

Use mock optimization results for now.

Create optimizationService abstraction.

==================================================

26. ALERTS PAGE

==================================================

Alert categories:

Payment Delay

Financial Stress

Supply Chain

Cascade Risk

Deadlock

Critical Risk

Each alert:

Severity

Firm

Date

Reason

Impact

Recommended Action

Support:

Mark as read

Filter

Search

Archive

==================================================

27. REPORTS PAGE

==================================================

Create reports dashboard.

Reports:

- Risk Summary

- Transaction Analysis

- Payment Delay Report

- Supply Chain Risk Report

- Scenario Report

- Financial Deadlock Report

- Recommendation Report

Each report should have:

Generate

View

Download

For frontend demo, generate downloadable mock JSON/CSV/PDF-style report where feasible.

Keep report generation abstracted so backend can later generate real reports.

==================================================

28. SETTINGS

==================================================

Sections:

Profile

Company

Risk Preferences

Notifications

Data Privacy

Security

Data privacy should clearly communicate:

- Data is confidential

- Data is anonymized where applicable

- Access is role-controlled

- No raw financial data should be exposed unnecessarily

==================================================

29. PROFILE

==================================================

Show:

Name

Company

Industry

Email

Role

Allow editing with validation.

==================================================

30. ROLE SUPPORT

==================================================

Design for these roles:

SME_ADMIN

ANALYST

VIEWER

Permissions:

SME_ADMIN:

- Upload data

- Manage firms

- Run scenarios

- View recommendations

- View reports

- Manage users/settings

ANALYST:

- Analyze data

- Run simulations

- View recommendations

- Generate reports

VIEWER:

- View dashboard

- View reports

- View network

- Cannot modify data

Implement frontend route/permission guards.

==================================================

31. DATA TYPES / INTERFACES

==================================================

Create TypeScript interfaces for:

User

SME

Firm

Transaction

Relationship

RiskScore

Prediction

RiskFactor

Scenario

SimulationRun

SimulationResult

Deadlock

Recommendation

OptimizationRun

Alert

Report

Example:

Transaction:

{

  id: string;

  smeId: string;

  buyerId: string;

  supplierId?: string;

  invoiceAmount: number;

  invoiceDate: string;

  dueDate: string;

  paymentDate?: string;

  paymentDelayDays?: number;

  creditPeriodDays?: number;

  outstandingAmount: number;

  paymentStatus: "PAID" | "PENDING" | "DELAYED" | "CRITICAL";

}

Prediction:

{

  id: string;

  firmId: string;

  type: "PAYMENT_DELAY" | "FINANCIAL_STRESS";

  probability: number;

  riskLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

  predictedDate?: string;

  confidence: number;

  factors: RiskFactor[];

}

Keep these interfaces centralized.

==================================================

32. SERVICE ARCHITECTURE

==================================================

Create separate services:

authService

transactionService

firmService

relationshipService

uploadService

riskService

predictionService

networkService

scenarioService

simulationService

deadlockService

recommendationService

optimizationService

alertService

reportService

For now:

Each service uses realistic mock data.

Example:

transactionService.getTransactions()

transactionService.getTransactionById(id)

transactionService.createTransaction(data)

transactionService.updateTransaction(id, data)

transactionService.deleteTransaction(id)

predictionService.getPredictions()

simulationService.runSimulation(input)

recommendationService.getRecommendations()

The UI must never directly manipulate mock arrays.

==================================================

33. API-READY ARCHITECTURE

==================================================

Create a centralized API client.

Example conceptual structure:

apiClient.get()

apiClient.post()

apiClient.put()

apiClient.delete()

Use environment variables:

VITE_API_BASE_URL

For now:

VITE_USE_MOCK_API=true

Later:

VITE_USE_MOCK_API=false

When false, services should call the backend.

Do not rewrite page components later.

==================================================

34. FUTURE BACKEND CONTRACTS

==================================================

Prepare frontend service contracts for:

POST /auth/login

POST /auth/register

GET /dashboard/summary

GET /transactions

GET /transactions/:id

POST /transactions

PUT /transactions/:id

DELETE /transactions/:id

POST /transactions/import

GET /firms

GET /firms/:id

GET /relationships

POST /relationships

GET /network

GET /risk/overview

GET /risk/firms/:id

GET /predictions

GET /predictions/:id

POST /scenarios

GET /scenarios

POST /scenarios/:id/run

GET /simulations

GET /simulations/:id

GET /deadlocks

GET /deadlocks/:id

GET /recommendations

POST /optimization/run

GET /alerts

GET /reports

Do not implement real backend endpoints now.

Only prepare the frontend service interfaces.

==================================================

35. LOADING STATES

==================================================

Every data-dependent page must have:

- Skeleton loading

- Spinner where appropriate

- Progress state for simulations

- Upload progress

- Prediction processing state

Do not leave blank screens while loading.

==================================================

36. ERROR STATES

==================================================

Create reusable:

ErrorState component.

Examples:

- Failed to load transactions

- Upload failed

- Invalid file

- Prediction unavailable

- Simulation failed

- Network unavailable

Include:

Retry

==================================================

37. EMPTY STATES

==================================================

Examples:

No transactions

No predictions

No alerts

No scenarios

No recommendations

No network relationships

Every empty state should explain what the user should do next.

Example:

"No transaction data yet."

"Upload your historical transaction CSV to begin risk analysis."

Button:

Upload Data

==================================================

38. TOASTS

==================================================

Use toast notifications for:

Success

Error

Warning

Info

Examples:

"Transaction imported successfully."

"Simulation completed."

"Scenario saved."

"Invalid file format."

==================================================

39. SEARCH / FILTER SYSTEM

==================================================

Implement reusable filtering.

Search:

Transactions

Firms

Buyers

Suppliers

Alerts

Recommendations

Filters should update UI immediately.

==================================================

40. RESPONSIVE DESIGN

==================================================

Must work on:

Desktop

Laptop

Tablet

Mobile

Desktop is primary because this is a B2B analytics platform.

Tables should become horizontally scrollable or responsive cards on smaller screens.

Graph should remain usable on tablet/mobile.

==================================================

41. ACCESSIBILITY

==================================================

Implement:

- Keyboard navigation

- Proper labels

- Focus states

- Accessible buttons

- ARIA where necessary

- Good contrast

- Tooltips for technical metrics

==================================================

42. UX RULE

==================================================

Do not expose unnecessary technical terminology.

For example:

Instead of only:

"Contagion Probability"

show:

"Supply Chain Cascade Risk"

with tooltip:

"Estimated probability that financial stress may spread to connected firms."

Use simple explanations throughout.

==================================================

43. MOCK DATA REQUIREMENTS

==================================================

Create realistic demo data.

Minimum:

20 firms

50 relationships

200 transactions

15 predictions

10 alerts

8 recommendations

5 scenarios

5 deadlocks

Use realistic Indian SME context.

Currency:

INR ₹

Dates should be realistic.

Industries:

Auto Components

Textiles

Engineering

Manufacturing

Food Processing

Electronics

Packaging

Do not use random meaningless placeholder text.

==================================================

44. DEMO DATA SCENARIOS

==================================================

Create a few meaningful demo scenarios.

Scenario 1:

Major buyer payment delay

Scenario 2:

Critical supplier failure

Scenario 3:

High dependency buyer failure

Scenario 4:

Cash-flow shock

Scenario 5:

Natural disaster disruption

Each should produce visually meaningful mock results.

==================================================

45. VISUAL STORYTELLING

==================================================

The application should clearly communicate this journey:

DATA

↓

INSIGHT

↓

PREDICTION

↓

NETWORK IMPACT

↓

DEADLOCK

↓

SIMULATION

↓

RECOMMENDATION

↓

ACTION

Use this structure consistently.

==================================================

46. IMPORTANT RISK VISUALIZATION

==================================================

Use consistent semantic states:

LOW

MEDIUM

HIGH

CRITICAL

Do not rely only on colors.

Use:

- icon

- label

- badge

- tooltip

so users can understand risk without color alone.

==================================================

47. NETWORK VISUALIZATION DETAILS

==================================================

Graph legend:

Node:

Firm

Edge:

Business Relationship

Node size:

Transaction volume

Edge thickness:

Exposure

Risk:

Risk status

Selected node:

Detailed panel

High-risk chain:

Highlighted path

Provide a legend.

==================================================

48. SIMULATION UX

==================================================

When user clicks Run Simulation:

Show:

Preparing scenario

↓

Building network

↓

Applying shock

↓

Simulating propagation

↓

Calculating impact

↓

Generating recommendations

↓

Complete

This is frontend mock progress only.

Later backend workers will provide real progress.

==================================================

49. PERFORMANCE

==================================================

Optimize for:

- Large tables

- Network graph

- Charts

- Filtering

- Pagination

- Lazy loading

- Component reuse

Do not render thousands of DOM elements unnecessarily.

==================================================

50. CODE QUALITY

==================================================

Use clean folder structure:

src/

  components/

  pages/

  layouts/

  routes/

  services/

  api/

  hooks/

  types/

  mocks/

  utils/

  context/

  charts/

  network/

  forms/

Keep business logic out of presentation components.

Use reusable components.

Avoid duplicated code.

Use TypeScript properly.

Avoid any unnecessary `any` types.

==================================================

51. CORE REUSABLE COMPONENTS

==================================================

Create reusable:

MetricCard

RiskBadge

StatusBadge

DataTable

SearchBar

FilterPanel

DateRangePicker

EmptyState

ErrorState

LoadingSkeleton

ConfirmDialog

Modal

Drawer

FileUploader

ColumnMapper

ProgressStepper

ChartCard

RiskGauge

RiskTimeline

NetworkGraph

AlertCard

RecommendationCard

SimulationProgress

SimulationResultCard

Pagination

Breadcrumb

PageHeader

==================================================

52. FRONTEND BUSINESS FLOW

==================================================

Implement this exact demo flow:

LOGIN

↓

DASHBOARD

↓

UPLOAD TRANSACTION DATA

↓

DATA VALIDATION

↓

IMPORT

↓

TRANSACTION ANALYSIS

↓

RISK PREDICTION

↓

SUPPLY CHAIN NETWORK

↓

SELECT HIGH-RISK FIRM

↓

VIEW IMPACT

↓

RUN WHAT-IF SCENARIO

↓

DETECT CASCADE / DEADLOCK

↓

SHOW RECOMMENDATIONS

↓

OPTIMIZE SUPPORT

↓

GENERATE REPORT

Every step should work with mock data.

==================================================

53. DEMO USER EXPERIENCE

==================================================

Create a default demo account.

On login, the user should immediately see meaningful data.

Do not show an empty dashboard.

Create a "Demo Mode" indicator if mock data is being used.

Clearly label mock/demo data so users do not mistake it for real financial information.

==================================================

54. NO FAKE CLAIMS

==================================================

Never claim:

"AI has analyzed real company data"

unless actual real data has been connected.

For demo data show:

"Demo Dataset"

or

"Sample Data"

Later, when backend and real SME data are connected, this label can change.

==================================================

55. FUTURE INTEGRATION

==================================================

The frontend must be ready for future:

- Node.js/Express backend

- MongoDB

- Python ML service

- Graph algorithms

- Monte Carlo simulation

- Redis

- BullMQ workers

- Optimization solver

- WebSockets/SSE

- Real SME transaction data

Do not implement those backend systems now.

But create frontend interfaces and service contracts so they can be connected later.

==================================================

56. FINAL QUALITY REQUIREMENT

==================================================

Before finishing:

Check every route.

Check every button.

Check every form.

Check every modal.

Check every filter.

Check every table.

Check every chart.

Check file upload flow.

Check scenario simulation flow.

Check recommendation flow.

Check responsive layout.

Check loading states.

Check error states.

Check empty states.

Check authentication.

Fix all console errors.

Fix all TypeScript errors.

Do not leave broken navigation.

Do not leave dead buttons.

Do not leave unfinished core screens.

==================================================

57. FINAL ACCEPTANCE CRITERIA

==================================================

The frontend is complete only if:

✓ User can login

✓ User can navigate all pages

✓ Dashboard contains meaningful data

✓ Transactions can be viewed/filtered

✓ Transaction details work

✓ CSV/XLSX upload flow works with mock parsing

✓ Column mapping works

✓ Data validation works

✓ Firms can be viewed

✓ Relationships can be viewed/managed

✓ Network graph is interactive

✓ Risk dashboard works

✓ Predictions are displayed

✓ Scenario can be configured

✓ Simulation can be run using mock results

✓ Simulation progress is shown

✓ Deadlock page works

✓ Recommendations work

✓ Optimization page works

✓ Alerts work

✓ Reports work

✓ Settings work

✓ Responsive design works

✓ Loading/error/empty states exist

✓ Mock service layer exists

✓ API abstraction exists

✓ TypeScript interfaces exist

✓ Frontend is ready for future backend integration

MOST IMPORTANT:

Do not stop at generating the UI.

Actually implement the complete frontend application and make it runnable.

After implementation, verify the application and fix all major issues.
Also ui ux should be standar and good

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://supply-chain-risk-lens.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/61855cfb-1bd5-4c54-93ff-582c23f23c41).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
