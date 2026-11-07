// ============================================================================
// Ảnh: Seedance Creation Bot API (https://api.seedancecreationbot.online/docs)
// Ảnh:   8 model (xem bảng giá trong /guide), ratio 1:1, 16:9, 9:16, 4:3, 3:4, 3:2, 2:3, tối đa 6 ảnh tham chiếu.
// Giá thật theo từng tài khoản: GET /v1/prices (cần API key).
// ============================================================================

// Video: Xianfeng API (仙凤API) — https://xianfengapi.xyz/docs
//   Hai model Seedance 2.5 (720p, 4–30 giây; 5–30 khi trên 9 ảnh; tối đa 30 ảnh tham chiếu; tính tiền theo video, CNY).
//   Giá ghi trong tag là giá trên trang model lúc cập nhật; giá thật theo key xem bằng GET /v1/models.
const XIANFENG_SEEDANCE_COMMON = {
  durationRange: [4, 30],
  durations: [5, 10, 15, 20, 25, 30],
  defaultDuration: 5,
  supportedRatios: ['16:9', '9:16', '1:1', '4:3', '3:4', '21:9'],
  defaultRatio: '16:9',
  supportedResolutions: ['720p'],
  defaultResolution: '720p',
  supportsImageToVideo: true,
  maxReferenceImages: 30,
  // Tài liệu khuyên hỏi trạng thái mỗi 15–30 giây
  pollIntervalMs: 15000,
  maxWaitMs: 2 * 60 * 60 * 1000,
}

export const VIDEO_MODELS = [
  {
    ...XIANFENG_SEEDANCE_COMMON,
    // Mục "seedance-2.5 · 全参考视频": ảnh gửi dạng chuỗi link, prompt gọi ảnh bằng 图片1, tỉ lệ bằng aspect_ratio
    id: 'seedance-2.5',
    name: 'Seedance 2.5',
    tag: '5,6 ¥/video',
    description: 'seedance-2.5 · 720p · 4–30 giây · tối đa 30 ảnh tham chiếu',
    apiStyle: { imageTag: '图片', imagesAsObjects: false, ratioField: 'aspect_ratio' },
  },
  {
    ...XIANFENG_SEEDANCE_COMMON,
    // Mục "JD2.5满参 · 全参考视频": ảnh gửi dạng {"url"}, prompt gọi ảnh bằng @图片1, tỉ lệ bằng ratio,
    // không gửi seconds thì mặc định 30 giây (web luôn gửi seconds)
    id: 'JD2.5满参',
    name: 'Seedance 2.5 · JD满参',
    tag: '4,3 ¥/video',
    description: 'JD2.5满参 · 720p · 4–30 giây · tối đa 30 ảnh tham chiếu · rẻ hơn',
    apiStyle: { imageTag: '@图片', imagesAsObjects: true, ratioField: 'ratio' },
  },
]

export const IMAGE_MODELS = [
  { id: 'GPT Image 2.5', name: 'GPT Image 2.5', tag: '700đ/ảnh', description: 'Model mặc định, đa năng, hỗ trợ ảnh tham chiếu' },
  { id: 'Seedream 5.0', name: 'Seedream 5.0', tag: '500đ/ảnh', description: 'ByteDance Seedream 5.0' },
  { id: 'Seedream 5.0 Pro', name: 'Seedream 5.0 Pro', tag: '900đ/ảnh', description: 'ByteDance Seedream 5.0 Pro, chi tiết cao' },
  { id: 'Seedream 4.0S', name: 'Seedream 4.0S', tag: '400đ/ảnh', description: 'Rẻ nhất' },
  { id: 'Nano Banana Pro', name: 'Nano Banana Pro', tag: '1.000đ/ảnh', description: 'Google Nano Banana Pro' },
  { id: 'Nano Banana 2.1', name: 'Nano Banana 2.1', tag: '700đ/ảnh', description: 'Google Nano Banana 2.1' },
  { id: 'Nano Banana 2', name: 'Nano Banana 2', tag: '800đ/ảnh', description: 'Google Nano Banana 2' },
  { id: 'GPT Image 2', name: 'GPT Image 2', tag: '1.100đ/ảnh', description: 'OpenAI GPT Image 2' },
].map(m => ({ ...m, supportsReference: true, maxReferenceImages: 6, supportedResolutions: [] }))

export const MODELS = VIDEO_MODELS

