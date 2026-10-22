import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState, useEffect, useId } from "react";
import {
  Lock,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Clock,
  ShieldCheck,
  Zap,
  CheckCircle2,
  Package,
  Check,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  customerSchema,
  CHECKOUT_URL,
  PRICE_CENTS,
  ORIGINAL_PRICE_CENTS,
  DISCOUNT_CENTS,
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

function useCheckoutCountdown(initialMinutes = 10) {
  const [secondsLeft, setSecondsLeft] = useState<number>(() => {
    if (typeof window === "undefined") return initialMinutes * 60;
    try {
      const stored = sessionStorage.getItem("checkout_countdown_target");
      if (stored) {
        const target = parseInt(stored, 10);
        const now = Date.now();
        const diff = Math.max(0, Math.floor((target - now) / 1000));
        return diff > 0 ? diff : 0;
      }
      const target = Date.now() + initialMinutes * 60 * 1000;
      sessionStorage.setItem("checkout_countdown_target", target.toString());
      return initialMinutes * 60;
    } catch {
      return initialMinutes * 60;
    }
  });

  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) return 0;
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;
  const formatted = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  const totalSeconds = initialMinutes * 60;
  const progressPercent = Math.max(0, Math.min(100, (secondsLeft / totalSeconds) * 100));

  return { secondsLeft, formatted, progressPercent };
}

