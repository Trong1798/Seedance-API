import React, { useState, useRef } from 'react'
import { Upload, X, Image as ImageIcon, Check, Trash2, Maximize2, Loader2 } from 'lucide-react'
import { uploadToBlob } from '../services/blobStorage'

export default function ReferenceModal({ isOpen, onClose, referenceImages = [], onAddImage, onToggleSelect, onDeleteImage }) {
  if (!isOpen) return null

  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [previewImage, setPreviewImage] = useState(null)
  const fileInputRef = useRef(null)

  const selectedCount = referenceImages.filter(img => img.selected).length

  const handleFileSelect = async (e) => {
    const files = Array.from(e.target.files || [])
    if (files.length === 0) return

    setIsUploading(true)
    let successCount = 0

    for (const file of files) {
      if (!file.type.startsWith('image/')) { alert(`${file.name}: Không phải file hình ảnh`); continue }
      if (file.size > 100 * 1024 * 1024) { alert(`${file.name}: Vượt quá 100MB`); continue }

      try {
        setUploadProgress(Math.round((successCount / files.length) * 100))
        const { blobUrl, pathname } = await uploadToBlob(file)
        onAddImage(blobUrl, pathname, file.name)
        successCount++
      } catch (error) {
        console.error('Upload error:', error)
        alert(`Lỗi upload ${file.name}: ${error.message}`)
      }
    }

    setIsUploading(false)
    setUploadProgress(0)
    e.target.value = ''
  }

  const handleDelete = async (e, id) => {
    e.stopPropagation()
    if (!confirm('Xóa ảnh này? (Sẽ xóa vĩnh viễn khỏi Vercel Blob)')) return
    try { await onDeleteImage(id) } catch (error) { alert(`Lỗi xóa ảnh: ${error.message}`) }
  }

  const handleSelectOnly = (e, id) => {
    e.stopPropagation()
    referenceImages.forEach(img => { if (img.id !== id && img.selected) onToggleSelect(img.id) })
    const target = referenceImages.find(img => img.id === id)
    if (target && !target.selected) onToggleSelect(id)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <div className="w-full max-w-4xl bg-[#16161a] border border-zinc-800 rounded-3xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-zinc-800 text-[#e5ff00]"><ImageIcon className="w-5 h-5" /></div>
            <div>
              <h3 className="text-sm font-bold text-white">Ảnh tham chiếu (Image-to-Video)</h3>
              <p className="text-[11px] text-zinc-400">{selectedCount > 0 ? `Đã chọn ${selectedCount} ảnh` : 'Chưa chọn ảnh nào'}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg bg-zinc-800/80 hover:bg-zinc-800 text-zinc-400 hover:text-white transition"><X className="w-4 h-4" /></button>
        </div>




        <div className="p-6 max-h-[60vh] overflow-y-auto">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            <button onClick={() => fileInputRef.current?.click()} disabled={isUploading} className="aspect-square border-2 border-dashed border-zinc-700 hover:border-[#e5ff00] bg-zinc-900/60 rounded-2xl flex flex-col items-center justify-center gap-2 transition group disabled:opacity-50 disabled:cursor-not-allowed">
              {isUploading ? (
                <>
                  <Loader2 className="w-8 h-8 text-[#e5ff00] animate-spin" />
                  <span className="text-xs font-semibold text-zinc-300">Đang upload...</span>
                  <span className="text-[10px] text-zinc-500">{uploadProgress}%</span>
                </>
              ) : (
                <>
                  <div className="p-3 rounded-full bg-zinc-800 group-hover:bg-zinc-700 transition"><Upload className="w-6 h-6 text-zinc-400 group-hover:text-[#e5ff00]" /></div>
                  <span className="text-xs font-semibold text-zinc-300 group-hover:text-white">Upload media</span>
                </>
              )}
            </button>

            {referenceImages.map((img) => (
              <div key={img.id} onClick={() => onToggleSelect(img.id)} className={`relative aspect-square rounded-2xl overflow-hidden cursor-pointer group transition-all duration-200 ${img.selected ? 'ring-2 ring-[#e5ff00] ring-offset-2 ring-offset-[#16161a]' : 'ring-1 ring-zinc-700 hover:ring-zinc-500'}`}>
                <img src={img.url} alt={img.name} className="w-full h-full object-cover" loading="lazy" />
                {img.selected && (
                  <div className="absolute top-2 left-2 w-6 h-6 bg-[#e5ff00] rounded-full flex items-center justify-center shadow-lg z-10">
                    <Check className="w-4 h-4 text-black" strokeWidth={3} />
                  </div>
                )}
                <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                  <button onClick={(e) => { e.stopPropagation(); setPreviewImage(img.url) }} className="p-1.5 rounded-lg bg-black/70 hover:bg-black text-white" title="Xem toàn màn hình">
                    <Maximize2 className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={(e) => handleDelete(e, img.id)} className="p-1.5 rounded-lg bg-black/70 hover:bg-rose-500 text-white" title="Xóa ảnh">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
                {!img.selected && selectedCount > 0 && (
                  <div className="absolute bottom-2 left-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                    <button onClick={(e) => handleSelectOnly(e, img.id)} className="w-full py-1 px-2 rounded-lg bg-[#e5ff00] hover:bg-[#d4ee00] text-black text-[10px] font-bold" title="Bỏ chọn các ảnh khác, chỉ chọn ảnh này">
                      Chỉ chọn ảnh này
                    </button>
                  </div>
                )}
                <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 to-transparent p-2">
                  <p className="text-[10px] text-white truncate font-medium">{img.name}</p>
                </div>
              </div>
            ))}
          </div>

          {referenceImages.length === 0 && !isUploading && (
            <div className="text-center py-12">
              <ImageIcon className="w-12 h-12 text-zinc-700 mx-auto mb-3" />
              <p className="text-sm text-zinc-500">Chưa có ảnh nào. Nhấn "Upload media" để thêm ảnh tham chiếu.</p>
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-zinc-800 flex items-center justify-between">
          <p className="text-[11px] text-zinc-500">Ảnh được lưu trên Vercel Blob (miễn phí 1GB)</p>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm font-semibold transition">Hủy</button>
            <button onClick={onClose} disabled={selectedCount === 0} className="px-4 py-2 rounded-xl bg-[#e5ff00] hover:bg-[#d4ee00] disabled:opacity-40 disabled:cursor-not-allowed text-black text-sm font-bold transition">
              Xong ({selectedCount})
            </button>
          </div>
        </div>

        <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleFileSelect} />
      </div>

      {previewImage && (
        <div className="fixed inset-0 z-[60] bg-black/95 flex items-center justify-center p-8" onClick={() => setPreviewImage(null)}>
          <img src={previewImage} alt="Preview" className="max-w-full max-h-full object-contain" />
          <button className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white" onClick={() => setPreviewImage(null)}><X className="w-6 h-6" /></button>
        </div>
      )}
    </div>
  )
}
