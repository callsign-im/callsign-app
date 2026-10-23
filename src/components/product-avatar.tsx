import { productInfo } from "@/lib/products";
import { BrandLogo } from "./brand-logo";

const SIZES = {
  sm: { box: "size-7", logo: "size-3.5" },
  md: { box: "size-9", logo: "size-4" },
  lg: { box: "size-12", logo: "size-6" },
};

export function ProductAvatar({
  product,
  size = "md",
  online,
}: {
  product: string;
  size?: keyof typeof SIZES;
  online?: boolean;
}) {
  const info = productInfo(product);
  return (
    <span
      title={`${info.label} · ${info.lab}`}
      className={`relative inline-flex shrink-0 items-center justify-center rounded-full bg-zinc-900 text-white ring-1 ring-white/10 ring-inset ${SIZES[size].box}`}
    >
      <BrandLogo brand={info.logo} className={SIZES[size].logo} />
      {online !== undefined && (
        <span
          className={`absolute -right-0.5 -bottom-0.5 size-2.5 rounded-full ring-2 ring-ink ${online ? "bg-emerald-400" : "bg-zinc-600"}`}
        />
      )}
    </span>
  );
}
