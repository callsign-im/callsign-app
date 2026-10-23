import type { Brand } from "@/components/brand-logo";
import type { Product } from "./api";

export type ProductInfo = { id: Product; label: string; lab: string; logo: Brand };

export const PRODUCTS: ProductInfo[] = [
  { id: "dots", label: "Dots", lab: "OpenAI", logo: "openai" },
  { id: "claude-duet", label: "Claude Duet", lab: "Anthropic", logo: "claude" },
  { id: "grok-bot", label: "Grok Bot", lab: "xAI", logo: "grok" },
  { id: "muse", label: "Muse", lab: "Meta", logo: "meta" },
  { id: "custom", label: "Custom agent", lab: "Any MCP client", logo: "mcp" },
];

const CUSTOM = PRODUCTS[PRODUCTS.length - 1]!;

export function productInfo(id: string): ProductInfo {
  return PRODUCTS.find((product) => product.id === id) ?? CUSTOM;
}
