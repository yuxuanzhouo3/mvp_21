"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, Save, Tags } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { isChinaRegion } from "@/lib/config/region";

function getRegion(): "CN" | "INTL" {
  return isChinaRegion() ? "CN" : "INTL";
}

type PricingPayload = {
  region: "CN" | "INTL";
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
  updatedAt?: string;
};

export default function AdminPricingPage() {
  const isIntl = getRegion() === "INTL";
  const tx = (zh: string, en: string) => (isIntl ? en : zh);
  const loadFailedText = tx("加载定价失败", "Failed to load pricing");
  const saveFailedText = tx("保存失败", "Failed to save pricing");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [currency, setCurrency] = useState<"CNY" | "USD">(isIntl ? "USD" : "CNY");
  const [form, setForm] = useState({
    proMonthly: "",
    proYearly: "",
    enterpriseMonthly: "",
    enterpriseYearly: "",
  });

  useEffect(() => {
    let cancelled = false;

    async function loadPricing() {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch("/api/admin/pricing", {
          method: "GET",
          cache: "no-store",
        });

        const payload = (await response.json()) as {
          success?: boolean;
          data?: PricingPayload;
          error?: { message?: string };
        };

        if (!response.ok || !payload.success || !payload.data) {
          throw new Error(payload.error?.message || loadFailedText);
        }

        if (cancelled) {
          return;
        }

        setCurrency(payload.data.currency);
        setForm({
          proMonthly: String(payload.data.plans.pro.monthly),
          proYearly: String(payload.data.plans.pro.yearly),
          enterpriseMonthly: String(payload.data.plans.enterprise.monthly),
          enterpriseYearly: String(payload.data.plans.enterprise.yearly),
        });
      } catch (nextError) {
        if (!cancelled) {
          setError(nextError instanceof Error ? nextError.message : loadFailedText);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadPricing();

    return () => {
      cancelled = true;
    };
  }, [loadFailedText]);

  const priceSymbol = useMemo(() => (currency === "CNY" ? "￥" : "$"), [currency]);

  const onFieldChange = (key: keyof typeof form, value: string) => {
    setForm((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  async function handleSave() {
    setSaving(true);
    setError(null);
    setSuccess(null);

    const values = {
      pro: {
        monthly: Number(form.proMonthly),
        yearly: Number(form.proYearly),
      },
      enterprise: {
        monthly: Number(form.enterpriseMonthly),
        yearly: Number(form.enterpriseYearly),
      },
    };

    if (
      Number.isNaN(values.pro.monthly) ||
      Number.isNaN(values.pro.yearly) ||
      Number.isNaN(values.enterprise.monthly) ||
      Number.isNaN(values.enterprise.yearly) ||
      values.pro.monthly <= 0 ||
      values.pro.yearly <= 0 ||
      values.enterprise.monthly <= 0 ||
      values.enterprise.yearly <= 0
    ) {
      setSaving(false);
      setError(tx("请输入大于 0 的定价金额", "Please enter valid amounts greater than 0"));
      return;
    }

    try {
      const response = await fetch("/api/admin/pricing", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(values),
      });

      const payload = (await response.json()) as {
        success?: boolean;
        data?: PricingPayload;
        error?: { message?: string };
      };

      if (!response.ok || !payload.success || !payload.data) {
        throw new Error(payload.error?.message || saveFailedText);
      }

      setCurrency(payload.data.currency);
      setForm({
        proMonthly: String(payload.data.plans.pro.monthly),
        proYearly: String(payload.data.plans.pro.yearly),
        enterpriseMonthly: String(payload.data.plans.enterprise.monthly),
        enterpriseYearly: String(payload.data.plans.enterprise.yearly),
      });
      setSuccess(tx("定价已保存", "Pricing has been saved"));
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : saveFailedText);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{tx("定价管理", "Pricing Management")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {tx(
            "管理员可在这里动态调整套餐金额，前台和支付会自动读取最新配置。",
            "Admins can update plan prices here. Website and checkout will read latest values automatically.",
          )}
        </p>
      </div>

      <Card className="max-w-3xl">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Tags className="h-5 w-5 text-primary" />
            <CardTitle>{tx("套餐价格", "Plan Pricing")}</CardTitle>
          </div>
          <CardDescription>
            {tx("当前币种", "Current currency")}: {currency} ({priceSymbol})
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {error ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}

          {success ? (
            <Alert>
              <AlertDescription>{success}</AlertDescription>
            </Alert>
          ) : null}

          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              {tx("加载中...", "Loading...")}
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="proMonthly">{tx("专业版月费", "Pro Monthly")}</Label>
                <Input
                  id="proMonthly"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.proMonthly}
                  onChange={(event) => onFieldChange("proMonthly", event.target.value)}
                  disabled={saving}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="proYearly">{tx("专业版年费", "Pro Yearly")}</Label>
                <Input
                  id="proYearly"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.proYearly}
                  onChange={(event) => onFieldChange("proYearly", event.target.value)}
                  disabled={saving}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="enterpriseMonthly">{tx("企业版月费", "Enterprise Monthly")}</Label>
                <Input
                  id="enterpriseMonthly"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.enterpriseMonthly}
                  onChange={(event) => onFieldChange("enterpriseMonthly", event.target.value)}
                  disabled={saving}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="enterpriseYearly">{tx("企业版年费", "Enterprise Yearly")}</Label>
                <Input
                  id="enterpriseYearly"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.enterpriseYearly}
                  onChange={(event) => onFieldChange("enterpriseYearly", event.target.value)}
                  disabled={saving}
                />
              </div>
            </div>
          )}

          <Button onClick={handleSave} disabled={loading || saving}>
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {tx("保存中...", "Saving...")}
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                {tx("保存定价", "Save Pricing")}
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
