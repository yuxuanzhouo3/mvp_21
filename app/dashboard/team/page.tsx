"use client";

import { Mail, MoreVertical, UserPlus } from "lucide-react";

import { useLanguage } from "@/components/language-provider";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ConsoleShell } from "@/components/layout/console-shell";
import { useTranslations } from "@/lib/i18n";

const teamMembers = [
  {
    id: 1,
    name: "Zhang Wei",
    email: "zhang@company.com",
    role: "owner",
    status: "active",
    initials: "ZW",
  },
  {
    id: 2,
    name: "Li Mei",
    email: "li@company.com",
    role: "admin",
    status: "active",
    initials: "LM",
  },
  {
    id: 3,
    name: "Wang Qiang",
    email: "wang@company.com",
    role: "member",
    status: "active",
    initials: "WQ",
  },
] as const;

export default function TeamPage() {
  const { language } = useLanguage();
  const t = useTranslations(language);

  const labels = t.platform?.consoleModules || {
    overview: language === "en" ? "Overview" : "总览",
    team: language === "en" ? "Team" : "团队",
  };

  const content = t.pages?.team || {
    title: language === "en" ? "Team Members" : "团队成员",
    description:
      language === "en"
        ? "Manage your team members and their permissions."
        : "管理团队成员及其权限。",
    primaryAction: language === "en" ? "Invite Member" : "邀请成员",
    membersTitle: language === "en" ? "Members" : "成员列表",
    membersDescription:
      language === "en"
        ? "People who have access to this workspace"
        : "拥有此工作区访问权限的成员",
    changeRole: language === "en" ? "Change Role" : "修改角色",
    remove: language === "en" ? "Remove" : "移除",
    owner: language === "en" ? "Owner" : "所有者",
    admin: language === "en" ? "Admin" : "管理员",
    member: language === "en" ? "Member" : "成员",
  };

  const roleLabels = {
    owner: content.owner,
    admin: content.admin,
    member: content.member,
  } as const;

  return (
    <ConsoleShell
      crumbs={[
        { label: labels.overview, href: "/dashboard" },
        { label: labels.team },
      ]}
      title={content.title}
      description={content.description}
      actions={
        <Button size="sm">
          <UserPlus className="mr-2 h-4 w-4" />
          {content.primaryAction}
        </Button>
      }
    >
      <Card className="border-border/70 bg-card/95 shadow-sm">
        <CardHeader>
          <CardTitle>
            {content.membersTitle} ({teamMembers.length})
          </CardTitle>
          <CardDescription>{content.membersDescription}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {teamMembers.map((member) => (
              <div
                key={member.id}
                className="flex flex-col gap-3 rounded-lg border border-border/70 bg-muted/15 p-4 sm:p-5 md:flex-row md:items-center md:justify-between"
              >
                <div className="flex min-w-0 items-center gap-3 sm:gap-4">
                  <Avatar>
                    <AvatarFallback>{member.initials}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="font-medium">{member.name}</p>
                    <div className="mt-0.5 flex items-center gap-2 text-sm text-muted-foreground">
                      <Mail className="h-3 w-3" />
                      <span className="truncate">{member.email}</span>
                    </div>
                  </div>
                </div>

                <div className="flex w-full items-center justify-between gap-3 md:w-auto md:justify-end md:gap-4">
                  <Badge
                    variant={member.role === "owner" ? "default" : "secondary"}
                    className="shrink-0"
                  >
                    {roleLabels[member.role]}
                  </Badge>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem>{content.changeRole}</DropdownMenuItem>
                      <DropdownMenuItem className="text-destructive">{content.remove}</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </ConsoleShell>
  );
}
