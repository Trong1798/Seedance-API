export const VIDEO_MODELS = [
  {
    id: 'seedance_2.5',
    name: 'Seedance 2.5',
    tag: 'Chất lượng cao',
    description: 'Chất lượng điện ảnh đỉnh cao, hỗ trợ thời lượng tùy chỉnh từ 5s đến 30s',
    durations: [5, 10, 15, 20, 25, 30],
    defaultDuration: 10,
    supportedRatios: ['16:9', '9:16', '1:1', '4:3', '3:4', '21:9'],
    defaultRatio: '16:9',
    supportsImageToVideo: true,
  },
  {
    id: 'seedance_2.0_fast',
    name: 'Seedance 2.0 Fast',
    tag: 'Siêu nhanh',
    description: 'Tốc độ render cực nhanh, hiệu năng cao',
    durations: [5, 10, 15],
    defaultDuration: 5,
    supportedRatios: ['16:9', '9:16', '1:1', '4:3', '3:4', '21:9'],
    defaultRatio: '16:9',
    supportsImageToVideo: true,
  },
  {
    id: 'Veo-3.1',
    name: 'Veo 3.1',
    tag: 'Google DeepMind',
    description: 'Model video cao cấp của Google DeepMind',
    durations: [4, 6, 8],
    defaultDuration: 4,
    supportedRatios: ['16:9', '9:16'],
    defaultRatio: '16:9',
    supportsImageToVideo: false,
  },
  {
    id: 'gemini-omni-flash-preview',
    name: 'Gemini Omni Flash',
    tag: 'Google Omni',
    description: 'Model video tốc độ cao từ Google Gemini (5s / 10s)',
    durations: [5, 10],
    defaultDuration: 5,
    supportedRatios: ['16:9', '9:16'],
    defaultRatio: '16:9',
    supportsImageToVideo: false,
  },
]

export const IMAGE_MODELS = [
  {
    id: 'gemini-3-pro-image-preview',
    name: 'gemini-3-pro-image-preview (Nano Banana Pro)',
    tag: 'Nano Banana Pro',
    description: 'Gemini 3 Pro Image — Siêu phẩm tạo ảnh chân thực, chi tiết cao, hỗ trợ 2K và 4K',
    supportsReference: true,
    supportedResolutions: ['2k', '4k', '1k'],
    defaultResolution: '2k',
  },
  {
    id: 'gpt-image-2',
    name: 'gpt-image-2',
    tag: 'Đa năng & Ghép ảnh',
    description: 'Tạo ảnh siêu nét 1024x1024, hỗ trợ sửa ảnh và GHÉP 2+ ẢNH THAM CHIẾU',
    supportsReference: true,
    supportedResolutions: ['1k', '2k'],
    defaultResolution: '1k',
  },
  {
    id: 'gpt-image-2.5-flare',
    name: 'gpt-image-2.5-flare',
    tag: 'Flare Nghệ thuật',
    description: 'Dòng Flare ánh sáng rực rỡ, nghệ thuật',
    supportsReference: true,
    supportedResolutions: ['1k', '2k'],
    defaultResolution: '1k',
  },
  {
    id: 'gpt-image-2.5-sunburst',
    name: 'gpt-image-2.5-sunburst',
    tag: 'Sunburst Điện ảnh',
    description: 'Dòng Sunburst điện ảnh chân thực, chi tiết cao',
    supportsReference: true,
    supportedResolutions: ['1k', '2k'],
    defaultResolution: '1k',
  },
  {
    id: 'gemini-3.1-flash-image-preview',
    name: 'gemini-3.1-flash-image-preview (nanobanana 2)',
    tag: 'Nanobanana 2 Siêu tốc',
    description: 'Nanobanana 2 tốc độ cực nhanh, hỗ trợ tham chiếu',
    supportsReference: true,
    supportedResolutions: ['1k', '2k'],
    defaultResolution: '2k',
  },
]

export const MODELS = VIDEO_MODELS

