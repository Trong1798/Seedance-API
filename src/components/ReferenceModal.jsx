import React, { useState, useRef } from 'react'
import { Upload, Link, X, Image as ImageIcon, Check } from 'lucide-react'

export default function ReferenceModal({
  isOpen,
  onClose,
  referenceImage,
  onSelectImage,
  onRemoveImage
}) {
  if (!isOpen) return null

  const [inputUrl, setInputUrl] = useState('')
  const [activeTab, setActiveTab] = useState('upload')
  const fileInputRef = useRef(null)

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      alert('Vui lòng chọn file hình ảnh (PNG, JPG, WEBP)!')
      return
    }

    if (file.size > 10 * 1024 * 1024) {
      alert('Dung lượng ảnh tối đa 10MB!')
      return
    }

    const reader = new FileReader()
    reader.onload = (event) => {
      onSelectImage(event.target.result)
      onClose()
    }
    reader.readAsDataURL(file)
  }

  const handleApplyUrl = () => {
    if (!inputUrl.trim()) return
    onSelectImage(inputUrl.trim())
    setInputUrl('')
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <div className="relative w-full max-w-md bg-[#16161a] border border-zinc-800 rounded-3xl p-6 shadow-2xl">
        <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-zinc-800 text-[#e5ff00]">
              <ImageIcon className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Ảnh tham chiếu (Image-to-Video)</h3>
              <p className="text-[11px] text-zinc-400">Tạo chuyển động video từ ảnh mẫu</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg bg-zinc-800/80 hover:bg-zinc-800 text-zinc-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>

        {referenceImage && (
          <div className="mt-4 p-2.5 bg-zinc-900 border border-zinc-800 rounded-xl flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 overflow-hidden">
              <img src={referenceImage} alt="Ref" className="w-12 h-12 object-cover rounded-lg border border-zinc-700 shrink-0" />
              <div className="truncate text-xs">
                <span className="text-emerald-400 font-semibold flex items-center gap-1">
                  <Check className="w-3.5 h-3.5" /> Đã gắn ảnh tham chiếu
                </span>
              </div>
            </div>
            <button onClick={() => { onRemoveImage(); onClose(); }} className="px-2.5 py-1 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 text-xs rounded-lg border border-rose-500/30">
              Gỡ
            </button>
          </div>
        )}

        <div className="flex gap-2 mt-4 p-1 bg-zinc-900 rounded-xl border border-zinc-800">
          <button
            onClick={() => setActiveTab('upload')}
            className={`flex-1 py-1.5 rounded-lg text-xs font-semibold ${activeTab === 'upload' ? 'bg-zinc-800 text-white' : 'text-zinc-400'}`}
          >
            <Upload className="w-3 h-3 inline mr-1" /> Tải từ máy
          </button>
          <button
            onClick={() => setActiveTab('url')}
            className={`flex-1 py-1.5 rounded-lg text-xs font-semibold ${activeTab === 'url' ? 'bg-zinc-800 text-white' : 'text-zinc-400'}`}
          >
            <Link className="w-3 h-3 inline mr-1" /> Dán Link URL
          </button>
        </div>

        <div className="mt-4">
          {activeTab === 'upload' ? (
            <div>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-zinc-700 hover:border-[#e5ff00] bg-zinc-900/60 rounded-2xl p-6 text-center cursor-pointer transition"
              >
                <Upload className="w-8 h-8 mx-auto text-zinc-400 mb-2" />
                <p className="text-xs font-semibold text-zinc-200">Nhấn để chọn ảnh từ thiết bị</p>
                <p className="text-[10px] text-zinc-500 mt-1">PNG, JPG, WEBP tối đa 10MB</p>
              </div>
            </div>
          ) : (
            <div className="space-y-2.5">
              <input
                type="url"
                placeholder="https://example.com/image.jpg"
                value={inputUrl}
                onChange={(e) => setInputUrl(e.target.value)}
                className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-xs text-zinc-200 focus:outline-none focus:border-[#e5ff00]"
              />
              <button
                onClick={handleApplyUrl}
                disabled={!inputUrl.trim()}
                className="w-full py-2 rounded-xl bg-[#e5ff00] hover:bg-[#d4ee00] disabled:opacity-40 text-black font-bold text-xs"
              >
                Áp dụng URL
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
