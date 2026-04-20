"use client";

import { useEffect, useRef, useState } from "react";
import { AlertCircle, CreditCard, Loader2, Smartphone } from "lucide-react";

import { useLanguage } from "@/components/language-provider";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { getAuthClient } from "@/lib/auth/client";
import { RegionType } from "@/lib/architecture-modules/core/types";
import { paymentRouter } from "@/lib/architecture-modules/layers/third-party/payment/router";
import { useTranslations } from "@/lib/i18n";
import { getPricingByMethod, type PaymentMethod } from "@/lib/payment/payment-config";
import { toast } from "@/hooks/use-toast";

interface PaymentFormProps {
  planId: string;
  billingCycle: "monthly" | "yearly";
  amount: number;
  currency: string;
  description: string;
  userId: string;
  region: RegionType;
  onSuccess: (result: any) => void;
  onError: (error: string) => void;
  currentSubscription?: {
    planId: string;
    status: string;
  };
  pricing?: {
    currency: "CNY" | "USD";
    plans: {
      pro: {
        monthly: number;
        yearly: number;
      };
      enterprise: {
        monthly: number;
        yearly: number;
      };
    };
  };
}

interface PaymentConfigResponse {
  availableMethods: string[];
  methods: Record<string, { enabled: boolean; reason?: string }>;
}

