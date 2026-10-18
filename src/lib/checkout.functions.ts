import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader, setResponseHeader } from "@tanstack/react-start/server";
import { capabilitySchema, customerSchema, PRICE_CENTS, canConfirmOrder } from "./checkout";

async function hash(value: string) {
  const buffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(buffer), byte => byte.toString(16).padStart(2, "0")).join("");
}

export const createCheckoutOrder = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => customerSchema.parse(input))
  .handler(async ({ data }) => {
    setResponseHeader("Cache-Control", "no-store");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Public guest intake is intentional; only validated customer fields can be written.
    // No guest operation accepts a payment status or caller-selected price.
    const ip = getRequestHeader("cf-connecting-ip") ?? getRequestHeader("x-forwarded-for")?.split(",")[0] ?? "unknown";
    const requestHash = await hash(ip);
    const { count, error: countError } = await supabaseAdmin.from("checkout_orders").select("id", { count: "exact", head: true }).eq("request_hash", requestHash).gte("created_at", new Date(Date.now() - 3600000).toISOString());
    if (countError) throw new Error("Não foi possível salvar o pedido. Tente novamente.");
    if ((count ?? 0) >= 15) throw new Error("Muitas tentativas. Aguarde antes de tentar novamente.");
    const token = Array.from(crypto.getRandomValues(new Uint8Array(32)), byte => byte.toString(16).padStart(2, "0")).join("");
    const { data: order, error } = await supabaseAdmin.from("checkout_orders").insert({ customer: data, access_token_hash: await hash(token), request_hash: requestHash, amount_cents: PRICE_CENTS }).select("id").single();
    if (error || !order) throw new Error("Não foi possível salvar o pedido. Tente novamente.");
    return { id: order.id, token };
  });

export const readCheckoutOrder = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => capabilitySchema.parse(input))
  .handler(async ({ data }) => {
    setResponseHeader("Cache-Control", "no-store");
    const tokenHash = await hash(data.token);
    // The unguessable capability authorizes access to this one guest order, never a list.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: order, error } = await supabaseAdmin.from("checkout_orders").select("id, customer, status, amount_cents").eq("id", data.id).eq("access_token_hash", tokenHash).single();
    if (error || !order) throw new Error("Pedido não encontrado nesta sessão.");
    return { id: order.id, customer: customerSchema.parse(order.customer), status: order.status, amountCents: order.amount_cents };
  });

export const confirmCheckoutOrder = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => capabilitySchema.parse(input))
  .handler(async ({ data }) => {
    setResponseHeader("Cache-Control", "no-store");
    const tokenHash = await hash(data.token);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: order, error } = await supabaseAdmin.from("checkout_orders").select("status").eq("id", data.id).eq("access_token_hash", tokenHash).single();
    if (error || !order || !canConfirmOrder(order.status)) throw new Error("O pagamento ainda não foi aprovado.");
    const { error: updateError } = await supabaseAdmin.from("checkout_orders").update({ status: "confirmed", confirmed_at: new Date().toISOString() }).eq("id", data.id).eq("access_token_hash", tokenHash).eq("status", "paid");
    if (updateError) throw new Error("Não foi possível confirmar os dados. Tente novamente.");
    return { status: "confirmed" };
  });