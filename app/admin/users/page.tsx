'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Ban,
  CheckCircle2,
  Download,
  Eye,
  Filter,
  Loader2,
  MoreVertical,
  Search,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';

import { useLanguage } from '@/components/language-provider';
import { adminFetchJson } from '@/lib/admin/client';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

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
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [planFilter, setPlanFilter] = useState('all');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [selectedUserDetails, setSelectedUserDetails] = useState<UserDetails | null>(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

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

  useEffect(() => {
    void fetchUsers();
  }, [page, searchQuery, planFilter]);

  const fetchUsers = async () => {
    setLoading(true);
    try {
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
        data: {
          users?: User[];
          total?: number;
          totalPages?: number;
        };
      }>(`/api/admin/users?${params.toString()}`);

      setUsers(result.data.users || []);
      setTotal(result.data.total || 0);
      setTotalPages(result.data.totalPages || 1);
    } catch (error) {
      console.error('Failed to fetch users:', error);
      toast.error(isEn ? 'Failed to load user list.' : '加载用户列表失败。');
    } finally {
      setLoading(false);
    }
  };

  const fetchUserDetails = async (userId: string) => {
    try {
      setSelectedUserDetails(null);
      const result = await adminFetchJson<{
        success: true;
        data: UserDetails;
      }>(`/api/admin/users/${userId}`);

      setSelectedUserDetails(result.data as UserDetails);
    } catch (error) {
      console.error('Failed to fetch user details:', error);
      toast.error(isEn ? 'Failed to load user details.' : '加载用户详情失败。');
    }
  };

  const handleBanUser = async (userId: string, ban: boolean) => {
    try {
      await adminFetchJson(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ is_banned: ban }),
      });

      await fetchUsers();
      if (selectedUser?.id === userId) {
        await fetchUserDetails(userId);
      }

      toast.success(
        ban
          ? isEn
            ? 'User has been flagged as banned.'
            : '已将该用户标记为封禁。'
          : isEn
            ? 'User has been restored.'
            : '已恢复该用户状态。',
      );
    } catch (error) {
      console.error('Operation failed:', error);
      toast.error(isEn ? 'Operation failed. Please retry.' : '操作失败，请稍后重试。');
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
  };

  const getPlanBadge = (plan: string) => {
    const styles = {
      free: 'bg-gray-100 text-gray-600',
      pro: 'bg-blue-100 text-blue-600',
      enterprise: 'bg-purple-100 text-purple-600',
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
          {isEn ? 'Banned' : '已封禁'}
        </span>
      );
    }

    return (
      <span className="flex items-center gap-1 rounded-full bg-green-100 px-2 py-1 text-xs text-green-600">
        <CheckCircle2 className="h-3 w-3" />
        {isEn ? 'Active' : '正常'}
      </span>
    );
  };

  const summaryText = useMemo(() => {
    return isEn
      ? `Total ${total} users, page ${page} of ${totalPages}`
      : `共 ${total} 位用户，第 ${page} / ${totalPages} 页`;
  }, [isEn, page, total, totalPages]);

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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{isEn ? 'User Management' : '用户管理'}</h1>
          <p className="text-gray-500">
            {isEn ? 'Manage registered users and account status.' : '查看注册用户、订阅方案和账户状态。'}
          </p>
        </div>
        <Button variant="outline" onClick={exportUsers}>
          <Download className="mr-2 h-4 w-4" />
          {isEn ? 'Export Data' : '导出数据'}
        </Button>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4 sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input
                className="pl-9"
                placeholder={isEn ? 'Search by name, email or phone...' : '按昵称、邮箱或手机号搜索...'}
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
              />
            </div>
            <Select value={planFilter} onValueChange={setPlanFilter}>
              <SelectTrigger className="w-full sm:w-44">
                <Filter className="mr-2 h-4 w-4" />
                <SelectValue placeholder={isEn ? 'Plan' : '订阅方案'} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{isEn ? 'All Plans' : '全部方案'}</SelectItem>
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
          <CardTitle>{isEn ? `Users (${total})` : `用户列表（${total}）`}</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : users.length === 0 ? (
            <div className="py-12 text-center text-gray-500">
              {isEn ? 'No users found.' : '暂无用户数据。'}
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{isEn ? 'User' : '用户'}</TableHead>
                    <TableHead>{isEn ? 'Plan' : '方案'}</TableHead>
                    <TableHead>{isEn ? 'Role' : '角色'}</TableHead>
                    <TableHead>{isEn ? 'Registered At' : '注册时间'}</TableHead>
                    <TableHead>{isEn ? 'Status' : '状态'}</TableHead>
                    <TableHead className="text-right">{isEn ? 'Actions' : '操作'}</TableHead>
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
                            <p className="font-medium">{user.nickname || (isEn ? 'Unnamed' : '未命名用户')}</p>
                            <p className="text-sm text-gray-500">{user.email}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{getPlanBadge(user.subscription_type)}</TableCell>
                      <TableCell>
                        <span
                          className={`rounded-full px-2 py-1 text-xs ${
                            user.role === 'admin'
                              ? 'bg-orange-100 text-orange-600'
                              : 'bg-gray-100 text-gray-600'
                          }`}
                        >
                          {user.role === 'admin'
                            ? isEn
                              ? 'Admin'
                              : '管理员'
                            : isEn
                              ? 'User'
                              : '普通用户'}
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
                              {isEn ? 'View Details' : '查看详情'}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-red-600"
                              onClick={() => void handleBanUser(user.id, !user.is_banned)}
                            >
                              <Ban className="mr-2 h-4 w-4" />
                              {user.is_banned
                                ? isEn
                                  ? 'Unban Account'
                                  : '解除封禁'
                                : isEn
                                  ? 'Ban Account'
                                  : '封禁账号'}
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
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page === 1}
                    onClick={() => setPage((current) => current - 1)}
                  >
                    {isEn ? 'Previous' : '上一页'}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= totalPages}
                    onClick={() => setPage((current) => current + 1)}
                  >
                    {isEn ? 'Next' : '下一页'}
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
        }}
      >
        <DialogContent className="max-h-[80vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{isEn ? 'User Details' : '用户详情'}</DialogTitle>
            <DialogDescription>
              {isEn ? 'Review user profile and recent activity.' : '查看用户资料、订单和最近活动。'}
            </DialogDescription>
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
                  <h3 className="text-lg font-semibold">
                    {selectedUser.nickname || (isEn ? 'Unnamed' : '未命名用户')}
                  </h3>
                  <p className="text-gray-500">{selectedUser.email}</p>
                  {selectedUser.phone ? (
                    <p className="text-sm text-gray-400">{selectedUser.phone}</p>
                  ) : null}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-lg bg-gray-50 p-4">
                  <p className="text-sm text-gray-500">{isEn ? 'Current Plan' : '当前方案'}</p>
                  <div className="mt-1">{getPlanBadge(selectedUser.subscription_type)}</div>
                </div>
                <div className="rounded-lg bg-gray-50 p-4">
                  <p className="text-sm text-gray-500">{isEn ? 'Account Status' : '账户状态'}</p>
                  <div className="mt-1">{getStatusBadge(selectedUser)}</div>
                </div>
                <div className="rounded-lg bg-gray-50 p-4">
                  <p className="text-sm text-gray-500">{isEn ? 'User Role' : '用户角色'}</p>
                  <p className="font-medium">
                    {selectedUser.role === 'admin'
                      ? isEn
                        ? 'Admin'
                        : '管理员'
                      : isEn
                        ? 'User'
                        : '普通用户'}
                  </p>
                </div>
                <div className="rounded-lg bg-gray-50 p-4">
                  <p className="text-sm text-gray-500">{isEn ? 'Registered At' : '注册时间'}</p>
                  <p className="font-medium">
                    {new Date(selectedUser.created_at).toLocaleString(locale)}
                  </p>
                </div>
              </div>

              {selectedUserDetails ? (
                <>
                  <div className="rounded-lg border p-4">
                    <h4 className="mb-2 font-semibold">{isEn ? 'Usage Overview' : '使用概览'}</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-gray-500">{isEn ? 'Total Contracts' : '累计合同数'}</p>
                        <p className="text-2xl font-bold">{selectedUserDetails.contractCount}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">{isEn ? 'Recent Orders' : '最近订单数'}</p>
                        <p className="text-2xl font-bold">{selectedUserDetails.orders.length}</p>
                      </div>
                    </div>
                  </div>

                  {selectedUserDetails.orders.length > 0 ? (
                    <div className="rounded-lg border p-4">
                      <h4 className="mb-2 font-semibold">{isEn ? 'Recent Orders' : '最近订单'}</h4>
                      <div className="space-y-2">
                        {selectedUserDetails.orders.slice(0, 3).map((order) => (
                          <div
                            key={order.id}
                            className="flex items-center justify-between rounded bg-gray-50 p-2 text-sm"
                          >
                            <span>{order.plan_type || '-'}</span>
                            <span className="font-medium">
                              {formatCurrency(order.amount, order.currency || 'CNY')}
                            </span>
                            <span
                              className={`rounded-full px-2 py-0.5 text-xs ${
                                order.status === 'paid' || order.status === 'completed'
                                  ? 'bg-green-100 text-green-600'
                                  : 'bg-gray-100 text-gray-600'
                              }`}
                            >
                              {order.status === 'paid' || order.status === 'completed'
                                ? isEn
                                  ? 'Paid'
                                  : '已支付'
                                : order.status || '-'}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {selectedUserDetails.recentLogs.length > 0 ? (
                    <div className="rounded-lg border p-4">
                      <h4 className="mb-2 font-semibold">{isEn ? 'Recent Activity' : '最近活动'}</h4>
                      <div className="space-y-2">
                        {selectedUserDetails.recentLogs.slice(0, 5).map((log, index) => (
                          <div
                            key={log.id || `${log.action}-${index}`}
                            className="flex items-center justify-between rounded bg-gray-50 p-2 text-sm"
                          >
                            <span>{log.action || '-'}</span>
                            <span className="text-gray-500">
                              {log.created_at ? new Date(log.created_at).toLocaleString(locale) : '-'}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </>
              ) : (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              )}

              <div className="flex justify-end gap-2 border-t pt-4">
                <Button
                  variant="outline"
                  onClick={() => void handleBanUser(selectedUser.id, !selectedUser.is_banned)}
                >
                  <Ban className="mr-2 h-4 w-4" />
                  {selectedUser.is_banned
                    ? isEn
                      ? 'Unban Account'
                      : '解除封禁'
                    : isEn
                      ? 'Ban Account'
                      : '封禁账号'}
                </Button>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
