import React, { useState, useEffect } from 'react'
import { Loader2, Radio, XCircle, Sparkles, Film } from 'lucide-react'

export default function GenerationProgress({
  mediaType = 'video',
  modelName,
  seconds,
  prompt,
  onCancel,
  heartbeatCount = 0,
  lastHeartbeat = null,
  statusMessage = null,
}) {
  const [elapsed, setElapsed] = useState(0)
  const isImageMode = mediaType === 'image'

  useEffect(() => {
    const timer = setInterval(() => {
      setElapsed((prev) => prev + 1)
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  const formatTime = (sec) => {
    const m = Math.floor(sec / 60)
    const s = sec % 60
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }

  // Dynamic progress stage messages or live message from server
  let stageMsg = statusMessage || (isImageMode ? 'Đang kết nối tới mô hình AI tạo ảnh...' : 'Đang kết nối trực tiếp tới cụm GPU Seedance...')
  let stagePercent = 15

  if (!statusMessage) {
    if (isImageMode) {
      if (elapsed <= 3) {
        stageMsg = 'Đang phân tích câu lệnh prompt & cấu hình phong cách...'
        stagePercent = 25
      } else if (elapsed <= 8) {
        stageMsg = `Mô hình ${modelName} đang khuếch tán không gian tiềm ẩn...`
        stagePercent = 55
      } else if (elapsed <= 15) {
        stageMsg = 'Khử nhiễu chi tiết & hoàn thiện chất lượng ảnh siêu nét...'
        stagePercent = 85
      } else {
        stageMsg = 'Đang tải dữ liệu ảnh về trình duyệt...'
        stagePercent = 95
      }
    } else {
      if (elapsed > 10 && elapsed <= 35) {
        stageMsg = 'Phân tích prompt & khởi tạo khung hình ban đầu (Frame Latents)...'
        stagePercent = 35
      } else if (elapsed > 35 && elapsed <= 70) {
        stageMsg = `Mô hình ${modelName} đang tổng hợp chuyển động ${seconds}s video...`
        stagePercent = 65
      } else if (elapsed > 70 && elapsed <= 140) {
        stageMsg = 'Khử nhiễu, nội suy khung hình chuyển động & xuất màu điện ảnh...'
        stagePercent = 85
      } else if (elapsed > 140) {
        stageMsg = 'Máy chủ đang hoàn thiện đóng gói file MP4 Ultra HD...'
        stagePercent = 95
      }
    }
  } else {
    // If statusMessage mentions progress %, adjust bar
    const matchPercent = statusMessage.match(/(\d+)%/)
    if (matchPercent) {
      stagePercent = Math.max(15, Math.min(95, parseInt(matchPercent[1], 10)))
    } else {
      stagePercent = Math.min(90, 20 + Math.floor(elapsed / 2))
    }
  }

  return (
    <div className="w-full max-w-3xl mx-auto px-4 my-8 animate-fadeIn">
      <div className="relative bg-[#141418] border border-zinc-700/80 rounded-3xl p-6 sm:p-8 shadow-[0_0_50px_rgba(229,255,0,0.15)] overflow-hidden">
        {/* Glow accent */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-[#e5ff00]/10 rounded-full blur-[90px] pointer-events-none" />

        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="relative flex items-center justify-center w-12 h-12 rounded-2xl bg-zinc-800 text-[#e5ff00] border border-zinc-700">
              <Loader2 className="w-6 h-6 animate-spin" />
              <span className="absolute -top-1 -right-1 flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#e5ff00] opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-[#e5ff00]"></span>
              </span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white">
                  {isImageMode ? 'Đang khởi tạo Hình ảnh' : 'Đang khởi tạo Video'}
                </h3>
                <span className="text-xs px-2 py-0.5 rounded-full bg-[#e5ff00]/20 text-[#e5ff00] font-bold">
                  {isImageMode ? `${modelName} • AI Image` : `${modelName} • ${seconds}s`}
                </span>
              </div>
              <p className="text-xs text-zinc-400 mt-0.5">{stageMsg}</p>
            </div>
          </div>

          <div className="flex items-center gap-3 self-end sm:self-center">
            {/* Timer Counter */}
            <div className="text-right">
              <div className="text-xs text-zinc-500 font-medium">Thời gian chạy</div>
              <div className="text-lg font-mono font-bold text-white tracking-wider">
                {formatTime(elapsed)}
              </div>
            </div>

            {/* Cancel Button */}
            {onCancel && (
              <button
                onClick={onCancel}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-zinc-800/80 hover:bg-rose-500/20 text-zinc-400 hover:text-rose-400 border border-zinc-700 hover:border-rose-500/40 transition text-xs font-medium"
                title="Hủy quá trình tạo (không bị trừ tiền)"
              >
                <XCircle className="w-4 h-4 text-rose-400" />
                <span>Hủy bỏ</span>
              </button>
            )}
          </div>
        </div>

        {/* Animated Progress Bar */}
        <div className="w-full bg-zinc-800/90 rounded-full h-2 overflow-hidden mb-5">
          <div
            className="bg-gradient-to-r from-emerald-400 via-[#e5ff00] to-yellow-400 h-full rounded-full transition-all duration-1000 ease-out"
            style={{ width: `${stagePercent}%` }}
          />
        </div>

        {/* Tunnel Keep-Alive Heartbeat Banner */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs py-2.5 px-3.5 bg-zinc-900/90 rounded-xl border border-zinc-800 text-zinc-400">
          <div className="flex items-center gap-2">
            <Radio className="w-4 h-4 text-emerald-400 animate-pulse" />
            <span className="text-zinc-300 font-medium">
              {heartbeatCount > 0 ? (
                <>Đang giữ kết nối Cloudflare • Đã nhận <span className="text-emerald-400 font-bold">{heartbeatCount}</span> xung kết nối</>
              ) : (
                'Đường truyền Cloudflare Tunnel bảo mật cao & ổn định'
              )}
            </span>
          </div>
          <span className="text-[11px] text-zinc-500">
            {isImageMode ? 'Thời gian tạo ảnh ~5 - 20 giây' : (elapsed > 240 ? 'Đang xếp hàng trên cụm GPU (chưa trừ tiền)' : 'Render trung bình 1 - 3 phút')}
          </span>
        </div>

        {elapsed > 300 && !isImageMode && (
          <div className="mt-3 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs">
            <p className="font-semibold mb-0.5">ℹ️ Máy chủ đang có lượng yêu cầu render cao:</p>
            <p className="text-amber-200/80">
              Yêu cầu của bạn đang nằm trong hàng đợi GPU. Bạn có thể tiếp tục chờ đợi hoặc bấm <span className="font-bold underline cursor-pointer" onClick={onCancel}>Hủy render</span> (hoàn toàn không mất phí) rồi chọn model <strong>Seedance 2.0 Fast (5s)</strong> để tạo nhanh hơn.
            </p>
          </div>
        )}

        {/* Prompt quote */}
        {prompt && (
          <p className="mt-4 text-xs text-zinc-400 italic line-clamp-2 border-l-2 border-zinc-700 pl-3">
            "{prompt}"
          </p>
        )}
      </div>
    </div>
  )
}
