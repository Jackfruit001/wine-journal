"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { AnimatePresence, motion } from "motion/react";

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
        <motion.div
          className="relative"
          initial={{ opacity: 0, scale: 0.92 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        >
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
          {/* soft breathing glow while thinking */}
          <motion.div
            className="pointer-events-none absolute -inset-1 rounded-3xl ring-2 ring-wine/30"
            animate={{ opacity: [0.2, 0.6, 0.2] }}
            transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
          />
        </motion.div>
      )}

      <div className="flex min-h-[3.5rem] flex-col items-center gap-3">
        <AnimatePresence mode="wait">
          <motion.p
            key={step}
            className="text-lg font-medium"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.3 }}
          >
            <motion.span
              className="mr-2 inline-block"
              initial={{ scale: 0.5 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 350, damping: 12 }}
            >
              {STEPS[step].emoji}
            </motion.span>
            {STEPS[step].text}
          </motion.p>
        </AnimatePresence>
        <div className="flex gap-1.5">
          {STEPS.map((_, i) => (
            <motion.span
              key={i}
              className="h-1.5 rounded-full bg-wine"
              animate={{ width: i <= step ? 24 : 6, opacity: i <= step ? 1 : 0.2 }}
              transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
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
