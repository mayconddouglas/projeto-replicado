ALTER TABLE public.checkout_orders ADD COLUMN request_hash text;
CREATE INDEX checkout_orders_request_created_idx ON public.checkout_orders(request_hash, created_at);