import { redirect } from "next/navigation";

type SearchParams = Record<string, string | string[] | undefined>;
interface LoginPageProps {
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

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const requestedRedirect = normalizeRedirectTarget(readParam(params, "redirect"));
  const debug = readParam(params, "debug");
  const authParams = new URLSearchParams();
  authParams.set("mode", "signin");
  if (requestedRedirect) {
    authParams.set("redirect", requestedRedirect);
  }
  if (debug) {
    authParams.set("debug", debug);
  }

  redirect(`/auth?${authParams.toString()}`);
}
