import { z } from "zod";

export const CHECKOUT_URL = "https://deflow.exchange/qr/pura-cozinha";
export const PRICE_CENTS = 35991;
export const formatPrice = (cents: number) => (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const digits = (value: string) => value.replace(/\D/g, "");
export function validCpf(value: string) {
  const cpf = digits(value);
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;
  for (let size = 9; size <= 10; size++) {
    const sum = cpf.slice(0, size).split("").reduce((total, digit, i) => total + Number(digit) * (size + 1 - i), 0);
    const check = ((sum * 10) % 11) % 10;
    if (check !== Number(cpf[size])) return false;
  }
  return true;
}
const text = (label: string, min = 2) => z.string().trim().min(min, `${label} obrigatório`).max(120, "Máximo de 120 caracteres");
export const customerSchema = z.object({
  name: text("Nome completo", 5).refine(value => value.split(/\s+/).length >= 2, "Informe nome e sobrenome"),
  email: z.string().trim().email("Informe um e-mail válido").max(254),
  cpf: z.string().max(18).refine(validCpf, "Informe um CPF válido").transform(digits),
  phone: z.string().max(25).transform(digits).refine(value => /^\d{10,11}$/.test(value), "Informe o telefone com DDD"),
  cep: z.string().max(10).transform(digits).refine(value => /^\d{8}$/.test(value), "Informe um CEP válido"),
  street: text("Rua"),
  number: text("Número", 1),
  complement: z.string().trim().max(120),
  neighborhood: text("Bairro"),
  city: text("Cidade"),
  state: z.enum(["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"], { errorMap: () => ({ message: "Selecione o estado" }) }),
  consent: z.literal(true, { errorMap: () => ({ message: "Autorize o uso dos dados para o pedido" }) }),
});
export type Customer = z.infer<typeof customerSchema>;
export const capabilitySchema = z.object({ id: z.string().uuid(), token: z.string().regex(/^[a-f0-9]{64}$/) });
export const canConfirmOrder = (status: string) => status === "paid" || status === "confirmed";