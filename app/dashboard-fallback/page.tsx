// Fallback dashboard that works even if database is unavailable
import React from 'react';

// This component will work even if Prisma/database fails
export default function DashboardFallbackPage() {
  // Check if we're in production environment
  const isProduction = process.env.NODE_ENV === 'production';
  const currentYear = new Date().getFullYear();
  
  return (
    <main className="max-w-6xl mx-auto p-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-sm text-gray-600 mt-1">
          {isProduction ? '本番環境' : '開発環境'} - フォールバック版
        </p>
        {isProduction && (
          <div className="bg-yellow-50 border border-yellow-200 rounded p-3 mt-2">
            <p className="text-sm text-yellow-800">
              データベース接続が利用できません。モックデータを表示しています。
            </p>
          </div>
        )}
      </div>
      
      {/* Basic metrics - works without database */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="text-blue-600 text-sm font-medium">トレーニング時間</div>
          <div className="text-2xl font-bold text-blue-900 mt-1">120.5 h</div>
          <div className="text-xs text-blue-600 mt-1">
            {currentYear - 1}年: 110.2 h 
            <span className="ml-1 text-green-600">(+10.3 h)</span>
          </div>
        </div>
        
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="text-green-600 text-sm font-medium">総距離</div>
          <div className="text-2xl font-bold text-green-900 mt-1">2,450.8 km</div>
          <div className="text-xs text-green-600 mt-1">
            {currentYear - 1}年: 2,200.5 km
            <span className="ml-1 text-green-600">(+250.3 km)</span>
          </div>
        </div>
        
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
          <div className="text-orange-600 text-sm font-medium">総標高</div>
          <div className="text-2xl font-bold text-orange-900 mt-1">45,200 m</div>
          <div className="text-xs text-orange-600 mt-1">
            {currentYear - 1}年: 42,100 m
            <span className="ml-1 text-green-600">(+3,100 m)</span>
          </div>
        </div>
        
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
          <div className="text-purple-600 text-sm font-medium">アクティビティ数</div>
          <div className="text-2xl font-bold text-purple-900 mt-1">156</div>
          <div className="text-xs text-purple-600 mt-1">
            {currentYear - 1}年: 142
            <span className="ml-1 text-green-600">(+14)</span>
          </div>
        </div>
      </div>
      
      {/* Debug information */}
      <div className="bg-gray-50 border rounded-lg p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">システム情報</h2>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <strong>環境:</strong> {process.env.NODE_ENV || 'unknown'}
          </div>
          <div>
            <strong>Vercel:</strong> {process.env.VERCEL ? 'Yes' : 'No'}
          </div>
          <div>
            <strong>タイムゾーン:</strong> {Intl.DateTimeFormat().resolvedOptions().timeZone}
          </div>
          <div>
            <strong>現在時刻:</strong> {new Date().toLocaleString('ja-JP')}
          </div>
        </div>
      </div>
      
      {/* Heart rate zones table */}
      <div className="bg-white border rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-4">心拍ゾーン別分析（{currentYear}年 vs {currentYear - 1}年）</h2>
        <p className="text-sm text-gray-600 mb-4">
          各ゾーンの割合（%）と実際のトレーニング時間を表示
        </p>
        <table className="w-full text-sm border mt-4">
          <thead>
            <tr className="bg-gray-50">
              <th className="text-left p-3">ゾーン</th>
              <th className="text-right p-3">今年</th>
              <th className="text-right p-3">昨年</th>
              <th className="text-right p-3">差分</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-t hover:bg-gray-50">
              <td className="p-3 font-medium">リカバリー</td>
              <td className="p-3 text-right">
                <div className="font-semibold">45.2%</div>
                <div className="text-xs text-gray-500">54.5h</div>
              </td>
              <td className="p-3 text-right">
                <div className="font-semibold">42.1%</div>
                <div className="text-xs text-gray-500">46.4h</div>
              </td>
              <td className="p-3 text-right text-green-700">
                <div className="font-semibold">+3.1pts</div>
                <div className="text-xs">+8.1h</div>
              </td>
            </tr>
            <tr className="border-t hover:bg-gray-50">
              <td className="p-3 font-medium">有酸素持久力ゾーン</td>
              <td className="p-3 text-right">
                <div className="font-semibold">35.8%</div>
                <div className="text-xs text-gray-500">43.2h</div>
              </td>
              <td className="p-3 text-right">
                <div className="font-semibold">38.5%</div>
                <div className="text-xs text-gray-500">42.4h</div>
              </td>
              <td className="p-3 text-right text-red-700">
                <div className="font-semibold">-2.7pts</div>
                <div className="text-xs">+0.8h</div>
              </td>
            </tr>
            <tr className="border-t hover:bg-gray-50">
              <td className="p-3 font-medium">有酸素パワーゾーン</td>
              <td className="p-3 text-right">
                <div className="font-semibold">12.3%</div>
                <div className="text-xs text-gray-500">14.8h</div>
              </td>
              <td className="p-3 text-right">
                <div className="font-semibold">13.1%</div>
                <div className="text-xs text-gray-500">14.4h</div>
              </td>
              <td className="p-3 text-right text-red-700">
                <div className="font-semibold">-0.8pts</div>
                <div className="text-xs">+0.4h</div>
              </td>
            </tr>
            <tr className="border-t hover:bg-gray-50">
              <td className="p-3 font-medium">乳酸閾値ゾーン</td>
              <td className="p-3 text-right">
                <div className="font-semibold">4.2%</div>
                <div className="text-xs text-gray-500">5.1h</div>
              </td>
              <td className="p-3 text-right">
                <div className="font-semibold">4.8%</div>
                <div className="text-xs text-gray-500">5.3h</div>
              </td>
              <td className="p-3 text-right text-red-700">
                <div className="font-semibold">-0.6pts</div>
                <div className="text-xs">-0.2h</div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </main>
  );
}
