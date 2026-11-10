import React, { useEffect, useRef, useState } from 'react'
import { Check, Download, RefreshCw, ImagePlus, Trash2, Play, Film, Loader2, X } from 'lucide-react'
import { displaySrc, isImageItem, ratioOf } from '../services/media'

// Lưới ảnh/video kiểu "justified rows": mỗi hàng cao bằng nhau, độ rộng theo tỉ lệ từng mục
const BASE_ROW = 260

function QuickButton({ title, onClick, children, danger }) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={(e) => { e.stopPropagation(); onClick?.() }}
      className={`w-8 h-8 rounded-full flex items-center justify-center backdrop-blur-md bg-black/45 border border-white/15 text-white transition ${
        danger ? 'hover:bg-rose-500/80 hover:border-rose-400' : 'hover:bg-white/25'
      }`}
    >
      {children}
    </button>
  )
}

function PendingTile({ pending }) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])
  const r = pending.ratio || 16 / 9
  const elapsed = Math.max(0, Math.floor((now - pending.startedAt) / 1000))
  const mm = String(Math.floor(elapsed / 60)).padStart(2, '0')
  const ss = String(elapsed % 60).padStart(2, '0')

  return (
    <div className="relative" style={{ flexGrow: r * 100, flexBasis: `${r * BASE_ROW}px` }}>
      <div style={{ paddingBottom: `${100 / r}%` }} />
      <div className="absolute inset-0 rounded-md overflow-hidden bg-zinc-900 border border-white/10">
        <div className="absolute inset-0 bg-gradient-to-br from-[#e5ff00]/10 via-transparent to-sky-500/10 animate-pulse" />
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-4 text-center">
          <Loader2 className="w-6 h-6 text-[#e5ff00] animate-spin" />
          <div className="text-xs font-semibold text-white">
            Đang tạo {pending.mediaType === 'image' ? 'ảnh' : 'video'} · {mm}:{ss}
          </div>
          {pending.status && <div className="text-[11px] text-zinc-400 line-clamp-2 max-w-[90%]">{pending.status}</div>}
          <button
            type="button"
            onClick={pending.onCancel}
            className="mt-1 px-2.5 py-1 rounded-full bg-white/10 hover:bg-rose-500/70 text-[11px] text-zinc-200 flex items-center gap-1 transition"
          >
            <X className="w-3 h-3" /> Hủy
          </button>
        </div>
      </div>
    </div>
  )
}

