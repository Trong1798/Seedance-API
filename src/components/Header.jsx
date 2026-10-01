import React from 'react'
import { Sparkles, Key, Wallet, History, ExternalLink, Settings, ShieldCheck, AlertCircle } from 'lucide-react'

export default function Header({ 
  hasApiKey, 
  onOpenSettings, 
  onOpenHistory, 
  historyCount = 0 
}) {
  return (
    <header className="sticky top-0 z-40 w-full backdrop-blur-xl bg-[#09090b]/80 border-b border-zinc-800/60 px-4 lg:px-8 py-3.5 transition-all">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        {/* Logo & Brand */}
        <div className="flex items-center gap-3">
          <div className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-[#e5ff00] to-[#99cc00] text-black shadow-[0_0_20px_rgba(229,255,0,0.35)]">
            <Sparkles className="w-5 h-5 fill-black stroke-black" />
            <span className="absolute -bottom-1 -right-1 w-3 h-3 bg-emerald-500 rounded-full border-2 border-black" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-lg font-black tracking-tight text-white">SEEDANCE</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-[#e5ff00]/15 text-[#e5ff00] font-bold border border-[#e5ff00]/30 tracking-wider">
                2.5 AI
              </span>
            </div>
            <p className="text-[11px] text-zinc-400 font-medium">Next-Gen Cinema Video Studio</p>
          </div>
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Tuansu Portal Link */}
          <a
            href="https://tuansuapi.store/portal"
            target="_blank"
            rel="noreferrer"
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-900/90 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 text-xs font-semibold text-zinc-300 hover:text-white transition shadow-sm group"
            title="Tra cứu số dư KPI & Nạp VietQR tự động"
          >
            <Wallet className="w-3.5 h-3.5 text-[#e5ff00]" />
            <span>Nạp tiền / Số dư</span>
            <ExternalLink className="w-3 h-3 text-zinc-500 group-hover:text-zinc-300 transition" />
          </a>

          {/* History Button */}
          <button
            onClick={onOpenHistory}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-zinc-900/90 hover:bg-zinc-800 border border-zinc-800 text-xs font-semibold text-zinc-300 hover:text-white transition relative"
          >
            <History className="w-3.5 h-3.5 text-zinc-400" />
            <span className="hidden sm:inline">Lịch sử</span>
            {historyCount > 0 && (
              <span className="px-1.5 py-0.2 bg-[#e5ff00] text-black text-[10px] font-black rounded-full leading-none">
                {historyCount}
              </span>
            )}
          </button>

          {/* Settings / API Key Button */}
          <button
            onClick={onOpenSettings}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition border ${
              hasApiKey
                ? 'bg-zinc-900/90 hover:bg-zinc-800 border-zinc-800 text-zinc-200 hover:border-zinc-700'
                : 'bg-amber-500/10 hover:bg-amber-500/20 border-amber-500/40 text-amber-300 shadow-[0_0_15px_rgba(245,158,11,0.2)]'
            }`}
          >
            {hasApiKey ? (
              <>
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span className="hidden sm:inline">API Key Đã Lưu</span>
                <span className="sm:hidden">Key OK</span>
              </>
            ) : (
              <>
                <AlertCircle className="w-4 h-4 text-amber-400 animate-pulse" />
                <span className="font-bold">Nhập API Key</span>
              </>
            )}
            <Settings className="w-3.5 h-3.5 text-zinc-400 ml-0.5" />
          </button>
        </div>
      </div>
    </header>
  )
}
