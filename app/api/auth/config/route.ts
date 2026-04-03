import { getAuthProvider, getDefaultLanguage } from "@/lib/config/deployment.config";
import { getPublicAuthConfig } from "@/lib/config/third-party-capabilities";

export async function GET() {
  const authConfig = getPublicAuthConfig();

  return Response.json({
    region: authConfig.region,
    defaultLanguage: getDefaultLanguage(),
    authProvider: getAuthProvider(),
    features: authConfig.features,
    availability: authConfig.availability,
    wechatAppId: process.env.NEXT_PUBLIC_WECHAT_APP_ID,
    appUrl: process.env.NEXT_PUBLIC_APP_URL,
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
    supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    wechatCloudbaseId: process.env.NEXT_PUBLIC_WECHAT_CLOUDBASE_ID,
  });
}
