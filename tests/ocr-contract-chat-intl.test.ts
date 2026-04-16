import { beforeEach, describe, expect, jest, test } from "@jest/globals";

const mockCreate = jest.fn();
const originalEnv = process.env;

jest.mock("@/lib/config/region", () => ({
  isChinaRegion: () => false,
}));

jest.mock("openai", () => ({
  __esModule: true,
  default: class OpenAI {
    chat = {
      completions: {
        create: mockCreate,
      },
    };
  },
}));

describe("contract chat OCR intl openai provider", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };
    delete process.env.DASHSCOPE_API_KEY;
    delete process.env.OPENAI_API_KEY;
  });

  test("uses OpenAI when OPENAI_API_KEY is configured", async () => {
    process.env.OPENAI_API_KEY = "sk-test-openai";

    mockCreate.mockResolvedValueOnce({
      choices: [
        {
          message: {
            content: JSON.stringify({
              sourceType: "feishu",
              conversationText: "Alice: please send signed copy",
              summary: "Counterparty asks for signed copy.",
            }),
          },
        },
      ],
    });

    const { analyzeContractChatScreenshot } = await import("@/lib/ocr/contract-chat");
    const result = await analyzeContractChatScreenshot(
      "data:image/png;base64,abc",
      "feishu",
    );

    expect(result.provider).toBe("openai");
    expect(result.data.sourceType).toBe("feishu");
    expect(mockCreate).toHaveBeenCalledTimes(1);
  });

  test("throws OCR_KEY_UNAVAILABLE when OPENAI_API_KEY is missing", async () => {
    const { analyzeContractChatScreenshot } = await import("@/lib/ocr/contract-chat");

    await expect(
      analyzeContractChatScreenshot("data:image/png;base64,abc", "wechat"),
    ).rejects.toMatchObject({
      code: "OCR_KEY_UNAVAILABLE",
      provider: "openai",
    });
  });
});
