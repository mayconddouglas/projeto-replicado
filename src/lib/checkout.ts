import { z } from "zod";

export const CHECKOUT_URL = "https://deflow.exchange/qr/pura-cozinha";
export const PRICE_CENTS = 35991;
export const ORIGINAL_PRICE_CENTS = 39990;
export const DISCOUNT_CENTS = 3999;
export const formatPrice = (cents: number) =>
  (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export const digits = (value: string) => value.replace(/\D/g, "");

export function maskCpf(value: string): string {
  const d = digits(value).slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9, 11)}`;
}

export function maskPhone(value: string): string {
  const d = digits(value).slice(0, 11);
  if (d.length <= 2) return d ? `(${d}` : "";
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7, 11)}`;
}

export function maskCep(value: string): string {
  const d = digits(value).slice(0, 8);
  if (d.length <= 5) return d;
  return `${d.slice(0, 5)}-${d.slice(5, 8)}`;
}

export function validCpf(value: string) {
  const cpf = digits(value);
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;
  for (let size = 9; size <= 10; size++) {
    const sum = cpf
      .slice(0, size)
      .split("")
      .reduce((total, digit, i) => total + Number(digit) * (size + 1 - i), 0);
    const check = ((sum * 10) % 11) % 10;
    if (check !== Number(cpf[size])) return false;
  }
  return true;
}

const text = (label: string, min = 2) =>
  z.string().trim().min(min, `${label} obrigatório`).max(120, "Máximo de 120 caracteres");

export const BRAZILIAN_STATES = [
  "AC",
  "AL",
  "AP",
  "AM",
  "BA",
  "CE",
  "DF",
  "ES",
  "GO",
  "MA",
  "MT",
  "MS",
  "MG",
  "PA",
  "PB",
  "PR",
  "PE",
  "PI",
  "RJ",
  "RN",
  "RS",
  "RO",
  "RR",
  "SC",
  "SP",
  "SE",
  "TO",
] as const;

export const customerSchema = z.object({
  name: text("Nome completo", 5).refine(
    (value) => value.trim().split(/\s+/).length >= 2,
    "Informe nome e sobrenome",
  ),
  email: z.string().trim().email("Informe um e-mail válido").max(254),
  cpf: z.string().max(18).refine(validCpf, "Informe um CPF válido"),
  phone: z
    .string()
    .max(25)
    .refine(
      (value) => digits(value).length >= 10 && digits(value).length <= 11,
      "Informe o telefone com DDD (10 ou 11 dígitos)",
    ),
  cep: z
    .string()
    .max(10)
    .refine((value) => digits(value).length === 8, "Informe um CEP válido com 8 dígitos"),
  street: text("Rua / Avenida"),
  number: text("Número", 1),
  complement: z.string().trim().max(120).optional().default(""),
  neighborhood: text("Bairro"),
  city: text("Cidade"),
  state: z.enum(BRAZILIAN_STATES, { errorMap: () => ({ message: "Selecione o estado" }) }),
  consent: z.literal(true, {
    errorMap: () => ({ message: "Autorize o uso dos dados para entrega do pedido" }),
  }),
});

export type Customer = z.infer<typeof customerSchema>;
export const capabilitySchema = z.object({
  id: z.string().uuid(),
  token: z.string().regex(/^[a-f0-9]{64}$/),
});
export const canConfirmOrder = (status: string) => status === "paid" || status === "confirmed";
