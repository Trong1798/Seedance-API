import React, { useState, useEffect, useRef } from 'react'
import Header from './components/Header'
import HeroShowcase from './components/HeroShowcase'
import GenerationDock from './components/GenerationDock'
import GenerationProgress from './components/GenerationProgress'
import VideoResult from './components/VideoResult'
import SettingsModal from './components/SettingsModal'
import ReferenceModal from './components/ReferenceModal'
import HistoryModal from './components/HistoryModal'
import { getApiKey, getSavedVideos, saveVideoToHistory, removeVideoFromHistory } from './services/storage'
import { generateVideo, generateImage } from './services/api'
import { VIDEO_MODELS, IMAGE_MODELS, ASPECT_RATIOS, IMAGE_ASPECT_RATIOS } from './constants/models'
import { AlertCircle } from 'lucide-react'

export default function App() {
  const [apiKey, setApiKey] = useState(getApiKey())
  const [mode, setMode] = useState('video') // 'video' | 'image'
  const [prompt, setPrompt] = useState('')
  const [model, setModel] = useState('seedance_2.5')
  const [seconds, setSeconds] = useState(10)
  const [aspectRatio, setAspectRatio] = useState('16:9')
  const [resolution, setResolution] = useState('720p')
  const [referenceImage, setReferenceImage] = useState(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [activeVideo, setActiveVideo] = useState(null)
  const [savedVideos, setSavedVideos] = useState([])
  const [errorMsg, setErrorMsg] = useState('')
  const [showSettings, setShowSettings] = useState(false)
  const [showReferenceModal, setShowReferenceModal] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [heartbeatCount, setHeartbeatCount] = useState(0)
  const [lastHeartbeat, setLastHeartbeat] = useState(null)
  const [generationStatus, setGenerationStatus] = useState('')
  const abortControllerRef = useRef(null)

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
      if (resolution === '720p' || resolution === '1080p') {
        setResolution(targetModel?.defaultResolution || '2k')
      }
      if (!IMAGE_ASPECT_RATIOS.some(r => r.id === aspectRatio)) {
        setAspectRatio('16:9')
      }
    } else {
      const isVidModel = VIDEO_MODELS.some(m => m.id === model)
      const targetModel = isVidModel ? VIDEO_MODELS.find(m => m.id === model) : VIDEO_MODELS[0]
      if (!isVidModel) {
        setModel(VIDEO_MODELS[0].id)
      }
      if (resolution === '1k' || resolution === '2k' || resolution === '4k') {
        setResolution('720p')
      }
      const supported = targetModel?.supportedRatios || ['16:9', '9:16']
      if (!supported.includes(aspectRatio)) {
        setAspectRatio(targetModel?.defaultRatio || '16:9')
      }
    }
  }

  const handleGenerate = async () => {
    if (!apiKey) {
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
        const supportedResolutions = currentModelObj.supportedResolutions || ['1k', '2k']

        let effectiveRes = resolution
        // Fallback to highest supported resolution if model does not support current resolution (e.g. 4k)
        if (!supportedResolutions.includes(effectiveRes)) {
          effectiveRes = supportedResolutions.includes('2k') ? '2k' : '1k'
        }

        const ratioObj = IMAGE_ASPECT_RATIOS.find(r => r.id === aspectRatio) || IMAGE_ASPECT_RATIOS[0]
        let size = ratioObj.sizes?.[effectiveRes]

        // For standard models requiring standard gateway sizes (1024x1024, 1792x1024, 1024x1792)
        if (model.startsWith('gpt-image-2') || model === 'gemini-3.1-flash-image-preview') {
          size = ratioObj.fallbackSize || '1024x1024'
        }
        if (!size) {
          size = ratioObj.fallbackSize || '1024x1024'
        }

        const result = await generateImage({
          model,
          prompt,
          size,
          referenceImage,
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

        const ratioObj = ASPECT_RATIOS.find(r => r.id === effectiveRatio) || ASPECT_RATIOS[0]
        const size = ratioObj.resolutions[resolution] || ratioObj.resolutions['720p'] || '1280x720'

        const result = await generateVideo({
          model,
          prompt,
          seconds,
          size,
          referenceImage,
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
      if (err.message === 'MISSING_API_KEY') {
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
            onOpenReferenceModal={() => setShowReferenceModal(true)}
            onRemoveReferenceImage={() => setReferenceImage(null)}
            onGenerate={handleGenerate}
            isGenerating={isGenerating}
            hasApiKey={Boolean(apiKey)}
            onOpenSettings={() => setShowSettings(true)}
          />
        </div>

        {errorMsg && (
          <div className="max-w-2xl mx-auto px-4 mb-6">
            <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs sm:text-sm flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
              <div className="flex-1"><span className="font-bold">Lỗi khởi tạo: </span>{errorMsg}</div>
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
        <p>Seedance 2.5 Cinema Studio • Tuan Su API Gateway</p>
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
        referenceImage={referenceImage}
        onSelectImage={img => setReferenceImage(img)}
        onRemoveImage={() => setReferenceImage(null)}
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