// Chỉ dùng các size có trong tài liệu (mục 8.2). Các tỉ lệ 1:1, 3:4, 4:3, 21:9 chỉ có 1 size.
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
      '720p': '768x1024',
      '1080p': '768x1024',
    },
  },
  {
    id: '4:3',
    label: '4:3',
    desc: 'Ngang kinh điển 4:3',
    shape: 'landscape-compact',
    col: 'left',
    resolutions: {
      '720p': '1024x768',
      '1080p': '1024x768',
    },
  },
  {
    id: '1:1',
    label: '1:1',
    desc: 'Vuông 1:1',
    shape: 'square',
    col: 'right',
    resolutions: {
      '720p': '1024x1024',
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
      '1080p': '1680x720',
    },
  },
]

export const IMAGE_ASPECT_RATIOS = [
  { id: '16:9', label: '16:9', desc: 'Ngang chuẩn 16:9 YouTube/PC', shape: 'landscape-wide' },
  { id: '9:16', label: '9:16', desc: 'Dọc TikTok, Reels, Shorts', shape: 'tall' },
  { id: '1:1', label: '1:1', desc: 'Vuông Instagram 1:1', shape: 'square' },
  { id: '4:3', label: '4:3', desc: 'Ngang 4:3', shape: 'landscape-compact' },
  { id: '3:4', label: '3:4', desc: 'Dọc 3:4', shape: 'portrait-compact' },
]

export const VIDEO_RESOLUTIONS = [
  { id: '480p', label: '480p', desc: 'Tiết kiệm chi phí' },
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
    model: 'seedance-2.5',
    seconds: 10,
    ratio: '16:9'
  },
  {
    label: 'Golden Retriever',
    prompt: 'A cute Golden Retriever puppy running happily in autumn park with falling golden leaves, 4k ultra detailed',
    model: 'seedance-2.5',
    seconds: 5,
    ratio: '16:9'
  },
  {
    label: 'Cyberpunk Girl',
    prompt: 'Portrait of a cyberpunk girl with glowing holographic cyberware looking gently at falling cherry blossom petals in rainy street',
    model: 'seedance-2.5',
    seconds: 10,
    ratio: '9:16'
  },
  {
    label: 'Eagle Mountains',
    prompt: 'A majestic eagle soaring gracefully over dramatic snow-capped alpine mountains in golden hour sunlight',
    model: 'seedance-2.5',
    seconds: 15,
    ratio: '16:9'
  },
  {
    label: 'Futuristic Supercar',
    prompt: 'A sleek futuristic concept supercar speeding on coastal cliff highway at twilight, cinematic camera tracking',
    model: 'seedance-2.5',
    seconds: 10,
    ratio: '16:9'
  },
  {
    label: 'Sci-Fi Movie',
    prompt: 'Epic anamorphic widescreen shot of a massive starship emerging from a hyperspace nebula above a crimson alien planet, cinematic lighting',
    model: 'seedance-2.5',
    seconds: 10,
    ratio: '16:9'
  }
]

export const IMAGE_INSPIRATION_PROMPTS = [
  {
    label: 'Nano Banana Pro Cyber-Dragon',
    prompt: 'Ultra detailed 4K cinematic photo of a mechanical neon cyber dragon coiled around Tokyo tower at midnight, photorealistic, Unreal Engine 5 render',
    model: 'Nano Banana Pro',
    ratio: '16:9',
  },
  {
    label: 'Nano Banana Ultrawide',
    prompt: 'Breathtaking 16:9 cinematic panorama of a neon cyberpunk metropolis in torrential rain, reflections on wet asphalt, volumetric fog, 4k cinematic',
    model: 'Nano Banana Pro',
    ratio: '16:9',
  },
  {
    label: 'Pixar Baby Dragon',
    prompt: 'Một chú rồng nhỏ dễ thương phong cách 3D Pixar, nền rừng tuyết lung linh, 8k',
    model: 'GPT Image 2.5',
    ratio: '1:1',
  },
  {
    label: 'Cyberpunk Neon City',
    prompt: 'Cyberpunk city night view, neon lights, ultra realistic 8k, cinematic lighting',
    model: 'GPT Image 2.5',
    ratio: '16:9',
  },
  {
    label: 'Golden Sunset',
    prompt: 'Golden hour dramatic sunburst over ocean waves, vibrant glowing lens flare, warm cinematic tones, 8k',
    model: 'Seedream 5.0',
    ratio: '16:9',
  },
  {
    label: 'Warrior Portrait',
    prompt: 'Cinematic close-up portrait of a warrior woman with intricate face paint in desert storm, intense dramatic lighting, 8k',
    model: 'Seedream 5.0 Pro',
    ratio: '9:16',
  },
  {
    label: 'Watercolor Pagoda',
    prompt: 'Watercolor oil painting of ancient pagoda on misty mountain peak, cherry blossoms, peaceful aesthetic',
    model: 'Nano Banana 2.1',
    ratio: '1:1',
  },
]

