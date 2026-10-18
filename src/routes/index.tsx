import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef } from "react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Pura Cozinha — Jogo de Panelas 10 Peças" },
      {
        name: "description",
        content:
          "Jogo de panelas antiaderentes 10 peças com frete grátis, 10% OFF no Pix e 12x sem juros.",
      },
      { property: "og:title", content: "Pura Cozinha — Jogo de Panelas 10 Peças" },
      {
        property: "og:description",
        content: "Panelas antiaderentes, frete grátis e 10% OFF no Pix.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  const navigate = useNavigate();
  const iframe = useRef<HTMLIFrameElement>(null);
  useEffect(() => {
    const listener = (event: MessageEvent) => {
      if (
        event.origin === window.location.origin &&
        event.source === iframe.current?.contentWindow &&
        event.data?.type === "pura-checkout"
      )
        navigate({ to: "/checkout" });
    };
    window.addEventListener("message", listener);
    return () => window.removeEventListener("message", listener);
  }, [navigate]);
  return (
    <iframe
      ref={iframe}
      src="/pura-cozinha.html"
      title="Pura Cozinha — Jogo de Panelas 10 Peças"
      allow="autoplay"
      className="fixed inset-0 h-full w-full border-0"
    />
  );
}
