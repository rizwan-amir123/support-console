
# Support Dashboard Console & Autonomous Agent Pipeline

An enterprise e-commerce support architecture running an automated customer service agent framework tied directly into a human-in-the-loop escalation dashboard. Built as a high-performance monorepo managed by turborepo.

## Live links
https://support-console-backend.vercel.app/

https://support-console-frontend.vercel.app/

## 🏗️ Project Stack
Frontend - Next.js

Backend - Nest.js

Postgres over Supabase



## 🏗️ Project Architecture

```text
support-console/
├── apps/
│   ├── backend/       # NestJS/Node.js Customer Service Agent API Pipeline
│   └── frontend/      # Next.js Escalation Management Dashboard Panel
├── packages/
│   ├── eslint-config/ # Global workspace code styling configs
│   └── typescript-config/ # Shared enterprise TypeScript configurations
├── turbo.json         # Turborepo pipeline topology and build cache mapping
└── package.json       # Monorepo workspaces definition

```

---

## 🛠️ Local Development Setup

### 1. Installation

Install all dependencies across all workspace projects simultaneously from the root directory:

```bash
npm install

```

### 2. Database & Data Seeding

To initialize your mock database records and run baseline behavioral tests, execute the backend seeding command:

```bash
npx tsx apps/backend/seed.ts

```

### 3. Environment Variables

Placed in .env in support-console/apps/backend:

```bash
# Supabase
SUPABASE_URL=
SUPABASE_ANON_KEY=

# Groq
GROQ_API_KEY=

# Optional
PORT=3001

```
Placed in .env in support-console/apps/frontend:

```bash
NEXT_PUBLIC_API_URL=

```

### 4. Run Development Servers

Run backend server from folder support-console/apps/backend:

```bash
npm run start:dev

```

Run frontend server from folder support-console/apps/frontend:

```bash
npx next dev -p 3000

```

* Frontend Console: `http://localhost:3000`
* Backend Agent Server: `http://localhost:3001`

---

### 5. Schemas for Database

The SQL query used to initiate tables in placed in initial.sql file inside support-console/apps/backend


## 🧪 Simulation Matrix Testing

The agent pipeline features custom fallback validation logic and mathematical business guardrails. You can test execution routes directly via `curl` requests while your backend development server is running locally. 

Before running any test case, reset your local database state to baseline:
```bash
npx tsx apps/backend/seed.ts

```
Use the url http://localhost:3001/api if testing locally. 

#### 🧪 Test 1: Standard Refund Request

* **Target:** `ORD-101` (Delivered, $150 total, $0 refunded)
* **Expected Flow:** Proposes a $50 refund and pushes an escalation entry smoothly to `/queue`.

```bash
curl -X POST https://support-console-backend.vercel.app/api/agent/process \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Please refund me for order ORD-101, it came cracked into pieces.",
    "orderId": "ORD-101"
  }'

```

#### 🧪 Test 2: Over-Amount Protection Check

* **Target:** `ORD-102` (Delivered, $40 total value)
* **Expected Flow:** Customer requests $300. The agent catches the hard cap constraint ($40 max available pool) and dynamically clamps/auto-corrects the proposal entry down to $40 instead.

```bash
curl -X POST https://support-console-backend.vercel.app/api/agent/process \
  -H "Content-Type: application/json" \
  -d '{
    "message": "I want a $300 refund for order ORD-102 because customer service took too long.",
    "orderId": "ORD-102"
  }'

```

#### 🧪 Test 3: Double Refund Protection (Cap Lock Check)

* **Target:** `ORD-105` (Delivered, $100 total, already fully refunded $100, `is_fully_refunded: true` `🔒`)
* **Expected Flow:** The validation layer catches the absolute cap lock state. `calculateRefundAmount` evaluates to $0 available, throws a block error, and refuses to duplicate an escalation proposal to your dashboard.

```bash
curl -X POST https://support-console-backend.vercel.app/api/agent/process \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Hey, I never got my money back for order ORD-105. Can I get a refund?",
    "orderId": "ORD-105"
  }'

```

#### 🧪 Test 4: In-Transit Logistics Block

* **Target:** `ORD-104` (Status: `shipped`)
* **Expected Flow:** Customer wants a cancellation. The logistics check catches that `shipped` packages cannot be cancelled. The agent handles the intercept gracefully, informs the user it has already left the warehouse, and shifts focus to offer a post-delivery return/refund mechanism instead.

```bash
curl -X POST https://support-console-backend.vercel.app/api/agent/process \
  -H "Content-Type: application/json" \
  -d '{
    "message": "I changed my mind, please cancel my order ORD-104 immediately.",
    "orderId": "ORD-104"
  }'

```

#### 🧪 Test 5: Clean Order Cancellation (Unshipped)

* **Target:** `ORD-103` (Status: `processing`)
* **Expected Flow:** The order hasn't left the facility yet. The system passes the check and generates a clean cancellation proposal escalation trace directly.

```bash
curl -X POST https://support-console-backend.vercel.app/api/agent/process \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Please cancel my order ORD-103 immediately. I ordered the wrong size items.",
    "orderId": "ORD-103"
  }'

```

---

### 🖥️ End-to-End Validation Check

After hitting all 5 endpoints, your new frontend features will reflect the results beautifully:

