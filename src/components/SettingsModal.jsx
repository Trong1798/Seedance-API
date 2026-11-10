import React, { useState } from 'react'
import { Key, Eye, EyeOff, ShieldCheck, ExternalLink, X, Check, AlertTriangle, RefreshCw, Film, Image as ImageIcon } from 'lucide-react'
import { getApiKey, setApiKey, getHiggsfieldCredentials, setHiggsfieldCredentials } from '../services/storage'
import { testApiKey, testHiggsfieldCredentials } from '../services/api'

const inputCls = 'w-full pl-3 pr-9 py-2 bg-zinc-900 border border-zinc-700 rounded-xl text-xs text-zinc-200 focus:outline-none focus:border-[#e5ff00] font-mono'

function SecretInput({ value, onChange, placeholder }) {
  const [show, setShow] = useState(false)
  return (
    <div className="relative">
      <input
        type={show ? 'text' : 'password'}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={inputCls}
        autoComplete="off"
      />
      <button type="button" onClick={() => setShow(!show)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400">
        {show ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
      </button>
    </div>
  )
}

function TestResult({ status, message }) {
  if (!status) return null
  return (
    <div className={`mt-2 p-2 rounded-xl text-xs flex items-start gap-2 ${
      status === 'success' ? 'bg-emerald-500/10 text-emerald-300' :
      status === 'error' ? 'bg-rose-500/10 text-rose-300' : 'bg-zinc-800 text-zinc-300'
    }`}>
      {status === 'testing' && <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#e5ff00] shrink-0 mt-0.5" />}
      {status === 'success' && <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />}
      {status === 'error' && <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0 mt-0.5" />}
      <span className="whitespace-pre-line break-words">{message}</span>
    </div>
  )
}

export default function SettingsModal({ isOpen, onClose, onApiKeyChange }) {
  if (!isOpen) return null

  const savedHf = getHiggsfieldCredentials()
  const [inputKey, setInputKey] = useState(getApiKey())
  const [hfKeyId, setHfKeyId] = useState(savedHf.keyId)
  const [hfSecret, setHfSecret] = useState(savedHf.secret)
  const [videoTest, setVideoTest] = useState({ status: null, message: '' })
  const [imageTest, setImageTest] = useState({ status: null, message: '' })
  const [savedSuccess, setSavedSuccess] = useState(false)

  const handleSave = () => {
    setApiKey(inputKey)
    setHiggsfieldCredentials(hfKeyId, hfSecret)
    onApiKeyChange?.(inputKey.trim())
    setSavedSuccess(true)
    setTimeout(() => { setSavedSuccess(false); onClose(); }, 700)
  }

  const handleTestVideo = async () => {
    if (!inputKey.trim()) {
      setVideoTest({ status: 'error', message: 'Vui lòng nhập API Key Xianfeng trước!' })
      return
    }
    setVideoTest({ status: 'testing', message: 'Đang kết nối...' })
    const res = await testApiKey(inputKey)
    setVideoTest({ status: res.success ? 'success' : 'error', message: res.message })
  }

  const handleTestImage = async () => {
    setImageTest({ status: 'testing', message: 'Đang kết nối...' })
    const res = await testHiggsfieldCredentials(hfKeyId, hfSecret)
    setImageTest({ status: res.success ? 'success' : 'error', message: res.message })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <div className="w-full max-w-md max-h-[92vh] overflow-y-auto bg-[#16161a] border border-zinc-800 rounded-3xl p-6 shadow-2xl">
        <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-zinc-800 text-[#e5ff00]"><Key className="w-4 h-4" /></div>
            <div>
              <h3 className="text-sm font-bold text-white">Cài đặt API Key</h3>
              <p className="text-[11px] text-zinc-400">Video: Xianfeng · Ảnh: Higgsfield Soul Cinema</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400"><X className="w-4 h-4" /></button>
        </div>

        <div className="mt-3.5 p-2.5 bg-emerald-500/10 border border-emerald-500/25 rounded-xl flex items-start gap-2 text-[11px] text-emerald-200">
          <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
          <span>
            <b>Lưu cục bộ:</b> các key chỉ lưu trên trình duyệt (LocalStorage) của bạn. Key Xianfeng gửi thẳng tới xianfengapi.xyz;
            key Higgsfield đi qua máy chủ trung gian của chính web này (/api/hf) tới api.higgsfield.ai, không lưu lại ở đâu khác.
          </span>
        </div>

        {/* Xianfeng — video */}
        <div className="mt-4 p-3 rounded-2xl border border-zinc-800 bg-zinc-900/40">
          <div className="flex items-center justify-between text-xs text-zinc-300 mb-1.5">
            <label className="font-semibold flex items-center gap-1.5"><Film className="w-3.5 h-3.5 text-[#e5ff00]" />Video — Xianfeng API Key</label>
            <a href="https://xianfengapi.xyz/console/token" target="_blank" rel="noreferrer" className="text-[#e5ff00] hover:underline flex items-center gap-0.5 text-[11px]">
              Tạo key (API 密钥) <ExternalLink className="w-2.5 h-2.5" />
            </a>
          </div>
          <SecretInput value={inputKey} onChange={setInputKey} placeholder="sk-xxxxxxxxxxxxxxxx" />
          <div className="mt-2 flex justify-end">
            <button type="button" onClick={handleTestVideo} disabled={videoTest.status === 'testing'} className="px-3 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-[11px] font-semibold text-zinc-300">
              {videoTest.status === 'testing' ? 'Đang kiểm tra...' : 'Kiểm tra key video'}
            </button>
          </div>
          <TestResult {...videoTest} />
        </div>

        {/* Higgsfield — ảnh */}
        <div className="mt-3 p-3 rounded-2xl border border-zinc-800 bg-zinc-900/40">
          <div className="flex items-center justify-between text-xs text-zinc-300 mb-1.5">
            <label className="font-semibold flex items-center gap-1.5"><ImageIcon className="w-3.5 h-3.5 text-[#e5ff00]" />Ảnh — Higgsfield (Soul Cinema)</label>
            <a href="https://console.higgsfield.ai" target="_blank" rel="noreferrer" className="text-[#e5ff00] hover:underline flex items-center gap-0.5 text-[11px]">
              Tạo key <ExternalLink className="w-2.5 h-2.5" />
            </a>
          </div>
          <div className="space-y-1.5">
            <SecretInput value={hfKeyId} onChange={setHfKeyId} placeholder="Key ID" />
            <SecretInput value={hfSecret} onChange={setHfSecret} placeholder="Key Secret" />
          </div>
          <div className="mt-2 flex justify-end">
            <button type="button" onClick={handleTestImage} disabled={imageTest.status === 'testing'} className="px-3 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-[11px] font-semibold text-zinc-300">
              {imageTest.status === 'testing' ? 'Đang kiểm tra...' : 'Kiểm tra key ảnh'}
            </button>
          </div>
          <TestResult {...imageTest} />
        </div>

        <div className="mt-5 flex items-center justify-end gap-2 pt-3 border-t border-zinc-800">
          <button type="button" onClick={onClose} className="px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold text-zinc-300">Đóng</button>
          <button type="button" onClick={handleSave} className="px-4 py-1.5 rounded-xl bg-[#e5ff00] hover:bg-[#d6f000] text-black text-xs font-bold shadow-[0_0_15px_rgba(229,255,0,0.3)]">
            {savedSuccess ? 'Đã lưu!' : 'Lưu Key'}
          </button>
        </div>
      </div>
    </div>
  )
}
