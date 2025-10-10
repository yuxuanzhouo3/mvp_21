"use client"

import { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { FileText, Check, Globe } from "lucide-react"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"

const templates = [
  {
    id: 1,
    name: "Service Agreement",
    description: "Professional services contract for B2B relationships",
    region: "both",
    popular: true,
  },
  {
    id: 2,
    name: "Non-Disclosure Agreement",
    description: "Protect confidential information and trade secrets",
    region: "both",
    popular: true,
  },
  {
    id: 3,
    name: "Employment Contract",
    description: "Standard employment agreement with terms and conditions",
    region: "us",
    popular: false,
  },
  {
    id: 4,
    name: "供应商合同 (Supplier Contract)",
    description: "供应商服务协议模板",
    region: "cn",
    popular: true,
  },
  {
    id: 5,
    name: "Partnership Agreement",
    description: "Define terms for business partnerships",
    region: "both",
    popular: false,
  },
  {
    id: 6,
    name: "租赁合同 (Lease Agreement)",
    description: "商业或住宅租赁协议",
    region: "cn",
    popular: false,
  },
]

export function TemplateSelection() {
  const [selectedTemplate, setSelectedTemplate] = useState<number | null>(null)
  const [region, setRegion] = useState<"all" | "us" | "cn">("all")

  const filteredTemplates = templates.filter((t) => region === "all" || t.region === region || t.region === "both")

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">Choose a Template</h2>
        <p className="text-muted-foreground">Select a contract template to get started or create from scratch</p>
      </div>

      <Tabs defaultValue="all" className="w-full" onValueChange={(v) => setRegion(v as "all" | "us" | "cn")}>
        <TabsList>
          <TabsTrigger value="all">All Templates</TabsTrigger>
          <TabsTrigger value="us">
            <Globe className="h-4 w-4 mr-2" />
            USA
          </TabsTrigger>
          <TabsTrigger value="cn">
            <Globe className="h-4 w-4 mr-2" />
            China
          </TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="grid md:grid-cols-2 gap-4">
        {filteredTemplates.map((template) => (
          <Card
            key={template.id}
            className={`cursor-pointer transition-all hover:border-primary/50 ${
              selectedTemplate === template.id ? "border-primary ring-2 ring-primary/20" : ""
            }`}
            onClick={() => setSelectedTemplate(template.id)}
          >
            <CardContent className="pt-6">
              <div className="flex items-start justify-between mb-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <FileText className="h-5 w-5 text-primary" />
                </div>
                {selectedTemplate === template.id && (
                  <div className="p-1 rounded-full bg-primary">
                    <Check className="h-4 w-4 text-primary-foreground" />
                  </div>
                )}
              </div>
              <h3 className="font-semibold mb-1 flex items-center gap-2">
                {template.name}
                {template.popular && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-accent/10 text-accent">Popular</span>
                )}
              </h3>
              <p className="text-sm text-muted-foreground">{template.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="pt-4 border-t border-border">
        <Button variant="outline" className="w-full bg-transparent">
          <FileText className="h-4 w-4 mr-2" />
          Start from Blank Document
        </Button>
      </div>
    </div>
  )
}
