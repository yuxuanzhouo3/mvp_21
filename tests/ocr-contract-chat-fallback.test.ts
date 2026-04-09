import { beforeEach, describe, expect, jest, test } from "@jest/globals";

jest.mock("@/lib/config/region", () => ({
  isChinaRegion: () => true,
}));

type MockResponse = {
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
  text: () => Promise<string>;
};

function createJsonResponse(payload: unknown): MockResponse {
  return {
    ok: true,
    status: 200,
    json: async () => payload,
    text: async () => JSON.stringify(payload),
  };
}

const originalEnv = process.env;
const fetchMock: jest.Mock = jest.fn();

describe("contract chat OCR dashscope only", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };
    delete process.env.DASHSCOPE_API_KEY;
    delete process.env.OPENAI_API_KEY;
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  test("uses DashScope when DASHSCOPE_API_KEY is configured", async () => {
    process.env.DASHSCOPE_API_KEY = "test-dashscope-key";

    (fetchMock as any).mockResolvedValueOnce(
      createJsonResponse({
        output: {
          choices: [
            {
              message: {
                content: [
                  {
                    text: JSON.stringify({
                      sourceType: "wechat",
                      conversationText: "甲方：你好",
                      summary: "已识别合作事实",
                    }),
                  },
                ],
              },
            },
          ],
        },
      }),
    );

    const { analyzeContractChatScreenshot } = await import("@/lib/ocr/contract-chat");
    const result = await analyzeContractChatScreenshot(
      "data:image/png;base64,abc",
      "wechat",
    );

    expect(result.provider).toBe("dashscope");
    expect(result.data.sourceType).toBe("wechat");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe(
      "https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation",
    );
  });

  test("throws OCR_KEY_UNAVAILABLE when DASHSCOPE_API_KEY is missing", async () => {
    const { analyzeContractChatScreenshot } = await import("@/lib/ocr/contract-chat");

    await expect(
      analyzeContractChatScreenshot("data:image/png;base64,abc", "wechat"),
    ).rejects.toMatchObject({
      code: "OCR_KEY_UNAVAILABLE",
    });
  });

  test("does not fallback to OpenAI when DashScope fails", async () => {
    process.env.DASHSCOPE_API_KEY = "test-dashscope-key";
    process.env.OPENAI_API_KEY = "test-openai-key";

    (fetchMock as any).mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: async () => "dashscope failed",
      json: async () => ({}),
    });

    const { analyzeContractChatScreenshot } = await import("@/lib/ocr/contract-chat");

    await expect(
      analyzeContractChatScreenshot("data:image/png;base64,abc", "wechat"),
    ).rejects.toMatchObject({
      code: "OCR_PROVIDER_FAILED",
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe(
      "https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation",
    );
  });
});
