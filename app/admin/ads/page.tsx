"use client";

/**
 * 管理后台 - 广告管理页面
 *
 * 完整功能：
 * - 广告列表展示（支持分页）
 * - 创建广告
 * - 编辑广告
 * - 删除广告
 * - 切换广告状态
 * - 拖拽排序优先级
 * - 预览广告
 */

import { useState, useEffect, useMemo, useCallback } from "react";
import {
  listAds,
  getAdStats,
  createAd,
  updateAd,
  deleteAd,
  toggleAdStatus,
  type Advertisement,
} from "@/actions/admin-ads";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Loader2,
  Search,
  RefreshCw,
  Plus,
  Edit,
  Trash2,
  Eye,
  ChevronLeft,
  ChevronRight,
  Image as ImageIcon,
  Video,
  Power,
  GripVertical,
  ExternalLink,
} from "lucide-react";

function getRegion(): "CN" | "INTL" {
  const region =
    (process.env.NEXT_PUBLIC_DEPLOYMENT_REGION ||
      process.env.NEXT_PUBLIC_APP_REGION ||
      "CN")
      .trim()
      .toUpperCase();
  return region === "INTL" ? "INTL" : "CN";
}

const isIntlRegion = getRegion() === "INTL";
const tx = (zh: string, en: string) => (isIntlRegion ? en : zh);

