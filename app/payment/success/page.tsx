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
import { useUser } from "@/components/user-context";

function PaymentSuccessContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { refreshUser } = useUser();
  const { language } = useLanguage();
  const isEn = language === "en";
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
        const outTradeNo = searchParams.get("out_trade_no");
        const tradeNo = searchParams.get("trade_no");
        const wechatOutTradeNo = searchParams.get("wechat_out_trade_no");

        if (!sessionId && !token && !outTradeNo && !tradeNo && !wechatOutTradeNo) {
          throw new Error("Missing payment confirmation parameters");
        }

        const params = new URLSearchParams();
        if (sessionId) params.set("session_id", sessionId);
        if (token) params.set("token", token);
        if (outTradeNo) params.set("out_trade_no", outTradeNo);
        if (tradeNo) params.set("trade_no", tradeNo);
        if (wechatOutTradeNo) params.set("wechat_out_trade_no", wechatOutTradeNo);

        const { getAuthClient } = await import("@/lib/auth/client");
        const sessionResult = await getAuthClient().getSession();
        const session = sessionResult.data.session;

        const headers: Record<string, string> = {};
        if (session?.access_token) {
          headers["Authorization"] = `Bearer ${session.access_token}`;
        }

        const response = await fetch(`/api/payment/onetime/confirm?${params.toString()}`, {
          headers,
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || "Payment confirmation failed");
        }

        const result = await response.json();

        if (result.success) {
          setHasProcessed(true);

          setPaymentDetails({
            daysAdded: result.daysAdded,
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
          throw new Error(result.error || "Payment confirmation failed");
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
  }, [searchParams, hasProcessed, refreshUser]);

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
              <CardTitle className="text-xl">{isEn ? "Processing payment..." : "处理支付中..."}</CardTitle>
              <CardDescription>{isEn ? "Confirming your payment, please wait" : "正在确认您的支付，请稍候"}</CardDescription>
            </>
          )}

          {paymentStatus === "success" && (
            <>
              <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
              <CardTitle className="text-xl text-green-600">{isEn ? "Payment successful!" : "支付成功！"}</CardTitle>
              <CardDescription>
                {paymentDetails.daysAdded
                  ? isEn
                    ? `${paymentDetails.daysAdded} days of premium access added`
                    : `已为您添加 ${paymentDetails.daysAdded} 天高级会员`
                  : isEn
                    ? "Membership activated. Thank you for your support."
                    : "您的会员已激活，感谢您的支持"}
              </CardDescription>
              {paymentDetails.amount && paymentDetails.amount > 0 && paymentDetails.currency && (
                <div className="mt-2 text-sm text-muted-foreground">
                  {isEn ? "Amount" : "支付金额"}: {paymentDetails.amount} {paymentDetails.currency}
                </div>
              )}
            </>
          )}

          {paymentStatus === "error" && (
            <>
              <div className="h-12 w-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-red-600 text-2xl">✕</span>
              </div>
              <CardTitle className="text-xl text-red-600">{isEn ? "Payment confirmation failed" : "支付确认失败"}</CardTitle>
              <CardDescription>{isEn ? "Please contact support or try again later" : "请联系客服或稍后重试"}</CardDescription>
            </>
          )}
        </CardHeader>

        <CardContent className="text-center">
          {!isProcessing && (
            <Button onClick={handleContinue} className="w-full">
              {paymentStatus === "success" ? (isEn ? "Start using ContractHub" : "开始使用") : isEn ? "Back to Home" : "返回首页"}
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function PaymentSuccessPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 flex items-center justify-center p-4">
          <Card className="w-full max-w-md">
            <CardHeader className="text-center">
              <Loader2 className="h-12 w-12 animate-spin text-blue-500 mx-auto mb-4" />
              <CardTitle className="text-xl">Loading...</CardTitle>
            </CardHeader>
          </Card>
        </div>
      }
    >
      <PaymentSuccessContent />
    </Suspense>
  );
}
