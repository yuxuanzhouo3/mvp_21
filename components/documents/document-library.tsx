"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  FileText,
  Search,
  Filter,
  Download,
  Eye,
  Share2,
  MoreVertical,
  Upload,
  Shield,
  CheckCircle,
} from "lucide-react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useLanguage } from "@/components/language-provider"

const documents = [
  {
    id: 1,
    name: "Service Agreement - TechBridge Inc.pdf",
    size: "2.4 MB",
    uploaded: "2025-01-05",
    verified: true,
    blockchain: "0x7a8f9c2d...",
    type: "contract",
  },
  {
    id: 2,
    name: "Non-Disclosure Agreement.pdf",
    size: "1.8 MB",
    uploaded: "2025-01-08",
    verified: true,
    blockchain: "0x3b4e5f6a...",
    type: "contract",
  },
  {
    id: 3,
    name: "Partnership Agreement.pdf",
    size: "3.2 MB",
    uploaded: "2025-01-10",
    verified: false,
    blockchain: null,
    type: "draft",
  },
  {
    id: 4,
    name: "供应商合同.pdf",
    size: "2.1 MB",
    uploaded: "2025-01-03",
    verified: true,
    blockchain: "0x9d8c7b6a...",
    type: "contract",
  },
  {
    id: 5,
    name: "Employment Contract.pdf",
    size: "1.5 MB",
    uploaded: "2025-01-09",
    verified: true,
    blockchain: "0x4e5f6a7b...",
    type: "contract",
  },
]

export function DocumentLibrary() {
  const { language } = useLanguage()
  const isEn = language === "en"

  const typeLabels = {
    contract: isEn ? "Contract" : "合同",
    draft: isEn ? "Draft" : "草稿",
  } as const

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>{isEn ? "Document Library" : "文档库"}</CardTitle>
          <Button>
            <Upload className="h-4 w-4 mr-2" />
            {isEn ? "Upload Document" : "上传文档"}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder={isEn ? "Search documents..." : "搜索文档..."} className="pl-9" />
          </div>
          <Select defaultValue="all">
            <SelectTrigger className="w-full md:w-40">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{isEn ? "All Types" : "全部类型"}</SelectItem>
              <SelectItem value="contract">{isEn ? "Contracts" : "合同"}</SelectItem>
              <SelectItem value="draft">{isEn ? "Drafts" : "草稿"}</SelectItem>
              <SelectItem value="verified">{isEn ? "Verified" : "已验证"}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-3">
          {documents.map((doc) => (
            <div
              key={doc.id}
              className="flex flex-col gap-3 rounded-lg border border-border p-4 transition-colors hover:border-primary/50 md:flex-row md:items-center md:justify-between"
            >
              <div className="flex items-center gap-4 flex-1 min-w-0">
                <div className="p-2 rounded-lg bg-muted">
                  <FileText className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-medium truncate">{doc.name}</h4>
                    {doc.verified && (
                      <div className="flex items-center gap-1 text-accent">
                        <Shield className="h-4 w-4" />
                        <CheckCircle className="h-4 w-4" />
                      </div>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                    <span>{doc.size}</span>
                    <span>•</span>
                    <span>{doc.uploaded}</span>
                    {doc.blockchain && (
                      <>
                        <span>•</span>
                        <span className="max-w-full truncate font-mono text-xs sm:max-w-[220px]">
                          {isEn ? "Hash" : "哈希"}: {doc.blockchain}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex w-full items-center justify-between gap-3 md:w-auto md:justify-end">
                <Badge
                  variant={doc.verified ? "default" : "secondary"}
                  className={doc.verified ? "bg-accent/10 text-accent border-accent/20" : ""}
                >
                  {typeLabels[doc.type as keyof typeof typeLabels]}
                </Badge>

                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon">
                    <Eye className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon">
                    <Download className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon">
                    <Share2 className="h-4 w-4" />
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem>{isEn ? "View Details" : "查看详情"}</DropdownMenuItem>
                      <DropdownMenuItem>{isEn ? "Verify Document" : "验证文档"}</DropdownMenuItem>
                      <DropdownMenuItem>{isEn ? "Share Link" : "分享链接"}</DropdownMenuItem>
                      <DropdownMenuItem className="text-destructive">{isEn ? "Delete" : "删除"}</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
