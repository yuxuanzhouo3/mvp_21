"use client"

import { useEffect, useState, useCallback } from "react"
import Link from "next/link"
import {
  Users, Building2, Landmark, PlaySquare, Mail, Search, Plus,
  MoreHorizontal, ChevronLeft, Filter, DollarSign, Lock, X,
  Download, Clock, FileText, Cpu, Globe, Database, CheckCircle,
  Copy, Send, Calendar, ArrowRight, Check, User, Settings,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import type {
  AcquisitionBlogger,
  AcquisitionB2BLead,
  AcquisitionVCLead,
  AcquisitionAd,
  AcquisitionBootstrapData,
} from "@/lib/market/acquisition-types"

function getRegion(): "CN" | "INTL" {
  const region =
    (process.env.NEXT_PUBLIC_DEPLOYMENT_REGION ||
      process.env.NEXT_PUBLIC_APP_REGION ||
      "CN")
      .trim()
      .toUpperCase()
  return region === "INTL" ? "INTL" : "CN"
}

const isIntlRegion = getRegion() === "INTL"
const tx = (zh: string, en: string) => (isIntlRegion ? en : zh)
const mapIntlLabel = (value: string) => {
  const dict: Record<string, string> = {
    "未联系": "Not Contacted",
    "已联系": "Contacted",
    "已发邮件": "Emailed",
    "谈判中": "Negotiating",
    "已签约": "Partnered",
    "已合作": "Partnered",
    "已拒绝": "Rejected",
    "初步接触": "Initial Contact",
    "跟进中": "Following Up",
    "合同拟定": "Contract Drafting",
    "已转化": "Converted",
    "待联系": "Not Contacted",
    "深度沟通 (Pitch)": "In-depth Pitch",
    "尽职调查": "Due Diligence",
    "已投资": "Invested",
    "投放中": "Running",
    "已暂停": "Paused",
    "已下架": "Removed",
    "待审核": "Pending Review",
    "手工录入": "Manual Entry",
    "视频广告": "Video Ad",
    "互动广告": "Interactive Ad",
    "横幅图片": "Banner Image",
    "现金": "Cash",
    "积分": "Points",
    "B站": "Bilibili",
    "小红书": "Xiaohongshu",
    "抖音": "Douyin",
    "微博": "Weibo",
  }
  return isIntlRegion ? (dict[value] || value) : value
}

type TabKey = "bloggers" | "b2b" | "vc" | "ads"

// ==========================================
// Helper: Handshake icon
// ==========================================
function HandshakeIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="m11 17 2 2a1 1 0 1 0 3-3" /><path d="m14 14 2.5 2.5a1 1 0 1 0 3-3l-3.88-3.88a3 3 0 0 0-4.24 0l-.88.88a1 1 0 1 1-3-3l2.81-2.81a5.79 5.79 0 0 1 7.06-.87l.47.28a2 2 0 0 0 1.42.25L21 4" />
      <path d="m21 3-6 6" /><path d="m21 14-3 3" /><path d="m8 12-2.5-2.5a1 1 0 1 0-3 3l3.88 3.88a3 3 0 0 0 4.24 0l.88-.88a1 1 0 1 1 3 3l-2.81 2.81a5.79 5.79 0 0 1-7.06.87l-.47-.28a2 2 0 0 0-1.42-.25L3 20" />
      <path d="m3 21 6-6" /><path d="m3 10 3-3" />
    </svg>
  )
}

// ==========================================
// Helper: Status badge
// ==========================================
function StatusBadge({ status }: { status: string }) {
  let variant: "default" | "secondary" | "destructive" | "outline" = "secondary"
  if (["已签约", "已转化", "已投资", "投放中", "Partnered", "Converted", "Invested", "Running"].includes(status)) variant = "default"
  else if (["谈判中", "跟进中", "合同拟定", "深度沟通 (Pitch)", "尽职调查", "Negotiating", "Following Up", "Contract Drafting", "In-depth Pitch", "Due Diligence"].includes(status)) variant = "outline"
  return <Badge variant={variant}>{mapIntlLabel(status)}</Badge>
}

// ==========================================
// Helper: Stat card
// ==========================================
function StatCard({ title, value, icon }: { title: string; value: string | number; icon: React.ReactNode }) {
  return (
    <div className="rounded-xl border bg-background p-5 flex items-center space-x-4">
      <div className="rounded-lg border bg-muted/40 p-3">{icon}</div>
      <div>
        <div className="text-sm text-muted-foreground mb-1">{title}</div>
        <div className="text-2xl font-bold">{value}</div>
      </div>
    </div>
  )
}

// ==========================================
// Generic modal wrapper
// ==========================================
function ModalOverlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      {children}
    </div>
  )
}

// ==========================================
// Modal: Email list (for copy)
// ==========================================
function EmailListModal({ bloggers, onClose, showToast }: { bloggers: AcquisitionBlogger[]; onClose: () => void; showToast: (msg: string) => void }) {
  const emails = bloggers.filter(b => b.email).map(b => `${b.name} <${b.email}>`)
  const emailsRaw = bloggers.filter(b => b.email).map(b => b.email)
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(emailsRaw.join("; "))
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      showToast(tx("❌ 复制失败，请手动选中复制", "❌ Copy failed, please select and copy manually"))
    }
  }

  return (
    <ModalOverlay onClose={onClose}>
      <Card className="w-full max-w-md overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg flex items-center"><Mail className="mr-2 h-5 w-5 text-blue-600" /> {tx("博主邮箱列表", "Blogger Email List")}</CardTitle>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="h-4 w-4" /></Button>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">{tx("共", "Total")} {emails.length} {tx("位博主的联系邮箱：", "blogger contact emails:")}</p>
          <div className="bg-muted/50 rounded-lg p-3 space-y-2 max-h-60 overflow-y-auto">
            {emails.map((email, i) => (
              <div key={i} className="text-sm flex items-center space-x-2">
                <Mail className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                <span>{email}</span>
              </div>
            ))}
            {emails.length === 0 && <p className="text-sm text-muted-foreground">{tx("暂无博主邮箱", "No blogger emails")}</p>}
          </div>
          <div className="bg-muted/30 rounded-lg p-2">
            <p className="text-xs text-muted-foreground mb-1">{tx("纯邮箱地址（分号分隔）:", "Raw email list (semicolon separated):")}</p>
            <code className="text-xs break-all select-all">{emailsRaw.join("; ")}</code>
          </div>
        </CardContent>
        <div className="p-4 border-t flex justify-end space-x-3">
          <Button variant="outline" onClick={onClose}>{tx("关闭", "Close")}</Button>
          <Button onClick={handleCopy} disabled={emails.length === 0}>
            {copied ? <><Check className="mr-2 h-4 w-4" /> {tx("已复制", "Copied")}</> : <><Copy className="mr-2 h-4 w-4" /> {tx("复制全部邮箱", "Copy All Emails")}</>}
          </Button>
        </div>
      </Card>
    </ModalOverlay>
  )
}

