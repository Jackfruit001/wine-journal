"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { CaptureButton } from "@/components/CaptureButton";
import { RecognitionResult } from "@/components/RecognitionResult";
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

  return (
    <div className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-6 px-4 py-8">
      {step === "capture" && (
        <div className="flex flex-1 flex-col items-center justify-center gap-6 text-center">
          <div>
            <h1 className="text-2xl font-semibold">Capture a wine memory</h1>
            <p className="mt-1 text-sm text-foreground/60">
              Photograph the label — we&apos;ll read it and fill in the rest.
            </p>
          </div>
          <CaptureButton onCapture={handleCapture} />
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
      )}

      {step === "reading" && (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
          {imageDataUrl && (
            <Image
              src={imageDataUrl}
              alt="Captured label"
              width={200}
              height={200}
              unoptimized
              className="max-h-64 w-auto rounded-xl object-contain shadow"
            />
          )}
          <p className="animate-pulse text-sm font-medium text-foreground/70">
            Reading the label…
          </p>
        </div>
      )}

      {step === "result" && result && (
        <div className="flex flex-col gap-4">
          {imageDataUrl && (
            <Image
              src={imageDataUrl}
              alt="Captured label"
              width={160}
              height={160}
              unoptimized
              className="mx-auto max-h-48 w-auto rounded-xl object-contain shadow"
            />
          )}
          <RecognitionResult
            result={result}
            onSaved={() => setStep("saved")}
            onRetake={reset}
          />
        </div>
      )}

      {step === "saved" && (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
          <p className="text-2xl">✅</p>
          <h2 className="text-xl font-semibold">Saved to your journal</h2>
          <div className="flex gap-3">
            <button
              onClick={reset}
              className="rounded-full bg-wine px-4 py-2 font-medium text-white"
            >
              Add another
            </button>
            <Link
              href="/journal"
              className="rounded-full border border-black/10 px-4 py-2 font-medium"
            >
              View journal
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
