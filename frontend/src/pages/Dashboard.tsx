import React, { useState, useEffect } from 'react';
import { Card, Statistic, DatePicker, message, Typography } from 'antd';
import { ArrowUpOutlined, ArrowDownOutlined } from '@ant-design/icons';
import { reportApi } from '@/services/api';
import { ReportParams } from '@/types';
import { BarChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const { RangePicker } = DatePicker;
const { Title } = Typography;
const money = (v: number) => `¥${Number(v || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const Dashboard: React.FC = () => {
  const [dateRange, setDateRange] = useState<[string, string]>([
    new Date(new Date().setMonth(new Date().getMonth() - 1)).toISOString(),
    new Date().toISOString()
  ]);
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState({
    total_income: 0,
    total_expense: 0,
    net_profit: 0
  });
  const [trendData, setTrendData] = useState<Array<{date: string, income: number, expense: number, profit: number}>>([]);

  const fetchSummary = async () => {
    try {
      setLoading(true);
      const params: ReportParams = {
        start_date: dateRange[0],
        end_date: dateRange[1]
      };
      
      // 并行获取汇总数据和趋势数据
      const [summaryData, trendData] = await Promise.all([
        reportApi.getSummary(params),
        reportApi.getTrend(params)
      ]);
      
      setSummary({
        total_income: summaryData.total_income,
        total_expense: summaryData.total_expense,
        net_profit: summaryData.net_profit
      });
      
      setTrendData(trendData);
    } catch (error) {
      message.error('获取数据失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSummary();
  }, [dateRange]);

  const handleDateChange = (dates: any) => {
    if (dates) {
      setDateRange([
        dates[0].toISOString(),
        dates[1].toISOString()
      ]);
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <Title level={4}>俱乐部收益</Title>
        <RangePicker onChange={handleDateChange} />
      </div>
      
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
        <Card loading={loading}>
          <Statistic
            title="俱乐部收益(抽成)"
            value={summary.total_income}
            precision={2}
            valueStyle={{ color: '#52c41a' }}
            prefix="¥"
            suffix="元"
          />
        </Card>
        <Card loading={loading}>
          <Statistic
            title="总支出"
            value={summary.total_expense}
            precision={2}
            valueStyle={{ color: '#ff4d4f' }}
            prefix="¥"
            suffix="元"
          />
        </Card>
        <Card loading={loading}>
          <Statistic
            title="净利润"
            value={summary.net_profit}
            precision={2}
            valueStyle={{ color: summary.net_profit >= 0 ? '#52c41a' : '#ff4d4f' }}
            prefix="¥"
            suffix="元"
            valueSymbol={summary.net_profit >= 0 ? <ArrowUpOutlined /> : <ArrowDownOutlined />}
          />
        </Card>
      </div>
      
      <Card style={{ marginTop: 24 }} loading={loading}>
        <Title level={5}>收益趋势</Title>
        <div style={{ height: 400 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={trendData}
              margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
            >
              <defs>
                <linearGradient id="incomeGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#6a8dff" stopOpacity={0.95} />
                  <stop offset="100%" stopColor="#4f7cff" stopOpacity={0.75} />
                </linearGradient>
                <linearGradient id="expenseGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#ff9a9a" stopOpacity={0.95} />
                  <stop offset="100%" stopColor="#ff6a6a" stopOpacity={0.75} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="4 6" stroke="#e5ecfb" />
              <XAxis dataKey="date" tick={{ fill: '#6f7f9b', fontSize: 12 }} axisLine={{ stroke: '#dbe5fa' }} tickLine={false} />
              <YAxis tick={{ fill: '#6f7f9b', fontSize: 12 }} axisLine={{ stroke: '#dbe5fa' }} tickLine={false} tickFormatter={(v) => `¥${Number(v).toLocaleString('zh-CN')}`} />
              <Tooltip
                formatter={(value: any, name: any) => [money(Number(value)), name]}
                contentStyle={{
                  borderRadius: 12,
                  border: '1px solid #dce7fb',
                  boxShadow: '0 10px 26px rgba(59,87,150,0.12)',
                }}
                labelStyle={{ color: '#415472', fontWeight: 600 }}
              />
              <Legend />
              <Bar dataKey="income" name="俱乐部收益(抽成)" fill="url(#incomeGradient)" radius={[8, 8, 0, 0]} />
              <Bar dataKey="expense" name="总支出" fill="url(#expenseGradient)" radius={[8, 8, 0, 0]} />
              <Line
                type="monotone"
                dataKey="profit"
                name="净利润"
                stroke="#2e8a5c"
                strokeWidth={3}
                dot={{ r: 3, fill: '#2e8a5c', stroke: '#fff', strokeWidth: 2 }}
                activeDot={{ r: 5 }}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  );
};

export default Dashboard;