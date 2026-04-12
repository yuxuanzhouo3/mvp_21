"use client";

import Image from "next/image";
import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  ArrowLeft,
  CheckCircle,
  Download,
  Eraser,
  FileText,
  Pen,
  Shield,
  Type,
  Upload,
} from "lucide-react";
import { toast } from "sonner";

import { useLanguage } from "@/components/language-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  applyContractActionForCurrentUser,
  downloadContractForCurrentUser,
  getContractForCurrentUser,
  updateContractForCurrentUser,
} from "@/lib/contracts/client";
import { normalizeContractEnhancementMeta } from "@/lib/contracts/enhancements";
import type { UnifiedContractRecord } from "@/lib/data/unified-models";

type SignatureMethod = "draw" | "type" | "upload";

interface ContractSignFlowProps {
  contractId?: string | null;
  backHref: string;
  backLabel?: string;
  openContractHref?: string;
  signatureSource?: string;
}

function buildId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

async function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error || new Error("FILE_READ_FAILED"));
    reader.readAsDataURL(file);
  });
}

export function ContractSignFlow({
  contractId,
  backHref,
  backLabel,
  openContractHref,
  signatureSource = "web",
}: ContractSignFlowProps) {
  const { language } = useLanguage();
  const isEn = language === "en";
  const [contract, setContract] = useState<UnifiedContractRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [signMethod, setSignMethod] = useState<SignatureMethod>("draw");
  const [typedName, setTypedName] = useState("");
  const [uploadedSignature, setUploadedSignature] = useState<{ dataUrl: string; fileName: string } | null>(null);
  const [legalConsent, setLegalConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef(false);
  const hasDrawnRef = useRef(false);

  const enhancement = useMemo(
    () => normalizeContractEnhancementMeta(contract?.metadata, contract || undefined),
    [contract],
  );

  const resolvedBackLabel = backLabel || (isEn ? "Back to Contracts" : "返回合同列表");
  const resolvedOpenContractHref = openContractHref || (contract ? `/contracts/${contract.id}` : "/contracts");

  const loadContract = useCallback(async () => {
    if (!contractId) {
      setError(isEn ? "No contract selected." : "未选择要签署的合同。");
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError("");
      const detail = await getContractForCurrentUser(contractId);
      setContract(detail);
      setTypedName(typeof detail.parties[0]?.name === "string" ? detail.parties[0].name : "");
    } catch (loadError) {
      console.error("[ContractSignFlow] Failed to load contract:", loadError);
      setError(isEn ? "Failed to load contract." : "加载合同失败。");
    } finally {
      setLoading(false);
    }
  }, [contractId, isEn]);

  useEffect(() => {
    void loadContract();
  }, [loadContract]);

  useEffect(() => {
    if (!loading) {
      setupCanvas();
    }
  }, [loading]);

  function setupCanvas() {
    const canvas = canvasRef.current;
    if (!canvas || typeof window === "undefined") return;

    const width = canvas.parentElement?.clientWidth || 320;
    const ratio = Math.max(window.devicePixelRatio || 1, 1);

    canvas.width = width * ratio;
    canvas.height = 180 * ratio;
    canvas.style.width = `${width}px`;
    canvas.style.height = "180px";

    const context = canvas.getContext("2d");
    if (!context) return;

    context.scale(ratio, ratio);
    context.lineCap = "round";
    context.lineJoin = "round";
    context.strokeStyle = "#111827";
    context.lineWidth = 2;
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, width, 180);
  }

  function startDrawing(event: ReactPointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;

    drawingRef.current = true;
    hasDrawnRef.current = true;

    const rect = canvas.getBoundingClientRect();
    context.beginPath();
    context.moveTo(event.clientX - rect.left, event.clientY - rect.top);
  }

  function draw(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current) return;

    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;

    const rect = canvas.getBoundingClientRect();
    context.lineTo(event.clientX - rect.left, event.clientY - rect.top);
    context.stroke();
  }

  function stopDrawing() {
    drawingRef.current = false;
  }

  function clearDrawing() {
    hasDrawnRef.current = false;
    setupCanvas();
  }

  async function handleUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const dataUrl = await fileToDataUrl(file);
      setUploadedSignature({ dataUrl, fileName: file.name });
      toast.success(isEn ? "Signature image ready." : "签名图片已准备就绪。");
    } catch (uploadError) {
      console.error("[ContractSignFlow] Failed to process uploaded signature:", uploadError);
      toast.error(isEn ? "Failed to process signature image." : "处理签名图片失败。");
    } finally {
      event.target.value = "";
    }
  }

  function buildSignatureInput(role: "sender" | "counterparty") {
    if (!contract) return null;

    if (!legalConsent) {
      toast.error(
        isEn
          ? "Please confirm legal consent first."
          : "请先确认电子签署法律声明。",
      );
      return null;
    }

    const signerName =
      typedName.trim() ||
      (role === "sender"
        ? String(contract.parties[0]?.name || (isEn ? "Sender" : "发起方"))
        : String(contract.parties[1]?.name || (isEn ? "Counterparty" : "对方")));

    const createdAt = new Date().toISOString();

    if (signMethod === "type") {
      if (!typedName.trim()) {
        toast.error(isEn ? "Please type your full name first." : "请先输入完整姓名。");
        return null;
      }

      return {
        id: buildId("signature"),
        role,
        method: "type",
        signerName,
        legalConsent,
        typedName: typedName.trim(),
        createdAt,
        source: signatureSource,
      };
    }

    if (signMethod === "upload") {
      if (!uploadedSignature) {
        toast.error(isEn ? "Please upload a signature image first." : "请先上传签名图片。");
        return null;
      }

      return {
        id: buildId("signature"),
        role,
        method: "upload",
        signerName,
        legalConsent,
        imageDataUrl: uploadedSignature.dataUrl,
        imageMimeType: "image/*",
        fileName: uploadedSignature.fileName,
        createdAt,
        source: signatureSource,
      };
    }

    const imageDataUrl = hasDrawnRef.current ? canvasRef.current?.toDataURL("image/png") : "";
    if (!imageDataUrl) {
      toast.error(isEn ? "Please draw your signature first." : "请先手写签名。");
      return null;
    }

    return {
      id: buildId("signature"),
      role,
      method: "draw",
      signerName,
      legalConsent,
      imageDataUrl,
      imageMimeType: "image/png",
      createdAt,
      source: signatureSource,
    };
  }

  async function confirm(
    role: "sender" | "counterparty",
    action: "confirm_sender" | "confirm_counterparty",
    note: string,
  ) {
    if (!contractId) return;

    const signatureInput = buildSignatureInput(role);
    if (!signatureInput) return;

    try {
      setSubmitting(true);
      const updated = await updateContractForCurrentUser(contractId, {
        action,
        note,
        signatureInput,
      });
      setContract(updated);
      toast.success(isEn ? "Signature recorded." : "签名已记录。");
    } catch (confirmError) {
      console.error("[ContractSignFlow] Failed to confirm signature:", confirmError);
      toast.error(isEn ? "Failed to record signature." : "记录签名失败。");
    } finally {
      setSubmitting(false);
    }
  }

  async function handlePrimaryAction() {
    if (!contractId) return;

    if (enhancement.signFlow.status === "draft") {
      try {
        setSubmitting(true);
        const updated = await applyContractActionForCurrentUser(
          contractId,
          "start_signing",
          isEn ? "Signing launched from shared sign flow." : "已从统一签署页发起签署。",
        );
        setContract(updated);
        toast.success(
          isEn
            ? "Signing started. Sender confirmation is now required."
            : "已发起签署，下一步需要发起方确认。",
        );
      } catch (actionError) {
        console.error("[ContractSignFlow] Failed to start signing:", actionError);
        toast.error(isEn ? "Failed to start signing." : "发起签署失败。");
      } finally {
        setSubmitting(false);
      }
      return;
    }

    if (enhancement.signFlow.status === "awaiting_sender") {
      await confirm(
        "sender",
        "confirm_sender",
        isEn
          ? "Sender confirmation recorded from shared sign flow."
          : "已从统一签署页记录发起方签署。",
      );
      return;
    }

    if (enhancement.signFlow.status === "awaiting_counterparty") {
      await confirm(
        "counterparty",
        "confirm_counterparty",
        isEn
          ? "Counterparty confirmation recorded from shared sign flow."
          : "已从统一签署页记录对方签署。",
      );
      return;
    }

    try {
      setSubmitting(true);
      await downloadContractForCurrentUser(contractId, "pdf");
      toast.success(isEn ? "Final copy downloaded." : "最终电子版开始下载。");
    } catch (actionError) {
      console.error("[ContractSignFlow] Failed to handle action:", actionError);
      toast.error(isEn ? "Failed to update signing flow." : "更新签署流程失败。");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSendReminder() {
    if (!contractId) return;
    if (!["awaiting_sender", "awaiting_counterparty"].includes(enhancement.signFlow.status)) {
      return;
    }

    try {
      setSubmitting(true);
      const updated = await applyContractActionForCurrentUser(
        contractId,
        "send_reminder",
        isEn ? "Reminder sent from shared sign flow." : "已从统一签署页发送提醒。",
      );
      setContract(updated);
      toast.success(isEn ? "Reminder sent." : "提醒已发送。");
    } catch (actionError) {
      console.error("[ContractSignFlow] Failed to send reminder:", actionError);
      toast.error(isEn ? "Failed to send reminder." : "发送提醒失败。");
    } finally {
      setSubmitting(false);
    }
  }

  const formatDateTime = (value?: string) => {
    if (!value) return isEn ? "Not yet" : "暂无";
    const date = new Date(value);
    return Number.isNaN(date.getTime())
      ? value
      : new Intl.DateTimeFormat(isEn ? "en-US" : "zh-CN", {
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        }).format(date);
  };

  if (loading) {
    return (
      <div className="rounded-2xl border border-border bg-background p-8 text-center text-sm text-muted-foreground">
        {isEn ? "Loading signing package..." : "正在加载签署内容..."}
      </div>
    );
  }

  if (error || !contract) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-sm text-destructive">
            {error || (isEn ? "Contract not found." : "合同不存在。")}
          </p>
          <Button className="mt-4" asChild>
            <Link href={backHref}>{resolvedBackLabel}</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  const preview =
    [
      typeof contract.content?.summary === "string" ? String(contract.content.summary) : "",
      typeof contract.sourceContent === "string" ? contract.sourceContent : "",
      typeof contract.content?.body === "string" ? String(contract.content.body) : "",
    ].filter(Boolean)[0] ||
    (isEn ? "No preview content available yet." : "当前暂无可预览内容。");

  const canSendReminder = ["awaiting_sender", "awaiting_counterparty"].includes(
    enhancement.signFlow.status,
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button variant="ghost" className="px-0" asChild>
          <Link href={backHref}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            {resolvedBackLabel}
          </Link>
        </Button>
        <Badge variant="outline">{signatureSource}</Badge>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-6">
          <Card>
            <CardContent className="pb-4 pt-4">
              <div className="flex items-start gap-3">
                <div className="rounded-lg bg-primary/10 p-2">
                  <FileText className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1">
                  <h1 className="mb-1 text-2xl font-semibold">{contract.title}</h1>
                  <p className="mb-2 text-sm text-muted-foreground">
                    {contract.parties.length
                      ? contract.parties
                          .map((party) =>
                            String(
                              party.name ||
                                party.companyName ||
                                party.company_name ||
                                (isEn ? "Signer" : "签署方"),
                            ),
                          )
                          .join(" / ")
                      : isEn
                        ? "Waiting for signer information"
                        : "等待签署方信息"}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Badge>{enhancement.signFlow.status}</Badge>
                    <Badge variant="outline">
                      {isEn
                        ? `${enhancement.signFlow.reminderCount} reminders`
                        : `${enhancement.signFlow.reminderCount} 次提醒`}
                    </Badge>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-3 pb-4 pt-4">
              <h3 className="font-semibold">{isEn ? "Signing Participants" : "签署参与方"}</h3>
              {enhancement.signFlow.participants.map((participant) => (
                <div
                  key={`${participant.role}-${participant.name}`}
                  className="rounded-lg border border-border/70 bg-muted/15 p-3"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-medium text-foreground">{participant.name}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {participant.role === "sender"
                          ? isEn
                            ? "Sender"
                            : "发起方"
                          : isEn
                            ? "Counterparty"
                            : "对方"}
                      </p>
                    </div>
                    <Badge variant={participant.status === "confirmed" ? "default" : "outline"}>
                      {participant.status === "confirmed"
                        ? isEn
                          ? "Confirmed"
                          : "已确认"
                        : isEn
                          ? "Pending"
                          : "待确认"}
                    </Badge>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {isEn ? "Confirmed at" : "确认时间"}: {formatDateTime(participant.confirmedAt)}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pb-4 pt-4">
              <h3 className="mb-3 font-semibold">{isEn ? "Document Preview" : "合同预览"}</h3>
              <div className="max-h-72 overflow-y-auto rounded-lg border border-border bg-muted/30 p-4">
                <p className="whitespace-pre-wrap text-sm text-muted-foreground">{preview}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-4 pb-4 pt-4">
              <h3 className="font-semibold">{isEn ? "Signature Method" : "签署方式"}</h3>

              <Tabs
                value={signMethod}
                onValueChange={(value) => setSignMethod(value as SignatureMethod)}
                className="w-full"
              >
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="draw" className="text-xs">
                    <Pen className="mr-1 h-4 w-4" />
                    {isEn ? "Draw" : "手写"}
                  </TabsTrigger>
                  <TabsTrigger value="type" className="text-xs">
                    <Type className="mr-1 h-4 w-4" />
                    {isEn ? "Type" : "输入"}
                  </TabsTrigger>
                  <TabsTrigger value="upload" className="text-xs">
                    <Upload className="mr-1 h-4 w-4" />
                    {isEn ? "Upload" : "上传"}
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="draw" className="space-y-3">
                  <div className="overflow-hidden rounded-lg border border-border bg-white">
                    <canvas
                      ref={canvasRef}
                      className="block w-full touch-none"
                      onPointerDown={startDrawing}
                      onPointerMove={draw}
                      onPointerUp={stopDrawing}
                      onPointerLeave={stopDrawing}
                    />
                  </div>
                  <div className="flex justify-end">
                    <Button variant="outline" size="sm" onClick={clearDrawing}>
                      <Eraser className="mr-2 h-4 w-4" />
                      {isEn ? "Clear Signature" : "清除签名"}
                    </Button>
                  </div>
                </TabsContent>

                <TabsContent value="type" className="space-y-3">
                  <Input
                    placeholder={isEn ? "Type your full name" : "输入你的完整姓名"}
                    className="text-lg font-serif"
                    value={typedName}
                    onChange={(event) => setTypedName(event.target.value)}
                  />
                  <div className="rounded-lg border border-border bg-muted/30 p-4 text-center">
                    <p className="text-2xl font-serif">
                      {typedName ||
                        (isEn
                          ? "Your signature preview appears here"
                          : "这里会显示你的签名预览")}
                    </p>
                  </div>
                </TabsContent>

                <TabsContent value="upload" className="space-y-3">
                  <label className="block cursor-pointer rounded-lg border-2 border-dashed border-border bg-muted/30 p-8 text-center">
                    <Upload className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
                    <p className="mb-2 text-sm text-muted-foreground">
                      {isEn ? "Upload signature image" : "上传签名图片"}
                    </p>
                    <span className="inline-flex rounded-md border border-input bg-background px-3 py-2 text-sm">
                      {isEn ? "Choose File" : "选择文件"}
                    </span>
                    <input className="hidden" type="file" accept="image/*" onChange={handleUpload} />
                  </label>
                  {uploadedSignature ? (
                    <div className="rounded-lg border border-border bg-white p-3">
                      <Image
                        src={uploadedSignature.dataUrl}
                        alt={isEn ? "Uploaded signature preview" : "已上传签名预览"}
                        width={320}
                        height={160}
                        className="mx-auto max-h-40 w-auto rounded object-contain"
                        unoptimized
                      />
                      <p className="mt-2 text-center text-xs text-muted-foreground">
                        {uploadedSignature.fileName}
                      </p>
                    </div>
                  ) : null}
                </TabsContent>
              </Tabs>

              <div className="flex items-start gap-3 rounded-lg border border-border/70 bg-muted/15 p-3">
                <Checkbox
                  id="sign-consent"
                  checked={legalConsent}
                  onCheckedChange={(checked) => setLegalConsent(checked === true)}
                />
                <div className="space-y-1">
                  <Label htmlFor="sign-consent" className="text-sm leading-6">
                    {isEn
                      ? "I confirm this electronic signature has the same legal effect as my handwritten signature."
                      : "我确认该电子签名与本人手写签名具有同等法律效力。"}
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    {isEn
                      ? "Signature method, timestamp, and evidence will be written back to the contract."
                      : "签署方式、时间戳和留痕证据会写回合同记录。"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="pb-4 pt-4">
              <div className="flex items-start gap-3">
                <Shield className="mt-0.5 h-5 w-5 text-primary" />
                <div>
                  <h4 className="mb-1 font-semibold text-primary">
                    {isEn ? "Secure & Traceable" : "安全且可追踪"}
                  </h4>
                  <p className="text-xs text-muted-foreground">
                    {isEn
                      ? "Signing actions, confirmations, reminders, and retained copies are written back into the contract workflow."
                      : "签署动作、确认记录、提醒发送和最终电子版留存都会回写到合同流程数据。"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {enhancement.signFlow.evidence.length ? (
            <Card>
              <CardContent className="space-y-3 pb-4 pt-4">
                <h3 className="font-semibold">{isEn ? "Evidence Records" : "签署证据"}</h3>
                {enhancement.signFlow.evidence.map((item) => (
                  <div key={item.id} className="rounded-lg border border-border/70 bg-muted/15 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-medium">{item.label}</p>
                      <Badge variant="outline">{item.type}</Badge>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{item.description}</p>
                    <p className="mt-2 text-xs text-muted-foreground">{formatDateTime(item.createdAt)}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : null}

          {enhancement.signFlow.finalCopy ? (
            <Card className="border-green-200 bg-green-50">
              <CardContent className="pb-4 pt-4">
                <div className="flex items-start gap-3">
                  <CheckCircle className="mt-0.5 h-5 w-5 text-green-700" />
                  <div className="flex-1">
                    <h3 className="font-semibold text-green-900">
                      {isEn ? "Final Copy Retained" : "电子版已留存"}
                    </h3>
                    <p className="mt-1 text-sm text-green-800">{enhancement.signFlow.finalCopy.filename}</p>
                    <p className="mt-1 text-xs text-green-700">{enhancement.signFlow.finalCopy.note}</p>
                    <div className="mt-3 flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-green-300 bg-white text-green-900 hover:bg-green-100"
                        onClick={() => void downloadContractForCurrentUser(contract.id, "pdf")}
                      >
                        <Download className="mr-2 h-4 w-4" />
                        {isEn ? "Download Copy" : "下载电子版"}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-green-300 bg-white text-green-900 hover:bg-green-100"
                        asChild
                      >
                        <Link href={resolvedOpenContractHref}>{isEn ? "Open Contract" : "查看合同"}</Link>
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardContent className="space-y-2 pb-4 pt-4">
              <Button
                className="w-full"
                size="lg"
                onClick={() => void handlePrimaryAction()}
                disabled={submitting}
              >
                <CheckCircle className="mr-2 h-5 w-5" />
                {enhancement.signFlow.status === "draft"
                  ? isEn
                    ? "Launch Signing"
                    : "发起签署"
                  : enhancement.signFlow.status === "awaiting_sender"
                    ? isEn
                      ? "Confirm Sender Signature"
                      : "确认发起方签名"
                    : enhancement.signFlow.status === "awaiting_counterparty"
                      ? isEn
                        ? "Confirm Counterparty Signature"
                        : "确认对方签名"
                      : isEn
                        ? "Download Final Copy"
                        : "下载最终电子版"}
              </Button>
              {canSendReminder ? (
                <Button
                  variant="outline"
                  className="w-full"
                  size="lg"
                  onClick={() => void handleSendReminder()}
                  disabled={submitting}
                >
                  {isEn ? "Send Reminder" : "发送提醒"}
                </Button>
              ) : null}
              <p className="pt-1 text-center text-xs text-muted-foreground">
                {isEn
                  ? "Signing records are synced with the main contract workflow."
                  : "签署记录会与主合同流程同步。"}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
