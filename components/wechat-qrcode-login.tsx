"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Loader2, RefreshCw } from "lucide-react";
import { useLanguage } from "@/components/language-provider";

export function WechatQrcodeLogin({
  onSuccess,
  onError,
}: {
  onSuccess?: () => void;
  onError?: (error: string) => void;
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [qrcodeUrl, setQrcodeUrl] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const { language } = useLanguage();
  const isEn = language === "en";

  const fetchQrcodeUrl = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch("/api/auth/cloudbase-wechat/qrcode");

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || (isEn ? "Failed to get WeChat QR code" : "获取微信二维码失败"));
      }

      const data = await response.json();
      setQrcodeUrl(data.qrcodeUrl);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : isEn ? "Failed to load QR code" : "加载二维码失败";
      setError(errorMessage);
      onError?.(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchQrcodeUrl();
    setRefreshing(false);
  };

  useEffect(() => {
    fetchQrcodeUrl();
  }, []);

  if (loading) {
    return (
      <Card className="w-full">
        <CardContent className="pt-6">
          <div className="flex flex-col items-center justify-center space-y-4">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            <p className="text-center text-gray-600">{isEn ? "Loading WeChat QR code..." : "加载微信二维码..."}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="w-full">
        <CardContent className="pt-6">
          <Alert variant="destructive" className="mb-4">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
          <Button onClick={handleRefresh} variant="outline" className="w-full" disabled={refreshing}>
            {refreshing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {isEn ? "Reloading..." : "重新加载..."}
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4 mr-2" />
                {isEn ? "Reload" : "重新加载"}
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!qrcodeUrl) {
    return (
      <Card className="w-full">
        <CardContent className="pt-6">
          <Alert variant="destructive">
            <AlertDescription>{isEn ? "Unable to get WeChat login QR code" : "无法获取微信登录二维码"}</AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="text-center">{isEn ? "WeChat Sign In" : "微信扫码登录"}</CardTitle>
        <CardDescription className="text-center">{isEn ? "Scan with WeChat for instant sign in" : "使用微信扫描二维码快速登录"}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col items-center space-y-4">
        <div className="w-64 h-64 flex items-center justify-center bg-gray-100 rounded-lg border-2 border-gray-300">
          <div className="text-center">
            <p className="text-gray-600 mb-4">{isEn ? "Click below to open WeChat login" : "点击下方按钮进行微信扫码登录"}</p>
            <Button
              onClick={() => {
                if (qrcodeUrl) {
                  window.location.href = qrcodeUrl;
                  onSuccess?.();
                }
              }}
              className="w-full"
            >
              {isEn ? "Open WeChat Login" : "打开微信扫码登录"}
            </Button>
          </div>
        </div>

        <p className="text-sm text-gray-500 text-center">{isEn ? "QR code expires in 5 minutes" : "二维码 5 分钟后过期，请及时扫描"}</p>

        <Button onClick={handleRefresh} variant="outline" className="w-full" disabled={refreshing}>
          {refreshing ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              {isEn ? "Refreshing..." : "刷新中..."}
            </>
          ) : (
            <>
              <RefreshCw className="h-4 w-4 mr-2" />
              {isEn ? "Refresh QR Code" : "刷新二维码"}
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
