"use client";

import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, Crown, Users, Zap, AlertCircle } from "lucide-react";
import { useUser } from "@/components/user-context";
import { useLanguage } from "@/components/language-provider";
import { useTranslations } from "@/lib/i18n";
import { getAmountByCurrency } from "@/lib/payment/payment-config";

interface SubscriptionPlan {
  id: string;
  name: string;
  description: string;
  price: {
    monthly: number;
    yearly: number;
  };
  currency: string;
  features: string[];
  popular?: boolean;
  icon: React.ReactNode;
}

interface SubscriptionPlansProps {
  onSelectPlan: (planId: string, billingCycle: "monthly" | "yearly") => void;
  currentPlan?: string;
  currency?: string;
  onSwitchToPayment?: () => void;
  pricing?: {
    currency: "CNY" | "USD";
    plans: {
      pro: {
        monthly: number;
        yearly: number;
      };
    };
  };
}

// 璁㈤槄璁″垝灞傜骇瀹氫箟锛堜粠浣庡埌楂橈級
const PLAN_HIERARCHY = {
  free: 0,
  pro: 1,
};

function normalizePlanId(planId?: string | null): keyof typeof PLAN_HIERARCHY {
  if (!planId) {
    return "free";
  }

  const normalized = planId.toLowerCase();
  if (normalized === "premium") {
    return "pro";
  }

  return normalized === "pro" ? "pro" : "free";
}

