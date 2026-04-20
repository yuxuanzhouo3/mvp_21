import { RegionConfig } from "@/lib/config/region";

export type PaymentMethod = "wechat" | "alipay" | "stripe" | "paypal";

export interface PaymentMethodConfig {
  label: string;
  color: string;
  icon: string;
}

const paymentMethodConfigs: Record<PaymentMethod, PaymentMethodConfig> = {
  wechat: {
    label: "WeChat Pay",
    color: "bg-green-600",
    icon: "WX",
  },
  alipay: {
    label: "Alipay",
    color: "bg-blue-600",
    icon: "ALI",
  },
  stripe: {
    label: "Stripe",
    color: "bg-purple-600",
    icon: "ST",
  },
  paypal: {
    label: "PayPal",
    color: "bg-sky-700",
    icon: "PP",
  },
};

export function getAvailablePaymentMethods(): PaymentMethod[] {
  return RegionConfig.payment.methods as PaymentMethod[];
}

export function getPaymentMethodConfig(method: string): PaymentMethodConfig {
  return (
    paymentMethodConfigs[method as PaymentMethod] || {
      label: method,
      color: "bg-gray-600",
      icon: "?",
    }
  );
}
