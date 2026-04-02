import { getAppDisplayName } from "@/lib/config/deployment.config";
import { isChinaRegion } from "@/lib/config/region";

export interface AdminSettings {
  general: {
    platformName: string;
    domain: string;
    description: string;
    supportEmail: string;
    salesEmail: string;
    hotline: string;
  };
  features: {
    userRegistration: boolean;
    adDisplay: boolean;
    aiContractGeneration: boolean;
    maintenanceMode: boolean;
  };
  quota: {
    freeContractsPerMonth: number;
    freeStorageDays: number;
    proContractsPerMonth: string;
    proStorageDays: string;
  };
  payment: {
    channels: {
      wechat: boolean;
      alipay: boolean;
      stripe: boolean;
      paypal: boolean;
    };
    pricing: {
      proMonthlyCny: number;
      proYearlyCny: number;
      enterpriseMonthlyCny: number;
      enterpriseYearlyCny: number;
    };
  };
  notification: {
    email: {
      newUserSignup: boolean;
      paymentSuccess: boolean;
      paymentFailure: boolean;
      subscriptionExpiry: boolean;
    };
    admin: {
      notificationEmails: string;
      dailyReport: boolean;
      exceptionAlerts: boolean;
    };
  };
  updatedAt?: string;
}

function readString(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function readBoolean(value: unknown, fallback = false) {
  return typeof value === "boolean" ? value : fallback;
}

function readNumber(value: unknown, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function readRecord(value: unknown) {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function getDefaultDomain() {
  return (
    process.env.NEXT_PUBLIC_APP_DOMAIN ||
    process.env.APP_DOMAIN ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.SITE_URL ||
    "morncontract.com"
  )
    .replace(/^https?:\/\//, "")
    .replace(/\/+$/, "");
}

function getDefaultHotline() {
  return isChinaRegion() ? "400-800-2026" : "+1 (800) 800-2026";
}

function getDefaultSupportEmail() {
  return process.env.SUPPORT_EMAIL || process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "support@morncontract.com";
}

function getDefaultSalesEmail() {
  return process.env.SALES_EMAIL || process.env.NEXT_PUBLIC_SALES_EMAIL || "sales@morncontract.com";
}

export const DEFAULT_ADMIN_SETTINGS: AdminSettings = {
  general: {
    platformName: getAppDisplayName(),
    domain: getDefaultDomain(),
    description:
      "AI-powered contract workspace that turns conversations into compliant drafts, signing tasks, and retained records.",
    supportEmail: getDefaultSupportEmail(),
    salesEmail: getDefaultSalesEmail(),
    hotline: getDefaultHotline(),
  },
  features: {
    userRegistration: true,
    adDisplay: true,
    aiContractGeneration: true,
    maintenanceMode: false,
  },
  quota: {
    freeContractsPerMonth: 10,
    freeStorageDays: 7,
    proContractsPerMonth: "unlimited",
    proStorageDays: "unlimited",
  },
  payment: {
    channels: {
      wechat: true,
      alipay: true,
      stripe: true,
      paypal: true,
    },
    pricing: {
      proMonthlyCny: 29,
      proYearlyCny: 199,
      enterpriseMonthlyCny: 99,
      enterpriseYearlyCny: 799,
    },
  },
  notification: {
    email: {
      newUserSignup: true,
      paymentSuccess: true,
      paymentFailure: true,
      subscriptionExpiry: true,
    },
    admin: {
      notificationEmails: "admin@morncontract.com",
      dailyReport: true,
      exceptionAlerts: true,
    },
  },
};

export function normalizeAdminSettings(value: unknown): AdminSettings {
  const root = readRecord(value);
  const general = readRecord(root.general);
  const features = readRecord(root.features);
  const quota = readRecord(root.quota);
  const payment = readRecord(root.payment);
  const channels = readRecord(payment.channels);
  const pricing = readRecord(payment.pricing);
  const notification = readRecord(root.notification);
  const email = readRecord(notification.email);
  const admin = readRecord(notification.admin);

  return {
    general: {
      platformName: readString(general.platformName, DEFAULT_ADMIN_SETTINGS.general.platformName),
      domain: readString(general.domain, DEFAULT_ADMIN_SETTINGS.general.domain),
      description: readString(general.description, DEFAULT_ADMIN_SETTINGS.general.description),
      supportEmail: readString(general.supportEmail, DEFAULT_ADMIN_SETTINGS.general.supportEmail),
      salesEmail: readString(general.salesEmail, DEFAULT_ADMIN_SETTINGS.general.salesEmail),
      hotline: readString(general.hotline, DEFAULT_ADMIN_SETTINGS.general.hotline),
    },
    features: {
      userRegistration: readBoolean(features.userRegistration, DEFAULT_ADMIN_SETTINGS.features.userRegistration),
      adDisplay: readBoolean(features.adDisplay, DEFAULT_ADMIN_SETTINGS.features.adDisplay),
      aiContractGeneration: readBoolean(
        features.aiContractGeneration,
        DEFAULT_ADMIN_SETTINGS.features.aiContractGeneration,
      ),
      maintenanceMode: readBoolean(features.maintenanceMode, DEFAULT_ADMIN_SETTINGS.features.maintenanceMode),
    },
    quota: {
      freeContractsPerMonth: readNumber(
        quota.freeContractsPerMonth,
        DEFAULT_ADMIN_SETTINGS.quota.freeContractsPerMonth,
      ),
      freeStorageDays: readNumber(quota.freeStorageDays, DEFAULT_ADMIN_SETTINGS.quota.freeStorageDays),
      proContractsPerMonth: readString(
        quota.proContractsPerMonth,
        DEFAULT_ADMIN_SETTINGS.quota.proContractsPerMonth,
      ),
      proStorageDays: readString(quota.proStorageDays, DEFAULT_ADMIN_SETTINGS.quota.proStorageDays),
    },
    payment: {
      channels: {
        wechat: readBoolean(channels.wechat, DEFAULT_ADMIN_SETTINGS.payment.channels.wechat),
        alipay: readBoolean(channels.alipay, DEFAULT_ADMIN_SETTINGS.payment.channels.alipay),
        stripe: readBoolean(channels.stripe, DEFAULT_ADMIN_SETTINGS.payment.channels.stripe),
        paypal: readBoolean(channels.paypal, DEFAULT_ADMIN_SETTINGS.payment.channels.paypal),
      },
      pricing: {
        proMonthlyCny: readNumber(pricing.proMonthlyCny, DEFAULT_ADMIN_SETTINGS.payment.pricing.proMonthlyCny),
        proYearlyCny: readNumber(pricing.proYearlyCny, DEFAULT_ADMIN_SETTINGS.payment.pricing.proYearlyCny),
        enterpriseMonthlyCny: readNumber(
          pricing.enterpriseMonthlyCny,
          DEFAULT_ADMIN_SETTINGS.payment.pricing.enterpriseMonthlyCny,
        ),
        enterpriseYearlyCny: readNumber(
          pricing.enterpriseYearlyCny,
          DEFAULT_ADMIN_SETTINGS.payment.pricing.enterpriseYearlyCny,
        ),
      },
    },
    notification: {
      email: {
        newUserSignup: readBoolean(email.newUserSignup, DEFAULT_ADMIN_SETTINGS.notification.email.newUserSignup),
        paymentSuccess: readBoolean(email.paymentSuccess, DEFAULT_ADMIN_SETTINGS.notification.email.paymentSuccess),
        paymentFailure: readBoolean(email.paymentFailure, DEFAULT_ADMIN_SETTINGS.notification.email.paymentFailure),
        subscriptionExpiry: readBoolean(
          email.subscriptionExpiry,
          DEFAULT_ADMIN_SETTINGS.notification.email.subscriptionExpiry,
        ),
      },
      admin: {
        notificationEmails: readString(
          admin.notificationEmails,
          DEFAULT_ADMIN_SETTINGS.notification.admin.notificationEmails,
        ),
        dailyReport: readBoolean(admin.dailyReport, DEFAULT_ADMIN_SETTINGS.notification.admin.dailyReport),
        exceptionAlerts: readBoolean(
          admin.exceptionAlerts,
          DEFAULT_ADMIN_SETTINGS.notification.admin.exceptionAlerts,
        ),
      },
    },
    updatedAt: readString(root.updatedAt) || undefined,
  };
}
