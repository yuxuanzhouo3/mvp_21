import { ContractCreationWizard } from "@/components/contracts/contract-creation-wizard"
import { DashboardHeader } from "@/components/dashboard/dashboard-header"

export default function NewContractPage() {
  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader />
      <main className="container px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-bold mb-2">Create New Contract</h1>
            <p className="text-muted-foreground">Follow the steps to create and send your contract for signature</p>
          </div>
          <ContractCreationWizard />
        </div>
      </main>
    </div>
  )
}
