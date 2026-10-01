import React, { useState, useRef, useEffect } from 'react'
import { Plus, AtSign, Film, Image as ImageIcon, Clock, Diamond, Sliders, ChevronDown, Search, Sparkles } from 'lucide-react'
import {
  VIDEO_MODELS,
  IMAGE_MODELS,
  ASPECT_RATIOS,
  IMAGE_ASPECT_RATIOS,
  VIDEO_RESOLUTIONS,
  IMAGE_RESOLUTIONS,
  INSPIRATION_PROMPTS,
  IMAGE_INSPIRATION_PROMPTS,
} from '../constants/models'

// Proportional visual frame for each aspect ratio
function RatioShapeIcon({ ratio, className = 'text-zinc-400' }) {
  switch (ratio) {
    case '9:16':
      return (
        <div className={`w-5 h-5 flex items-center justify-center shrink-0 ${className}`}>
          <div className="w-[10px] h-[16px] rounded-[2px] border-[1.5px] border-current" />
        </div>
      )
    case '2:3':
      return (
        <div className={`w-5 h-5 flex items-center justify-center shrink-0 ${className}`}>
          <div className="w-[11px] h-[15px] rounded-[2px] border-[1.5px] border-current" />
        </div>
      )
    case '3:4':
      return (
        <div className={`w-5 h-5 flex items-center justify-center shrink-0 ${className}`}>
          <div className="w-[12px] h-[15px] rounded-[2px] border-[1.5px] border-current" />
        </div>
      )
    case '1:1':
      return (
        <div className={`w-5 h-5 flex items-center justify-center shrink-0 ${className}`}>
          <div className="w-[13px] h-[13px] rounded-[2px] border-[1.5px] border-current" />
        </div>
      )
    case '4:3':
      return (
        <div className={`w-5 h-5 flex items-center justify-center shrink-0 ${className}`}>
          <div className="w-[15px] h-[12px] rounded-[2px] border-[1.5px] border-current" />
        </div>
      )
    case '3:2':
      return (
        <div className={`w-5 h-5 flex items-center justify-center shrink-0 ${className}`}>
          <div className="w-[16px] h-[11px] rounded-[2px] border-[1.5px] border-current" />
        </div>
      )
    case '16:9':
      return (
        <div className={`w-5 h-5 flex items-center justify-center shrink-0 ${className}`}>
          <div className="w-[17px] h-[10px] rounded-[2px] border-[1.5px] border-current" />
        </div>
      )
    case '21:9':
      return (
        <div className={`w-5 h-5 flex items-center justify-center shrink-0 ${className}`}>
          <div className="w-[18px] h-[8px] rounded-[2px] border-[1.5px] border-current" />
        </div>
      )
    default:
      return (
        <div className={`w-5 h-5 flex items-center justify-center shrink-0 ${className}`}>
          <div className="w-[13px] h-[13px] rounded-[2px] border-[1.5px] border-current" />
        </div>
      )
  }
}

