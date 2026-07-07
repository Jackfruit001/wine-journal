"use client";

import { useRef } from "react";
import { fileToDataUrl } from "@/lib/image";

export function CaptureButton({
  onCapture,
  disabled,
}: {
  onCapture: (dataUrl: string) => void;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const dataUrl = await fileToDataUrl(file);
    onCapture(dataUrl);
  }

  return (
    <div className="flex w-full flex-col items-center gap-3">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleChange}
      />
      <button
        type="button"
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
        className="flex h-16 w-16 items-center justify-center rounded-full bg-wine text-3xl text-white shadow-lg shadow-wine/30 transition-transform active:scale-95 disabled:opacity-50"
        aria-label="Take or upload a photo of a wine label"
      >
        📷
      </button>
      <p className="text-sm text-foreground/60">Photograph the label</p>
    </div>
  );
}
