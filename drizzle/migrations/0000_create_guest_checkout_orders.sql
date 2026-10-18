CREATE TABLE public.checkout_orders (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 access_token_hash text NOT NULL UNIQUE,
 customer jsonb NOT NULL,
 amount_cents integer NOT NULL DEFAULT 35991 CHECK (amount_cents = 35991),
 currency text NOT NULL DEFAULT 'BRL',
 status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','confirmed')),
 created_at timestamptz NOT NULL DEFAULT now(),
 confirmed_at timestamptz
);
GRANT ALL ON public.checkout_orders TO service_role;
ALTER TABLE public.checkout_orders ENABLE ROW LEVEL SECURITY;
COMMENT ON TABLE public.checkout_orders IS 'Guest checkout orders. No browser Data API access; server actions require an unguessable order capability. Payment status may only be changed by verified provider integration.';