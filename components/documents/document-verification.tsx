"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Shield, CheckCircle, FileText, Calendar, Users, Lock, Download, Share2, AlertCircle } from "lucide-react"
import { useLanguage } from "@/components/language-provider"

export function DocumentVerification() {
  const { language } = useLanguage()
  const isEn = language === "en"

  return (
    <div className="mx-auto max-w-5xl">
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card className="border-accent bg-accent/5">
            <CardContent className="pt-6">
              <div className="flex items-start gap-4">
                <div className="p-3 rounded-full bg-accent/10">
                  <CheckCircle className="h-8 w-8 text-accent" />
                </div>
                <div className="flex-1">
                  <h2 className="text-2xl font-bold text-accent mb-2">
                    {isEn ? "Document Verified" : "文档已验证"}
                  </h2>
                  <p className="text-muted-foreground mb-4">
                    {isEn
                      ? "This document has been cryptographically verified and stored on the blockchain. All signatures are authentic and the document has not been tampered with."
                      : "该文档已完成密码学验证并上链存证。全部签名真实有效，文档内容未被篡改。"}
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge className="bg-accent/10 text-accent border-accent/20">
                      {isEn ? "Verified" : "已验证"}
                    </Badge>
                    <Badge className="bg-accent/10 text-accent border-accent/20">
                      {isEn ? "Blockchain Secured" : "区块链存证"}
                    </Badge>
                    <Badge className="bg-accent/10 text-accent border-accent/20">
                      {isEn ? "Legally Binding" : "法律有效"}
                    </Badge>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                {isEn ? "Document Information" : "文档信息"}
              </h3>
              <div className="space-y-3">
                <div className="flex flex-col gap-1 border-b border-border py-2 sm:flex-row sm:items-center sm:justify-between">
                  <span className="text-sm text-muted-foreground">{isEn ? "Document Name" : "文档名称"}</span>
                  <span className="text-sm font-medium break-words">Service Agreement - TechBridge Inc.pdf</span>
                </div>
                <div className="flex flex-col gap-1 border-b border-border py-2 sm:flex-row sm:items-center sm:justify-between">
                  <span className="text-sm text-muted-foreground">{isEn ? "Document Type" : "文档类型"}</span>
                  <span className="text-sm font-medium">{isEn ? "Service Agreement" : "服务协议"}</span>
                </div>
                <div className="flex flex-col gap-1 border-b border-border py-2 sm:flex-row sm:items-center sm:justify-between">
                  <span className="text-sm text-muted-foreground">{isEn ? "File Size" : "文件大小"}</span>
                  <span className="text-sm font-medium">2.4 MB</span>
                </div>
                <div className="flex flex-col gap-1 border-b border-border py-2 sm:flex-row sm:items-center sm:justify-between">
                  <span className="text-sm text-muted-foreground">{isEn ? "Pages" : "页数"}</span>
                  <span className="text-sm font-medium">3</span>
                </div>
                <div className="flex flex-col gap-1 py-2 sm:flex-row sm:items-center sm:justify-between">
                  <span className="text-sm text-muted-foreground">{isEn ? "Document ID" : "文档编号"}</span>
                  <span className="text-sm font-mono">DOC-2025-001-TBI</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <Shield className="h-5 w-5 text-primary" />
                {isEn ? "Blockchain Verification" : "区块链验证"}
              </h3>
              <div className="space-y-3">
                <div className="flex flex-col gap-1 border-b border-border py-2 sm:flex-row sm:items-center sm:justify-between">
                  <span className="text-sm text-muted-foreground">{isEn ? "Blockchain Network" : "区块链网络"}</span>
                  <span className="text-sm font-medium">Ethereum Mainnet</span>
                </div>
                <div className="flex flex-col gap-1 border-b border-border py-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                  <span className="text-sm text-muted-foreground">{isEn ? "Transaction Hash" : "交易哈希"}</span>
                  <span className="max-w-full text-sm font-mono break-all sm:max-w-[70%] sm:text-right">
                    0x7a8f9c2d4e5b6a3c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c
                  </span>
                </div>
                <div className="flex flex-col gap-1 border-b border-border py-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                  <span className="text-sm text-muted-foreground">{isEn ? "Document Hash (SHA-256)" : "文档哈希 (SHA-256)"}</span>
                  <span className="max-w-full text-sm font-mono break-all sm:max-w-[70%] sm:text-right">
                    3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b
                  </span>
                </div>
                <div className="flex flex-col gap-1 border-b border-border py-2 sm:flex-row sm:items-center sm:justify-between">
                  <span className="text-sm text-muted-foreground">{isEn ? "Block Number" : "区块高度"}</span>
                  <span className="text-sm font-medium">18,234,567</span>
                </div>
                <div className="flex flex-col gap-1 py-2 sm:flex-row sm:items-center sm:justify-between">
                  <span className="text-sm text-muted-foreground">{isEn ? "Timestamp" : "时间戳"}</span>
                  <span className="text-sm font-medium">2025-01-05 14:32:18 UTC</span>
                </div>
              </div>
              <Button variant="outline" className="w-full mt-4 bg-transparent">
                {isEn ? "View on Blockchain Explorer" : "在区块浏览器中查看"}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                {isEn ? "Signature Verification" : "签名验证"}
              </h3>
              <div className="space-y-4">
                <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/30">
                  <CheckCircle className="h-5 w-5 text-accent mt-0.5" />
                  <div className="flex-1">
                    <div className="mb-1 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                      <p className="font-medium">Sarah Chen</p>
                      <Badge className="bg-accent/10 text-accent border-accent/20">{isEn ? "Verified" : "已验证"}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mb-1">sarah@techbridge.com</p>
                    <p className="text-xs text-muted-foreground">
                      {isEn ? "Signed: Jan 5, 2025 at 2:30 PM UTC" : "签署时间：2025 年 1 月 5 日 14:30 UTC"}
                    </p>
                    <p className="text-xs font-mono text-muted-foreground mt-1">
                      {isEn ? "IP: 192.168.1.100 • Location: San Francisco, USA" : "IP：192.168.1.100 • 地点：美国旧金山"}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/30">
                  <CheckCircle className="h-5 w-5 text-accent mt-0.5" />
                  <div className="flex-1">
                    <div className="mb-1 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                      <p className="font-medium">Li Wei</p>
                      <Badge className="bg-accent/10 text-accent border-accent/20">{isEn ? "Verified" : "已验证"}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mb-1">liwei@dragon.cn</p>
                    <p className="text-xs text-muted-foreground">
                      {isEn ? "Signed: Jan 5, 2025 at 3:45 PM UTC" : "签署时间：2025 年 1 月 5 日 15:45 UTC"}
                    </p>
                    <p className="text-xs font-mono text-muted-foreground mt-1">
                      {isEn ? "IP: 123.45.67.89 • Location: Shanghai, China" : "IP：123.45.67.89 • 地点：中国上海"}
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardContent className="pt-6">
              <h3 className="font-semibold mb-4">{isEn ? "Actions" : "操作"}</h3>
              <div className="space-y-2">
                <Button className="w-full bg-transparent" variant="outline">
                  <Download className="h-4 w-4 mr-2" />
                  {isEn ? "Download Document" : "下载文档"}
                </Button>
                <Button className="w-full bg-transparent" variant="outline">
                  <Share2 className="h-4 w-4 mr-2" />
                  {isEn ? "Share Verification" : "分享验证结果"}
                </Button>
                <Button className="w-full bg-transparent" variant="outline">
                  <FileText className="h-4 w-4 mr-2" />
                  {isEn ? "Download Certificate" : "下载证书"}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <Calendar className="h-5 w-5 text-primary" />
                {isEn ? "Timeline" : "时间线"}
              </h3>
              <div className="space-y-4">
                <div className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div className="w-2 h-2 rounded-full bg-accent" />
                    <div className="w-px h-full bg-border" />
                  </div>
                  <div className="flex-1 pb-4">
                    <p className="text-sm font-medium">{isEn ? "Document Created" : "文档创建"}</p>
                    <p className="text-xs text-muted-foreground">{isEn ? "Jan 5, 2025 at 2:00 PM" : "2025 年 1 月 5 日 14:00"}</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div className="w-2 h-2 rounded-full bg-accent" />
                    <div className="w-px h-full bg-border" />
                  </div>
                  <div className="flex-1 pb-4">
                    <p className="text-sm font-medium">{isEn ? "First Signature" : "首次签署"}</p>
                    <p className="text-xs text-muted-foreground">{isEn ? "Jan 5, 2025 at 2:30 PM" : "2025 年 1 月 5 日 14:30"}</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div className="w-2 h-2 rounded-full bg-accent" />
                    <div className="w-px h-full bg-border" />
                  </div>
                  <div className="flex-1 pb-4">
                    <p className="text-sm font-medium">{isEn ? "Final Signature" : "最终签署"}</p>
                    <p className="text-xs text-muted-foreground">{isEn ? "Jan 5, 2025 at 3:45 PM" : "2025 年 1 月 5 日 15:45"}</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div className="w-2 h-2 rounded-full bg-accent" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">{isEn ? "Blockchain Verified" : "区块链验证完成"}</p>
                    <p className="text-xs text-muted-foreground">{isEn ? "Jan 5, 2025 at 4:00 PM" : "2025 年 1 月 5 日 16:00"}</p>
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
                  <h3 className="font-semibold mb-1">{isEn ? "Security" : "安全"}</h3>
                  <p className="text-xs text-muted-foreground mb-3">
                    {isEn
                      ? "This document is protected with military-grade encryption and blockchain verification."
                      : "该文档采用军工级加密与区块链验证机制进行保护。"}
                  </p>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-3 text-xs">
                      <span className="text-muted-foreground">AES-256 {isEn ? "Encryption" : "加密"}</span>
                      <CheckCircle className="h-4 w-4 text-accent" />
                    </div>
                    <div className="flex items-center justify-between gap-3 text-xs">
                      <span className="text-muted-foreground">{isEn ? "Blockchain Hash" : "区块链哈希"}</span>
                      <CheckCircle className="h-4 w-4 text-accent" />
                    </div>
                    <div className="flex items-center justify-between gap-3 text-xs">
                      <span className="text-muted-foreground">{isEn ? "Tamper Detection" : "防篡改检测"}</span>
                      <CheckCircle className="h-4 w-4 text-accent" />
                    </div>
                    <div className="flex items-center justify-between gap-3 text-xs">
                      <span className="text-muted-foreground">{isEn ? "Audit Trail" : "审计追踪"}</span>
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
                  <h3 className="font-semibold mb-1 text-primary">{isEn ? "Compliance" : "合规说明"}</h3>
                  <p className="text-xs text-muted-foreground">
                    {isEn
                      ? "This document meets all legal requirements for electronic signatures in both the United States (ESIGN Act) and China (Electronic Signature Law)."
                      : "该文档符合美国《ESIGN 法案》与中国《电子签名法》对电子签署的法律要求。"}
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