export function PaymentForm({
  planId,
  billingCycle,
  amount,
  currency,
  description,
  userId,
  region,
  onSuccess,
  onError,
  currentSubscription,
  pricing,
}: PaymentFormProps) {
  const [selectedMethod, setSelectedMethod] = useState<string>("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentConfig, setPaymentConfig] = useState<PaymentConfigResponse | null>(null);
  const { language } = useLanguage();
  const isEn = language === "en";
  const t = useTranslations(language);

  const paymentRequestRef = useRef<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const deploymentRegion = region === RegionType.CHINA ? "CN" : "INTL";

  const regionMethods = paymentRouter.getAvailableMethods(region);
  const resolvedMethods = paymentConfig?.availableMethods ?? regionMethods;
  const availableMethods =
    deploymentRegion === "INTL"
      ? resolvedMethods.filter((method) => method === "stripe" || method === "paypal")
      : resolvedMethods.filter((method) => method === "wechat" || method === "alipay");
  const unavailableReasons = regionMethods
    .map((method) => ({
      method,
      enabled: paymentConfig?.methods?.[method]?.enabled,
      reason: paymentConfig?.methods?.[method]?.reason,
    }))
    .filter((item) => item.enabled === false && item.reason);

  const paymentMethods = {
    stripe: {
      name: t.payment.methods.stripe.name,
      icon: <CreditCard className="h-5 w-5" />,
      description: t.payment.methods.stripe.description,
    },
    paypal: {
      name: "PayPal",
      icon: <CreditCard className="h-5 w-5" />,
      description: "Pay with PayPal account",
    },
    wechat: {
      name: t.payment.methods.wechat.name,
      icon: <Smartphone className="h-5 w-5" />,
      description: t.payment.methods.wechat.description,
    },
    alipay: {
      name: t.payment.methods.alipay.name,
      icon: <Smartphone className="h-5 w-5" />,
      description: t.payment.methods.alipay.description,
    },
  };

  useEffect(() => {
    let cancelled = false;

    async function fetchPaymentConfig() {
      try {
        const response = await fetch("/api/payment/config", {
          method: "GET",
          cache: "no-store",
        });

        if (!response.ok) {
          return;
        }

        const nextConfig = (await response.json()) as PaymentConfigResponse;
        if (!cancelled) {
          setPaymentConfig(nextConfig);
        }
      } catch (error) {
        console.error("[PaymentForm] Failed to load payment config:", error);
      }
    }

    void fetchPaymentConfig();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (selectedMethod && !availableMethods.some((method) => method === selectedMethod)) {
      setSelectedMethod("");
    }
  }, [availableMethods, selectedMethod]);

  useEffect(() => {
    if (!selectedMethod && availableMethods.length === 1) {
      setSelectedMethod(availableMethods[0]);
    }
  }, [availableMethods, selectedMethod]);

  const handlePayment = async () => {
    if (!selectedMethod) {
      onError(t.payment.selectPaymentMethod);
      return;
    }

    if (isProcessing) {
      console.warn("Payment already in progress, ignoring duplicate click");
      return;
    }

    const idempotencyKey = `${userId}-${planId}-${billingCycle}-${amount}-${Date.now()}`;
    if (paymentRequestRef.current === idempotencyKey) {
      console.warn("Duplicate payment request with same idempotency key, ignoring");
      return;
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    paymentRequestRef.current = idempotencyKey;
    setIsProcessing(true);

    try {
      const canonicalPricing =
        pricing && pricing.currency === currency
          ? {
              currency: pricing.currency,
              monthly:
                planId === "enterprise"
                  ? pricing.plans.enterprise.monthly
                  : pricing.plans.pro.monthly,
              yearly:
                planId === "enterprise"
                  ? pricing.plans.enterprise.yearly
                  : pricing.plans.pro.yearly,
              planType: planId === "enterprise" ? "enterprise" : "pro",
            }
          : getPricingByMethod(selectedMethod as PaymentMethod, planId);
      const canonicalAmount = canonicalPricing[billingCycle];
      const canonicalCurrency = canonicalPricing.currency;

      try {
        localStorage.setItem(
          "pending_payment",
          JSON.stringify({
            planType: planId,
            billingCycle,
            userId,
            amount: canonicalAmount,
            currency: canonicalCurrency,
            description,
            idempotencyKey,
          }),
        );
      } catch (error) {
        console.warn("pending_payment localStorage write failed", error);
      }

      const controller = new AbortController();
      abortControllerRef.current = controller;
      const timeoutId = setTimeout(() => controller.abort(), 20000);

      console.time("create-payment");
      const sessionResult = await getAuthClient().getSession();
      const token = sessionResult.data.session?.access_token;

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      const response = await fetch("/api/payment/create", {
        method: "POST",
        headers,
        body: JSON.stringify({
          method: selectedMethod,
          amount: canonicalAmount,
          currency: canonicalCurrency,
          description,
          planType: planId,
          billingCycle,
          idempotencyKey,
        }),
        signal: controller.signal,
      });

      console.timeEnd("create-payment");
      clearTimeout(timeoutId);
      abortControllerRef.current = null;

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));

        if (errorData.code === "DUPLICATE_SUBSCRIPTION") {
          throw new Error(t.payment.messages.failed);
        }

        if (errorData.code === "DUPLICATE_PAYMENT_REQUEST") {
          throw new Error(
            isEn
              ? "Duplicate payment detected, please do not click multiple times."
              : "检测到重复支付请求，请勿重复点击。",
          );
        }

        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const result = await response.json();
      const normalizedResult = result?.data
        ? {
            ...result.data,
            success: result.success,
            paymentId: result.data.paymentId || result.data.orderId,
            paymentUrl: result.data.paymentUrl,
            codeUrl: result.data.codeUrl,
          }
        : result;

      if (normalizedResult.success) {
        onSuccess(normalizedResult);
        return;
      }

      const message = normalizedResult.error || t.payment.messages.failed;
      onError(message);
      toast({
        title: t.payment.messages.failed,
        description: String(message),
        variant: "destructive",
      });
    } catch (error) {
      console.error("Payment error:", error);
      const isAbort = (error as { name?: string })?.name === "AbortError";
      const message = isAbort
        ? isEn
          ? "Request timed out. Please try again."
          : "请求超时，请稍后重试。"
        : error instanceof Error
          ? error.message
          : isEn
            ? "Unknown error"
            : "未知错误";

      onError(`${t.payment.messages.failed}: ${message}`);
      toast({
        title: t.payment.messages.failed,
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
      setTimeout(() => {
        paymentRequestRef.current = null;
      }, 3000);
    }
  };

  const formatAmount = (nextAmount: number, nextCurrency: string) =>
    new Intl.NumberFormat(isEn ? "en-US" : "zh-CN", {
      style: "currency",
      currency: nextCurrency,
    }).format(nextAmount);

  if (availableMethods.length === 0) {
    return (
      <Card>
        <CardContent className="space-y-3 pt-6">
          <div className="text-center text-muted-foreground">
            {t.payment.onlineUnavailable}
          </div>
          {unavailableReasons.length > 0 ? (
            <Alert>
              <AlertDescription>
                {unavailableReasons.map((item) => `${item.method}: ${item.reason}`).join(" ")}
              </AlertDescription>
            </Alert>
          ) : null}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CreditCard className="h-5 w-5" />
          {t.payment.selectPaymentMethod}
        </CardTitle>
        <CardDescription>{t.payment.subtitle}</CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {currentSubscription?.status === "active" ? (
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-blue-600" />
              <span className="text-sm font-medium text-blue-800">
                {t.payment.currentPlan}: {currentSubscription.planId}
              </span>
            </div>
            <p className="mt-1 text-sm text-blue-600">
              {isEn
                ? "This purchase will replace your current subscription."
                : "本次购买将替换你当前的订阅计划。"}
            </p>
          </div>
        ) : null}

        <div className="rounded-lg bg-muted/50 p-4">
          <h3 className="mb-2 font-medium">{t.payment.orderSummary}</h3>
          <div className="space-y-1 text-sm">
            <div className="flex items-start justify-between gap-3">
              <span className="break-words">{description}</span>
              <span className="shrink-0">{formatAmount(amount, currency)}</span>
            </div>
            <Separator />
            <div className="flex justify-between font-medium">
              <span>{t.payment.total}</span>
              <span>{formatAmount(amount, currency)}</span>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <h3 className="font-medium">{isEn ? "Payment Methods" : "支付方式"}</h3>
          {unavailableReasons.length > 0 ? (
            <Alert>
              <AlertDescription>
                {isEn
                  ? "Some payment methods are hidden because the current deployment is not fully configured."
                  : "部分支付方式已隐藏，因为当前环境尚未完成对应配置。"}
              </AlertDescription>
            </Alert>
          ) : null}
          <div className="grid gap-3">
            {availableMethods.map((method) => {
              const methodInfo = paymentMethods[method as keyof typeof paymentMethods];
              if (!methodInfo) {
                return null;
              }

              return (
                <div
                  key={method}
                  className={`cursor-pointer rounded-lg border p-4 transition-colors ${
                    selectedMethod === method
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50"
                  } ${isProcessing ? "cursor-not-allowed opacity-50" : ""}`}
                  onClick={() => !isProcessing && setSelectedMethod(method)}
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex min-w-0 items-center gap-3">
                      {methodInfo.icon}
                      <div className="min-w-0">
                        <div className="font-medium">{methodInfo.name}</div>
                        <div className="break-words text-sm text-muted-foreground">
                          {methodInfo.description}
                        </div>
                      </div>
                    </div>
                    {selectedMethod === method ? (
                      <Badge variant="default" className="w-fit">
                        {isEn ? "Selected" : "已选择"}
                      </Badge>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <Button
          className="w-full"
          size="lg"
          onClick={handlePayment}
          disabled={!selectedMethod || isProcessing}
        >
          {isProcessing ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {isEn ? "Processing..." : "婢跺嫮鎮婃稉?.."}
            </>
          ) : (
            <>
              {t.payment.payNow} {formatAmount(amount, currency)}
            </>
          )}
        </Button>

        <div className="text-center text-sm text-muted-foreground">
          <div className="flex items-center justify-center gap-1">
            <CreditCard className="h-4 w-4" />
            {isEn
              ? "Your payment information is securely processed by payment providers."
              : "你的支付信息将由支付服务商安全处理。"}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
