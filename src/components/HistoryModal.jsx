import React from 'react'
import { History, X, Download, Copy, Trash2, Film, Image as ImageIcon, ExternalLink, Play } from 'lucide-react'
import { getDirectVideoUrl } from '../services/api'

export default function HistoryModal({
  isOpen,
  onClose,
  videos,
  onSelectVideo,
  onRemoveVideo,
  onClearAll,
  apiKey,
}) {
  if (!isOpen) return null

  const handleOpenDirectTab = (vid) => {
    const directUrl = getDirectVideoUrl(vid.url, apiKey)
    if (directUrl) {
      window.open(directUrl, '_blank')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <div className="w-full max-w-3xl max-h-[85vh] bg-[#141418] border border-zinc-800 rounded-3xl p-6 shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-zinc-800 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-zinc-800 text-[#e5ff00]">
              <History className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Lịch sử khởi tạo ({videos.length})</h3>
              <p className="text-xs text-zinc-400">Lưu trữ cục bộ trên máy của bạn (Video & Ảnh)</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {videos.length > 0 && (
              <button
                onClick={onClearAll}
                className="px-3 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 text-xs font-semibold border border-rose-500/20 transition flex items-center gap-1"
              >
                <Trash2 className="w-3.5 h-3.5" /> Xóa tất cả
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content list */}
        <div className="overflow-y-auto mt-4 pr-1 space-y-3 flex-1">
          {videos.length === 0 ? (
            <div className="py-16 text-center text-zinc-500 text-sm">
              <Film className="w-10 h-10 mx-auto mb-2 opacity-30 text-zinc-400" />
              Chưa có tác phẩm nào trong lịch sử.<br />Hãy tạo video hoặc hình ảnh đầu tiên của bạn!
            </div>
          ) : (
            videos.map((vid) => {
              const isImg = vid.mediaType === 'image'
              return (
                <div
                  key={vid.id}
                  className="p-3 bg-zinc-900/80 border border-zinc-800/80 hover:border-zinc-700 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 transition"
                >
                  {/* Thumbnail / Video Preview trigger */}
                  <div
                    className="w-full sm:w-28 h-20 bg-zinc-950 rounded-xl overflow-hidden shrink-0 border border-zinc-800 cursor-pointer relative group flex items-center justify-center"
                    onClick={() => onSelectVideo(vid)}
                  >
                    {isImg && vid.url ? (
                      <img src={vid.url} alt={vid.prompt} className="w-full h-full object-cover group-hover:scale-105 transition" />
                    ) : (
                      <div className="absolute inset-0 bg-gradient-to-tr from-black via-zinc-900 to-black/80 flex flex-col items-center justify-center gap-1 group-hover:scale-105 transition">
                        <span className="p-2 bg-[#e5ff00]/10 rounded-full border border-[#e5ff00]/30 text-[#e5ff00] group-hover:bg-[#e5ff00] group-hover:text-black transition">
                          {isImg ? <ImageIcon className="w-3.5 h-3.5" /> : <Film className="w-3.5 h-3.5" />}
                        </span>
                        <span className="text-[10px] font-semibold text-zinc-400 group-hover:text-white transition">
                          {isImg ? 'Xem ảnh' : 'Xem video'}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#e5ff00]/15 text-[#e5ff00] font-bold">
                        {vid.model}
                      </span>
                      <span className="text-[10px] text-zinc-400 font-mono">
                        {vid.seconds ? `${vid.seconds}s • ` : ''}{vid.size}
                      </span>
                      <span className="text-[10px] text-zinc-500">
                        {vid.createdAt ? new Date(vid.createdAt).toLocaleDateString('vi-VN') : ''}
                      </span>
                    </div>
                    <p className="text-xs text-zinc-200 line-clamp-2 font-medium">
                      {vid.prompt}
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                    <button
                      onClick={() => onSelectVideo(vid)}
                      className="p-2 rounded-xl bg-zinc-800 hover:bg-[#e5ff00] text-zinc-300 hover:text-black transition"
                      title={isImg ? "Xem ảnh trong Studio" : "Phát video trong Studio"}
                    >
                      {isImg ? <ImageIcon className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 fill-current" />}
                    </button>
                    <button
                      onClick={() => handleOpenDirectTab(vid)}
                      className="p-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white transition"
                      title="Mở tab mới trực tiếp (Key Auth)"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(vid.prompt)
                        alert('Đã sao chép prompt!')
                      }}
                      className="p-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white transition"
                      title="Sao chép prompt"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => onRemoveVideo(vid.id)}
                      className="p-2 rounded-xl bg-zinc-800 hover:bg-rose-500/20 text-zinc-400 hover:text-rose-400 transition"
                      title="Xóa khỏi lịch sử"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
