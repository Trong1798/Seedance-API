import React, { useState } from 'react'
import { SHOWCASE_POSTERS } from '../constants/models'
import { Play, Sparkles } from 'lucide-react'

export default function HeroShowcase({ onSelectPrompt }) {
  const [hoveredCard, setHoveredCard] = useState(null)

  return (
    <div className="relative pt-6 pb-2 text-center overflow-hidden">
      {/* Background radial ambient lights */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[350px] bg-gradient-to-r from-zinc-800/20 via-[#e5ff00]/5 to-zinc-800/20 blur-[120px] pointer-events-none -z-10" />

      {/* 3 Showcase Poster Cards Carousel - Matching Higgsfield screenshot */}
      <div className="max-w-4xl mx-auto px-4 flex items-center justify-center gap-3 sm:gap-6 mb-8 select-none">
        {SHOWCASE_POSTERS.map((poster) => {
          const isCenter = poster.isHero
          return (
            <div
              key={poster.id}
              onMouseEnter={() => setHoveredCard(poster.id)}
              onMouseLeave={() => setHoveredCard(null)}
              onClick={() => onSelectPrompt && onSelectPrompt(poster.prompt)}
              className={`group relative rounded-2xl overflow-hidden cursor-pointer transition-all duration-500 ease-out transform ${
                isCenter
                  ? 'w-[200px] sm:w-[320px] h-[130px] sm:h-[190px] z-20 scale-105 sm:scale-110 shadow-[0_15px_35px_rgba(0,0,0,0.8),0_0_25px_rgba(229,255,0,0.18)] border border-zinc-600/70 hover:border-[#e5ff00]'
                  : 'w-[150px] sm:w-[230px] h-[105px] sm:h-[155px] z-10 opacity-70 hover:opacity-100 border border-zinc-800 hover:border-zinc-500 shadow-xl'
              }`}
            >
              {/* Poster Image / Backdrop */}
              <img
                src={poster.image}
                alt={poster.title}
                className="w-full h-full object-cover brightness-[0.75] group-hover:brightness-90 group-hover:scale-105 transition-all duration-700"
              />

              {/* Dark Gradient Overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />

              {/* Poster Titles / Text Overlay */}
              <div className="absolute inset-0 p-3 sm:p-4 flex flex-col justify-end text-left">
                {isCenter ? (
                  <div>
                    <span className="inline-block text-[8px] sm:text-[10px] uppercase tracking-widest text-[#e5ff00] font-black mb-0.5">
                      THE
                    </span>
                    <h3 className="text-xs sm:text-base font-extrabold tracking-wider text-white uppercase leading-tight drop-shadow-md">
                      CULLY HILL BOYS
                    </h3>
                    <div className="mt-1 flex items-center justify-between">
                      <span className="text-[7px] sm:text-[9px] font-bold text-zinc-300 tracking-wider uppercase">
                        FIRST AI FEATURE FILM
                      </span>
                      <span className="text-[6px] sm:text-[8px] text-zinc-400 uppercase hidden sm:inline">
                        STARRING CELEBRITY CAST
                      </span>
                    </div>
                  </div>
                ) : poster.id === 'zephyr' ? (
                  <div>
                    <h3 className="text-xs sm:text-sm font-black tracking-widest text-zinc-100 uppercase">
                      ZEPHYR
                    </h3>
                    <span className="text-[7px] sm:text-[9px] text-[#e5ff00] font-bold tracking-wider">
                      SPECIAL EDITION
                    </span>
                  </div>
                ) : (
                  <div>
                    <h3 className="text-xs sm:text-sm font-black tracking-widest text-rose-500 uppercase">
                      HELL GRIND
                    </h3>
                    <span className="text-[7px] sm:text-[9px] text-zinc-400 font-semibold tracking-wider">
                      GRITTY AI FILM
                    </span>
                  </div>
                )}
              </div>

              {/* Hover Prompt Chip Indicator */}
              <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-black/80 backdrop-blur-md px-2 py-0.5 rounded-full border border-zinc-700 flex items-center gap-1 text-[9px] text-zinc-200">
                <Sparkles className="w-2.5 h-2.5 text-[#e5ff00]" />
                <span className="hidden sm:inline">Dùng Prompt</span>
              </div>
            </div>
          )
        })}
      </div>

      {/* Main Large Title - Matching Higgsfield screenshot */}
      <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black tracking-tight text-white uppercase drop-shadow-[0_2px_15px_rgba(255,255,255,0.15)] mb-3">
        BRING YOUR STORIES TO LIFE
      </h1>
      <p className="text-xs sm:text-sm text-zinc-400 max-w-xl mx-auto font-medium px-4">
        Khởi tạo video điện ảnh siêu thực với mô hình <span className="text-[#e5ff00] font-semibold">Seedance 2.5</span> độ dài tới 30 giây
      </p>
    </div>
  )
}
