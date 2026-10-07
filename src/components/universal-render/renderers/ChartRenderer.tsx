import React, { useState } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend
} from 'recharts';
import { BarChart3, LineChart as LineIcon, PieChart as PieIcon, Activity } from 'lucide-react';

interface ChartRendererProps {
  data: {
    chartType?: 'bar' | 'line' | 'area' | 'pie' | string;
    chartData?: any[];
    content?: any[];
    config?: {
      xKey?: string;
      dataKeys?: string[];
      colors?: string[];
    };
  };
  title?: string;
}

const DEFAULT_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

export function ChartRenderer({ data, title }: ChartRendererProps) {
  const chartItems = data.chartData || (Array.isArray(data.content) ? data.content : []) || [];
  const initialType = (data.chartType?.toLowerCase() as 'bar' | 'line' | 'area' | 'pie') || 'bar';
  const [activeType, setActiveType] = useState<'bar' | 'line' | 'area' | 'pie'>(initialType);

  if (!chartItems || chartItems.length === 0) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center p-6 text-zinc-400">
        <Activity className="w-8 h-8 opacity-40 mb-2" />
        <span className="text-xs">Aucune donnée disponible pour ce graphique</span>
      </div>
    );
  }

  // Déduire automatiquement les clés si non spécifiées
  const firstItem = chartItems[0] || {};
  const allKeys = Object.keys(firstItem);
  const xKey = data.config?.xKey || allKeys.find(k => typeof firstItem[k] === 'string') || allKeys[0] || 'name';
  const numericKeys = data.config?.dataKeys || allKeys.filter(k => k !== xKey && typeof firstItem[k] === 'number');
  const validDataKeys = numericKeys.length > 0 ? numericKeys : [allKeys.find(k => k !== xKey) || 'value'];
  const colors = data.config?.colors || DEFAULT_COLORS;

  return (
    <div className="w-full h-full flex flex-col p-4 sm:p-6 text-zinc-100 overflow-hidden">
      {/* Barre supérieure avec bascule de type */}
      <div className="flex items-center justify-between pb-3 mb-4 border-b border-zinc-700/60 shrink-0 flex-wrap gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <BarChart3 className="w-4 h-4 text-blue-400 shrink-0" />
          <h3 className="text-sm font-bold text-zinc-200 truncate">
            {title || 'Visualisation graphique'}
          </h3>
        </div>

        <div className="flex items-center gap-1 bg-zinc-800/80 p-0.5 rounded-lg border border-zinc-700 shrink-0">
          <button
            type="button"
            onClick={() => setActiveType('bar')}
            className={`p-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
              activeType === 'bar' ? 'bg-zinc-700 text-white shadow-xs' : 'text-zinc-400 hover:text-zinc-200'
            }`}
            title="Histogramme"
          >
            <BarChart3 className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setActiveType('line')}
            className={`p-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
              activeType === 'line' ? 'bg-zinc-700 text-white shadow-xs' : 'text-zinc-400 hover:text-zinc-200'
            }`}
            title="Courbe"
          >
            <LineIcon className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setActiveType('area')}
            className={`p-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
              activeType === 'area' ? 'bg-zinc-700 text-white shadow-xs' : 'text-zinc-400 hover:text-zinc-200'
            }`}
            title="Aires"
          >
            <Activity className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setActiveType('pie')}
            className={`p-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
              activeType === 'pie' ? 'bg-zinc-700 text-white shadow-xs' : 'text-zinc-400 hover:text-zinc-200'
            }`}
            title="Camembert"
          >
            <PieIcon className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Rendu du Graphique Recharts */}
      <div className="flex-1 w-full min-h-[260px] relative">
        <ResponsiveContainer width="100%" height="100%">
          {activeType === 'bar' ? (
            <BarChart data={chartItems} margin={{ top: 10, right: 10, left: -10, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2d3139" />
              <XAxis dataKey={xKey} stroke="#8e929b" tick={{ fontSize: 11 }} />
              <YAxis stroke="#8e929b" tick={{ fontSize: 11 }} />
              <Tooltip contentStyle={{ backgroundColor: '#1c1e24', borderColor: '#3f4450', borderRadius: '8px', color: '#fff' }} />
              <Legend wrapperStyle={{ fontSize: 11, paddingTop: '10px' }} />
              {validDataKeys.map((k, idx) => (
                <Bar key={k} dataKey={k} fill={colors[idx % colors.length]} radius={[4, 4, 0, 0]} />
              ))}
            </BarChart>
          ) : activeType === 'line' ? (
            <LineChart data={chartItems} margin={{ top: 10, right: 10, left: -10, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2d3139" />
              <XAxis dataKey={xKey} stroke="#8e929b" tick={{ fontSize: 11 }} />
              <YAxis stroke="#8e929b" tick={{ fontSize: 11 }} />
              <Tooltip contentStyle={{ backgroundColor: '#1c1e24', borderColor: '#3f4450', borderRadius: '8px', color: '#fff' }} />
              <Legend wrapperStyle={{ fontSize: 11, paddingTop: '10px' }} />
              {validDataKeys.map((k, idx) => (
                <Line key={k} type="monotone" dataKey={k} stroke={colors[idx % colors.length]} strokeWidth={2} dot={{ r: 3 }} />
              ))}
            </LineChart>
          ) : activeType === 'area' ? (
            <AreaChart data={chartItems} margin={{ top: 10, right: 10, left: -10, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2d3139" />
              <XAxis dataKey={xKey} stroke="#8e929b" tick={{ fontSize: 11 }} />
              <YAxis stroke="#8e929b" tick={{ fontSize: 11 }} />
              <Tooltip contentStyle={{ backgroundColor: '#1c1e24', borderColor: '#3f4450', borderRadius: '8px', color: '#fff' }} />
              <Legend wrapperStyle={{ fontSize: 11, paddingTop: '10px' }} />
              {validDataKeys.map((k, idx) => (
                <Area key={k} type="monotone" dataKey={k} stroke={colors[idx % colors.length]} fill={colors[idx % colors.length]} fillOpacity={0.25} />
              ))}
            </AreaChart>
          ) : (
            <PieChart>
              <Tooltip contentStyle={{ backgroundColor: '#1c1e24', borderColor: '#3f4450', borderRadius: '8px', color: '#fff' }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Pie
                data={chartItems}
                dataKey={validDataKeys[0]}
                nameKey={xKey}
                cx="50%"
                cy="50%"
                outerRadius={80}
                label
              >
                {chartItems.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
                ))}
              </Pie>
            </PieChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
}
export default ChartRenderer;
