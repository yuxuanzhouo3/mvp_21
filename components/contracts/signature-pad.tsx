"use client"

import { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Pen, Type, Upload, RotateCcw } from "lucide-react"
import { useLanguage } from "@/components/language-provider"

interface SignaturePadProps {
  onSign: () => void
}

export function SignaturePad({ onSign }: SignaturePadProps) {
  const { language } = useLanguage()
  const isEn = language === "en"
  const [signatureMethod, setSignatureMethod] = useState("draw")

  return (
    <Card>
      <CardContent className="pt-6">
        <h3 className="font-semibold mb-4">{isEn ? "Add Your Signature" : "添加签名"}</h3>

        <Tabs value={signatureMethod} onValueChange={setSignatureMethod}>
          <TabsList className="grid w-full grid-cols-3 mb-4">
            <TabsTrigger value="draw" className="text-xs sm:text-sm">
              <Pen className="h-4 w-4 mr-2" />
              {isEn ? "Draw" : "手写"}
            </TabsTrigger>
            <TabsTrigger value="type" className="text-xs sm:text-sm">
              <Type className="h-4 w-4 mr-2" />
              {isEn ? "Type" : "键入"}
            </TabsTrigger>
            <TabsTrigger value="upload" className="text-xs sm:text-sm">
              <Upload className="h-4 w-4 mr-2" />
              {isEn ? "Upload" : "上传"}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="draw">
            <div className="border-2 border-dashed border-border rounded-lg p-4 bg-muted/30 h-40 sm:h-48 flex items-center justify-center cursor-crosshair">
              <p className="text-sm text-muted-foreground">{isEn ? "Draw your signature here" : "请在此手写签名"}</p>
            </div>
            <div className="mt-2 flex justify-end">
              <Button variant="ghost" size="sm" className="w-full sm:w-auto">
                <RotateCcw className="h-4 w-4 mr-2" />
                {isEn ? "Clear" : "清除"}
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="type">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="typed-signature">{isEn ? "Type your full name" : "输入完整姓名"}</Label>
                <Input
                  id="typed-signature"
                  placeholder={isEn ? "John Smith" : "张三"}
                  className="font-serif text-xl sm:text-2xl"
                />
              </div>
              <div className="border border-border rounded-lg p-4 sm:p-6 bg-muted/30 text-center">
                <p className="font-serif text-2xl sm:text-3xl">{isEn ? "John Smith" : "张三"}</p>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="upload">
            <div className="border-2 border-dashed border-border rounded-lg p-6 sm:p-8 bg-muted/30 text-center">
              <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm text-muted-foreground mb-2">
                {isEn ? "Upload an image of your signature" : "上传签名图片"}
              </p>
              <Button variant="outline" size="sm">
                {isEn ? "Choose File" : "选择文件"}
              </Button>
            </div>
          </TabsContent>
        </Tabs>

        <div className="mt-6 p-4 rounded-lg bg-muted">
          <p className="text-xs text-muted-foreground mb-3">
            {isEn
              ? 'By clicking "Sign Contract", I agree that this electronic signature is the legal equivalent of my manual signature and I consent to be legally bound by this contract.'
              : "点击“签署合同”即表示我同意该电子签名与手写签名具有同等法律效力，并受本合同约束。"}
          </p>
          <Button className="w-full" onClick={onSign}>
            {isEn ? "Sign Contract" : "签署合同"}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