export default function DockControls({
  mode = 'video',
  model,
  setModel,
  seconds,
  setSeconds,
  aspectRatio,
  setAspectRatio,
  resolution,
  setResolution,
  referenceImage,
  referenceImages = [],
  onOpenReferenceModal,
  onTriggerMention,
  onGenerate,
  isGenerating,
  hasApiKey,
  onOpenSettings,
  onSelectSamplePrompt,
}) {
  const isImageMode = mode === 'image'
  const activeModels = isImageMode ? IMAGE_MODELS : VIDEO_MODELS
  const currentModel = activeModels.find(m => m.id === model) || activeModels[0]

  const [showModelMenu, setShowModelMenu] = useState(false)
  const [modelSearchQuery, setModelSearchQuery] = useState('')
  const [showRatioMenu, setShowRatioMenu] = useState(false)
  const [showResolutionMenu, setShowResolutionMenu] = useState(false)
  const [showDurationMenu, setShowDurationMenu] = useState(false)
  const [customDurationInput, setCustomDurationInput] = useState(`${seconds}s`)

  const modelMenuRef = useRef(null)
  const ratioMenuRef = useRef(null)
  const resolutionMenuRef = useRef(null)
  const durationMenuRef = useRef(null)

  useEffect(() => {
    setCustomDurationInput(`${seconds}s`)
  }, [seconds])

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (modelMenuRef.current && !modelMenuRef.current.contains(e.target)) {
        setShowModelMenu(false)
      }
      if (ratioMenuRef.current && !ratioMenuRef.current.contains(e.target)) {
        setShowRatioMenu(false)
      }
      if (resolutionMenuRef.current && !resolutionMenuRef.current.contains(e.target)) {
        setShowResolutionMenu(false)
      }
      if (durationMenuRef.current && !durationMenuRef.current.contains(e.target)) {
        setShowDurationMenu(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const toggleModelMenu = () => {
    setShowModelMenu(!showModelMenu)
    setShowRatioMenu(false)
    setShowResolutionMenu(false)
    setShowDurationMenu(false)
  }

  const toggleRatioMenu = () => {
    setShowRatioMenu(!showRatioMenu)
    setShowModelMenu(false)
    setShowResolutionMenu(false)
    setShowDurationMenu(false)
  }

  const toggleResolutionMenu = () => {
    setShowResolutionMenu(!showResolutionMenu)
    setShowModelMenu(false)
    setShowRatioMenu(false)
    setShowDurationMenu(false)
  }

  const toggleDurationMenu = () => {
    setShowDurationMenu(!showDurationMenu)
    setShowModelMenu(false)
    setShowRatioMenu(false)
    setShowResolutionMenu(false)
  }

  const handleCustomDurationChange = (e) => {
    const val = e.target.value
    setCustomDurationInput(val)
    const num = parseInt(val.replace(/\D/g, ''), 10)
    if (!isNaN(num) && num >= 5 && num <= 30) {
      setSeconds(num)
    }
  }

  const handleCustomDurationBlur = () => {
    const num = parseInt(customDurationInput.replace(/\D/g, ''), 10)
    const valid = isNaN(num) ? 10 : Math.max(5, Math.min(30, num))
    setSeconds(valid)
    setCustomDurationInput(`${valid}s`)
  }

  const handleCustomDurationKeyDown = (e) => {
    if (e.key === 'Enter') {
      const num = parseInt(customDurationInput.replace(/\D/g, ''), 10)
      const valid = isNaN(num) ? 10 : Math.max(5, Math.min(30, num))
      setSeconds(valid)
      setCustomDurationInput(`${valid}s`)
      setShowDurationMenu(false)
    }
  }

  const handleModelChange = (newModelId) => {
    setModel(newModelId)
    if (isImageMode) {
      const selectedM = IMAGE_MODELS.find(m => m.id === newModelId)
      const supported = selectedM?.supportedResolutions || ['1k']
      if (!supported.includes(resolution)) {
        setResolution(selectedM?.defaultResolution || (supported.includes('2k') ? '2k' : '1k'))
      }
    } else {
      const selectedM = VIDEO_MODELS.find(m => m.id === newModelId)
      if (selectedM) {
        if (selectedM.id === 'seedance_2.5') {
          if (seconds < 5 || seconds > 30) {
            setSeconds(selectedM.defaultDuration || 10)
          }
        } else if (!selectedM.durations.includes(seconds)) {
          setSeconds(selectedM.defaultDuration)
        }
        const supported = selectedM.supportedRatios || ['16:9', '9:16']
        if (!supported.includes(aspectRatio)) {
          setAspectRatio(selectedM.defaultRatio || '16:9')
        }
      }
    }
  }

  const supportedVideoRatioIds = currentModel?.supportedRatios || ['16:9', '9:16']
  const availableVideoRatios = ASPECT_RATIOS.filter(r => supportedVideoRatioIds.includes(r.id))
  const leftColVideoRatios = availableVideoRatios.filter(r => r.col === 'left')
  const rightColVideoRatios = availableVideoRatios.filter(r => r.col === 'right')
  const supportedImageRes = currentModel?.supportedResolutions || ['1k', '2k']

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-white/[0.08]">
      <div className="flex flex-wrap items-center gap-1.5">
        {/* Plus / Reference */}
        <button
          type="button"
          onClick={onOpenReferenceModal}
          className="p-2 rounded-xl glass-pill text-zinc-300 hover:text-white transition-all"
          title={isImageMode ? 'Thêm ảnh tham chiếu / ghép ảnh' : 'Thêm ảnh tham chiếu (Image-to-Video)'}
        >
          <Plus className="w-4 h-4" />
        </button>

        {/* Reference Mention Button (@) */}
        <button
          type="button"
          onClick={onTriggerMention}
          className="p-2 rounded-xl glass-pill text-zinc-300 hover:text-[#e5ff00] transition-all"
          title="Gán thẻ ảnh tham chiếu (@Image 1)"
        >
          <AtSign className="w-4 h-4" />
        </button>

        {/* Model Selector Popover (Higgsfield Style) */}
        <div className="relative" ref={modelMenuRef}>
          <button
            type="button"
            onClick={toggleModelMenu}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-semibold transition-all ${
              showModelMenu
                ? 'glass-pill-active'
                : 'glass-pill text-zinc-200'
            }`}
            title="Chọn mô hình AI"
          >
            <Sliders className="w-3.5 h-3.5 text-[#e5ff00] shrink-0" />
            <span className="max-w-[120px] sm:max-w-[160px] truncate">{currentModel.name}</span>
            <ChevronDown className={`w-3 h-3 text-zinc-400 transition-transform ${showModelMenu ? 'rotate-180 text-[#e5ff00]' : ''}`} />
          </button>

          {showModelMenu && (
            <div className="absolute bottom-full mb-2.5 left-0 z-50 w-72 sm:w-84 rounded-2xl glass-popover p-2.5 animate-in fade-in zoom-in-95 duration-150">
              {/* Search box matching Higgsfield */}
              <div className="relative mb-2">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                <input
                  type="text"
                  placeholder="Search models..."
                  value={modelSearchQuery}
                  onChange={(e) => setModelSearchQuery(e.target.value)}
                  className="w-full bg-white/[0.06] border border-white/10 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-white/30"
                  autoFocus
                />
              </div>

              {/* Category Header */}
              <div className="flex items-center gap-1.5 px-1.5 pb-1.5 text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                <Sparkles className="w-3 h-3 text-[#e5ff00]" />
                <span>{isImageMode ? 'Creative Image Models' : 'Cinematic Video Models'}</span>
              </div>

              {/* Models List */}
              <div className="flex flex-col gap-1 max-h-[260px] overflow-y-auto pr-0.5">
                {activeModels
                  .filter(m => !modelSearchQuery.trim() || m.name.toLowerCase().includes(modelSearchQuery.toLowerCase()) || m.tag?.toLowerCase().includes(modelSearchQuery.toLowerCase()))
                  .map(m => {
                    const isSelected = m.id === model
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => {
                          handleModelChange(m.id)
                          setShowModelMenu(false)
                        }}
                        className={`w-full flex items-start gap-2.5 p-2 rounded-xl text-left transition-all ${
                          isSelected
                            ? 'bg-white/10 text-white border border-[#e5ff00]/50 shadow-[0_0_12px_rgba(229,255,0,0.15)]'
                            : 'hover:bg-white/[0.08] text-zinc-300 hover:text-white border border-transparent'
                        }`}
                      >
                        <div className={`p-1.5 rounded-lg shrink-0 mt-0.5 ${isSelected ? 'bg-[#e5ff00]/20 text-[#e5ff00]' : 'bg-white/[0.06] text-zinc-400'}`}>
                          {isImageMode ? <ImageIcon className="w-3.5 h-3.5" /> : <Film className="w-3.5 h-3.5" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-1.5">
                            <span className={`text-xs font-bold truncate ${isSelected ? 'text-[#e5ff00]' : 'text-zinc-100'}`}>
                              {m.name}
                            </span>
                            {m.tag && (
                              <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/[0.08] text-zinc-300 font-medium shrink-0">
                                {m.tag}
                              </span>
                            )}
                          </div>
                          {m.description && (
                            <p className="text-[10px] text-zinc-400 line-clamp-1 mt-0.5 leading-normal">
                              {m.description}
                            </p>
                          )}
                        </div>
                      </button>
                    )
                  })}
              </div>
            </div>
          )}
        </div>

        {/* References Button */}
        <button
          type="button"
          onClick={onOpenReferenceModal}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium border transition-all ${
            (referenceImages?.length > 0 || referenceImage)
              ? 'glass-pill-active'
              : 'glass-pill text-zinc-300'
          }`}
          title={isImageMode ? 'Ảnh tham chiếu (Edit / Ghép ảnh)' : 'Ảnh tham chiếu (Image-to-Video)'}
        >
          {isImageMode ? <ImageIcon className="w-3.5 h-3.5" /> : <Film className="w-3.5 h-3.5" />}
          <span>References</span>
          <ChevronDown className="w-3 h-3 text-zinc-400" />
          {(referenceImages?.length > 0 || referenceImage) && (
            <span className="w-1.5 h-1.5 rounded-full bg-[#e5ff00]" />
          )}
        </button>

        {/* Aspect Ratio Popover */}
        <div className="relative" ref={ratioMenuRef}>
          <button
            type="button"
            onClick={toggleRatioMenu}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-semibold transition-all ${
              showRatioMenu
                ? 'glass-pill-active'
                : 'glass-pill text-zinc-200'
            }`}
            title="Chọn tỉ lệ khung hình"
          >
            <RatioShapeIcon ratio={aspectRatio} className="text-[#e5ff00]" />
            <span>{aspectRatio}</span>
            <ChevronDown className={`w-3 h-3 text-zinc-400 transition-transform ${showRatioMenu ? 'rotate-180 text-[#e5ff00]' : ''}`} />
          </button>

          {showRatioMenu && (
            <div className="absolute bottom-full mb-2.5 left-0 z-50 min-w-[260px] p-3 rounded-2xl glass-popover animate-in fade-in zoom-in-95 duration-150">
              <div className="text-[10px] font-bold tracking-wider text-zinc-400 uppercase px-1 pb-2 border-b border-white/[0.08] mb-2.5 flex items-center justify-between">
                <span>ASPECT RATIO</span>
                <span className="text-[9px] text-zinc-400/80 font-normal">
                  {isImageMode ? `${IMAGE_ASPECT_RATIOS.length} TỈ LỆ` : `${availableVideoRatios.length} TỈ LỆ`}
                </span>
              </div>

              {isImageMode ? (
                /* Image Mode: 3 standard ratios (16:9, 9:16, 1:1) */
                <div className="flex flex-col gap-1 min-w-[220px]">
                  {IMAGE_ASPECT_RATIOS.map(r => (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => {
                        setAspectRatio(r.id)
                        setShowRatioMenu(false)
                      }}
                      className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                        aspectRatio === r.id
                          ? 'bg-white/10 text-[#e5ff00] font-bold border border-[#e5ff00]/50 shadow-[0_0_12px_rgba(229,255,0,0.15),inset_0_1px_0_rgba(255,255,255,0.2)]'
                          : 'hover:bg-white/[0.08] text-zinc-300 hover:text-white border border-transparent'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <RatioShapeIcon ratio={r.id} className={aspectRatio === r.id ? 'text-[#e5ff00]' : 'text-zinc-400'} />
                        <span>{r.label}</span>
                      </div>
                      <span className="text-[10px] text-zinc-400">{r.desc?.split('(')[0]}</span>
                    </button>
                  ))}
                </div>
              ) : availableVideoRatios.length > 3 ? (
                /* Video Mode (Seedance 2.0 / 2.5): 6 Ratios in 2-Column Grid Layout */
                <div className="grid grid-cols-2 gap-2 min-w-[220px]">
                  <div className="flex flex-col gap-1">
                    {leftColVideoRatios.map(r => (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => {
                          setAspectRatio(r.id)
                          setShowRatioMenu(false)
                        }}
                        className={`flex items-center gap-2.5 px-2.5 py-1.5 rounded-xl text-xs font-medium transition-all ${
                          aspectRatio === r.id
                            ? 'bg-white/10 text-[#e5ff00] font-bold border border-[#e5ff00]/50 shadow-[0_0_12px_rgba(229,255,0,0.15),inset_0_1px_0_rgba(255,255,255,0.2)]'
                            : 'hover:bg-white/[0.08] text-zinc-300 hover:text-white border border-transparent'
                        }`}
                      >
                        <RatioShapeIcon ratio={r.id} className={aspectRatio === r.id ? 'text-[#e5ff00]' : 'text-zinc-400'} />
                        <span>{r.label}</span>
                      </button>
                    ))}
                  </div>

                  <div className="flex flex-col gap-1">
                    {rightColVideoRatios.map(r => (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => {
                          setAspectRatio(r.id)
                          setShowRatioMenu(false)
                        }}
                        className={`flex items-center gap-2.5 px-2.5 py-1.5 rounded-xl text-xs font-medium transition-all ${
                          aspectRatio === r.id
                            ? 'bg-white/10 text-[#e5ff00] font-bold border border-[#e5ff00]/50 shadow-[0_0_12px_rgba(229,255,0,0.15),inset_0_1px_0_rgba(255,255,255,0.2)]'
                            : 'hover:bg-white/[0.08] text-zinc-300 hover:text-white border border-transparent'
                        }`}
                      >
                        <RatioShapeIcon ratio={r.id} className={aspectRatio === r.id ? 'text-[#e5ff00]' : 'text-zinc-400'} />
                        <span>{r.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                /* Video Mode (Veo 3.1 / Gemini Omni): Compact List */
                <div className="flex flex-col gap-1 min-w-[200px]">
                  {availableVideoRatios.map(r => (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => {
                        setAspectRatio(r.id)
                        setShowRatioMenu(false)
                      }}
                      className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                        aspectRatio === r.id
                          ? 'bg-white/10 text-[#e5ff00] font-bold border border-[#e5ff00]/50 shadow-[0_0_12px_rgba(229,255,0,0.15),inset_0_1px_0_rgba(255,255,255,0.2)]'
                          : 'hover:bg-white/[0.08] text-zinc-300 hover:text-white border border-transparent'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <RatioShapeIcon ratio={r.id} className={aspectRatio === r.id ? 'text-[#e5ff00]' : 'text-zinc-400'} />
                        <span>{r.label}</span>
                      </div>
                      <span className="text-[10px] text-zinc-400">{r.desc?.split('(')[0]}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Resolution Popover (Visible for BOTH Image & Video) */}
        <div className="relative" ref={resolutionMenuRef}>
          <button
            type="button"
            onClick={toggleResolutionMenu}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-semibold transition-all ${
              showResolutionMenu
                ? 'glass-pill-active'
                : 'glass-pill text-zinc-200'
            }`}
            title={isImageMode ? 'Độ phân giải ảnh' : 'Độ phân giải video'}
          >
            <Diamond className="w-3.5 h-3.5 text-[#e5ff00] shrink-0" />
            <span className="uppercase">{resolution}</span>
            <ChevronDown className={`w-3 h-3 text-zinc-400 transition-transform ${showResolutionMenu ? 'rotate-180 text-[#e5ff00]' : ''}`} />
          </button>

          {showResolutionMenu && (
            <div className="absolute bottom-full mb-2.5 left-0 z-50 min-w-[230px] p-2.5 rounded-2xl glass-popover animate-in fade-in zoom-in-95 duration-150">
              <div className="text-[10px] font-bold tracking-wider text-zinc-400 uppercase px-1 pb-2 border-b border-white/[0.08] mb-2 flex items-center justify-between">
                <span>{isImageMode ? 'ĐỘ PHÂN GIẢI ẢNH' : 'ĐỘ PHÂN GIẢI VIDEO'}</span>
                {isImageMode && <span className="text-[9px] text-[#e5ff00]">2K / 4K</span>}
              </div>

              <div className="flex flex-col gap-1">
                {isImageMode ? (
                  IMAGE_RESOLUTIONS.map(res => {
                    const isSupported = supportedImageRes.includes(res.id)
                    const isSelected = resolution === res.id

                    return (
                      <button
                        key={res.id}
                        type="button"
                        disabled={!isSupported}
                        onClick={() => {
                          if (isSupported) {
                            setResolution(res.id)
                            setShowResolutionMenu(false)
                          }
                        }}
                        className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                          isSelected
                            ? 'bg-white/10 text-[#e5ff00] font-bold border border-[#e5ff00]/50 shadow-[0_0_12px_rgba(229,255,0,0.15),inset_0_1px_0_rgba(255,255,255,0.2)]'
                            : isSupported
                            ? 'hover:bg-white/[0.08] text-zinc-300 hover:text-white border border-transparent'
                            : 'opacity-35 cursor-not-allowed text-zinc-500 border border-transparent'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <Diamond className={`w-3.5 h-3.5 ${isSelected ? 'text-[#e5ff00]' : isSupported ? 'text-zinc-400' : 'text-zinc-600'}`} />
                          <span className="uppercase font-semibold">{res.label}</span>
                        </div>
                        <span className="text-[10px] text-zinc-400">
                          {isSupported ? (res.id === '2k' ? 'Chuẩn' : res.id === '4k' ? 'Ultra HD' : '1K') : 'Chỉ Gemini 3 Pro'}
                        </span>
                      </button>
                    )
                  })
                ) : (
                  VIDEO_RESOLUTIONS.map(res => {
                    const isSelected = resolution === res.id

                    return (
                      <button
                        key={res.id}
                        type="button"
                        onClick={() => {
                          setResolution(res.id)
                          setShowResolutionMenu(false)
                        }}
                        className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                          isSelected
                            ? 'bg-white/10 text-[#e5ff00] font-bold border border-[#e5ff00]/50 shadow-[0_0_12px_rgba(229,255,0,0.15),inset_0_1px_0_rgba(255,255,255,0.2)]'
                            : 'hover:bg-white/[0.08] text-zinc-300 hover:text-white border border-transparent'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <Diamond className={`w-3.5 h-3.5 ${isSelected ? 'text-[#e5ff00]' : 'text-zinc-400'}`} />
                          <span className="font-semibold">{res.label}</span>
                        </div>
                        <span className="text-[10px] text-zinc-400">{res.desc}</span>
                      </button>
                    )
                  })
                )}
              </div>
            </div>
          )}
        </div>

        {/* Duration Popover (HIDDEN IN IMAGE MODE as requested) */}
        {!isImageMode && (
          <div className="relative" ref={durationMenuRef}>
            <button
              type="button"
              onClick={toggleDurationMenu}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-semibold transition-all ${
                showDurationMenu
                  ? 'bg-white/10 text-[#e5ff00] border-[#e5ff00]/50 shadow-[0_0_12px_rgba(229,255,0,0.2)]'
                  : 'glass-pill text-zinc-300 hover:text-white border-transparent'
              }`}
            >
              <Clock className={`w-3.5 h-3.5 ${showDurationMenu ? 'text-[#e5ff00]' : 'text-zinc-400'}`} />
              <span>{seconds}s</span>
            </button>

            {showDurationMenu && (
              <div className="absolute bottom-full mb-2.5 left-0 z-50 min-w-[210px] p-3 rounded-2xl glass-popover animate-in fade-in zoom-in-95 duration-150 shadow-2xl">
                <div className="text-[10px] font-bold tracking-wider text-zinc-400 uppercase px-1 pb-2 border-b border-white/[0.08] mb-2.5 flex items-center justify-between">
                  <span>Duration</span>
                  <span className="text-[9px] text-zinc-400/80 font-normal">
                    {currentModel?.id === 'seedance_2.5' ? '5s - 30s' : `${currentModel?.name || ''}`}
                  </span>
                </div>

                {currentModel?.id === 'seedance_2.5' ? (
                  /* Custom input matching the user screenshot */
                  <div className="flex flex-col gap-2">
                    <div className="relative">
                      <input
                        type="text"
                        value={customDurationInput}
                        onChange={handleCustomDurationChange}
                        onBlur={handleCustomDurationBlur}
                        onKeyDown={handleCustomDurationKeyDown}
                        placeholder="18s"
                        autoFocus
                        className="w-full bg-[#18181b]/90 border border-zinc-700/80 hover:border-zinc-500 focus:border-[#e5ff00] focus:ring-1 focus:ring-[#e5ff00]/50 rounded-xl px-3 py-2 text-sm font-semibold text-white placeholder-zinc-500 focus:outline-none transition-all shadow-inner"
                      />
                    </div>
                    {/* Quick preset chips */}
                    <div className="flex flex-wrap items-center gap-1 pt-0.5">
                      {[5, 10, 15, 20, 25, 30].map(s => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => {
                            setSeconds(s)
                            setCustomDurationInput(`${s}s`)
                            setShowDurationMenu(false)
                          }}
                          className={`px-2 py-1 rounded-lg text-[11px] font-medium transition-all ${
                            seconds === s
                              ? 'bg-[#e5ff00]/20 text-[#e5ff00] border border-[#e5ff00]/40 font-bold'
                              : 'bg-white/[0.06] text-zinc-400 hover:text-white hover:bg-white/10'
                          }`}
                        >
                          {s}s
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  /* List of supported durations (Omni Flash: 5s, 10s; Seedance 2.0 Fast: 5s, 10s, 15s; Veo 3.1: 4s, 6s, 8s) */
                  <div className="flex flex-col gap-1 min-w-[170px]">
                    {(currentModel?.durations || [5]).map(sec => (
                      <button
                        key={sec}
                        type="button"
                        onClick={() => {
                          setSeconds(sec)
                          setShowDurationMenu(false)
                        }}
                        className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                          seconds === sec
                            ? 'bg-white/10 text-[#e5ff00] font-bold border border-[#e5ff00]/50 shadow-[0_0_12px_rgba(229,255,0,0.15)]'
                            : 'hover:bg-white/[0.08] text-zinc-300 hover:text-white border border-transparent'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <Clock className={`w-3.5 h-3.5 ${seconds === sec ? 'text-[#e5ff00]' : 'text-zinc-400'}`} />
                          <span>{sec} giây</span>
                        </div>
                        <span className="text-[10px] text-zinc-400 font-mono">{sec}s</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* GENERATE */}
      <button
        type="button"
        onClick={() => {
          if (!hasApiKey) {
            onOpenSettings()
            return
          }
          onGenerate()
        }}
        disabled={isGenerating}
        className="px-5 py-2.5 rounded-2xl bg-[#e5ff00] hover:bg-[#d6f000] text-black font-black transition-all shadow-[0_0_20px_rgba(229,255,0,0.3)] hover:shadow-[0_0_30px_rgba(229,255,0,0.55)] active:scale-[0.98] disabled:opacity-50 flex items-center justify-center shrink-0 min-w-[105px]"
      >
        <span className="text-xs uppercase tracking-wider font-extrabold leading-tight">
          {isGenerating ? (isImageMode ? 'GENERATING...' : 'RENDERING...') : 'GENERATE'}
        </span>
      </button>
    </div>
  )
}
