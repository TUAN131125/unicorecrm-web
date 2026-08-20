import React, { useMemo } from "react";
import { createQrSvgDataUri } from "@/shared/lib/qr";

export interface PaymentQrCodeProps {
  payload: string;
  alt: string;
  className?: string;
}

export const PaymentQrCode: React.FC<PaymentQrCodeProps> = ({ payload, alt, className = "h-36 w-36" }) => {
  const src = useMemo(() => createQrSvgDataUri(payload), [payload]);
  return <img src={src} alt={alt} title={payload} className={`shrink-0 bg-white object-contain ${className}`} />;
};
