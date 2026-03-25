'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Search,
  Filter,
  Download,
  TrendingUp,
  Users,
  DollarSign,
  RefreshCw,
  XCircle,
} from 'lucide-react';
import { useLanguage } from '@/components/language-provider';

const mockSubscriptions = [
  {
    id: '1',
    userId: 'u1',
    userName: '李四',
    userEmail: 'li@example.com',
    plan: 'pro',
    price: 29,
    billingCycle: 'monthly',
    status: 'active',
    startDate: '2024-12-01',
    nextBillDate: '2025-02-01',
    paymentMethod: 'wechat',
  },
  {
    id: '2',
    userId: 'u2',
    userName: '赵六',
    userEmail: 'zhao@example.com',
    plan: 'enterprise',
    price: 99,
    billingCycle: 'monthly',
    status: 'active',
    startDate: '2024-09-15',
    nextBillDate: '2025-02-15',
    paymentMethod: 'alipay',
  },
  {
    id: '3',
    userId: 'u3',
    userName: '孙八',
    userEmail: 'sun@example.com',
    plan: 'pro',
    price: 199,
    billingCycle: 'yearly',
    status: 'active',
    startDate: '2024-06-01',
    nextBillDate: '2025-06-01',
    paymentMethod: 'stripe',
  },
  {
    id: '4',
    userId: 'u4',
    userName: '周九',
    userEmail: 'zhou@example.com',
    plan: 'pro',
    price: 29,
    billingCycle: 'monthly',
    status: 'cancelled',
    startDate: '2024-10-01',
    nextBillDate: '-',
    paymentMethod: 'wechat',
  },
];

const mockPayments = [
  {
    id: 'p1',
    userId: 'u1',
    userName: '李四',
    amount: 29,
    type: 'subscription',
    status: 'completed',
    paymentMethod: 'wechat',
    createdAt: '2025-01-01 10:30:00',
  },
  {
    id: 'p2',
    userId: 'u2',
    userName: '赵六',
    amount: 99,
    type: 'subscription',
    status: 'completed',
    paymentMethod: 'alipay',
    createdAt: '2025-01-01 09:15:00',
  },
  {
    id: 'p3',
    userId: 'u3',
    userName: '孙八',
    amount: 199,
    type: 'subscription',
    status: 'completed',
    paymentMethod: 'stripe',
    createdAt: '2024-12-28 14:20:00',
  },
  {
    id: 'p4',
    userId: 'u5',
    userName: '吴十',
    amount: 29,
    type: 'subscription',
    status: 'failed',
    paymentMethod: 'wechat',
    createdAt: '2024-12-27 16:45:00',
  },
];

