// src/components/charts/WeeklyChart.tsx
'use client'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { format, parseISO } from 'date-fns'
import { useWeekly } from '@/hooks/useData'
import { Skeleton } from '@/components/ui'

export function WeeklyChart() {
  const { data, isLoading } = useWeekly()

  if (isLoading) return <Skeleton className="h-[120px] w-full" />

  const today = format(new Date(), 'yyyy-MM-dd')

  return (
    <ResponsiveContainer width="100%" height={120}>
      <BarChart data={data ?? []} barSize={24} margin={{ top: 4, right: 0, left: -28, bottom: 0 }}>
        <XAxis
          dataKey="date"
          tickFormatter={(d) => format(parseISO(d), 'EEE')}
          tick={{ fontSize: 11, fill: '#9896ab' }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          allowDecimals={false}
          tick={{ fontSize: 11, fill: '#9896ab' }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          cursor={{ fill: 'rgba(107,80,236,0.06)' }}
          contentStyle={{
            fontSize: 12,
            border: '1px solid #e4e4ed',
            borderRadius: 6,
            boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
          }}
          formatter={(v: number) => [v, 'Shorts published']}
          labelFormatter={(d) => format(parseISO(d), 'EEE, MMM d')}
        />
        <Bar dataKey="count" radius={[3, 3, 0, 0]}>
          {(data ?? []).map((entry) => (
            <Cell
              key={entry.date}
              fill={entry.date === today ? '#6b50ec' : '#e3e0fd'}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
