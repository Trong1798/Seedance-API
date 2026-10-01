import React, { useState, useEffect } from 'react'
import { X, Download, ZoomIn, ZoomOut, ExternalLink, Film, Image as ImageIcon } from 'lucide-react'

export default function MediaLightbox({
  isOpen,
  onClose,
  mediaUrl,
  isImage = true,
  prompt = '',
  onDownload,
}) {
  const [zoom, setZoom] = useState(1)

  useEffect(() => {
    if (!isOpen) {
      setZoom(1)
      return
    }
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [isOpen, onClose])

  if (!isOpen || !mediaUrl) return null

  const isHttp = Boolean(mediaUrl && (mediaUrl.startsWith('http://') || mediaUrl.startsWith('https://')))

  const handleDownload = () => {
    if (onDownload) return onDownload()
    const a = document.createElement('a')
    a.href = mediaUrl
    a.download = isImage ? `seedance-image-${Date.now()}.png` : `seedance-video-${Date.now()}.mp4`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 backdrop-blur-md select-none"
      onClick={onClose}
    >
      {/* Top Header */}
      <div
        className="absolute top-0 inset-x-0 p-4 flex items-center justify-between z-10 bg-gradient-to-b from-black/80 to-transparent pointer-events-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 max-w-[70vw] truncate">
          <span className="p-1.5 rounded-lg bg-zinc-800 text-[#e5ff00]">
            {isImage ? <ImageIcon className="w-4 h-4" /> : <Film className="w-4 h-4" />}
          </span>
          <p className="text-xs text-zinc-300 font-medium truncate" title={prompt}>
            {prompt || (isImage ? 'Xem chi tiết hình ảnh' : 'Xem video')}
          </p>
        </div>
        <button
          onClick={onClose}
          className="p-2 rounded-full bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 hover:text-white transition"
          title="Đóng (Esc)"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Main Content */}
      <div
        className="w-full h-full flex items-center justify-center p-4 sm:p-8 overflow-auto"
        onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
      >
        {isImage ? (
          <img
            src={mediaUrl}
            alt={prompt || 'Xem ảnh'}
            onClick={(e) => {
              e.stopPropagation()
              setZoom((z) => (z === 1 ? 1.75 : 1))
            }}
            style={{ transform: `scale(${zoom})`, transformOrigin: 'center center' }}
            className={`max-w-full max-h-[85vh] object-contain rounded-xl shadow-2xl transition-transform duration-150 ${
              zoom > 1 ? 'cursor-zoom-out' : 'cursor-zoom-in'
            }`}
          />
        ) : (
          <div className="w-full max-w-5xl max-h-[85vh] flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
            <video src={mediaUrl} controls autoPlay playsInline className="max-w-full max-h-[85vh] rounded-xl shadow-2xl" />
          </div>
        )}
      </div>

      {/* Toolbar */}
      <div
        className="absolute bottom-6 inset-x-0 flex items-center justify-center gap-2 z-10 pointer-events-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-1.5 p-1.5 px-3 rounded-full bg-zinc-900/90 border border-zinc-800 backdrop-blur-xl shadow-2xl">
          {isImage && (
            <>
              <button
                onClick={() => setZoom((z) => Math.max(z - 0.25, 0.5))}
                disabled={zoom <= 0.5}
                className="p-1.5 rounded-full hover:bg-zinc-800 disabled:opacity-30 text-zinc-300 transition"
                title="Thu nhỏ"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <button
                onClick={() => setZoom(1)}
                className="px-2 py-0.5 rounded-md hover:bg-zinc-800 text-[11px] font-mono text-zinc-300 hover:text-[#e5ff00] transition"
                title="Đặt lại 100%"
              >
                {Math.round(zoom * 100)}%
              </button>
              <button
                onClick={() => setZoom((z) => Math.min(z + 0.25, 3))}
                disabled={zoom >= 3}
                className="p-1.5 rounded-full hover:bg-zinc-800 disabled:opacity-30 text-zinc-300 transition"
                title="Phóng to"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
              <div className="w-[1px] h-4 bg-zinc-800 mx-1" />
            </>
          )}

          <button
            onClick={handleDownload}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#e5ff00] hover:bg-[#d4ee00] text-black text-xs font-bold transition"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Tải về</span>
          </button>

          {isHttp && (
            <a
              href={mediaUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1.5 rounded-full hover:bg-zinc-800 text-zinc-400 hover:text-white transition"
              title="Mở link gốc CDN trong tab mới"
            >
              <ExternalLink className="w-4 h-4" />
            </a>
          )}

          <div className="w-[1px] h-4 bg-zinc-800 mx-1" />

          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-full bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold transition"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  )
}
