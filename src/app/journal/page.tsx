import { JournalList } from "@/components/JournalList";

export default function JournalPage() {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-5 py-8">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Your journal</h1>
        <p className="mt-1 text-sm text-foreground/60">Every wine you&apos;ve captured, newest first.</p>
      </div>
      <JournalList />
    </div>
  );
}
