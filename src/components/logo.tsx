import officialLogo from "@/assets/uploads/8532.png";

type LogoProps = {
  /** Largura da imagem em pixels; a proporção original é sempre preservada. */
  size?: number;
  /** Mantido para compatibilidade com os locais que já usam o componente. */
  withWordmark?: boolean;
  className?: string;
};

/** Logo oficial INFINITLOG VAPT VUPT, sem cortes ou alterações na arte. */
export function Logo({
  size = 140,
  withWordmark = true,
  className = "",
}: LogoProps) {
  return (
    <img
      src={officialLogo}
      alt={
        withWordmark
          ? "INFINITLOG VAPT VUPT"
          : "Símbolo e assinatura INFINITLOG VAPT VUPT"
      }
      width={size}
      className={`block h-auto max-w-full object-contain ${className}`}
      style={{ width: size }}
      loading="eager"
      decoding="async"
    />
  );
}

export const logoUrl = officialLogo;