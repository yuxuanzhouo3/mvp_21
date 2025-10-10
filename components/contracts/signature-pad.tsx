"use client"

import { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Pen, Type, Upload, RotateCcw } from "lucide-react"

interface SignaturePadProps {
  onSign: () => void
}

export function SignaturePad({ onSign }: SignaturePadProps) {
  const [signatureMethod, setSignatureMethod] = useState("draw")

  return (
    <Card>
      <CardContent className="pt-6">
        <h3 className="font-semibold mb-4">Add Your Signature</h3>

        <Tabs value={signatureMethod} onValueChange={setSignatureMethod}>
          <TabsList className="grid w-full grid-cols-3 mb-4">
            <TabsTrigger value="draw">
              <Pen className="h-4 w-4 mr-2" />
              Draw
            </TabsTrigger>
            <TabsTrigger value="type">
              <Type className="h-4 w-4 mr-2" />
              Type
            </TabsTrigger>
            <TabsTrigger value="upload">
              <Upload className="h-4 w-4 mr-2" />
              Upload
            </TabsTrigger>
          </TabsList>

          <TabsContent value="draw">
            <div className="border-2 border-dashed border-border rounded-lg p-4 bg-muted/30 h-48 flex items-center justify-center cursor-crosshair">
              <p className="text-sm text-muted-foreground">Draw your signature here</p>
            </div>
            <div className="flex justify-end mt-2">
              <Button variant="ghost" size="sm">
                <RotateCcw className="h-4 w-4 mr-2" />
                Clear
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="type">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="typed-signature">Type your full name</Label>
                <Input id="typed-signature" placeholder="John Smith" className="text-2xl font-serif" />
              </div>
              <div className="border border-border rounded-lg p-6 bg-muted/30 text-center">
                <p className="text-3xl font-serif">John Smith</p>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="upload">
            <div className="border-2 border-dashed border-border rounded-lg p-8 bg-muted/30 text-center">
              <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm text-muted-foreground mb-2">Upload an image of your signature</p>
              <Button variant="outline" size="sm">
                Choose File
              </Button>
            </div>
          </TabsContent>
        </Tabs>

        <div className="mt-6 p-4 rounded-lg bg-muted">
          <p className="text-xs text-muted-foreground mb-3">
            By clicking "Sign Contract", I agree that this electronic signature is the legal equivalent of my manual
            signature and I consent to be legally bound by this contract.
          </p>
          <Button className="w-full" onClick={onSign}>
            Sign Contract
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
