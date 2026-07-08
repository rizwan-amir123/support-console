# Support Operations Console – System Architecture

## Overview
This application is a production-ready, full-stack system built with a tool-calling agentic AI backend and a human-centric support supervisor dashboard. The architecture is engineered to safely automate routine support tasks (refunds, cancellations) while keeping humans firmly in control of operations carrying financial or data risk.

### Tech Stack
- **Backend Framework:** NestJS (Node.js) with modular dependency injection.
- **Frontend Architecture:** Next.js 15 (App Router, React Client Hooks).
- **Data Layer:** Supabase / PostgreSQL utilizing row-level transactional versioning.
- **Styling:** Tailwind CSS optimized with a unified monorepo utility layout.

### Core Architectural Principles
1. **Safety First:** Escalate by default. The AI loop proposes; only authenticated humans execute.
2. **Immutability:** Every system alteration writes an append-only audit trail.
3. **Concurrency Safety:** Dual-gate optimistic locking prevents double-refunding or race conditions.

---

## Agent Boundary

### Autonomous Actions (Read-Only & Low Risk)
The AI agent is completely restricted from mutating financial states autonomously. It may execute the following read-only operations:
- Fetch order schemas, fulfillment state, and customer transactional telemetry.
- Query historical audit lines to gather state context.
- Summarize internal notes or customer conversation data strings.

### Escalation-Only Actions (High Risk)
Any operation involving capital mutation or logistical alterations requires an explicit human-in-the-loop sign-off:
- Financial actions (Partial or full refund proposals).
- Logistical actions (Order cancellation proposals).

### Code-Level Enforcement (Anti-Jailbreak Protection)
We do not rely on prompt engineering to keep the agent in bounds. The boundary is enforced by a state-machine token pattern at the service and database layer:

1. **State Isolation:** The agent loop only has access to a `proposeAction()` command. It lacks the database permissions and code paths required to call final execution hooks.
2. **The Proposal Token:** Calling a proposal writes a row to `agent_actions` with `status: 'proposed'`.
3. **Atomic Supervision Gate:** The transition from `proposed` to `executed` can only be achieved via the `@Patch('escalations/:id/approve')` controller route. This route requires a validated `reviewerId` session token, completely bypassing the LLM context.

---

## Tool Design

### Philosophy
Tools are structured as micro-interfaces exposing minimal surface areas. They enforce the **Principle of Least Privilege**, ensuring the agent cannot view or mutate data beyond its immediate scope.


```
                  [Customer Query] 
                         │
                         ▼
                   [LLM Planner] 
                         │
                         ▼
              [Zod Schema Validation]
                         │
                  (Is Mutation?)
                   /          \
                 YES           NO
                 /              \
                ▼                ▼
       [proposeAction()]   [safeReadTools]
                │                │
                ▼                ▼
     Writes 'proposed' state   Direct SQL View

```

### How Tools Are Exposed
Tools are configured using structured JSON declarations backed by strict validation schemas. 
- Input arguments are validated at the runtime perimeter before hitting the database.
- Database access goes through a repository abstraction layer — the agent cannot construct or execute raw SQL strings.

---

## Failure Handling & Guardrails

The architecture handles common agent failure modes and malicious prompts through database constraints and logic gates:

### 1. Hallucinated Order IDs
When the agent invokes a tool with a hallucinated identifier, the repository layer returns a structured `null` or a clear error string (`Target order was not found`). This prevents the loop from guessing random keys and forces it to request clarification from the customer.

### 2. Refund Value Constraints (Over-Refund Protection)
If a customer demands a refund larger than the order value, the system intercepts the mistake at two distinct points:
- **Phase 1 (Agent Evaluation):** The agent calculates available limits via the database values.
- **Phase 2 (Atomic Execution check):** When the human clicks "Authorize Action", the NestJS controller queries the current order state, recalculates the maximum allowed threshold, and throws a `BadRequestException('Guardrail Exception: This calculation breaks order limits.')` if the limits are breached. This protects against cases where multiple partial refunds are processed simultaneously.

### 3. Cross-Tenant Isolation (Someone Else's Order)
Every data look-up combines the `order_number` with the authenticated customer identifier. If a user attempts to pass an order number belonging to another account, the query returns an empty dataset, preventing cross-tenant information leaks.

### 4. Concurrency Collisions & Optimistic Locking
To prevent race conditions (such as clicking approve twice rapidly, or two supervisors evaluating the same item simultaneously), the `orders` table implements a `version: INT` column. 

When an action is applied, the SQL execution enforces a strict match:
```typescript
.eq('id', order.id)
.eq('version', order.version)

```

If another resource changed the order state in the fraction of a second between data retrieval and execution, the version token check fails, rolling back the operation safely and throwing a `Concurrency Collision` error.

---

## Build vs Buy (Production Perspective)

| System Component | What Was Built (This Project) | Production Architecture (At Scale) |
| --- | --- | --- |
| **Agent Framework** | Custom sequential tool loop | **LangGraph / Temporal.io:** Essential for stateful, long-running agent workflows with built-in checkpointing. |
| **Queue Management** | HTTP Controller state-polling | **BullMQ + Redis:** To handle distributed retries, rate-limiting, and background job processing. |
| **Observability** | Console tracing & UI logs | **LangSmith + OpenTelemetry:** For deep LLM token tracing, latency metrics, and prompt cost debugging. |
| **Database Architecture** | Supabase Client Singleton | **PostgreSQL Connection Pooler (PgBouncer):** To handle high-concurrency connections safely under sudden peak traffic. |

---

## Significant Design Decisions

### 1. State-Based Token Boundaries vs Prompt Boundaries

* **Alternative Considered:** Giving the agent direct access to update order rows, relying on system prompts to dictate bounds (e.g., *"Do not refund more than $50 without escalation"*).
* **Why Rejected:** Prompts are susceptible to jailbreaking and unexpected model variations. Code enforcement provides a 100% reliable safety guarantee.

### 2. Relational Target Linkage (`target_id`) for Audit Timelines

* **Alternative Considered:** Linking audit logs directly to the specific `agent_action_id`.
* **Why Rejected:** A single support case might have multiple proposed or rejected actions over its lifetime. By linking audit logs directly to the underlying `support_request_id` (`target_id`), the frontend can fetch and render a unified timeline of everything that happened to that customer request, even across multiple triage cycles.


