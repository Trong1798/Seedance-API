import React, { useState, useRef, useEffect } from 'react'
import { Film, Image as ImageIcon, Sparkles, X, Upload } from 'lucide-react'
import DockControls from './DockControls'
import { INSPIRATION_PROMPTS, IMAGE_INSPIRATION_PROMPTS } from '../constants/models'
import { uploadToBlob } from '../services/blobStorage'

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
  referenceImages = [],
  onOpenReferenceModal,
  onRemoveReferenceImage,
  onAddReferenceImage,
  onClearReferenceImages,
  onGenerate,
  isGenerating,
  hasApiKey,
  onOpenSettings,
}) {
  const isImageMode = mode === 'image'
  const textareaRef = useRef(null)
  const mentionPopoverRef = useRef(null)
  const fileInputRef = useRef(null)

  const [showMentionMenu, setShowMentionMenu] = useState(false)
  const [mentionQuery, setMentionQuery] = useState('')
  const [selectedMentionIndex, setSelectedMentionIndex] = useState(0)

  // Consolidate images list: use selected referenceImages or fallback to single referenceImage
  const selectedRefImages = referenceImages?.filter(img => img.selected) || []
  const effectiveImages = selectedRefImages.length > 0
    ? selectedRefImages
    : (referenceImage ? [{ id: 'ref-single', name: 'Image 1', url: referenceImage }] : [])

  const filteredMentionImages = effectiveImages.filter(img =>
    !mentionQuery || img.name.toLowerCase().includes(mentionQuery.toLowerCase())
  )

  // Listen for outside clicks to close mention dropdown
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (
        mentionPopoverRef.current &&
        !mentionPopoverRef.current.contains(e.target) &&
        textareaRef.current &&
        !textareaRef.current.contains(e.target)
      ) {
        setShowMentionMenu(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Handle image paste from clipboard (Ctrl+V)
  const handlePaste = async (e) => {
    const items = e.clipboardData?.items
    if (!items) return

    for (let i = 0; i < items.length; i++) {
      const item = items[i]
      if (item.type && item.type.startsWith('image/')) {
        e.preventDefault()
        const file = item.getAsFile()
        if (file) {
          try {
            const { blobUrl, pathname } = await uploadToBlob(file)
            if (onAddReferenceImage) {
              onAddReferenceImage(blobUrl, pathname, file.name || 'Pasted Image')
            }
          } catch (error) {
            console.error('Upload error:', error)
            alert(`Lỗi upload ảnh dán: ${error.message}`)
          }
        }
        break
      }
    }
  }

  // Handle typing & detecting '@' mention
  const handlePromptChange = (e) => {
    const val = e.target.value
    setPrompt(val)
    const cursor = e.target.selectionStart

    const textBeforeCursor = val.slice(0, cursor)
    const match = textBeforeCursor.match(/@([a-zA-Z0-9_\s]*)$/)
    if (match) {
      setMentionQuery(match[1])
      setShowMentionMenu(true)
      setSelectedMentionIndex(0)
    } else {
      setShowMentionMenu(false)
    }
  }

  // Handle selecting a mention item
  const handleSelectMention = (img) => {
    const cursor = textareaRef.current ? textareaRef.current.selectionStart : prompt.length
    const textBeforeCursor = prompt.slice(0, cursor)
    const textAfterCursor = prompt.slice(cursor)

    const atIndex = textBeforeCursor.lastIndexOf('@')
    if (atIndex !== -1) {
      const prefix = textBeforeCursor.slice(0, atIndex)
      const mentionTag = `@${img.name} `
      const nextPrompt = `${prefix}${mentionTag}${textAfterCursor}`
      setPrompt(nextPrompt)
      setShowMentionMenu(false)

      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.focus()
          const newPos = atIndex + mentionTag.length
          textareaRef.current.setSelectionRange(newPos, newPos)
        }
      }, 0)
    } else {
      setPrompt(prev => `${prev} @${img.name} `)
      setShowMentionMenu(false)
    }
  }

  // Handle keyboard navigation in textarea and mention dropdown
  const handleKeyDown = (e) => {
    if (showMentionMenu && filteredMentionImages.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedMentionIndex(prev => (prev + 1) % filteredMentionImages.length)
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedMentionIndex(prev => (prev - 1 + filteredMentionImages.length) % filteredMentionImages.length)
        return
      }
      if (e.key === 'Enter' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault()
        handleSelectMention(filteredMentionImages[selectedMentionIndex] || filteredMentionImages[0])
        return
      }
      if (e.key === 'Escape') {
        setShowMentionMenu(false)
        return
      }
    }

    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      onGenerate()
    }
  }

  // Trigger mention from '@' button in dock
  const handleTriggerMention = () => {
    setPrompt(prev => {
      const needsSpace = prev.length > 0 && !prev.endsWith(' ')
      return prev + (needsSpace ? ' @' : '@')
    })
    setShowMentionMenu(true)
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus()
        const len = textareaRef.current.value.length
        textareaRef.current.setSelectionRange(len, len)
      }
    }, 0)
  }

  const handleSwitchMode = (newMode) => {
    if (onModeChange) {
      onModeChange(newMode)
    }
  }

  return (
    <div className="w-full max-w-4xl mx-auto px-4">
      {/* Hidden file input for image uploads from mention prompt */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={async (e) => {
          const file = e.target.files?.[0]
          if (file) {
            try {
              const { blobUrl, pathname } = await uploadToBlob(file)
              onAddReferenceImage?.(blobUrl, pathname, file.name)
            } catch (error) {
              console.error('Upload error:', error)
              alert(`Lỗi upload ảnh: ${error.message}`)
            }
          }
          e.target.value = ''
        }}
      />

      {/* Floating Pill Dock Container */}
      <div
        onPaste={handlePaste}
        className="relative z-20 bg-[#131418]/92 border border-white/10 rounded-3xl p-3 sm:p-4 shadow-[0_20px_50px_rgba(0,0,0,0.6),inset_0_1px_1px_rgba(255,255,255,0.08)] transition-all hover:border-white/20"
      >
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
            {/* Reference Image Thumbnails (Higgsfield / Kling style) */}
            {effectiveImages.length > 0 && (
              <div className="flex items-center gap-2.5 mb-2.5 flex-wrap">
                {effectiveImages.map((img, idx) => (
                  <div
                    key={img.id || idx}
                    className="relative group w-14 h-14 rounded-xl overflow-hidden border border-white/20 bg-zinc-900 shadow-md shrink-0 transition-transform hover:scale-[1.02]"
                  >
                    <img
                      src={img.url}
                      alt={img.name}
                      className="w-full h-full object-cover"
                    />
                    {/* Badge identifier (Image 1, Image 2...) */}
                    <div className="absolute inset-x-0 bottom-0 bg-black/75 backdrop-blur-xs text-[9px] font-semibold text-center text-zinc-200 py-0.5 truncate px-1 border-t border-white/10">
                      {img.name}
                    </div>
                    {/* Delete hover button */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        onRemoveReferenceImage(img.id || idx)
                      }}
                      className="absolute top-1 right-1 p-0.5 rounded-full bg-black/80 hover:bg-rose-500 text-white opacity-0 group-hover:opacity-100 transition-all shadow"
                      title={`Gỡ ${img.name}`}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Prompt Textarea & Mention Popover */}
            <div className="relative w-full">
              <textarea
                ref={textareaRef}
                value={prompt}
                onChange={handlePromptChange}
                onKeyDown={handleKeyDown}
                onPaste={handlePaste}
                placeholder={
                  isImageMode
                    ? "Mô tả hình ảnh bạn muốn tạo... (ví dụ: Chú rồng nhỏ dễ thương 3D Pixar, cyberpunk city... hoặc dán ảnh vào Ctrl+V)"
                    : "Describe the video you want to create... (ví dụ: Cinematic drone shot flying through neon Tokyo... hoặc dán ảnh vào Ctrl+V)"
                }
                rows={2}
                className="w-full bg-transparent text-white placeholder-zinc-500 text-sm sm:text-base resize-none focus:outline-none focus:ring-0 leading-relaxed font-normal"
              />

              {/* Floating Mention Suggestions Popover (Matching screenshot) */}
              {showMentionMenu && (
                <div
                  ref={mentionPopoverRef}
                  className="absolute left-0 top-full mt-1 z-50 min-w-[210px] max-w-xs bg-[#16171b]/98 backdrop-blur-2xl border border-white/15 rounded-2xl p-1.5 shadow-[0_16px_48px_rgba(0,0,0,0.85)] animate-in fade-in zoom-in-95 duration-100"
                >
                  {effectiveImages.length > 0 ? (
                    <div className="flex flex-col gap-1">
                      {filteredMentionImages.length > 0 ? (
                        filteredMentionImages.map((img, idx) => {
                          const isSelected = idx === selectedMentionIndex
                          return (
                            <button
                              key={img.id || idx}
                              type="button"
                              onClick={() => handleSelectMention(img)}
                              onMouseEnter={() => setSelectedMentionIndex(idx)}
                              className={`w-full flex items-center gap-3 px-2 py-1.5 rounded-xl text-left transition-colors ${
                                isSelected
                                  ? 'bg-white/15 text-white shadow-sm'
                                  : 'hover:bg-white/10 text-zinc-200'
                              }`}
                            >
                              <img
                                src={img.url}
                                alt={img.name}
                                className="w-10 h-10 object-cover rounded-lg border border-white/20 shrink-0 shadow-sm"
                              />
                              <span className="text-sm font-semibold text-white tracking-wide">
                                {img.name}
                              </span>
                            </button>
                          )
                        })
                      ) : (
                        <div className="p-2 text-xs text-zinc-400 text-center">
                          Không tìm thấy ảnh phù hợp với "{mentionQuery}"
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="p-3 text-center text-xs text-zinc-300">
                      <p className="font-semibold text-white mb-1">Chưa có ảnh tham chiếu</p>
                      <p className="text-[11px] text-zinc-400 mb-2.5 leading-relaxed">
                        Bấm <kbd className="px-1.5 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-zinc-200 font-mono text-[10px]">Ctrl+V</kbd> để dán ảnh vào, hoặc tải từ thiết bị:
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          setShowMentionMenu(false)
                          fileInputRef.current?.click()
                        }}
                        className="w-full py-1.5 px-3 rounded-xl bg-white/10 hover:bg-white/20 text-white font-semibold text-xs flex items-center justify-center gap-1.5 transition"
                      >
                        <Upload className="w-3.5 h-3.5 text-[#e5ff00]" />
                        <span>Tải ảnh từ máy</span>
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

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
              referenceImages={effectiveImages}
              onOpenReferenceModal={onOpenReferenceModal}
              onTriggerMention={handleTriggerMention}
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
