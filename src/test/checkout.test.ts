import { describe, expect, it } from "vitest";
import { canConfirmOrder, customerSchema, validCpf } from "@/lib/checkout";

describe("Checkout rules", () => {
  it("requires customer and delivery data before payment", () => {
    expect(
      customerSchema.safeParse({ name: "Cliente Teste", email: "cliente@example.com" }).success,
    ).toBe(false);
  });
  it("rejects invalid CPF", () => {
    expect(validCpf("111.111.111-11")).toBe(false);
    expect(validCpf("529.982.247-25")).toBe(true);
  });
  it("does not confirm details before payment approval", () => {
    expect(canConfirmOrder("pending")).toBe(false);
    expect(canConfirmOrder("paid")).toBe(true);
  });
});
