import { beforeEach, describe, expect, jest, test } from "@jest/globals";

const mockPageExec = jest.fn();
const mockExec = jest.fn();
const mockCheckNotifySignV2 = jest.fn();
const mockAlipaySdk = jest.fn().mockImplementation((config: unknown) => ({
  __config: config,
  pageExec: mockPageExec,
  exec: mockExec,
  checkNotifySignV2: mockCheckNotifySignV2,
}));

jest.mock("alipay-sdk", () => ({
  AlipaySdk: mockAlipaySdk,
}));

import { AlipayProvider } from "@/lib/architecture-modules/layers/third-party/payment/providers/alipay-provider";

const pkcs8PrivateKey = [
  "-----BEGIN PRIVATE KEY-----",
  "MIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQCoH5upO4ldZgMY",
  "VwODLKM3zl9xZMHfis9Cntyl5RmWXRnvjRQl4+FwFCcEndNP/m6KoAPSmhL1rWOP",
  "b5NXX9QIiG7Ubn7ld5uegCPPmmat3UtjN1lqNnh/dpA6tD5pUm3efm8Jv2TW5Hoy",
  "AJj5+zO3i0QMClovu/6vulaMkIPMvvQ5hPvGnB3Jaul+c9XTzq1NKEWTD/8HM74K",
  "1Tb5EC2OYUyzbEw3HhGE0VXNBY6UqxYSZBPVoNnduO+6RG8JKywc8t3gGDl7U0X3",
  "NZJESDXH1rjQwL5Rzh54GOvkRl8G5BR3oyv09ygqGLbxqfQmthLbq8HTuMijDOUb",
  "vozK7913AgMBAAECggEBAILULfbQrMFwm+H5/HK8brsDroP4K2JAi67FHuE92d6H",
  "zqH6f/5ISetE02QlSQZL8UuQ38ioOy7RYdOBuP/aQ47sVIqc/cSlggUipDtuZI7R",
  "0VOBA+TCRJyz7+Ku1o5xJaxpaREFznvnSivVCTYmxAUFq8tO1wWkXrny4Fz8LIRL",
  "pW6RKx+8peTLYydj73toLqZ5OhLsYQR9B1yDeYdyVF8EBScOZlVba7ap6FJP4Rpx",
  "NkcjEjBX8Cpk5eH3X+7I/tQHSqZNcF9rWbFuRTAvtBstuqRNXHhlZR8P6Ycptgf5",
  "DORirAtjm16hJT5MawLGcesos+6RYkQyDVK7nvaSoFECgYEA1/gRH3wdSKh+kVcZ",
  "ZKTD9Y7E3pyBvWcbywtVzGFoTfh96+RkR9DKMWdbKI8s7DFM2FbDR8jjIVdH5xwB",
  "qbrUTflPw1C5obwgsvfpYFDrSMfgZ3jcmGl0E46zNgfSTxj3S8C4i7yVWCTo3p9e",
  "0f0BlRYbP/jX7Rxsfj2emuCKYGkCgYEAx0k5n5kj7Cgj4Ku3rHwfAxs1UtVVP3KN",
  "9pgtjL3qqqA4yFhEbrK/tqRQG3sTWk7/H8dRN9DV1TnmlroNu6b+IuYmb5nVzB+J",
  "goszudjLUp1GjHH387OlPsm/dbQy+xL4T1nUB65cqyjMk3BWj8/5usnLAF2Dvihe",
  "tNHcpv7akt8CgYBahHJIy/BKH7TMncDa2eP365q/4sDN7YVMmLehLcJVy6ybTeJp",
  "5yyXgEZIvZmKdS9MDTFTyPLJapeMWcSoqtGIzNGNfywOiZb668U4xTGYE44OUC3F",
  "A43PFKQwJR8UX9ZmPaQbjTLa+r1PcWSAhpY/MkDBkz6M9rjSQGlVaH8W4QKBgHt/",
  "74vudYqWXZWQFSV5Tia4p9ULi+bj8QJO0HuV/mV7IXVW7iHD+HcRYOuG3DltF0H0",
  "XWq/qqSXW0UxS+1s0bWC93LV3N7A9JDH/2g+59Hs0Zmbz1NhkxhUIqio4aci3Gsg",
  "efvAnIEdqZn9VkeNVW/iOkGhslEX54kbPSjoaz/1AoGBALJPodjjMnnIFRLmznoh",
  "w75fxaFrfieUqkiKb2W6m0P3Md4KO+onYVKn7VRRDY1erX7UT0xmGKQl1YjKwZb5",
  "wVMiRGSdMh8HxPuctI0pKDe+5JVqiXSbMj/0BSxbSDq2/KbMV4YVcChXlWGi2St+",
  "k3xylB4WFXKDxQ2yHhDvE31u",
  "-----END PRIVATE KEY-----",
].join("\\n");

const alipayPublicKey =
  "MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAowCQHHA7MRDQRSMN0P+q/CAFneTG+94cPZR1DllxHi6HP4seteh8+dYBIfe+sF28jlI5YVpX35w8fGYHDTQRoD//OxFrelW4i75mn5ycZm3N7FLlIdMovfhFoPxavmgGCp/OHqQyaJgrBXNkzdZRrHWcHLtVhB7F6hxmBWcNDEPUahlglnpTFe5JgwBXWA70D2MfqpT3Z8ul+4YHMDVH3Yj18wzLPLC8jHxhlaLA+qUy/OC3OQyzA540CS7oWwIJEXMuBl1/qQAKY8f033u1NsFasboLfEnwTSOrdDy95xAIf8xt/zZEP+cABuKdRNifPZ4mdjDZu7U6AOPPycc7SQIDAQAB";

describe("alipay provider sdk config", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.APP_URL = "https://morncontract.mornscience.top";
    process.env.NEXT_PUBLIC_APP_URL = "https://morncontract.mornscience.top";
  });

  test("uses PKCS8 for production private keys and normalizes PEM values", () => {
    new AlipayProvider({
      ALIPAY_APP_ID: "2021006129689124",
      ALIPAY_PRIVATE_KEY: pkcs8PrivateKey,
      ALIPAY_ALIPAY_PUBLIC_KEY: alipayPublicKey,
      ALIPAY_SANDBOX: "false",
    });

    expect(mockAlipaySdk).toHaveBeenCalledTimes(1);
    const sdkConfig = mockAlipaySdk.mock.calls[0][0] as Record<string, string>;

    expect(sdkConfig.keyType).toBe("PKCS8");
    expect(sdkConfig.gateway).toBe("https://openapi.alipay.com/gateway.do");
    expect(sdkConfig.privateKey).toContain("BEGIN PRIVATE KEY");
    expect(sdkConfig.privateKey).not.toContain("\\n");
    expect(sdkConfig.alipayPublicKey).toContain("BEGIN PUBLIC KEY");
    expect(sdkConfig.alipayPublicKey).not.toContain("\\n");
  });
});