function Tile({ item, src, selected, selectionMode, storage, onOpen, onToggleSelect, onDownload, onRecreate, onReference, onDelete }) {
  const isImage = isImageItem(item)
  const r = ratioOf(item)
  const videoRef = useRef(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => setFailed(false), [src])

  return (
    <div
      className="relative group cursor-pointer"
      style={{ flexGrow: r * 100, flexBasis: `${r * BASE_ROW}px` }}
      onClick={() => (selectionMode ? onToggleSelect(item.id) : onOpen(item.id))}
      onMouseEnter={() => videoRef.current?.play().catch(() => {})}
      onMouseLeave={() => {
        const v = videoRef.current
        if (v) { v.pause(); v.currentTime = 0.1 }
      }}
    >
      <div style={{ paddingBottom: `${100 / r}%` }} />
      <div className={`absolute inset-0 rounded-md overflow-hidden bg-zinc-900 transition ${selected ? 'ring-2 ring-[#e5ff00] ring-offset-2 ring-offset-[#09090b]' : ''}`}>
        {src && !failed ? (
          isImage ? (
            <img src={src} alt={item.prompt || ''} loading="lazy" draggable={false} onError={() => setFailed(true)}
              className="w-full h-full object-cover transition duration-300 group-hover:scale-[1.02]" />
          ) : (
            <video ref={videoRef} src={src.startsWith('blob:') ? src : `${src}#t=0.1`} muted loop playsInline preload="metadata"
              onError={() => setFailed(true)} className="w-full h-full object-cover" />
          )
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-1.5 text-zinc-500 p-3 text-center">
            <Film className="w-6 h-6" />
            <span className="text-[11px] leading-snug">Link đã hết hạn<br />hoặc cần mở bằng key</span>
          </div>
        )}

        {/* Lớp tối khi rê chuột */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/45 via-transparent to-black/55 opacity-0 group-hover:opacity-100 transition pointer-events-none" />

        {/* Chọn */}
        <button
          type="button"
          aria-label={selected ? 'Bỏ chọn' : 'Chọn'}
          title={selected ? 'Bỏ chọn' : 'Chọn'}
          onClick={(e) => { e.stopPropagation(); onToggleSelect(item.id) }}
          className={`absolute top-2 left-2 w-6 h-6 rounded-md border flex items-center justify-center transition ${
            selected
              ? 'bg-[#e5ff00] border-[#e5ff00] text-black opacity-100'
              : `bg-black/35 border-white/60 text-transparent backdrop-blur-sm ${selectionMode ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`
          }`}
        >
          <Check className="w-4 h-4" strokeWidth={3} />
        </button>

        {/* Nút nhanh */}
        {!selectionMode && (
          <div className="absolute top-2 right-2 flex flex-col gap-1.5 opacity-0 group-hover:opacity-100 transition">
            <QuickButton title="Tải xuống" onClick={() => onDownload(item)}><Download className="w-4 h-4" /></QuickButton>
            <QuickButton title="Recreate – dùng lại prompt & cài đặt" onClick={() => onRecreate(item)}><RefreshCw className="w-4 h-4" /></QuickButton>
            {isImage && (
              <QuickButton title="Dùng làm ảnh tham chiếu" onClick={() => onReference(item)}><ImagePlus className="w-4 h-4" /></QuickButton>
            )}
            <QuickButton title="Xóa" danger onClick={() => onDelete(item)}><Trash2 className="w-4 h-4" /></QuickButton>
          </div>
        )}

        {/* Nhãn dưới */}
        <div className="absolute left-2 bottom-2 right-2 flex items-end justify-between gap-2 pointer-events-none">
          {!isImage ? (
            <span className="px-1.5 py-0.5 rounded-md bg-black/55 backdrop-blur-sm text-[10px] font-semibold text-white flex items-center gap-1">
              <Play className="w-2.5 h-2.5 fill-white" />{item.seconds ? `${item.seconds}s` : 'Video'}
            </span>
          ) : <span />}
          {storage?.status === 'saving' && (
            <span className="px-1.5 py-0.5 rounded-md bg-black/55 backdrop-blur-sm text-[10px] text-zinc-200 flex items-center gap-1">
              <Loader2 className="w-2.5 h-2.5 animate-spin" />Đang lưu{storage.progress ? ` ${storage.progress}%` : ''}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

export default function MediaGallery({
  items, sessionBlobs, storageState, pending, selectedIds,
  onOpen, onToggleSelect, onDownload, onRecreate, onReference, onDelete,
}) {
  const selectionMode = selectedIds.size > 0

  return (
    <div className="flex flex-wrap gap-1.5">
      {pending && <PendingTile pending={pending} />}
      {items.map(item => (
        <Tile
          key={item.id}
          item={item}
          src={displaySrc(item, sessionBlobs)}
          selected={selectedIds.has(item.id)}
          selectionMode={selectionMode}
          storage={storageState[item.id]}
          onOpen={onOpen}
          onToggleSelect={onToggleSelect}
          onDownload={onDownload}
          onRecreate={onRecreate}
          onReference={onReference}
          onDelete={onDelete}
        />
      ))}
      {/* Phần tử đệm để hàng cuối không bị kéo giãn */}
      <div style={{ flexGrow: 100000, flexBasis: 0 }} />
    </div>
  )
}
