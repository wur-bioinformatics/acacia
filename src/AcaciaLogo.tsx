import type { JSX } from "react";
import AcaciaSVG from "./acacia.svg?react";

interface AcaciaLogoProps {
  size?: number;
  className?: string;
}

export function AcaciaLogo({
  size = 32,
  className,
}: AcaciaLogoProps): JSX.Element {
  return (
    <AcaciaSVG
      width={size}
      height={size}
      aria-hidden="true"
      className={className}
    />
  );
}

interface AcaciaBrandProps {
  size?: number;
  className?: string;
}

export function AcaciaBrand({
  size = 32,
  className,
}: AcaciaBrandProps): JSX.Element {
  const fontSize = size * 0.6;
  const gap = size * 0.3;
  return (
    <div
      className={className}
      style={{ display: "inline-flex", alignItems: "center", gap }}
    >
      <AcaciaLogo size={size} />
      <span
        style={{
          fontFamily: '"Azeret Mono", ui-monospace, monospace',
          fontWeight: 900,
          fontStyle: "italic",
          fontSize,
          letterSpacing: "0.12em",
          lineHeight: 1,
        }}
      >
        ACACIA
      </span>
    </div>
  );
}
