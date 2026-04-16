import {
  AbstractWechatProvider,
  WechatConfig,
} from "./abstract/wechat-provider";

const LEGACY_WECHAT_PROVIDER_ERROR =
  "Legacy WeChat provider is retired. Use WechatProviderV3 instead.";

/**
 * @deprecated This provider is intentionally disabled.
 * Use `WechatProviderV3` for all WeChat payment flows.
 */
export class WeChatProvider extends AbstractWechatProvider {
  constructor(config: Partial<WechatConfig> = {}) {
    super({
      appId: config.appId || "retired-app-id",
      mchId: config.mchId || "retired-mch-id",
      privateKey: config.privateKey || "retired-private-key",
      serialNo: config.serialNo || "retired-serial-no",
      notifyUrl: config.notifyUrl || "https://retired.invalid/wechat",
      apiv3PrivateKey: config.apiv3PrivateKey,
    });

    throw new Error(LEGACY_WECHAT_PROVIDER_ERROR);
  }

  protected async buildWechatOrder(_order: unknown): Promise<never> {
    throw new Error(LEGACY_WECHAT_PROVIDER_ERROR);
  }

  protected async callWechatAPI(_orderData: unknown): Promise<never> {
    throw new Error(LEGACY_WECHAT_PROVIDER_ERROR);
  }

  protected async queryPaymentStatus(_paymentId: string): Promise<never> {
    throw new Error(LEGACY_WECHAT_PROVIDER_ERROR);
  }

  protected async callRefundAPI(
    _paymentId: string,
    _amount: number,
  ): Promise<never> {
    throw new Error(LEGACY_WECHAT_PROVIDER_ERROR);
  }

  protected verifyCallbackSignature(_params: unknown): boolean {
    throw new Error(LEGACY_WECHAT_PROVIDER_ERROR);
  }
}
