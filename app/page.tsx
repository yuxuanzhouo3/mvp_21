import { EntryHero } from "@/components/home/entry-hero";
import { PublicEntryShell } from "@/components/layout/public-entry-shell";
import { OAuthHashBridge } from "@/components/auth/oauth-hash-bridge";

export default function HomePage() {
  return (
    <PublicEntryShell>
      <OAuthHashBridge />
      <EntryHero />
    </PublicEntryShell>
  );
}