// ==========================================
// Modal: Filter panel
// ==========================================
function FilterModal({ onClose, onApply }: { onClose: () => void; onApply: (filters: { platform: string; status: string }) => void }) {
  const [platform, setPlatform] = useState("")
  const [status, setStatus] = useState("")

  return (
    <ModalOverlay onClose={onClose}>
      <Card className="w-full max-w-sm overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg flex items-center"><Filter className="mr-2 h-5 w-5" /> {tx("筛选条件", "Filters")}</CardTitle>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="h-4 w-4" /></Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>{tx("平台", "Platform")}</Label>
            <Select onValueChange={setPlatform} value={platform}>
              <SelectTrigger><SelectValue placeholder={tx("全部平台", "All platforms")} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{tx("全部平台", "All platforms")}</SelectItem>
                <SelectItem value="B站">{tx("B站", "Bilibili")}</SelectItem>
                <SelectItem value="小红书">{tx("小红书", "Xiaohongshu")}</SelectItem>
                <SelectItem value="抖音">{tx("抖音", "Douyin")}</SelectItem>
                <SelectItem value="微博">{tx("微博", "Weibo")}</SelectItem>
                <SelectItem value="YouTube">YouTube</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>{tx("合作状态", "Cooperation Status")}</Label>
            <Select onValueChange={setStatus} value={status}>
              <SelectTrigger><SelectValue placeholder={tx("全部状态", "All statuses")} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{tx("全部状态", "All statuses")}</SelectItem>
                <SelectItem value="未联系">{tx("未联系", "Not Contacted")}</SelectItem>
                <SelectItem value="已发邮件">{tx("已发邮件", "Emailed")}</SelectItem>
                <SelectItem value="谈判中">{tx("谈判中", "Negotiating")}</SelectItem>
                <SelectItem value="已签约">{tx("已签约", "Partnered")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
        <div className="p-4 border-t flex justify-end space-x-3">
          <Button variant="outline" onClick={() => { setPlatform(""); setStatus(""); onApply({ platform: "", status: "" }) }}>{tx("重置", "Reset")}</Button>
          <Button onClick={() => onApply({ platform: platform === "all" ? "" : platform, status: status === "all" ? "" : status })}>
            <Check className="mr-2 h-4 w-4" /> {tx("应用筛选", "Apply Filters")}
          </Button>
        </div>
      </Card>
    </ModalOverlay>
  )
}

// ==========================================
// Modal: Status Selector (B2B / VC)
// ==========================================
function StatusSelectModal({ title, currentStatus, statuses, onClose, onConfirm }: {
  title: string
  currentStatus: string
  statuses: string[]
  onClose: () => void
  onConfirm: (newStatus: string) => void
}) {
  const [selected, setSelected] = useState(currentStatus)

  return (
    <ModalOverlay onClose={onClose}>
      <Card className="w-full max-w-sm overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">{title}</CardTitle>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="h-4 w-4" /></Button>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-sm text-muted-foreground mb-3">{tx("当前状态", "Current Status")}: <StatusBadge status={currentStatus} /></p>
          <Label>{tx("选择新状态", "Select New Status")}</Label>
          <div className="space-y-2 mt-2">
            {statuses.map((s) => (
              <button
                key={s}
                onClick={() => setSelected(s)}
                className={`w-full text-left px-4 py-3 rounded-lg border text-sm transition-colors flex items-center justify-between ${
                  selected === s
                    ? "border-primary bg-primary/5 text-primary font-medium"
                    : "border-border hover:bg-muted/50"
                }`}
              >
                <span className="flex items-center space-x-2">
                  <ArrowRight className={`h-3 w-3 ${selected === s ? "text-primary" : "text-muted-foreground"}`} />
                  <span>{mapIntlLabel(s)}</span>
                </span>
                {selected === s && <Check className="h-4 w-4 text-primary" />}
              </button>
            ))}
          </div>
        </CardContent>
        <div className="p-4 border-t flex justify-end space-x-3">
          <Button variant="outline" onClick={onClose}>{tx("取消", "Cancel")}</Button>
          <Button onClick={() => onConfirm(selected)} disabled={selected === currentStatus}>
            {tx("确认更新", "Confirm Update")}
          </Button>
        </div>
      </Card>
    </ModalOverlay>
  )
}

// ==========================================
// Modal: Email compose
// ==========================================
interface EmailComposeInfo {
  recipientName: string
  recipientEmail?: string
  companyName?: string
}

function EmailComposeModal({ info, onClose, showToast }: { info: EmailComposeInfo; onClose: () => void; showToast: (msg: string) => void }) {
  const [email, setEmail] = useState(info.recipientEmail || "")
  const [subject, setSubject] = useState(isIntlRegion ? "Partnership Opportunity — OrbitChat Team" : `关于合作 — 来自 OrbitChat 团队`)
  const [body, setBody] = useState(
    isIntlRegion
      ? `Dear ${info.recipientName},\n\nHello,\n\nWe are the OrbitChat team and are excited about a potential partnership with your organization. We would love to discuss a concrete collaboration plan in more detail.\n\nInitial proposal:\n1. \n2. \n3. \n\nLooking forward to your reply!\n\nBest regards,\nOrbitChat Team`
      : `尊敬的 ${info.recipientName}：\n\n您好！\n\n我们是 OrbitChat 团队，非常期待与贵方的合作。关于具体的合作方案，我们希望能进一步沟通。\n\n以下是我们的初步方案：\n1. \n2. \n3. \n\n期待您的回复！\n\n此致\nOrbitChat 团队`
  )

  const [sending, setSending] = useState(false)

  const handleSend = async () => {
    if (!email.trim()) {
      showToast(tx("❌ 请填写收件人邮箱地址", "❌ Please enter recipient email"))
      return
    }
    if (!subject.trim() || !body.trim()) {
      showToast(tx("❌ 请填写主题和正文", "❌ Please fill in subject and body"))
      return
    }
    setSending(true)
    try {
      const response = await fetch("/api/market/admin/acquisition", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-key": "orbitchat-admin" },
        body: JSON.stringify({ action: "send_email", to: email, subject, body }),
      })
      const json = await response.json()
      if (json.success) {
        showToast(isIntlRegion ? `✅ Email sent to ${email}` : `✅ 邮件已成功发送至 ${email}`)
      } else {
        showToast(`${tx("❌ 发送失败", "❌ Send failed")}: ${json.error || tx("未知错误", "Unknown error")}`)
      }
    } catch (err) {
      showToast(`${tx("❌ 发送失败", "❌ Send failed")}: ${err instanceof Error ? err.message : tx("网络错误", "Network error")}`)
    } finally {
      setSending(false)
    }
    onClose()
  }

  return (
    <ModalOverlay onClose={onClose}>
      <Card className="w-full max-w-lg overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg flex items-center"><Send className="mr-2 h-5 w-5 text-blue-600" /> {tx("编辑邮件", "Compose Email")}</CardTitle>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="h-4 w-4" /></Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{tx("收件人", "Recipient")}</Label>
              <Input value={info.recipientName} disabled className="bg-muted/50" />
            </div>
            {info.companyName && (
              <div className="space-y-2">
                <Label>{tx("所属公司/机构", "Company/Organization")}</Label>
                <Input value={info.companyName} disabled className="bg-muted/50" />
              </div>
            )}
          </div>
          <div className="space-y-2">
            <Label className="flex items-center space-x-1">
              <Mail className="h-3.5 w-3.5 text-muted-foreground" />
              <span>{tx("收件邮箱", "Recipient Email")} <span className="text-destructive">*</span></span>
            </Label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={tx("请输入对方邮箱地址，如 zhangsan@company.com", "Enter recipient email, e.g. john@company.com")}
              className={email ? "" : "border-yellow-400 bg-yellow-50/50 dark:bg-yellow-950/20"}
            />
            {!email && <p className="text-xs text-yellow-600">{tx("⚠️ 请确认收件人邮箱后再发送", "⚠️ Please confirm recipient email before sending")}</p>}
          </div>
          <div className="space-y-2">
            <Label>{tx("邮件主题", "Email Subject")}</Label>
            <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder={tx("请输入邮件主题", "Enter email subject")} />
          </div>
          <div className="space-y-2">
            <Label>{tx("邮件内容", "Email Body")}</Label>
            <Textarea value={body} onChange={(e) => setBody(e.target.value)} className="min-h-[200px]" placeholder={tx("请输入邮件正文...", "Enter email content...")} />
          </div>
        </CardContent>
        <div className="p-4 border-t flex justify-between items-center">
          {email && <p className="text-xs text-muted-foreground">{tx("将发送至", "Will be sent to")}: <span className="font-medium text-foreground">{email}</span></p>}
          {!email && <div />}
          <div className="flex space-x-3">
            <Button variant="outline" onClick={onClose}>{tx("取消", "Cancel")}</Button>
            <Button onClick={handleSend} disabled={!email.trim() || sending}>
              <Send className="mr-2 h-4 w-4" /> {sending ? tx("发送中...", "Sending...") : tx("确认发送", "Send")}
            </Button>
          </div>
        </div>
      </Card>
    </ModalOverlay>
  )
}

