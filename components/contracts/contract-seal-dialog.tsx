"use client";

import { useEffect, useState, type ChangeEvent } from "react";

import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { ContractSealPayload } from "@/lib/contracts/client";

interface ContractSealDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (payload: ContractSealPayload) => Promise<void> | void;
  loading?: boolean;
  isEn: boolean;
  contractTitle?: string;
  reseal?: boolean;
}

async function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error || new Error("FILE_READ_FAILED"));
    reader.readAsDataURL(file);
  });
}

export function ContractSealDialog({
  open,
  onOpenChange,
  onSubmit,
  loading = false,
  isEn,
  contractTitle,
  reseal = false,
}: ContractSealDialogProps) {
  const [previewDataUrl, setPreviewDataUrl] = useState("");
  const [fileName, setFileName] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) {
      setPreviewDataUrl("");
      setFileName("");
      setNote("");
      setError("");
    }
  }, [open]);

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    try {
      const dataUrl = await fileToDataUrl(file);
      if (!/^data:image\/(png|jpe?g);base64,/i.test(dataUrl)) {
        setError(isEn ? "Please upload a PNG or JPG image." : "请上传 PNG 或 JPG 印章图片。");
        return;
      }
      setPreviewDataUrl(dataUrl);
      setFileName(file.name);
      setError("");
    } catch {
      setError(isEn ? "Failed to read image file." : "读取图片失败，请重试。");
    } finally {
      event.target.value = "";
    }
  }

  async function handleSubmit() {
    if (!previewDataUrl) {
      setError(isEn ? "Please upload a stamp image first." : "请先上传印章图片。");
      return;
    }

    setError("");
    await onSubmit({
      stampImageDataUrl: previewDataUrl,
      stampImageMimeType: previewDataUrl.startsWith("data:image/png") ? "image/png" : "image/jpeg",
      fileName: fileName || undefined,
      note: note.trim() || undefined,
      source: "web-contract-management",
      placement: {
        page: 1,
        x: 420,
        y: 90,
        width: 120,
        height: 120,
        opacity: 0.92,
      },
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {reseal
              ? isEn
                ? "Update Contract Seal"
                : "更新合同盖章"
              : isEn
                ? "Seal Contract"
                : "合同盖章"}
          </DialogTitle>
          <DialogDescription>
            {isEn
              ? "Upload an official stamp image to generate sealed HTML/PDF/Word exports."
              : "上传印章图片后，可生成已盖章的 HTML/PDF/Word 文件。"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {contractTitle ? (
            <div className="rounded-md border border-border/70 bg-muted/20 px-3 py-2 text-sm">
              <span className="text-muted-foreground">{isEn ? "Contract" : "合同"}: </span>
              <span className="font-medium">{contractTitle}</span>
            </div>
          ) : null}

          <div className="space-y-2">
            <Label>{isEn ? "Stamp Image (PNG/JPG)" : "印章图片（PNG/JPG）"}</Label>
            <Input type="file" accept="image/png,image/jpeg" onChange={handleFileChange} />
          </div>

          {previewDataUrl ? (
            <div className="rounded-md border border-border/70 bg-white p-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={previewDataUrl}
                alt={isEn ? "Stamp preview" : "印章预览"}
                className="mx-auto max-h-48 w-auto object-contain"
              />
              <p className="mt-2 text-center text-xs text-muted-foreground">{fileName || "-"}</p>
            </div>
          ) : null}

          <div className="space-y-2">
            <Label>{isEn ? "Note (Optional)" : "备注（可选）"}</Label>
            <Textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder={isEn ? "e.g. Official company seal confirmed." : "例如：已加盖公司公章。"}
              rows={3}
            />
          </div>

          {error ? (
            <p className="text-sm text-destructive">{error}</p>
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            {isEn ? "Cancel" : "取消"}
          </Button>
          <Button onClick={() => void handleSubmit()} disabled={loading}>
            {loading
              ? isEn
                ? "Processing..."
                : "处理中..."
              : reseal
                ? isEn
                  ? "Update Seal"
                  : "更新盖章"
                : isEn
                  ? "Seal Contract"
                  : "确认盖章"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
