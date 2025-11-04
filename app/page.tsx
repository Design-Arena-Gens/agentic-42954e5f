'use client';

import { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, Activity, BarChart3, DollarSign, Settings } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';

interface Trade {
  id: string;
  timestamp: number;
  symbol: string;
  type: 'BUY' | 'SELL';
  price: number;
  amount: number;
  profit?: number;
}

interface MarketData {
  timestamp: number;
  price: number;
  sma20: number;
  sma50: number;
  rsi: number;
}

interface BotConfig {
  symbol: string;
  strategy: string;
  enabled: boolean;
  capital: number;
  riskPerTrade: number;
}

export default function TradingBot() {
  const [marketData, setMarketData] = useState<MarketData[]>([]);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [botConfig, setBotConfig] = useState<BotConfig>({
    symbol: 'BTC/USD',
    strategy: 'SMA Crossover',
    enabled: false,
    capital: 10000,
    riskPerTrade: 2
  });
  const [stats, setStats] = useState({
    totalTrades: 0,
    winRate: 0,
    totalProfit: 0,
    currentPrice: 0
  });

  // Generate simulated market data with technical indicators
  const generateMarketData = (basePrice: number, volatility: number = 0.02) => {
    const data: MarketData[] = [];
    let price = basePrice;

    for (let i = 0; i < 100; i++) {
      const change = (Math.random() - 0.5) * 2 * volatility;
      price = price * (1 + change);

      data.push({
        timestamp: Date.now() - (100 - i) * 60000,
        price: parseFloat(price.toFixed(2)),
        sma20: 0,
        sma50: 0,
        rsi: 50
      });
    }

    // Calculate SMA
    for (let i = 0; i < data.length; i++) {
      if (i >= 19) {
        const sum20 = data.slice(i - 19, i + 1).reduce((acc, d) => acc + d.price, 0);
        data[i].sma20 = parseFloat((sum20 / 20).toFixed(2));
      }
      if (i >= 49) {
        const sum50 = data.slice(i - 49, i + 1).reduce((acc, d) => acc + d.price, 0);
        data[i].sma50 = parseFloat((sum50 / 50).toFixed(2));
      }

      // Simplified RSI
      if (i >= 14) {
        const changes = data.slice(i - 13, i + 1).map((d, idx, arr) =>
          idx > 0 ? d.price - arr[idx - 1].price : 0
        );
        const gains = changes.filter(c => c > 0).reduce((a, b) => a + b, 0) / 14;
        const losses = Math.abs(changes.filter(c => c < 0).reduce((a, b) => a + b, 0)) / 14;
        const rs = losses === 0 ? 100 : gains / losses;
        data[i].rsi = parseFloat((100 - (100 / (1 + rs))).toFixed(2));
      }
    }

    return data;
  };

  // Trading strategy logic
  const checkTradingSignals = (data: MarketData[], lastTrade: Trade | null) => {
    const latest = data[data.length - 1];
    const previous = data[data.length - 2];

    if (!latest || !previous || !latest.sma20 || !latest.sma50) return null;

    // SMA Crossover strategy
    const bullishCrossover = previous.sma20 <= previous.sma50 && latest.sma20 > latest.sma50;
    const bearishCrossover = previous.sma20 >= previous.sma50 && latest.sma20 < latest.sma50;

    // RSI conditions
    const oversold = latest.rsi < 30;
    const overbought = latest.rsi > 70;

    if ((bullishCrossover || oversold) && (!lastTrade || lastTrade.type === 'SELL')) {
      return { type: 'BUY' as const, price: latest.price };
    } else if ((bearishCrossover || overbought) && lastTrade && lastTrade.type === 'BUY') {
      return { type: 'SELL' as const, price: latest.price };
    }

    return null;
  };

  // Update market data and execute trades
  useEffect(() => {
    const initialData = generateMarketData(45000);
    setMarketData(initialData);
    setStats(prev => ({ ...prev, currentPrice: initialData[initialData.length - 1].price }));

    const interval = setInterval(() => {
      setMarketData(prevData => {
        const lastPrice = prevData[prevData.length - 1].price;
        const newData = generateMarketData(lastPrice, 0.015);
        const combined = [...prevData, ...newData.slice(-1)].slice(-100);

        const currentPrice = combined[combined.length - 1].price;
        setStats(prev => ({ ...prev, currentPrice }));

        if (botConfig.enabled) {
          const lastTrade = trades.length > 0 ? trades[trades.length - 1] : null;
          const signal = checkTradingSignals(combined, lastTrade);

          if (signal) {
            const amount = (botConfig.capital * botConfig.riskPerTrade / 100) / signal.price;
            let profit = 0;

            if (signal.type === 'SELL' && lastTrade && lastTrade.type === 'BUY') {
              profit = (signal.price - lastTrade.price) * lastTrade.amount;
            }

            const newTrade: Trade = {
              id: Date.now().toString(),
              timestamp: Date.now(),
              symbol: botConfig.symbol,
              type: signal.type,
              price: signal.price,
              amount: parseFloat(amount.toFixed(6)),
              profit: signal.type === 'SELL' ? profit : undefined
            };

            setTrades(prev => {
              const updated = [...prev, newTrade].slice(-50);

              // Update stats
              const sells = updated.filter(t => t.type === 'SELL' && t.profit !== undefined);
              const totalProfit = sells.reduce((acc, t) => acc + (t.profit || 0), 0);
              const winRate = sells.length > 0
                ? (sells.filter(t => (t.profit || 0) > 0).length / sells.length) * 100
                : 0;

              setStats(prev => ({
                ...prev,
                totalTrades: updated.length,
                winRate: parseFloat(winRate.toFixed(1)),
                totalProfit: parseFloat(totalProfit.toFixed(2))
              }));

              return updated;
            });
          }
        }

        return combined;
      });
    }, 3000);

    return () => clearInterval(interval);
  }, [botConfig.enabled, botConfig.capital, botConfig.riskPerTrade]);

  const toggleBot = () => {
    setBotConfig(prev => ({ ...prev, enabled: !prev.enabled }));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl font-bold flex items-center gap-3">
              <Activity className="text-blue-400" size={40} />
              Trading Bot Dashboard
            </h1>
            <p className="text-gray-400 mt-2">Algorithmic trading with technical analysis</p>
          </div>
          <button
            onClick={toggleBot}
            className={`px-6 py-3 rounded-lg font-semibold transition-all ${
              botConfig.enabled
                ? 'bg-red-600 hover:bg-red-700'
                : 'bg-green-600 hover:bg-green-700'
            }`}
          >
            {botConfig.enabled ? 'Stop Bot' : 'Start Bot'}
          </button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Current Price</p>
                <p className="text-2xl font-bold">${stats.currentPrice.toLocaleString()}</p>
              </div>
              <DollarSign className="text-yellow-400" size={32} />
            </div>
          </div>

          <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Total Trades</p>
                <p className="text-2xl font-bold">{stats.totalTrades}</p>
              </div>
              <BarChart3 className="text-blue-400" size={32} />
            </div>
          </div>

          <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Win Rate</p>
                <p className="text-2xl font-bold">{stats.winRate}%</p>
              </div>
              <TrendingUp className="text-green-400" size={32} />
            </div>
          </div>

          <div className={`bg-gray-800 rounded-lg p-6 border border-gray-700`}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Total P&L</p>
                <p className={`text-2xl font-bold ${stats.totalProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  ${stats.totalProfit.toLocaleString()}
                </p>
              </div>
              {stats.totalProfit >= 0 ? (
                <TrendingUp className="text-green-400" size={32} />
              ) : (
                <TrendingDown className="text-red-400" size={32} />
              )}
            </div>
          </div>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Price Chart */}
          <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
            <h2 className="text-xl font-bold mb-4">Price & Moving Averages</h2>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={marketData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis
                  dataKey="timestamp"
                  tickFormatter={(ts) => new Date(ts).toLocaleTimeString()}
                  stroke="#9CA3AF"
                />
                <YAxis stroke="#9CA3AF" domain={['auto', 'auto']} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151' }}
                  labelFormatter={(ts) => new Date(ts).toLocaleString()}
                />
                <Line type="monotone" dataKey="price" stroke="#3B82F6" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="sma20" stroke="#10B981" strokeWidth={1.5} dot={false} />
                <Line type="monotone" dataKey="sma50" stroke="#F59E0B" strokeWidth={1.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* RSI Chart */}
          <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
            <h2 className="text-xl font-bold mb-4">RSI Indicator</h2>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={marketData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis
                  dataKey="timestamp"
                  tickFormatter={(ts) => new Date(ts).toLocaleTimeString()}
                  stroke="#9CA3AF"
                />
                <YAxis domain={[0, 100]} stroke="#9CA3AF" />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151' }}
                  labelFormatter={(ts) => new Date(ts).toLocaleString()}
                />
                <Area type="monotone" dataKey="rsi" stroke="#8B5CF6" fill="#8B5CF6" fillOpacity={0.3} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Bot Configuration & Recent Trades */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Configuration */}
          <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <Settings size={24} />
              Bot Configuration
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-gray-400 text-sm mb-2">Trading Pair</label>
                <input
                  type="text"
                  value={botConfig.symbol}
                  onChange={(e) => setBotConfig(prev => ({ ...prev, symbol: e.target.value }))}
                  className="w-full bg-gray-700 rounded px-4 py-2 text-white"
                  disabled={botConfig.enabled}
                />
              </div>
              <div>
                <label className="block text-gray-400 text-sm mb-2">Strategy</label>
                <select
                  value={botConfig.strategy}
                  onChange={(e) => setBotConfig(prev => ({ ...prev, strategy: e.target.value }))}
                  className="w-full bg-gray-700 rounded px-4 py-2 text-white"
                  disabled={botConfig.enabled}
                >
                  <option>SMA Crossover</option>
                  <option>RSI Strategy</option>
                  <option>Combined Strategy</option>
                </select>
              </div>
              <div>
                <label className="block text-gray-400 text-sm mb-2">Capital: ${botConfig.capital}</label>
                <input
                  type="range"
                  min="1000"
                  max="100000"
                  step="1000"
                  value={botConfig.capital}
                  onChange={(e) => setBotConfig(prev => ({ ...prev, capital: parseInt(e.target.value) }))}
                  className="w-full"
                  disabled={botConfig.enabled}
                />
              </div>
              <div>
                <label className="block text-gray-400 text-sm mb-2">Risk Per Trade: {botConfig.riskPerTrade}%</label>
                <input
                  type="range"
                  min="0.5"
                  max="10"
                  step="0.5"
                  value={botConfig.riskPerTrade}
                  onChange={(e) => setBotConfig(prev => ({ ...prev, riskPerTrade: parseFloat(e.target.value) }))}
                  className="w-full"
                  disabled={botConfig.enabled}
                />
              </div>
              <div className={`mt-4 p-3 rounded ${botConfig.enabled ? 'bg-green-900/30 border border-green-600' : 'bg-gray-700'}`}>
                <p className="text-sm">
                  Status: <span className="font-semibold">{botConfig.enabled ? 'Active' : 'Inactive'}</span>
                </p>
              </div>
            </div>
          </div>

          {/* Recent Trades */}
          <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
            <h2 className="text-xl font-bold mb-4">Recent Trades</h2>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {trades.length === 0 ? (
                <p className="text-gray-400 text-center py-8">No trades yet. Start the bot to begin trading.</p>
              ) : (
                trades.slice().reverse().map((trade) => (
                  <div key={trade.id} className="bg-gray-700 rounded p-3 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                      <div className={`px-2 py-1 rounded text-sm font-semibold ${
                        trade.type === 'BUY' ? 'bg-green-600' : 'bg-red-600'
                      }`}>
                        {trade.type}
                      </div>
                      <div>
                        <p className="font-semibold">{trade.symbol}</p>
                        <p className="text-xs text-gray-400">
                          {new Date(trade.timestamp).toLocaleTimeString()}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">${trade.price.toLocaleString()}</p>
                      <p className="text-xs text-gray-400">{trade.amount} units</p>
                      {trade.profit !== undefined && (
                        <p className={`text-sm font-semibold ${trade.profit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {trade.profit >= 0 ? '+' : ''}${trade.profit.toFixed(2)}
                        </p>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Footer Info */}
        <div className="mt-8 bg-blue-900/20 border border-blue-700 rounded-lg p-4">
          <p className="text-sm text-blue-300">
            <strong>Demo Mode:</strong> This is a simulated trading bot for educational purposes.
            All market data and trades are simulated. The bot uses SMA crossover and RSI indicators
            to generate trading signals automatically.
          </p>
        </div>
      </div>
    </div>
  );
}
