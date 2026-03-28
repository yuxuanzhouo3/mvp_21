import {
  currentRegion,
  getAuthProvider,
  getDefaultLanguage,
  isAuthFeatureSupported,
} from "@/lib/config/deployment.config";

export async function GET() {
  return Response.json({
    region: currentRegion,
    defaultLanguage: getDefaultLanguage(),
    authProvider: getAuthProvider(),
    features: {
      emailAuth: isAuthFeatureSupported("emailAuth"),
      wechatAuth: isAuthFeatureSupported("wechatAuth"),
      googleAuth: isAuthFeatureSupported("googleAuth"),
      githubAuth: isAuthFeatureSupported("githubAuth"),
    },
    wechatAppId: process.env.NEXT_PUBLIC_WECHAT_APP_ID,
    appUrl: process.env.NEXT_PUBLIC_APP_URL,
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
    supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    wechatCloudbaseId: process.env.NEXT_PUBLIC_WECHAT_CLOUDBASE_ID,
  });
}
