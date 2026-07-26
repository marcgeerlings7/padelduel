import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-12 sm:px-8">
      <h1 className="text-2xl font-bold">Padel Ladder</h1>
      <p className="text-sm text-black/70 dark:text-white/70">
        Vereniging-onafhankelijke ranked ladder voor padel-duo&apos;s. Speel met meerdere vaste
        partners, klim samen de ladder van je regio op.
      </p>
      <div className="flex flex-wrap gap-4">
        <Link
          href="/ladder"
          className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white dark:bg-white dark:text-black"
        >
          Bekijk de ladder
        </Link>
        <Link
          href="/dashboard"
          className="rounded-md border border-black/20 px-4 py-2 text-sm font-medium dark:border-white/30"
        >
          Mijn dashboard
        </Link>
      </div>
    </main>
  );
}
