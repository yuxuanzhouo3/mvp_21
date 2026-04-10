import { redirect } from "next/navigation";

type SearchParams = Record<string, string | string[] | undefined>;
interface SignupPageProps {
  searchParams: Promise<SearchParams>;
}

function readParam(searchParams: SearchParams, key: string): string {
  const value = searchParams[key];
  if (Array.isArray(value)) {
    return value[0] || "";
  }
  return value || "";
}

function normalizeRedirectTarget(value: string): string | null {
  if (!value.startsWith("/") || value.startsWith("//")) {
    return null;
  }
  return value;
}

export default async function SignupPage({
  searchParams,
}: SignupPageProps) {
  const params = await searchParams;
  const requestedRedirect = normalizeRedirectTarget(readParam(params, "redirect"));
  const requestedPlan = readParam(params, "plan").toLowerCase();
  const requestedCycle = readParam(params, "cycle").toLowerCase();
  const debug = readParam(params, "debug");

  let nextRedirect = requestedRedirect;

  if (!nextRedirect && requestedPlan === "pro") {
    const cycle = requestedCycle === "yearly" ? "yearly" : "monthly";
    nextRedirect = `/payment?plan=pro&cycle=${cycle}&tab=payment`;
  }

  const authParams = new URLSearchParams();
  authParams.set("mode", "signup");
  if (nextRedirect) {
    authParams.set("redirect", nextRedirect);
  }
  if (debug) {
    authParams.set("debug", debug);
  }

  redirect(`/auth?${authParams.toString()}`);
}
