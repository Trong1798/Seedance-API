import React, { useState, useEffect, useRef } from 'react'
import Header from './components/Header'
import HeroShowcase from './components/HeroShowcase'
import GenerationDock from './components/GenerationDock'
import GenerationProgress from './components/GenerationProgress'
import VideoResult from './components/VideoResult'
import SettingsModal from './components/SettingsModal'
import ReferenceModal from './components/ReferenceModal'
import HistoryModal from './components/HistoryModal'
import { getApiKey, hasHiggsfieldCredentials, getSavedVideos, saveVideoToHistory, removeVideoFromHistory, getReferenceImages, saveReferenceImages } from './services/storage'
import { generateVideo, generateImage } from './services/api'
import { deleteFromBlob } from './services/blobStorage'
import { VIDEO_MODELS, IMAGE_MODELS, IMAGE_ASPECT_RATIOS } from './constants/models'
import { AlertCircle } from 'lucide-react'

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
  const [activeVideo, setActiveVideo] = useState(null)
  useEffect(() => {
    saveReferenceImages(referenceImages)
  }, [referenceImages])

  const [savedVideos, setSavedVideos] = useState([])
  const [errorMsg, setErrorMsg] = useState('')
  const [showSettings, setShowSettings] = useState(false)
  const [showReferenceModal, setShowReferenceModal] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
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
    setActiveVideo(null)
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
        setActiveVideo(result)
        setSavedVideos(saveVideoToHistory(result))
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
        setActiveVideo(result)
        setSavedVideos(saveVideoToHistory(result))
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

  const activeModelsList = mode === 'image' ? IMAGE_MODELS : VIDEO_MODELS
  const currentModelObj = activeModelsList.find(m => m.id === model) || activeModelsList[0]

  return (
    <div className="min-h-screen bg-[#09090b] text-[#f4f4f5] flex flex-col justify-between selection:bg-[#e5ff00] selection:text-black">
      <Header
        hasApiKey={Boolean(apiKey)}
        onOpenSettings={() => setShowSettings(true)}
        onOpenHistory={() => setShowHistory(true)}
        historyCount={savedVideos.length}
      />

      <main className="flex-1 pb-16">
        <HeroShowcase onSelectPrompt={p => setPrompt(p)} />

        <div className="mt-2 mb-8">
          <GenerationDock
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

        {errorMsg && (
          <div className="max-w-2xl mx-auto px-4 mb-6">
            <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs sm:text-sm flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
              <div className="flex-1 whitespace-pre-line break-words"><span className="font-bold">Lỗi: </span>{errorMsg}</div>
            </div>
          </div>
        )}

        {isGenerating && (
          <GenerationProgress
            mediaType={mode}
            modelName={currentModelObj.name}
            seconds={seconds}
            prompt={prompt}
            heartbeatCount={heartbeatCount}
            lastHeartbeat={lastHeartbeat}
            statusMessage={generationStatus}
            onCancel={() => abortControllerRef.current?.abort('User cancelled')}
          />
        )}

        {activeVideo && !isGenerating && (
          <VideoResult
            video={activeVideo}
            onClose={() => setActiveVideo(null)}
            onReusePrompt={(p) => {
              setPrompt(p)
              window.scrollTo({ top: 350, behavior: 'smooth' })
            }}
            apiKey={apiKey}
          />
        )}
      </main>

      <footer className="border-t border-zinc-800/80 py-6 text-center text-xs text-zinc-500">
        <p>Seedance 2.5 Cinema Studio • Xianfeng API</p>
        <p className="text-[11px] text-zinc-600 mt-1">API Key lưu trữ cục bộ tại trình duyệt (LocalStorage)</p>
      </footer>

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

      <HistoryModal
        isOpen={showHistory}
        onClose={() => setShowHistory(false)}
        videos={savedVideos}
        apiKey={apiKey}
        onSelectVideo={vid => { setActiveVideo(vid); setShowHistory(false); }}
        onRemoveVideo={id => setSavedVideos(removeVideoFromHistory(id))}
        onClearAll={() => {
          localStorage.removeItem('seedance_generated_videos')
          setSavedVideos([])
        }}
      />
    </div>
  )
}

