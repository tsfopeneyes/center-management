import React from 'react';
import { format } from 'date-fns';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, Line } from 'recharts';

const TrendChart = ({ spaceData, periodType }) => {
    return (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 md:col-span-2">
            <h3 className="text-lg font-bold text-gray-800 mb-6">
                {periodType === 'DAILY' ? '시간별 이용 추이' :
                    periodType === 'WEEKLY' ? '주간 이용 추이' :
                        periodType === 'MONTHLY' ? '일별 이용 추이' : '월별 이용 추이'}
            </h3>
            <div className="w-full h-80">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={spaceData.timeSeries} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                        <defs>
                            <linearGradient id="colorDuration" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#8884d8" stopOpacity={0.8} />
                                <stop offset="95%" stopColor="#8884d8" stopOpacity={0} />
                            </linearGradient>
                        </defs>
                        <XAxis
                            dataKey="date"
                            tickFormatter={(date) => {
                                const d = new Date(date);
                                if (periodType === 'DAILY') return format(d, 'HH시');
                                if (periodType === 'WEEKLY' || periodType === 'MONTHLY') return format(d, 'd일');
                                return format(d, 'M월');
                            }}
                            tick={{ fontSize: 10 }}
                            interval={window.innerWidth < 768 ? (periodType === 'DAILY' ? 3 : (periodType === 'MONTHLY' ? 4 : 2)) : 0}
                        />
                        <YAxis />
                        <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <Area type="monotone" dataKey="totalDuration" stroke="#8884d8" fillOpacity={1} fill="url(#colorDuration)" name="이용 시간(분)" />
                        <Line type="monotone" dataKey="visitCount" stroke="#82ca9d" strokeWidth={2} name="방문 수" />
                    </AreaChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
};

export default TrendChart;