function OrderSummary({
  isMobile = false,
  timerFormatted,
}: {
  isMobile?: boolean;
  timerFormatted?: string;
}) {
  const [isOpen, setIsOpen] = useState(!isMobile);

  return (
    <div
      className={`rounded-xl sm:rounded-2xl border border-[#cac4ce] bg-white p-4 sm:p-5 shadow-xs ${
        isMobile ? "block lg:hidden mb-4" : "hidden lg:block sticky top-20 self-start"
      }`}
    >
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between text-[#242038]"
        type="button"
      >
        <div className="flex items-center gap-2">
          <span className="font-bold text-base sm:text-lg">Resumo do Pedido</span>
          <span className="rounded-full bg-[#ede9f6] border border-[#725ac1]/30 px-2 py-0.5 text-[11px] font-semibold text-[#725ac1]">
            60% OFF
          </span>
        </div>
        {isMobile &&
          (isOpen ? (
            <ChevronUp className="h-5 w-5 text-[#6b6582]" />
          ) : (
            <ChevronDown className="h-5 w-5 text-[#6b6582]" />
          ))}
      </button>

      {(isOpen || !isMobile) && (
        <div className="mt-4 space-y-4 text-sm text-[#242038]">
          {/* Product Thumbnail Card */}
          <div className="flex gap-3 items-center rounded-xl bg-[#fbf8f5] border border-[#cac4ce] p-3">
            <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-[#cac4ce] bg-white">
              <img
                src="/assets/aistudio/file_0000000043fc820e90d4bcc5d44f0dec_15c91252.png"
                alt="Jogo de Panelas Neo Ceramic"
                className="h-full w-full object-cover"
              />
              <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-[#725ac1] text-[10px] font-bold text-white">
                1
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <h4 className="font-semibold text-xs sm:text-sm text-[#242038] leading-snug truncate">
                Jogo de Panelas 10 Peças
              </h4>
              <p className="text-[11px] text-[#6b6582] truncate">Neo Ceramic · Antiaderente</p>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="font-bold text-[#725ac1] text-sm">{formatPrice(PRICE_CENTS)}</span>
                <span className="text-[11px] text-[#6b6582] line-through">
                  {formatPrice(ORIGINAL_PRICE_CENTS)}
                </span>
              </div>
            </div>
          </div>

          {/* Pricing breakdown */}
          <div className="space-y-2 border-t border-[#cac4ce] pt-3 text-xs sm:text-sm">
            <div className="flex justify-between text-[#6b6582]">
              <span>Subtotal original</span>
              <span className="line-through">{formatPrice(ORIGINAL_PRICE_CENTS)}</span>
            </div>
            <div className="flex justify-between text-[#725ac1] font-semibold">
              <span>Desconto promocional</span>
              <span>-{formatPrice(DISCOUNT_CENTS)}</span>
            </div>
            <div className="flex justify-between text-[#6b6582]">
              <span>Frete</span>
              <span className="font-semibold text-[#725ac1]">GRÁTIS (Brasil)</span>
            </div>
            <div className="flex justify-between border-t border-[#cac4ce] pt-2 font-bold text-base text-[#242038]">
              <span>Total no Pix</span>
              <span className="text-[#725ac1]">{formatPrice(PRICE_CENTS)}</span>
            </div>
            <p className="text-[11px] text-[#6b6582] text-right">
              ou no cartão em até 12x de R$ 11,65
            </p>
          </div>

          {/* Scarcity mini indicator inside summary - Minimalist */}
          <div className="rounded-lg border border-[#cac4ce] bg-[#fbf8f5] p-2.5 text-xs">
            <div className="flex items-center justify-between text-[11px]">
              <span className="flex items-center gap-1.5 text-[#6b6582]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#725ac1]" />
                Estoque promocional
              </span>
              <span className="font-medium text-[#242038]">4 unidades restantes</span>
            </div>
            {timerFormatted && (
              <div className="mt-1.5 flex items-center justify-between border-t border-[#cac4ce]/70 pt-1.5 text-[11px] text-[#6b6582]">
                <span>Tempo de reserva:</span>
                <span className="font-mono font-medium text-[#725ac1]">{timerFormatted}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function CheckoutPage() {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [direction, setDirection] = useState<"forward" | "backward">("forward");
  const [isSubmittingStep1, setIsSubmittingStep1] = useState(false);
  const [isSubmittingStep2, setIsSubmittingStep2] = useState(false);
  const { formatted, progressPercent } = useCheckoutCountdown(10);

  function changeStep(newStep: 1 | 2 | 3) {
    setDirection(newStep > step ? "forward" : "backward");
    setStep(newStep);
    const target = document.getElementById("checkout-steps-anchor");
    if (target) {
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    } else {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

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
  const [showManualAddress, setShowManualAddress] = useState(false);

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
          setCepMessage("CEP não encontrado. Preencha os campos abaixo.");
          setShowManualAddress(true);
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
          setCepMessage("Endereço localizado com sucesso!");
          setShowManualAddress(false);
        }
      } catch {
        setCepMessage("Erro ao consultar CEP. Digite manualmente.");
        setShowManualAddress(true);
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
      if (fieldErrors.street || fieldErrors.neighborhood || fieldErrors.city || fieldErrors.state) {
        setShowManualAddress(true);
      }
      const target = document.getElementById("checkout-steps-anchor");
      if (target) {
        target.scrollIntoView({ behavior: "smooth", block: "start" });
      } else {
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
      return;
    }
    setErrors({});
    setIsSubmittingStep1(true);
    setTimeout(() => {
      setIsSubmittingStep1(false);
      changeStep(2);
    }, 240);
  }

  function handleStep2Confirm() {
    setIsSubmittingStep2(true);
    setTimeout(() => {
      setIsSubmittingStep2(false);
      changeStep(3);
    }, 240);
  }

  const isAddressResolved = Boolean(
    formData.street &&
    formData.neighborhood &&
    formData.city &&
    formData.state &&
    !showManualAddress &&
    !errors.street &&
    !errors.neighborhood &&
    !errors.city &&
    !errors.state,
  );

  return (
    <div className="checkout-theme min-h-screen w-full antialiased">
      <div className="border-b border-[#cac4ce] bg-[#ede9f6] px-3 py-1.5 text-center text-xs text-[#725ac1]">
        <div className="mx-auto flex max-w-5xl items-center justify-center gap-1.5 font-medium leading-tight">
          <Sparkles className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">
            Oferta Ativada: Jogo Completo 10 Peças por R$ 139,90 + Frete Grátis
          </span>
        </div>
      </div>

      <header className="sticky top-0 z-40 border-b border-[#cac4ce] bg-[#f7ece1]/95 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-3">
          <Link
            to="/"
            className="flex items-center gap-1 text-lg font-bold tracking-tight text-[#242038]"
          >
            <span>Pura</span>
            <span className="text-[#725ac1]">Cozinha</span>
          </Link>
          <div className="flex items-center gap-2 text-xs text-[#6b6582]">
            <span className="flex items-center gap-1.5 rounded-full border border-[#cac4ce] bg-white px-2.5 py-1 text-xs font-medium text-[#242038] shadow-xs">
              <Lock className="h-3 w-3 text-[#725ac1]" /> Checkout 100% Seguro
            </span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-3 py-4 sm:py-8">
        {/* Urgency & Reservation Countdown Banner - Minimalist & Compact */}
        <div className="mb-5 rounded-xl border border-[#cac4ce] bg-white px-3.5 py-2.5 sm:px-4 sm:py-3 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div className="flex items-center gap-2 text-xs sm:text-sm text-[#242038]">
              <Clock className="h-4 w-4 shrink-0 text-[#725ac1]" />
              <span>
                Preço promocional reservado por:{" "}
                <span className="font-mono font-bold text-[#725ac1]">{formatted}</span>
              </span>
            </div>
            <div className="flex items-center gap-2 text-[11px] text-[#6b6582]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#725ac1]" />
              <span>Últimas 4 unidades com frete grátis</span>
            </div>
          </div>
          <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-[#ede9f6]">
            <div
              className="h-full bg-[#725ac1] transition-all duration-1000 ease-linear rounded-full"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* Step Progress Pills with smooth interactive state */}
        <div className="mb-6 grid grid-cols-3 gap-2 text-center text-xs">
          <button
            type="button"
            onClick={() => step > 1 && changeStep(1)}
            disabled={step === 1}
            className={`rounded-lg p-2.5 font-medium border transition-all duration-300 flex items-center justify-center gap-1.5 ${
              step === 1
                ? "bg-[#ede9f6] border-[#725ac1] text-[#725ac1] shadow-xs font-bold"
                : step > 1
                  ? "bg-white border-[#cac4ce] text-[#242038] hover:border-[#725ac1]/60 cursor-pointer shadow-xs"
                  : "bg-white/60 border-[#cac4ce] text-[#6b6582]"
            }`}
          >
            {step > 1 ? (
              <Check className="h-3.5 w-3.5 text-[#725ac1] shrink-0" />
            ) : (
              <span className="hidden sm:inline">1. </span>
            )}
            <span className="truncate">Dados e Entrega</span>
          </button>

          <button
            type="button"
            onClick={() => step > 2 && changeStep(2)}
            disabled={step <= 2}
            className={`rounded-lg p-2.5 font-medium border transition-all duration-300 flex items-center justify-center gap-1.5 ${
              step === 2
                ? "bg-[#ede9f6] border-[#725ac1] text-[#725ac1] shadow-xs font-bold"
                : step > 2
                  ? "bg-white border-[#cac4ce] text-[#242038] hover:border-[#725ac1]/60 cursor-pointer shadow-xs"
                  : "bg-white/60 border-[#cac4ce] text-[#6b6582]"
            }`}
          >
            {step > 2 ? (
              <Check className="h-3.5 w-3.5 text-[#725ac1] shrink-0" />
            ) : (
              <span className="hidden sm:inline">2. </span>
            )}
            <span className="truncate">Revisão</span>
          </button>

          <div
            className={`rounded-lg p-2.5 font-medium border transition-all duration-300 flex items-center justify-center gap-1.5 ${
              step === 3
                ? "bg-[#ede9f6] border-[#725ac1] text-[#725ac1] shadow-xs font-bold"
                : "bg-white/60 border-[#cac4ce] text-[#6b6582]"
            }`}
          >
            <span className="hidden sm:inline">3. </span>
            <span className="truncate">Pagamento Pix</span>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
          {/* Mobile Order Summary - visible only on mobile */}
          <OrderSummary isMobile={true} timerFormatted={formatted} />

          <div className="min-w-0" id="checkout-steps-anchor">
            <div
              key={step}
              className={
                direction === "forward"
                  ? "checkout-step-enter-forward"
                  : "checkout-step-enter-backward"
              }
            >
              {step === 1 && (
                <div className="rounded-xl border border-[#cac4ce] bg-white p-4 sm:p-6 shadow-xs">
                  <div className="flex items-center justify-between border-b border-[#cac4ce] pb-3 mb-4">
                    <div>
                      <h1 className="text-lg sm:text-xl font-bold text-[#242038]">
                        Dados para Entrega
                      </h1>
                      <p className="text-xs text-[#6b6582]">
                        Preenchimento rápido · Menos de 1 minuto
                      </p>
                    </div>
                    <span className="text-xs text-[#725ac1] font-medium flex items-center gap-1 rounded-full border border-[#725ac1]/30 bg-[#ede9f6] px-2.5 py-1">
                      <Package className="h-3.5 w-3.5" /> Frete Grátis
                    </span>
                  </div>

                  <form onSubmit={handleStep1Submit} className="space-y-4" noValidate>
                    {/* Seção 1: Identificação */}
                    <div className="space-y-3">
                      <div className="text-[11px] font-bold uppercase tracking-wider text-[#6b6582]">
                        1. Identificação do Comprador
                      </div>
                      <div>
                        <label className="block text-[11px] font-medium text-[#242038] mb-1">
                          Nome Completo *
                        </label>
                        <input
                          className="checkout-field"
                          placeholder="Nome e sobrenome"
                          value={formData.name || ""}
                          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        />
                        {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name}</p>}
                      </div>

                      <div className="grid sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[11px] font-medium text-[#242038] mb-1">
                            E-mail (confirmação e rastreio) *
                          </label>
                          <input
                            type="email"
                            className="checkout-field"
                            placeholder="seu@email.com"
                            value={formData.email || ""}
                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                          />
                          {errors.email && (
                            <p className="text-xs text-red-500 mt-1">{errors.email}</p>
                          )}
                        </div>

                        <div>
                          <label className="block text-[11px] font-medium text-[#242038] mb-1">
                            WhatsApp (avisos de envio) *
                          </label>
                          <input
                            type="tel"
                            className="checkout-field"
                            placeholder="(00) 00000-0000"
                            value={formData.phone || ""}
                            onChange={(e) =>
                              setFormData({ ...formData, phone: maskPhone(e.target.value) })
                            }
                          />
                          {errors.phone && (
                            <p className="text-xs text-red-500 mt-1">{errors.phone}</p>
                          )}
                        </div>
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="block text-[11px] font-medium text-[#242038]">
                            CPF *
                          </label>
                          <span className="text-[10px] text-[#6b6582]">
                            Para Nota Fiscal e garantia
                          </span>
                        </div>
                        <input
                          className="checkout-field"
                          placeholder="000.000.000-00"
                          value={formData.cpf || ""}
                          onChange={(e) =>
                            setFormData({ ...formData, cpf: maskCpf(e.target.value) })
                          }
                        />
                        {errors.cpf && <p className="text-xs text-red-500 mt-1">{errors.cpf}</p>}
                      </div>
                    </div>

                    {/* Seção 2: Endereço */}
                    <div className="space-y-3 pt-3 border-t border-[#cac4ce]">
                      <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-[#6b6582]">
                        <span>2. Local de Entrega</span>
                        <span className="text-[10px] text-[#725ac1] font-normal normal-case">
                          ⚡ Preenchimento automático por CEP
                        </span>
                      </div>

                      <div>
                        <label className="block text-[11px] font-medium text-[#242038] mb-1">
                          CEP de Entrega *
                        </label>
                        <div className="relative">
                          <input
                            className="checkout-field pr-24"
                            placeholder="00000-000"
                            value={formData.cep || ""}
                            onChange={(e) => handleCepChange(e.target.value)}
                          />
                          {cepLoading && (
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-[#725ac1] font-medium">
                              Buscando...
                            </span>
                          )}
                        </div>
                        {errors.cep && <p className="text-xs text-red-500 mt-1">{errors.cep}</p>}
                        {cepMessage && !errors.cep && (
                          <p className="text-xs text-[#725ac1] font-medium mt-1">{cepMessage}</p>
                        )}
                      </div>

                      {isAddressResolved ? (
                        <div className="space-y-3">
                          <div className="rounded-lg border border-[#cac4ce] bg-[#fbf8f5] p-3">
                            <div className="flex items-start justify-between gap-3">
                              <div className="text-xs">
                                <div className="flex items-center gap-1.5 font-medium text-[#725ac1]">
                                  <CheckCircle2 className="h-3.5 w-3.5" />
                                  <span>Endereço localizado</span>
                                </div>
                                <p className="mt-1 font-semibold text-[#242038]">
                                  {formData.street}, {formData.neighborhood}
                                </p>
                                <p className="text-[11px] text-[#6b6582]">
                                  {formData.city} - {formData.state}
                                </p>
                              </div>
                              <button
                                type="button"
                                onClick={() => setShowManualAddress(true)}
                                className="text-xs text-[#725ac1] font-medium hover:underline shrink-0"
                              >
                                Editar rua
                              </button>
                            </div>
                          </div>

                          <div className="grid grid-cols-[120px_1fr] sm:grid-cols-[140px_1fr] gap-3">
                            <div>
                              <label className="block text-[11px] font-medium text-[#242038] mb-1">
                                Número *
                              </label>
                              <input
                                className="checkout-field"
                                placeholder="Nº"
                                value={formData.number || ""}
                                onChange={(e) =>
                                  setFormData({ ...formData, number: e.target.value })
                                }
                              />
                              {errors.number && (
                                <p className="text-xs text-red-500 mt-1">{errors.number}</p>
                              )}
                            </div>
                            <div>
                              <label className="block text-[11px] font-medium text-[#242038] mb-1">
                                Complemento
                              </label>
                              <input
                                className="checkout-field"
                                placeholder="Apto, bloco (opcional)"
                                value={formData.complement || ""}
                                onChange={(e) =>
                                  setFormData({ ...formData, complement: e.target.value })
                                }
                              />
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <div>
                            <label className="block text-[11px] font-medium text-[#242038] mb-1">
                              Rua / Logradouro *
                            </label>
                            <input
                              className="checkout-field"
                              placeholder="Ex: Rua das Flores"
                              value={formData.street || ""}
                              onChange={(e) => setFormData({ ...formData, street: e.target.value })}
                            />
                            {errors.street && (
                              <p className="text-xs text-red-500 mt-1">{errors.street}</p>
                            )}
                          </div>

                          <div className="grid grid-cols-[120px_1fr] sm:grid-cols-[140px_1fr] gap-3">
                            <div>
                              <label className="block text-[11px] font-medium text-[#242038] mb-1">
                                Número *
                              </label>
                              <input
                                className="checkout-field"
                                placeholder="Nº"
                                value={formData.number || ""}
                                onChange={(e) =>
                                  setFormData({ ...formData, number: e.target.value })
                                }
                              />
                              {errors.number && (
                                <p className="text-xs text-red-500 mt-1">{errors.number}</p>
                              )}
                            </div>
                            <div>
                              <label className="block text-[11px] font-medium text-[#242038] mb-1">
                                Complemento
                              </label>
                              <input
                                className="checkout-field"
                                placeholder="Apto, bloco (opcional)"
                                value={formData.complement || ""}
                                onChange={(e) =>
                                  setFormData({ ...formData, complement: e.target.value })
                                }
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_90px] gap-3">
                            <div>
                              <label className="block text-[11px] font-medium text-[#242038] mb-1">
                                Bairro *
                              </label>
                              <input
                                className="checkout-field"
                                placeholder="Bairro"
                                value={formData.neighborhood || ""}
                                onChange={(e) =>
                                  setFormData({ ...formData, neighborhood: e.target.value })
                                }
                              />
                              {errors.neighborhood && (
                                <p className="text-xs text-red-500 mt-1">{errors.neighborhood}</p>
                              )}
                            </div>
                            <div>
                              <label className="block text-[11px] font-medium text-[#242038] mb-1">
                                Cidade *
                              </label>
                              <input
                                className="checkout-field"
                                placeholder="Cidade"
                                value={formData.city || ""}
                                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                              />
                              {errors.city && (
                                <p className="text-xs text-red-500 mt-1">{errors.city}</p>
                              )}
                            </div>
                            <div>
                              <label className="block text-[11px] font-medium text-[#242038] mb-1">
                                UF *
                              </label>
                              <select
                                className="checkout-field text-sm"
                                value={formData.state || ""}
                                onChange={(e) =>
                                  setFormData({
                                    ...formData,
                                    state: e.target.value as Customer["state"],
                                  })
                                }
                              >
                                <option value="">UF</option>
                                {BRAZILIAN_STATES.map((st) => (
                                  <option key={st} value={st}>
                                    {st}
                                  </option>
                                ))}
                              </select>
                              {errors.state && (
                                <p className="text-xs text-red-500 mt-1">{errors.state}</p>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    <Button
                      type="submit"
                      disabled={isSubmittingStep1}
                      className="w-full h-12 bg-[#725ac1] text-white font-bold mt-4 hover:bg-[#5f47b0] transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm active:scale-[0.99]"
                    >
                      {isSubmittingStep1 ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin text-white" />
                          <span>Validando e avançando...</span>
                        </>
                      ) : (
                        <span>Avançar para Revisão (R$ 139,90) →</span>
                      )}
                    </Button>

                    <div className="mt-5 flex flex-col items-center gap-2.5 text-xs text-[#6b6582]">
                      <div className="flex flex-wrap justify-center gap-4">
                        <span className="flex items-center gap-1.5 text-[#242038]">
                          <Lock className="w-3.5 h-3.5 text-[#725ac1]" /> Compra Segura
                        </span>
                        <span className="flex items-center gap-1.5 text-[#242038]">
                          <Zap className="w-3.5 h-3.5 text-[#725ac1]" /> Envio Rápido
                        </span>
                        <span className="flex items-center gap-1.5 text-[#242038]">
                          <ShieldCheck className="w-3.5 h-3.5 text-[#725ac1]" /> Garantia de 7 Dias
                        </span>
                      </div>
                      <p className="text-center text-[11px] text-[#6b6582]">
                        Garantia incondicional: Se não amar suas panelas, devolvemos 100% do seu
                        dinheiro.
                      </p>
                    </div>
                  </form>
                </div>
              )}
              {step === 2 && (
                <div className="rounded-xl border border-[#cac4ce] bg-white p-4 sm:p-6 shadow-xs">
                  <h1 className="text-xl font-bold text-[#242038] mb-4">Revisão do Pedido</h1>
                  <div className="rounded-xl bg-[#fbf8f5] border border-[#cac4ce] p-4 text-[#242038] space-y-2.5 mb-6 text-sm">
                    <div className="flex justify-between border-b border-[#cac4ce] pb-2">
                      <span className="text-[#6b6582]">Destinatário:</span>
                      <span className="font-semibold">{formData.name}</span>
                    </div>
                    <div className="flex justify-between border-b border-[#cac4ce] pb-2">
                      <span className="text-[#6b6582]">E-mail:</span>
                      <span>{formData.email}</span>
                    </div>
                    <div className="flex justify-between border-b border-[#cac4ce] pb-2">
                      <span className="text-[#6b6582]">Telefone:</span>
                      <span>{formData.phone}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#6b6582]">Endereço:</span>
                      <span className="text-right">
                        {formData.street}, {formData.number}
                        {formData.complement ? ` - ${formData.complement}` : ""}
                        <br />
                        {formData.neighborhood} - {formData.city}/{formData.state}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => changeStep(1)}
                      className="w-1/3 h-12 border-[#cac4ce] text-[#242038] hover:bg-[#ede9f6] cursor-pointer"
                    >
                      ← Voltar
                    </Button>
                    <Button
                      type="button"
                      disabled={isSubmittingStep2}
                      onClick={handleStep2Confirm}
                      className="w-2/3 h-12 bg-[#725ac1] text-white font-bold hover:bg-[#5f47b0] transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm active:scale-[0.99]"
                    >
                      {isSubmittingStep2 ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin text-white" />
                          <span>Gerando Pix Seguro...</span>
                        </>
                      ) : (
                        <span>Confirmar e Ir para Pagamento →</span>
                      )}
                    </Button>
                  </div>
                  <div className="mt-5 flex flex-col items-center gap-2.5 text-xs text-[#6b6582]">
                    <div className="flex flex-wrap justify-center gap-4">
                      <span className="flex items-center gap-1.5 text-[#242038]">
                        <Lock className="w-3.5 h-3.5 text-[#725ac1]" /> Compra Segura
                      </span>
                      <span className="flex items-center gap-1.5 text-[#242038]">
                        <Zap className="w-3.5 h-3.5 text-[#725ac1]" /> Envio Rápido
                      </span>
                      <span className="flex items-center gap-1.5 text-[#242038]">
                        <ShieldCheck className="w-3.5 h-3.5 text-[#725ac1]" /> Garantia de 7 Dias
                      </span>
                    </div>
                    <p className="text-center text-[11px] text-[#6b6582]">
                      Garantia incondicional: Se não amar suas panelas, devolvemos 100% do seu
                      dinheiro.
                    </p>
                  </div>
                </div>
              )}
              {step === 3 && (
                <div className="rounded-xl border border-[#cac4ce] bg-white p-4 sm:p-6 text-center text-[#242038] shadow-xs">
                  <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#ede9f6] border border-[#725ac1]/30 text-[#725ac1]">
                    <CheckCircle2 className="h-7 w-7" />
                  </div>
                  <h1 className="text-xl font-bold mb-2">Quase lá! Finalize no Pix</h1>
                  <p className="text-sm text-[#6b6582] mb-6 max-w-md mx-auto">
                    Sua reserva de <strong className="text-[#725ac1]">R$ 139,90</strong> com frete
                    grátis foi gerada com sucesso. Clique abaixo para abrir a chave Pix no ambiente
                    seguro da Deflow:
                  </p>
                  <a href={CHECKOUT_URL} target="_blank" rel="noopener noreferrer">
                    <Button className="w-full h-12 bg-[#725ac1] text-white font-bold text-base hover:bg-[#5f47b0] transition-all cursor-pointer shadow-sm">
                      Abrir Pagamento Pix na Deflow (R$ 139,90)
                    </Button>
                  </a>
                  <div className="mt-5 flex flex-col items-center gap-2.5 text-xs text-[#6b6582]">
                    <div className="flex flex-wrap justify-center gap-4">
                      <span className="flex items-center gap-1.5 text-[#242038]">
                        <Lock className="w-3.5 h-3.5 text-[#725ac1]" /> Pagamento Instantâneo
                      </span>
                      <span className="flex items-center gap-1.5 text-[#242038]">
                        <Zap className="w-3.5 h-3.5 text-[#725ac1]" /> Aprovação Imediata
                      </span>
                      <span className="flex items-center gap-1.5 text-[#242038]">
                        <ShieldCheck className="w-3.5 h-3.5 text-[#725ac1]" /> Garantia de 7 Dias
                      </span>
                    </div>
                    <p className="text-center text-[11px] text-[#6b6582]">
                      Assim que o Pix for pago, o código de rastreamento é gerado automaticamente.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Desktop Order Summary */}
          <OrderSummary isMobile={false} timerFormatted={formatted} />
        </div>
      </main>
    </div>
  );
}
