"use client";

/* eslint-disable react-hooks/set-state-in-effect */

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, CheckCircle } from "lucide-react";

import { BillingHistory } from "@/components/payment/billing-history";
import { PaymentForm } from "@/components/payment/payment-form";
import { SubscriptionPlans } from "@/components/payment/subscription-plans";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useLanguage } from "@/components/language-provider";
import { useUser } from "@/components/user-context";
import { useToast } from "@/hooks/use-toast";
import { RegionType } from "@/lib/architecture-modules/core/types";
import { isChinaRegion } from "@/lib/config/region";
import { useTranslations } from "@/lib/i18n";
import { getAmountByCurrency } from "@/lib/payment/payment-config";

type SelectedPlan = {
  planId: string;
  billingCycle: "monthly" | "yearly";
  amount: number;
  currency: string;
  description: string;
};

export default function PaymentPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { language } = useLanguage();
  const { user, loading } = useUser();
  const t = useTranslations(language);
  const isZh = language === "zh";

  const [initialLoadComplete, setInitialLoadComplete] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<SelectedPlan | null>(null);
  const [paymentResult, setPaymentResult] = useState<any>(null);
  const [activeTab, setActiveTab] = useState("plans");

  const currentPlan = user?.subscription_plan || "free";
  const region = isChinaRegion() ? RegionType.CHINA : RegionType.USA;
  const currency = isChinaRegion() ? "CNY" : "USD";

  const buildUrl = useCallback((path: string) => {
    if (typeof window === "undefined") {
      return path;
    }

    const debug = new URLSearchParams(window.location.search).get("debug");
    return debug ? `${path}?debug=${debug}` : path;
  }, []);

  const convertPrice = useCallback((usdPrice: number, targetCurrency: string) => {
    if (targetCurrency === "CNY") {
      return Math.round(usdPrice * 7.2 * 100) / 100;
    }

    return usdPrice;
  }, []);

  useEffect(() => {
    if (!loading) {
      return;
    }

    const timeoutId = setTimeout(() => {
      toast({
        title: t.common.loading,
        description: t.payment.subtitle,
      });
    }, 10000);

    return () => clearTimeout(timeoutId);
  }, [loading, t, toast]);

  useEffect(() => {
    if (!loading) {
      setInitialLoadComplete(true);
      return;
    }

    const timeoutId = setTimeout(() => {
      console.warn("Payment page loading timed out, forcing the initial load state to finish.");
      setInitialLoadComplete(true);
    }, 30000);

    return () => clearTimeout(timeoutId);
  }, [loading]);

  useEffect(() => {
    if (!loading && !user && initialLoadComplete) {
      router.push(buildUrl("/auth"));
    }
  }, [buildUrl, initialLoadComplete, loading, router, user]);

  const handleSelectPlan = useCallback(
    (planId: string, billingCycle: "monthly" | "yearly") => {
      const amount = getAmountByCurrency(currency, billingCycle);
      const description = isZh
        ? `专业版 - ${billingCycle === "monthly" ? "月付" : "年付"}`
        : `Pro Plan - ${billingCycle === "monthly" ? "Monthly" : "Yearly"}`;

      setSelectedPlan({
        planId,
        billingCycle,
        amount,
        currency,
        description,
      });
      setPaymentResult(null);
    },
    [currency, isZh],
  );

  const handlePaymentSuccess = useCallback(
    (result: any) => {
      setPaymentResult(result);

      if (!result.paymentUrl) {
        return;
      }

      if (
        typeof result.paymentUrl === "string" &&
        (result.paymentUrl.startsWith("weixin://") ||
          result.paymentUrl.includes("weixin://"))
      ) {
        const qrcodeUrl = `/payment/wechat-qrcode?codeUrl=${encodeURIComponent(
          result.paymentUrl,
        )}&paymentId=${encodeURIComponent(
          result.paymentId || "",
        )}&amount=${encodeURIComponent(selectedPlan?.amount || "")}`;
        window.location.href = qrcodeUrl;
        return;
      }

      if (
        typeof result.paymentUrl === "string" &&
        result.paymentUrl.includes("<form")
      ) {
        const encodedForm = btoa(result.paymentUrl);
        window.location.href = `/payment/redirect?form=${encodeURIComponent(encodedForm)}`;
        return;
      }

      window.location.href = result.paymentUrl;
    },
    [selectedPlan?.amount],
  );

  const handlePaymentError = useCallback(
    (message: string) => {
      console.error("Payment error:", message);
      toast({
        title: t.payment.messages.failed,
        description: message,
        variant: "destructive",
      });
    },
    [t.payment.messages.failed, toast],
  );

  const handleBack = useCallback(() => {
    if (selectedPlan) {
      setSelectedPlan(null);
      return;
    }

    router.back();
  }, [router, selectedPlan]);

  if (!loading && !user && initialLoadComplete) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50 p-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-muted-foreground">
                {isZh ? "正在跳转到登录页..." : "Redirecting to the login page..."}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (loading && !initialLoadComplete) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50 p-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-muted-foreground">{t.common.loading}</p>
              <p className="mt-2 text-sm text-muted-foreground">
                {isZh
                  ? "如果加载时间过长，请刷新页面后重试。"
                  : "If loading takes too long, please refresh the page and try again."}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-4">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6">
          <Button variant="ghost" onClick={handleBack} className="mb-4">
            <ArrowLeft className="mr-2 h-4 w-4" />
            {t.common.back}
          </Button>
          <h1 className="text-2xl font-bold sm:text-3xl lg:text-4xl">{t.payment.manage}</h1>
          <p className="mt-2 text-sm text-muted-foreground sm:text-base">
            {t.payment.subtitle}
          </p>
        </div>

        {paymentResult ? (
          <Card className="mb-6 border-green-200 bg-green-50">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <CheckCircle className="h-6 w-6 text-green-600" />
                <div>
                  <h3 className="font-medium text-green-800">
                    {isZh ? "支付单已创建" : "Payment order created"}
                  </h3>
                  <p className="mt-1 text-sm text-green-700">
                    {isZh
                      ? "请按照页面提示继续完成支付流程。"
                      : "Follow the next step on screen to finish the payment flow."}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : null}

        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className="space-y-4 sm:space-y-6"
        >
          <TabsList className="grid w-full grid-cols-3 gap-1 sm:gap-0">
            <TabsTrigger value="plans" className="text-xs sm:text-sm">
              {t.payment.title}
            </TabsTrigger>
            <TabsTrigger value="payment" className="text-xs sm:text-sm">
              {isZh ? "支付" : "Payment"}
            </TabsTrigger>
            <TabsTrigger value="history" className="text-xs sm:text-sm">
              {t.payment.billing}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="plans">
            <SubscriptionPlans
              onSelectPlan={handleSelectPlan}
              currentPlan={currentPlan}
              currency={currency}
              convertPrice={convertPrice}
              onSwitchToPayment={() => setActiveTab("payment")}
            />
          </TabsContent>

          <TabsContent value="payment">
            {selectedPlan ? (
              <div className="mx-auto max-w-2xl">
                <PaymentForm
                  planId={selectedPlan.planId}
                  billingCycle={selectedPlan.billingCycle}
                  amount={selectedPlan.amount}
                  currency={selectedPlan.currency}
                  description={selectedPlan.description}
                  userId={user?.id || ""}
                  region={region}
                  onSuccess={handlePaymentSuccess}
                  onError={handlePaymentError}
                />
              </div>
            ) : (
              <Card>
                <CardContent className="pt-6">
                  <div className="py-8 text-center">
                    <p className="mb-4 text-muted-foreground">
                      {isZh
                        ? "请先选择一个订阅方案。"
                        : "Please select a subscription plan first."}
                    </p>
                    <Button onClick={() => setActiveTab("plans")}>
                      {t.payment.choosePlan}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="history">
            <BillingHistory userId={user?.id || ""} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