1. Your **`/orders`** page ledger will show the baseline constraints unchanged.
2. Your **`/queue`** page will display exactly 3 valid proposed escalations (Case 1, Case 2, and Case 5) waiting for supervisors.
3. Selecting any entry will load the exact chronological timeline inside your updated **System Action Audit Trail** component!

Here is the complete, end-to-end execution flow of your application. This tracks exactly how a customer’s raw text request travels from the frontend terminal, passes through the NestJS architecture and the LLM tool loop, writes to the Supabase database, and surfaces on the human supervisor's dashboard.

## Workflow

## 🛠️ Phase 1: Request Ingestion & Routing

The process starts when a client or an automated testing tool triggers the API.

```
[cURL Request / Frontend UI] 
            │
            ▼
┌────────────────────────────────────────────────────────┐
│ 1. AgentController.processSupportRequest()             │
│    - Receives payload: { orderId, message }            │
└────────────────────────────────────────────────────────┘
            │
            ▼
┌────────────────────────────────────────────────────────┐
│ 2. AgentService.runAgentLoop()                         │
│    - Bootstraps the application state engine           │
│    - Retrieves fresh order context from database       │
└────────────────────────────────────────────────────────┘

```

---

## 🧠 Phase 2: The LLM Tool-Calling Loop

Once `runAgentLoop` is initialized, it passes the system rules, tools, and user message to the Groq SDK (`llama-3.1-8b-instant`).

```
                ┌────────────────────────────────────────┐
                │ 1. Groq Completion API Called          │
                └────────────────────────────────────────┘
                                    │
                                    ▼
                ┌────────────────────────────────────────┐
                │ 2. LLM Planner Analyzes Intent         │
                └────────────────────────────────────────┘
                                    │
                    Is state mutation required?
                     /                      \
                   YES                       NO
                   /                          \
                  ▼                            ▼
┌──────────────────────────────┐        ┌──────────────────────────────┐
│ proposeAction() Called       │        │ safeReadTools Called         │
│ - proposeRefund()            │        │ - getOrderById()             │
│ - proposeCancellation()      │        │ - getCustomerById()          │
└──────────────────────────────┘        └──────────────────────────────┘
                  │                                    │
                  ▼                                    ▼
┌──────────────────────────────┐        ┌──────────────────────────────┐
│ 3. Schema Check (Zod)        │        │ 3. Fetch Local Data          │
│    Validates key types       │        │    Returns raw database fields│
└──────────────────────────────┘        └──────────────────────────────┘
                  │                                    │
                  └─────────────────┬──────────────────┘
                                    │
                                    ▼
                ┌────────────────────────────────────────┐
                │ 4. Results Fed Back into LLM State     │
                │    Loop repeats if multi-step required │
                └────────────────────────────────────────┘

```

---

## 💾 Phase 3: Transactional Storage & Guardrail Safety

When a mutation tool like `proposeRefund` is called by the agent loop, the data passes into your transactional persistence layer.

```
┌────────────────────────────────────────────────────────────────────────┐
│ 1. AgentActionRepository.createProposedAction()                        │
│    - Writes to `agent_actions` table with status: 'proposed'           │
└────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│ 2. AuditLogService.logSystemAction()                                   │
│    - Writes an immutable record to the `audit_logs` table               │
│    - Attaches the action to the central `target_id` (Support Request)  │
└────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│ 3. Agent Returns Structured Response JSON                              │
│    - "Action proposed. Awaiting supervisor review on /queue."          │
└────────────────────────────────────────────────────────────────────────┘

```

---

## 🖥️ Phase 4: Human-in-the-Loop Supervision (Frontend)

The operational data is now visible on the React dashboard for human approval.

```
┌────────────────────────────────────────────────────────────────────────┐
│ 1. Next.js 15 App Hook: fetchAllOrders() & fetchQueue()                │
│    - Executed with cache: 'no-store' to fetch fresh database state      │
└────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│ 2. Queue Grid Renders Real-Time Rows                                   │
│    - Displays "Refunded Delta" and "Cap Lock" state status badges     │
└────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│ 3. Supervisor clicks [Approve Action]                                  │
│    - Dispatches PATCH request to: `/api/escalations/:id/approve`       │
└────────────────────────────────────────────────────────────────────────┘

```

---

## 🔒 Phase 5: Final Execution Verification (The Double-Gate)

Before your database updates, the NestJS backend re-runs physical mathematical validations to prevent race conditions or duplicate actions.

```
┌────────────────────────────────────────────────────────────────────────┐
│ 1. EscalationController.approveAction()                                │
│    - Authenticates the session and locks down the action entry         │
└────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│ 2. OrderService.verifyAndLockFinancials()                              │
│    - Retetches the order row directly from database                    │
│    - Enforces Optimistic Lock Check: .eq('version', order.version)    │
│    - Recalculates: (refunded_amount + delta) <= total_amount           │
│      ↳ If validation fails: Throws BadRequestException (Aborts!)      │
└────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│ 3. Atomic Database Mutation Commit                                     │
│    - Mutates `orders.refunded_amount`                                  │
│    - If amount matches total, sets `is_fully_refunded = true` (🔒)      │
│    - Increments `version = version + 1`                                │
│    - Updates `agent_actions.status = 'approved'`                      │
└────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│ 4. AuditLogService.appendFinalStatus()                                 │
│    - Saves a historical tracking event linked via target_id            │
│    - Frontend refreshes and streams the updated timeline successfully! │
└────────────────────────────────────────────────────────────────────────┘

```