// ==========================================
// Modal: Blogger detail
// ==========================================
function BloggerDetailModal({ blogger, onClose }: { blogger: AcquisitionBlogger; onClose: () => void }) {
  return (
    <ModalOverlay onClose={onClose}>
      <Card className="w-full max-w-md overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">{blogger.name} {tx("详情", "Details")}</CardTitle>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="h-4 w-4" /></Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="space-y-1"><span className="text-muted-foreground">{tx("平台", "Platform")}</span><p className="font-medium">{mapIntlLabel(blogger.platform)}</p></div>
            <div className="space-y-1"><span className="text-muted-foreground">{tx("粉丝量", "Followers")}</span><p className="font-medium">{blogger.followers}</p></div>
            <div className="space-y-1"><span className="text-muted-foreground">{tx("合作状态", "Status")}</span><p><StatusBadge status={blogger.status} /></p></div>
            <div className="space-y-1"><span className="text-muted-foreground">{tx("联系邮箱", "Email")}</span><p className="font-medium">{blogger.email}</p></div>
            <div className="space-y-1"><span className="text-muted-foreground">{tx("基础费用", "Base Cost")}</span><p className="font-medium">{blogger.cost}</p></div>
            <div className="space-y-1"><span className="text-muted-foreground">{tx("利润分成", "Revenue Share")}</span><p className="font-medium text-blue-600">{blogger.commission}</p></div>
          </div>
          <div className="pt-4 border-t">
            <Label className="text-muted-foreground">{tx("跟进记录", "Follow-up Notes")}</Label>
            <div className="mt-2 bg-muted/30 rounded-lg p-3 text-sm text-muted-foreground">
              <p>{tx("暂无跟进记录。可通过「发邮件」功能联系博主，跟进记录将在后续版本自动生成。", "No follow-up notes yet. You can contact bloggers via email; follow-up records will be auto-generated in a future release.")}</p>
            </div>
          </div>
        </CardContent>
        <div className="p-4 border-t flex justify-end">
          <Button variant="outline" onClick={onClose}>{tx("关闭", "Close")}</Button>
        </div>
      </Card>
    </ModalOverlay>
  )
}

// ==========================================
// Modal: Contract preview
// ==========================================
function ContractModal({ onClose, onDownload }: { onClose: () => void; onDownload: () => void }) {
  return (
    <ModalOverlay onClose={onClose}>
      <Card className="w-full max-w-2xl overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center"><FileText className="mr-2 h-5 w-5 text-blue-600" /> {tx("合同模板预览", "Contract Template Preview")}</CardTitle>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="h-4 w-4" /></Button>
        </CardHeader>
        <CardContent className="bg-muted/30 max-h-[60vh] overflow-y-auto text-sm leading-relaxed font-serif space-y-4">
          <h3 className="text-center text-lg font-bold mb-6">{tx("B2B 软件产品采购及服务协议", "B2B Software Procurement and Service Agreement")}</h3>
          <p><strong>{tx("甲方（采购方）：", "Party A (Buyer):")}</strong> ____________________</p>
          <p><strong>{tx("乙方（服务方）：", "Party B (Service Provider):")}</strong> {tx("本公司", "Our Company")}</p>
          <p>{tx("鉴于甲方业务发展需要，拟向乙方采购相关软件产品及技术服务，经双方友好协商，本着平等自愿、诚实信用的原则，达成如下协议：", "Due to business growth needs, Party A intends to procure software products and technical services from Party B. After friendly consultation, both parties agree as follows under principles of equality, voluntariness, and good faith:")}</p>
          <h4 className="font-bold mt-6 mb-2">{tx("第一条 采购内容", "Article 1 Procurement Scope")}</h4>
          <p>{tx("1.1 软件名称：产品获客系统企业版 (Pro)", "1.1 Product: Acquisition System Enterprise Edition (Pro)")}</p>
          <p>{tx("1.2 交付时间：自本合同签署之日起 5 个工作日内。", "1.2 Delivery: Within 5 business days after this agreement is signed.")}</p>
          <h4 className="font-bold mt-6 mb-2">{tx("第二条 费用及支付方式", "Article 2 Fees and Payment Terms")}</h4>
          <p>{tx("2.1 本合同总金额为人民币（大写）：_______________ 元整（¥_________）。", "2.1 Total contract amount: RMB (in words) _______________ (¥_________).")}</p>
          <p>{tx("2.2 支付节奏：合同签订后 3 日内支付 50% 预付款，验收合格后支付剩余 50% 尾款。", "2.2 Payment schedule: 50% prepayment within 3 days after signing; remaining 50% upon acceptance.")}</p>
          <p className="text-center text-muted-foreground mt-8">{tx("--- 以下内容省略，请下载后查看完整版 ---", "--- Remaining content omitted. Please download the full version. ---")}</p>
        </CardContent>
        <div className="p-4 border-t flex justify-end space-x-3">
          <Button variant="outline" onClick={onClose}>{tx("取消", "Cancel")}</Button>
          <Button onClick={onDownload}><Download className="mr-2 h-4 w-4" /> {tx("确认并下载文档 (Word格式)", "Confirm and Download (Word)")}</Button>
        </div>
      </Card>
    </ModalOverlay>
  )
}

