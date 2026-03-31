/* eslint-disable react/no-unescaped-entities */

import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { FileText, Users, Shield, CheckCircle, Send } from "lucide-react"

export function ReviewAndSend() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">Review & Send</h2>
        <p className="text-muted-foreground">Review all details before sending the contract for signatures</p>
      </div>

      <div className="space-y-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <div className="p-2 rounded-lg bg-primary/10">
                <FileText className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold mb-1">Contract Details</h3>
                <div className="space-y-1 text-sm text-muted-foreground">
                  <p>Title: Service Agreement</p>
                  <p>Template: Service Agreement</p>
                  <p>Pages: 3</p>
                </div>
              </div>
              <CheckCircle className="h-5 w-5 text-accent" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <div className="p-2 rounded-lg bg-primary/10">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold mb-1">Signing Parties</h3>
                <div className="space-y-2 text-sm text-muted-foreground">
                  <div className="flex items-center justify-between">
                    <span>Sarah Chen (sarah@techbridge.com)</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-muted">USA</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Li Wei (liwei@dragon.cn)</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-muted">China</span>
                  </div>
                </div>
              </div>
              <CheckCircle className="h-5 w-5 text-accent" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <div className="p-2 rounded-lg bg-primary/10">
                <Shield className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold mb-1">Security Settings</h3>
                <div className="space-y-1 text-sm text-muted-foreground">
                  <p>Authentication: Required</p>
                  <p>Signing Order: Any Order</p>
                  <p>Email Reminders: Enabled</p>
                  <p>Blockchain Verification: Enabled</p>
                </div>
              </div>
              <CheckCircle className="h-5 w-5 text-accent" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="p-4 rounded-lg bg-accent/10 border border-accent/20">
        <div className="flex items-start gap-3">
          <CheckCircle className="h-5 w-5 text-accent mt-0.5" />
          <div>
            <h4 className="font-semibold text-accent mb-1">Ready to Send</h4>
            <p className="text-sm text-muted-foreground">
              All parties will receive an email with a secure link to review and sign the contract. You'll be notified
              when each party signs.
            </p>
          </div>
        </div>
      </div>

      <Button className="w-full" size="lg">
        <Send className="h-4 w-4 mr-2" />
        Send Contract for Signatures
      </Button>
    </div>
  )
}