export function SubscriptionPlans({
  onSelectPlan,
  currentPlan,
  currency = "USD",
  onSwitchToPayment,
  pricing,
}: SubscriptionPlansProps) {
  const { user } = useUser();
  const { language } = useLanguage();
  const t = useTranslations(language);

  // 鑾峰彇鐢ㄦ埛褰撳墠璁㈤槄璁″垝
  const userCurrentPlan = normalizePlanId(user?.subscription_plan || currentPlan);
  const userCurrentLevel =
    PLAN_HIERARCHY[userCurrentPlan as keyof typeof PLAN_HIERARCHY] ?? 0;

  // 妫€鏌ヨ鍒掓槸鍚﹀彲浠ラ€夋嫨
  const canSelectPlan = (planId: string): boolean => {
    if (planId === "free") return true; // 鍏嶈垂璁″垝鎬绘槸鍙互閫夋嫨

    const planLevel =
      PLAN_HIERARCHY[planId as keyof typeof PLAN_HIERARCHY] ?? 0;

    // 濡傛灉鐢ㄦ埛宸叉湁娲昏穬璁㈤槄锛屽彧鑳介€夋嫨鐩稿悓鎴栨洿楂樼瓑绾х殑璁″垝
    if (user?.subscription_status === "active" && userCurrentPlan !== "free") {
      return planLevel >= userCurrentLevel;
    }

    return true;
  };

  // 鑾峰彇璁″垝鐘舵€佹枃鏈?
  const getPlanStatus = (planId: string) => {
    if (planId === userCurrentPlan && user?.subscription_status === "active") {
      return t.payment.currentPlan;
    }

    if (!canSelectPlan(planId)) {
      return t.payment.upgrade;
    }

    return null;
  };

  // 鏍规嵁璐у竵纭畾浠锋牸
  const getPrice = (billingCycle: "monthly" | "yearly", usdFallback: number) => {
    if (pricing && pricing.currency === currency) {
      return pricing.plans.pro[billingCycle];
    }

    if (currency === "CNY") {
      return getAmountByCurrency("CNY", billingCycle, "pro");
    }

    return usdFallback;
  };

  // 灞曞紑鎵€鏈夎鍒掗€夐」锛堝厤璐广€佹湀浠樸€佸勾浠橈級
  const allPlans = [
    {
      id: "free",
      name: t.payment.plans.free.name,
      description: t.payment.plans.free.description,
      price: 0,
      billingCycle: "monthly" as const,
      currency: currency,
      features: t.payment.plans.free.features as unknown as string[],
      icon: <Zap className="h-6 w-6" />,
    },
    {
      id: "pro-monthly",
      planId: "pro",
      name: t.payment.proMonthly,
      description: t.payment.monthlyDesc,
      price: getPrice("monthly", 9.99),
      billingCycle: "monthly" as const,
      currency: currency,
      features: t.payment.plans.pro.features as unknown as string[],
      icon: <Crown className="h-6 w-6" />,
    },
    {
      id: "pro-yearly",
      planId: "pro",
      name: t.payment.proYearly,
      description: t.payment.yearlyDesc,
      price: getPrice("yearly", 99.99),
      billingCycle: "yearly" as const,
      currency: currency,
      features: t.payment.plans.pro.features as unknown as string[],
      popular: true,
      savings: 20,
      icon: <Crown className="h-6 w-6 text-yellow-500" />,
    },
  ];

  const formatPrice = (price: number, currency: string) => {
    if (price === 0) return t.payment.plans.free.price || "Free";
    return new Intl.NumberFormat(language === "zh" ? "zh-CN" : "en-US", {
      style: "currency",
      currency: currency,
    }).format(price);
  };

  return (
    <div className="space-y-6">
      {/* 褰撳墠浼氬憳鍒版湡鏃堕棿鏄剧ず */}
      {user && user.membership_expires_at && (
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="pt-4">
            <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center">
              <Check className="h-5 w-5 text-blue-600 shrink-0" />
              <div>
                <p className="font-medium text-blue-800">
                  {t.payment.membershipExpires}:{" "}
                  {new Date(user.membership_expires_at).toLocaleDateString(
                    language === "zh" ? "zh-CN" : "en-US",
                    { year: "numeric", month: "long", day: "numeric" },
                  )}
                </p>
                <p className="text-sm text-blue-600">
                  {t.payment.renewToExtend}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 璁㈤槄璁″垝鍗＄墖 - 鍏ㄩ儴鏄剧ず鍦ㄤ竴椤?*/}
      <div className="mx-auto grid max-w-6xl gap-4 sm:gap-6 md:grid-cols-3">
        {allPlans.map((plan) => {
          const actualPlanId =
            ("planId" in plan ? plan.planId : plan.id) || "free";
          const isCurrentPlan =
            userCurrentPlan === normalizePlanId(actualPlanId) &&
            user?.subscription_status === "active";

          return (
            <Card
              key={plan.id}
              className={`relative ${
                plan.popular ? "border-primary shadow-lg md:scale-105" : ""
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                  <Badge className="bg-primary text-primary-foreground">
                    {t.payment.mostPopular}
                  </Badge>
                </div>
              )}

              {isCurrentPlan && (
                <div className="absolute -top-3 right-4">
                  <Badge
                    variant="secondary"
                    className="bg-green-100 text-green-800"
                  >
                    {t.payment.active}
                  </Badge>
                </div>
              )}

              <CardHeader className="text-center">
                <div className="flex justify-center mb-2">{plan.icon}</div>
                <CardTitle className="text-xl">{plan.name}</CardTitle>
                <CardDescription>{plan.description}</CardDescription>
              </CardHeader>

              <CardContent className="text-center">
                <div className="mb-4">
                  <span className="text-3xl font-bold">
                    {formatPrice(plan.price, plan.currency)}
                  </span>
                  {plan.price > 0 && (
                    <span className="text-muted-foreground">
                      /
                      {language === "zh"
                        ? plan.billingCycle === "monthly"
                          ? t.payment.month
                          : t.payment.year
                        : plan.billingCycle === "monthly"
                          ? t.payment.mo
                          : t.payment.yr}
                    </span>
                  )}
                  {"savings" in plan && plan.savings && (
                    <div className="text-sm text-green-600 mt-1 font-semibold">
                      {t.payment.savePercent} {plan.savings}%
                    </div>
                  )}
                </div>

                <ul className="space-y-2 text-sm text-left">
                  {plan.features.map((feature: string, index: number) => (
                    <li key={index} className="flex items-center">
                      <Check className="h-4 w-4 text-green-500 mr-2 flex-shrink-0" />
                      {feature}
                    </li>
                  ))}
                </ul>
              </CardContent>

              <CardFooter>
                <Button
                  className="w-full"
                  variant={plan.popular ? "default" : "outline"}
                  onClick={() => {
                    onSelectPlan(actualPlanId, plan.billingCycle);
                    // 閫夋嫨璁″垝鍚庤嚜鍔ㄨ烦杞埌鏀粯鏍囩椤?
                    if (onSwitchToPayment && plan.price > 0) {
                      setTimeout(() => onSwitchToPayment(), 100);
                    }
                  }}
                  disabled={!canSelectPlan(actualPlanId)}
                >
                  {!canSelectPlan(actualPlanId)
                    ? t.payment.cancelCurrentFirst
                    : plan.price === 0
                      ? t.payment.getStarted
                      : isCurrentPlan
                        ? t.payment.renew
                        : t.payment.choosePlan}
                </Button>
              </CardFooter>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
