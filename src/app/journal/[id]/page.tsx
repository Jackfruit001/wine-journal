import Link from "next/link";
import { EntryDetail } from "@/components/EntryDetail";

export default async function EntryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <div className="mx-auto w-full max-w-5xl flex-1 px-5 py-8">
      <Link
        href="/journal"
        className="mb-6 inline-block text-sm font-medium text-foreground/60 underline underline-offset-2 hover:text-wine"
      >
        ← Back to journal
      </Link>
      <EntryDetail id={id} />
    </div>
  );
}
