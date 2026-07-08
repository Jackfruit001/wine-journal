"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

/**
 * Recognition takes a few seconds (a vision model reads the label, then we verify
 * it against 130k real wines). Rather than a dead spinner, we narrate the steps
 * like a sommelier examining the bottle, so the wait feels purposeful.
 */
const STEPS = [
  { emoji: "🔍", text: "Focusing on the label…" },
  { emoji: "📖", text: "Reading the producer and vintage…" },
  { emoji: "🍇", text: "Identifying the grape and region…" },
  { emoji: "📚", text: "Checking our cellar of 130,000 real wines…" },
  { emoji: "⚖️", text: "Weighing the evidence for a confidence score…" },
];

const STEP_MS = 2200;

export function RecognizingExperience({ imageDataUrl }: { imageDataUrl: string | null }) {
  const [step, setStep] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      // Hold on the last step until the real response lands.
      setStep((s) => Math.min(s + 1, STEPS.length - 1));
    }, STEP_MS);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 py-8 text-center">
      {imageDataUrl && (
        <div className="relative">
          <Image
            src={imageDataUrl}
            alt="Captured label"
            width={240}
            height={300}
            unoptimized
            className="max-h-72 w-auto rounded-2xl object-contain shadow-lg"
          />
          <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl">
            <div className="absolute inset-x-0 h-1/3 animate-scan bg-gradient-to-b from-transparent via-wine/25 to-transparent" />
          </div>
        </div>
      )}

      <div className="flex flex-col items-center gap-3">
        <p className="text-lg font-medium">
          <span className="mr-2">{STEPS[step].emoji}</span>
          {STEPS[step].text}
        </p>
        <div className="flex gap-1.5">
          {STEPS.map((_, i) => (
            <span
              key={i}
              className={`h-1.5 rounded-full transition-all duration-500 ${
                i <= step ? "w-6 bg-wine" : "w-1.5 bg-black/15 dark:bg-white/15"
              }`}
            />
          ))}
        </div>
        <p className="max-w-xs text-xs text-foreground/50">
          We read the label with a vision model, then cross-check it against a real wine database — that
          double-check is what makes the confidence score trustworthy.
        </p>
      </div>
    </div>
  );
}
