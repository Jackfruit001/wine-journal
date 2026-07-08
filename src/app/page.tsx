"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { CaptureButton } from "@/components/CaptureButton";
import { RecognitionResult } from "@/components/RecognitionResult";
import { RecognizingExperience } from "@/components/RecognizingExperience";
import type { RecognizeResponse } from "@/lib/schema";

type Step = "capture" | "reading" | "result" | "saved";

const EASE = [0.22, 1, 0.36, 1] as const;
const stepMotion = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -12 },
  transition: { duration: 0.3, ease: EASE },
};

const HOW_IT_WORKS = [
  { icon: "📷", title: "Read", body: "A vision model extracts producer, vintage, region, grape and more." },
  { icon: "🔎", title: "Verify", body: "We cross-check it against 130,000 real wines — an independent second opinion." },
  { icon: "✍️", title: "Journal", body: "Auto-filled, fully editable, with one-tap tasting notes." },
];

export default function Home() {
  const [step, setStep] = useState<Step>("capture");
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [result, setResult] = useState<RecognizeResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleCapture(dataUrl: string) {
    setImageDataUrl(dataUrl);
    setStep("reading");
    setError(null);
    try {
      const res = await fetch("/api/recognize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: dataUrl }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Recognition failed");
      }
      const data: RecognizeResponse = await res.json();
      setResult(data);
      setStep("result");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Recognition failed");
      setStep("capture");
    }
  }

  function reset() {
    setStep("capture");
    setImageDataUrl(null);
    setResult(null);
    setError(null);
  }

  return (
    <AnimatePresence mode="wait">
      {step === "capture" && (
        <motion.div
          key="capture"
          {...stepMotion}
          className="mx-auto grid w-full max-w-5xl flex-1 items-center gap-10 px-5 py-10 md:grid-cols-2 md:gap-16 md:py-20"
        >
          <motion.div
            className="flex flex-col gap-6 text-center md:text-left"
            initial="hidden"
            animate="show"
            variants={{ show: { transition: { staggerChildren: 0.08, delayChildren: 0.05 } } }}
          >
            <motion.div
              className="flex flex-col gap-3"
              variants={{ hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } }}
            >
              <span className="mx-auto w-fit rounded-full bg-wine/10 px-3 py-1 text-xs font-medium text-wine md:mx-0">
                AI wine recognition
              </span>
              <h1 className="text-3xl font-semibold leading-tight tracking-tight md:text-5xl">
                Snap a label.
                <br />
                <span className="text-wine">Keep the memory.</span>
              </h1>
              <p className="mx-auto max-w-md text-base text-foreground/60 md:mx-0">
                Photograph any wine bottle and we&apos;ll read the label, identify the wine, and start a dated
                journal entry — with an honest confidence score, not a confident guess.
              </p>
            </motion.div>
            <motion.div
              className="flex flex-col items-center gap-3 md:items-start"
              variants={{ hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } }}
            >
              <CaptureButton onCapture={handleCapture} />
              <AnimatePresence>
                {error && (
                  <motion.p
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="text-sm text-rose-600"
                  >
                    {error}
                  </motion.p>
                )}
              </AnimatePresence>
              <Link
                href="/journal"
                className="text-sm font-medium text-foreground/60 underline underline-offset-2 hover:text-wine"
              >
                Or browse your journal →
              </Link>
            </motion.div>
          </motion.div>

          <motion.div
            className="hidden md:flex md:flex-col md:gap-4"
            initial="hidden"
            animate="show"
            variants={{ show: { transition: { staggerChildren: 0.1, delayChildren: 0.25 } } }}
          >
            {HOW_IT_WORKS.map((c) => (
              <motion.div
                key={c.title}
                variants={{ hidden: { opacity: 0, x: 16 }, show: { opacity: 1, x: 0 } }}
                whileHover={{ y: -3 }}
                transition={{ duration: 0.3, ease: EASE }}
                className="flex gap-4 rounded-2xl border border-black/5 bg-white/50 p-4 dark:border-white/10 dark:bg-white/5"
              >
                <span className="text-2xl">{c.icon}</span>
                <div>
                  <p className="font-medium">{c.title}</p>
                  <p className="text-sm text-foreground/60">{c.body}</p>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </motion.div>
      )}

      {step === "reading" && (
        <motion.div key="reading" {...stepMotion} className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-5">
          <RecognizingExperience imageDataUrl={imageDataUrl} />
        </motion.div>
      )}

      {step === "result" && result && (
        <motion.div
          key="result"
          {...stepMotion}
          className="mx-auto grid w-full max-w-5xl flex-1 gap-8 px-5 py-8 md:grid-cols-[minmax(0,340px)_minmax(0,1fr)]"
        >
          <motion.div
            className="flex flex-col gap-3 md:sticky md:top-24 md:self-start"
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.35, ease: EASE }}
          >
            {imageDataUrl && (
              <div className="flex justify-center overflow-hidden rounded-2xl bg-gradient-to-b from-wine/5 to-wine/15 p-2 shadow-md">
                <Image
                  src={imageDataUrl}
                  alt="Captured label"
                  width={340}
                  height={453}
                  unoptimized
                  className="max-h-[38vh] w-auto rounded-xl object-contain md:max-h-[calc(100vh-11rem)]"
                />
              </div>
            )}
            <button onClick={reset} className="text-sm text-foreground/60 underline underline-offset-2">
              ← Start over
            </button>
          </motion.div>
          <div>
            <RecognitionResult result={result} onSaved={() => setStep("saved")} onRetake={reset} />
          </div>
        </motion.div>
      )}

      {step === "saved" && (
        <motion.div
          key="saved"
          {...stepMotion}
          className="mx-auto flex w-full max-w-lg flex-1 flex-col items-center justify-center gap-5 px-5 py-16 text-center"
        >
          <motion.div
            className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-3xl dark:bg-emerald-900/40"
            initial={{ scale: 0, rotate: -20 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 15, delay: 0.1 }}
          >
            ✓
          </motion.div>
          <motion.h2
            className="text-2xl font-semibold"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
          >
            Saved to your journal
          </motion.h2>
          <motion.p
            className="text-foreground/60"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.35 }}
          >
            Your wine memory is safely recorded.
          </motion.p>
          <motion.div
            className="flex flex-wrap justify-center gap-3"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.45 }}
          >
            <button onClick={reset} className="rounded-full bg-wine px-5 py-2.5 font-medium text-white">
              Add another
            </button>
            <Link
              href="/journal"
              className="rounded-full border border-black/15 px-5 py-2.5 font-medium dark:border-white/15"
            >
              View journal
            </Link>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