export const ASPECT_RATIOS = [
  {
    id: '9:16',
    label: '9:16',
    desc: 'Dọc (TikTok, Reels, Shorts)',
    shape: 'tall',
    col: 'left',
    resolutions: {
      '720p': '720x1280',
      '1080p': '1024x1792',
    },
  },
  {
    id: '3:4',
    label: '3:4',
    desc: 'Dọc màn hình iPad 3:4',
    shape: 'portrait-compact',
    col: 'left',
    resolutions: {
      '720p': '720x960',
      '1080p': '1080x1440',
    },
  },
  {
    id: '4:3',
    label: '4:3',
    desc: 'Ngang kinh điển 4:3',
    shape: 'landscape-compact',
    col: 'left',
    resolutions: {
      '720p': '960x720',
      '1080p': '1440x1080',
    },
  },
  {
    id: '1:1',
    label: '1:1',
    desc: 'Vuông 1:1',
    shape: 'square',
    col: 'right',
    resolutions: {
      '720p': '720x720',
      '1080p': '1024x1024',
    },
  },
  {
    id: '16:9',
    label: '16:9',
    desc: 'Ngang chuẩn (YouTube, TV, PC)',
    shape: 'landscape-wide',
    col: 'right',
    resolutions: {
      '720p': '1280x720',
      '1080p': '1792x1024',
    },
  },
  {
    id: '21:9',
    label: '21:9',
    desc: 'Điện ảnh siêu rộng 21:9 (Ultrawide)',
    shape: 'ultrawide',
    col: 'right',
    resolutions: {
      '720p': '1680x720',
      '1080p': '2560x1080',
    },
  },
]

export const IMAGE_ASPECT_RATIOS = [
  {
    id: '16:9',
    label: '16:9',
    desc: 'Ngang chuẩn 16:9 YouTube/PC',
    shape: 'landscape-wide',
    sizes: {
      '1k': '1792x1024',
      '2k': '2560x1440',
      '4k': '3840x2160',
    },
    fallbackSize: '1792x1024',
  },
  {
    id: '9:16',
    label: '9:16',
    desc: 'Dọc TikTok, Reels, Shorts',
    shape: 'tall',
    sizes: {
      '1k': '1024x1792',
      '2k': '1440x2560',
      '4k': '2160x3840',
    },
    fallbackSize: '1024x1792',
  },
  {
    id: '1:1',
    label: '1:1',
    desc: 'Vuông Instagram 1:1',
    shape: 'square',
    sizes: {
      '1k': '1024x1024',
      '2k': '2048x2048',
      '4k': '4096x4096',
    },
    fallbackSize: '1024x1024',
  },
]


export const VIDEO_RESOLUTIONS = [
  { id: '720p', label: '720p', desc: 'Tiêu chuẩn HD' },
  { id: '1080p', label: '1080p', desc: 'Độ nét cao Full HD' },
]

export const IMAGE_RESOLUTIONS = [
  { id: '2k', label: '2k', desc: 'Độ nét cao 2K (Chuẩn)' },
  { id: '4k', label: '4k', desc: 'Siêu nét 4K Ultra HD (Nano Banana Pro)' },
  { id: '1k', label: '1k', desc: 'Tiêu chuẩn 1K' },
]

export const RESOLUTIONS = VIDEO_RESOLUTIONS

export const SHOWCASE_POSTERS = [
  {
    id: 'zephyr',
    title: 'ZEPHYR',
    subtitle: 'SPECIAL',
    tagline: 'NEXT-GEN ACTION',
    image: 'https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?w=800&auto=format&fit=crop&q=80',
    video: 'https://assets.mixkit.co/videos/preview/mixkit-futuristic-robot-standing-in-a-dark-room-42861-large.mp4',
    prompt: 'Futuristic combat mecha standing in rainy neo-tokyo alleyway, volumetric smoke, cinematic anamorphic lighting, unreal engine 5 render, 8k resolution',
  },
  {
    id: 'cully-hill',
    title: 'THE CULLY HILL BOYS',
    subtitle: 'FIRST AI FEATURE FILM',
    tagline: 'STARRING CELEBRITY CAST',
    image: 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=800&auto=format&fit=crop&q=80',
    video: 'https://assets.mixkit.co/videos/preview/mixkit-close-up-of-a-man-in-the-dark-with-neon-lights-42845-large.mp4',
    isHero: true,
    prompt: 'Cinematic dramatic close up shot of a mysterious detective holding a lighter in shadowy vintage room, 35mm film grain, masterpiece',
  },
  {
    id: 'hell-grind',
    title: 'HELL GRIND',
    subtitle: 'AI SHORT FILM',
    tagline: 'GRITTY THRILLER',
    image: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=800&auto=format&fit=crop&q=80',
    video: 'https://assets.mixkit.co/videos/preview/mixkit-fire-sparks-flying-in-a-dark-room-41920-large.mp4',
    prompt: 'Dark intense action movie scene with red dramatic rim light, gritty underground warehouse, cinema lens flare, slow motion',
  },
]

