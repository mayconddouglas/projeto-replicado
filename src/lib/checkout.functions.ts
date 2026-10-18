import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader, setResponseHeader } from "@tanstack/react-start/server";
import { capabilitySchema, customerSchema, PRICE_CENTS, canConfirmOrder } from "./checkout";

async function hash(value: string) {
  const buffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(buffer), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

interface FallbackOrder {
  id: string;
  customer: unknown;
  tokenHash: string;
  requestHash: string;
  amountCents: number;
  status: "pending" | "paid" | "confirmed";
  createdAt: number;
  confirmedAt?: string;
}

// Fallback in-memory store for guest orders if Supabase is not yet provisioned
const fallbackOrders = new Map<string, FallbackOrder>();
const fallbackRateLimits = new Map<string, number[]>();

function checkRateLimit(requestHash: string): boolean {
  const now = Date.now();
  const windowMs = 3600000; // 1 hour
  const timestamps = (fallbackRateLimits.get(requestHash) ?? []).filter((t) => now - t < windowMs);
  if (timestamps.length >= 15) return false;
  timestamps.push(now);
  fallbackRateLimits.set(requestHash, timestamps);
  return true;
}

function hasSupabaseEnv(): boolean {
  return Boolean(process.env["SUPABASE_URL"] && process.env["SUPABASE_SERVICE_ROLE_KEY"]);
}

export const createCheckoutOrder = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => customerSchema.parse(input))
  .handler(async ({ data }) => {
    setResponseHeader("Cache-Control", "no-store");
    const ip =
      getRequestHeader("cf-connecting-ip") ??
      getRequestHeader("x-forwarded-for")?.split(",")[0] ??
      "unknown";
    const requestHash = await hash(ip);
    const token = Array.from(crypto.getRandomValues(new Uint8Array(32)), (byte) =>
      byte.toString(16).padStart(2, "0"),
    ).join("");
    const tokenHash = await hash(token);

    if (hasSupabaseEnv()) {
      try {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { count, error: countError } = await supabaseAdmin
          .from("checkout_orders")
          .select("id", { count: "exact", head: true })
          .eq("request_hash", requestHash)
          .gte("created_at", new Date(Date.now() - 3600000).toISOString());
        if (!countError && (count ?? 0) >= 15) {
          throw new Error("Muitas tentativas. Aguarde alguns minutos antes de tentar novamente.");
        }
        const { data: order, error } = await supabaseAdmin
          .from("checkout_orders")
          .insert({
            customer: data,
            access_token_hash: tokenHash,
            request_hash: requestHash,
            amount_cents: PRICE_CENTS,
          })
          .select("id")
          .single();
        if (order && !error) {
          return { id: order.id, token };
        }
      } catch (err) {
        if (err instanceof Error && err.message.includes("Muitas tentativas")) throw err;
        console.warn(
          "[checkout] Supabase storage unavailable, falling back to secure session storage:",
          err,
        );
      }
    }

    // In-memory fallback
    if (!checkRateLimit(requestHash)) {
      throw new Error("Muitas tentativas. Aguarde alguns minutos antes de tentar novamente.");
    }
    const id = crypto.randomUUID();
    fallbackOrders.set(id, {
      id,
      customer: data,
      tokenHash,
      requestHash,
      amountCents: PRICE_CENTS,
      status: "pending",
      createdAt: Date.now(),
    });

    return { id, token };
  });

export const readCheckoutOrder = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => capabilitySchema.parse(input))
  .handler(async ({ data }) => {
    setResponseHeader("Cache-Control", "no-store");
    const tokenHash = await hash(data.token);

    if (hasSupabaseEnv()) {
      try {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: order, error } = await supabaseAdmin
          .from("checkout_orders")
          .select("id, customer, status, amount_cents")
          .eq("id", data.id)
          .eq("access_token_hash", tokenHash)
          .single();
        if (order && !error) {
          return {
            id: order.id,
            customer: customerSchema.parse(order.customer),
            status: order.status,
            amountCents: order.amount_cents,
          };
        }
      } catch {
        // Fall back to memory map
      }
    }

    const order = fallbackOrders.get(data.id);
    if (!order || order.tokenHash !== tokenHash) {
      throw new Error("Pedido não encontrado nesta sessão.");
    }

    return {
      id: order.id,
      customer: customerSchema.parse(order.customer),
      status: order.status,
      amountCents: order.amountCents,
    };
  });

export const confirmCheckoutOrder = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => capabilitySchema.parse(input))
  .handler(async ({ data }) => {
    setResponseHeader("Cache-Control", "no-store");
    const tokenHash = await hash(data.token);

    if (hasSupabaseEnv()) {
      try {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: order, error } = await supabaseAdmin
          .from("checkout_orders")
          .select("status")
          .eq("id", data.id)
          .eq("access_token_hash", tokenHash)
          .single();
        if (order && !error) {
          if (!canConfirmOrder(order.status))
            throw new Error("O pagamento ainda não foi aprovado.");
          await supabaseAdmin
            .from("checkout_orders")
            .update({ status: "confirmed", confirmed_at: new Date().toISOString() })
            .eq("id", data.id)
            .eq("access_token_hash", tokenHash)
            .eq("status", "paid");
          return { status: "confirmed" };
        }
      } catch (err) {
        if (err instanceof Error && err.message.includes("não foi aprovado")) throw err;
      }
    }

    const order = fallbackOrders.get(data.id);
    if (!order || order.tokenHash !== tokenHash) {
      throw new Error("Pedido não encontrado.");
    }
    if (!canConfirmOrder(order.status)) {
      throw new Error("O pagamento ainda não foi aprovado.");
    }
    order.status = "confirmed";
    order.confirmedAt = new Date().toISOString();
    return { status: "confirmed" };
  });
