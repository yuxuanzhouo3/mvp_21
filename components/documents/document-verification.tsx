"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Shield, CheckCircle, FileText, Calendar, Users, Lock, Download, Share2, AlertCircle } from "lucide-react"

export function DocumentVerification() {
  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Document Verification</h1>
        <p className="text-muted-foreground">View verification details and blockchain proof</p>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Verification Status */}
          <Card className="border-accent bg-accent/5">
            <CardContent className="pt-6">
              <div className="flex items-start gap-4">
                <div className="p-3 rounded-full bg-accent/10">
                  <CheckCircle className="h-8 w-8 text-accent" />
                </div>
                <div className="flex-1">
                  <h2 className="text-2xl font-bold text-accent mb-2">Document Verified</h2>
                  <p className="text-muted-foreground mb-4">
                    This document has been cryptographically verified and stored on the blockchain. All signatures are
                    authentic and the document has not been tampered with.
                  </p>
                  <div className="flex items-center gap-2">
                    <Badge className="bg-accent/10 text-accent border-accent/20">Verified</Badge>
                    <Badge className="bg-accent/10 text-accent border-accent/20">Blockchain Secured</Badge>
                    <Badge className="bg-accent/10 text-accent border-accent/20">Legally Binding</Badge>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Document Details */}
          <Card>
            <CardContent className="pt-6">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                Document Information
              </h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between py-2 border-b border-border">
                  <span className="text-sm text-muted-foreground">Document Name</span>
                  <span className="text-sm font-medium">Service Agreement - TechBridge Inc.pdf</span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-border">
                  <span className="text-sm text-muted-foreground">Document Type</span>
                  <span className="text-sm font-medium">Service Agreement</span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-border">
                  <span className="text-sm text-muted-foreground">File Size</span>
                  <span className="text-sm font-medium">2.4 MB</span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-border">
                  <span className="text-sm text-muted-foreground">Pages</span>
                  <span className="text-sm font-medium">3</span>
                </div>
                <div className="flex items-center justify-between py-2">
                  <span className="text-sm text-muted-foreground">Document ID</span>
                  <span className="text-sm font-mono">DOC-2025-001-TBI</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Blockchain Verification */}
          <Card>
            <CardContent className="pt-6">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <Shield className="h-5 w-5 text-primary" />
                Blockchain Verification
              </h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between py-2 border-b border-border">
                  <span className="text-sm text-muted-foreground">Blockchain Network</span>
                  <span className="text-sm font-medium">Ethereum Mainnet</span>
                </div>
                <div className="flex items-start justify-between py-2 border-b border-border">
                  <span className="text-sm text-muted-foreground">Transaction Hash</span>
                  <span className="text-sm font-mono text-right break-all">
                    0x7a8f9c2d4e5b6a3c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c
                  </span>
                </div>
                <div className="flex items-start justify-between py-2 border-b border-border">
                  <span className="text-sm text-muted-foreground">Document Hash (SHA-256)</span>
                  <span className="text-sm font-mono text-right break-all">
                    3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b
                  </span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-border">
                  <span className="text-sm text-muted-foreground">Block Number</span>
                  <span className="text-sm font-medium">18,234,567</span>
                </div>
                <div className="flex items-center justify-between py-2">
                  <span className="text-sm text-muted-foreground">Timestamp</span>
                  <span className="text-sm font-medium">2025-01-05 14:32:18 UTC</span>
                </div>
              </div>
              <Button variant="outline" className="w-full mt-4 bg-transparent">
                View on Blockchain Explorer
              </Button>
            </CardContent>
          </Card>

          {/* Signature Verification */}
          <Card>
            <CardContent className="pt-6">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                Signature Verification
              </h3>
              <div className="space-y-4">
                <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/30">
                  <CheckCircle className="h-5 w-5 text-accent mt-0.5" />
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <p className="font-medium">Sarah Chen</p>
                      <Badge className="bg-accent/10 text-accent border-accent/20">Verified</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mb-1">sarah@techbridge.com</p>
                    <p className="text-xs text-muted-foreground">Signed: Jan 5, 2025 at 2:30 PM UTC</p>
                    <p className="text-xs font-mono text-muted-foreground mt-1">
                      IP: 192.168.1.100 • Location: San Francisco, USA
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/30">
                  <CheckCircle className="h-5 w-5 text-accent mt-0.5" />
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <p className="font-medium">Li Wei</p>
                      <Badge className="bg-accent/10 text-accent border-accent/20">Verified</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mb-1">liwei@dragon.cn</p>
                    <p className="text-xs text-muted-foreground">Signed: Jan 5, 2025 at 3:45 PM UTC</p>
                    <p className="text-xs font-mono text-muted-foreground mt-1">
                      IP: 123.45.67.89 • Location: Shanghai, China
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <Card>
            <CardContent className="pt-6">
              <h3 className="font-semibold mb-4">Actions</h3>
              <div className="space-y-2">
                <Button className="w-full bg-transparent" variant="outline">
                  <Download className="h-4 w-4 mr-2" />
                  Download Document
                </Button>
                <Button className="w-full bg-transparent" variant="outline">
                  <Share2 className="h-4 w-4 mr-2" />
                  Share Verification
                </Button>
                <Button className="w-full bg-transparent" variant="outline">
                  <FileText className="h-4 w-4 mr-2" />
                  Download Certificate
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <Calendar className="h-5 w-5 text-primary" />
                Timeline
              </h3>
              <div className="space-y-4">
                <div className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div className="w-2 h-2 rounded-full bg-accent" />
                    <div className="w-px h-full bg-border" />
                  </div>
                  <div className="flex-1 pb-4">
                    <p className="text-sm font-medium">Document Created</p>
                    <p className="text-xs text-muted-foreground">Jan 5, 2025 at 2:00 PM</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div className="w-2 h-2 rounded-full bg-accent" />
                    <div className="w-px h-full bg-border" />
                  </div>
                  <div className="flex-1 pb-4">
                    <p className="text-sm font-medium">First Signature</p>
                    <p className="text-xs text-muted-foreground">Jan 5, 2025 at 2:30 PM</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div className="w-2 h-2 rounded-full bg-accent" />
                    <div className="w-px h-full bg-border" />
                  </div>
                  <div className="flex-1 pb-4">
                    <p className="text-sm font-medium">Final Signature</p>
                    <p className="text-xs text-muted-foreground">Jan 5, 2025 at 3:45 PM</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div className="w-2 h-2 rounded-full bg-accent" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">Blockchain Verified</p>
                    <p className="text-xs text-muted-foreground">Jan 5, 2025 at 4:00 PM</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                <Lock className="h-5 w-5 text-primary" />
                <div>
                  <h3 className="font-semibold mb-1">Security</h3>
                  <p className="text-xs text-muted-foreground mb-3">
                    This document is protected with military-grade encryption and blockchain verification.
                  </p>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">AES-256 Encryption</span>
                      <CheckCircle className="h-4 w-4 text-accent" />
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Blockchain Hash</span>
                      <CheckCircle className="h-4 w-4 text-accent" />
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Tamper Detection</span>
                      <CheckCircle className="h-4 w-4 text-accent" />
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Audit Trail</span>
                      <CheckCircle className="h-4 w-4 text-accent" />
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-primary" />
                <div>
                  <h3 className="font-semibold mb-1 text-primary">Compliance</h3>
                  <p className="text-xs text-muted-foreground">
                    This document meets all legal requirements for electronic signatures in both the United States
                    (ESIGN Act) and China (Electronic Signature Law).
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
