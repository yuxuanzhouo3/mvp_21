"use client";

import { useEffect, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { useLanguage } from "@/components/language-provider";
import { useTranslations } from "@/lib/i18n";

function decodeBase64Utf8(input: string): string {
  const binary = atob(input);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return new TextDecoder().decode(bytes);
}

function PaymentRedirectContent() {
  const searchParams = useSearchParams();
  const formSubmitted = useRef(false);
  const { language } = useLanguage();
  const t = useTranslations(language);
  const content = t.paymentRedirectPage;

  useEffect(() => {
    if (formSubmitted.current) return;

    const formHtml = searchParams.get("form");
    if (!formHtml) {
      console.error("No payment form provided");
      return;
    }

    formSubmitted.current = true;

    try {
      const decodedHtml = decodeBase64Utf8(formHtml);

      const container = document.createElement("div");
      container.style.display = "none";
      document.body.appendChild(container);
      container.innerHTML = decodedHtml;

      const form = container.querySelector("form");
      if (form) {
        setTimeout(() => {
          form.submit();
        }, 100);
      } else {
        console.error("Form not found in HTML");
      }
    } catch (error) {
      console.error("Failed to process payment form:", error);
    }
  }, [searchParams]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-blue-500 mx-auto mb-4" />
          <CardTitle className="text-xl">{content.title}</CardTitle>
        </CardHeader>
        <CardContent className="text-center text-muted-foreground">
          <p>{content.description}</p>
          <p className="text-sm mt-2">{content.retryHint}</p>
        </CardContent>
      </Card>
    </div>
  );
}

function PaymentRedirectFallback() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-blue-500 mx-auto mb-4" />
          <CardTitle className="text-xl">Loading...</CardTitle>
        </CardHeader>
      </Card>
    </div>
  );
}

export default function PaymentRedirectPage() {
  return (
    <Suspense fallback={<PaymentRedirectFallback />}>
      <PaymentRedirectContent />
    </Suspense>
  );
}
