import React from 'react'
import { Film, Image as ImageIcon, Sparkles, X } from 'lucide-react'
import DockControls from './DockControls'
import { INSPIRATION_PROMPTS, IMAGE_INSPIRATION_PROMPTS } from '../constants/models'

export default function GenerationDock({
  mode = 'video',
  onModeChange,
  prompt,
  setPrompt,
  model,
  setModel,
  seconds,
  setSeconds,
  aspectRatio,
  setAspectRatio,
  resolution,
  setResolution,
  referenceImage,
  onOpenReferenceModal,
  onRemoveReferenceImage,
  onGenerate,
  isGenerating,
  hasApiKey,
  onOpenSettings,
}) {
  const isImageMode = mode === 'image'

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      onGenerate()
    }
  }

  const handleSwitchMode = (newMode) => {
    if (onModeChange) {
      onModeChange(newMode)
    }
  }

  return (
    <div className="w-full max-w-4xl mx-auto px-4">
      {/* Floating Pill Dock Container */}
      <div className="relative z-20 bg-[#131418]/92 border border-white/10 rounded-3xl p-3 sm:p-4 shadow-[0_20px_50px_rgba(0,0,0,0.6),inset_0_1px_1px_rgba(255,255,255,0.08)] transition-all hover:border-white/20">
        <div className="flex flex-col md:flex-row gap-3">
          
          {/* Mode Switcher */}
          <div className="flex md:flex-col gap-1.5 shrink-0 justify-start border-b md:border-b-0 md:border-r border-white/10 pb-2 md:pb-0 md:pr-3">
            <button
              type="button"
              onClick={() => handleSwitchMode('image')}
              className={`flex flex-col items-center justify-center w-14 h-12 md:w-16 md:h-14 rounded-2xl transition text-xs font-semibold ${
                isImageMode
                  ? 'bg-white/10 text-white border border-white/20 shadow-md ring-1 ring-[#e5ff00]/40'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.05]'
              }`}
            >
              <ImageIcon className={`w-4 h-4 mb-0.5 ${isImageMode ? 'text-[#e5ff00]' : ''}`} />
              <span className="text-[10px]">Image</span>
            </button>

            <button
              type="button"
              onClick={() => handleSwitchMode('video')}
              className={`flex flex-col items-center justify-center w-14 h-12 md:w-16 md:h-14 rounded-2xl transition text-xs font-semibold ${
                !isImageMode
                  ? 'bg-white/10 text-white border border-white/20 shadow-md ring-1 ring-[#e5ff00]/40'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.05]'
              }`}
            >
              <Film className={`w-4 h-4 mb-0.5 ${!isImageMode ? 'text-[#e5ff00]' : ''}`} />
              <span className="text-[10px]">Video</span>
            </button>
          </div>

          {/* Right Input & Controls */}
          <div className="flex-1 flex flex-col justify-between min-w-0">
            {/* Reference Image badge */}
            {referenceImage && (
              <div className="mb-2 flex items-center gap-2 p-1.5 bg-zinc-900/90 border border-zinc-700 rounded-xl w-fit">
                <img src={referenceImage} alt="Ref thumbnail" className="w-6 h-6 object-cover rounded-md" />
                <span className="text-[11px] text-zinc-300 font-medium">
                  {isImageMode ? 'Ảnh tham chiếu (Edit / Ghép ảnh)' : 'Ảnh tham chiếu đã gắn'}
                </span>
                <button
                  type="button"
                  onClick={onRemoveReferenceImage}
                  className="p-1 hover:bg-zinc-800 rounded text-zinc-400 hover:text-white"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}

            {/* Prompt Textarea */}
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={isImageMode ? "Mô tả hình ảnh bạn muốn tạo... (ví dụ: Chú rồng nhỏ dễ thương 3D Pixar, cyberpunk city...)" : "Describe the video you want to create... (ví dụ: Cinematic drone shot flying through neon Tokyo...)"}
              rows={2}
              className="w-full bg-transparent text-white placeholder-zinc-500 text-sm sm:text-base resize-none focus:outline-none focus:ring-0 leading-relaxed font-normal"
            />

            {/* Dock Controls toolbar */}
            <DockControls
              mode={mode}
              model={model}
              setModel={setModel}
              seconds={seconds}
              setSeconds={setSeconds}
              aspectRatio={aspectRatio}
              setAspectRatio={setAspectRatio}
              resolution={resolution}
              setResolution={setResolution}
              referenceImage={referenceImage}
              onOpenReferenceModal={onOpenReferenceModal}
              onGenerate={onGenerate}
              isGenerating={isGenerating}
              hasApiKey={hasApiKey}
              onOpenSettings={onOpenSettings}
              onSelectSamplePrompt={(sample) => {
                setPrompt(sample.prompt)
                if (sample.model) setModel(sample.model)
                if (sample.seconds) setSeconds(sample.seconds)
                if (sample.ratio) setAspectRatio(sample.ratio)
              }}
            />
          </div>
        </div>
      </div>

      {/* Quick Inspiration Chips */}
      <div className="mt-4 flex items-center gap-2 overflow-x-auto pb-1 text-xs no-scrollbar justify-center">
        <span className="text-zinc-500 text-[11px] font-semibold flex items-center gap-1 shrink-0">
          <Sparkles className="w-3 h-3 text-[#e5ff00]" /> Thử ngay:
        </span>
        {(isImageMode ? IMAGE_INSPIRATION_PROMPTS : INSPIRATION_PROMPTS).slice(0, 5).map((p, idx) => (
          <button
            key={idx}
            onClick={() => {
              setPrompt(p.prompt)
              if (p.model) setModel(p.model)
              if (p.seconds) setSeconds(p.seconds)
              if (p.ratio) setAspectRatio(p.ratio)
            }}
            className="px-3 py-1 rounded-full bg-zinc-900/80 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 text-zinc-400 hover:text-zinc-200 text-[11px] font-medium shrink-0 transition"
          >
            {p.label}
          </button>
        ))}
      </div>
    </div>
  )
}
