"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { CaptureButton } from "@/components/CaptureButton";
import { RecognitionResult } from "@/components/RecognitionResult";
import { RecognizingExperience } from "@/components/RecognizingExperience";
import type { RecognizeResponse } from "@/lib/schema";

type Step = "capture" | "reading" | "result" | "saved";

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

  if (step === "capture") {
    return (
      <div className="mx-auto grid w-full max-w-5xl flex-1 items-center gap-10 px-5 py-10 md:grid-cols-2 md:gap-16 md:py-20">
        <div className="flex flex-col gap-6 text-center md:text-left">
          <div className="flex flex-col gap-3">
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
          </div>
          <div className="flex flex-col items-center gap-3 md:items-start">
            <CaptureButton onCapture={handleCapture} />
            {error && <p className="text-sm text-rose-600">{error}</p>}
            <Link href="/journal" className="text-sm font-medium text-foreground/60 underline underline-offset-2 hover:text-wine">
              Or browse your journal →
            </Link>
          </div>
        </div>

        <div className="hidden md:flex md:flex-col md:gap-4">
          {[
            { icon: "📷", title: "Read", body: "A vision model extracts producer, vintage, region, grape and more." },
            { icon: "🔎", title: "Verify", body: "We cross-check it against 130,000 real wines — an independent second opinion." },
            { icon: "✍️", title: "Journal", body: "Auto-filled, fully editable, with one-tap tasting notes." },
          ].map((c) => (
            <div key={c.title} className="flex gap-4 rounded-2xl border border-black/5 bg-white/50 p-4 dark:border-white/10 dark:bg-white/5">
              <span className="text-2xl">{c.icon}</span>
              <div>
                <p className="font-medium">{c.title}</p>
                <p className="text-sm text-foreground/60">{c.body}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (step === "reading") {
    return (
      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-5">
        <RecognizingExperience imageDataUrl={imageDataUrl} />
      </div>
    );
  }

  if (step === "result" && result) {
    return (
      <div className="mx-auto grid w-full max-w-5xl flex-1 gap-8 px-5 py-8 md:grid-cols-[minmax(0,340px)_minmax(0,1fr)]">
        <div className="flex flex-col gap-3 md:sticky md:top-24 md:self-start">
          {imageDataUrl && (
            <Image
              src={imageDataUrl}
              alt="Captured label"
              width={340}
              height={420}
              unoptimized
              className="w-full rounded-2xl object-contain shadow-md"
            />
          )}
          <button onClick={reset} className="text-sm text-foreground/60 underline underline-offset-2">
            ← Start over
          </button>
        </div>
        <div>
          <RecognitionResult result={result} onSaved={() => setStep("saved")} onRetake={reset} />
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-lg flex-1 flex-col items-center justify-center gap-5 px-5 py-16 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-3xl dark:bg-emerald-900/40">
        ✓
      </div>
      <h2 className="text-2xl font-semibold">Saved to your journal</h2>
      <p className="text-foreground/60">Your wine memory is safely recorded.</p>
      <div className="flex flex-wrap justify-center gap-3">
        <button onClick={reset} className="rounded-full bg-wine px-5 py-2.5 font-medium text-white">
          Add another
        </button>
        <Link href="/journal" className="rounded-full border border-black/15 px-5 py-2.5 font-medium dark:border-white/15">
          View journal
        </Link>
      </div>
    </div>
  );
}
