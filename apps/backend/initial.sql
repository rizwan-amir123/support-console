-- ========================================================
-- 1. DROP EXISTING TABLES & TRIGGERS (Fresh Slate)
-- ========================================================
DROP TRIGGER IF EXISTS trigger_prevent_duplicate_refund ON agent_actions;
DROP TRIGGER IF EXISTS trg_verify_order_refund_limits ON orders;
DROP FUNCTION IF EXISTS prevent_duplicate_refund();
DROP FUNCTION IF EXISTS verify_order_refund_limits();

DROP TABLE IF EXISTS audit_logs CASCADE;
DROP TABLE IF EXISTS agent_actions CASCADE;
DROP TABLE IF EXISTS support_requests CASCADE;
DROP TABLE IF EXISTS orders CASCADE;

-- ========================================================
-- 2. CREATE BASE RECOGNITION SCHEMAS
-- ========================================================

-- Table 1: Orders (e-commerce data)
CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number TEXT UNIQUE NOT NULL,
  customer_id UUID NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'processing', 'shipped', 'delivered', 'cancelled')),
  total_amount DECIMAL(10,2) NOT NULL,
  currency TEXT DEFAULT 'USD',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  version INT DEFAULT 1,                     -- For human optimistic locking
  refunded_amount DECIMAL(10,2) DEFAULT 0,
  is_fully_refunded BOOLEAN DEFAULT false,
  
  -- Guardrail: Financial balance check constraint
  CONSTRAINT check_refund_amount CHECK (refunded_amount <= total_amount)
);

-- Table 2: Support Tickets / Requests
CREATE TABLE support_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  customer_message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'escalated', 'resolved')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table 3: Agent Actions (Traceability + Escalation)
CREATE TABLE agent_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  support_request_id UUID REFERENCES support_requests(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL,                    -- 'refund', 'cancel', etc.
  proposed_data JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'proposed' CHECK (status IN ('proposed', 'approved', 'rejected', 'executed', 'failed')),
  agent_reasoning TEXT,
  tool_calls JSONB[],                           -- Full history of tool calls
  confidence_score INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  reviewed_by UUID,                             -- Human reviewer
  reviewed_at TIMESTAMPTZ,

  -- Guardrail: Valid status sequence validation
  CONSTRAINT check_valid_approval_transition CHECK (
    (status = 'proposed') OR 
    (status IN ('approved', 'rejected') AND reviewed_at IS NOT NULL) OR
    (status IN ('executed', 'failed'))
  )
);

-- Table 4: Audit Log (Immutable)
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_type TEXT NOT NULL CHECK (actor_type IN ('agent', 'human', 'system')),
  actor_id UUID,
  action TEXT NOT NULL,
  target_type TEXT,                             -- 'order', 'support_request'
  target_id UUID,
  before_state JSONB,
  after_state JSONB,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ========================================================
-- 3. AUTOMATED BUSINESS GUARDRAIL TRIGGERS
-- ========================================================

-- Trigger A: Double-Refund Safeguard (Navigates relational layout securely)
CREATE OR REPLACE FUNCTION prevent_duplicate_refund()
RETURNS TRIGGER AS $$
DECLARE
  v_order_id UUID;
  v_is_fully_refunded BOOLEAN;
BEGIN
  SELECT order_id INTO v_order_id 
  FROM support_requests 
  WHERE id = NEW.support_request_id;

  IF v_order_id IS NOT NULL THEN
    SELECT is_fully_refunded INTO v_is_fully_refunded 
    FROM orders 
    WHERE id = v_order_id;
    
    IF v_is_fully_refunded = TRUE THEN
      RAISE EXCEPTION 'Guardrail Block: Target order is already fully refunded.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_prevent_duplicate_refund
BEFORE INSERT OR UPDATE ON agent_actions
FOR EACH ROW EXECUTE FUNCTION prevent_duplicate_refund();


-- Trigger B: Order Processing Limit Enforcement + Automation Flag Toggle
CREATE OR REPLACE FUNCTION verify_order_refund_limits()
RETURNS TRIGGER AS $$
BEGIN
  -- Row-level locking to prevent race conditions during concurrent updates
  PERFORM * FROM orders WHERE id = NEW.id FOR UPDATE;
  
  IF NEW.refunded_amount > NEW.total_amount THEN
    RAISE EXCEPTION 'Guardrail Violation: Total refunds (%) cannot exceed order total (%)', NEW.refunded_amount, NEW.total_amount;
  END IF;

  IF NEW.refunded_amount = NEW.total_amount THEN
    NEW.is_fully_refunded := true;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_verify_order_refund_limits
BEFORE UPDATE ON orders
FOR EACH ROW EXECUTE FUNCTION verify_order_refund_limits();
