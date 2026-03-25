"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Bold, Italic, List, AlignLeft, Download } from "lucide-react"

export function ContractEditor() {
  const [title, setTitle] = useState("Service Agreement")

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">Edit Contract</h2>
        <p className="text-muted-foreground">Customize the contract content and terms</p>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="title">Contract Title</Label>
          <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>

        <div className="space-y-2">
          <Label>Contract Content</Label>
          <div className="border border-border rounded-lg">
            {/* Toolbar */}
            <div className="flex items-center gap-2 p-2 border-b border-border bg-muted/30">
              <Button variant="ghost" size="sm">
                <Bold className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="sm">
                <Italic className="h-4 w-4" />
              </Button>
              <div className="w-px h-6 bg-border" />
              <Button variant="ghost" size="sm">
                <List className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="sm">
                <AlignLeft className="h-4 w-4" />
              </Button>
              <div className="flex-1" />
              <Button variant="ghost" size="sm">
                <Download className="h-4 w-4" />
              </Button>
            </div>

            {/* Editor */}
            <Textarea
              className="min-h-[400px] border-0 focus-visible:ring-0 resize-none"
              placeholder="Enter contract content..."
              defaultValue={`SERVICE AGREEMENT

This Service Agreement ("Agreement") is entered into as of [Date] by and between:

PARTY A: [Company Name]
Address: [Address]
Contact: [Contact Information]

PARTY B: [Company Name]
Address: [Address]
Contact: [Contact Information]

1. SERVICES
The Service Provider agrees to provide the following services:
[Description of services]

2. TERM
This Agreement shall commence on [Start Date] and continue until [End Date].

3. COMPENSATION
The Client agrees to pay the Service Provider [Amount] for the services rendered.

4. CONFIDENTIALITY
Both parties agree to maintain confidentiality of all proprietary information.

5. TERMINATION
Either party may terminate this Agreement with [Notice Period] written notice.

6. GOVERNING LAW
This Agreement shall be governed by the laws of [Jurisdiction].`}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
