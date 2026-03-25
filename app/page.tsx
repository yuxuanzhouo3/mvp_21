import { EntryHero } from "@/components/home/entry-hero";
import { PublicEntryShell } from "@/components/layout/public-entry-shell";

export default function HomePage() {
  return (
    <PublicEntryShell>
      <EntryHero />
    </PublicEntryShell>
  );
}