// ==========================================
// Modal: Add form (generic for all 4 types)
// ==========================================
function AddFormModal({ type, onClose, onSubmit }: {
  type: "blogger" | "b2b" | "vc" | "ad"
  onClose: () => void
  onSubmit: (data: Record<string, string>) => void
}) {
  const [formData, setFormData] = useState<Record<string, string>>({})
  const handleChange = (name: string, value: string) => setFormData((prev) => ({ ...prev, [name]: value }))

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit(formData)
  }

  const configs: Record<string, { title: string; fields: Array<{ name: string; label: string; type: string; placeholder?: string; options?: string[]; step?: string }> }> = {
    blogger: {
      title: tx("录入博主线索", "Add Blogger Lead"),
      fields: [
        { name: "name", label: tx("博主昵称", "Blogger Name"), type: "text", placeholder: tx("如: 老李说科技", "e.g. TechTalkLeo") },
        { name: "platform", label: tx("平台", "Platform"), type: "text", placeholder: tx("如: B站/小红书", "e.g. YouTube/TikTok") },
        { name: "email", label: tx("联系邮箱", "Contact Email"), type: "email", placeholder: tx("如: hello@163.com", "e.g. hello@example.com") },
        { name: "followers", label: tx("粉丝量", "Followers"), type: "text", placeholder: tx("如: 50k", "e.g. 50k") },
        { name: "cost", label: tx("基础费用期望", "Expected Base Fee"), type: "text", placeholder: tx("如: ¥100/条", "e.g. $20/post") },
        { name: "commission", label: tx("分润期望", "Expected Revenue Share"), type: "text", placeholder: tx("如: 25%", "e.g. 25%") },
      ],
    },
    b2b: {
      title: tx("手工录入企业线索", "Add Enterprise Lead Manually"),
      fields: [
        { name: "name", label: tx("企业名称", "Company Name"), type: "text", placeholder: tx("如: 深圳XX科技公司", "e.g. Acme Tech Ltd.") },
        { name: "region", label: tx("所属区域", "Region"), type: "text", placeholder: tx("如: 深圳/北京", "e.g. New York/London") },
        { name: "contact", label: tx("联系人及职务", "Contact & Role"), type: "text", placeholder: tx("如: 王总 (CTO)", "e.g. Jane Doe (CTO)") },
        { name: "email", label: tx("联系邮箱", "Contact Email"), type: "email", placeholder: tx("如: wang@company.com", "e.g. jane@company.com") },
        { name: "estValue", label: tx("预估客单价", "Estimated Deal Value"), type: "text", placeholder: tx("如: ¥30,000", "e.g. $30,000") },
      ],
    },
    vc: {
      title: tx("添加投资机构线索", "Add VC Lead"),
      fields: [
        { name: "name", label: tx("机构名称", "Institution Name"), type: "text", placeholder: tx("如: 高瓴创投", "e.g. Sequoia Capital") },
        { name: "region", label: tx("区域", "Region"), type: "text", placeholder: tx("如: 北京", "e.g. San Francisco") },
        { name: "contact", label: tx("联系人", "Contact"), type: "text", placeholder: tx("如: 李经理", "e.g. Alex Lee") },
        { name: "email", label: tx("联系邮箱", "Contact Email"), type: "email", placeholder: tx("如: li@fund.com", "e.g. alex@fund.com") },
        { name: "focus", label: tx("关注领域", "Focus Areas"), type: "text", placeholder: tx("如: AI/SaaS", "e.g. AI/SaaS") },
      ],
    },
    ad: {
      title: tx("上架新广告位 (Ad-to-Earn)", "List New Ad Slot (Ad-to-Earn)"),
      fields: [
        { name: "brand", label: tx("广告主/品牌名称", "Advertiser/Brand"), type: "text", placeholder: tx("如: 某出行App", "e.g. RideShare App") },
        { name: "type", label: tx("广告类型", "Ad Type"), type: "select", options: ["视频广告", "互动广告", "横幅图片"] },
        { name: "duration", label: tx("要求观看时长 (秒)", "Required Watch Time (sec)"), type: "text", placeholder: tx("如: 30", "e.g. 30") },
        { name: "rewardType", label: tx("奖励类型", "Reward Type"), type: "select", options: ["现金", "积分"] },
        { name: "reward", label: tx("单次用户奖励金", "Reward per View"), type: "text", placeholder: tx("如: 0.5", "e.g. 0.5"), step: "0.1" },
      ],
    },
  }

  const config = configs[type]
  if (!config) return null

  return (
    <ModalOverlay onClose={onClose}>
      <Card className="w-full max-w-md overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">{config.title}</CardTitle>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="h-4 w-4" /></Button>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4 max-h-[60vh] overflow-y-auto">
            {config.fields.map((field) => (
              <div key={field.name} className="space-y-2">
                <Label>{field.label}</Label>
                {field.type === "select" ? (
                  <Select onValueChange={(value) => handleChange(field.name, value)} defaultValue="">
                    <SelectTrigger><SelectValue placeholder={tx("请选择", "Please select")} /></SelectTrigger>
                    <SelectContent>
                      {field.options?.map((opt) => (
                        <SelectItem key={opt} value={opt}>{mapIntlLabel(opt)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input required type={field.type} placeholder={field.placeholder} step={field.step} onChange={(e) => handleChange(field.name, e.target.value)} />
                )}
              </div>
            ))}
          </CardContent>
          <div className="p-4 border-t bg-muted/30 flex justify-end space-x-3">
            <Button type="button" variant="outline" onClick={onClose}>{tx("取消", "Cancel")}</Button>
            <Button type="submit">{tx("保存入库", "Save")}</Button>
          </div>
        </form>
      </Card>
    </ModalOverlay>
  )
}

// ==========================================
// Tab 1: 博主联盟 (Blogger CRM)
// ==========================================
function BloggerTab({ data, showToast, onAddClick, onShowEmailList, onShowFilter, onShowDetail, onUpdateStatus, onSendEmail }: {
  data: AcquisitionBlogger[]
  showToast: (msg: string) => void
  onAddClick: () => void
  onShowEmailList: () => void
  onShowFilter: () => void
  onShowDetail: (blogger: AcquisitionBlogger) => void
  onUpdateStatus: (blogger: AcquisitionBlogger) => void
  onSendEmail: (info: EmailComposeInfo) => void
}) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard title={tx("目标博主池", "Target Blogger Pool")} value={data.length + 250} icon={<Users className="h-5 w-5 text-blue-500" />} />
        <StatCard title={tx("已发送邀请", "Invitations Sent")} value="142" icon={<Mail className="h-5 w-5 text-purple-500" />} />
        <StatCard title={tx("达成合作", "Partnerships Closed")} value="26" icon={<HandshakeIcon className="h-5 w-5 text-green-500" />} />
        <StatCard title={tx("带来总利润", "Total Profit")} value="¥45,200" icon={<DollarSign className="h-5 w-5 text-yellow-500" />} />
      </div>

      <div className="flex justify-between items-center">
        <div className="relative w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
          <Input type="text" placeholder={tx("搜索博主邮箱或昵称...", "Search blogger email or name...")} className="pl-10" />
        </div>
        <div className="flex space-x-3">
          <Button variant="outline" onClick={onShowFilter}>
            <Filter className="mr-2 h-4 w-4" /> {tx("筛选条件", "Filters")}
          </Button>
          <Button variant="outline" onClick={onShowEmailList}>
            <Mail className="mr-2 h-4 w-4" /> {tx("查看邮箱列表", "View Email List")}
          </Button>
          <Button variant="default" onClick={onAddClick}>
            <Plus className="mr-2 h-4 w-4" /> {tx("录入博主", "Add Blogger")}
          </Button>
        </div>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{tx("博主昵称 / 平台", "Blogger / Platform")}</TableHead>
              <TableHead>{tx("粉丝量", "Followers")}</TableHead>
              <TableHead>{tx("合作状态", "Status")}</TableHead>
              <TableHead>{tx("基础费用", "Base Cost")}</TableHead>
              <TableHead>{tx("利润分成", "Revenue Share")}</TableHead>
              <TableHead className="text-right">{tx("操作", "Actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((blogger) => (
              <TableRow key={blogger.id}>
                <TableCell>
                  <div className="font-medium">{blogger.name}</div>
                  <div className="text-xs text-muted-foreground">{mapIntlLabel(blogger.platform)} • {blogger.email}</div>
                </TableCell>
                <TableCell className="font-medium">{blogger.followers}</TableCell>
                <TableCell><StatusBadge status={blogger.status} /></TableCell>
                <TableCell className="text-muted-foreground">{blogger.cost}</TableCell>
                <TableCell className="text-blue-600 font-semibold">{blogger.commission}</TableCell>
                <TableCell className="text-right space-x-1">
                  <Button variant="link" className="text-blue-600 p-0 h-auto" onClick={() => onUpdateStatus(blogger)}>{tx("更新状态", "Update Status")}</Button>
                  <Button variant="link" className="text-muted-foreground p-0 h-auto" onClick={() => onSendEmail({ recipientName: blogger.name, recipientEmail: blogger.email, companyName: undefined })}>
                    <Mail className="mr-1 h-3 w-3" />{tx("邮件", "Email")}
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => onShowDetail(blogger)}>
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  )
}

// ==========================================
// Tab 2: 企业采购 (B2B)
// ==========================================
function B2BTab({ data, showToast, onContractClick, onAddClick, onUpdateStatus, onSendEmail }: {
  data: AcquisitionB2BLead[]
  showToast: (msg: string) => void
  onContractClick: () => void
  onAddClick: () => void
  onUpdateStatus: (lead: AcquisitionB2BLead) => void
  onSendEmail: (info: EmailComposeInfo) => void
}) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard title={tx("总企业线索", "Total Enterprise Leads")} value={data.length + 120} icon={<Building2 className="h-5 w-5 text-blue-500" />} />
        <StatCard title={tx("国内政企网络", "Gov/Enterprise Network")} value={tx("手工维护中", "Maintained manually")} icon={<Globe className="h-5 w-5 text-indigo-500" />} />
        <StatCard title={tx("爬虫任务", "Crawler Tasks")} value={tx("待接入", "Pending")} icon={<Cpu className="h-5 w-5 text-muted-foreground" />} />
      </div>

      <div className="flex justify-between items-center">
        <div className="flex space-x-3">
          <Button variant="outline" className="border-dashed text-muted-foreground cursor-help" onClick={() => showToast(tx("企业爬虫模块 [待开发]。当前请使用右侧 [手工录入] 功能。", "Enterprise crawler module [Coming Soon]. Please use manual input on the right for now."))}>
            <Lock className="mr-2 h-4 w-4" /> {tx("运行 WebCrawler [待开发]", "Run WebCrawler [Coming Soon]")}
          </Button>
          <Button variant="outline" onClick={onContractClick}>
            <FileText className="mr-2 h-4 w-4" /> {tx("下载合同模板", "Download Contract Template")}
          </Button>
        </div>
        <Button onClick={onAddClick}>
          <Plus className="mr-2 h-4 w-4" /> {tx("手工录入线索", "Add Lead Manually")}
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {data.map((lead) => (
          <Card key={lead.id}>
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <Badge variant="secondary">{lead.region}{tx("网络", " Network")}</Badge>
                  <CardTitle className="mt-2">{lead.name}</CardTitle>
                </div>
                <StatusBadge status={lead.status} />
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2 text-sm text-muted-foreground">
                <div className="flex justify-between"><span>{tx("联系人", "Contact")}:</span><span className="font-medium text-foreground">{lead.contact}</span></div>
                <div className="flex justify-between items-center">
                  <span>{tx("来源", "Source")}:</span>
                  <span className="flex items-center">
                    {lead.source === "手工录入" ? <Plus className="h-3 w-3 mr-1 text-muted-foreground" /> : <Users className="h-3 w-3 mr-1 text-muted-foreground" />}
                    {mapIntlLabel(lead.source)}
                  </span>
                </div>
                <div className="flex justify-between"><span>{tx("预估价值", "Estimated Value")}:</span><span className="font-medium text-green-600">{lead.estValue}</span></div>
              </div>
              <div className="pt-4 border-t flex space-x-2">
                <Button variant="secondary" className="flex-1" onClick={() => onUpdateStatus(lead)}>
                  {tx("更新进度", "Update Progress")}
                </Button>
                <Button variant="outline" className="flex-1" onClick={() => onSendEmail({ recipientName: lead.contact, recipientEmail: lead.email, companyName: lead.name })}>
                  <Mail className="mr-2 h-4 w-4" /> {tx("发邮件", "Send Email")}
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

// ==========================================
// Tab 3: 金融 VC
// ==========================================
function VCTab({ data, showToast, onAddClick, onUpdateStatus, onSendEmail }: {
  data: AcquisitionVCLead[]
  showToast: (msg: string) => void
  onAddClick: () => void
  onUpdateStatus: (vc: AcquisitionVCLead) => void
  onSendEmail: (info: EmailComposeInfo) => void
}) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard title={tx("目标 VC 机构", "Target VC Firms")} value="45" icon={<Landmark className="h-5 w-5 text-purple-500" />} />
        <StatCard title={tx("已深度建联", "Deep Connections")} value="12" icon={<Users className="h-5 w-5 text-blue-500" />} />
        <StatCard title={tx("系统录入数据", "System Records")} value={data.length + 30} icon={<Database className="h-5 w-5 text-green-500" />} />
      </div>

      <div className="flex justify-between items-center">
        <Button variant="outline" className="border-dashed text-muted-foreground cursor-help" onClick={() => showToast(tx("VC 资源库深度爬虫抓取 [待开发]。", "Deep VC crawler [Coming Soon]."))}>
          <Lock className="mr-2 h-4 w-4" /> {tx("抓取 VC 动态 [待开发]", "Fetch VC Updates [Coming Soon]")}
        </Button>
        <Button onClick={onAddClick}>
          <Plus className="mr-2 h-4 w-4" /> {tx("添加 BD 引荐资源", "Add BD Referral Lead")}
        </Button>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{tx("机构名称", "Institution")}</TableHead>
              <TableHead>{tx("区域网络", "Region Network")}</TableHead>
              <TableHead>{tx("关注领域", "Focus Areas")}</TableHead>
              <TableHead>{tx("渠道来源", "Channel Source")}</TableHead>
              <TableHead>{tx("状态", "Status")}</TableHead>
              <TableHead className="text-right">{tx("操作", "Actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((vc) => (
              <TableRow key={vc.id}>
                <TableCell>
                  <div className="font-bold">{vc.name}</div>
                  <div className="text-xs text-muted-foreground">{tx("联系人", "Contact")}: {vc.contact}</div>
                </TableCell>
                <TableCell>{vc.region}</TableCell>
                <TableCell className="text-muted-foreground">{vc.focus}</TableCell>
                <TableCell className="text-muted-foreground">{vc.source}</TableCell>
                <TableCell><StatusBadge status={vc.status} /></TableCell>
                <TableCell className="text-right space-x-2">
                  <Button variant="link" className="text-blue-600 p-0 h-auto" onClick={() => onUpdateStatus(vc)}>{tx("推进阶段", "Advance Stage")}</Button>
                  <Button variant="link" className="text-muted-foreground p-0 h-auto" onClick={() => onSendEmail({ recipientName: vc.contact, recipientEmail: vc.email, companyName: vc.name })}>
                    <Mail className="mr-1 h-3 w-3" />{tx("联系", "Contact")}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  )
}

// ==========================================
// Modal: Ad Settings
// ==========================================
function AdSettingsModal({ ad, onClose, showToast, onSave }: { ad: AcquisitionAd; onClose: () => void; showToast: (msg: string) => void; onSave: (id: string, patch: { duration: string; reward: string; status: string }) => Promise<boolean> }) {
  const [duration, setDuration] = useState(ad.duration)
  const [reward, setReward] = useState(ad.reward)
  const [status, setStatus] = useState(ad.status)
  const [durationCustom, setDurationCustom] = useState(false)
  const [rewardCustom, setRewardCustom] = useState(false)
  const [saving, setSaving] = useState(false)

  const durationPresets = ["15s", "30s", "45s", "60s", "90s"]
  const rewardPresets = ["0.3 RMB", "0.5 RMB", "1 RMB", "2 RMB", "5 RMB"]

  const handleSave = async () => {
    setSaving(true)
    const ok = await onSave(ad.id, { duration, reward, status })
    setSaving(false)
    if (ok) {
      showToast(isIntlRegion ? `✅ Settings saved for "${ad.brand}"` : `✅ 广告「${ad.brand}」设置已保存`)
      onClose()
    }
  }

  return (
    <ModalOverlay onClose={onClose}>
      <Card className="w-full max-w-md overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">{tx("广告设置：", "Ad Settings:")}{ad.brand}</CardTitle>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="h-4 w-4" /></Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{tx("广告主", "Advertiser")}</Label>
              <Input value={ad.brand} disabled className="bg-muted/50" />
            </div>
            <div className="space-y-2">
              <Label>{tx("广告类型", "Ad Type")}</Label>
              <Input value={mapIntlLabel(ad.type)} disabled className="bg-muted/50" />
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>{tx("要求观看时长", "Required Watch Time")}</Label>
              <button type="button" className="text-xs text-blue-600 hover:underline" onClick={() => setDurationCustom(!durationCustom)}>
                {durationCustom ? tx("选择预设", "Use Preset") : tx("自定义输入", "Custom Input")}
              </button>
            </div>
            {durationCustom ? (
              <Input value={duration} onChange={(e) => setDuration(e.target.value)} placeholder={tx("如: 120s", "e.g. 120s")} />
            ) : (
              <div className="flex flex-wrap gap-2">
                {durationPresets.map((p) => (
                  <Button key={p} type="button" variant={duration === p ? "default" : "outline"} size="sm" onClick={() => setDuration(p)}>
                    {p}
                  </Button>
                ))}
              </div>
            )}
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>{tx("单次用户奖励", "Reward per View")}</Label>
              <button type="button" className="text-xs text-blue-600 hover:underline" onClick={() => setRewardCustom(!rewardCustom)}>
                {rewardCustom ? tx("选择预设", "Use Preset") : tx("自定义金额", "Custom Amount")}
              </button>
            </div>
            {rewardCustom ? (
              <Input value={reward} onChange={(e) => setReward(e.target.value)} placeholder={tx("如: 3.5 RMB", "e.g. 3.5 RMB")} />
            ) : (
              <div className="flex flex-wrap gap-2">
                {rewardPresets.map((p) => (
                  <Button key={p} type="button" variant={reward === p ? "default" : "outline"} size="sm" onClick={() => setReward(p)}>
                    {p}
                  </Button>
                ))}
              </div>
            )}
          </div>
          <div className="space-y-2">
            <Label>{tx("投放状态", "Delivery Status")}</Label>
            <Select onValueChange={setStatus} value={status}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="投放中">{tx("投放中", "Running")}</SelectItem>
                <SelectItem value="已暂停">{tx("已暂停", "Paused")}</SelectItem>
                <SelectItem value="已下架">{tx("已下架", "Removed")}</SelectItem>
                <SelectItem value="待审核">{tx("待审核", "Pending Review")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="rounded-lg bg-muted/30 p-3 space-y-1 text-sm text-muted-foreground">
            <div className="flex justify-between"><span>{tx("已观看次数", "Views")}:</span><span className="font-medium text-foreground">{ad.views}</span></div>
            <div className="flex justify-between"><span>{tx("创建时间", "Created At")}:</span><span>{ad.createdAt ? new Date(ad.createdAt).toLocaleDateString(isIntlRegion ? "en-US" : "zh-CN") : tx("未知", "Unknown")}</span></div>
          </div>
        </CardContent>
        <div className="p-4 border-t flex justify-end space-x-3">
          <Button variant="outline" onClick={onClose}>{tx("取消", "Cancel")}</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? tx("保存中...", "Saving...") : tx("保存设置", "Save Settings")}</Button>
        </div>
      </Card>
    </ModalOverlay>
  )
}

// ==========================================
// Modal: Ad Data Report
// ==========================================
function AdDataModal({ ad, onClose }: { ad: AcquisitionAd; onClose: () => void }) {
  const views = parseInt(ad.views?.replace(/,/g, "") || "0", 10) || 0
  const rewardNum = parseFloat(ad.reward?.replace(/[^0-9.]/g, "") || "0") || 0
  const totalCost = (views * rewardNum).toFixed(2)

  return (
    <ModalOverlay onClose={onClose}>
      <Card className="w-full max-w-md overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">{ad.brand} {tx("数据报表", "Data Report")}</CardTitle>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="h-4 w-4" /></Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-lg border p-4 text-center">
              <div className="text-sm text-muted-foreground">{tx("总观看次数", "Total Views")}</div>
              <div className="text-2xl font-bold mt-1">{ad.views}</div>
            </div>
            <div className="rounded-lg border p-4 text-center">
              <div className="text-sm text-muted-foreground">{tx("单次奖励", "Reward per View")}</div>
              <div className="text-2xl font-bold mt-1 text-green-600">{ad.reward}</div>
            </div>
          </div>
          <div className="rounded-lg bg-muted/30 p-4 space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">{tx("广告类型", "Ad Type")}:</span><span>{mapIntlLabel(ad.type)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">{tx("要求时长", "Required Duration")}:</span><span>{ad.duration}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">{tx("当前状态", "Current Status")}:</span><StatusBadge status={ad.status} /></div>
            <div className="flex justify-between border-t pt-2 mt-2"><span className="text-muted-foreground font-medium">{tx("预估总成本", "Estimated Total Cost")}:</span><span className="font-bold text-orange-600">¥{totalCost}</span></div>
          </div>
          <p className="text-xs text-muted-foreground text-center">{tx("ℹ️ 详细的时间线分析及用户画像报表将在后续版本上线", "ℹ️ Detailed timeline analysis and user profile reports will be available in a future release")}</p>
        </CardContent>
        <div className="p-4 border-t flex justify-end">
          <Button variant="outline" onClick={onClose}>{tx("关闭", "Close")}</Button>
        </div>
      </Card>
    </ModalOverlay>
  )
}

// ==========================================
// Tab 4: Ad-to-Earn
// ==========================================
function AdsTab({ data, showToast, onAddClick, onShowSettings, onShowData }: {
  data: AcquisitionAd[]
  showToast: (msg: string) => void
  onAddClick: () => void
  onShowSettings: (ad: AcquisitionAd) => void
  onShowData: (ad: AcquisitionAd) => void
}) {
  return (
    <div className="space-y-6">
      <Card className="border-yellow-200 bg-yellow-50 dark:bg-yellow-950/20">
        <CardContent className="flex items-start space-x-4 pt-6">
          <div className="bg-yellow-500 text-white p-2 rounded-lg mt-1"><Lock className="h-5 w-5" /></div>
          <div>
            <h4 className="font-semibold text-yellow-900 dark:text-yellow-200">{tx("Ad-to-Earn 配置看板 (一期展示)", "Ad-to-Earn Configuration Board (Phase 1)")}</h4>
            <p className="text-sm text-yellow-800 dark:text-yellow-300 mt-1">
              {tx("当前为广告资源占位及人工配置展示页。", "This is currently a placeholder and manual configuration page for ad resources.")}<b>{tx("自动化结算引擎 [待开发]、防刷验证码 [待开发] 及资金提现接口 [待开发]", "Automated settlement [Coming Soon], anti-fraud CAPTCHA [Coming Soon], and withdrawal API [Coming Soon]")}</b>{tx("将在后续风控体系完善后上线。", " will be launched after risk-control improvements.")}
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={onAddClick}>
          <Plus className="mr-2 h-4 w-4" /> {tx("上架新广告位", "List New Ad Slot")}
        </Button>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{tx("广告主/品牌", "Advertiser/Brand")}</TableHead>
              <TableHead>{tx("要求时长", "Required Duration")}</TableHead>
              <TableHead>{tx("用户奖励", "User Reward")}</TableHead>
              <TableHead>{tx("已观看次数", "Views")}</TableHead>
              <TableHead>{tx("状态", "Status")}</TableHead>
              <TableHead className="text-right">{tx("操作", "Actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((ad) => (
              <TableRow key={ad.id}>
                <TableCell>
                  <div className="font-medium">{ad.brand}</div>
                  <div className="text-xs text-muted-foreground">{mapIntlLabel(ad.type)}</div>
                </TableCell>
                <TableCell className="text-muted-foreground flex items-center space-x-1">
                  <Clock className="h-3 w-3" /> <span>{ad.duration}</span>
                </TableCell>
                <TableCell className="font-bold text-green-600">{ad.reward}</TableCell>
                <TableCell className="text-muted-foreground">{ad.views}</TableCell>
                <TableCell><StatusBadge status={ad.status} /></TableCell>
                <TableCell className="text-right space-x-3">
                  <Button variant="link" className="text-blue-600 p-0 h-auto" onClick={() => onShowData(ad)}>{tx("数据", "Data")}</Button>
                  <Button variant="link" className="text-muted-foreground p-0 h-auto" onClick={() => onShowSettings(ad)}>{tx("设置", "Settings")}</Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  )
}

// ==========================================
// Main Client Component
// ==========================================
export function AcquisitionClient() {
  const [activeTab, setActiveTab] = useState<TabKey>("b2b")
  const [toastMessage, setToastMessage] = useState("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const [bloggers, setBloggers] = useState<AcquisitionBlogger[]>([])
  const [b2bLeads, setB2bLeads] = useState<AcquisitionB2BLead[]>([])
  const [vcLeads, setVcLeads] = useState<AcquisitionVCLead[]>([])
  const [ads, setAds] = useState<AcquisitionAd[]>([])

  // Modal states
  const [contractModalOpen, setContractModalOpen] = useState(false)
  const [formModalConfig, setFormModalConfig] = useState<{ isOpen: boolean; type: "blogger" | "b2b" | "vc" | "ad" | null }>({ isOpen: false, type: null })
  const [emailListOpen, setEmailListOpen] = useState(false)
  const [filterOpen, setFilterOpen] = useState(false)
  const [bloggerDetailTarget, setBloggerDetailTarget] = useState<AcquisitionBlogger | null>(null)
  const [emailComposeTarget, setEmailComposeTarget] = useState<EmailComposeInfo | null>(null)
  const [statusModal, setStatusModal] = useState<{
    isOpen: boolean
    title: string
    currentStatus: string
    statuses: string[]
    onConfirm: (newStatus: string) => void
  } | null>(null)
  const [adSettingsTarget, setAdSettingsTarget] = useState<AcquisitionAd | null>(null)
  const [adDataTarget, setAdDataTarget] = useState<AcquisitionAd | null>(null)

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg)
    setTimeout(() => setToastMessage(""), 3000)
  }, [])

  const getAuthHeaders = useCallback(() => {
    const cookies = document.cookie.split(";").map((c) => c.trim())
    const sessionCookie = cookies.find((c) => c.startsWith("market_admin_session="))
    const token = sessionCookie?.split("=")[1] || ""
    return { "Content-Type": "application/json", Authorization: `Bearer ${token}` }
  }, [])

  const fetchBootstrap = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const response = await fetch("/api/market/admin/acquisition", { headers: getAuthHeaders() })
      const json = await response.json()
      if (!json.success) throw new Error(json.error || "Failed to load data")
      const data: AcquisitionBootstrapData = json.data
      setBloggers(data.bloggers)
      setB2bLeads(data.b2bLeads)
      setVcLeads(data.vcLeads)
      setAds(data.ads)
    } catch (err) {
      setError(err instanceof Error ? err.message : tx("加载数据失败", "Failed to load data"))
    } finally {
      setLoading(false)
    }
  }, [getAuthHeaders])

  useEffect(() => { fetchBootstrap() }, [fetchBootstrap])

  const postAction = useCallback(async (action: string, data: Record<string, string>) => {
    try {
      const response = await fetch("/api/market/admin/acquisition", {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({ action, ...data }),
      })
      const json = await response.json()
      if (!json.success) throw new Error(json.error || tx("操作失败", "Action failed"))
      return json.result
    } catch (err) {
      showToast(`❌ ${err instanceof Error ? err.message : tx("操作失败", "Action failed")}`)
      return null
    }
  }, [getAuthHeaders, showToast])

  const handleFormSubmit = useCallback(async (formData: Record<string, string>) => {
    const type = formModalConfig.type
    if (!type) return
    let action = ""
    if (type === "blogger") action = "insert_blogger"
    else if (type === "b2b") action = "insert_b2b_lead"
    else if (type === "vc") action = "insert_vc_lead"
    else if (type === "ad") {
      action = "insert_ad"
      formData.duration = `${formData.duration || "30"}s`
      formData.reward = `${formData.reward || "0"} ${formData.rewardType === "积分" ? tx("积分", "Points") : "RMB"}`
    }
    const result = await postAction(action, formData)
    if (result) {
      showToast(tx("🎉 数据已成功录入系统！", "🎉 Data has been successfully saved!"))
      await fetchBootstrap()
    }
    setFormModalConfig({ isOpen: false, type: null })
  }, [formModalConfig.type, postAction, showToast, fetchBootstrap])

  // B2B status update — opens modal
  const openB2BStatusModal = useCallback((lead: AcquisitionB2BLead) => {
    setStatusModal({
      isOpen: true,
      title: isIntlRegion ? `Update "${lead.name}" Progress` : `更新「${lead.name}」进度`,
      currentStatus: lead.status,
      statuses: ["初步接触", "跟进中", "合同拟定", "已转化"],
      onConfirm: async (newStatus: string) => {
        const result = await postAction("update_b2b_status", { id: lead.id, status: newStatus })
        if (result) {
          setB2bLeads((prev) => prev.map((l) => (l.id === lead.id ? { ...l, status: newStatus } : l)))
          showToast(isIntlRegion ? `✅ Updated to "${mapIntlLabel(newStatus)}"` : `✅ 已更新为「${newStatus}」`)
        }
        setStatusModal(null)
      },
    })
  }, [postAction, showToast])

  // VC status update — opens modal
  const openVCStatusModal = useCallback((vc: AcquisitionVCLead) => {
    setStatusModal({
      isOpen: true,
      title: isIntlRegion ? `Advance "${vc.name}" Stage` : `推进「${vc.name}」阶段`,
      currentStatus: vc.status,
      statuses: ["待联系", "初步接触", "深度沟通 (Pitch)", "尽职调查", "已投资"],
      onConfirm: async (newStatus: string) => {
        const result = await postAction("update_vc_status", { id: vc.id, status: newStatus })
        if (result) {
          setVcLeads((prev) => prev.map((v) => (v.id === vc.id ? { ...v, status: newStatus } : v)))
          showToast(isIntlRegion ? `✅ Updated to "${mapIntlLabel(newStatus)}"` : `✅ 已更新为「${newStatus}」`)
        }
        setStatusModal(null)
      },
    })
  }, [postAction, showToast])

  // Blogger status update — opens modal
  const openBloggerStatusModal = useCallback((blogger: AcquisitionBlogger) => {
    setStatusModal({
      isOpen: true,
      title: isIntlRegion ? `Update "${blogger.name}" Status` : `更新「${blogger.name}」状态`,
      currentStatus: blogger.status,
      statuses: ["未联系", "已联系", "谈判中", "已合作", "已拒绝"],
      onConfirm: async (newStatus: string) => {
        const result = await postAction("update_blogger_status", { id: blogger.id, status: newStatus })
        if (result) {
          setBloggers((prev) => prev.map((b) => (b.id === blogger.id ? { ...b, status: newStatus } : b)))
          showToast(isIntlRegion ? `✅ Blogger "${blogger.name}" updated to "${mapIntlLabel(newStatus)}"` : `✅ 博主「${blogger.name}」已更新为「${newStatus}」`)
        }
        setStatusModal(null)
      },
    })
  }, [postAction, showToast])

  // Filter apply
  const handleFilterApply = useCallback((filters: { platform: string; status: string }) => {
    // For now just show toast with applied filters
    const parts: string[] = []
    if (filters.platform) parts.push(`${tx("平台", "Platform")}=${mapIntlLabel(filters.platform)}`)
    if (filters.status) parts.push(`${tx("状态", "Status")}=${mapIntlLabel(filters.status)}`)
    showToast(parts.length > 0 ? `${tx("✅ 筛选条件已应用", "✅ Filters applied")}: ${parts.join(", ")}` : tx("✅ 已重置所有筛选条件", "✅ All filters reset"))
    setFilterOpen(false)
  }, [showToast])

  const tabs: Array<{ key: TabKey; label: string; icon: React.ReactNode }> = [
    { key: "bloggers", label: tx("博主联盟 (KOL)", "Blogger Alliance (KOL)"), icon: <Users className="h-4 w-4" /> },
    { key: "b2b", label: tx("企业采购 (B2B)", "Enterprise Procurement (B2B)"), icon: <Building2 className="h-4 w-4" /> },
    { key: "vc", label: tx("金融 VC", "Finance VC"), icon: <Landmark className="h-4 w-4" /> },
    { key: "ads", label: tx("Ad-to-Earn 广告", "Ad-to-Earn Ads"), icon: <PlaySquare className="h-4 w-4" /> },
  ]

  if (loading) {
    return (
      <div className="space-y-4 p-6">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (<Skeleton key={i} className="h-24 rounded-xl" />))}
        </div>
        <Skeleton className="h-80 rounded-xl" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-10 text-center">
        <p className="text-destructive mb-4">{error}</p>
        <Button onClick={fetchBootstrap}>{tx("重试", "Retry")}</Button>
      </div>
    )
  }

  return (
    <div className="relative">
      {/* Header */}
      <div className="flex justify-between items-end mb-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center space-x-2">
            <span className="bg-blue-100 text-blue-600 dark:bg-blue-950 dark:text-blue-400 p-2 rounded-lg">
              <Users className="h-6 w-6" />
            </span>
            <span>{tx("产品获客系统", "Acquisition System")}</span>
          </h1>
          <p className="text-muted-foreground mt-2 text-sm">{tx("管理博主合作、企业采购线索与 Ad-to-Earn 广告资源。", "Manage blogger partnerships, enterprise leads, and Ad-to-Earn ad resources.")}</p>
        </div>
        <Link href="/market/profile">
          <Button variant="outline" className="flex items-center space-x-2 px-5 py-2.5 text-sm font-medium border-violet-200 bg-violet-50 text-violet-700 hover:bg-violet-100 dark:border-violet-800 dark:bg-violet-950/40 dark:text-violet-300 dark:hover:bg-violet-900/50">
            <User className="h-5 w-5" />
            <span>{tx("个人中心", "Profile")}</span>
            <Settings className="h-3.5 w-3.5 opacity-50" />
          </Button>
        </Link>
      </div>

      {/* Tabs */}
      <Card>
        <div className="flex border-b overflow-x-auto bg-muted/30">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center space-x-2 px-6 py-4 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                activeTab === tab.key
                  ? "border-primary text-primary bg-background"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50"
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        <CardContent className="p-4 md:p-6">
          {activeTab === "bloggers" && (
            <BloggerTab
              data={bloggers}
              showToast={showToast}
              onAddClick={() => setFormModalConfig({ isOpen: true, type: "blogger" })}
              onShowEmailList={() => setEmailListOpen(true)}
              onShowFilter={() => setFilterOpen(true)}
              onShowDetail={(b) => setBloggerDetailTarget(b)}
              onUpdateStatus={openBloggerStatusModal}
              onSendEmail={(info) => setEmailComposeTarget(info)}
            />
          )}
          {activeTab === "b2b" && (
            <B2BTab
              data={b2bLeads}
              showToast={showToast}
              onContractClick={() => setContractModalOpen(true)}
              onAddClick={() => setFormModalConfig({ isOpen: true, type: "b2b" })}
              onUpdateStatus={openB2BStatusModal}
              onSendEmail={(info) => setEmailComposeTarget(info)}
            />
          )}
          {activeTab === "vc" && (
            <VCTab
              data={vcLeads}
              showToast={showToast}
              onAddClick={() => setFormModalConfig({ isOpen: true, type: "vc" })}
              onUpdateStatus={openVCStatusModal}
              onSendEmail={(info) => setEmailComposeTarget(info)}
            />
          )}
          {activeTab === "ads" && (
            <AdsTab
              data={ads}
              showToast={showToast}
              onAddClick={() => setFormModalConfig({ isOpen: true, type: "ad" })}
              onShowSettings={(ad) => setAdSettingsTarget(ad)}
              onShowData={(ad) => setAdDataTarget(ad)}
            />
          )}
        </CardContent>
      </Card>

      {/* Toast */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 bg-foreground text-background px-6 py-3 rounded-lg shadow-lg flex items-center space-x-2 z-50 animate-in slide-in-from-bottom-5">
          <CheckCircle className="h-4 w-4 text-green-400" />
          <span className="text-sm">{toastMessage}</span>
        </div>
      )}

      {/* Modals */}
      {contractModalOpen && (
        <ContractModal
          onClose={() => setContractModalOpen(false)}
          onDownload={() => {
            import("@/lib/market/contract-template").then(({ generateContractHTML }) => {
              const html = generateContractHTML("")
              const blob = new Blob([html], { type: "text/html;charset=utf-8" })
              const url = URL.createObjectURL(blob)
              const a = document.createElement("a")
              a.href = url
              a.download = isIntlRegion ? "B2B-Contract-Template.html" : "B2B合作协议模板.html"
              a.click()
              URL.revokeObjectURL(url)
            })
            setContractModalOpen(false)
            showToast(tx("✅ 合同模板已下载，可用浏览器打开并打印为PDF", "✅ Contract template downloaded. Open in browser and print to PDF."))
          }}
        />
      )}

      {formModalConfig.isOpen && formModalConfig.type && (
        <AddFormModal type={formModalConfig.type} onClose={() => setFormModalConfig({ isOpen: false, type: null })} onSubmit={handleFormSubmit} />
      )}

      {emailListOpen && (
        <EmailListModal bloggers={bloggers} onClose={() => setEmailListOpen(false)} showToast={showToast} />
      )}

      {filterOpen && (
        <FilterModal onClose={() => setFilterOpen(false)} onApply={handleFilterApply} />
      )}

      {bloggerDetailTarget && (
        <BloggerDetailModal blogger={bloggerDetailTarget} onClose={() => setBloggerDetailTarget(null)} />
      )}

      {emailComposeTarget && (
        <EmailComposeModal info={emailComposeTarget} onClose={() => setEmailComposeTarget(null)} showToast={showToast} />
      )}

      {statusModal && (
        <StatusSelectModal
          title={statusModal.title}
          currentStatus={statusModal.currentStatus}
          statuses={statusModal.statuses}
          onClose={() => setStatusModal(null)}
          onConfirm={statusModal.onConfirm}
        />
      )}

      {adSettingsTarget && (
        <AdSettingsModal
          ad={adSettingsTarget}
          onClose={() => setAdSettingsTarget(null)}
          showToast={showToast}
          onSave={async (id, patch) => {
            const result = await postAction("update_ad", { id, ...patch })
            if (result) {
              setAds((prev) => prev.map((a) => (a.id === id ? { ...a, ...patch } : a)))
              return true
            }
            return false
          }}
        />
      )}

      {adDataTarget && (
        <AdDataModal ad={adDataTarget} onClose={() => setAdDataTarget(null)} />
      )}
    </div>
  )
}
