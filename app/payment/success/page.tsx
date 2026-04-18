"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle, Loader2 } from "lucide-react";
import { useLanguage } from "@/components/language-provider";
import { useTranslations } from "@/lib/i18n";
import { useUser } from "@/components/user-context";

function PaymentSuccessContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { refreshUser } = useUser();
  const { language } = useLanguage();
  const t = useTranslations(language);
  const content = t.paymentSuccessPage;
  const errorTitle = content.errorTitle;
  const missingParameters = content.missingParameters;
  const [isProcessing, setIsProcessing] = useState(true);
  const [paymentStatus, setPaymentStatus] = useState<"processing" | "success" | "error">("processing");
  const [paymentDetails, setPaymentDetails] = useState<{
    daysAdded?: number;
    amount?: number;
    currency?: string;
  }>({});
  const [hasProcessed, setHasProcessed] = useState(false);

  useEffect(() => {
    if (hasProcessed) {
      return;
    }

    const handlePaymentSuccess = async () => {
      try {
        const sessionId = searchParams.get("session_id");
        const token = searchParams.get("token");
        const outTradeNo = searchParams.get("out_trade_no") || searchParams.get("outTradeNo");
        const tradeNo = searchParams.get("trade_no") || searchParams.get("tradeNo");
        const wechatOutTradeNo = searchParams.get("wechat_out_trade_no");

        if (!sessionId && !token && !outTradeNo && !tradeNo && !wechatOutTradeNo) {
          throw new Error(missingParameters);
        }

        const paymentReference =
          wechatOutTradeNo || outTradeNo || tradeNo || sessionId || token;

        if (!paymentReference) {
          throw new Error(missingParameters);
        }

        const body: Record<string, string> = {
          paymentId: paymentReference,
        };

        if (token) {
          body.token = token;
        }

        const { getAuthClient } = await import("@/lib/auth/client");
        const sessionResult = await getAuthClient().getSession();
        const session = sessionResult.data.session;

        const headers: Record<string, string> = {
          "Content-Type": "application/json",
        };
        if (session?.access_token) {
          headers["Authorization"] = `Bearer ${session.access_token}`;
        }

        if (outTradeNo) {
          body.outTradeNo = outTradeNo;
        }
        if (tradeNo) {
          body.tradeNo = tradeNo;
        }
        if (sessionId) {
          body.sessionId = sessionId;
        }
        if (wechatOutTradeNo) {
          body.wechatOutTradeNo = wechatOutTradeNo;
        }

        let result: any = null;
        let lastErrorMessage = "";
        const maxAttempts = 4;
        for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
          const response = await fetch("/api/payment/confirm", {
            method: "POST",
            headers,
            body: JSON.stringify(body),
          });

          if (response.ok) {
            result = await response.json();
            break;
          }

          const errorData = await response.json().catch(() => ({}));
          lastErrorMessage = String(errorData?.error || errorTitle);
          const retriable =
            response.status === 404 ||
            response.status === 400 ||
            lastErrorMessage.includes("not found") ||
            lastErrorMessage.includes("confirmation failed");

          if (!retriable || attempt === maxAttempts) {
            throw new Error(lastErrorMessage || errorTitle);
          }

          await new Promise((resolve) => setTimeout(resolve, attempt * 1200));
        }

        if (!result) {
          throw new Error(lastErrorMessage || errorTitle);
        }

        if (result.success) {
          setHasProcessed(true);

          setPaymentDetails({
            amount: result.amount,
            currency: result.currency,
          });

          try {
            localStorage.removeItem("pending_payment");
          } catch {
            // ignore localStorage errors
          }

          try {
            await refreshUser();
          } catch {
            // ignore refresh failures, payment result is already confirmed
          }

          setPaymentStatus("success");
        } else {
          throw new Error(result.error || errorTitle);
        }
      } catch (error) {
        console.error("Payment confirmation error:", error);
        setPaymentStatus("error");
        setHasProcessed(true);
      } finally {
        setIsProcessing(false);
      }
    };

    handlePaymentSuccess();
  }, [searchParams, hasProcessed, refreshUser, errorTitle, missingParameters]);

  const handleContinue = () => {
    router.push("/");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          {paymentStatus === "processing" && (
            <>
              <Loader2 className="h-12 w-12 animate-spin text-blue-500 mx-auto mb-4" />
              <CardTitle className="text-xl">{content.processingTitle}</CardTitle>
              <CardDescription>{content.processingDescription}</CardDescription>
            </>
          )}

          {paymentStatus === "success" && (
            <>
              <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
              <CardTitle className="text-xl text-green-600">{content.successTitle}</CardTitle>
              <CardDescription>
                {paymentDetails.daysAdded
                  ? content.successDaysAdded.replace("{days}", String(paymentDetails.daysAdded))
                  : content.successMembership}
              </CardDescription>
              {paymentDetails.amount && paymentDetails.amount > 0 && paymentDetails.currency && (
                <div className="mt-2 text-sm text-muted-foreground">
                  {content.amount}: {paymentDetails.amount} {paymentDetails.currency}
                </div>
              )}
            </>
          )}

          {paymentStatus === "error" && (
            <>
              <div className="h-12 w-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-red-600 text-2xl">✕</span>
              </div>
              <CardTitle className="text-xl text-red-600">{content.errorTitle}</CardTitle>
              <CardDescription>{content.errorDescription}</CardDescription>
            </>
          )}
        </CardHeader>

        <CardContent className="text-center">
          {!isProcessing && (
            <Button onClick={handleContinue} className="w-full">
              {paymentStatus === "success" ? content.successAction : content.backHome}
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function PaymentSuccessPage() {
  const { language } = useLanguage();
  const t = useTranslations(language);

  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 flex items-center justify-center p-4">
          <Card className="w-full max-w-md">
            <CardHeader className="text-center">
              <Loader2 className="h-12 w-12 animate-spin text-blue-500 mx-auto mb-4" />
              <CardTitle className="text-xl">{t.common.loading}</CardTitle>
            </CardHeader>
          </Card>
        </div>
      }
    >
      <PaymentSuccessContent />
    </Suspense>
  );
}
