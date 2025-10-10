"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"
import { Plus, X, User, Mail, Building, Globe } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface Party {
  id: number
  name: string
  email: string
  company: string
  region: string
}

export function AddParties() {
  const [parties, setParties] = useState<Party[]>([{ id: 1, name: "", email: "", company: "", region: "us" }])

  const addParty = () => {
    setParties([...parties, { id: Date.now(), name: "", email: "", company: "", region: "us" }])
  }

  const removeParty = (id: number) => {
    setParties(parties.filter((p) => p.id !== id))
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">Add Signing Parties</h2>
        <p className="text-muted-foreground">Add all parties who need to sign this contract</p>
      </div>

      <div className="space-y-4">
        {parties.map((party, index) => (
          <Card key={party.id}>
            <CardContent className="pt-6">
              <div className="flex items-start justify-between mb-4">
                <h3 className="font-semibold flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Party {index + 1}
                </h3>
                {parties.length > 1 && (
                  <Button variant="ghost" size="sm" onClick={() => removeParty(party.id)}>
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor={`name-${party.id}`}>Full Name</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input id={`name-${party.id}`} placeholder="John Smith" className="pl-9" />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor={`email-${party.id}`}>Email Address</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input id={`email-${party.id}`} type="email" placeholder="john@company.com" className="pl-9" />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor={`company-${party.id}`}>Company</Label>
                  <div className="relative">
                    <Building className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input id={`company-${party.id}`} placeholder="Company Name" className="pl-9" />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor={`region-${party.id}`}>Region</Label>
                  <Select defaultValue="us">
                    <SelectTrigger id={`region-${party.id}`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="us">
                        <div className="flex items-center gap-2">
                          <Globe className="h-4 w-4" />
                          United States
                        </div>
                      </SelectItem>
                      <SelectItem value="cn">
                        <div className="flex items-center gap-2">
                          <Globe className="h-4 w-4" />
                          China
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Button variant="outline" onClick={addParty} className="w-full bg-transparent">
        <Plus className="h-4 w-4 mr-2" />
        Add Another Party
      </Button>
    </div>
  )
}
