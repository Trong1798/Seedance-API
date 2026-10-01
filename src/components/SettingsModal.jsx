import React, { useState } from 'react'
import { Key, Eye, EyeOff, ShieldCheck, ExternalLink, X, Check, AlertTriangle, RefreshCw, Server } from 'lucide-react'
import { getApiKey, setApiKey, getBaseUrl, setBaseUrl, DEFAULT_BASE_URL, API_HOST_PRESETS } from '../services/storage'
import { testApiKey } from '../services/api'

export default function SettingsModal({ isOpen, onClose, onApiKeyChange }) {
  if (!isOpen) return null

  const [inputKey, setInputKey] = useState(getApiKey())
  const [showKey, setShowKey] = useState(false)
  const [inputUrl, setInputUrl] = useState(getBaseUrl())
  const [testStatus, setTestStatus] = useState(null)
  const [testMessage, setTestMessage] = useState('')
  const [savedSuccess, setSavedSuccess] = useState(false)

  const handleSave = () => {
    setApiKey(inputKey)
    setBaseUrl(inputUrl)
    onApiKeyChange?.(inputKey.trim())
    setSavedSuccess(true)
    setTimeout(() => { setSavedSuccess(false); onClose(); }, 700)
  }

  const handleTest = async () => {
    if (!inputKey.trim()) {
      setTestStatus('error')
      setTestMessage('Vui lòng nhập API Key trước!')
      return
    }
    setTestStatus('testing')
    setTestMessage('Đang kết nối...')
    const res = await testApiKey(inputKey, inputUrl)
    setTestStatus(res.success ? 'success' : 'error')
    setTestMessage(res.message)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <div className="w-full max-w-md bg-[#16161a] border border-zinc-800 rounded-3xl p-6 shadow-2xl">
        <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-zinc-800 text-[#e5ff00]"><Key className="w-4 h-4" /></div>
            <div>
              <h3 className="text-sm font-bold text-white">Cài đặt API Key</h3>
              <p className="text-[11px] text-zinc-400">Tuan Su API Store Gateway</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400"><X className="w-4 h-4" /></button>
        </div>

        <div className="mt-3.5 p-2.5 bg-emerald-500/10 border border-emerald-500/25 rounded-xl flex items-start gap-2 text-[11px] text-emerald-200">
          <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
          <span><b>Lưu cục bộ an toàn:</b> API Key chỉ lưu trên trình duyệt (LocalStorage) của bạn, không gửi qua bất kỳ máy chủ trung gian nào.</span>
        </div>

        <div className="mt-4 space-y-1">
          <div className="flex items-center justify-between text-xs text-zinc-300">
            <label className="font-semibold">API Key:</label>
            <a href="https://tuansuapi.store/portal" target="_blank" rel="noreferrer" className="text-[#e5ff00] hover:underline flex items-center gap-0.5 text-[11px]">
              Lấy key tại portal <ExternalLink className="w-2.5 h-2.5" />
            </a>
          </div>
          <div className="relative">
            <input
              type={showKey ? 'text' : 'password'}
              placeholder="sk-xxxxxxxxxxxxxxxx"
              value={inputKey}
              onChange={(e) => setInputKey(e.target.value)}
              className="w-full pl-3 pr-9 py-2 bg-zinc-900 border border-zinc-700 rounded-xl text-xs text-zinc-200 focus:outline-none focus:border-[#e5ff00] font-mono"
            />
            <button type="button" onClick={() => setShowKey(!showKey)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400">
              {showKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        <div className="mt-3 space-y-1.5">
          <div className="flex items-center justify-between text-xs text-zinc-300">
            <label className="font-semibold flex items-center gap-1.5">
              <Server className="w-3.5 h-3.5 text-[#e5ff00]" />
              <span>Base URL:</span>
            </label>
            <button type="button" onClick={() => setInputUrl(DEFAULT_BASE_URL)} className="text-zinc-500 hover:text-zinc-300 text-[10px]">Mặc định</button>
          </div>
          <input
            type="text"
            value={inputUrl}
            onChange={(e) => setInputUrl(e.target.value)}
            className="w-full px-3 py-1.5 bg-zinc-900 border border-zinc-700 rounded-xl text-xs text-zinc-400 font-mono focus:outline-none focus:border-[#e5ff00]"
          />
          {/* Preset gateways */}
          <div className="flex items-center gap-1.5 pt-0.5">
            <span className="text-[10px] text-zinc-500">Cổng kết nối:</span>
            {API_HOST_PRESETS.map((p) => {
              const isActive = inputUrl.trim().replace(/\/+$/, '') === p.url.trim().replace(/\/+$/, '')
              return (
                <button
                  key={p.url}
                  type="button"
                  onClick={() => setInputUrl(p.url)}
                  className={`text-[10px] px-2 py-0.5 rounded-lg border transition ${
                    isActive
                      ? 'bg-[#e5ff00]/15 text-[#e5ff00] border-[#e5ff00]/40 font-semibold'
                      : 'bg-zinc-800/80 hover:bg-zinc-700 text-zinc-400 border-zinc-700/60'
                  }`}
                >
                  {p.host}
                </button>
              )
            })}
          </div>
        </div>

        {testStatus && (
          <div className={`mt-3 p-2 rounded-xl text-xs flex items-center gap-2 ${
            testStatus === 'success' ? 'bg-emerald-500/10 text-emerald-300' :
            testStatus === 'error' ? 'bg-rose-500/10 text-rose-300' : 'bg-zinc-800 text-zinc-300'
          }`}>
            {testStatus === 'testing' && <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#e5ff00]" />}
            {testStatus === 'success' && <Check className="w-3.5 h-3.5 text-emerald-400" />}
            {testStatus === 'error' && <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />}
            <span>{testMessage}</span>
          </div>
        )}

        <div className="mt-5 flex items-center justify-between pt-3 border-t border-zinc-800">
          <button type="button" onClick={handleTest} disabled={testStatus === 'testing'} className="px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold text-zinc-300">
            {testStatus === 'testing' ? 'Kiểm tra...' : 'Kiểm tra key'}
          </button>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold text-zinc-300">Đóng</button>
            <button type="button" onClick={handleSave} className="px-4 py-1.5 rounded-xl bg-[#e5ff00] hover:bg-[#d6f000] text-black text-xs font-bold shadow-[0_0_15px_rgba(229,255,0,0.3)]">
              {savedSuccess ? 'Đã lưu!' : 'Lưu Key'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