export const INSPIRATION_PROMPTS = [
  {
    label: 'Tokyo Neon Drone',
    prompt: 'Cinematic drone shot flying through futuristic neon Tokyo at night, wet asphalt reflections, hyperrealistic 4k',
    model: 'seedance_2.5',
    seconds: 10,
    ratio: '16:9'
  },
  {
    label: 'Golden Retriever',
    prompt: 'A cute Golden Retriever puppy running happily in autumn park with falling golden leaves, 4k ultra detailed',
    model: 'seedance_2.5',
    seconds: 5,
    ratio: '16:9'
  },
  {
    label: 'Cyberpunk Girl',
    prompt: 'Portrait of a cyberpunk girl with glowing holographic cyberware looking gently at falling cherry blossom petals in rainy street',
    model: 'seedance_2.5',
    seconds: 10,
    ratio: '9:16'
  },
  {
    label: 'Eagle Mountains',
    prompt: 'A majestic eagle soaring gracefully over dramatic snow-capped alpine mountains in golden hour sunlight',
    model: 'seedance_2.5',
    seconds: 15,
    ratio: '16:9'
  },
  {
    label: 'Futuristic Supercar',
    prompt: 'A sleek futuristic concept supercar speeding on coastal cliff highway at twilight, cinematic camera tracking',
    model: 'seedance_2.5',
    seconds: 10,
    ratio: '16:9'
  },
  {
    label: 'Ultrawide Sci-Fi Movie',
    prompt: 'Epic anamorphic 21:9 ultrawide shot of a massive starship emerging from a hyperspace nebula above a crimson alien planet, cinematic lighting',
    model: 'seedance_2.5',
    seconds: 10,
    ratio: '21:9'
  }
]

export const IMAGE_INSPIRATION_PROMPTS = [
  {
    label: 'Nano Banana Pro Cyber-Dragon',
    prompt: 'Ultra detailed 4K cinematic photo of a mechanical neon cyber dragon coiled around Tokyo tower at midnight, photorealistic, Unreal Engine 5 render',
    model: 'gemini-3-pro-image-preview',
    ratio: '16:9',
  },
  {
    label: 'Nano Banana Ultrawide',
    prompt: 'Breathtaking 16:9 cinematic panorama of a neon cyberpunk metropolis in torrential rain, reflections on wet asphalt, volumetric fog, 4k cinematic',
    model: 'gemini-3-pro-image-preview',
    ratio: '16:9',
  },
  {
    label: 'Pixar Baby Dragon',
    prompt: 'Một chú rồng nhỏ dễ thương phong cách 3D Pixar, nền rừng tuyết lung linh, 8k',
    model: 'gpt-image-2',
    ratio: '1:1',
  },
  {
    label: 'Cyberpunk Neon City',
    prompt: 'Cyberpunk city night view, neon lights, ultra realistic 8k, cinematic lighting',
    model: 'gpt-image-2',
    ratio: '16:9',
  },
  {
    label: 'Flare Golden Sunset',
    prompt: 'Golden hour dramatic sunburst over ocean waves, vibrant glowing lens flare, warm cinematic tones, 8k',
    model: 'gpt-image-2.5-flare',
    ratio: '16:9',
  },
  {
    label: 'Sunburst Portrait',
    prompt: 'Cinematic close-up portrait of a warrior woman with intricate face paint in desert storm, intense dramatic lighting, 8k',
    model: 'gpt-image-2.5-sunburst',
    ratio: '9:16',
  },
  {
    label: 'Nanobanana Art',
    prompt: 'Watercolor oil painting of ancient pagoda on misty mountain peak, cherry blossoms, peaceful aesthetic',
    model: 'gemini-3.1-flash-image-preview',
    ratio: '1:1',
  },
]

