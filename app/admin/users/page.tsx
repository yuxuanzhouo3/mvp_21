'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Search,
  Filter,
  Download,
  MoreVertical,
  Eye,
  Ban,
  Gift,
  UserPlus,
  Loader2,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useLanguage } from '@/components/language-provider';

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

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [planFilter, setPlanFilter] = useState('all');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [selectedUserDetails, setSelectedUserDetails] = useState<any>(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const { language } = useLanguage();
  const isEn = language === 'en';
  const locale = isEn ? 'en-US' : 'zh-CN';

  useEffect(() => {
    fetchUsers();
  }, [page, searchQuery, planFilter]);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20',
      });

      if (searchQuery) params.append('search', searchQuery);
      if (planFilter !== 'all') params.append('subscription_type', planFilter);

      const response = await fetch(`/api/admin/users?${params}`);
      const result = await response.json();

      if (result.success) {
        setUsers(result.data.users);
        setTotal(result.data.total);
        setTotalPages(result.data.totalPages);
      }
    } catch (error) {
      console.error('Failed to fetch users:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchUserDetails = async (userId: string) => {
    try {
      const response = await fetch(`/api/admin/users/${userId}`);
      const result = await response.json();

      if (result.success) {
        setSelectedUserDetails(result.data);
      }
    } catch (error) {
      console.error('Failed to fetch user details:', error);
    }
  };

  const handleBanUser = async (userId: string, ban: boolean) => {
    try {
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_banned: ban }),
      });

      const result = await response.json();
      if (result.success) {
        fetchUsers();
        alert(ban ? (isEn ? 'User banned' : '用户已被封禁') : isEn ? 'User unbanned' : '用户已解封');
      }
    } catch (error) {
      console.error('Operation failed:', error);
      alert(isEn ? 'Operation failed. Please retry.' : '操作失败，请重试');
    }
  };

  const getPlanBadge = (plan: string) => {
    const styles = {
      free: 'bg-gray-100 text-gray-600',
      pro: 'bg-blue-100 text-blue-600',
      enterprise: 'bg-purple-100 text-purple-600',
    };
    const labels = {
      free: isEn ? 'Free' : '免费版',
      pro: isEn ? 'Pro' : '专业版',
      enterprise: isEn ? 'Enterprise' : '企业版',
    };
    return (
      <span className={`px-2 py-1 text-xs rounded-full ${styles[plan as keyof typeof styles] || 'bg-gray-100 text-gray-600'}`}>
        {labels[plan as keyof typeof labels] || plan}
      </span>
    );
  };

  const getStatusBadge = (user: User) => {
    if (user.is_banned) {
      return (
        <span className="px-2 py-1 text-xs rounded-full bg-red-100 text-red-600 flex items-center gap-1">
          <XCircle className="h-3 w-3" />
          {isEn ? 'Banned' : '已封禁'}
        </span>
      );
    }
    return (
      <span className="px-2 py-1 text-xs rounded-full bg-green-100 text-green-600 flex items-center gap-1">
        <CheckCircle2 className="h-3 w-3" />
        {isEn ? 'Active' : '正常'}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{isEn ? 'User Management' : '用户管理'}</h1>
          <p className="text-gray-500">{isEn ? 'Manage all registered users' : '管理所有注册用户'}</p>
        </div>
        <Button>
          <Download className="mr-2 h-4 w-4" />
          {isEn ? 'Export Data' : '导出数据'}
        </Button>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder={isEn ? 'Search by name or email...' : '搜索用户名或邮箱...'}
                className="pl-9"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <Select value={planFilter} onValueChange={setPlanFilter}>
              <SelectTrigger className="w-full sm:w-40">
                <Filter className="mr-2 h-4 w-4" />
                <SelectValue placeholder={isEn ? 'Plan' : '筛选方案'} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{isEn ? 'All Plans' : '全部方案'}</SelectItem>
                <SelectItem value="free">{isEn ? 'Free' : '免费版'}</SelectItem>
                <SelectItem value="pro">{isEn ? 'Pro' : '专业版'}</SelectItem>
                <SelectItem value="enterprise">{isEn ? 'Enterprise' : '企业版'}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{isEn ? `Users (${total})` : `用户列表 (${total})`}</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : users.length === 0 ? (
            <div className="text-center py-12 text-gray-500">{isEn ? 'No users found' : '暂无用户数据'}</div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{isEn ? 'User' : '用户'}</TableHead>
                    <TableHead>{isEn ? 'Plan' : '方案'}</TableHead>
                    <TableHead>{isEn ? 'Role' : '角色'}</TableHead>
                    <TableHead>{isEn ? 'Registered' : '注册时间'}</TableHead>
                    <TableHead>{isEn ? 'Status' : '状态'}</TableHead>
                    <TableHead className="text-right">{isEn ? 'Actions' : '操作'}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
                            <span className="text-sm font-medium text-gray-600">
                              {user.nickname?.[0] || user.email?.[0] || 'U'}
                            </span>
                          </div>
                          <div>
                            <p className="font-medium">{user.nickname || (isEn ? 'Unnamed' : '未命名')}</p>
                            <p className="text-sm text-gray-500">{user.email}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{getPlanBadge(user.subscription_type)}</TableCell>
                      <TableCell>
                        <span
                          className={`px-2 py-1 text-xs rounded-full ${
                            user.role === 'admin' ? 'bg-orange-100 text-orange-600' : 'bg-gray-100 text-gray-600'
                          }`}
                        >
                          {user.role === 'admin' ? (isEn ? 'Admin' : '管理员') : isEn ? 'User' : '普通用户'}
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
                                fetchUserDetails(user.id);
                              }}
                            >
                              <Eye className="mr-2 h-4 w-4" />
                              {isEn ? 'View Details' : '查看详情'}
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <Gift className="mr-2 h-4 w-4" />
                              {isEn ? 'Grant Credits' : '赠送额度'}
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <UserPlus className="mr-2 h-4 w-4" />
                              {isEn ? 'Upgrade Plan' : '升级方案'}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-red-600"
                              onClick={() => handleBanUser(user.id, !user.is_banned)}
                            >
                              <Ban className="mr-2 h-4 w-4" />
                              {user.is_banned
                                ? isEn
                                  ? 'Unban Account'
                                  : '解封账户'
                                : isEn
                                  ? 'Ban Account'
                                  : '封禁账户'}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              <div className="flex items-center justify-between mt-4">
                <p className="text-sm text-gray-500">
                  {isEn
                    ? `Total ${total} users · Page ${page} / ${totalPages}`
                    : `共 ${total} 个用户，第 ${page} / ${totalPages} 页`}
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page === 1}
                    onClick={() => setPage(page - 1)}
                  >
                    {isEn ? 'Previous' : '上一页'}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page === totalPages}
                    onClick={() => setPage(page + 1)}
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
        open={!!selectedUser}
        onOpenChange={() => {
          setSelectedUser(null);
          setSelectedUserDetails(null);
        }}
      >
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{isEn ? 'User Details' : '用户详情'}</DialogTitle>
            <DialogDescription>
              {isEn ? 'Review user profile and usage metrics' : '查看用户的详细信息和使用数据'}
            </DialogDescription>
          </DialogHeader>
          {selectedUser && (
            <div className="space-y-6">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center">
                  <span className="text-2xl font-medium text-gray-600">
                    {selectedUser.nickname?.[0] || selectedUser.email?.[0] || 'U'}
                  </span>
                </div>
                <div>
                  <h3 className="text-lg font-semibold">{selectedUser.nickname || (isEn ? 'Unnamed' : '未命名')}</h3>
                  <p className="text-gray-500">{selectedUser.email}</p>
                  {selectedUser.phone && <p className="text-sm text-gray-400">{selectedUser.phone}</p>}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-500">{isEn ? 'Current Plan' : '当前方案'}</p>
                  <div className="mt-1">{getPlanBadge(selectedUser.subscription_type)}</div>
                </div>
                <div className="p-4 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-500">{isEn ? 'Account Status' : '账户状态'}</p>
                  <div className="mt-1">{getStatusBadge(selectedUser)}</div>
                </div>
                <div className="p-4 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-500">{isEn ? 'User Role' : '用户角色'}</p>
                  <p className="font-medium">{selectedUser.role === 'admin' ? (isEn ? 'Admin' : '管理员') : isEn ? 'User' : '普通用户'}</p>
                </div>
                <div className="p-4 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-500">{isEn ? 'Registered At' : '注册时间'}</p>
                  <p className="font-medium">{new Date(selectedUser.created_at).toLocaleString(locale)}</p>
                </div>
              </div>

              {selectedUserDetails && (
                <>
                  <div className="p-4 border rounded-lg">
                    <h4 className="font-semibold mb-2">{isEn ? 'Usage Stats' : '使用统计'}</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-gray-500">{isEn ? 'Total Contracts' : '累计合同'}</p>
                        <p className="text-2xl font-bold">{selectedUserDetails.contractCount}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">{isEn ? 'Total Orders' : '订单数量'}</p>
                        <p className="text-2xl font-bold">{selectedUserDetails.orders?.length || 0}</p>
                      </div>
                    </div>
                  </div>

                  {selectedUserDetails.orders && selectedUserDetails.orders.length > 0 && (
                    <div className="p-4 border rounded-lg">
                      <h4 className="font-semibold mb-2">{isEn ? 'Recent Orders' : '最近订单'}</h4>
                      <div className="space-y-2">
                        {selectedUserDetails.orders.slice(0, 3).map((order: any) => (
                          <div key={order.id} className="flex justify-between items-center text-sm p-2 bg-gray-50 rounded">
                            <span>{order.plan_type}</span>
                            <span className="font-medium">¥{order.amount}</span>
                            <span
                              className={`px-2 py-0.5 rounded-full text-xs ${
                                order.status === 'paid' ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-600'
                              }`}
                            >
                              {order.status === 'paid' ? (isEn ? 'Paid' : '已支付') : order.status}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}

              <div className="flex gap-2 justify-end pt-4 border-t">
                <Button variant="outline" onClick={() => handleBanUser(selectedUser.id, !selectedUser.is_banned)}>
                  <Ban className="mr-2 h-4 w-4" />
                  {selectedUser.is_banned ? (isEn ? 'Unban Account' : '解封账户') : isEn ? 'Ban Account' : '封禁账户'}
                </Button>
                <Button variant="outline">
                  <Gift className="mr-2 h-4 w-4" />
                  {isEn ? 'Grant Credits' : '赠送额度'}
                </Button>
                <Button>
                  <UserPlus className="mr-2 h-4 w-4" />
                  {isEn ? 'Upgrade Plan' : '升级方案'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
