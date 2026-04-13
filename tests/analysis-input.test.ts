import { prepareAnalysisInput } from "@/lib/contracts/analysis-input";

describe("prepareAnalysisInput", () => {
  test("returns normalized text without truncation when under limit", () => {
    const result = prepareAnalysisInput("  A  \r\n\r\nB   ", { maxChars: 100 });

    expect(result.truncated).toBe(false);
    expect(result.content).toBe("A\nB");
    expect(result.analyzedChars).toBe(result.content.length);
  });

  test("compacts long content and keeps within max char budget", () => {
    const longContent = Array.from({ length: 120 }, (_, index) => {
      if (index % 6 === 0) {
        return `Line ${index + 1}: payment milestone ${index + 1}, amount ${index * 1000} CNY.`;
      }
      return `Line ${index + 1}: generic discussion text about project background and schedule.`;
    }).join("\n");

    const result = prepareAnalysisInput(longContent, { maxChars: 2_600 });

    expect(result.truncated).toBe(true);
    expect(result.content.length).toBeLessThanOrEqual(2_600);
    expect(result.content).toContain("[...middle content omitted for faster AI analysis...]");
    expect(result.content).toContain("payment milestone");
  });
});
