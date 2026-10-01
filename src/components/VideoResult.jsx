import React, { useState, useEffect } from 'react'
import { Download, Copy, Check, ExternalLink, Sparkles, X, Share2, Film, Loader2, RefreshCw, AlertCircle, Terminal, Code2 } from 'lucide-react'
import { fetchVideoBlob, resolveVideoUrl, getDirectVideoUrl, getDirectImageUrl, isMediaImage, openMediaInNewTab } from '../services/api'
import { getApiKey } from '../services/storage'

export default function VideoResult({ video, onClose, onReusePrompt, apiKey }) {
  const [copiedLink, setCopiedLink] = useState(false)
  const [copiedPrompt, setCopiedPrompt] = useState(false)
  const [copiedCode, setCopiedCode] = useState(false)
  const [showCodeSnippet, setShowCodeSnippet] = useState(false)
  const [blobUrl, setBlobUrl] = useState(video?.blobUrl || null)
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState(null)
  const [downloading, setDownloading] = useState(false)
  const [retryCount, setRetryCount] = useState(0)

  if (!video || !video.url) return null

  const isImage = isMediaImage(video)
  const effectiveKey = apiKey || getApiKey()
  const cleanUrl = isImage ? getDirectImageUrl(video.url) : resolveVideoUrl(video.url)
  const directUrl = isImage ? cleanUrl : (video.directUrl || getDirectVideoUrl(video.url, effectiveKey))
  const [actualDimensions, setActualDimensions] = useState(null)

  // Use direct stream URL as primary source for native streaming, with blob fallback
  const activePlayUrl = blobUrl || directUrl || cleanUrl

  useEffect(() => {
    let isCancelled = false
    let createdBlob = null

    if (video.blobUrl) {
      setBlobUrl(video.blobUrl)
      return
    }

    // Preload blob in background for smoother seeking & offline download
    if (directUrl && !blobUrl) {
      fetchVideoBlob(directUrl, effectiveKey)
        .then((url) => {
          if (isCancelled) {
            URL.revokeObjectURL(url)
            return
          }
          createdBlob = url
          setBlobUrl(url)
        })
        .catch((err) => {
          console.warn('Background blob preload failed, using direct stream:', err)
        })
    }

    return () => {
      isCancelled = true
      if (createdBlob) {
        URL.revokeObjectURL(createdBlob)
      }
    }
  }, [video.id, directUrl, video.blobUrl, effectiveKey, retryCount])

  const handleCopyLink = () => {
    // Copy the authenticated direct link so user can open in any browser
    navigator.clipboard.writeText(directUrl || cleanUrl)
    setCopiedLink(true)
    setTimeout(() => setCopiedLink(false), 2000)
  }

  const handleCopyPrompt = () => {
    navigator.clipboard.writeText(video.prompt)
    setCopiedPrompt(true)
    setTimeout(() => setCopiedPrompt(false), 2000)
  }

  const handleDownload = async () => {
    try {
      setDownloading(true)
      let activeUrl = blobUrl

      if (!activeUrl) {
        try {
          activeUrl = await fetchVideoBlob(isImage ? cleanUrl : (directUrl || cleanUrl), effectiveKey)
          setBlobUrl(activeUrl)
        } catch (fetchErr) {
          activeUrl = isImage ? cleanUrl : (directUrl || cleanUrl)
        }
      }

      // For cross-origin images, convert to blob via canvas so download attribute works properly
      if (isImage && activeUrl.startsWith('http')) {
        try {
          const blobUrlGenerated = await new Promise((resolve, reject) => {
            const img = new Image()
            img.crossOrigin = 'anonymous'
            img.onload = () => {
              const canvas = document.createElement('canvas')
              canvas.width = img.naturalWidth
              canvas.height = img.naturalHeight
              const ctx = canvas.getContext('2d')
              ctx.drawImage(img, 0, 0)
              canvas.toBlob((blob) => {
                if (blob) resolve(URL.createObjectURL(blob))
                else reject(new Error('Canvas blob is null'))
              }, 'image/png')
            }
            img.onerror = () => reject(new Error('Cross-origin canvas blocked'))
            img.src = activeUrl
          })
          activeUrl = blobUrlGenerated
        } catch {
          // Fall back to original activeUrl
        }
      }

      const a = document.createElement('a')
      a.href = activeUrl
      a.download = isImage
        ? `seedance_image_${video.id || Date.now()}.png`
        : `seedance_${video.id || Date.now()}.mp4`
      a.target = '_blank'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
    } catch (err) {
      alert(`Lỗi tải ${isImage ? 'ảnh' : 'video'}: ` + err.message)
    } finally {
      setDownloading(false)
    }
  }

  const targetUrl = isImage ? (cleanUrl || video.url) : (activePlayUrl || directUrl || cleanUrl)
  const isDataOrBlobUrl = Boolean(targetUrl && (targetUrl.startsWith('data:') || targetUrl.startsWith('blob:')))

  const handleOpenNewTab = (e) => {
    if (e) e.preventDefault()
    openMediaInNewTab(targetUrl, video?.prompt ? `Seedance - ${video.prompt.slice(0, 30)}...` : (isImage ? 'Seedance Image' : 'Seedance Video'))
  }

  const pythonSnippet = isImage
    ? `# Cách tải ảnh bằng Python:
import requests

url = "${cleanUrl}"
response = requests.get(url)
with open("seedance_image_${video.id || 'output'}.png", "wb") as f:
    f.write(response.content)
print("Tải ảnh thành công!")`
    : `# Cách tải video bằng Python theo tài liệu TuanSu API:
import requests

url = "${cleanUrl}"
headers = {"Authorization": "Bearer ${effectiveKey ? effectiveKey.slice(0, 10) + '...' : '<API_KEY>'}"}
response = requests.get(url, headers=headers)
with open("seedance_${video.id || 'video'}.mp4", "wb") as f:
    f.write(response.content)
print("Tải video thành công!")`

  const handleCopyCode = () => {
    navigator.clipboard.writeText(pythonSnippet)
    setCopiedCode(true)
    setTimeout(() => setCopiedCode(false), 2000)
  }

  return (
    <div className="w-full max-w-4xl mx-auto px-4 my-8 animate-fadeIn">
      <div className="relative bg-[#141418] border border-[#e5ff00]/40 rounded-3xl p-4 sm:p-6 shadow-[0_0_60px_rgba(229,255,0,0.18)]">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-zinc-800">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-[#e5ff00] text-black">
              <Sparkles className="w-4 h-4 fill-black" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-white">
                  {isImage ? 'Hình ảnh hoàn thành' : 'Video hoàn thành'}
                </h3>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-semibold">
                  {isImage ? 'Direct Image & Key' : 'Direct Stream & Key'}
                </span>
              </div>
              <p className="text-[11px] text-zinc-400 mt-0.5">
                {video.model}{video.seconds ? ` • ${video.seconds}s` : ''} • {actualDimensions || video.size}
              </p>
            </div>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white transition"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Media Player / Image Viewer */}
        <div className="mt-4 rounded-2xl overflow-hidden bg-black border border-zinc-800 flex items-center justify-center relative group min-h-[300px]">
          {loadError ? (
            <div className="flex flex-col items-center justify-center gap-3 p-6 text-center max-w-md">
              <AlertCircle className="w-8 h-8 text-rose-400" />
              <div className="text-xs font-semibold text-rose-300">
                Không thể tải {isImage ? 'ảnh' : 'luồng video'}: {loadError}
              </div>
              <button
                onClick={() => { setLoadError(null); setRetryCount(c => c + 1); }}
                className="mt-2 px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-medium text-white flex items-center gap-1.5 transition"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Thử lại
              </button>
            </div>
          ) : isImage ? (
            <img
              key={activePlayUrl}
              src={activePlayUrl}
              alt={video.prompt}
              className="w-full h-full max-h-[600px] object-contain"
              onLoad={(e) => {
                if (e.target.naturalWidth && e.target.naturalHeight) {
                  setActualDimensions(`${e.target.naturalWidth}x${e.target.naturalHeight}`)
                }
              }}
              onError={() => {
                if (!blobUrl && directUrl) {
                  fetchVideoBlob(directUrl, effectiveKey)
                    .then(url => setBlobUrl(url))
                    .catch(err => setLoadError(err.message))
                }
              }}
            />
          ) : (
            <video
              key={activePlayUrl}
              src={activePlayUrl}
              controls
              autoPlay
              loop
              playsInline
              preload="metadata"
              onError={() => {
                if (!blobUrl) {
                  fetchVideoBlob(directUrl, effectiveKey)
                    .then(url => setBlobUrl(url))
                    .catch(err => setLoadError(err.message))
                }
              }}
              className="w-full h-full object-contain aspect-video"
            />
          )}
        </div>

        {/* Streaming tip info */}
        <div className="mt-3 px-3 py-2 rounded-xl bg-zinc-900/60 border border-zinc-800/80 flex items-center justify-between text-[11px] text-zinc-400">
          <div className="flex items-center gap-1.5 truncate">
            <span className="w-1.5 h-1.5 rounded-full bg-[#e5ff00] shrink-0" />
            <span className="truncate font-mono text-[10px] text-zinc-300">
              {directUrl || cleanUrl}
            </span>
          </div>
          <button
            onClick={() => setShowCodeSnippet(!showCodeSnippet)}
            className="text-zinc-400 hover:text-[#e5ff00] text-[10px] flex items-center gap-1 shrink-0 ml-2"
          >
            <Code2 className="w-3 h-3" />
            <span>{showCodeSnippet ? 'Ẩn code' : (isImage ? 'Code tải ảnh' : 'Code tải video')}</span>
          </button>
        </div>

        {/* Collapsible Python / cURL snippet */}
        {showCodeSnippet && (
          <div className="mt-2.5 p-3 rounded-2xl bg-zinc-950 border border-zinc-800 animate-fadeIn">
            <div className="flex items-center justify-between mb-2 text-[11px] text-zinc-400">
              <span className="font-semibold flex items-center gap-1.5 text-zinc-300">
                <Terminal className="w-3.5 h-3.5 text-[#e5ff00]" /> Code mẫu tải {isImage ? 'ảnh' : 'video'} (Python):
              </span>
              <button
                onClick={handleCopyCode}
                className="px-2 py-0.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[10px] flex items-center gap-1 transition"
              >
                {copiedCode ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                <span>{copiedCode ? 'Đã copy' : 'Copy code'}</span>
              </button>
            </div>
            <pre className="text-[11px] font-mono text-zinc-300 overflow-x-auto p-2 bg-zinc-900/90 rounded-xl">
              {pythonSnippet}
            </pre>
          </div>
        )}

        {/* Prompt */}
        <div className="mt-4 p-3 bg-zinc-900/80 rounded-2xl border border-zinc-800/80 text-xs text-zinc-300">
          <div className="flex items-center justify-between text-[11px] text-zinc-500 mb-1">
            <span>Prompt:</span>
            <div className="flex items-center gap-2">
              {onReusePrompt && (
                <button
                  onClick={() => onReusePrompt(video.prompt)}
                  className="text-zinc-400 hover:text-[#e5ff00] flex items-center gap-1 text-[11px]"
                >
                  <span>Dùng lại prompt</span>
                </button>
              )}
              <button
                onClick={handleCopyPrompt}
                className="text-zinc-400 hover:text-[#e5ff00] flex items-center gap-1"
              >
                {copiedPrompt ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                <span>{copiedPrompt ? 'Đã sao chép' : 'Sao chép prompt'}</span>
              </button>
            </div>
          </div>
          <p className="font-medium text-zinc-200">{video.prompt}</p>
        </div>

        {/* Action Buttons */}
        <div className="mt-4 flex flex-wrap items-center justify-end gap-2.5">
          <button
            onClick={handleCopyLink}
            className="px-3.5 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold flex items-center gap-1.5 transition"
            title={isImage ? "Sao chép link ảnh trực tiếp" : "Sao chép link stream trực tiếp có gắn key"}
          >
            {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Share2 className="w-3.5 h-3.5" />}
            <span>{copiedLink ? 'Đã copy link' : (isImage ? 'Copy link ảnh' : 'Copy link video (Key)')}</span>
          </button>

          <a
            href={isDataOrBlobUrl ? '#' : (targetUrl || '#')}
            target={isDataOrBlobUrl ? undefined : '_blank'}
            rel={isDataOrBlobUrl ? undefined : 'noopener noreferrer'}
            onClick={handleOpenNewTab}
            className="px-3.5 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
            title="Mở trên tab mới (trình duyệt hỗ trợ xem và lưu trực tiếp)"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>Mở tab mới</span>
          </a>

          <button
            onClick={handleDownload}
            disabled={downloading}
            className="px-4 py-2 rounded-xl bg-[#e5ff00] hover:bg-[#d6f000] disabled:opacity-50 text-black text-xs font-extrabold flex items-center gap-1.5 transition shadow-[0_0_15px_rgba(229,255,0,0.3)]"
          >
            {downloading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            <span>{downloading ? 'Đang chuẩn bị...' : (isImage ? 'Tải về Ảnh PNG' : 'Tải về MP4')}</span>
          </button>
        </div>
      </div>
    </div>
  )
}
