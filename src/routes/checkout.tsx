import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState, useEffect, useId } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Lock,
  ShieldCheck,
  Truck,
  CheckCircle2,
  Copy,
  Check,
  ExternalLink,
  Clock,
  Edit2,
  Sparkles,
  QrCode,
  Package,
  AlertCircle,
  PhoneCall,
  Loader2,
  ChevronDown,
  ChevronUp,
  ShoppingBag,
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
import {
  createCheckoutOrder,
  readCheckoutOrder,
  confirmCheckoutOrder,
} from "@/lib/checkout.functions";

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
        content:
          "Finalize seu pedido do Jogo de Panelas 10 Peças com frete grátis e 10% OFF no Pix.",
      },
      { property: "og:title", content: "Checkout Seguro — Pura Cozinha" },
      {
        property: "og:description",
        content: "Finalize seu pedido com segurança, frete grátis e desconto no Pix.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CheckoutPage,
});

export default function CheckoutPage() {
  const formId = useId();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [mobileSummaryOpen, setMobileSummaryOpen] = useState(false);
  const [formData, setFormData] = useState<Partial<Customer>>({
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
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [order, setOrder] = useState<{ id: string; token: string }>();
  const [busy, setBusy] = useState(false);
  const [cepLoading, setCepLoading] = useState(false);
  const [cepMessage, setCepMessage] = useState("");
  const [copied, setCopied] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [timeLeft, setTimeLeft] = useState(15 * 60);

  const createOrder = useServerFn(createCheckoutOrder);
  const checkOrder = useServerFn(readCheckoutOrder);
  const confirmOrder = useServerFn(confirmCheckoutOrder);

  // Temporizador para reserva de estoque no passo 3
  useEffect(() => {
    if (step !== 3) return;
    const timer = setInterval(() => {
      setTimeLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [step]);

  const formatTimer = (sec: number) => {
    const m = Math.floor(sec / 60)
      .toString()
      .padStart(2, "0");
    const s = (sec % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  // Preenchimento de CEP automático via ViaCEP
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
          setCepMessage("CEP não encontrado. Preencha o endereço manualmente.");
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
          setCepMessage("Endereço preenchido com sucesso!");
        }
      } catch {
        setCepMessage("Não foi possível consultar o CEP automaticamente.");
      } finally {
        setCepLoading(false);
      }
    }
  }

  // Validação e avanço do Passo 1 para o Passo 2
  function handleStep1Submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const result = customerSchema.safeParse(formData);
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.issues.forEach((issue) => {
        const key = String(issue.path[0]);
        if (!fieldErrors[key]) fieldErrors[key] = issue.message;
      });
      setErrors(fieldErrors);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    setErrors({});
    setStep(2);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // Geração do pedido e avanço do Passo 2 para o Passo 3
  async function handleStep2Submit() {
    const result = customerSchema.safeParse(formData);
    if (!result.success) {
      setStep(1);
      return;
    }
    setBusy(true);
    setStatusMessage("");
    try {
      const saved = await createOrder({ data: result.data });
      setOrder(saved);
      setStep(3);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      setStatusMessage(
        err instanceof Error ? err.message : "Erro ao gerar o pedido. Tente novamente.",
      );
    } finally {
      setBusy(false);
    }
  }

  // Cópia do link de pagamento Pix
  function handleCopyLink() {
    navigator.clipboard.writeText(CHECKOUT_URL);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  // Verificação de status do pagamento Pix
  async function handleCheckStatus() {
    if (!order) return;
    setBusy(true);
    setStatusMessage("");
    try {
      const current = await checkOrder({ data: order });
      if (current.status === "paid" || current.status === "confirmed") {
        setConfirmed(true);
        setStatusMessage(
          "Pagamento aprovado com sucesso! Seu pedido está sendo preparado para envio imediato.",
        );
      } else {
        setStatusMessage(
          "Pagamento ainda em processamento pela Deflow. Se você acabou de efetuar a transferência Pix, a compensação costuma levar de 1 a 2 minutos. Você também receberá a confirmação por e-mail e WhatsApp!",
        );
      }
    } catch {
      setStatusMessage(
        "Aguardando confirmação bancária da Deflow. Atualize novamente em instantes.",
      );
    } finally {
      setBusy(false);
    }
  }

  const orderNumber = order ? `#PC-${order.id.slice(0, 8).toUpperCase()}` : "#PC-NOVO";

  const stepLabels = {
    1: "Identificação & Entrega",
    2: "Revisão do Pedido",
    3: "Pagamento Pix Seguro",
  };

  return (
    <div className="checkout-theme min-h-screen w-full max-w-full overflow-x-hidden antialiased">
      {/* Top Banner Oferta */}
      <div className="border-b border-[#323b42] bg-[#112607] px-3 py-1.5 text-center text-xs text-[#bce19c]">
        <div className="mx-auto flex max-w-5xl items-center justify-center gap-1.5 font-medium leading-tight">
          <Sparkles className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">Oferta Ativada: 10% OFF no Pix + Frete Grátis Express</span>
        </div>
      </div>

      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-[#323b42] bg-[#060709]/95 backdrop-blur-md">
        <div className="mx-auto flex h-14 sm:h-16 max-w-5xl items-center justify-between px-3 sm:px-6">
          <Link
            to="/"
            className="flex items-center gap-1 text-lg sm:text-xl font-bold tracking-tight text-[#edf3e8]"
          >
            <span>Pura</span>
            <span className="text-[#bce19c]">Cozinha</span>
          </Link>

          <div className="flex items-center gap-2 sm:gap-3 text-xs">
            <span className="hidden items-center gap-1.5 text-[#9aa3ad] sm:inline-flex">
              <ShieldCheck className="h-4 w-4 text-[#bce19c]" />
              Garantia 1 Ano
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[#323b42] bg-[#12171b] px-2.5 py-1 text-[11px] sm:text-xs font-medium text-[#edf3e8]">
              <Lock className="h-3 w-3 text-[#bce19c]" />
              <span>Checkout Seguro</span>
            </span>
          </div>
        </div>
      </header>

      {/* Mobile Collapsible Order Summary Drawer (< lg) */}
      <div className="border-b border-[#323b42] bg-[#12171b] lg:hidden">
        <button
          type="button"
          onClick={() => setMobileSummaryOpen(!mobileSummaryOpen)}
          className="flex w-full items-center justify-between px-4 py-3 text-left transition-colors hover:bg-[#171d22]"
          aria-expanded={mobileSummaryOpen}
        >
          <div className="flex items-center gap-2 min-w-0">
            <ShoppingBag className="h-4 w-4 shrink-0 text-[#bce19c]" />
            <span className="truncate text-xs font-semibold text-[#edf3e8]">
              Resumo do Pedido (10 Peças)
            </span>
            {mobileSummaryOpen ? (
              <ChevronUp className="h-3.5 w-3.5 shrink-0 text-[#9aa3ad]" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5 shrink-0 text-[#9aa3ad]" />
            )}
          </div>
          <div className="shrink-0 text-right">
            <span className="text-xs font-bold text-[#bce19c]">{formatPrice(PRICE_CENTS)}</span>
          </div>
        </button>

        {mobileSummaryOpen && (
          <div className="border-t border-[#323b42] bg-[#060709] px-4 py-4 space-y-3 text-xs animate-in fade-in slide-in-from-top-1">
            <div className="space-y-1.5 text-[#9aa3ad]">
              <div className="flex justify-between">
                <span>Jogo de Panelas 10 Peças Pura Cozinha</span>
                <span className="text-[#edf3e8]">Qtd: 1</span>
              </div>
              <div className="flex justify-between text-[#9aa3ad]">
                <span>5 panelas antiaderentes + 5 tampas de vidro</span>
                <span className="text-[#bce19c]">Kit Completo</span>
              </div>
            </div>

            <div className="border-t border-[#323b42] pt-2 space-y-1.5">
              <div className="flex justify-between text-[#9aa3ad]">
                <span>Preço original</span>
                <span className="line-through">{formatPrice(ORIGINAL_PRICE_CENTS)}</span>
              </div>
              <div className="flex justify-between text-[#bce19c]">
                <span>Desconto no Pix (10% OFF)</span>
                <span>-{formatPrice(DISCOUNT_CENTS)}</span>
              </div>
              <div className="flex justify-between text-[#9aa3ad]">
                <span>Frete Express</span>
                <span className="font-semibold text-[#bce19c]">Grátis</span>
              </div>
              <div className="flex justify-between border-t border-[#323b42] pt-2 text-sm font-bold text-[#edf3e8]">
                <span>Total a pagar</span>
                <span className="text-[#bce19c]">{formatPrice(PRICE_CENTS)}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Main Container */}
      <main className="mx-auto max-w-5xl px-3 sm:px-6 py-4 sm:py-8">
        {/* Navigation back button */}
        <div className="mb-4 sm:mb-6 flex items-center justify-between text-xs sm:text-sm">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-[#9aa3ad] transition-colors hover:text-[#edf3e8]"
          >
            <ArrowLeft className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            <span>Voltar à loja</span>
          </Link>
          <span className="text-xs text-[#9aa3ad]">
            Pedido <span className="font-mono text-[#edf3e8]">{orderNumber}</span>
          </span>
        </div>

        {/* 3-Step Stepper - Fully Responsive */}
        <div className="mb-6 rounded-xl sm:rounded-2xl border border-[#323b42] bg-[#12171b] p-3 sm:p-4">
          {/* Mobile view (< sm): Segmented Bar with Step Title */}
          <div className="sm:hidden space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-[#bce19c]">Passo {step} de 3</span>
              <span className="font-medium text-[#edf3e8]">{stepLabels[step]}</span>
            </div>
            {/* 3 Segment Progress Bar */}
            <div className="grid grid-cols-3 gap-1.5">
              <div
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  step >= 1 ? "bg-[#bce19c]" : "bg-[#323b42]"
                }`}
              />
              <div
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  step >= 2 ? "bg-[#bce19c]" : "bg-[#323b42]"
                }`}
              />
              <div
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  step >= 3 ? "bg-[#bce19c]" : "bg-[#323b42]"
                }`}
              />
            </div>
          </div>

          {/* Desktop/Tablet view (>= sm): Full stepper with icons and subtitles */}
          <ol className="hidden sm:grid grid-cols-3 gap-3">
            {/* Step 1 */}
            <li className="flex items-center gap-2.5">
              <div
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-all ${
                  step > 1
                    ? "bg-[#bce19c] text-[#112607]"
                    : step === 1
                      ? "border-2 border-[#bce19c] bg-[#112607] text-[#bce19c]"
                      : "border border-[#323b42] bg-[#060709] text-[#9aa3ad]"
                }`}
              >
                {step > 1 ? <Check className="h-4 w-4" /> : "1"}
              </div>
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-wider text-[#9aa3ad]">Passo 1</p>
                <p
                  className={`truncate text-xs sm:text-sm font-semibold ${
                    step >= 1 ? "text-[#edf3e8]" : "text-[#9aa3ad]"
                  }`}
                >
                  Identificação & Entrega
                </p>
              </div>
            </li>

            {/* Step 2 */}
            <li className="flex items-center gap-2.5">
              <div
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-all ${
                  step > 2
                    ? "bg-[#bce19c] text-[#112607]"
                    : step === 2
                      ? "border-2 border-[#bce19c] bg-[#112607] text-[#bce19c]"
                      : "border border-[#323b42] bg-[#060709] text-[#9aa3ad]"
                }`}
              >
                {step > 2 ? <Check className="h-4 w-4" /> : "2"}
              </div>
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-wider text-[#9aa3ad]">Passo 2</p>
                <p
                  className={`truncate text-xs sm:text-sm font-semibold ${
                    step >= 2 ? "text-[#edf3e8]" : "text-[#9aa3ad]"
                  }`}
                >
                  Revisão do Pedido
                </p>
              </div>
            </li>

            {/* Step 3 */}
            <li className="flex items-center gap-2.5">
              <div
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-all ${
                  confirmed
                    ? "bg-[#bce19c] text-[#112607]"
                    : step === 3
                      ? "border-2 border-[#bce19c] bg-[#112607] text-[#bce19c]"
                      : "border border-[#323b42] bg-[#060709] text-[#9aa3ad]"
                }`}
              >
                {confirmed ? <Check className="h-4 w-4" /> : "3"}
              </div>
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-wider text-[#9aa3ad]">Passo 3</p>
                <p
                  className={`truncate text-xs sm:text-sm font-semibold ${
                    step === 3 ? "text-[#bce19c]" : "text-[#9aa3ad]"
                  }`}
                >
                  Pagamento Pix
                </p>
              </div>
            </li>
          </ol>
        </div>

        {/* Content Layout Grid */}
        <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
          {/* Main Form/Step Card */}
          <div className="min-w-0">
            {/* STEP 1: Identificação & Entrega */}
            {step === 1 && (
              <div className="rounded-xl sm:rounded-2xl border border-[#323b42] bg-[#12171b] p-4 sm:p-6 md:p-8">
                <div className="mb-5 sm:mb-6">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[#bce19c]">
                    Passo 01 de 03
                  </span>
                  <h1 className="mt-1 text-xl sm:text-2xl md:text-3xl font-bold text-[#edf3e8]">
                    Dados Pessoais e Entrega
                  </h1>
                  <p className="mt-1 text-xs sm:text-sm text-[#9aa3ad]">
                    Preencha os dados abaixo para emissão da nota fiscal e envio gratuito.
                  </p>
                </div>

                <form onSubmit={handleStep1Submit} className="space-y-5 sm:space-y-6" noValidate>
                  {/* Seção 1: Dados Pessoais */}
                  <div>
                    <h2 className="mb-3 text-sm font-semibold text-[#edf3e8]">
                      1. Informações do comprador
                    </h2>
                    <div className="grid gap-3.5 sm:grid-cols-2">
                      {/* Nome Completo */}
                      <div className="sm:col-span-2">
                        <label
                          htmlFor={`${formId}-name`}
                          className="block text-xs font-medium text-[#edf3e8]"
                        >
                          Nome completo <span className="text-[#bce19c]">*</span>
                        </label>
                        <input
                          id={`${formId}-name`}
                          type="text"
                          required
                          placeholder="Ex: Maria Silva Oliveira"
                          className="checkout-field mt-1"
                          value={formData.name || ""}
                          aria-invalid={Boolean(errors.name)}
                          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        />
                        {errors.name && (
                          <p className="mt-1 text-xs text-[#ef4444]">{errors.name}</p>
                        )}
                      </div>

                      {/* E-mail */}
                      <div>
                        <label
                          htmlFor={`${formId}-email`}
                          className="block text-xs font-medium text-[#edf3e8]"
                        >
                          E-mail para nota fiscal <span className="text-[#bce19c]">*</span>
                        </label>
                        <input
                          id={`${formId}-email`}
                          type="email"
                          required
                          placeholder="seuemail@exemplo.com"
                          className="checkout-field mt-1"
                          value={formData.email || ""}
                          aria-invalid={Boolean(errors.email)}
                          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        />
                        {errors.email && (
                          <p className="mt-1 text-xs text-[#ef4444]">{errors.email}</p>
                        )}
                      </div>

                      {/* CPF */}
                      <div>
                        <label
                          htmlFor={`${formId}-cpf`}
                          className="block text-xs font-medium text-[#edf3e8]"
                        >
                          CPF <span className="text-[#bce19c]">*</span>
                        </label>
                        <input
                          id={`${formId}-cpf`}
                          type="text"
                          required
                          placeholder="000.000.000-00"
                          maxLength={14}
                          className="checkout-field mt-1"
                          value={formData.cpf || ""}
                          aria-invalid={Boolean(errors.cpf)}
                          onChange={(e) =>
                            setFormData({ ...formData, cpf: maskCpf(e.target.value) })
                          }
                        />
                        {errors.cpf && <p className="mt-1 text-xs text-[#ef4444]">{errors.cpf}</p>}
                      </div>

                      {/* Telefone / WhatsApp */}
                      <div className="sm:col-span-2">
                        <label
                          htmlFor={`${formId}-phone`}
                          className="block text-xs font-medium text-[#edf3e8]"
                        >
                          Telefone / WhatsApp com DDD <span className="text-[#bce19c]">*</span>
                        </label>
                        <input
                          id={`${formId}-phone`}
                          type="tel"
                          required
                          placeholder="(11) 98765-4321"
                          maxLength={15}
                          className="checkout-field mt-1"
                          value={formData.phone || ""}
                          aria-invalid={Boolean(errors.phone)}
                          onChange={(e) =>
                            setFormData({ ...formData, phone: maskPhone(e.target.value) })
                          }
                        />
                        <p className="mt-1 text-[11px] text-[#9aa3ad]">
                          Enviaremos atualizações de rastreamento no seu WhatsApp.
                        </p>
                        {errors.phone && (
                          <p className="mt-1 text-xs text-[#ef4444]">{errors.phone}</p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Seção 2: Endereço de Entrega */}
                  <div className="border-t border-[#323b42] pt-5 sm:pt-6">
                    <div className="mb-3 flex items-center justify-between">
                      <h2 className="flex items-center gap-1.5 text-sm font-semibold text-[#edf3e8]">
                        <Truck className="h-4 w-4 text-[#bce19c]" />
                        <span>2. Endereço de entrega</span>
                      </h2>
                      <span className="rounded bg-[#112607] px-2 py-0.5 text-[10px] font-semibold text-[#bce19c]">
                        Frete Grátis Express
                      </span>
                    </div>

                    <div className="grid gap-3.5 sm:grid-cols-3">
                      {/* CEP */}
                      <div>
                        <label
                          htmlFor={`${formId}-cep`}
                          className="block text-xs font-medium text-[#edf3e8]"
                        >
                          CEP <span className="text-[#bce19c]">*</span>
                        </label>
                        <div className="relative mt-1">
                          <input
                            id={`${formId}-cep`}
                            type="text"
                            required
                            placeholder="00000-000"
                            maxLength={9}
                            className="checkout-field pr-9"
                            value={formData.cep || ""}
                            aria-invalid={Boolean(errors.cep)}
                            onChange={(e) => handleCepChange(e.target.value)}
                          />
                          {cepLoading && (
                            <div className="absolute right-3 top-1/2 -translate-y-1/2">
                              <Loader2 className="h-4 w-4 animate-spin text-[#bce19c]" />
                            </div>
                          )}
                        </div>
                        {cepMessage && (
                          <p
                            className={`mt-1 text-[11px] ${
                              cepMessage.includes("sucesso") ? "text-[#bce19c]" : "text-[#9aa3ad]"
                            }`}
                          >
                            {cepMessage}
                          </p>
                        )}
                        {errors.cep && <p className="mt-1 text-xs text-[#ef4444]">{errors.cep}</p>}
                      </div>

                      {/* Rua / Avenida */}
                      <div className="sm:col-span-2">
                        <label
                          htmlFor={`${formId}-street`}
                          className="block text-xs font-medium text-[#edf3e8]"
                        >
                          Rua / Avenida <span className="text-[#bce19c]">*</span>
                        </label>
                        <input
                          id={`${formId}-street`}
                          type="text"
                          required
                          placeholder="Ex: Av. Paulista"
                          className="checkout-field mt-1"
                          value={formData.street || ""}
                          aria-invalid={Boolean(errors.street)}
                          onChange={(e) => setFormData({ ...formData, street: e.target.value })}
                        />
                        {errors.street && (
                          <p className="mt-1 text-xs text-[#ef4444]">{errors.street}</p>
                        )}
                      </div>

                      {/* Número e Complemento em linha no mobile */}
                      <div className="grid grid-cols-[100px_1fr] sm:grid-cols-1 gap-2.5 sm:gap-3.5 sm:col-span-1">
                        <div>
                          <label
                            htmlFor={`${formId}-number`}
                            className="block text-xs font-medium text-[#edf3e8]"
                          >
                            Número <span className="text-[#bce19c]">*</span>
                          </label>
                          <input
                            id={`${formId}-number`}
                            type="text"
                            required
                            placeholder="123"
                            className="checkout-field mt-1"
                            value={formData.number || ""}
                            aria-invalid={Boolean(errors.number)}
                            onChange={(e) => setFormData({ ...formData, number: e.target.value })}
                          />
                          {errors.number && (
                            <p className="mt-1 text-xs text-[#ef4444]">{errors.number}</p>
                          )}
                        </div>
                        <div className="sm:hidden">
                          <label
                            htmlFor={`${formId}-complement-mob`}
                            className="block text-xs font-medium text-[#edf3e8]"
                          >
                            Complemento
                          </label>
                          <input
                            id={`${formId}-complement-mob`}
                            type="text"
                            placeholder="Apto, Bloco..."
                            className="checkout-field mt-1"
                            value={formData.complement || ""}
                            onChange={(e) =>
                              setFormData({ ...formData, complement: e.target.value })
                            }
                          />
                        </div>
                      </div>

                      {/* Complemento no desktop */}
                      <div className="hidden sm:block sm:col-span-2">
                        <label
                          htmlFor={`${formId}-complement`}
                          className="block text-xs font-medium text-[#edf3e8]"
                        >
                          Complemento (opcional)
                        </label>
                        <input
                          id={`${formId}-complement`}
                          type="text"
                          placeholder="Ex: Apto 42, Bloco B"
                          className="checkout-field mt-1"
                          value={formData.complement || ""}
                          onChange={(e) => setFormData({ ...formData, complement: e.target.value })}
                        />
                      </div>

                      {/* Bairro */}
                      <div>
                        <label
                          htmlFor={`${formId}-neighborhood`}
                          className="block text-xs font-medium text-[#edf3e8]"
                        >
                          Bairro <span className="text-[#bce19c]">*</span>
                        </label>
                        <input
                          id={`${formId}-neighborhood`}
                          type="text"
                          required
                          placeholder="Ex: Jardins"
                          className="checkout-field mt-1"
                          value={formData.neighborhood || ""}
                          aria-invalid={Boolean(errors.neighborhood)}
                          onChange={(e) =>
                            setFormData({ ...formData, neighborhood: e.target.value })
                          }
                        />
                        {errors.neighborhood && (
                          <p className="mt-1 text-xs text-[#ef4444]">{errors.neighborhood}</p>
                        )}
                      </div>

                      {/* Cidade e Estado no mobile em grid */}
                      <div className="grid grid-cols-[1fr_95px] sm:grid-cols-2 gap-2.5 sm:gap-3.5 sm:col-span-2">
                        <div>
                          <label
                            htmlFor={`${formId}-city`}
                            className="block text-xs font-medium text-[#edf3e8]"
                          >
                            Cidade <span className="text-[#bce19c]">*</span>
                          </label>
                          <input
                            id={`${formId}-city`}
                            type="text"
                            required
                            placeholder="Ex: São Paulo"
                            className="checkout-field mt-1"
                            value={formData.city || ""}
                            aria-invalid={Boolean(errors.city)}
                            onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                          />
                          {errors.city && (
                            <p className="mt-1 text-xs text-[#ef4444]">{errors.city}</p>
                          )}
                        </div>

                        <div>
                          <label
                            htmlFor={`${formId}-state`}
                            className="block text-xs font-medium text-[#edf3e8]"
                          >
                            UF <span className="text-[#bce19c]">*</span>
                          </label>
                          <select
                            id={`${formId}-state`}
                            required
                            className="checkout-field mt-1"
                            value={formData.state || ""}
                            aria-invalid={Boolean(errors.state)}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                state: e.target.value as Customer["state"],
                              })
                            }
                          >
                            <option value="">UF</option>
                            {BRAZILIAN_STATES.map((uf) => (
                              <option key={uf} value={uf}>
                                {uf}
                              </option>
                            ))}
                          </select>
                          {errors.state && (
                            <p className="mt-1 text-xs text-[#ef4444]">{errors.state}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Consentimento LGPD */}
                  <div className="border-t border-[#323b42] pt-4">
                    <label className="flex items-start gap-2.5 cursor-pointer text-xs text-[#9aa3ad]">
                      <input
                        type="checkbox"
                        checked={Boolean(formData.consent)}
                        className="mt-0.5 h-4 w-4 shrink-0 rounded border-[#323b42] bg-[#12171b] text-[#bce19c] focus:ring-[#bce19c]"
                        onChange={(e) => setFormData({ ...formData, consent: e.target.checked })}
                      />
                      <span className="leading-tight">
                        Concordo com os Termos e autorizo o envio das atualizações de entrega e nota
                        fiscal do kit Pura Cozinha.
                      </span>
                    </label>
                    {errors.consent && (
                      <p className="mt-1 text-xs text-[#ef4444]">{errors.consent}</p>
                    )}
                  </div>

                  {/* Botão de Avanço */}
                  <Button
                    type="submit"
                    size="lg"
                    className="h-13 sm:h-14 w-full rounded-full bg-[#bce19c] text-sm sm:text-base font-bold text-[#112607] transition-transform hover:scale-[1.01] hover:bg-[#bce19c]/90"
                  >
                    <span>Continuar para Revisão</span>
                    <ArrowRight className="ml-2 h-4 w-4 sm:h-5 sm:w-5" />
                  </Button>
                </form>
              </div>
            )}

            {/* STEP 2: Revisão do Pedido */}
            {step === 2 && (
              <div className="rounded-xl sm:rounded-2xl border border-[#323b42] bg-[#12171b] p-4 sm:p-6 md:p-8">
                <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-[#bce19c]">
                      Passo 02 de 03
                    </span>
                    <h1 className="mt-0.5 text-xl sm:text-2xl md:text-3xl font-bold text-[#edf3e8]">
                      Revise seu Pedido
                    </h1>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setStep(1)}
                    className="h-8 border-[#323b42] bg-transparent text-xs text-[#9aa3ad] hover:bg-[#112607] hover:text-[#bce19c]"
                  >
                    <Edit2 className="mr-1 h-3 w-3" />
                    Alterar Dados
                  </Button>
                </div>

                <div className="space-y-4 sm:space-y-5">
                  {/* Card do Produto Selecionado */}
                  <div className="rounded-xl border border-[#323b42] bg-[#060709] p-3.5 sm:p-4">
                    <div className="flex gap-3 sm:gap-4 items-center">
                      <div className="flex h-16 w-16 sm:h-20 sm:w-20 shrink-0 items-center justify-center rounded-lg border border-[#323b42] bg-[#12171b] p-1.5">
                        <Package className="h-8 w-8 sm:h-10 sm:w-10 text-[#bce19c]" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <span className="rounded bg-[#112607] px-2 py-0.5 text-[9px] sm:text-[10px] font-bold text-[#bce19c]">
                          10 PEÇAS COMPLETAS
                        </span>
                        <h3 className="mt-0.5 text-sm sm:text-base font-bold text-[#edf3e8] truncate">
                          Jogo de Panelas Cerâmicas Pura Cozinha
                        </h3>
                        <p className="text-[11px] sm:text-xs text-[#9aa3ad] line-clamp-2">
                          5 panelas antiaderentes + 5 tampas de vidro temperado com saída de vapor.
                          Livre de PFOA.
                        </p>
                        <div className="mt-1.5 flex flex-wrap items-baseline gap-1.5">
                          <span className="text-base sm:text-lg font-bold text-[#bce19c]">
                            {formatPrice(PRICE_CENTS)}
                          </span>
                          <span className="text-[11px] sm:text-xs text-[#9aa3ad] line-through">
                            {formatPrice(ORIGINAL_PRICE_CENTS)}
                          </span>
                          <span className="text-[11px] font-medium text-[#bce19c]">
                            (10% OFF no Pix)
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Resumo do Endereço de Entrega */}
                  <div className="rounded-xl border border-[#323b42] bg-[#060709] p-3.5 sm:p-4">
                    <div className="mb-1.5 flex items-center justify-between">
                      <h4 className="flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-[#edf3e8]">
                        <Truck className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-[#bce19c]" />
                        Endereço de Entrega Confirmado
                      </h4>
                      <button
                        onClick={() => setStep(1)}
                        className="text-[11px] text-[#bce19c] underline hover:opacity-80"
                      >
                        Editar
                      </button>
                    </div>
                    <p className="text-xs sm:text-sm font-medium text-[#edf3e8]">{formData.name}</p>
                    <p className="text-xs text-[#9aa3ad] leading-relaxed">
                      {formData.street}, {formData.number}
                      {formData.complement ? ` — ${formData.complement}` : ""}
                    </p>
                    <p className="text-xs text-[#9aa3ad]">
                      {formData.neighborhood} · {formData.city} / {formData.state} — CEP{" "}
                      {formData.cep}
                    </p>
                    <p className="mt-1 text-[11px] text-[#9aa3ad]">
                      WhatsApp: {formData.phone} · E-mail: {formData.email}
                    </p>
                  </div>

                  {/* Garantias & Benefícios */}
                  <div className="grid grid-cols-3 gap-2 sm:gap-3 text-center">
                    <div className="rounded-lg border border-[#323b42] bg-[#0c1709] p-2 sm:p-3">
                      <Truck className="mx-auto h-4 w-4 sm:h-5 sm:w-5 text-[#bce19c]" />
                      <p className="mt-1 text-[11px] sm:text-xs font-bold text-[#edf3e8] leading-tight">
                        Frete Grátis
                      </p>
                      <p className="hidden sm:block text-[10px] text-[#9aa3ad]">3 a 7 dias úteis</p>
                    </div>
                    <div className="rounded-lg border border-[#323b42] bg-[#0c1709] p-2 sm:p-3">
                      <ShieldCheck className="mx-auto h-4 w-4 sm:h-5 sm:w-5 text-[#bce19c]" />
                      <p className="mt-1 text-[11px] sm:text-xs font-bold text-[#edf3e8] leading-tight">
                        Garantia 1 Ano
                      </p>
                      <p className="hidden sm:block text-[10px] text-[#9aa3ad]">Cobertura total</p>
                    </div>
                    <div className="rounded-lg border border-[#323b42] bg-[#0c1709] p-2 sm:p-3">
                      <CheckCircle2 className="mx-auto h-4 w-4 sm:h-5 sm:w-5 text-[#bce19c]" />
                      <p className="mt-1 text-[11px] sm:text-xs font-bold text-[#edf3e8] leading-tight">
                        Rastreio Total
                      </p>
                      <p className="hidden sm:block text-[10px] text-[#9aa3ad]">
                        No Whats e E-mail
                      </p>
                    </div>
                  </div>

                  {statusMessage && (
                    <div className="rounded-lg border border-[#ef4444] bg-[#ef4444]/10 p-3 text-xs text-[#ef4444]">
                      {statusMessage}
                    </div>
                  )}

                  {/* Botão de Prosseguir para Pagamento Pix */}
                  <div className="space-y-2 pt-2">
                    <Button
                      size="lg"
                      disabled={busy}
                      onClick={handleStep2Submit}
                      className="h-13 sm:h-14 w-full rounded-full bg-[#bce19c] text-sm sm:text-base font-bold text-[#112607] transition-transform hover:scale-[1.01] hover:bg-[#bce19c]/90"
                    >
                      {busy ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 sm:h-5 sm:w-5 animate-spin" />
                          <span>Gerando pedido seguro…</span>
                        </>
                      ) : (
                        <>
                          <span>Prosseguir para Pagamento Pix</span>
                          <ArrowRight className="ml-2 h-4 w-4 sm:h-5 sm:w-5" />
                        </>
                      )}
                    </Button>
                    <p className="text-center text-[11px] text-[#9aa3ad]">
                      Seu pedido será gerado e você receberá as instruções para pagamento via Pix.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* STEP 3: Pagamento Pix Seguro (Deflow) */}
            {step === 3 && (
              <div className="rounded-xl sm:rounded-2xl border border-[#323b42] bg-[#12171b] p-4 sm:p-6 md:p-8">
                <div className="mb-5 text-center sm:text-left">
                  <div className="inline-flex items-center gap-1.5 rounded-full border border-[#bce19c]/30 bg-[#112607] px-2.5 py-0.5 text-[11px] font-semibold text-[#bce19c]">
                    <span className="h-2 w-2 rounded-full bg-[#bce19c] animate-ping" />
                    Passo Final: Pagamento Pix Ativado
                  </div>
                  <h1 className="mt-2 text-xl sm:text-2xl md:text-3xl font-bold text-[#edf3e8]">
                    Pague com Pix na Deflow
                  </h1>
                  <p className="mt-1 text-xs sm:text-sm text-[#9aa3ad]">
                    Conclua o pagamento de{" "}
                    <strong className="text-[#bce19c]">{formatPrice(PRICE_CENTS)}</strong> para
                    garantir o seu kit Pura Cozinha com frete grátis.
                  </p>
                </div>

                {/* Banner de Reserva com Contador */}
                <div className="mb-5 flex items-center justify-between gap-2 rounded-xl border border-[#bce19c]/40 bg-[#0c1709] p-3 text-xs">
                  <div className="flex items-center gap-1.5 text-[#edf3e8]">
                    <Clock className="h-4 w-4 shrink-0 text-[#bce19c]" />
                    <span className="text-[11px] sm:text-xs">Estoque reservado:</span>
                  </div>
                  <div className="font-mono text-sm sm:text-base font-bold text-[#bce19c]">
                    {formatTimer(timeLeft)}
                  </div>
                </div>

                <div className="space-y-4 sm:space-y-5">
                  {/* Box Principal de Ação - Link direto para Deflow */}
                  <div className="rounded-xl border border-[#323b42] bg-[#060709] p-4 sm:p-6 text-center">
                    <div className="mx-auto mb-3 flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-full bg-[#112607] text-[#bce19c]">
                      <QrCode className="h-6 w-6 sm:h-8 sm:w-8" />
                    </div>
                    <h3 className="text-base sm:text-lg font-bold text-[#edf3e8]">
                      Pagamento Pix Instantâneo
                    </h3>
                    <p className="mx-auto mt-1 max-w-md text-xs text-[#9aa3ad]">
                      Toque no botão abaixo para abrir a página oficial da Deflow e pagar com QR
                      Code ou Pix Copia e Cola:
                    </p>

                    <div className="mt-4 flex flex-col items-center gap-3">
                      <Button
                        asChild
                        size="lg"
                        className="h-13 sm:h-14 w-full max-w-md rounded-full bg-[#bce19c] text-sm sm:text-base font-bold text-[#112607] shadow-lg shadow-[#bce19c]/10 transition-transform hover:scale-[1.01] hover:bg-[#bce19c]/90"
                      >
                        <a href={CHECKOUT_URL} target="_blank" rel="noopener noreferrer">
                          <span>Abrir Pagamento Pix na Deflow</span>
                          <ExternalLink className="ml-1.5 h-4 w-4" />
                        </a>
                      </Button>

                      {/* Caixa de Copiar Link Responsiva */}
                      <div className="flex w-full max-w-md items-center gap-2 rounded-lg border border-[#323b42] bg-[#12171b] p-1.5">
                        <input
                          type="text"
                          readOnly
                          value={CHECKOUT_URL}
                          className="w-full min-w-0 flex-1 truncate bg-transparent px-2 text-xs font-mono text-[#9aa3ad] outline-none"
                        />
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={handleCopyLink}
                          className="h-8 shrink-0 px-2.5 text-xs text-[#bce19c] hover:bg-[#112607]"
                        >
                          {copied ? (
                            <>
                              <Check className="mr-1 h-3 w-3" />
                              Copiado!
                            </>
                          ) : (
                            <>
                              <Copy className="mr-1 h-3 w-3" />
                              Copiar
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* Instruções de Pagamento */}
                  <div className="rounded-xl border border-[#323b42] bg-[#060709] p-4">
                    <h4 className="text-xs sm:text-sm font-semibold text-[#edf3e8]">
                      Como funciona o pagamento:
                    </h4>
                    <ol className="mt-2.5 space-y-2 text-xs text-[#9aa3ad]">
                      <li className="flex items-start gap-2">
                        <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[#112607] text-[10px] font-bold text-[#bce19c]">
                          1
                        </span>
                        <span>Abra o link da Deflow no botão acima.</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[#112607] text-[10px] font-bold text-[#bce19c]">
                          2
                        </span>
                        <span>
                          No app do seu banco, escolha <strong>Pix Copia e Cola</strong> ou escaneie
                          o QR Code.
                        </span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[#112607] text-[10px] font-bold text-[#bce19c]">
                          3
                        </span>
                        <span>
                          Confirme o valor de <strong>R$ 359,91</strong>.
                        </span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[#112607] text-[10px] font-bold text-[#bce19c]">
                          4
                        </span>
                        <span>
                          Pronto! A Deflow aprova instantaneamente e despachamos seu kit em até 24h.
                        </span>
                      </li>
                    </ol>
                  </div>

                  {/* Botão de Verificação de Pagamento */}
                  <div className="space-y-2.5">
                    <Button
                      variant="outline"
                      size="lg"
                      disabled={busy}
                      onClick={handleCheckStatus}
                      className="h-11 sm:h-12 w-full border-[#323b42] bg-[#12171b] text-xs sm:text-sm font-medium text-[#edf3e8] hover:bg-[#171d22] hover:text-[#bce19c]"
                    >
                      {busy ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin text-[#bce19c]" />
                          <span>Consultando compensação bancária…</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="mr-1.5 h-4 w-4 text-[#bce19c]" />
                          <span>Já realizei o pagamento / Verificar status</span>
                        </>
                      )}
                    </Button>

                    {statusMessage && (
                      <div
                        className={`rounded-xl border p-3.5 text-xs leading-relaxed ${
                          confirmed
                            ? "border-[#bce19c] bg-[#112607] text-[#bce19c]"
                            : "border-[#323b42] bg-[#060709] text-[#edf3e8]"
                        }`}
                      >
                        <div className="flex items-start gap-2">
                          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-[#bce19c]" />
                          <div>{statusMessage}</div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Suporte Humano */}
                  <div className="flex items-center justify-between rounded-xl border border-[#323b42] bg-[#060709] px-3.5 py-2.5 text-xs text-[#9aa3ad]">
                    <div className="flex items-center gap-1.5">
                      <PhoneCall className="h-3.5 w-3.5 text-[#bce19c]" />
                      <span>Dúvidas com o Pix?</span>
                    </div>
                    <span className="text-[#bce19c] font-medium">Suporte Oficial Ativo</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Right Sidebar: Resumo do Pedido (Desktop Persistent) */}
          <aside className="hidden lg:block self-start space-y-4">
            <div className="rounded-2xl border border-[#323b42] bg-[#12171b] p-6">
              <h2 className="text-lg font-bold text-[#edf3e8]">Resumo do Pedido</h2>
              <p className="mt-1 text-xs text-[#9aa3ad]">Jogo de Panelas 10 Peças Pura Cozinha</p>

              {/* Itens */}
              <div className="mt-4 space-y-2 border-b border-[#323b42] pb-4 text-xs text-[#9aa3ad]">
                <div className="flex justify-between">
                  <span>1x Caçarola 24cm + Tampa</span>
                  <span className="text-[#edf3e8]">Inclusa</span>
                </div>
                <div className="flex justify-between">
                  <span>1x Caçarola 20cm + Tampa</span>
                  <span className="text-[#edf3e8]">Inclusa</span>
                </div>
                <div className="flex justify-between">
                  <span>1x Panela 18cm + Tampa</span>
                  <span className="text-[#edf3e8]">Inclusa</span>
                </div>
                <div className="flex justify-between">
                  <span>1x Panela 16cm + Tampa</span>
                  <span className="text-[#edf3e8]">Inclusa</span>
                </div>
                <div className="flex justify-between">
                  <span>1x Frigideira Funda 24cm + Tampa</span>
                  <span className="text-[#edf3e8]">Inclusa</span>
                </div>
              </div>

              {/* Valores */}
              <dl className="mt-4 space-y-3 text-sm">
                <div className="flex justify-between text-[#9aa3ad]">
                  <dt>Preço original</dt>
                  <dd className="line-through">{formatPrice(ORIGINAL_PRICE_CENTS)}</dd>
                </div>
                <div className="flex justify-between text-[#bce19c]">
                  <dt>Desconto Pix (10% OFF)</dt>
                  <dd>-{formatPrice(DISCOUNT_CENTS)}</dd>
                </div>
                <div className="flex justify-between text-[#9aa3ad]">
                  <dt>Frete Express</dt>
                  <dd className="font-semibold text-[#bce19c]">Grátis</dd>
                </div>
                <div className="flex justify-between border-t border-[#323b42] pt-3 text-lg font-bold text-[#edf3e8]">
                  <dt>Total no Pix</dt>
                  <dd className="text-[#bce19c]">{formatPrice(PRICE_CENTS)}</dd>
                </div>
              </dl>

              {/* Badges de Confiança */}
              <div className="mt-6 space-y-2 border-t border-[#323b42] pt-4 text-xs text-[#9aa3ad]">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-[#bce19c]" />
                  <span>Garantia de 1 ano contra defeitos</span>
                </div>
                <div className="flex items-center gap-2">
                  <Lock className="h-4 w-4 text-[#bce19c]" />
                  <span>Criptografia SSL de 256 bits</span>
                </div>
                <div className="flex items-center gap-2">
                  <Truck className="h-4 w-4 text-[#bce19c]" />
                  <span>Envio com seguro de transporte</span>
                </div>
              </div>
            </div>

            {/* Selo Satisfação */}
            <div className="rounded-xl border border-[#323b42] bg-[#0c1709] p-4 text-center text-xs text-[#edf3e8]">
              <p className="font-semibold text-[#bce19c]">
                Satisfação Garantida ou seu Dinheiro de Volta
              </p>
              <p className="mt-1 text-[11px] text-[#9aa3ad]">
                Você tem 7 dias após o recebimento para testar em sua casa. Se não amar, devolvemos
                100% do valor.
              </p>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}
