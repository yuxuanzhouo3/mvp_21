import { beforeEach, describe, expect, jest, test } from "@jest/globals";

jest.mock("@/lib/config/region", () => ({
  isChinaRegion: () => true,
}));

type MockResponse = {
  ok: boolean;
  json: () => Promise<unknown>;
  text: () => Promise<string>;
};

function createJsonResponse(payload: unknown): MockResponse {
  return {
    ok: true,
    json: async () => payload,
    text: async () => JSON.stringify(payload),
  };
}

const originalEnv = process.env;
const fetchMock = jest.fn<Promise<MockResponse>, [string, RequestInit?]>();

describe("contract chat OCR provider fallback", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };
    delete process.env.DASHSCOPE_API_KEY;
    delete process.env.OPENAI_API_KEY;
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  test("uses OpenAI in CN when DashScope is not configured", async () => {
    process.env.OPENAI_API_KEY = "test-openai-key";

    fetchMock.mockResolvedValueOnce(
      createJsonResponse({
        choices: [
          {
            message: {
              content: JSON.stringify({
                sourceType: "wechat",
                conversationText: "甲方：你好",
                summary: "已识别合作事实",
              }),
            },
          },
        ],
      }),
    );

    const { analyzeContractChatScreenshot } = await import("@/lib/ocr/contract-chat");
    const result = await analyzeContractChatScreenshot(
      "data:image/png;base64,abc",
      "wechat",
    );

    expect(result.provider).toBe("openai");
    expect(result.data.sourceType).toBe("wechat");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe("https://api.openai.com/v1/chat/completions");
  });

  test("falls back to OpenAI when DashScope fails in CN", async () => {
    process.env.DASHSCOPE_API_KEY = "test-dashscope-key";
    process.env.OPENAI_API_KEY = "test-openai-key";

    fetchMock
      .mockResolvedValueOnce({
        ok: false,
        text: async () => "dashscope failed",
        json: async () => ({}),
      })
      .mockResolvedValueOnce(
        createJsonResponse({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  sourceType: "screenshot",
                  conversationText: "乙方：好的",
                  summary: "已提取文本",
                }),
              },
            },
          ],
        }),
      );

    const { analyzeContractChatScreenshot } = await import("@/lib/ocr/contract-chat");
    const result = await analyzeContractChatScreenshot(
      "data:image/png;base64,abc",
      "wechat",
    );

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0][0]).toBe(
      "https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation",
    );
    expect(fetchMock.mock.calls[1][0]).toBe("https://api.openai.com/v1/chat/completions");
    expect(result.provider).toBe("openai");
    expect(result.data.sourceType).toBe("wechat");
  });

  test("throws OCR_NOT_CONFIGURED when no provider key exists", async () => {
    const { analyzeContractChatScreenshot } = await import("@/lib/ocr/contract-chat");

    await expect(
      analyzeContractChatScreenshot("data:image/png;base64,abc", "wechat"),
    ).rejects.toMatchObject({
      code: "OCR_NOT_CONFIGURED",
    });
  });
});