export default function SubscriptionsPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const { language } = useLanguage();
  const isEn = language === 'en';

  const activeSubscriptions = mockSubscriptions.filter((s) => s.status === 'active').length;
  const monthlyRevenue = mockSubscriptions
    .filter((s) => s.status === 'active')
    .reduce((sum, s) => sum + (s.billingCycle === 'monthly' ? s.price : s.price / 12), 0);

  const getPlanBadge = (plan: string) => {
    const styles = {
      pro: 'bg-blue-100 text-blue-600',
      enterprise: 'bg-purple-100 text-purple-600',
    };
    const labels = {
      pro: isEn ? 'Pro' : '专业版',
      enterprise: isEn ? 'Enterprise' : '企业版',
    };
    return (
      <span className={`px-2 py-1 text-xs rounded-full ${styles[plan as keyof typeof styles]}`}>
        {labels[plan as keyof typeof labels]}
      </span>
    );
  };

  const getStatusBadge = (status: string) => {
    const styles = {
      active: 'bg-green-100 text-green-600',
      cancelled: 'bg-red-100 text-red-600',
      expired: 'bg-gray-100 text-gray-600',
    };
    const labels = {
      active: isEn ? 'Active' : '活跃',
      cancelled: isEn ? 'Cancelled' : '已取消',
      expired: isEn ? 'Expired' : '已过期',
    };
    return (
      <span className={`px-2 py-1 text-xs rounded-full ${styles[status as keyof typeof styles]}`}>
        {labels[status as keyof typeof labels]}
      </span>
    );
  };

  const getPaymentMethodLabel = (method: string) => {
    const labels: Record<string, string> = {
      wechat: isEn ? 'WeChat Pay' : '微信支付',
      alipay: isEn ? 'Alipay' : '支付宝',
      stripe: 'Stripe',
      paypal: 'PayPal',
    };
    return labels[method] || method;
  };

  const getPaymentStatusBadge = (status: string) => {
    const styles = {
      completed: 'bg-green-100 text-green-600',
      pending: 'bg-yellow-100 text-yellow-600',
      failed: 'bg-red-100 text-red-600',
    };
    const labels = {
      completed: isEn ? 'Success' : '成功',
      pending: isEn ? 'Processing' : '处理中',
      failed: isEn ? 'Failed' : '失败',
    };
    return (
      <span className={`px-2 py-1 text-xs rounded-full ${styles[status as keyof typeof styles]}`}>
        {labels[status as keyof typeof labels]}
      </span>
    );
  };

  const filteredSubscriptions = mockSubscriptions.filter((sub) => {
    const matchSearch =
      sub.userName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      sub.userEmail.toLowerCase().includes(searchQuery.toLowerCase());
    const matchStatus = statusFilter === 'all' || sub.status === statusFilter;
    return matchSearch && matchStatus;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{isEn ? 'Subscription Management' : '订阅管理'}</h1>
          <p className="text-gray-500">{isEn ? 'Manage user subscriptions and payment records' : '管理用户订阅和支付记录'}</p>
        </div>
        <Button>
          <Download className="mr-2 h-4 w-4" />
          {isEn ? 'Export Report' : '导出报表'}
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">{isEn ? 'Active Subscriptions' : '活跃订阅'}</CardTitle>
            <Users className="h-4 w-4 text-gray-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeSubscriptions}</div>
            <p className="text-xs text-gray-500">{isEn ? 'Paying users' : '付费用户'}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">{isEn ? 'Monthly MRR' : '月度MRR'}</CardTitle>
            <DollarSign className="h-4 w-4 text-gray-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">¥{monthlyRevenue.toFixed(0)}</div>
            <p className="text-xs text-green-600 flex items-center gap-1">
              <TrendingUp className="h-3 w-3" />
              {isEn ? '+15.3% vs last month' : '+15.3% 较上月'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">{isEn ? 'Renewal Rate' : '续费率'}</CardTitle>
            <RefreshCw className="h-4 w-4 text-gray-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">85.2%</div>
            <p className="text-xs text-gray-500">{isEn ? 'Rolling 30 days' : '30天滚动'}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">{isEn ? 'Churned Users' : '流失用户'}</CardTitle>
            <XCircle className="h-4 w-4 text-gray-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">12</div>
            <p className="text-xs text-gray-500">{isEn ? 'Cancelled this month' : '本月取消'}</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="subscriptions">
        <TabsList>
          <TabsTrigger value="subscriptions">{isEn ? 'Subscriptions' : '订阅列表'}</TabsTrigger>
          <TabsTrigger value="payments">{isEn ? 'Payments' : '支付记录'}</TabsTrigger>
        </TabsList>

        <TabsContent value="subscriptions" className="space-y-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder={isEn ? 'Search by user or email...' : '搜索用户名或邮箱...'}
                    className="pl-9"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-full sm:w-40">
                    <Filter className="mr-2 h-4 w-4" />
                    <SelectValue placeholder={isEn ? 'Status' : '筛选状态'} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{isEn ? 'All Status' : '全部状态'}</SelectItem>
                    <SelectItem value="active">{isEn ? 'Active' : '活跃'}</SelectItem>
                    <SelectItem value="cancelled">{isEn ? 'Cancelled' : '已取消'}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{isEn ? 'Subscription List' : '订阅列表'}</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{isEn ? 'User' : '用户'}</TableHead>
                    <TableHead>{isEn ? 'Plan' : '方案'}</TableHead>
                    <TableHead>{isEn ? 'Price' : '价格'}</TableHead>
                    <TableHead>{isEn ? 'Cycle' : '周期'}</TableHead>
                    <TableHead>{isEn ? 'Payment Method' : '支付方式'}</TableHead>
                    <TableHead>{isEn ? 'Next Bill' : '下次扣费'}</TableHead>
                    <TableHead>{isEn ? 'Status' : '状态'}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSubscriptions.map((sub) => (
                    <TableRow key={sub.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{sub.userName}</p>
                          <p className="text-sm text-gray-500">{sub.userEmail}</p>
                        </div>
                      </TableCell>
                      <TableCell>{getPlanBadge(sub.plan)}</TableCell>
                      <TableCell>¥{sub.price}</TableCell>
                      <TableCell>{sub.billingCycle === 'monthly' ? (isEn ? 'Monthly' : '月付') : isEn ? 'Yearly' : '年付'}</TableCell>
                      <TableCell>{getPaymentMethodLabel(sub.paymentMethod)}</TableCell>
                      <TableCell className="text-gray-500">{sub.nextBillDate}</TableCell>
                      <TableCell>{getStatusBadge(sub.status)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="payments" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{isEn ? 'Payment Records' : '支付记录'}</CardTitle>
              <CardDescription>{isEn ? 'All payment transaction records' : '所有支付交易记录'}</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{isEn ? 'Transaction ID' : '交易ID'}</TableHead>
                    <TableHead>{isEn ? 'User' : '用户'}</TableHead>
                    <TableHead>{isEn ? 'Amount' : '金额'}</TableHead>
                    <TableHead>{isEn ? 'Type' : '类型'}</TableHead>
                    <TableHead>{isEn ? 'Method' : '支付方式'}</TableHead>
                    <TableHead>{isEn ? 'Time' : '时间'}</TableHead>
                    <TableHead>{isEn ? 'Status' : '状态'}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mockPayments.map((payment) => (
                    <TableRow key={payment.id}>
                      <TableCell className="font-mono text-sm">{payment.id}</TableCell>
                      <TableCell>{payment.userName}</TableCell>
                      <TableCell className="font-medium">¥{payment.amount}</TableCell>
                      <TableCell>{payment.type === 'subscription' ? (isEn ? 'Subscription' : '订阅') : isEn ? 'Other' : '其他'}</TableCell>
                      <TableCell>{getPaymentMethodLabel(payment.paymentMethod)}</TableCell>
                      <TableCell className="text-gray-500">{payment.createdAt}</TableCell>
                      <TableCell>{getPaymentStatusBadge(payment.status)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
