import { MobileNav } from "@/components/mobile/mobile-nav"
import { MobileDashboard } from "@/components/mobile/mobile-dashboard"

export default function MobilePage() {
  return (
    <div className="min-h-screen bg-background">
      <MobileDashboard />
      <MobileNav />
    </div>
  )
}
