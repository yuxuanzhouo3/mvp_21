"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  FileText,
  Plus,
  Download,
  Eye,
  Trash2,
  Filter,
  Search,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Header } from "@/components/header";
import { useUser } from "@/components/user-context";
import { useLanguage } from "@/components/language-provider";

interface Contract {
  id: string;
  title: string;
  employee_name: string;
  position: string;
  created_at: string;
  status: "draft" | "signed" | "active" | "expired";
}

export default function ContractsPage() {
  const router = useRouter();
  const { user, loading: userLoading } = useUser();
  const { language } = useLanguage();
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  // 重定向未登录用户
  useEffect(() => {
    if (!userLoading && !user) {
      router.push("/auth?redirect=/contracts");
    }
  }, [user, userLoading, router]);

  // 加载合同列表
  useEffect(() => {
    async function loadContracts() {
      if (!user) return;

      try {
        // TODO: 从 API 加载合同列表
        // 暂时使用模拟数据
        await new Promise((resolve) => setTimeout(resolve, 1000));

        const mockContracts: Contract[] = [
          {
            id: "1",
            title: "劳动合同 - 张三",
            employee_name: "张三",
            position: "前端工程师",
            created_at: "2024-01-15",
            status: "active",
          },
          {
            id: "2",
            title: "劳动合同 - 李四",
            employee_name: "李四",
            position: "产品经理",
            created_at: "2024-01-10",
            status: "signed",
          },
        ];

        setContracts(mockContracts);
      } catch (error) {
        console.error("加载合同失败:", error);
      } finally {
        setLoading(false);
      }
    }

    loadContracts();
  }, [user]);

  // 筛选合同
  const filteredContracts = contracts.filter(
    (contract) =>
      contract.employee_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      contract.position.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  // 状态显示
  const getStatusBadge = (status: string) => {
    const statusConfig = {
      draft: {
        color: "bg-gray-100 text-gray-700",
        text: language === "zh" ? "草稿" : "Draft",
      },
      signed: {
        color: "bg-blue-100 text-blue-700",
        text: language === "zh" ? "已签署" : "Signed",
      },
      active: {
        color: "bg-green-100 text-green-700",
        text: language === "zh" ? "生效中" : "Active",
      },
      expired: {
        color: "bg-red-100 text-red-700",
        text: language === "zh" ? "已过期" : "Expired",
      },
    };

    const config = statusConfig[status as keyof typeof statusConfig];
    return (
      <Badge className={config.color} variant="secondary">
        {config.text}
      </Badge>
    );
  };

  if (userLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">
            {language === "zh" ? "加载中..." : "Loading..."}
          </p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      <Header />

      <main className="container mx-auto px-4 py-12 max-w-6xl">
        {/* 页面标题 */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold mb-2">
              {language === "zh" ? "我的合同" : "My Contracts"}
            </h1>
            <p className="text-gray-600">
              {language === "zh"
                ? "管理和查看所有合同"
                : "Manage and view all contracts"}
            </p>
          </div>
          <Button
            onClick={() => router.push("/contracts/new")}
            className="bg-primary hover:bg-primary/90"
          >
            <Plus className="h-5 w-5 mr-2" />
            {language === "zh" ? "创建合同" : "Create Contract"}
          </Button>
        </div>

        {/* 搜索和筛选 */}
        <div className="flex gap-4 mb-6">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={
                language === "zh"
                  ? "搜索员工姓名或岗位..."
                  : "Search employee name or position..."
              }
              className="pl-10"
            />
          </div>
          <Button variant="outline">
            <Filter className="h-4 w-4 mr-2" />
            {language === "zh" ? "筛选" : "Filter"}
          </Button>
        </div>

        {/* 合同列表 */}
        {filteredContracts.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center">
              <FileText className="h-16 w-16 mx-auto text-gray-400 mb-4" />
              <h3 className="text-xl font-semibold mb-2">
                {language === "zh" ? "还没有合同" : "No contracts yet"}
              </h3>
              <p className="text-gray-600 mb-6">
                {language === "zh"
                  ? "开始创建您的第一份合同吧！"
                  : "Start creating your first contract!"}
              </p>
              <Button onClick={() => router.push("/contracts/new")}>
                <Plus className="h-4 w-4 mr-2" />
                {language === "zh" ? "创建合同" : "Create Contract"}
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {filteredContracts.map((contract) => (
              <Card
                key={contract.id}
                className="hover:shadow-lg transition-shadow cursor-pointer"
              >
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-start gap-4 flex-1">
                      <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <FileText className="h-6 w-6 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="font-semibold text-lg truncate">
                            {contract.title}
                          </h3>
                          {getStatusBadge(contract.status)}
                        </div>
                        <div className="flex items-center gap-4 text-sm text-gray-600">
                          <span>
                            {language === "zh" ? "员工：" : "Employee: "}
                            {contract.employee_name}
                          </span>
                          <span>•</span>
                          <span>
                            {language === "zh" ? "岗位：" : "Position: "}
                            {contract.position}
                          </span>
                          <span>•</span>
                          <span>
                            {language === "zh" ? "创建于：" : "Created: "}
                            {contract.created_at}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-2 ml-4">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => alert("查看功能开发中")}
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        {language === "zh" ? "查看" : "View"}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => alert("下载功能开发中")}
                      >
                        <Download className="h-4 w-4 mr-1" />
                        {language === "zh" ? "下载" : "Download"}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-red-600 hover:text-red-700"
                        onClick={() => {
                          if (
                            confirm(
                              language === "zh"
                                ? "确定要删除这份合同吗？"
                                : "Are you sure you want to delete this contract?",
                            )
                          ) {
                            alert("删除功能开发中");
                          }
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
