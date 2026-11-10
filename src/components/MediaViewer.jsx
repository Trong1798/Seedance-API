import React, { useCallback, useEffect, useRef, useState } from 'react'
import { X, ChevronLeft, ChevronRight, Copy, Check, RefreshCw, ImagePlus, Download, Trash2, ZoomIn, ZoomOut, Image as ImageIcon, Film, Loader2, Info, ChevronDown, ChevronUp } from 'lucide-react'
import { fetchVideoBlob } from '../services/api'
import { displaySrc, isImageItem, modelLabel, qualityLabel, formatDate } from '../services/media'

const MAX_ZOOM = 8

/**
 * Ảnh xem kiểu Zalo PC: lăn chuột để phóng to tại vị trí con trỏ, kéo để di chuyển,
 * không nhỏ hơn kích thước mặc định; khi thu nhỏ lại ảnh tự trượt về giữa (luôn bị giới hạn trong khung).
 */
function ZoomableImage({ src, alt, onNaturalSize }) {
  const containerRef = useRef(null)
  const imgRef = useRef(null)
  const [view, setView] = useState({ s: 1, x: 0, y: 0 })
  const [dragging, setDragging] = useState(false)
  const dragRef = useRef(null)

  useEffect(() => setView({ s: 1, x: 0, y: 0 }), [src])

  const clamp = useCallback((s, x, y) => {
    const c = containerRef.current
    const im = imgRef.current
    if (!c || !im) return { s, x, y }
    const maxX = Math.max(0, (im.offsetWidth * s - c.clientWidth) / 2)
    const maxY = Math.max(0, (im.offsetHeight * s - c.clientHeight) / 2)
    return { s, x: Math.max(-maxX, Math.min(maxX, x)), y: Math.max(-maxY, Math.min(maxY, y)) }
  }, [])

  // Phóng to/thu nhỏ quanh điểm (px, py) tính từ tâm khung
  const zoomAt = useCallback((factorOrScale, px = 0, py = 0, absolute = false) => {
    setView(prev => {
      const s = Math.min(MAX_ZOOM, Math.max(1, absolute ? factorOrScale : prev.s * factorOrScale))
      const k = s / prev.s
      return clamp(s, px - (px - prev.x) * k, py - (py - prev.y) * k)
    })
  }, [clamp])

  const pointFromEvent = (e) => {
    const rect = containerRef.current.getBoundingClientRect()
    return [e.clientX - rect.left - rect.width / 2, e.clientY - rect.top - rect.height / 2]
  }

  useEffect(() => {
    const c = containerRef.current
    if (!c) return
    const onWheel = (e) => {
      e.preventDefault()
      const [px, py] = pointFromEvent(e)
      zoomAt(Math.exp(-e.deltaY * 0.0015), px, py)
    }
    c.addEventListener('wheel', onWheel, { passive: false })
    return () => c.removeEventListener('wheel', onWheel)
  }, [zoomAt])

  useEffect(() => {
    const onResize = () => setView(v => clamp(v.s, v.x, v.y))
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [clamp])

  const onPointerDown = (e) => {
    if (view.s <= 1 || e.button !== 0) return
    e.currentTarget.setPointerCapture(e.pointerId)
    dragRef.current = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y }
    setDragging(true)
  }
  const onPointerMove = (e) => {
    const d = dragRef.current
    if (!d) return
    setView(v => clamp(v.s, d.vx + e.clientX - d.x, d.vy + e.clientY - d.y))
  }
  const endDrag = () => { dragRef.current = null; setDragging(false) }

  const onDoubleClick = (e) => {
    const [px, py] = pointFromEvent(e)
    if (view.s > 1) setView({ s: 1, x: 0, y: 0 })
    else zoomAt(2.5, px, py, true)
  }

  return (
    <div
      ref={containerRef}
      className={`absolute inset-0 flex items-center justify-center overflow-hidden select-none ${
        view.s > 1 ? (dragging ? 'cursor-grabbing' : 'cursor-grab') : 'cursor-zoom-in'
      }`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onDoubleClick={onDoubleClick}
    >
      <img
        ref={imgRef}
        src={src}
        alt={alt}
        draggable={false}
        onLoad={(e) => onNaturalSize?.(`${e.currentTarget.naturalWidth}×${e.currentTarget.naturalHeight}`)}
        className="max-w-[calc(100%-48px)] max-h-[calc(100%-48px)] object-contain shadow-2xl"
        style={{
          transform: `translate(${view.x}px, ${view.y}px) scale(${view.s})`,
          transition: dragging ? 'none' : 'transform 0.16s ease-out',
          willChange: 'transform',
        }}
      />

      {/* Thanh zoom */}
      <div
        className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-1 px-1.5 py-1 rounded-full bg-black/55 backdrop-blur-md border border-white/10 text-white"
        onPointerDown={(e) => e.stopPropagation()}
        onDoubleClick={(e) => e.stopPropagation()}
      >
        <button type="button" title="Thu nhỏ" disabled={view.s <= 1} onClick={() => zoomAt(1 / 1.5)}
          className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-white/15 disabled:opacity-30">
          <ZoomOut className="w-4 h-4" />
        </button>
        <button type="button" title="Về kích thước ban đầu" onClick={() => setView({ s: 1, x: 0, y: 0 })}
          className="min-w-[52px] text-xs font-semibold tabular-nums hover:text-[#e5ff00]">
          {Math.round(view.s * 100)}%
        </button>
        <button type="button" title="Phóng to" disabled={view.s >= MAX_ZOOM} onClick={() => zoomAt(1.5)}
          className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-white/15 disabled:opacity-30">
          <ZoomIn className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}

function VideoStage({ item, sessionBlobs, apiKey, onNaturalSize }) {
  const direct = displaySrc(item, sessionBlobs)
  const [src, setSrc] = useState(direct)
  const [state, setState] = useState(direct ? 'ready' : 'loading')

  useEffect(() => {
    if (direct) { setSrc(direct); setState('ready'); return }
    // Link Xianfeng cần key: tải về bộ nhớ rồi phát
    let created = null
    let cancelled = false
    setState('loading')
    fetchVideoBlob(item.url, apiKey)
      .then(u => { if (cancelled) { URL.revokeObjectURL(u); return } created = u; setSrc(u); setState('ready') })
      .catch(() => !cancelled && setState('error'))
    return () => { cancelled = true; if (created) URL.revokeObjectURL(created) }
  }, [item.id, direct, apiKey])

  if (state === 'loading') {
    return <div className="absolute inset-0 flex items-center justify-center"><Loader2 className="w-8 h-8 text-[#e5ff00] animate-spin" /></div>
  }
  if (state === 'error') {
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-zinc-400 text-sm text-center p-6">
        <Film className="w-8 h-8" />
        Không tải được video — link của nhà cung cấp có thể đã hết hạn.
      </div>
    )
  }
  return (
    <div className="absolute inset-0 flex items-center justify-center p-6">
      <video
        key={src}
        src={src}
        controls
        autoPlay
        loop
        playsInline
        onLoadedMetadata={(e) => onNaturalSize?.(`${e.currentTarget.videoWidth}×${e.currentTarget.videoHeight}`)}
        className="max-w-full max-h-full rounded-lg shadow-2xl bg-black"
      />
    </div>
  )
}

function Row({ label, children }) {
  return (
    <div className="flex items-start justify-between gap-4 py-1.5 text-xs">
      <span className="text-zinc-500 shrink-0">{label}</span>
      <span className="text-zinc-100 text-right font-medium break-words">{children}</span>
    </div>
  )
}

export default function MediaViewer({
  items, index, onNavigate, onClose, sessionBlobs, storageState, apiKey,
  onRecreate, onReference, onDownload, onDelete,
}) {
  const item = items[index]
  const [naturalSize, setNaturalSize] = useState(null)
  const [copied, setCopied] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [downloading, setDownloading] = useState(false)

  useEffect(() => { setNaturalSize(null); setExpanded(false) }, [item?.id])

  useEffect(() => {
    const onKey = (e) => {
      if (/^(INPUT|TEXTAREA)$/.test(e.target.tagName)) return
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowLeft' && index > 0) onNavigate(index - 1)
      if (e.key === 'ArrowRight' && index < items.length - 1) onNavigate(index + 1)
    }
    window.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prevOverflow }
  }, [index, items.length, onClose, onNavigate])

  if (!item) return null
  const isImage = isImageItem(item)
  const storage = storageState[item.id]
  const storageText = storage?.status === 'saving'
    ? `Đang lưu lên R2${storage.progress ? ` ${storage.progress}%` : '...'}`
    : storage?.status === 'failed'
      ? 'Lưu R2 thất bại · link có hạn'
      : item.storedUrl ? 'R2 (vĩnh viễn)' : 'Link nhà cung cấp (có hạn)'

  const handleCopy = () => {
    navigator.clipboard.writeText(item.prompt || '')
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const handleDownload = async () => {
    setDownloading(true)
    try { await onDownload(item) } finally { setDownloading(false) }
  }

  const longPrompt = (item.prompt || '').length > 320

  return (
    <div className="fixed inset-0 z-[70] flex flex-col md:flex-row bg-[#060607]/97 backdrop-blur-sm">
      {/* Khung xem */}
      <div className="relative flex-1 min-h-[45vh] md:min-h-0">
        {isImage ? (
          <ZoomableImage src={displaySrc(item, sessionBlobs)} alt={item.prompt || ''} onNaturalSize={setNaturalSize} />
        ) : (
          <VideoStage item={item} sessionBlobs={sessionBlobs} apiKey={apiKey} onNaturalSize={setNaturalSize} />
        )}

        {index > 0 && (
          <button type="button" title="Trước (←)" onClick={() => onNavigate(index - 1)}
            className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/45 hover:bg-white/20 backdrop-blur-md border border-white/10 text-white flex items-center justify-center">
            <ChevronLeft className="w-5 h-5" />
          </button>
        )}
        {index < items.length - 1 && (
          <button type="button" title="Sau (→)" onClick={() => onNavigate(index + 1)}
            className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/45 hover:bg-white/20 backdrop-blur-md border border-white/10 text-white flex items-center justify-center">
            <ChevronRight className="w-5 h-5" />
          </button>
        )}
        <div className="absolute top-3 left-3 px-2 py-1 rounded-full bg-black/45 backdrop-blur-md text-[11px] text-zinc-300 tabular-nums">
          {index + 1} / {items.length}
        </div>
      </div>

      {/* Bảng thông tin */}
      <aside className="w-full md:w-[360px] shrink-0 max-h-[55vh] md:max-h-none flex flex-col bg-[#131417] border-t md:border-t-0 md:border-l border-white/10">
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-white/10">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-[#e5ff00] shrink-0">
              {isImage ? <ImageIcon className="w-4 h-4" /> : <Film className="w-4 h-4" />}
            </span>
            <div className="min-w-0">
              <div className="text-sm font-semibold text-white truncate">{modelLabel(item)}</div>
              <div className="text-[11px] text-zinc-500">{formatDate(item.createdAt)}</div>
            </div>
          </div>
          <button type="button" onClick={onClose} title="Đóng (Esc)"
            className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/15 text-zinc-300 flex items-center justify-center shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-300">
            <Info className="w-3.5 h-3.5" /> Info
          </div>

          <section className="rounded-xl bg-white/[0.04] border border-white/[0.06] p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-semibold tracking-wider text-zinc-500 uppercase">Prompt</span>
              <button type="button" onClick={handleCopy}
                className="px-2 py-0.5 rounded-md bg-white/5 hover:bg-white/15 text-[11px] text-zinc-200 flex items-center gap-1">
                {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                {copied ? 'Đã chép' : 'Copy'}
              </button>
            </div>
            <p className={`text-[13px] leading-relaxed text-zinc-100 whitespace-pre-wrap break-words ${!expanded && longPrompt ? 'line-clamp-6' : ''}`}>
              {item.prompt || '—'}
            </p>
            {longPrompt && (
              <button type="button" onClick={() => setExpanded(v => !v)}
                className="mt-1.5 text-[11px] text-zinc-400 hover:text-white flex items-center gap-0.5">
                {expanded ? <>Thu gọn <ChevronUp className="w-3 h-3" /></> : <>Xem tất cả <ChevronDown className="w-3 h-3" /></>}
              </button>
            )}
          </section>

          {Array.isArray(item.references) && item.references.length > 0 && (
            <section className="rounded-xl bg-white/[0.04] border border-white/[0.06] p-3">
              <div className="text-[11px] font-semibold tracking-wider text-zinc-500 uppercase mb-2">Ảnh tham chiếu</div>
              <div className="flex flex-wrap gap-1.5">
                {item.references.map((ref, i) => (
                  <img key={i} src={ref.url} alt={ref.name || `Image${i + 1}`} title={`Image${i + 1}`}
                    className="w-11 h-11 rounded-lg object-cover border border-white/10" />
                ))}
              </div>
            </section>
          )}

          <section className="rounded-xl bg-white/[0.04] border border-white/[0.06] px-3 py-2">
            <div className="text-[11px] font-semibold tracking-wider text-zinc-500 uppercase py-1">Details</div>
            <Row label="Loại">{isImage ? 'Ảnh' : 'Video'}</Row>
            <Row label="Model">{modelLabel(item)}</Row>
            <Row label="Chất lượng">{qualityLabel(item)}</Row>
            <Row label="Tỉ lệ">{item.ratio || '—'}</Row>
            <Row label="Kích thước">{naturalSize || item.size || '—'}</Row>
            {!isImage && <Row label="Thời lượng">{item.seconds ? `${item.seconds} giây` : '—'}</Row>}
            <Row label="Ngày tạo">{formatDate(item.createdAt)}</Row>
            <Row label="Lưu trữ">{storageText}</Row>
          </section>
        </div>

        <div className="p-4 border-t border-white/10 space-y-2">
          <button type="button" onClick={() => onRecreate(item)}
            className="w-full py-2.5 rounded-xl bg-[#e5ff00] hover:bg-[#d6f000] text-black text-sm font-bold flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(229,255,0,0.25)]">
            <RefreshCw className="w-4 h-4" /> Recreate
          </button>
          <div className="flex gap-2">
            {isImage && (
              <button type="button" onClick={() => onReference(item)}
                className="flex-1 py-2 rounded-xl bg-white/[0.07] hover:bg-white/15 border border-white/10 text-sm font-semibold text-white flex items-center justify-center gap-1.5">
                <ImagePlus className="w-4 h-4" /> Reference
              </button>
            )}
            <button type="button" onClick={handleDownload} disabled={downloading}
              className="flex-1 py-2 rounded-xl bg-white/[0.07] hover:bg-white/15 border border-white/10 text-sm font-semibold text-white flex items-center justify-center gap-1.5 disabled:opacity-60">
              {downloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />} Download
            </button>
            <button type="button" onClick={() => onDelete(item)} title="Xóa"
              className="w-11 shrink-0 py-2 rounded-xl bg-white/[0.07] hover:bg-rose-500/80 border border-white/10 text-zinc-200 hover:text-white flex items-center justify-center">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>
    </div>
  )
}
