import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState, useEffect, useId } from "react";
import { Lock, Sparkles, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  customerSchema,
  CHECKOUT_URL,
  PRICE_CENTS,
  formatPrice,
  maskCpf,
  maskPhone,
  maskCep,
  BRAZILIAN_STATES,
  type Customer,
} from "@/lib/checkout";
import { createCheckoutOrder } from "@/lib/checkout.functions";

export const Route = createFileRoute("/checkout")({
  head: () => ({
    meta: [
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1, viewport-fit=cover, maximum-scale=5",
      },
      { title: "Checkout Seguro — Pura Cozinha" },
      {
        name: "description",
        content: "Finalize seu pedido com segurança, frete grátis e desconto no Pix.",
      },
    ],
  }),
  component: CheckoutPage,
});

function OrderSummary({ isMobile = false }: { isMobile?: boolean }) {
  const [isOpen, setIsOpen] = useState(!isMobile);

  return (
    <div
      className={`rounded-xl sm:rounded-2xl border border-[#323b42] bg-[#12171b] p-4 sm:p-6 ${isMobile ? "block lg:hidden" : "hidden lg:block"}`}
    >
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between text-[#edf3e8]"
      >
        <span className="font-bold text-lg">Resumo do Pedido</span>
        {isMobile &&
          (isOpen ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />)}
      </button>

      {(isOpen || !isMobile) && (
        <div className="mt-4 space-y-3 text-sm text-[#edf3e8]">
          <div className="flex justify-between">
            <span className="text-[#9aa3ad]">Jogo de Panelas 10 Peças</span>
            <span>{formatPrice(PRICE_CENTS)}</span>
          </div>
          <div className="flex justify-between font-bold text-[#bce19c]">
            <span>Total</span>
            <span>{formatPrice(PRICE_CENTS)}</span>
          </div>
        </div>
      )}
    </div>
  );
}

export default function CheckoutPage() {
  const [step, setStep] = useState<1 | 2 | 3>(1);

  const [formData, setFormData] = useState<Partial<Customer>>(() => {
    try {
      const saved = localStorage.getItem("checkout_form_data");
      return saved
        ? JSON.parse(saved)
        : {
            name: "",
            email: "",
            cpf: "",
            phone: "",
            cep: "",
            street: "",
            number: "",
            complement: "",
            neighborhood: "",
            city: "",
            state: undefined,
            consent: true,
          };
    } catch {
      return {
        name: "",
        email: "",
        cpf: "",
        phone: "",
        cep: "",
        street: "",
        number: "",
        complement: "",
        neighborhood: "",
        city: "",
        state: undefined,
        consent: true,
      };
    }
  });

  useEffect(() => {
    localStorage.setItem("checkout_form_data", JSON.stringify(formData));
  }, [formData]);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [cepLoading, setCepLoading] = useState(false);
  const [cepMessage, setCepMessage] = useState("");

  async function handleCepChange(value: string) {
    const masked = maskCep(value);
    setFormData((prev) => ({ ...prev, cep: masked }));
    const raw = masked.replace(/\D/g, "");

    if (raw.length === 8) {
      setCepLoading(true);
      setCepMessage("");
      try {
        const response = await fetch(`https://viacep.com.br/ws/${raw}/json/`);
        const data = await response.json();
        if (data.erro) {
          setCepMessage("CEP não encontrado.");
        } else {
          setFormData((prev) => ({
            ...prev,
            street: data.logradouro || prev.street || "",
            neighborhood: data.bairro || prev.neighborhood || "",
            city: data.localidade || prev.city || "",
            state: BRAZILIAN_STATES.includes(data.uf as (typeof BRAZILIAN_STATES)[number])
              ? (data.uf as (typeof BRAZILIAN_STATES)[number])
              : prev.state,
          }));
          setCepMessage("Endereço preenchido!");
        }
      } catch {
        setCepMessage("Erro ao consultar CEP.");
      } finally {
        setCepLoading(false);
      }
    }
  }

  function handleStep1Submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const result = customerSchema.safeParse(formData);
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.issues.forEach((i) => (fieldErrors[String(i.path[0])] = i.message));
      setErrors(fieldErrors);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    setErrors({});
    setStep(2);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <div className="checkout-theme min-h-screen w-full antialiased">
      <div className="border-b border-[#323b42] bg-[#112607] px-3 py-1.5 text-center text-xs text-[#bce19c]">
        <div className="mx-auto flex max-w-5xl items-center justify-center gap-1.5 font-medium leading-tight">
          <Sparkles className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">Oferta Ativada: 10% OFF no Pix + Frete Grátis</span>
        </div>
      </div>

      <header className="sticky top-0 z-40 border-b border-[#323b42] bg-[#060709]/95 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-3">
          <Link
            to="/"
            className="flex items-center gap-1 text-lg font-bold tracking-tight text-[#edf3e8]"
          >
            <span>Pura</span>
            <span className="text-[#bce19c]">Cozinha</span>
          </Link>
          <div className="flex items-center gap-2 text-xs text-[#9aa3ad]">
            <span className="flex items-center gap-1.5 rounded-full border border-[#323b42] bg-[#12171b] px-2.5 py-1 text-xs font-medium text-[#edf3e8]">
              <Lock className="h-3 w-3 text-[#bce19c]" /> Checkout Seguro
            </span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-3 py-4 sm:py-8">
        <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
          {/* Mobile Order Summary - visible only on mobile */}
          <OrderSummary isMobile={true} />

          <div className="min-w-0">
            {step === 1 && (
              <div className="rounded-xl border border-[#323b42] bg-[#12171b] p-4 sm:p-6">
                <h1 className="text-xl font-bold text-[#edf3e8] mb-6">Dados de Entrega</h1>
                <form onSubmit={handleStep1Submit} className="space-y-4" noValidate>
                  <div>
                    <input
                      className="checkout-field"
                      placeholder="Nome completo"
                      value={formData.name || ""}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    />
                    {errors.name && <p className="text-xs text-red-400 mt-1">{errors.name}</p>}
                  </div>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <input
                        className="checkout-field"
                        placeholder="E-mail"
                        value={formData.email || ""}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      />
                      {errors.email && <p className="text-xs text-red-400 mt-1">{errors.email}</p>}
                    </div>
                    <div>
                      <input
                        className="checkout-field"
                        placeholder="CPF"
                        value={formData.cpf || ""}
                        onChange={(e) => setFormData({ ...formData, cpf: maskCpf(e.target.value) })}
                      />
                      {errors.cpf && <p className="text-xs text-red-400 mt-1">{errors.cpf}</p>}
                    </div>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <input
                        className="checkout-field"
                        placeholder="Telefone com DDD"
                        value={formData.phone || ""}
                        onChange={(e) =>
                          setFormData({ ...formData, phone: maskPhone(e.target.value) })
                        }
                      />
                      {errors.phone && <p className="text-xs text-red-400 mt-1">{errors.phone}</p>}
                    </div>
                    <div>
                      <input
                        className="checkout-field"
                        placeholder="CEP (ex: 01001-000)"
                        value={formData.cep || ""}
                        onChange={(e) => handleCepChange(e.target.value)}
                      />
                      {errors.cep && <p className="text-xs text-red-400 mt-1">{errors.cep}</p>}
                      {cepLoading && <p className="text-xs text-[#bce19c] mt-1">Buscando CEP...</p>}
                      {cepMessage && <p className="text-xs text-[#bce19c] mt-1">{cepMessage}</p>}
                    </div>
                  </div>
                  <div className="grid sm:grid-cols-[1fr_120px] gap-4">
                    <div>
                      <input
                        className="checkout-field"
                        placeholder="Rua / Avenida"
                        value={formData.street || ""}
                        onChange={(e) => setFormData({ ...formData, street: e.target.value })}
                      />
                      {errors.street && (
                        <p className="text-xs text-red-400 mt-1">{errors.street}</p>
                      )}
                    </div>
                    <div>
                      <input
                        className="checkout-field"
                        placeholder="Número"
                        value={formData.number || ""}
                        onChange={(e) => setFormData({ ...formData, number: e.target.value })}
                      />
                      {errors.number && (
                        <p className="text-xs text-red-400 mt-1">{errors.number}</p>
                      )}
                    </div>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <input
                        className="checkout-field"
                        placeholder="Bairro"
                        value={formData.neighborhood || ""}
                        onChange={(e) => setFormData({ ...formData, neighborhood: e.target.value })}
                      />
                      {errors.neighborhood && (
                        <p className="text-xs text-red-400 mt-1">{errors.neighborhood}</p>
                      )}
                    </div>
                    <div>
                      <input
                        className="checkout-field"
                        placeholder="Complemento (opcional)"
                        value={formData.complement || ""}
                        onChange={(e) => setFormData({ ...formData, complement: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="grid sm:grid-cols-[1fr_120px] gap-4">
                    <div>
                      <input
                        className="checkout-field"
                        placeholder="Cidade"
                        value={formData.city || ""}
                        onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                      />
                      {errors.city && <p className="text-xs text-red-400 mt-1">{errors.city}</p>}
                    </div>
                    <div>
                      <select
                        className="checkout-field text-sm"
                        value={formData.state || ""}
                        onChange={(e) =>
                          setFormData({ ...formData, state: e.target.value as Customer["state"] })
                        }
                      >
                        <option value="">UF</option>
                        {BRAZILIAN_STATES.map((st) => (
                          <option key={st} value={st}>
                            {st}
                          </option>
                        ))}
                      </select>
                      {errors.state && <p className="text-xs text-red-400 mt-1">{errors.state}</p>}
                    </div>
                  </div>
                  <Button className="w-full h-12 bg-[#bce19c] text-[#112607] font-bold mt-4">
                    Continuar
                  </Button>
                </form>
              </div>
            )}
            {step === 2 && (
              <div className="rounded-xl border border-[#323b42] bg-[#12171b] p-4 sm:p-6">
                <h1 className="text-xl font-bold text-[#edf3e8] mb-6">Revisão do Pedido</h1>
                <div className="text-[#edf3e8] space-y-2 mb-6">
                  <p>
                    <strong>Nome:</strong> {formData.name}
                  </p>
                  <p>
                    <strong>E-mail:</strong> {formData.email}
                  </p>
                  <p>
                    <strong>Entrega:</strong> {formData.street}, {formData.number} - {formData.city}
                    /{formData.state}
                  </p>
                </div>
                <Button
                  onClick={() => setStep(3)}
                  className="w-full h-12 bg-[#bce19c] text-[#112607] font-bold"
                >
                  Confirmar e Ir para Pagamento
                </Button>
              </div>
            )}
            {step === 3 && (
              <div className="rounded-xl border border-[#323b42] bg-[#12171b] p-4 sm:p-6 text-center text-[#edf3e8]">
                <h1 className="text-xl font-bold mb-4">Pagamento Pix</h1>
                <p className="mb-6">Use o botão abaixo para finalizar o pagamento na Deflow.</p>
                <a href={CHECKOUT_URL} target="_blank" rel="noopener noreferrer">
                  <Button className="w-full h-12 bg-[#bce19c] text-[#112607] font-bold">
                    Abrir Pagamento Pix na Deflow
                  </Button>
                </a>
              </div>
            )}
          </div>

          {/* Desktop Order Summary */}
          <OrderSummary isMobile={false} />
        </div>
      </main>
    </div>
  );
}
