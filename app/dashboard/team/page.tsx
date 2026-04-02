"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Clock3,
  Copy,
  ExternalLink,
  Mail,
  MoreVertical,
  ShieldCheck,
  UserPlus,
} from "lucide-react";
import { toast } from "sonner";

import { useLanguage } from "@/components/language-provider";
import { ConsoleShell } from "@/components/layout/console-shell";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  getDashboardTeamMembers,
  inviteDashboardTeamMember,
  removeDashboardTeamMember,
  updateDashboardTeamMember,
} from "@/lib/dashboard/client";
import type { DashboardTeamMember, DashboardTeamPermissions } from "@/lib/dashboard/types";

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

function formatDateTime(value: string | undefined, isEn: boolean, emptyLabel: string) {
  if (!value) {
    return emptyLabel;
  }

  return new Intl.DateTimeFormat(isEn ? "en-US" : "zh-CN", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export default function TeamPage() {
  const { language } = useLanguage();
  const isEn = language === "en";
  const [members, setMembers] = useState<DashboardTeamMember[]>([]);
  const [permissions, setPermissions] = useState<DashboardTeamPermissions>({
    currentRole: "owner",
    canInvite: true,
    canManageRoles: true,
    canRemoveMembers: true,
    canChangeStatus: true,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [inviteForm, setInviteForm] = useState({
    email: "",
    name: "",
    role: "member" as DashboardTeamMember["role"],
  });
  const [memberToRemove, setMemberToRemove] = useState<DashboardTeamMember | null>(null);

  const labels = {
    overview: isEn ? "Overview" : "概览",
    team: isEn ? "Team" : "团队",
  };

  const content = {
    title: isEn ? "Team Members" : "团队成员",
    description: isEn
      ? "Manage real workspace members, invite links, and role permissions."
      : "管理真实工作区成员、邀请链接和角色权限。",
    primaryAction: isEn ? "Invite Member" : "邀请成员",
    membersTitle: isEn ? "Members" : "成员列表",
    membersDescription: isEn
      ? "People who can access this workspace"
      : "当前可以访问这个工作区的成员",
    remove: isEn ? "Remove" : "移除成员",
    owner: isEn ? "Owner" : "所有者",
    admin: isEn ? "Admin" : "管理员",
    member: isEn ? "Member" : "成员",
    active: isEn ? "Active" : "正常",
    invited: isEn ? "Invited" : "已邀请",
    suspended: isEn ? "Suspended" : "已停用",
    emptyTitle: isEn ? "No members yet" : "暂无成员",
    emptyDescription: isEn
      ? "Workspace members stored in the database will appear here."
      : "数据库中的工作区成员会显示在这里。",
    loadFailed: isEn ? "Failed to load members." : "加载成员失败。",
  };

  const roleLabels = {
    owner: content.owner,
    admin: content.admin,
    member: content.member,
  } as const;

  const statusLabels = {
    active: content.active,
    invited: content.invited,
    suspended: content.suspended,
  } as const;

  const counts = useMemo(
    () => ({
      active: members.filter((member) => member.status === "active").length,
      invited: members.filter((member) => member.status === "invited").length,
      admins: members.filter((member) => member.role === "owner" || member.role === "admin").length,
    }),
    [members],
  );

  const loadMembers = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const result = await getDashboardTeamMembers();
      setMembers(result.members || []);
      setPermissions((current) => result.permissions || current);
    } catch (loadError) {
      console.error("[TeamPage] Failed to load members:", loadError);
      setError(content.loadFailed);
    } finally {
      setLoading(false);
    }
  }, [content.loadFailed]);

  useEffect(() => {
    void loadMembers();
  }, [loadMembers]);

  async function handleInviteMember() {
    if (!inviteForm.email.trim()) {
      toast.error(isEn ? "Please enter an email address." : "请输入成员邮箱。");
      return;
    }

    try {
      setSubmitting(true);
      const result = await inviteDashboardTeamMember(inviteForm);
      setMembers(result.members || []);
      setPermissions(result.permissions || permissions);
      setInviteOpen(false);
      setInviteForm({
        email: "",
        name: "",
        role: "member",
      });

      if (result.latestInvite?.inviteUrl) {
        try {
          await navigator.clipboard.writeText(result.latestInvite.inviteUrl);
          toast.success(
            isEn ? "Invitation saved and link copied." : "邀请已保存，链接已复制。",
          );
        } catch {
          toast.success(isEn ? "Invitation saved." : "邀请已保存。");
        }
      } else {
        toast.success(isEn ? "Invitation saved." : "邀请已保存。");
      }
    } catch (inviteError) {
      console.error("[TeamPage] Failed to invite member:", inviteError);
      toast.error(
        getErrorMessage(inviteError, isEn ? "Failed to invite member." : "邀请成员失败。"),
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRoleChange(member: DashboardTeamMember, role: DashboardTeamMember["role"]) {
    if (member.role === role) {
      return;
    }

    try {
      setSubmitting(true);
      const result = await updateDashboardTeamMember(member.id, { role });
      setMembers(result.members || []);
      setPermissions(result.permissions || permissions);
      toast.success(isEn ? "Role updated." : "角色已更新。");
    } catch (roleError) {
      console.error("[TeamPage] Failed to update role:", roleError);
      toast.error(getErrorMessage(roleError, isEn ? "Failed to update role." : "更新角色失败。"));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleStatusChange(
    member: DashboardTeamMember,
    status: DashboardTeamMember["status"],
  ) {
    if (member.status === status) {
      return;
    }

    try {
      setSubmitting(true);
      const result = await updateDashboardTeamMember(member.id, { status });
      setMembers(result.members || []);
      setPermissions(result.permissions || permissions);

      if (status === "invited" && result.latestInvite?.inviteUrl) {
        try {
          await navigator.clipboard.writeText(result.latestInvite.inviteUrl);
          toast.success(
            isEn ? "Invite regenerated and link copied." : "邀请已重发，链接已复制。",
          );
        } catch {
          toast.success(isEn ? "Member status updated." : "成员状态已更新。");
        }
      } else {
        toast.success(isEn ? "Member status updated." : "成员状态已更新。");
      }
    } catch (statusError) {
      console.error("[TeamPage] Failed to update status:", statusError);
      toast.error(
        getErrorMessage(
          statusError,
          isEn ? "Failed to update member status." : "更新成员状态失败。",
        ),
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRemoveMember() {
    if (!memberToRemove) {
      return;
    }

    try {
      setSubmitting(true);
      const result = await removeDashboardTeamMember(memberToRemove.id);
      setMembers(result.members || []);
      setPermissions(result.permissions || permissions);
      toast.success(isEn ? "Member removed." : "成员已移除。");
      setMemberToRemove(null);
    } catch (removeError) {
      console.error("[TeamPage] Failed to remove member:", removeError);
      toast.error(
        getErrorMessage(removeError, isEn ? "Failed to remove member." : "移除成员失败。"),
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCopyInviteLink(member: DashboardTeamMember) {
    const inviteUrl = member.invite?.inviteUrl;
    if (!inviteUrl) {
      toast.error(isEn ? "Invite link is not ready yet." : "邀请链接暂未生成。");
      return;
    }

    try {
      await navigator.clipboard.writeText(inviteUrl);
      toast.success(isEn ? "Invite link copied." : "邀请链接已复制。");
    } catch (copyError) {
      console.error("[TeamPage] Failed to copy invite link:", copyError);
      toast.error(isEn ? "Failed to copy invite link." : "复制邀请链接失败。");
    }
  }

  function handleOpenInviteLink(member: DashboardTeamMember) {
    const inviteUrl = member.invite?.inviteUrl;
    if (!inviteUrl) {
      toast.error(isEn ? "Invite link is not ready yet." : "邀请链接暂未生成。");
      return;
    }

    window.open(inviteUrl, "_blank", "noopener,noreferrer");
  }

  const canManageMember = (member: DashboardTeamMember) =>
    member.role !== "owner" &&
    (permissions.currentRole === "owner" ||
      (permissions.currentRole === "admin" && member.role === "member"));

  const canOpenMemberMenu = (member: DashboardTeamMember) =>
    canManageMember(member) &&
    (permissions.canManageRoles || permissions.canChangeStatus || permissions.canRemoveMembers);

  const formatLastActive = (member: DashboardTeamMember) => {
    if (!member.lastActiveAt) {
      return isEn ? "No activity yet" : "暂无活跃记录";
    }

    return formatDateTime(member.lastActiveAt, isEn, isEn ? "No activity yet" : "暂无活跃记录");
  };

  const formatInviteStatus = (member: DashboardTeamMember) => {
    switch (member.invite?.status) {
      case "accepted":
        return isEn ? "Accepted" : "已接受";
      case "revoked":
        return isEn ? "Revoked" : "已撤销";
      case "expired":
        return isEn ? "Expired" : "已过期";
      default:
        return isEn ? "Pending" : "待接受";
    }
  };

  return (
    <>
      <ConsoleShell
        crumbs={[
          { label: labels.overview, href: "/dashboard" },
          { label: labels.team },
        ]}
        title={content.title}
        description={content.description}
        actions={
          <Button size="sm" onClick={() => setInviteOpen(true)} disabled={!permissions.canInvite}>
            <UserPlus className="mr-2 h-4 w-4" />
            {content.primaryAction}
          </Button>
        }
      >
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
          <Card className="border-border/70 bg-card/95 shadow-sm">
            <CardHeader>
              <CardTitle>
                {content.membersTitle} ({members.length})
              </CardTitle>
              <CardDescription>{content.membersDescription}</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="py-6 text-sm text-muted-foreground">
                  {isEn ? "Loading members..." : "正在加载成员..."}
                </div>
              ) : error ? (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {error}
                </div>
              ) : members.length === 0 ? (
                <div className="rounded-lg border border-border/70 bg-muted/15 px-4 py-6">
                  <p className="font-medium">{content.emptyTitle}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{content.emptyDescription}</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {members.map((member) => (
                    <div
                      key={member.id}
                      className="flex flex-col gap-4 rounded-lg border border-border/70 bg-muted/15 p-4 sm:p-5"
                    >
                      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                        <div className="flex min-w-0 items-start gap-3 sm:gap-4">
                          <Avatar>
                            <AvatarFallback>{member.initials}</AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="font-medium">{member.name}</p>
                              {member.role === "owner" ? (
                                <ShieldCheck className="h-4 w-4 text-primary" />
                              ) : null}
                            </div>
                            <div className="mt-0.5 flex items-center gap-2 text-sm text-muted-foreground">
                              <Mail className="h-3 w-3" />
                              <span className="truncate">{member.email}</span>
                            </div>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {isEn ? "Last active" : "最近活跃"}: {formatLastActive(member)}
                            </p>

                            {member.invite ? (
                              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted-foreground">
                                <span>
                                  {isEn ? "Invite" : "邀请"}: {formatInviteStatus(member)}
                                </span>
                                <span>
                                  {isEn ? "Expiry" : "有效期"}:{" "}
                                  {formatDateTime(
                                    member.invite.expiresAt,
                                    isEn,
                                    isEn ? "No limit" : "长期有效",
                                  )}
                                </span>
                                <span>
                                  {isEn ? "Visits" : "访问次数"}: {member.invite.accessCount ?? 0}
                                </span>
                                {member.invite.lastAccessedAt ? (
                                  <span>
                                    {isEn ? "Last visit" : "最近访问"}:{" "}
                                    {formatDateTime(
                                      member.invite.lastAccessedAt,
                                      isEn,
                                      isEn ? "Never" : "暂无",
                                    )}
                                  </span>
                                ) : null}
                              </div>
                            ) : null}
                          </div>
                        </div>

                        <div className="flex w-full items-start justify-between gap-3 md:w-auto md:justify-end md:gap-4">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge
                              variant={member.role === "owner" ? "default" : "secondary"}
                              className="shrink-0"
                            >
                              {roleLabels[member.role]}
                            </Badge>
                            <Badge variant="outline">{statusLabels[member.status]}</Badge>
                          </div>

                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                disabled={!canOpenMemberMenu(member)}
                              >
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {member.invite?.inviteUrl ? (
                                <>
                                  <DropdownMenuItem onClick={() => void handleCopyInviteLink(member)}>
                                    <Copy className="mr-2 h-4 w-4" />
                                    {isEn ? "Copy invite link" : "复制邀请链接"}
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => handleOpenInviteLink(member)}>
                                    <ExternalLink className="mr-2 h-4 w-4" />
                                    {isEn ? "Open invite page" : "打开邀请页"}
                                  </DropdownMenuItem>
                                  {(permissions.canManageRoles ||
                                    permissions.canChangeStatus ||
                                    permissions.canRemoveMembers) ? (
                                    <DropdownMenuSeparator />
                                  ) : null}
                                </>
                              ) : null}

                              {permissions.canManageRoles ? (
                                <>
                                  {member.role !== "admin" ? (
                                    <DropdownMenuItem onClick={() => void handleRoleChange(member, "admin")}>
                                      {isEn ? "Make admin" : "设为管理员"}
                                    </DropdownMenuItem>
                                  ) : null}
                                  {member.role !== "member" ? (
                                    <DropdownMenuItem onClick={() => void handleRoleChange(member, "member")}>
                                      {isEn ? "Make member" : "设为成员"}
                                    </DropdownMenuItem>
                                  ) : null}
                                  {(permissions.canChangeStatus || permissions.canRemoveMembers) ? (
                                    <DropdownMenuSeparator />
                                  ) : null}
                                </>
                              ) : null}

                              {permissions.canChangeStatus ? (
                                <>
                                  {member.status !== "active" ? (
                                    <DropdownMenuItem onClick={() => void handleStatusChange(member, "active")}>
                                      {isEn ? "Mark active" : "设为正常"}
                                    </DropdownMenuItem>
                                  ) : null}
                                  {member.status !== "suspended" ? (
                                    <DropdownMenuItem onClick={() => void handleStatusChange(member, "suspended")}>
                                      {isEn ? "Suspend" : "暂停权限"}
                                    </DropdownMenuItem>
                                  ) : null}
                                  {member.status !== "invited" ? (
                                    <DropdownMenuItem onClick={() => void handleStatusChange(member, "invited")}>
                                      {isEn ? "Regenerate invite" : "重新生成邀请"}
                                    </DropdownMenuItem>
                                  ) : null}
                                  {permissions.canRemoveMembers ? <DropdownMenuSeparator /> : null}
                                </>
                              ) : null}

                              {permissions.canRemoveMembers ? (
                                <DropdownMenuItem
                                  className="text-destructive"
                                  onClick={() => setMemberToRemove(member)}
                                >
                                  {content.remove}
                                </DropdownMenuItem>
                              ) : null}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>

                      {member.invite?.inviteUrl ? (
                        <div className="flex flex-wrap gap-2 border-t border-border/60 pt-3">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => void handleCopyInviteLink(member)}
                          >
                            <Copy className="mr-2 h-4 w-4" />
                            {isEn ? "Copy invite link" : "复制邀请链接"}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenInviteLink(member)}
                          >
                            <ExternalLink className="mr-2 h-4 w-4" />
                            {isEn ? "Open invite page" : "打开邀请页"}
                          </Button>
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <div className="space-y-6">
            <Card className="border-border/70 bg-card/95 shadow-sm">
              <CardHeader>
                <CardTitle>{isEn ? "Workspace Snapshot" : "团队概览"}</CardTitle>
                <CardDescription>
                  {isEn
                    ? "This page now manages member records, invite links, and access-state updates together."
                    : "这个页面现在已经把成员记录、邀请链接和状态更新串成了一套完整管理流程。"}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="rounded-lg border border-border/70 bg-muted/15 px-4 py-3">
                  <p className="text-muted-foreground">{isEn ? "Active members" : "正常成员"}</p>
                  <p className="mt-1 text-2xl font-semibold text-foreground">{counts.active}</p>
                </div>
                <div className="rounded-lg border border-border/70 bg-muted/15 px-4 py-3">
                  <p className="text-muted-foreground">{isEn ? "Pending invites" : "待接受邀请"}</p>
                  <p className="mt-1 text-2xl font-semibold text-foreground">{counts.invited}</p>
                </div>
                <div className="rounded-lg border border-border/70 bg-muted/15 px-4 py-3">
                  <p className="text-muted-foreground">{isEn ? "Admins & owners" : "管理员与所有者"}</p>
                  <p className="mt-1 text-2xl font-semibold text-foreground">{counts.admins}</p>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/70 bg-card/95 shadow-sm">
              <CardHeader>
                <CardTitle>{isEn ? "Permission Scope" : "当前权限范围"}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-muted-foreground">
                <p>
                  {isEn ? "Current role" : "当前角色"}:{" "}
                  <span className="font-medium text-foreground">{roleLabels[permissions.currentRole]}</span>
                </p>
                <p>
                  {permissions.canInvite
                    ? isEn
                      ? "You can send workspace invitations."
                      : "你可以发送工作区邀请。"
                    : isEn
                      ? "You can view members but cannot invite."
                      : "你当前可以查看成员，但不能发起邀请。"}
                </p>
                <p>
                  {permissions.canManageRoles
                    ? isEn
                      ? "You can manage roles for non-owner members."
                      : "你可以调整非所有者成员的角色。"
                    : isEn
                      ? "Role changes are limited by your current workspace role."
                      : "你当前的工作区角色限制了角色调整能力。"}
                </p>
                <p>
                  {permissions.canRemoveMembers
                    ? isEn
                      ? "You can remove members within your allowed role scope."
                      : "你可以在当前角色范围内移除成员。"
                    : isEn
                      ? "Member removal is not available for your current role."
                      : "你当前没有移除成员的权限。"}
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </ConsoleShell>

      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{isEn ? "Invite Team Member" : "邀请团队成员"}</DialogTitle>
            <DialogDescription>
              {isEn
                ? "Create a real workspace invite, assign the initial role, and copy the shareable invite link."
                : "创建真实工作区邀请，分配初始角色，并复制可分享的邀请链接。"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="invite-email">{isEn ? "Email" : "邮箱"}</Label>
              <Input
                id="invite-email"
                value={inviteForm.email}
                onChange={(event) =>
                  setInviteForm((current) => ({ ...current, email: event.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="invite-name">{isEn ? "Name" : "姓名"}</Label>
              <Input
                id="invite-name"
                value={inviteForm.name}
                onChange={(event) =>
                  setInviteForm((current) => ({ ...current, name: event.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>{isEn ? "Role" : "角色"}</Label>
              <Select
                value={inviteForm.role}
                onValueChange={(value) =>
                  setInviteForm((current) => ({
                    ...current,
                    role: value as DashboardTeamMember["role"],
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {permissions.canManageRoles ? (
                    <SelectItem value="admin">{content.admin}</SelectItem>
                  ) : null}
                  <SelectItem value="member">{content.member}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInviteOpen(false)} disabled={submitting}>
              {isEn ? "Cancel" : "取消"}
            </Button>
            <Button onClick={() => void handleInviteMember()} disabled={submitting}>
              {content.primaryAction}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={Boolean(memberToRemove)}
        onOpenChange={(open) => !open && setMemberToRemove(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{isEn ? "Remove member?" : "确认移除成员？"}</AlertDialogTitle>
            <AlertDialogDescription>
              {memberToRemove
                ? isEn
                  ? `This will remove ${memberToRemove.email} from the workspace.`
                  : `这会把 ${memberToRemove.email} 从当前工作区移除。`
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={submitting}>{isEn ? "Cancel" : "取消"}</AlertDialogCancel>
            <AlertDialogAction onClick={() => void handleRemoveMember()} disabled={submitting}>
              {content.remove}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
