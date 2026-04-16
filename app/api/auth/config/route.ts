import { getAuthProvider, getDefaultLanguage } from "@/lib/config/deployment.config";
import { getAppUrl } from "@/lib/config/runtime-env";
import {
  getOAuthReadinessSnapshot,
  getPublicAuthConfig,
} from "@/lib/config/third-party-capabilities";

export async function GET() {
  const authConfig = getPublicAuthConfig();

  return Response.json({
    region: authConfig.region,
    defaultLanguage: getDefaultLanguage(),
    authProvider: getAuthProvider(),
    features: authConfig.features,
    availability: authConfig.availability,
    oauthReadiness: getOAuthReadinessSnapshot(),
    appUrl: getAppUrl() || undefined,
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
    supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  });
}
