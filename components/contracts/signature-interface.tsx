"use client"

/* eslint-disable react/no-unescaped-entities */

import { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { CheckCircle, Download, FileText, Shield } from "lucide-react"
import { SignaturePad } from "./signature-pad"
import { useLanguage } from "@/components/language-provider"

export function SignatureInterface() {
  const { language } = useLanguage()
  const isEn = language === "en"
  const [signed, setSigned] = useState(false)

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold mb-2">{isEn ? "Sign Contract" : "签署合同"}</h1>
        <p className="text-muted-foreground">{isEn ? "Review the contract and add your signature" : "请先审阅合同并完成签名"}</p>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardContent className="pt-6">
              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <FileText className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold">{isEn ? "Service Agreement" : "服务协议"}</h3>
                    <p className="text-sm text-muted-foreground">
                      {isEn ? "3 pages • Last updated Jan 10, 2025" : "3 页 • 最后更新于 2025-01-10"}
                    </p>
                  </div>
                </div>
                <Button variant="outline" size="sm" className="w-full sm:w-auto">
                  <Download className="h-4 w-4 mr-2" />
                  {isEn ? "Download" : "下载"}
                </Button>
              </div>

              <div className="border border-border rounded-lg p-4 sm:p-6 bg-muted/30 max-h-[500px] overflow-y-auto">
                <div className="prose prose-sm max-w-none">
                  <h2 className="text-lg font-bold mb-4">SERVICE AGREEMENT</h2>
                  <p className="text-sm text-muted-foreground mb-4">
                    This Service Agreement ("Agreement") is entered into as of January 10, 2025 by and between:
                  </p>
                  <div className="mb-4">
                    <p className="text-sm font-semibold">PARTY A: TechBridge Inc.</p>
                    <p className="text-sm text-muted-foreground">Address: 123 Tech Street, San Francisco, CA 94105</p>
                    <p className="text-sm text-muted-foreground">Contact: sarah@techbridge.com</p>
                  </div>
                  <div className="mb-4">
                    <p className="text-sm font-semibold">PARTY B: Dragon Enterprises</p>
                    <p className="text-sm text-muted-foreground">Address: 456 Business Road, Shanghai, China</p>
                    <p className="text-sm text-muted-foreground">Contact: liwei@dragon.cn</p>
                  </div>
                  <h3 className="text-base font-semibold mt-6 mb-2">1. SERVICES</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    The Service Provider agrees to provide software development and consulting services as outlined in
                    the attached Statement of Work.
                  </p>
                  <h3 className="text-base font-semibold mt-6 mb-2">2. TERM</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    This Agreement shall commence on January 15, 2025 and continue for a period of 12 months.
                  </p>
                  <h3 className="text-base font-semibold mt-6 mb-2">3. COMPENSATION</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    The Client agrees to pay the Service Provider $50,000 USD for the services rendered, payable in
                    monthly installments.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {!signed && <SignaturePad onSign={() => setSigned(true)} />}

          {signed && (
            <Card className="border-accent bg-accent/5">
              <CardContent className="pt-6">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <CheckCircle className="h-6 w-6 text-accent" />
                  <div>
                    <h3 className="font-semibold text-accent">{isEn ? "Contract Signed Successfully" : "合同签署成功"}</h3>
                    <p className="text-sm text-muted-foreground">
                      {isEn
                        ? "Your signature has been recorded and verified. You'll receive a copy via email."
                        : "你的签名已记录并验证。系统将通过邮件发送副本。"}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <Card>
            <CardContent className="pt-6">
              <h3 className="font-semibold mb-4">{isEn ? "Signing Progress" : "签署进度"}</h3>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <CheckCircle className="h-5 w-5 text-accent" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">Sarah Chen</p>
                    <p className="text-xs text-muted-foreground">
                      {isEn ? "Signed on Jan 10, 2025" : "签署于 2025-01-10"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="h-5 w-5 rounded-full border-2 border-primary flex items-center justify-center">
                    <div className="h-2 w-2 rounded-full bg-primary" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">Li Wei</p>
                    <p className="text-xs text-muted-foreground">{isEn ? "Waiting for signature" : "等待签署"}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-start gap-3 mb-4">
                <Shield className="h-5 w-5 text-primary" />
                <div>
                  <h3 className="font-semibold mb-1">{isEn ? "Security" : "安全"}</h3>
                  <p className="text-xs text-muted-foreground">
                    {isEn
                      ? "This contract is protected with bank-level encryption and blockchain verification."
                      : "该合同采用银行级加密与区块链验证机制保护。"}
                  </p>
                </div>
              </div>
              <div className="space-y-2 text-xs text-muted-foreground">
                <div className="flex items-center justify-between">
                  <span>{isEn ? "Encryption" : "加密"}</span>
                  <CheckCircle className="h-4 w-4 text-accent" />
                </div>
                <div className="flex items-center justify-between">
                  <span>{isEn ? "Blockchain Hash" : "区块链哈希"}</span>
                  <CheckCircle className="h-4 w-4 text-accent" />
                </div>
                <div className="flex items-center justify-between">
                  <span>{isEn ? "Audit Trail" : "审计追踪"}</span>
                  <CheckCircle className="h-4 w-4 text-accent" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
