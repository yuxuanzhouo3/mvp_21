import { describe, expect, test } from "@jest/globals";
import { readFileSync } from "node:fs";
import { join } from "node:path";

function readProjectFile(relativePath: string) {
  return readFileSync(join(process.cwd(), relativePath), "utf8");
}

describe("core contract flow governance", () => {
  test("auth entry APIs keep register and login POST handlers", () => {
    const registerRoute = readProjectFile("app/api/auth/register/route.ts");
    const loginRoute = readProjectFile("app/api/auth/login/route.ts");

    expect(registerRoute).toContain("export async function POST");
    expect(loginRoute).toContain("export async function POST");
  });

  test("contract APIs keep create/query, detail update, and export capabilities", () => {
    const contractsRoute = readProjectFile("app/api/contracts/route.ts");
    const contractDetailRoute = readProjectFile("app/api/contracts/[id]/route.ts");
    const contractExportRoute = readProjectFile("app/api/contracts/[id]/export/route.ts");

    expect(contractsRoute).toContain("export async function GET");
    expect(contractsRoute).toContain("export async function POST");

    expect(contractDetailRoute).toContain("export async function GET");
    expect(contractDetailRoute).toContain("export async function PUT");
    expect(contractDetailRoute).toContain("export async function DELETE");
    expect(contractDetailRoute).toContain("Invalid JSON body.");
    expect(contractDetailRoute).toContain("Request body must be an object.");

    expect(contractDetailRoute).toContain("const CONTRACT_ACTIONS");
    expect(contractDetailRoute).toContain('"start_signing"');
    expect(contractDetailRoute).toContain('"confirm_sender"');
    expect(contractDetailRoute).toContain('"confirm_counterparty"');
    expect(contractDetailRoute).toContain('"send_reminder"');

    expect(contractExportRoute).toContain('format === "pdf"');
    expect(contractExportRoute).toContain('"Content-Type": "application/pdf"');

    expect(contractsRoute).toContain("parsePositiveInt");
    expect(contractsRoute).toContain("normalizeContractStatus(status)");
    expect(contractsRoute).toContain("Invalid JSON body.");
  });

  test("dashboard sign page still mounts the unified ContractSignFlow", () => {
    const dashboardSignPage = readProjectFile("app/dashboard/contracts/[id]/sign/page.tsx");
    expect(dashboardSignPage).toContain("ContractSignFlow");
    expect(dashboardSignPage).toContain("signatureSource=\"dashboard-web\"");
  });

  test("auth routes keep JSON guard and client IP normalization", () => {
    const registerRoute = readProjectFile("app/api/auth/register/route.ts");
    const loginRoute = readProjectFile("app/api/auth/login/route.ts");

    expect(registerRoute).toContain("getClientIp");
    expect(registerRoute).toContain("Invalid JSON body");
    expect(registerRoute).toContain("forwarded.split");
    expect(registerRoute).toContain("emailForLog");

    expect(loginRoute).toContain("getClientIp");
    expect(loginRoute).toContain("Invalid JSON body");
    expect(loginRoute).toContain("forwarded.split");
  });
});
