import { MobileNav } from "@/components/mobile/mobile-nav"
import { MobileContractList } from "@/components/mobile/mobile-contract-list"

export default function MobileContractsPage() {
  return (
    <div className="min-h-screen bg-background">
      <MobileContractList />
      <MobileNav />
    </div>
  )
}
