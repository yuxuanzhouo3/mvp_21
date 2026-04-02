"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  AlertCircle,
  CheckCircle2,
  Clock3,
  Loader2,
  Mail,
  ShieldCheck,
  UserCheck,
  Users,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

import { useLanguage } from "@/components/language-provider";
import { useUser } from "@/components/user-context";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  acceptDashboardTeamInvite,
  getPublicDashboardTeamInvite,
} from "@/lib/dashboard/client";
import type { DashboardTeamInvitePreview } from "@/lib/dashboard/types";

function formatDateTime(value: string | undefined, isEn: boolean) {
  if (!value) {
    return isEn ? "No expiry" : "长期有效";
  }

  return new Intl.DateTimeFormat(isEn ? "en-US" : "zh-CN", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export default function WorkspaceInvitePage() {
  const params = useParams<{ token: string }>();
  const token = typeof params?.token === "string" ? params.token : "";
  const router = useRouter();
  const { language } = useLanguage();
  const isEn = language === "en";
  const { user, loading: userLoading } = useUser();
  const [preview, setPreview] = useState<DashboardTeamInvitePreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [accepting, setAccepting] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadInvite() {
      if (!token) {
        setLoading(false);
        setLoadFailed(true);
        return;
      }

      try {
        setLoading(true);
        setLoadFailed(false);
        const data = await getPublicDashboardTeamInvite(token);
        if (!cancelled) {
          setPreview(data);
        }
      } catch (error) {
        console.error("[WorkspaceInvitePage] Failed to load invite:", error);
        if (!cancelled) {
          setLoadFailed(true);
          setPreview(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadInvite();

    return () => {
      cancelled = true;
    };
  }, [token]);

  const emailMatches = useMemo(() => {
    if (!user?.email || !preview?.invite.email) {
      return false;
    }

    return user.email.trim().toLowerCase() === preview.invite.email.trim().toLowerCase();
  }, [preview?.invite.email, user?.email]);

  const statusBadge = useMemo(() => {
    switch (preview?.statusLabel) {
      case "accepted":
        return { label: isEn ? "Accepted" : "已接受", variant: "default" as const, icon: CheckCircle2 };
      case "revoked":
        return { label: isEn ? "Revoked" : "已撤销", variant: "secondary" as const, icon: XCircle };
      case "expired":
        return { label: isEn ? "Expired" : "已过期", variant: "secondary" as const, icon: AlertCircle };
      default:
        return { label: isEn ? "Pending" : "待接受", variant: "outline" as const, icon: Clock3 };
    }
  }, [isEn, preview?.statusLabel]);

  const canAccept =
    Boolean(preview?.canAccept) &&
    Boolean(user) &&
    emailMatches &&
    !accepting;

  async function handleAcceptInvite() {
    if (!token) {
      return;
    }

    if (!user) {
      router.push(`/auth?redirect=${encodeURIComponent(`/invite/workspace/${token}`)}`);
      return;
    }

    try {
      setAccepting(true);
      const result = await acceptDashboardTeamInvite(token);
      toast.success(
        isEn
          ? `Joined ${result.workspaceOwnerName}'s workspace.`
          : `已加入 ${result.workspaceOwnerName} 的工作区。`,
      );
      router.replace("/dashboard/team");
    } catch (error) {
      console.error("[WorkspaceInvitePage] Failed to accept invite:", error);
      toast.error(
        error instanceof Error && error.message
          ? error.message
          : isEn
            ? "Failed to accept workspace invite."
            : "接受工作区邀请失败。",
      );
    } finally {
      setAccepting(false);
    }
  }

  return (
    <main className="min-h-screen bg-background px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-4xl flex-col gap-6">
        <div className="flex flex-col gap-4 rounded-2xl border border-border/70 bg-card/95 p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-primary">
              <Users className="h-5 w-5" />
              <span className="text-sm font-medium">
                {isEn ? "Workspace Invitation" : "工作区邀请"}
              </span>
            </div>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              {isEn ? "Join the shared workspace" : "加入共享工作区"}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {isEn
                ? "Review the invitation details, then sign in with the invited email to accept."
                : "查看邀请详情后，使用受邀邮箱登录并接受邀请。"}
            </p>
          </div>
          <Button variant="outline" asChild>
            <Link href="/">{isEn ? "Back to Home" : "返回首页"}</Link>
          </Button>
        </div>

        {loading ? (
          <div className="flex min-h-[320px] items-center justify-center rounded-2xl border border-border/70 bg-card/90">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              {isEn ? "Loading invitation..." : "正在加载邀请..."}
            </div>
          </div>
        ) : loadFailed || !preview ? (
          <Card className="border-border/70 bg-card/95 shadow-sm">
            <CardContent className="flex min-h-[260px] items-center justify-center p-6 text-center text-sm text-muted-foreground">
              {isEn
                ? "This workspace invite is unavailable, invalid, or has already been removed."
                : "这个工作区邀请不可用、无效，或已被移除。"}
            </CardContent>
          </Card>
        ) : (
          <>
            <Card className="border-border/70 bg-card/95 shadow-sm">
              <CardHeader className="space-y-3">
                <div className="flex flex-wrap items-center gap-3">
                  <Badge variant={statusBadge.variant} className="inline-flex items-center gap-1.5">
                    <statusBadge.icon className="h-3.5 w-3.5" />
                    {statusBadge.label}
                  </Badge>
                  <Badge variant="secondary" className="inline-flex items-center gap-1.5">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    {preview.invite.role === "admin"
                      ? isEn
                        ? "Admin access"
                        : "管理员权限"
                      : isEn
                        ? "Member access"
                        : "成员权限"}
                  </Badge>
                </div>
                <CardTitle>
                  {isEn
                    ? `${preview.workspaceOwnerName} invited you to collaborate`
                    : `${preview.workspaceOwnerName} 邀请你协作`}
                </CardTitle>
                <CardDescription>
                  {isEn
                    ? "Accepting this invite will attach your account to the shared workspace and activate your member record."
                    : "接受邀请后，你的账号会加入该共享工作区，并激活团队成员身份。"}
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2">
                <div className="rounded-xl border border-border/70 bg-muted/15 p-4">
                  <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                    <Mail className="h-4 w-4 text-primary" />
                    {isEn ? "Invited email" : "受邀邮箱"}
                  </div>
                  <p className="text-sm text-muted-foreground">{preview.invite.email}</p>
                </div>
                <div className="rounded-xl border border-border/70 bg-muted/15 p-4">
                  <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                    <UserCheck className="h-4 w-4 text-primary" />
                    {isEn ? "Workspace owner" : "工作区所有者"}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {preview.workspaceOwnerName}
                    {preview.workspaceOwnerEmail ? ` · ${preview.workspaceOwnerEmail}` : ""}
                  </p>
                </div>
                <div className="rounded-xl border border-border/70 bg-muted/15 p-4">
                  <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                    <Clock3 className="h-4 w-4 text-primary" />
                    {isEn ? "Invite expiry" : "邀请有效期"}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {formatDateTime(preview.invite.expiresAt, isEn)}
                  </p>
                </div>
                <div className="rounded-xl border border-border/70 bg-muted/15 p-4">
                  <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                    <Users className="h-4 w-4 text-primary" />
                    {isEn ? "Link activity" : "链接访问"}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {isEn ? "Opened " : "已打开 "}
                    {preview.invite.accessCount}
                    {isEn ? " times" : " 次"}
                    {preview.invite.lastAccessedAt
                      ? ` · ${formatDateTime(preview.invite.lastAccessedAt, isEn)}`
                      : ""}
                  </p>
                </div>
              </CardContent>
            </Card>

            {!userLoading && !user ? (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>{isEn ? "Sign in required" : "需要先登录"}</AlertTitle>
                <AlertDescription>
                  {isEn
                    ? "Sign in with the invited email address to accept this workspace invitation."
                    : "请使用受邀邮箱登录后接受这个工作区邀请。"}
                </AlertDescription>
              </Alert>
            ) : user && !emailMatches && preview.canAccept ? (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>{isEn ? "Email does not match" : "登录邮箱不匹配"}</AlertTitle>
                <AlertDescription>
                  {isEn
                    ? `You are signed in as ${user.email}. Please switch to ${preview.invite.email} before accepting.`
                    : `你当前登录的是 ${user.email}，请切换到 ${preview.invite.email} 后再接受邀请。`}
                </AlertDescription>
              </Alert>
            ) : null}

            <div className="flex flex-col gap-3 sm:flex-row">
              <Button
                size="lg"
                onClick={() => void handleAcceptInvite()}
                disabled={!preview.canAccept || userLoading || (Boolean(user) && !canAccept)}
              >
                {accepting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {isEn ? "Accepting..." : "正在接受邀请..."}
                  </>
                ) : !user ? (
                  isEn ? "Sign in to accept" : "登录后接受邀请"
                ) : preview.statusLabel === "accepted" ? (
                  isEn ? "Already accepted" : "已被接受"
                ) : preview.statusLabel === "revoked" ? (
                  isEn ? "Invite revoked" : "邀请已撤销"
                ) : preview.statusLabel === "expired" ? (
                  isEn ? "Invite expired" : "邀请已过期"
                ) : !emailMatches ? (
                  isEn ? "Use invited email to accept" : "请使用受邀邮箱接受"
                ) : (
                  isEn ? "Accept workspace invite" : "接受工作区邀请"
                )}
              </Button>
              <Button variant="outline" size="lg" asChild>
                <Link href="/auth?mode=signin">
                  {isEn ? "Open sign-in page" : "打开登录页"}
                </Link>
              </Button>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
