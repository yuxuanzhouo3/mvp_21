import { DashboardHeader } from "@/components/dashboard/dashboard-header"
import { DocumentLibrary } from "@/components/documents/document-library"
import { StorageStats } from "@/components/documents/storage-stats"

export default function DocumentsPage() {
  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader />
      <main className="container px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Document Storage</h1>
          <p className="text-muted-foreground">Securely store and manage all your contract documents</p>
        </div>
        <StorageStats />
        <div className="mt-8">
          <DocumentLibrary />
        </div>
      </main>
    </div>
  )
}