export default function AdsManagementPage() {
  // ==================== 状态管理 ====================
  const [ads, setAds] = useState<Advertisement[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // 分页状态
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [total, setTotal] = useState(0);

  // 筛选状态
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterPosition, setFilterPosition] = useState<string>("all");

  // 对话框状态
  const [viewingAd, setViewingAd] = useState<Advertisement | null>(null);
  const [editingAd, setEditingAd] = useState<Advertisement | null>(null);
  const [creatingAd, setCreatingAd] = useState(false);
  const [deletingAd, setDeletingAd] = useState<Advertisement | null>(null);

  // 表单状态
  const [formData, setFormData] = useState({
    title: "",
    type: "image" as "image" | "video",
    position: "top" as Advertisement["position"],
    fileUrl: "",
    fileUrlCn: "",
    fileUrlIntl: "",
    linkUrl: "",
    priority: 0,
    status: "active" as "active" | "inactive",
    startDate: "",
    endDate: "",
    fileSize: 0 as number,
    file: null as File | null,
  });

  // ==================== 筛选后的广告列表 ====================
  const filteredAds = useMemo(() => {
    return ads.filter((ad) => {
      if (filterStatus !== "all" && ad.status !== filterStatus) {
        return false;
      }
      if (filterPosition !== "all" && ad.position !== filterPosition) {
        return false;
      }
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        return ad.title.toLowerCase().includes(query);
      }
      return true;
    });
  }, [ads, filterStatus, filterPosition, searchQuery]);

  // ==================== 数据加载 ====================
  const loadAds = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const offset = (page - 1) * pageSize;
      const result = await listAds({
        limit: pageSize,
        offset,
      });

      if (result.success && result.data) {
        setAds(result.data.items || []);
        setTotal(result.data.total || 0);
      } else {
        setError(result.error || tx("加载失败", "Failed to load"));
      }
    } catch (err) {
      setError(tx("加载广告失败", "Failed to load ads"));
    } finally {
      setLoading(false);
    }
  }, [page, pageSize]);

  const loadStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const result = await getAdStats();
      if (result.success && result.data) {
        setStats(result.data);
      }
    } catch (err) {
      console.error(tx("加载统计失败:", "Failed to load stats:"), err);
    } finally {
      setStatsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAds();
  }, [loadAds]);

  useEffect(() => {
    void loadStats();
  }, [loadStats]);

  // ==================== CRUD 操作 ====================
  async function handleCreateAd() {
    setSubmitting(true);
    setError(null);

    try {
      // 构造 FormData
      const formDataToSend = new FormData();
      formDataToSend.append("title", formData.title);
      formDataToSend.append("type", formData.type);
      formDataToSend.append("position", formData.position);
      formDataToSend.append("linkUrl", formData.linkUrl || "");
      formDataToSend.append("priority", String(formData.priority));
      formDataToSend.append("status", formData.status);

      // 添加文件
      if (formData.file) {
        formDataToSend.append("file", formData.file);
      } else {
        setError(tx("请上传广告文件", "Please upload an ad file"));
        setSubmitting(false);
        return;
      }

      const result = await createAd(formDataToSend);

      if (result.success) {
        setCreatingAd(false);
        resetForm();
        loadAds();
        loadStats();
      } else {
        setError(result.error || tx("创建失败", "Failed to create"));
      }
    } catch (err) {
      setError(tx("创建失败", "Failed to create"));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleUpdateAd() {
    if (!editingAd) return;

    setSubmitting(true);
    setError(null);

    try {
      const result = await updateAd(editingAd.id, formData);

      if (result.success) {
        setEditingAd(null);
        resetForm();
        loadAds();
        loadStats();
      } else {
        setError(result.error || tx("更新失败", "Failed to update"));
      }
    } catch (err) {
      setError(tx("更新失败", "Failed to update"));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(ad: Advertisement) {
    setSubmitting(true);

    try {
      const result = await deleteAd(ad.id);

      if (result.success) {
        setDeletingAd(null);
        loadAds();
        loadStats();
      } else {
        setError(result.error || tx("删除失败", "Failed to delete"));
      }
    } catch (err) {
      setError(tx("删除失败", "Failed to delete"));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleToggleStatus(ad: Advertisement) {
    try {
      const result = await toggleAdStatus(ad.id);

      if (result.success) {
        loadAds();
        loadStats();
      } else {
        setError(result.error || tx("切换状态失败", "Failed to toggle status"));
      }
    } catch (err) {
      setError(tx("切换状态失败", "Failed to toggle status"));
    }
  }

  // ==================== 表单处理 ====================
  function resetForm() {
    setFormData({
      title: "",
      type: "image",
      position: "top",
      fileUrl: "",
      fileUrlCn: "",
      fileUrlIntl: "",
      linkUrl: "",
      priority: 0,
      status: "active",
      startDate: "",
      endDate: "",
      fileSize: 0,
      file: null,
    });
  }

  function openCreateDialog() {
    resetForm();
    setCreatingAd(true);
  }

  function openEditDialog(ad: Advertisement) {
    setFormData({
      title: ad.title,
      type: ad.type,
      position: ad.position,
      fileUrl: ad.fileUrl,
      fileUrlCn: ad.fileUrlCn || "",
      fileUrlIntl: ad.fileUrlIntl || "",
      linkUrl: ad.linkUrl || "",
      priority: ad.priority,
      status: ad.status,
      startDate: ad.startDate || "",
      endDate: ad.endDate || "",
      fileSize: ad.file_size || 0,
      file: null,
    });
    setEditingAd(ad);
  }

  // ==================== 工具函数 ====================
  function getStatusBadge(status: string) {
    return status === "active" ? (
      <Badge variant="default" className="bg-green-600 gap-1">
        <Power className="h-3 w-3" />
        {tx("上架", "Active")}
      </Badge>
    ) : (
      <Badge variant="outline" className="gap-1">
        <Power className="h-3 w-3" />
        {tx("下架", "Inactive")}
      </Badge>
    );
  }

  function formatFileSize(bytes: number): string {
    if (!bytes) return "-";
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  }

  function formatUploadTime(dateStr: string): string {
    if (!dateStr) return "-";
    const date = new Date(dateStr);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}/${month}/${day} ${hours}:${minutes}`;
  }

  function getTypeBadge(type: string) {
    return type === "image" ? (
      <Badge variant="secondary" className="gap-1">
        <ImageIcon className="h-3 w-3" />
        {tx("图片", "Image")}
      </Badge>
    ) : (
      <Badge variant="secondary" className="gap-1">
        <Video className="h-3 w-3" />
        {tx("视频", "Video")}
      </Badge>
    );
  }

  function getPositionLabel(position: string) {
    const labels: Record<string, string> = {
      top: tx("顶部", "Top"),
      bottom: tx("底部", "Bottom"),
      left: tx("左侧", "Left"),
      right: tx("右侧", "Right"),
      "bottom-left": tx("左下角", "Bottom Left"),
      "bottom-right": tx("右下角", "Bottom Right"),
      sidebar: tx("侧边栏", "Sidebar"),
    };
    return labels[position] || position;
  }

  function formatDate(dateStr: string | undefined) {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleDateString(isIntlRegion ? "en-US" : "zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
  }

  function formatCtr(ad: Advertisement): string {
    const impressions = ad.impression_count || 0;
    const clicks = ad.click_count || 0;
    if (impressions <= 0) return "-";
    return `${((clicks / impressions) * 100).toFixed(1)}%`;
  }

  // ==================== 分页 ====================
  const totalPages = Math.ceil(total / pageSize);

  // ==================== 渲染 ====================
  return (
    <div className="space-y-6">
      {/* 页头 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{tx("广告管理", "Ads Management")}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {tx("管理网站广告内容，共", "Manage website ads, total")} {total} {tx("条广告", "ads")}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={loadAds} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            {tx("刷新", "Refresh")}
          </Button>
          <Button onClick={openCreateDialog}>
            <Plus className="h-4 w-4 mr-2" />
            {tx("新建广告", "New Ad")}
          </Button>
        </div>
      </div>

      {/* 错误提示 */}
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* 统计卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {statsLoading ? (
          // 骨架屏：加载时显示
          <>
            {[1, 2, 3, 4].map((i) => (
              <Card key={i}>
                <CardHeader className="pb-2">
                  <Skeleton className="h-4 w-24" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-8 w-16" />
                </CardContent>
              </Card>
            ))}
          </>
        ) : stats ? (
          // 数据加载完成：显示实际数据
          <>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {tx("总广告数", "Total Ads")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.total}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {tx("激活中", "Active")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">{stats.active}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {tx("已禁用", "Inactive")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-muted-foreground">{stats.inactive}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {tx("图片/视频", "Image/Video")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-lg font-bold">
                  {stats.byType?.image || 0} / {stats.byType?.video || 0}
                </div>
              </CardContent>
            </Card>
          </>
        ) : null}
      </div>

      {/* 搜索和筛选栏 */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-center gap-4">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={tx("搜索广告标题...", "Search ad title...")}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>

            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[120px]">
                <SelectValue placeholder={tx("状态", "Status")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{tx("全部状态", "All statuses")}</SelectItem>
                <SelectItem value="active">{tx("上架", "Active")}</SelectItem>
                <SelectItem value="inactive">{tx("下架", "Inactive")}</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filterPosition} onValueChange={setFilterPosition}>
              <SelectTrigger className="w-[120px]">
                <SelectValue placeholder={tx("位置", "Position")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{tx("全部位置", "All positions")}</SelectItem>
                <SelectItem value="top">{tx("顶部", "Top")}</SelectItem>
                <SelectItem value="bottom">{tx("底部", "Bottom")}</SelectItem>
                <SelectItem value="left">{tx("左侧", "Left")}</SelectItem>
                <SelectItem value="right">{tx("右侧", "Right")}</SelectItem>
                <SelectItem value="bottom-left">{tx("左下角", "Bottom Left")}</SelectItem>
                <SelectItem value="bottom-right">{tx("右下角", "Bottom Right")}</SelectItem>
                <SelectItem value="sidebar">{tx("侧边栏", "Sidebar")}</SelectItem>
              </SelectContent>
            </Select>

            {/* 清除筛选 */}
            {(searchQuery || filterStatus !== "all" || filterPosition !== "all") && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearchQuery("");
                  setFilterStatus("all");
                  setFilterPosition("all");
                }}
              >
                {tx("清除筛选", "Clear filters")}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 广告列表 */}
      <Card>
        <CardHeader>
          <CardTitle>{tx("广告列表", "Ads List")}</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredAds.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              {searchQuery || filterStatus !== "all" || filterPosition !== "all"
                ? tx("没有符合筛选条件的广告", "No ads match the current filters")
                : tx("暂无广告", "No ads")}
            </div>
          ) : (
            <>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[100px]">{tx("预览", "Preview")}</TableHead>
                      <TableHead>{tx("标题", "Title")}</TableHead>
                      <TableHead className="w-[100px]">{tx("位置", "Position")}</TableHead>
                      <TableHead className="w-[80px]">{tx("类型", "Type")}</TableHead>
                      <TableHead className="w-[100px]">{tx("大小", "Size")}</TableHead>
                      <TableHead className="w-[140px]">{tx("上传时间", "Uploaded At")}</TableHead>
                      <TableHead className="w-[80px]">{tx("优先级", "Priority")}</TableHead>
                      <TableHead className="w-[90px]">{tx("曝光", "Impressions")}</TableHead>
                      <TableHead className="w-[90px]">{tx("点击", "Clicks")}</TableHead>
                      <TableHead className="w-[90px]">CTR</TableHead>
                      <TableHead className="w-[80px]">{tx("状态", "Status")}</TableHead>
                      <TableHead className="text-right">{tx("操作", "Actions")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredAds.map((ad) => (
                      <TableRow key={ad.id}>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-10 w-10"
                            onClick={() => setViewingAd(ad)}
                            title={tx("预览", "Preview")}
                          >
                            {ad.type === "image" ? (
                              /* eslint-disable-next-line @next/next/no-img-element */
                              <img
                                src={ad.fileUrl}
                                alt={ad.title}
                                className="h-8 w-8 object-cover rounded"
                              />
                            ) : (
                              <div className="h-8 w-8 rounded bg-primary/10 flex items-center justify-center">
                                <Video className="h-4 w-4 text-primary" />
                              </div>
                            )}
                          </Button>
                        </TableCell>
                        <TableCell>
                          <div className="font-medium text-sm">{ad.title}</div>
                          <div className="text-xs text-muted-foreground">
                            ID: {ad.id.slice(0, 8)}...
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{getPositionLabel(ad.position)}</Badge>
                        </TableCell>
                        <TableCell>{getTypeBadge(ad.type)}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {ad.file_size ? formatFileSize(ad.file_size) : "-"}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatUploadTime(ad.created_at)}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">{ad.priority}</Badge>
                        </TableCell>
                        <TableCell className="text-sm">{ad.impression_count || 0}</TableCell>
                        <TableCell className="text-sm">{ad.click_count || 0}</TableCell>
                        <TableCell className="text-sm">{formatCtr(ad)}</TableCell>
                        <TableCell>{getStatusBadge(ad.status)}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => handleToggleStatus(ad)}
                              title={ad.status === "active" ? tx("下架", "Deactivate") : tx("上架", "Activate")}
                            >
                              <Power className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => openEditDialog(ad)}
                              title={tx("编辑", "Edit")}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                                  title={tx("删除", "Delete")}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>{tx("确认删除", "Confirm deletion")}</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    {tx("确定要删除广告", "Delete ad")} &quot;{ad.title}&quot; {tx("吗？此操作不可恢复。", "? This action cannot be undone.")}
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>{tx("取消", "Cancel")}</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => {
                                      setDeletingAd(ad);
                                      handleDelete(ad);
                                    }}
                                    className="bg-red-600 hover:bg-red-700"
                                    disabled={submitting}
                                  >
                                    {submitting ? (
                                      <>
                                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                        {tx("删除中...", "Deleting...")}
                                      </>
                                    ) : (
                                      tx("删除", "Delete")
                                    )}
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* 分页 */}
              {total > pageSize && (
                <div className="flex items-center justify-between mt-4">
                  <div className="text-sm text-muted-foreground">
                    {tx("显示第", "Showing")} {(page - 1) * pageSize + 1} -{" "}
                    {Math.min(page * pageSize, total)} {tx("条，共", "of")} {total} {tx("条", "items")}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page === 1}
                    >
                      <ChevronLeft className="h-4 w-4 mr-1" />
                      {tx("上一页", "Previous")}
                    </Button>
                    <div className="text-sm">
                      {tx("第", "Page")} <span className="font-medium">{page}</span> /{" "}
                      <span>{totalPages}</span>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      disabled={page >= totalPages}
                    >
                      {tx("下一页", "Next")}
                      <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* 创建/编辑广告对话框 */}
      <Dialog open={creatingAd || !!editingAd} onOpenChange={(open) => {
        if (!open) {
          setCreatingAd(false);
          setEditingAd(null);
          resetForm();
        }
      }}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingAd ? tx("编辑广告", "Edit Ad") : tx("新建广告", "New Ad")}</DialogTitle>
            <DialogDescription>
              {editingAd ? tx("修改广告信息和设置", "Update ad settings") : tx("创建新的广告内容", "Create new ad content")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="title">{tx("广告标题", "Ad Title")} *</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder={tx("输入广告标题", "Enter ad title")}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="type">{tx("广告类型", "Ad Type")} *</Label>
                <Select
                  value={formData.type}
                  onValueChange={(value: any) => setFormData({ ...formData, type: value })}
                >
                  <SelectTrigger id="type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="image">{tx("图片广告", "Image Ad")}</SelectItem>
                    <SelectItem value="video">{tx("视频广告", "Video Ad")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="position">{tx("显示位置", "Display Position")} *</Label>
                <Select
                  value={formData.position}
                  onValueChange={(value: any) => setFormData({ ...formData, position: value })}
                >
                  <SelectTrigger id="position">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="top">{tx("顶部", "Top")}</SelectItem>
                    <SelectItem value="bottom">{tx("底部", "Bottom")}</SelectItem>
                    <SelectItem value="left">{tx("左侧", "Left")}</SelectItem>
                    <SelectItem value="right">{tx("右侧", "Right")}</SelectItem>
                    <SelectItem value="bottom-left">{tx("左下角", "Bottom Left")}</SelectItem>
                    <SelectItem value="bottom-right">{tx("右下角", "Bottom Right")}</SelectItem>
                    <SelectItem value="sidebar">{tx("侧边栏", "Sidebar")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="priority">{tx("优先级", "Priority")}</Label>
                <Input
                  id="priority"
                  type="number"
                  value={formData.priority}
                  onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) || 0 })}
                  placeholder={tx("数字越大优先级越高", "Higher number means higher priority")}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="file">{tx("上传文件", "Upload File")} *</Label>
              <Input
                id="file"
                type="file"
                accept="image/*,video/*"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    setFormData({
                      ...formData,
                      file: file,
                      fileSize: file.size,
                      fileUrl: URL.createObjectURL(file)
                    });
                  }
                }}
              />
              {formData.type === "image" && formData.file && (
                <div className="mt-2 h-32 rounded border overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={formData.fileUrl} alt={tx("预览", "Preview")} className="h-full w-full object-cover" />
                </div>
              )}
              {formData.fileSize > 0 && (
                <p className="text-sm text-muted-foreground">
                  {tx("文件大小", "File Size")}: {formatFileSize(formData.fileSize)}
                </p>
              )}
            </div>

            <div className="space-y-2">
                <Label htmlFor="status">{tx("状态", "Status")}</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value: any) => setFormData({ ...formData, status: value })}
                >
                  <SelectTrigger id="status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">{tx("上架", "Active")}</SelectItem>
                    <SelectItem value="inactive">{tx("下架", "Inactive")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

            <div className="space-y-2">
              <Label htmlFor="linkUrl">{tx("跳转链接", "Target URL")}</Label>
              <Input
                id="linkUrl"
                value={formData.linkUrl}
                onChange={(e) => setFormData({ ...formData, linkUrl: e.target.value })}
                placeholder="https://example.com"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setCreatingAd(false);
                setEditingAd(null);
                resetForm();
              }}
              disabled={submitting}
            >
              {tx("取消", "Cancel")}
            </Button>
            <Button
              onClick={editingAd ? handleUpdateAd : handleCreateAd}
              disabled={submitting || !formData.title || !formData.fileUrl}
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {editingAd ? tx("更新中...", "Updating...") : tx("创建中...", "Creating...")}
                </>
              ) : (
                editingAd ? tx("更新", "Update") : tx("创建", "Create")
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 预览广告对话框 */}
      <Dialog open={!!viewingAd} onOpenChange={() => setViewingAd(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{tx("广告预览", "Ad Preview")}</DialogTitle>
          </DialogHeader>
          {viewingAd && (
            <div className="space-y-4">
              <div className="space-y-2">
                <h3 className="text-sm font-medium">{tx("广告内容", "Ad Content")}</h3>
                {viewingAd.type === "image" ? (
                  <div className="rounded-lg overflow-hidden border">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={viewingAd.fileUrl}
                      alt={viewingAd.title}
                      className="w-full"
                    />
                  </div>
                ) : (
                  <div className="rounded-lg overflow-hidden border bg-black aspect-video flex items-center justify-center">
                    <Video className="h-12 w-12 text-white/50" />
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">{tx("标题：", "Title:")}</span>
                  <div className="mt-1">{viewingAd.title}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">{tx("类型：", "Type:")}</span>
                  <div className="mt-1">{getTypeBadge(viewingAd.type)}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">{tx("位置：", "Position:")}</span>
                  <div className="mt-1">
                    <Badge variant="outline">{getPositionLabel(viewingAd.position)}</Badge>
                  </div>
                </div>
                <div>
                  <span className="text-muted-foreground">{tx("状态：", "Status:")}</span>
                  <div className="mt-1">{getStatusBadge(viewingAd.status)}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">{tx("优先级：", "Priority:")}</span>
                  <div className="mt-1">{viewingAd.priority}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">{tx("跳转链接：", "Target URL:")}</span>
                  <div className="mt-1">
                    {viewingAd.linkUrl ? (
                      <a
                        href={viewingAd.linkUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary flex items-center gap-1 hover:underline"
                      >
                        {viewingAd.linkUrl}
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    ) : (
                      "-"
                    )}
                  </div>
                </div>
                <div>
                  <span className="text-muted-foreground">{tx("有效期：", "Validity:")}</span>
                  <div className="mt-1">
                    {formatDate(viewingAd.startDate)} - {formatDate(viewingAd.endDate)}
                  </div>
                </div>
                <div>
                  <span className="text-muted-foreground">{tx("创建时间：", "Created At:")}</span>
                  <div className="mt-1">{formatDate(viewingAd.created_at)}</div>
                </div>
              </div>

              {(viewingAd.fileUrlCn || viewingAd.fileUrlIntl) && (
                <div className="space-y-2">
                  <h3 className="text-sm font-medium">{tx("区域化文件", "Regional Files")}</h3>
                  <ScrollArea className="h-24 w-full rounded-md border p-4">
                    <div className="space-y-2 text-sm">
                      {viewingAd.fileUrlCn && (
                        <div>
                          <span className="text-muted-foreground">{tx("国内版：", "CN:")}</span>
                          <a href={viewingAd.fileUrlCn} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline ml-2">
                            {viewingAd.fileUrlCn}
                          </a>
                        </div>
                      )}
                      {viewingAd.fileUrlIntl && (
                        <div>
                          <span className="text-muted-foreground">{tx("国际版：", "INTL:")}</span>
                          <a href={viewingAd.fileUrlIntl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline ml-2">
                            {viewingAd.fileUrlIntl}
                          </a>
                        </div>
                      )}
                    </div>
                  </ScrollArea>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setViewingAd(null)}
            >
              {tx("关闭", "Close")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
