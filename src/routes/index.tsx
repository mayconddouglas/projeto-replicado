import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Pura Cozinha — Jogo de Panelas 10 Peças" },
      { name: "description", content: "Jogo de panelas antiaderentes 10 peças com frete grátis, 10% OFF no Pix e 12x sem juros." },
      { property: "og:title", content: "Pura Cozinha — Jogo de Panelas 10 Peças" },
      { property: "og:description", content: "Panelas antiaderentes, frete grátis e 10% OFF no Pix." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <iframe
      src="/pura-cozinha.html"
      title="Pura Cozinha — Jogo de Panelas 10 Peças"
      className="fixed inset-0 h-full w-full border-0"
    />
  );
}
