import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { ArrowLeft, ArrowRight, LockKeyhole } from "lucide-react";
import { Button } from "@/components/ui/button";
import { customerSchema, CHECKOUT_URL, PRICE_CENTS, formatPrice, type Customer } from "@/lib/checkout";
import { createCheckoutOrder, readCheckoutOrder, confirmCheckoutOrder } from "@/lib/checkout.functions";

export const Route = createFileRoute("/checkout")({
  head: () => ({ meta: [
    { title: "Checkout — Pura Cozinha" },
    { name: "description", content: "Dados de entrega, pagamento e confirmação do seu pedido Pura Cozinha." },
    { property: "og:title", content: "Checkout — Pura Cozinha" },
    { property: "og:description", content: "Finalize seu pedido de panelas Pura Cozinha." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: Checkout,
});

const fields = [
  ["name", "Nome completo", "text", "name"], ["email", "E-mail", "email", "email"],
  ["cpf", "CPF", "text", "off"], ["phone", "Telefone com DDD", "tel", "tel"],
  ["cep", "CEP", "text", "postal-code"], ["street", "Rua / avenida", "text", "address-line1"],
  ["number", "Número", "text", "off"], ["complement", "Complemento (opcional)", "text", "address-line2"],
  ["neighborhood", "Bairro", "text", "off"], ["city", "Cidade", "text", "address-level2"],
] as const;

function Checkout() {
  const [step, setStep] = useState(1);
  const [customer, setCustomer] = useState<Customer>();
  const [order, setOrder] = useState<{ id: string; token: string }>();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const create = useServerFn(createCheckoutOrder);
  const read = useServerFn(readCheckoutOrder);
  const confirm = useServerFn(confirmCheckoutOrder);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const result = customerSchema.safeParse({ ...Object.fromEntries(form), consent: form.get("consent") === "on" });
    if (!result.success) {
      setErrors(Object.fromEntries(result.error.issues.map(issue => [String(issue.path[0]), issue.message])));
      return;
    }
    setErrors({}); setMessage(""); setBusy(true);
    try {
      const saved = await create({ data: result.data });
      setOrder(saved); setCustomer(result.data); setStep(2);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Não foi possível salvar o pedido."); }
    finally { setBusy(false); }
  }

  async function checkPayment() {
    if (!order) return;
    setBusy(true); setMessage("");
    try {
      const saved = await read({ data: order });
      if (saved.status === "paid" || saved.status === "confirmed") { setCustomer(saved.customer); setStep(3); }
      else setMessage("Pagamento ainda não confirmado. A confirmação automática depende da conexão com a Deflow.");
    } catch { setMessage("Não foi possível verificar o pedido. Tente novamente."); }
    finally { setBusy(false); }
  }

  async function finish() {
    if (!order) return;
    setBusy(true);
    try { await confirm({ data: order }); setConfirmed(true); }
    catch { setMessage("Não foi possível confirmar os dados do pedido."); }
    finally { setBusy(false); }
  }

  return <main className="checkout-theme min-h-screen px-5 py-8 sm:px-8">
    <header className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 border-b border-border pb-6">
      <Link to="/" className="text-xl font-semibold">Pura Cozinha</Link>
      <span className="flex items-center gap-2 text-xs text-muted-foreground"><LockKeyhole size={15} /> Checkout seguro</span>
    </header>
    <div className="mx-auto max-w-5xl py-8">
      <Button variant="ghost" asChild className="mb-6"><Link to="/"><ArrowLeft /> Voltar à loja</Link></Button>
      <ol className="mb-10 grid grid-cols-3 gap-2 text-xs sm:text-sm">
        {["Dados e entrega", "Pagamento", "Confirmação"].map((label, index) => <li key={label} aria-current={step === index + 1 ? "step" : undefined} className={`border-b-2 pb-4 ${step >= index + 1 ? "border-primary text-primary" : "border-border text-muted-foreground"}`}><span className="mr-2 font-semibold">0{index + 1}</span>{label}</li>)}
      </ol>
      <div className="grid gap-10 lg:grid-cols-[1fr_300px]">
        <section>
          <h1 className="mb-6 text-3xl">{step === 1 ? "Seus dados e entrega" : step === 2 ? "Revise e pague" : confirmed ? "Pedido confirmado" : "Confirme seus dados"}</h1>
          {step === 1 && <form onSubmit={submit} noValidate className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {fields.map(([name, label, type, autoComplete]) => <label key={name} className="block text-sm">{label}<input className="checkout-field mt-2" name={name} type={type} autoComplete={autoComplete} required={name !== "complement"} maxLength={name === "email" ? 254 : 120} aria-invalid={Boolean(errors[name])} defaultValue={customer?.[name]} />{errors[name] && <span className="mt-1 block text-xs text-destructive">{errors[name]}</span>}</label>)}
            <label className="text-sm">Estado<select name="state" className="checkout-field mt-2" defaultValue={customer?.state ?? ""} aria-invalid={Boolean(errors.state)}><option value="">Selecione</option>{customerSchema.shape.state.options.map(state => <option key={state}>{state}</option>)}</select>{errors.state && <span className="text-xs text-destructive">{errors.state}</span>}</label>
            <label className="flex items-start gap-3 text-xs leading-5 sm:col-span-2"><input type="checkbox" name="consent" defaultChecked={customer?.consent} className="mt-1" />Autorizo o uso dos meus dados para processar este pedido e realizar a entrega.</label>
            {errors.consent && <p className="text-xs text-destructive sm:col-span-2">{errors.consent}</p>}
            <Button size="lg" disabled={busy} className="h-12 sm:col-span-2" type="submit">{busy ? "Salvando pedido…" : "Continuar para pagamento"}<ArrowRight /></Button>
          </form>}
          {step > 1 && customer && <div className="space-y-6">
            <div className="space-y-2 border-b border-border pb-6 text-sm"><h2 className="text-xl">Entrega</h2><p>{customer.name}</p><p>{customer.street}, {customer.number}{customer.complement && ` — ${customer.complement}`}</p><p>{customer.neighborhood} · {customer.city} / {customer.state}</p><p>CEP {customer.cep}</p><p className="text-muted-foreground">{customer.email} · {customer.phone}</p></div>
            {step === 2 && <><Button variant="outline" onClick={() => setStep(1)}><ArrowLeft />Corrigir dados</Button><h2 className="text-xl">Pagamento no Pix</h2><p className="text-sm text-muted-foreground">Seu pedido foi salvo. Por enquanto, o pagamento é realizado na página segura da Deflow, em outra aba.</p><Button asChild size="lg" className="h-12 w-full"><a href={CHECKOUT_URL} target="_blank" rel="noopener noreferrer">Pagar {formatPrice(PRICE_CENTS)}<ArrowRight /></a></Button><Button variant="outline" className="h-12 w-full" disabled={busy} onClick={checkPayment}>{busy ? "Verificando…" : "Verificar pagamento"}</Button></>}
            {step === 3 && <>{confirmed ? <p>Seus dados foram confirmados. Pedido {order?.id.slice(0, 8).toUpperCase()}.</p> : <Button disabled={busy} onClick={finish} className="h-12 w-full">Confirmar dados e finalizar</Button>}</>}
          </div>}
          {message && <p role="alert" className="mt-5 text-sm text-destructive">{message}</p>}
        </section>
        <aside className="self-start border-t border-border pt-6 lg:border-l lg:border-t-0 lg:pl-8 lg:pt-0"><h2 className="mb-5 text-xl">Seu pedido</h2><p className="font-semibold">Jogo de Panelas 10 Peças</p><p className="mt-2 text-sm text-muted-foreground">5 panelas + 5 tampas · Quantidade: 1</p><dl className="mt-6 space-y-4 text-sm"><div className="flex justify-between gap-3"><dt>Produtos no Pix</dt><dd>{formatPrice(PRICE_CENTS)}</dd></div><div className="flex justify-between"><dt>Frete</dt><dd className="text-primary">Grátis</dd></div><div className="flex justify-between border-t border-border pt-4 text-lg font-semibold"><dt>Total</dt><dd>{formatPrice(PRICE_CENTS)}</dd></div></dl><p className="mt-6 flex items-center gap-2 text-xs text-muted-foreground"><LockKeyhole size={14} /> Dados protegidos</p></aside>
      </div>
    </div>
  </main>;
}