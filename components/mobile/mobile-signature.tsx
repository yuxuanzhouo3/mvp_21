"use client"

import { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { FileText, ArrowLeft, CheckCircle, Shield, Pen, Type, Upload } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import Link from "next/link"

export function MobileSignature() {
  const [signed, setSigned] = useState(false)
  const [signMethod, setSignMethod] = useState("draw")

  if (signed) {
    return (
      <div className="min-h-screen flex flex-col">
        {/* Header */}
        <div className="sticky top-0 z-40 bg-background border-b border-border">
          <div className="px-4 py-4">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" asChild>
                <Link href="/mobile/contracts">
                  <ArrowLeft className="h-5 w-5" />
                </Link>
              </Button>
              <h1 className="text-xl font-bold">Sign Contract</h1>
            </div>
          </div>
        </div>

        {/* Success Message */}
        <div className="flex-1 flex items-center justify-center p-4">
          <Card className="border-accent bg-accent/5 w-full">
            <CardContent className="pt-6 pb-6">
              <div className="text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-accent/10 mb-4">
                  <CheckCircle className="h-8 w-8 text-accent" />
                </div>
                <h2 className="text-2xl font-bold text-accent mb-2">Contract Signed!</h2>
                <p className="text-muted-foreground mb-6">
                  Your signature has been recorded and verified. You'll receive a copy via email.
                </p>
                <Button className="w-full" asChild>
                  <Link href="/mobile/contracts">Back to Contracts</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-background border-b border-border">
        <div className="px-4 py-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" asChild>
              <Link href="/mobile/contracts">
                <ArrowLeft className="h-5 w-5" />
              </Link>
            </Button>
            <h1 className="text-xl font-bold">Sign Contract</h1>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto pb-4">
        {/* Document Info */}
        <div className="px-4 py-4">
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <FileText className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold mb-1">Service Agreement</h3>
                  <p className="text-sm text-muted-foreground mb-2">TechBridge Inc. & Dragon Enterprises</p>
                  <Badge className="bg-accent/10 text-accent border-accent/20">Ready to Sign</Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Document Preview */}
        <div className="px-4 pb-4">
          <Card>
            <CardContent className="pt-4 pb-4">
              <h3 className="font-semibold mb-3">Document Preview</h3>
              <div className="border border-border rounded-lg p-4 bg-muted/30 max-h-48 overflow-y-auto">
                <div className="text-sm space-y-2">
                  <p className="font-semibold">SERVICE AGREEMENT</p>
                  <p className="text-muted-foreground text-xs">
                    This Service Agreement is entered into as of January 10, 2025 by and between TechBridge Inc. and
                    Dragon Enterprises...
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Signature Section */}
        <div className="px-4 pb-4">
          <Card>
            <CardContent className="pt-4 pb-4">
              <h3 className="font-semibold mb-4">Add Your Signature</h3>

              <Tabs value={signMethod} onValueChange={setSignMethod} className="w-full">
                <TabsList className="grid w-full grid-cols-3 mb-4">
                  <TabsTrigger value="draw" className="text-xs">
                    <Pen className="h-4 w-4 mr-1" />
                    Draw
                  </TabsTrigger>
                  <TabsTrigger value="type" className="text-xs">
                    <Type className="h-4 w-4 mr-1" />
                    Type
                  </TabsTrigger>
                  <TabsTrigger value="upload" className="text-xs">
                    <Upload className="h-4 w-4 mr-1" />
                    Upload
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="draw">
                  <div className="border-2 border-dashed border-border rounded-lg p-4 bg-muted/30 h-40 flex items-center justify-center">
                    <p className="text-sm text-muted-foreground">Draw your signature here</p>
                  </div>
                </TabsContent>

                <TabsContent value="type">
                  <div className="space-y-3">
                    <Input placeholder="Type your full name" className="text-lg font-serif" />
                    <div className="border border-border rounded-lg p-4 bg-muted/30 text-center">
                      <p className="text-2xl font-serif">John Smith</p>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="upload">
                  <div className="border-2 border-dashed border-border rounded-lg p-8 bg-muted/30 text-center">
                    <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground mb-2">Upload signature image</p>
                    <Button variant="outline" size="sm">
                      Choose File
                    </Button>
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>

        {/* Security Info */}
        <div className="px-4 pb-4">
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-start gap-3">
                <Shield className="h-5 w-5 text-primary mt-0.5" />
                <div>
                  <h4 className="font-semibold text-primary mb-1">Secure & Legal</h4>
                  <p className="text-xs text-muted-foreground">
                    Your signature is encrypted and legally binding under US and China electronic signature laws.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Fixed Bottom Button */}
      <div className="sticky bottom-0 bg-background border-t border-border p-4">
        <Button className="w-full" size="lg" onClick={() => setSigned(true)}>
          <CheckCircle className="h-5 w-5 mr-2" />
          Sign Contract
        </Button>
        <p className="text-xs text-center text-muted-foreground mt-2">
          By signing, you agree to the terms and conditions
        </p>
      </div>
    </div>
  )
}
