"use client";

import { useRef, useState } from "react";
import { fileToDataUrl } from "@/lib/image";

export function CaptureButton({
  onCapture,
  disabled,
}: {
  onCapture: (dataUrl: string) => void;
  disabled?: boolean;
}) {
  const cameraRef = useRef<HTMLInputElement>(null);
  const uploadRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    try {
      const dataUrl = await fileToDataUrl(file);
      onCapture(dataUrl);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex w-full flex-col items-center gap-3 sm:flex-row sm:items-stretch md:justify-start">
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleChange} />
      <input ref={uploadRef} type="file" accept="image/*" className="hidden" onChange={handleChange} />

      <button
        type="button"
        disabled={disabled || busy}
        onClick={() => cameraRef.current?.click()}
        className="flex items-center justify-center gap-2 rounded-full bg-wine px-6 py-3.5 text-base font-medium text-white shadow-lg shadow-wine/25 transition-transform active:scale-[0.98] disabled:opacity-50 sm:hidden"
      >
        📷 Take a photo
      </button>

      <button
        type="button"
        disabled={disabled || busy}
        onClick={() => uploadRef.current?.click()}
        className="hidden items-center justify-center gap-2 rounded-full bg-wine px-6 py-3.5 text-base font-medium text-white shadow-lg shadow-wine/25 transition-transform active:scale-[0.98] disabled:opacity-50 sm:flex"
      >
        📷 Upload a wine photo
      </button>
    </div>
  );
}
