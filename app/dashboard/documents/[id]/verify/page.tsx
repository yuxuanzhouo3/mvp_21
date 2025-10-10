import { DashboardHeader } from "@/components/dashboard/dashboard-header"
import { DocumentVerification } from "@/components/documents/document-verification"

export default function VerifyDocumentPage() {
  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader />
      <main className="container px-4 py-8">
        <DocumentVerification />
      </main>
    </div>
  )
}
