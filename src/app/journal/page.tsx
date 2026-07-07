import { JournalList } from "@/components/JournalList";

export default function JournalPage() {
  return (
    <div className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-4 px-4 py-8">
      <h1 className="text-2xl font-semibold">Your journal</h1>
      <JournalList />
    </div>
  );
}
