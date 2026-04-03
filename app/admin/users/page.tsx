'use client';

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  Ban,
  CheckCircle2,
  Download,
  Eye,
  Filter,
  Loader2,
  MoreVertical,
  RefreshCw,
  Search,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';

import { useLanguage } from '@/components/language-provider';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { adminFetchJson } from '@/lib/admin/client';

interface User {
  id: string;
  email: string;
  nickname: string;
  subscription_type: string;
  created_at: string;
  updated_at: string;
  role: string;
  avatar?: string;
  phone?: string;
  is_banned?: boolean;
}

interface UserDetails {
  user: User;
  contractCount: number;
  orders: Array<{
    id: string;
    plan_type?: string;
    amount?: number;
    status?: string;
    currency?: string;
    payment_method?: string;
    created_at?: string;
  }>;
  recentLogs: Array<{
    id?: string;
    action?: string;
    created_at?: string;
  }>;
}

export default function UsersPage() {
  const { language } = useLanguage();
  const isEn = language === 'en';
  const locale = isEn ? 'en-US' : 'zh-CN';

  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [planFilter, setPlanFilter] = useState('all');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [selectedUserDetails, setSelectedUserDetails] = useState<UserDetails | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  const copy = useMemo(
    () => ({
      title: isEn ? 'User Management' : '用户管理',
      description: isEn ? 'Search accounts, review activity, and manage account status.' : '检索账号、查看活跃记录，并统一管理账户状态。',
      export: isEn ? 'Export Data' : '导出数据',
      retry: isEn ? 'Retry' : '重新加载',
      clearFilters: isEn ? 'Clear Filters' : '清空筛选',
      searchPlaceholder: isEn ? 'Search by name, email, or phone...' : '按昵称、邮箱或手机号搜索...',
      planPlaceholder: isEn ? 'Plan' : '套餐',
      allPlans: isEn ? 'All Plans' : '全部套餐',
      users: isEn ? 'Users' : '用户列表',
      noUsers: isEn ? 'No users found.' : '当前没有匹配的用户数据。',
      noUsersHint: isEn ? 'Try another keyword or switch the plan filter.' : '可以尝试调整搜索词或切换套餐筛选。',
      loadFailed: isEn ? 'Failed to load user list.' : '加载用户列表失败。',
      detailsFailed: isEn ? 'Failed to load user details.' : '加载用户详情失败。',
      operationFailed: isEn ? 'Operation failed. Please retry.' : '操作失败，请稍后重试。',
      banSuccess: isEn ? 'User has been banned.' : '该用户已被封禁。',
      unbanSuccess: isEn ? 'User has been restored.' : '该用户已恢复正常状态。',
      banned: isEn ? 'Banned' : '已封禁',
      active: isEn ? 'Active' : '正常',
      user: isEn ? 'User' : '用户',
      plan: isEn ? 'Plan' : '套餐',
      role: isEn ? 'Role' : '角色',
      registeredAt: isEn ? 'Registered At' : '注册时间',
      status: isEn ? 'Status' : '状态',
      actions: isEn ? 'Actions' : '操作',
      viewDetails: isEn ? 'View Details' : '查看详情',
      banAccount: isEn ? 'Ban Account' : '封禁账号',
      unbanAccount: isEn ? 'Unban Account' : '解除封禁',
      detailsTitle: isEn ? 'User Details' : '用户详情',
      detailsDesc: isEn ? 'Review user profile, orders, and recent activity.' : '查看用户资料、订单与最近操作记录。',
      unnamedUser: isEn ? 'Unnamed user' : '未命名用户',
      admin: isEn ? 'Admin' : '管理员',
      normalUser: isEn ? 'User' : '普通用户',
      currentPlan: isEn ? 'Current Plan' : '当前套餐',
      accountStatus: isEn ? 'Account Status' : '账户状态',
      userRole: isEn ? 'User Role' : '账户角色',
      usageOverview: isEn ? 'Usage Overview' : '使用概览',
      totalContracts: isEn ? 'Total Contracts' : '累计合同数',
      recentOrders: isEn ? 'Recent Orders' : '最近订单',
      recentActivity: isEn ? 'Recent Activity' : '最近活动',
      noOrders: isEn ? 'No order records yet.' : '暂无订单记录。',
      noLogs: isEn ? 'No recent activity yet.' : '暂无最近活动。',
      previous: isEn ? 'Previous' : '上一页',
      next: isEn ? 'Next' : '下一页',
      summary: (currentPage: number, pageCount: number, recordTotal: number) =>
        isEn ? `Total ${recordTotal} users, page ${currentPage} of ${pageCount}` : `共 ${recordTotal} 位用户，第 ${currentPage} / ${pageCount} 页`,
    }),
    [isEn],
  );

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setPage(1);
      setSearchQuery(searchInput.trim());
    }, 300);

    return () => window.clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    setPage(1);
  }, [planFilter]);

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const params = new URLSearchParams({
        page: String(page),
        limit: '20',
      });

      if (searchQuery) {
        params.append('search', searchQuery);
      }
      if (planFilter !== 'all') {
        params.append('subscription_type', planFilter);
      }

      const result = await adminFetchJson<{
        success: true;
        data: { users?: User[]; total?: number; totalPages?: number };
      }>(`/api/admin/users?${params.toString()}`);

      setUsers(result.data.users || []);
      setTotal(result.data.total || 0);
      setTotalPages(result.data.totalPages || 1);
    } catch (fetchError) {
      console.error('[AdminUsers] Failed to fetch users:', fetchError);
      const message = fetchError instanceof Error ? fetchError.message : copy.loadFailed;
      setError(message);
      toast.error(copy.loadFailed);
    } finally {
      setLoading(false);
    }
  }, [copy.loadFailed, page, planFilter, searchQuery]);

  useEffect(() => {
    void fetchUsers();
  }, [fetchUsers]);

  const fetchUserDetails = async (userId: string) => {
    try {
      setDetailsLoading(true);
      setSelectedUserDetails(null);
      const result = await adminFetchJson<{ success: true; data: UserDetails }>(`/api/admin/users/${userId}`);
      setSelectedUserDetails(result.data);
    } catch (fetchError) {
      console.error('[AdminUsers] Failed to fetch user details:', fetchError);
      toast.error(copy.detailsFailed);
    } finally {
      setDetailsLoading(false);
    }
  };

  const handleBanUser = async (userId: string, ban: boolean) => {
    try {
      await adminFetchJson(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_banned: ban }),
      });

      await fetchUsers();
      if (selectedUser?.id === userId) {
        await fetchUserDetails(userId);
      }

      toast.success(ban ? copy.banSuccess : copy.unbanSuccess);
    } catch (operationError) {
      console.error('[AdminUsers] Operation failed:', operationError);
      toast.error(copy.operationFailed);
    }
  };

  const exportUsers = () => {
    const blob = new Blob([JSON.stringify(users, null, 2)], {
      type: 'application/json;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'admin-users.json';
    link.click();
    URL.revokeObjectURL(url);
    toast.success(isEn ? 'Current page exported.' : '当前页数据已导出。');
  };

  const getPlanBadge = (plan: string) => {
    const styles = {
      free: 'bg-gray-100 text-gray-600',
      pro: 'bg-blue-100 text-blue-600',
      enterprise: 'bg-amber-100 text-amber-700',
    };
    const labels = {
      free: isEn ? 'Free' : '免费版',
      pro: 'Pro',
      enterprise: isEn ? 'Enterprise' : '企业版',
    };
    const normalizedPlan = plan in styles ? plan : 'free';

    return (
      <span className={`rounded-full px-2 py-1 text-xs ${styles[normalizedPlan as keyof typeof styles]}`}>
        {labels[normalizedPlan as keyof typeof labels]}
      </span>
    );
  };

  const getStatusBadge = (user: User) => {
    if (user.is_banned) {
      return (
        <span className="flex items-center gap-1 rounded-full bg-red-100 px-2 py-1 text-xs text-red-600">
          <XCircle className="h-3 w-3" />
          {copy.banned}
        </span>
      );
    }

    return (
      <span className="flex items-center gap-1 rounded-full bg-green-100 px-2 py-1 text-xs text-green-600">
        <CheckCircle2 className="h-3 w-3" />
        {copy.active}
      </span>
    );
  };

  const summaryText = useMemo(() => copy.summary(page, totalPages, total), [copy, page, total, totalPages]);

  const formatCurrency = (amount?: number, currency = 'CNY') => {
    if (typeof amount !== 'number') {
      return '-';
    }

    try {
      return new Intl.NumberFormat(locale, {
        style: 'currency',
        currency,
        maximumFractionDigits: 2,
      }).format(amount);
    } catch {
      return `${currency} ${amount.toFixed(2)}`;
    }
  };

  const clearFilters = () => {
    setSearchInput('');
    setSearchQuery('');
    setPlanFilter('all');
    setPage(1);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{copy.title}</h1>
          <p className="text-muted-foreground">{copy.description}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => void fetchUsers()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            {copy.retry}
          </Button>
          <Button variant="outline" onClick={exportUsers}>
            <Download className="mr-2 h-4 w-4" />
            {copy.export}
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4 sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input
                className="pl-9"
                placeholder={copy.searchPlaceholder}
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
              />
            </div>
            <Select value={planFilter} onValueChange={setPlanFilter}>
              <SelectTrigger className="w-full sm:w-44">
                <Filter className="mr-2 h-4 w-4" />
                <SelectValue placeholder={copy.planPlaceholder} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{copy.allPlans}</SelectItem>
                <SelectItem value="free">{isEn ? 'Free' : '免费版'}</SelectItem>
                <SelectItem value="pro">Pro</SelectItem>
                <SelectItem value="enterprise">{isEn ? 'Enterprise' : '企业版'}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{`${copy.users} (${total})`}</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : error ? (
            <div className="rounded-lg border border-dashed p-8 text-center">
              <p className="text-sm text-muted-foreground">{error}</p>
            </div>
          ) : users.length === 0 ? (
            <div className="rounded-lg border border-dashed p-12 text-center">
              <p className="font-medium">{copy.noUsers}</p>
              <p className="mt-2 text-sm text-muted-foreground">{copy.noUsersHint}</p>
              <Button variant="outline" className="mt-4" onClick={clearFilters}>
                {copy.clearFilters}
              </Button>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{copy.user}</TableHead>
                    <TableHead>{copy.plan}</TableHead>
                    <TableHead>{copy.role}</TableHead>
                    <TableHead>{copy.registeredAt}</TableHead>
                    <TableHead>{copy.status}</TableHead>
                    <TableHead className="text-right">{copy.actions}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100">
                            <span className="text-sm font-medium text-gray-600">
                              {user.nickname?.[0] || user.email?.[0] || 'U'}
                            </span>
                          </div>
                          <div>
                            <p className="font-medium">{user.nickname || copy.unnamedUser}</p>
                            <p className="text-sm text-gray-500">{user.email}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{getPlanBadge(user.subscription_type)}</TableCell>
                      <TableCell>
                        <span
                          className={`rounded-full px-2 py-1 text-xs ${
                            user.role === 'admin' ? 'bg-orange-100 text-orange-600' : 'bg-gray-100 text-gray-600'
                          }`}
                        >
                          {user.role === 'admin' ? copy.admin : copy.normalUser}
                        </span>
                      </TableCell>
                      <TableCell className="text-gray-500">
                        {new Date(user.created_at).toLocaleDateString(locale)}
                      </TableCell>
                      <TableCell>{getStatusBadge(user)}</TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => {
                                setSelectedUser(user);
                                void fetchUserDetails(user.id);
                              }}
                            >
                              <Eye className="mr-2 h-4 w-4" />
                              {copy.viewDetails}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-red-600"
                              onClick={() => void handleBanUser(user.id, !user.is_banned)}
                            >
                              <Ban className="mr-2 h-4 w-4" />
                              {user.is_banned ? copy.unbanAccount : copy.banAccount}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              <div className="mt-4 flex items-center justify-between">
                <p className="text-sm text-gray-500">{summaryText}</p>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage((current) => current - 1)}>
                    {copy.previous}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= totalPages}
                    onClick={() => setPage((current) => current + 1)}
                  >
                    {copy.next}
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={Boolean(selectedUser)}
        onOpenChange={() => {
          setSelectedUser(null);
          setSelectedUserDetails(null);
          setDetailsLoading(false);
        }}
      >
        <DialogContent className="max-h-[80vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{copy.detailsTitle}</DialogTitle>
            <DialogDescription>{copy.detailsDesc}</DialogDescription>
          </DialogHeader>

          {selectedUser ? (
            <div className="space-y-6">
              <div className="flex items-center gap-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
                  <span className="text-2xl font-medium text-gray-600">
                    {selectedUser.nickname?.[0] || selectedUser.email?.[0] || 'U'}
                  </span>
                </div>
                <div>
                  <h3 className="text-lg font-semibold">{selectedUser.nickname || copy.unnamedUser}</h3>
                  <p className="text-gray-500">{selectedUser.email}</p>
                  {selectedUser.phone ? <p className="text-sm text-gray-400">{selectedUser.phone}</p> : null}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <StatCard label={copy.currentPlan} valueNode={getPlanBadge(selectedUser.subscription_type)} />
                <StatCard label={copy.accountStatus} valueNode={getStatusBadge(selectedUser)} />
                <StatCard label={copy.userRole} valueText={selectedUser.role === 'admin' ? copy.admin : copy.normalUser} />
                <StatCard label={copy.registeredAt} valueText={new Date(selectedUser.created_at).toLocaleString(locale)} />
              </div>

              {detailsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : selectedUserDetails ? (
                <>
                  <div className="rounded-lg border p-4">
                    <h4 className="mb-2 font-semibold">{copy.usageOverview}</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <StatCard label={copy.totalContracts} valueText={String(selectedUserDetails.contractCount)} />
                      <StatCard label={copy.recentOrders} valueText={String(selectedUserDetails.orders.length)} />
                    </div>
                  </div>

                  <div className="rounded-lg border p-4">
                    <h4 className="mb-3 font-semibold">{copy.recentOrders}</h4>
                    {selectedUserDetails.orders.length > 0 ? (
                      <div className="space-y-3">
                        {selectedUserDetails.orders.map((order) => (
                          <div key={order.id} className="rounded-lg bg-muted/40 p-3">
                            <div className="flex items-center justify-between gap-3">
                              <div>
                                <p className="font-medium">{order.plan_type || '-'}</p>
                                <p className="text-sm text-muted-foreground">
                                  {(order.payment_method || '-') + ' · ' + (order.status || '-')}
                                </p>
                              </div>
                              <div className="text-right text-sm">
                                <p>{formatCurrency(order.amount, order.currency || 'CNY')}</p>
                                <p className="text-muted-foreground">
                                  {order.created_at ? new Date(order.created_at).toLocaleString(locale) : '-'}
                                </p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                        {copy.noOrders}
                      </div>
                    )}
                  </div>

                  <div className="rounded-lg border p-4">
                    <h4 className="mb-3 font-semibold">{copy.recentActivity}</h4>
                    {selectedUserDetails.recentLogs.length > 0 ? (
                      <div className="space-y-3">
                        {selectedUserDetails.recentLogs.map((log, index) => (
                          <div key={log.id || `${log.action}-${index}`} className="rounded-lg bg-muted/40 p-3">
                            <p className="font-medium">{log.action || '-'}</p>
                            <p className="text-sm text-muted-foreground">
                              {log.created_at ? new Date(log.created_at).toLocaleString(locale) : '-'}
                            </p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                        {copy.noLogs}
                      </div>
                    )}
                  </div>
                </>
              ) : null}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatCard({
  label,
  valueText,
  valueNode,
}: {
  label: string;
  valueText?: string;
  valueNode?: ReactNode;
}) {
  return (
    <div className="rounded-lg bg-gray-50 p-4">
      <p className="text-sm text-gray-500">{label}</p>
      <div className="mt-1 font-medium">{valueNode || valueText}</div>
    </div>
  );
}
