import { SignatureInterface } from "@/components/contracts/signature-interface"
import { FileText } from "lucide-react"
import Link from "next/link"

export default function SignContractPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-background">
        <nav className="container flex h-16 items-center px-4">
          <Link href="/" className="flex items-center gap-2">
            <FileText className="h-6 w-6 text-primary" />
            <span className="text-xl font-semibold">ContractHub</span>
          </Link>
        </nav>
      </header>
      <main className="container px-4 py-8">
        <SignatureInterface />
      </main>
    </div>
  )
}
