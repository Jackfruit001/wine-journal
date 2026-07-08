"use client";

import { useRef, useState } from "react";
import { motion } from "motion/react";
import { fileToDataUrl } from "@/lib/image";

export function CaptureButton({
  onCapture,
  disabled,
}: {
  onCapture: (dataUrl: string) => void;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
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
    <div className="flex w-full flex-col items-center gap-3 md:items-start">
      {/* No `capture` attribute — on iOS/Android this opens the native action sheet
          (Take Photo / Photo Library / Choose File) instead of jumping straight into
          the camera app. On desktop it opens the file picker. */}
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleChange} />

      <motion.button
        type="button"
        disabled={disabled || busy}
        onClick={() => inputRef.current?.click()}
        whileHover={{ scale: 1.03 }}
        whileTap={{ scale: 0.97 }}
        transition={{ type: "spring", stiffness: 400, damping: 17 }}
        className="flex items-center justify-center gap-2 rounded-full bg-wine px-6 py-3.5 text-base font-medium text-white shadow-lg shadow-wine/25 disabled:opacity-50"
      >
        <motion.span
          animate={busy ? { rotate: [0, -12, 12, 0] } : {}}
          transition={{ repeat: busy ? Infinity : 0, duration: 1 }}
        >
          📷
        </motion.span>
        {busy ? "Preparing…" : "Take or choose a photo"}
      </motion.button>
    </div>
  );
}
