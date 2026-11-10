import React, { useState, useEffect, useRef } from 'react'
import Header from './components/Header'
import HeroShowcase from './components/HeroShowcase'
import GenerationDock from './components/GenerationDock'
import MediaGallery from './components/MediaGallery'
import MediaViewer from './components/MediaViewer'
import SettingsModal from './components/SettingsModal'
import ReferenceModal from './components/ReferenceModal'
import { getApiKey, hasHiggsfieldCredentials, getSavedVideos, saveVideoToHistory, updateVideoInHistory, removeVideoFromHistory, getReferenceImages, saveReferenceImages } from './services/storage'
import { generateVideo, generateImage } from './services/api'
import { deleteFromBlob, persistGeneratedMedia } from './services/blobStorage'
import { VIDEO_MODELS, IMAGE_MODELS, IMAGE_ASPECT_RATIOS } from './constants/models'
import { downloadMedia, isImageItem, findModel, ratioOf } from './services/media'
import { AlertCircle, X, Download, Trash2, CheckCircle2 } from 'lucide-react'

export default function App() {
  const [apiKey, setApiKey] = useState(getApiKey())
  const [mode, setMode] = useState('video') // 'video' | 'image'
  const [prompt, setPrompt] = useState('')
  const [model, setModel] = useState(VIDEO_MODELS[0].id)
  const [seconds, setSeconds] = useState(VIDEO_MODELS[0].defaultDuration || 5)
  const [aspectRatio, setAspectRatio] = useState('16:9')
  const [resolution, setResolution] = useState('720p')
  const [referenceImage, setReferenceImage] = useState(null)
  const [referenceImages, setReferenceImages] = useState(getReferenceImages())

  // Set referenceImage to the selected image from the referenceImages on mount
  useEffect(() => {
    const selectedImage = referenceImages.find(img => img.selected)
    if (selectedImage) {
      setReferenceImage(selectedImage.url)
    }
  }, [])
  const [isGenerating, setIsGenerating] = useState(false)
  useEffect(() => {
    saveReferenceImages(referenceImages)
  }, [referenceImages])

  const [savedVideos, setSavedVideos] = useState([])
  const [errorMsg, setErrorMsg] = useState('')
  const [showSettings, setShowSettings] = useState(false)
  const [showReferenceModal, setShowReferenceModal] = useState(false)
  const [sessionBlobs, setSessionBlobs] = useState({}) // id → blob: của video vừa tạo (phát ngay, không cần tải lại)
  const [storageState, setStorageState] = useState({}) // id → {status, progress, error} khi đang lưu lên R2
  const [viewerId, setViewerId] = useState(null)
  const [selectedIds, setSelectedIds] = useState(() => new Set())
  const [toast, setToast] = useState('')
  const [genInfo, setGenInfo] = useState(null) // {startedAt, mediaType, ratio}
  const toastTimerRef = useRef(null)
  const [heartbeatCount, setHeartbeatCount] = useState(0)
  const [lastHeartbeat, setLastHeartbeat] = useState(null)
  const [generationStatus, setGenerationStatus] = useState('')
  const abortControllerRef = useRef(null)

  // Giữ độ phân giải / thời lượng / tỉ lệ luôn nằm trong danh sách model hỗ trợ
  useEffect(() => {
    if (mode !== 'video') return
    const m = VIDEO_MODELS.find(v => v.id === model)
    if (!m) return
    if (m.supportedResolutions && !m.supportedResolutions.includes(resolution)) setResolution(m.defaultResolution)
    const okSeconds = m.durationRange
      ? seconds >= m.durationRange[0] && seconds <= m.durationRange[1]
      : m.durations.includes(seconds)
    if (!okSeconds) setSeconds(m.defaultDuration)
    if (!m.supportedRatios.includes(aspectRatio)) setAspectRatio(m.defaultRatio)
  }, [mode, model, resolution, seconds, aspectRatio])

  useEffect(() => {
    setSavedVideos(getSavedVideos())
  }, [])

  const handleModeChange = (newMode) => {
    setMode(newMode)
    if (newMode === 'image') {
      const isImgModel = IMAGE_MODELS.some(m => m.id === model)
      const targetModel = isImgModel ? IMAGE_MODELS.find(m => m.id === model) : IMAGE_MODELS[0]
      if (!isImgModel) {
        setModel(IMAGE_MODELS[0].id)
      }
      if (!IMAGE_ASPECT_RATIOS.some(r => r.id === aspectRatio)) {
        setAspectRatio('16:9')
      }
      if (!targetModel?.supportedResolutions?.includes(resolution)) {
        setResolution(targetModel?.defaultResolution || '1080p')
      }
    } else {
      const isVidModel = VIDEO_MODELS.some(m => m.id === model)
      const targetModel = isVidModel ? VIDEO_MODELS.find(m => m.id === model) : VIDEO_MODELS[0]
      if (!isVidModel) {
        setModel(VIDEO_MODELS[0].id)
      }
      if (!targetModel?.supportedResolutions?.includes(resolution)) {
        setResolution(targetModel?.defaultResolution || '720p')
      }
      const supported = targetModel?.supportedRatios || ['16:9', '9:16']
      if (!supported.includes(aspectRatio)) {
        setAspectRatio(targetModel?.defaultRatio || '16:9')
      }
    }
  }

  const handleAddReferenceImage = (url, pathname, customName) => {
    setReferenceImages(prev => {
      const nextNum = prev.length + 1
      const name = customName || `Image ${nextNum}`
      const newImg = {
        id: `ref-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        name,
        url,
        pathname, // Store pathname for Vercel Blob deletion
        selected: true, // Always select newly added image
      }
      const updated = [...prev, newImg]
      if (updated.filter(i => i.selected).length === 1) {
        setReferenceImage(newImg.url)
      }
      return updated
    })
  }

  const handleRemoveReferenceImage = (idOrIndex) => {
    if (idOrIndex === 'ref-single') {
      setReferenceImage(null)
      return
    }
    setReferenceImages(prev => {
      const updated = prev.map((img, idx) => {
        if (img.id === idOrIndex || idx === idOrIndex) {
          return { ...img, selected: false }
        }
        return img
      })
      setReferenceImage(updated.find(i => i.selected)?.url || null)
      return updated
    })
  }

  const handleClearReferenceImages = () => {
    setReferenceImages([])
    setReferenceImage(null)
  }

  const handleGenerate = async () => {
    // Video dùng key Xianfeng, ảnh dùng key Higgsfield (Key ID + Secret) — thiếu key nào thì mở Cài đặt
    if (mode === 'image' ? !hasHiggsfieldCredentials() : !apiKey) {
      setShowSettings(true)
      return
    }
    if (!prompt.trim()) {
      setErrorMsg(mode === 'image' ? 'Vui lòng nhập mô tả (prompt) cho hình ảnh!' : 'Vui lòng nhập mô tả (prompt) cho video!')
      return
    }
    setErrorMsg('')
    setIsGenerating(true)
    setGenInfo({ startedAt: Date.now(), mediaType: mode, ratio: ratioOf({ ratio: aspectRatio, mediaType: mode }) })
    window.scrollTo({ top: 0, behavior: 'smooth' })
    setHeartbeatCount(0)
    setLastHeartbeat(null)
    setGenerationStatus('')

    const controller = new AbortController()
    abortControllerRef.current = controller

    try {
      if (mode === 'image') {
        const currentModelObj = IMAGE_MODELS.find(m => m.id === model) || IMAGE_MODELS[0]
        const ratio = IMAGE_ASPECT_RATIOS.some(r => r.id === aspectRatio) ? aspectRatio : '1:1'
        const imageResolution = currentModelObj.supportedResolutions?.includes(resolution)
          ? resolution
          : currentModelObj.defaultResolution

        const result = await generateImage({
          model: currentModelObj.id,
          prompt,
          aspectRatio: ratio,
          resolution: imageResolution,
          referenceImages,
          signal: controller.signal,
          onHeartbeat: (hb) => {
            setHeartbeatCount(prev => prev + 1)
            setLastHeartbeat(hb?.timestamp || Date.now())
            if (hb?.message) {
              setGenerationStatus(hb.message)
            }
          },
        })
        onGenerated({ ...result, modelId: currentModelObj.id, references: [] })
      } else {
        const currentModelObj = VIDEO_MODELS.find(m => m.id === model) || VIDEO_MODELS[0]
        const supportedRatios = currentModelObj.supportedRatios || ['16:9', '9:16']
        let effectiveRatio = aspectRatio
        if (!supportedRatios.includes(effectiveRatio)) {
          effectiveRatio = currentModelObj.defaultRatio || '16:9'
        }

        const effectiveResolution = currentModelObj.supportedResolutions?.includes(resolution)
          ? resolution
          : currentModelObj.defaultResolution
        const effectiveSeconds = currentModelObj.durationRange
          ? Math.min(currentModelObj.durationRange[1], Math.max(currentModelObj.durationRange[0], seconds))
          : (currentModelObj.durations.includes(seconds) ? seconds : currentModelObj.defaultDuration)

        const result = await generateVideo({
          model: currentModelObj.id,
          prompt,
          seconds: effectiveSeconds,
          aspectRatio: effectiveRatio,
          resolution: effectiveResolution,
          maxReferenceImages: currentModelObj.maxReferenceImages ?? 30,
          apiStyle: currentModelObj.apiStyle,
          pollIntervalMs: currentModelObj.pollIntervalMs,
          maxWaitMs: currentModelObj.maxWaitMs,
          referenceImage,
          referenceImages,
          signal: controller.signal,
          onHeartbeat: (hb) => {
            setHeartbeatCount(prev => prev + 1)
            setLastHeartbeat(hb?.timestamp || Date.now())
            if (hb?.message) {
              setGenerationStatus(hb.message)
            }
          },
        })
        onGenerated({
          ...result,
          modelId: currentModelObj.id,
          references: referenceImages.filter(i => i.selected).map(({ url, name }) => ({ url, name })),
        })
      }
    } catch (err) {
      if (err.message === 'MISSING_API_KEY' || err.message === 'MISSING_HF_KEY') {
        setShowSettings(true)
      } else {
        setErrorMsg(err.message || (mode === 'image' ? 'Lỗi khi tạo ảnh. Vui lòng kiểm tra lại kết nối.' : 'Lỗi khi tạo video. Vui lòng kiểm tra lại kết nối.'))
      }
    } finally {
      setIsGenerating(false)
      abortControllerRef.current = null
    }
  }

  const showToast = (msg) => {
    setToast(msg)
    clearTimeout(toastTimerRef.current)
    toastTimerRef.current = setTimeout(() => setToast(''), 2600)
  }

  const onGenerated = (result) => {
    if (result.blobUrl) setSessionBlobs(prev => ({ ...prev, [result.id]: result.blobUrl }))
    setSavedVideos(saveVideoToHistory(result))
    persistResult(result)
  }

  // Tự động lưu ảnh/video vừa tạo lên Cloudflare R2 (chạy nền, không chặn giao diện)
  const persistResult = async (result) => {
    const setStore = (v) => setStorageState(prev => {
      const next = { ...prev }
      if (v) next[result.id] = v
      else delete next[result.id]
      return next
    })
    setStore({ status: 'saving', progress: 0 })
    try {
      const stored = await persistGeneratedMedia(result, {
        apiKey,
        onProgress: (p) => setStore({ status: 'saving', progress: p }),
      })
      if (!stored) { setStore(null); return }
      const patch = {
        url: stored.url,
        directUrl: stored.url,
        storedUrl: stored.url,
        sourceUrl: result.url,
        ...(Array.isArray(result.allImages) ? { allImages: [stored.url, ...result.allImages.slice(1)] } : {}),
      }
      setSavedVideos(updateVideoInHistory(result.id, patch))
      setStore(null)
    } catch (err) {
      console.warn('Không lưu được lên R2:', err)
      setStore({ status: 'failed', error: err.message })
    }
  }

  const deleteStoredFile = async (item) => {
    if (!item?.storedUrl) return
    try {
      await deleteFromBlob(item.storedUrl)
    } catch (err) {
      console.warn('Không xóa được file trên R2:', err)
    }
  }

  const handleDeleteItems = (ids) => {
    const targets = savedVideos.filter(v => ids.includes(v.id))
    if (!targets.length) return
    const stored = targets.filter(v => v.storedUrl).length
    const what = targets.length === 1 ? (isImageItem(targets[0]) ? 'ảnh này' : 'video này') : `${targets.length} mục đã chọn`
    if (!window.confirm(`Xóa ${what}?${stored ? ' File đã lưu trên R2 cũng bị xóa vĩnh viễn.' : ''}`)) return
    targets.forEach(deleteStoredFile)
    let list = savedVideos
    targets.forEach(t => { list = removeVideoFromHistory(t.id) })
    setSavedVideos(list)
    setSelectedIds(prev => {
      const next = new Set(prev)
      ids.forEach(id => next.delete(id))
      return next
    })
    if (viewerId && ids.includes(viewerId)) {
      const oldIndex = savedVideos.findIndex(v => v.id === viewerId)
      const nextItem = list[Math.min(oldIndex, list.length - 1)]
      setViewerId(nextItem ? nextItem.id : null)
    }
  }

  const handleDownload = async (item) => {
    try {
      await downloadMedia(item, { apiKey, sessionBlobs })
    } catch (err) {
      showToast(`Không tải được: ${err.message}`)
    }
  }

  // Recreate: nạp lại prompt + toàn bộ cài đặt (và ảnh tham chiếu đã dùng) vào khung nhập để tạo lại
  const handleRecreate = (item) => {
    const isImg = isImageItem(item)
    const m = findModel(item) || (isImg ? IMAGE_MODELS[0] : VIDEO_MODELS[0])
    setMode(isImg ? 'image' : 'video')
    setModel(m.id)
    if (item.ratio) setAspectRatio(item.ratio)
    setResolution(m.supportedResolutions?.includes(item.resolution) ? item.resolution : m.defaultResolution)
    if (!isImg && item.seconds) setSeconds(item.seconds)
    setPrompt(item.prompt || '')
    if (Array.isArray(item.references)) {
      const urls = item.references.map(r => r.url)
      setReferenceImages(prev => {
        const updated = prev.map(img => ({ ...img, selected: urls.includes(img.url) }))
        item.references.forEach((r, i) => {
          if (!updated.some(img => img.url === r.url)) {
            updated.push({ id: `ref-${Date.now()}-${i}`, name: r.name || `Image ${i + 1}`, url: r.url, pathname: null, selected: true })
          }
        })
        setReferenceImage(updated.find(img => img.selected)?.url || null)
        return updated
      })
    }
    setViewerId(null)
    showToast('Đã nạp lại prompt và cài đặt — bấm Generate để tạo lại')
  }

  // Reference: thêm ảnh đã tạo vào danh sách ảnh tham chiếu (không gắn pathname để gỡ ref không xóa file gốc)
  const handleUseAsReference = (item) => {
    const url = item.storedUrl || item.url
    const existing = referenceImages.find(img => img.url === url)
    if (existing) {
      setReferenceImages(prev => {
        const updated = prev.map(img => (img.url === url ? { ...img, selected: true } : img))
        setReferenceImage(updated.find(i => i.selected)?.url || null)
        return updated
      })
    } else {
      handleAddReferenceImage(url, null, `Gen ${String(item.id).slice(-6)}`)
    }
    const currentImageModel = IMAGE_MODELS.find(m => m.id === model)
    if (mode === 'image' && !currentImageModel?.supportsReference) handleModeChange('video')
    setViewerId(null)
    showToast('Đã thêm vào References')
  }

  const toggleSelect = (id) => setSelectedIds(prev => {
    const next = new Set(prev)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    return next
  })

  const viewerIndex = viewerId ? savedVideos.findIndex(v => v.id === viewerId) : -1

  const activeModelsList = mode === 'image' ? IMAGE_MODELS : VIDEO_MODELS
  const currentModelObj = activeModelsList.find(m => m.id === model) || activeModelsList[0]

  const hasItems = savedVideos.length > 0 || isGenerating

  return (
    <div className="min-h-screen bg-[#09090b] text-[#f4f4f5] flex flex-col selection:bg-[#e5ff00] selection:text-black">
      <Header
        hasApiKey={Boolean(apiKey)}
        onOpenSettings={() => setShowSettings(true)}
        onOpenHistory={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        historyCount={savedVideos.length}
      />

      <main className="flex-1 pb-72">
        {!hasItems && <HeroShowcase onSelectPrompt={p => setPrompt(p)} />}

        {hasItems && (
          <div className="px-1.5 sm:px-2 pt-2">
            <MediaGallery
              items={savedVideos}
              sessionBlobs={sessionBlobs}
              storageState={storageState}
              pending={isGenerating ? {
                ...genInfo,
                status: generationStatus,
                onCancel: () => abortControllerRef.current?.abort('User cancelled'),
              } : null}
              selectedIds={selectedIds}
              onOpen={setViewerId}
              onToggleSelect={toggleSelect}
              onDownload={handleDownload}
              onRecreate={handleRecreate}
              onReference={handleUseAsReference}
              onDelete={(item) => handleDeleteItems([item.id])}
            />
          </div>
        )}
      </main>

      {/* Thanh thao tác khi chọn nhiều */}
      {selectedIds.size > 0 && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 flex items-center gap-1.5 pl-4 pr-1.5 py-1.5 rounded-full bg-[#16171b]/80 backdrop-blur-xl border border-white/15 shadow-[0_12px_40px_rgba(0,0,0,0.6)] text-sm">
          <span className="font-semibold text-white mr-1">Đã chọn {selectedIds.size}</span>
          <button type="button" onClick={async () => {
            for (const item of savedVideos.filter(v => selectedIds.has(v.id))) await handleDownload(item)
          }} className="px-3 py-1.5 rounded-full hover:bg-white/10 text-zinc-200 flex items-center gap-1.5">
            <Download className="w-4 h-4" /> Tải xuống
          </button>
          <button type="button" onClick={() => handleDeleteItems([...selectedIds])}
            className="px-3 py-1.5 rounded-full hover:bg-rose-500/80 text-zinc-200 hover:text-white flex items-center gap-1.5">
            <Trash2 className="w-4 h-4" /> Xóa
          </button>
          <button type="button" title="Bỏ chọn" onClick={() => setSelectedIds(new Set())}
            className="w-8 h-8 rounded-full hover:bg-white/10 text-zinc-300 flex items-center justify-center">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Khung nhập prompt nổi ở giữa phía dưới */}
      <div className="fixed bottom-3 sm:bottom-5 inset-x-0 z-40 pointer-events-none">
        <div className="max-w-4xl mx-auto px-3 pointer-events-auto">
          {(errorMsg || toast) && (
            <div className="mb-2 flex justify-center">
              {errorMsg ? (
                <div className="max-w-2xl w-full p-3 rounded-2xl bg-rose-950/70 backdrop-blur-xl border border-rose-500/30 text-rose-200 text-xs sm:text-sm flex items-start gap-2.5 shadow-xl">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <div className="flex-1 whitespace-pre-line break-words"><span className="font-bold">Lỗi: </span>{errorMsg}</div>
                  <button type="button" onClick={() => setErrorMsg('')} className="text-rose-300 hover:text-white"><X className="w-4 h-4" /></button>
                </div>
              ) : (
                <div className="px-4 py-2 rounded-full bg-[#16171b]/80 backdrop-blur-xl border border-white/15 text-xs text-white flex items-center gap-2 shadow-xl">
                  <CheckCircle2 className="w-4 h-4 text-[#e5ff00]" /> {toast}
                </div>
              )}
            </div>
          )}
          <GenerationDock
            docked
            mode={mode}
            onModeChange={handleModeChange}
            prompt={prompt} setPrompt={setPrompt}
            model={model} setModel={setModel}
            seconds={seconds} setSeconds={setSeconds}
            aspectRatio={aspectRatio} setAspectRatio={setAspectRatio}
            resolution={resolution} setResolution={setResolution}
            referenceImage={referenceImage}
            referenceImages={referenceImages}
            onOpenReferenceModal={() => setShowReferenceModal(true)}
            onRemoveReferenceImage={handleRemoveReferenceImage}
            onAddReferenceImage={handleAddReferenceImage}
            onClearReferenceImages={handleClearReferenceImages}
            onGenerate={handleGenerate}
            isGenerating={isGenerating}
            hasApiKey={mode === 'image' ? hasHiggsfieldCredentials() : Boolean(apiKey)}
            onOpenSettings={() => setShowSettings(true)}
          />
        </div>
      </div>

      {viewerIndex >= 0 && (
        <MediaViewer
          items={savedVideos}
          index={viewerIndex}
          onNavigate={(i) => setViewerId(savedVideos[i]?.id || null)}
          onClose={() => setViewerId(null)}
          sessionBlobs={sessionBlobs}
          storageState={storageState}
          apiKey={apiKey}
          onRecreate={handleRecreate}
          onReference={handleUseAsReference}
          onDownload={handleDownload}
          onDelete={(item) => handleDeleteItems([item.id])}
        />
      )}

      <SettingsModal
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        onApiKeyChange={newKey => setApiKey(newKey)}
      />

      <ReferenceModal
        isOpen={showReferenceModal}
        onClose={() => setShowReferenceModal(false)}
        referenceImages={referenceImages}
        onAddImage={handleAddReferenceImage}
        onToggleSelect={(id) => {
          setReferenceImages(prev => {
            const updated = prev.map(img => img.id === id ? { ...img, selected: !img.selected } : img)
            setReferenceImage(updated.find(i => i.selected)?.url || null)
            return updated
          })
        }}
        onDeleteImage={async (id) => {
          const target = referenceImages.find(i => i.id === id)
          if (!target) return
          if (target.pathname) {
            await deleteFromBlob(target.pathname)
          }
          setReferenceImages(prev => {
            const updated = prev.filter(i => i.id !== id)
            setReferenceImage(updated.find(i => i.selected)?.url || null)
            return updated
          })
        }}
      />
    </div>
  )
}
