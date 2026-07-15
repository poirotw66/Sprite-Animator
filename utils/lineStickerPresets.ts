/**
 * LINE sticker preset data (fonts, text colors, themes, styles, characters,
 * per-language text slots). Pure data extracted from lineStickerPrompt so the
 * prompt-building logic stays focused. Slot shapes are imported type-only, so
 * there is no runtime dependency back on lineStickerPrompt.
 */

import type { ThemeSlot, StyleSlot, CharacterSlot, TextSlot } from './lineStickerPrompt';

// promptDesc: English for image model; label: for UI (e.g. zh-TW)
export const TEXT_COLOR_PRESETS: Record<string, { label: string; promptDesc: string }> = {
    black: { label: '黑色', promptDesc: 'Black #000000' },
    white: { label: '白色', promptDesc: 'White #FFFFFF' },
    darkGray: { label: '深灰', promptDesc: 'Dark gray #333333' },
    navy: { label: '深藍', promptDesc: 'Navy blue #1e3a5f' },
    pink: { label: '粉紅', promptDesc: 'Pink #E84393' },
    teal: { label: '墨綠', promptDesc: 'Teal #1F6F5B' },
    darkRed: { label: '深紅', promptDesc: 'Dark red #8b0000' },
    brown: { label: '棕色', promptDesc: 'Brown #5c4033' },
};

export const FONT_PRESETS: Record<string, { label: string; promptDesc: string }> = {
    matchUploaded: {
        label: '與上傳角色一致',
        promptDesc:
            'On-sticker text typography must be derived from the uploaded reference illustration only — match its line quality, stroke weight, hand-drawn vs geometric vs pixel character, outline treatment, and overall mood. Do not default to a generic sticker font.',
    },
    handwritten: { label: '手寫風格', promptDesc: 'Readable bold hand-written font, thick white outline, high contrast, solid color, sticker vector style' },
    round: { label: '圓體', promptDesc: 'Round soft sticker font, thick strokes, balanced spacing, high contrast, easy to read at small size' },
    bold: { label: '黑體', promptDesc: 'Bold sans-serif sticker font, heavy weight, clear edges, strong contrast, optimized for tiny chat previews' },
    cute: { label: '萌系', promptDesc: 'Chunky playful bubble font, rounded edges, double stroke (white and dark), simple pastel colors, high legibility' },
    pop: { label: '流行體', promptDesc: 'Pop trendy sticker font, bold rhythm, strong stroke contrast, subtle accent only, no busy effects' },
    playful: {
        label: '俏皮圓體',
        promptDesc:
            'Playful rounded sticker font, bouncy rhythm, chunky friendly curves, bold weight, crisp white outline, optimized for chat stickers',
    },
    mochiRound: {
        label: '麻糬圓體',
        promptDesc:
            'Ultra-soft mochi-round sticker font, pillowy curves, gentle bounce, medium-bold weight, friendly and sweet, high legibility at small size',
    },
    bubblePop: {
        label: '泡泡體',
        promptDesc:
            'Cute bubble-pop sticker font, inflated round letters, playful comic energy, bold outline, cheerful and bouncy, chat-sticker readable',
    },
    sweetChalk: {
        label: '甜美粉筆',
        promptDesc:
            'Sweet chalkboard sticker font, soft chalk texture feel, rounded hand-drawn edges, medium weight, cozy cute tone, clear white stroke',
    },
    candyScript: {
        label: '糖果手寫',
        promptDesc:
            'Candy-sweet script sticker font, flowing hand-lettered curves, light-medium weight, romantic cute vibe, reinforced outer stroke for clarity',
    },
    liyushoushu: {
        label: '烈焰手書',
        promptDesc:
            'Liyu Shoushu brush hand-lettered sticker font, flowing Chinese calligraphy strokes, medium weight, clear white outline, high legibility at chat size',
    },
    fashionBitmap16: {
        label: '時尚點陣16',
        promptDesc:
            'Fashion Bitmap 16 pixel sticker font, blocky retro digital glyphs, crisp 16px-style edges, high contrast white outline, readable at LINE chat size',
    },
    kanaka: {
        label: 'Kanaka手寫',
        promptDesc:
            'TEGUSE Kanaka casual handwritten sticker font, friendly rounded Chinese strokes, medium weight, clear white outline, cute and readable at chat size',
    },
    naikai: {
        label: '內海楷書',
        promptDesc:
            'Naikai light kaishu sticker font, gentle regular-script Chinese strokes, clean elegant handwriting feel, reinforced white outline for legibility',
    },
    fluffy: {
        label: '鬆軟圓體',
        promptDesc:
            'Fluffy cloud-like round sticker font, extra-soft corners, chunky sans, bold friendly weight, cozy kawaii feel, optimized for LINE stickers',
    },
    pinkBubble: { label: '粉嫩泡泡風', promptDesc: 'Pink bubble sticker font, thick white and dark outer stroke, soft highlights only, keep glyphs crisp' },
    thinHandwritten: { label: '簡約手繪風', promptDesc: 'Clean minimal hand-drawn sticker font, slightly thin but reinforced with clear outer stroke for readability' },
    kidDoodle: {
        label: '五歲塗鴉',
        promptDesc:
            'Childishly crooked MS Paint mouse-lettering, uneven stroke width, almost-readable clumsy glyphs, thick crude outline, off-kilter spacing, intentionally awkward and low-fi',
    },
    custom: { label: '自訂字體', promptDesc: '' },
};

/** Display order for font dropdown: classic presets first, cute variants grouped, then custom. */
export const FONT_PRESET_ORDER: (keyof typeof FONT_PRESETS)[] = [
    'matchUploaded',
    'handwritten',
    'round',
    'bold',
    'cute',
    'pop',
    'playful',
    'mochiRound',
    'bubblePop',
    'sweetChalk',
    'candyScript',
    'liyushoushu',
    'fashionBitmap16',
    'kanaka',
    'naikai',
    'fluffy',
    'pinkBubble',
    'thinHandwritten',
    'kidDoodle',
    'custom',
];

/** Preset keys for programmatic canvas font (excludes custom and reference-adaptive). */
export const FONT_PRESET_CANVAS_ORDER = FONT_PRESET_ORDER.filter(
    (key) => key !== 'custom' && key !== 'matchUploaded'
);

/** Neutral hand-drawn canvas fallback when font follows the reference image (programmatic overlay only). */
export const MATCH_UPLOADED_CANVAS_FONT_FALLBACK: LineStickerFontKey = 'kanaka';

/** Map UI/prompt font key to a concrete canvas preset (programmatic overlay has no reference vision). */
export function resolveCanvasFontPresetKey(fontKey: LineStickerFontKey): LineStickerFontKey {
    if (fontKey === 'matchUploaded') {
        return MATCH_UPLOADED_CANVAS_FONT_FALLBACK;
    }
    if (fontKey === 'custom') {
        return 'round';
    }
    return fontKey;
}

export type LineStickerFontKey = keyof typeof FONT_PRESETS;

export const DEFAULT_THEME_SLOT: ThemeSlot = {
    chatContext: 'Daily casual chat',
    examplePhrases: ['早安', '晚安', '謝謝', '不客氣', '辛苦了', '加油', '好累', '開心'],
    specialStickers: { description: '角色滿懷期待地看向觀眾', texts: ['KKT', 'KKO'] }
};

// language/textStyle/textColor in prompt = English for image model; label = for UI
export const DEFAULT_TEXT_SLOT: TextSlot = {
    language: 'Traditional Chinese',
    textStyle: FONT_PRESETS.handwritten.promptDesc,
    textColor: TEXT_COLOR_PRESETS.black.promptDesc,
    lengthConstraints: { chinese: '最多 5 個字，宜 2～4 字', english: '最多 3 個單字，宜 1～2 字' }
};

// label: for UI; chatContext: English for image model; examplePhrases: sticker text (any language)
export const THEME_PRESETS: Record<string, ThemeSlot & { label: string }> = {
    daily: {
        label: '日常聊天',
        chatContext: 'Daily casual chat',
        examplePhrases: ['早安', '晚安', '謝謝', '不客氣', '辛苦了', '加油', '好累', '開心', '哈哈', '嗚嗚', '咦？', '嗯嗯', '好啊', '不要啦', '等等我', '想你了'],
        specialStickers: { description: '角色滿懷期待地看向觀眾', texts: ['KKT', 'KKO'] }
    },
    social: {
        label: '社群互動',
        chatContext: 'Social media interaction',
        examplePhrases: ['讚', '推', '分享', '轉發', '收藏', '訂閱', '按讚', '留言', '已讀', '笑死', '太神', '愛了', '必看', '推爆', '跪了', '神作'],
        specialStickers: { description: '角色滿懷期待地看向觀眾', texts: ['KKT', 'KKO'] }
    },
    workplace: {
        label: '職場對話',
        chatContext: 'Workplace communication',
        examplePhrases: ['收到', '了解', '已完成', '進行中', '稍等', '沒問題', '辛苦了', '謝謝', '再確認', '已寄出', '明天見', '開會中', '請稍候', '交給我', 'OK', '請查收'],
        specialStickers: { description: '角色滿懷期待地看向觀眾', texts: ['KKT', 'KKO'] }
    },
    emotion: {
        label: '情緒表現',
        chatContext: 'Strong emotions and expressions',
        examplePhrases: ['暴怒', '崩潰', '大哭', '狂笑', '發呆', '震驚', '翻白眼', '懷疑人生', '心碎', '撒嬌', '生悶氣', '臉紅', '尷尬', '鄙視', '崇拜', '驚嚇'],
        specialStickers: { description: '角色滿臉通紅害羞的樣子', texts: ['(///▽///)', '羞'] }
    },
    meme: {
        label: '迷因梗圖',
        chatContext: 'Internet memes and viral phrases',
        examplePhrases: [
            '真香',
            '全都要',
            '我全都要',
            '我就爛',
            '你各位',
            '是在哈囉',
            '歸剛欸',
            '哭啊',
            '長知識',
            '芭比Q',
            '太狠了',
            '我的超人',
            '計畫通',
            '看戲',
            '母湯喔',
            '不合理',
        ],
        specialStickers: { description: '角色露出經典的「計畫通」表情', texts: ['計畫通', '通靈'] }
    },
    food: {
        label: '美食饕客',
        chatContext: 'Food and dining',
        examplePhrases: [
            '餓了',
            '想吃肉',
            '宵夜',
            '珍奶',
            '好飽',
            '美食',
            '明天再說',
            '外送到了',
            '分我一口',
            '真好吃',
            '好雷',
            '這味道',
            '大受好評',
            '美味',
            '再一碗',
            '熱量炸',
        ],
        specialStickers: { description: '角色幸福地吃著大餐的樣子', texts: ['大滿足', '還要吃'] }
    },
    couple: {
        label: '情侶日常',
        chatContext: 'Couple daily chat — sweet, teasing, missing you, small fights',
        examplePhrases: [
            '想你了',
            '抱抱',
            '晚安',
            '早安',
            '吃醋',
            '哼',
            '對不起',
            '原諒我',
            '約會',
            '等你',
            '好乖',
            '想見你',
            '別生氣',
            '愛你',
            '想你',
            '陪陪我',
        ],
        specialStickers: { description: '角色害羞比心或牽手', texts: ['愛你', '想你'] }
    },
    catSlaves: {
        label: '貓奴日常',
        chatContext: 'Cat owner life — worshipping cats, being ignored, feeding, litter box',
        examplePhrases: [
            '主子',
            '奴才',
            '餵了',
            '不理我',
            '踩我',
            '好可愛',
            '又拆家',
            '鏟屎官',
            '摸摸',
            '睡我床',
            '傲嬌',
            '呼喚',
            '罐罐',
            '貓砂',
            '被嫌',
            '投降',
        ],
        specialStickers: { description: '角色被貓踩在臉上仍一臉幸福', texts: ['主子', '奴才'] }
    }
};

/** Theme key: preset key or 'custom' for user-defined theme. */
export type ThemeOption = keyof typeof THEME_PRESETS | 'custom';

// label: for UI (zh-TW); styleType / drawingMethod: English for image model
export const STYLE_PRESETS: Record<string, { label: string; recommendedFontKey?: LineStickerFontKey } & StyleSlot> = {
    matchUploaded: {
        label: '與上傳角色一致',
        recommendedFontKey: 'matchUploaded',
        styleType: "STRICT: Use only the visual style of the uploaded reference image. Do not apply any other art style, genre, or aesthetic. The reference image defines the only acceptable style.",
        drawingMethod: "Match the reference image exactly: same line weight, same coloring method (flat or shaded), same proportions, same level of detail, same medium (digital, paint, etc.). Do not reinterpret or stylize; preserve the character's existing look. All cells must look like they were drawn in the same style as the reference.",
        outlinePreference: 'style',
    },
    chibi: {
        label: 'Q 版可愛',
        recommendedFontKey: 'playful',
        styleType: "Chibi, 2-head body ratio, LINE sticker art style, versatile for any character type",
        drawingMethod: "Soft hand-drawn, thick clean outlines, soft cell shading",
    },
    pixel: {
        label: '像素藝術',
        recommendedFontKey: 'fashionBitmap16',
        styleType: "16-bit Retro Pixel Art, SNES/GBA style, pixel-perfect",
        drawingMethod: "Precise pixel placement, sharp edges no anti-aliasing, clear grid texture and clean lines",
    },
    minimalist: {
        label: '極簡線條',
        recommendedFontKey: 'round',
        styleType: "Minimalist flat illustration, Kanahei style, cute healing sticker look",
        drawingMethod: "Soft thick outlines, simple flat color fill, dot eyes and soft cheek detail, rounded simplified shapes",
        outlinePreference: 'style',
    },
    anime: {
        label: "日系動漫",
        recommendedFontKey: 'bold',
        styleType: "Modern anime style, cell-shaded, high-quality 2D render",
        drawingMethod: "Clean precise lines, two-tone shadows, detailed eyes and hair highlights",
    },
    cartoon: {
        label: "美式卡通",
        recommendedFontKey: 'pop',
        styleType: "Vibrant cartoon style, strong motion, exaggerated expressions",
        drawingMethod: "Thick dark outlines, saturated color blocks, geometric simplification, commercial illustration feel",
        outlinePreference: 'style',
    },
    watercolor: {
        label: "手繪水彩",
        recommendedFontKey: 'sweetChalk',
        styleType: "Soft watercolor style, healing illustration, natural bleed at edges",
        drawingMethod: "Wet-on-wet technique, hand-drawn brush edges, soft outlines, organic paint flow",
        lightingPreference: 'soft',
    },
    yurukawa: {
        label: "慵懶軟懶風",
        recommendedFontKey: 'fluffy',
        styleType: "Yuru-kawa style, kawaii aesthetic, chibi, Japanese healing and lazy atmosphere, relaxed and lazy vibe, funny expression, suitable for personified characters (tired, lazy, cute)",
        drawingMethod: "Simple line art, marker coloring style, low saturation, simple vector art. Avoid: photorealistic, highly detailed, volumetric lighting, glossy finish, complex background, serious tone.",
    },
    pastel: {
        label: "蠟筆粉彩",
        recommendedFontKey: 'sweetChalk',
        styleType: "Soft pastel and crayon style, dreamy and gentle, kawaii sticker look",
        drawingMethod: "Pastel or wax crayon texture, soft edges, low saturation, rounded shapes, gentle shading",
    },
    flat: {
        label: "扁平時尚",
        recommendedFontKey: 'bold',
        styleType: "Flat design illustration, modern app and icon style, geometric simplification",
        drawingMethod: "Solid flat color blocks, minimal or no gradients, clean vector shapes, no soft shadows",
    },
    doodle: {
        label: "塗鴉手繪",
        recommendedFontKey: 'thinHandwritten',
        styleType: "Casual doodle and sketch style, hand-drawn feel, playful and loose",
        drawingMethod: "Sketchy or marker-like lines, slightly imperfect outlines, simple fills, notebook or memo vibe",
    },
    kidDoodle: {
        label: "五歲塗鴉",
        recommendedFontKey: 'kidDoodle',
        styleType:
            "Create a clumsy kid-doodle rendition: redraw-like awkwardness that is intentionally confused and embarrassing. Use a white background so it looks like it was drawn with a mouse inside an old computer drawing program. It should feel like it almost matches the intended character, but not really—like everything is slightly off. Make it look like low-quality, pixel-by-pixel tracing that feels slow and step-by-step. Exaggerate how ridiculously bad it is while keeping the subject recognizable enough to be “almost right.”",
        drawingMethod:
            "Crude mouse-drag strokes, jagged low-quality pixel edges, uneven fills, shaky outlines, wrong-but-recognizable shapes. Avoid: polished digital art, clean vectors, anime polish, soft painterly beauty, photorealism.",
        outlinePreference: 'style',
    },
    gouache: {
        label: "不透明水彩",
        recommendedFontKey: 'naikai',
        styleType: "Gouache and opaque watercolor style, matte and soft, picture-book illustration feel",
        drawingMethod: "Flat opaque color layers, soft brush edges, minimal blending",
        lightingPreference: 'soft',
    },
    lineChibi: {
        label: "日系貼圖暖色",
        recommendedFontKey: 'mochiRound',
        styleType: "Cute chibi character in Japanese LINE sticker style, suitable for animals and mascots. Hand-drawn digital illustration with thick dark outlines and flat colors. Round, squishy body, tiny paws, minimalist expressive facial expressions.",
        drawingMethod: "High contrast, minimalist and cozy aesthetic. Isolated character, clean and readable for stickers. Avoid: photorealistic, complex shading, busy details.",
        outlinePreference: 'style',
    },

    // --- Japanese anime/manga style prompts adapted from:
    // https://home.gamer.com.tw/artwork.php?sn=6211319
    studioGhibli: {
        label: '吉卜力工作室',
        recommendedFontKey: 'naikai',
        styleType: 'Studio Ghibli Style: hand-painted feel, warm colors, expressive characters, pastoral fantasy nostalgia',
        drawingMethod: 'Soft hand-drawn linework, gentle light and shadow, watercolor-like soft fills, warm natural palette. Avoid: harsh neon, heavy cel lines, photoreal CGI.',
        lightingPreference: 'soft',
        outlinePreference: 'style',
    },
    akiraToriyama: {
        label: '鳥山明',
        recommendedFontKey: 'bold',
        styleType: 'Akira Toriyama Style: clean powerful lines, balance between chibi and semi-realistic, chunky forms, high-saturation early Dragon Ball energy',
        drawingMethod: 'Clear thick outlines, blocky muscle and prop shapes, saturated flats, dynamic action-readable poses. Avoid: soft painterly blur, ultra-detail filigree.',
        outlinePreference: 'style',
    },
    eiichiroOda: {
        label: '尾田榮一郎',
        recommendedFontKey: 'pop',
        styleType: 'Eiichiro Oda Style: exaggerated proportions and faces, wild imagination, dense playful detail, energetic adventure vibe',
        drawingMethod: 'Bold lively outlines, stretched cartoon anatomy, busy but readable sticker silhouettes, high-energy expressions. Avoid: quiet minimalism, realistic proportions.',
        outlinePreference: 'style',
    },
    makotoShinkai: {
        label: '新海誠',
        recommendedFontKey: 'round',
        styleType: 'Makoto Shinkai Style: refined anime characters, luminous high-saturation colors, emotional micro-expression focus',
        drawingMethod: 'Clean precise lines, translucent saturated color, soft volumetric light accents on hair and skin. Keep subject isolated for stickers; no busy cityscape background. Avoid: muddy tones, crude doodles.',
        lightingPreference: 'soft',
    },
    clamp: {
        label: 'CLAMP',
        recommendedFontKey: 'handwritten',
        styleType: 'CLAMP Style: elegant slender figures, decorative costumes, flowing hair, romantic shojo fantasy atmosphere',
        drawingMethod: 'Fine decorative linework, elongated proportions, ornate costume detail kept readable at sticker size, soft romantic shading. Avoid: chunky gag manga exaggeration.',
        outlinePreference: 'style',
        lightingPreference: 'soft',
    },
    hirohikoAraki: {
        label: '荒木飛呂彥',
        recommendedFontKey: 'bold',
        styleType: 'Hirohiko Araki Style: dramatic JoJo-like poses, bold fashion-forward costumes, sharp facial planes, striking color blocking',
        drawingMethod: 'Hard elegant contours, stylish angular faces, high-contrast fashion color blocks, pose-driven composition. Avoid: cute chibi squash, soft pastel wash.',
        outlinePreference: 'style',
    },
    takehikoInoue: {
        label: '井上雄彥',
        recommendedFontKey: 'thinHandwritten',
        styleType: 'Takehiko Inoue Style: realist draftsmanship, strong brush-pen stroke, precise anatomy and motion, emotional faces, smart negative space',
        drawingMethod: 'Ink brush / dip-pen stroke feel, realistic body structure, expressive eyes and micro-muscles, restrained color or muted washes. Avoid: flat kawaii icon look.',
        outlinePreference: 'style',
        lightingPreference: 'soft',
    },
    kyotoAnimation: {
        label: '京都動畫',
        recommendedFontKey: 'round',
        styleType: 'Kyoto Animation Style: polished character acting, soft color, subtle everyday gesture, nuanced eyes and micro-expressions, airy atmosphere',
        drawingMethod: 'Clean soft anime line, gentle cel shading, careful eye highlight and mouth nuance. Isolated character, sticker-readable. Avoid: rough sketchy lines, extreme SD distortion.',
        lightingPreference: 'soft',
    },
    ufotable: {
        label: 'ufotable',
        recommendedFontKey: 'bold',
        styleType: 'ufotable Style: cinematic digital animation look, ornate particle and light FX, fluid impactful action, 2D/3D blend feel',
        drawingMethod: 'Crisp digital line, vivid light streaks and particle accents around the subject only, high clarity action silhouette. Avoid: dull flat fill with no light accents.',
        lightingPreference: 'soft',
    },
    trigger: {
        label: 'TRIGGER',
        recommendedFontKey: 'pop',
        styleType: 'TRIGGER Style: extreme motion and squash-stretch, vivid color contrast, rugged lines, imaginative designs, hype kinetic rhythm',
        drawingMethod: 'Bold rugged outlines, exaggerated motion deformation, high-contrast saturated colors, punchy silhouettes. Avoid: quiet watercolor softness.',
        outlinePreference: 'style',
    },
    kentaroMiura: {
        label: '三浦建太郎',
        recommendedFontKey: 'bold',
        styleType: 'Kentaro Miura Style: dark epic aesthetic, ultra-detailed armor and forms, heavy volume and weight, intense character presence',
        drawingMethod: 'Dense hatch / intricate detail on armor and cloth, strong light-dark volume, grim sharp faces; simplify tiny stickers so silhouette still reads. Avoid: pastel cute, soft glow kawaii.',
        outlinePreference: 'style',
    },
    rumikoTakahashi: {
        label: '高橋留美子',
        recommendedFontKey: 'playful',
        styleType: 'Rumiko Takahashi Style: round faces and big eyes, lively gag expressions, everyday-fantasy mix, crisp clean lines',
        drawingMethod: 'Clean rounded manga line, big expressive eyes, comedy face charts readable as stickers, fresh light color fills. Avoid: dark heavy crosshatch.',
        outlinePreference: 'style',
    },
    osamuTezuka: {
        label: '手塚治虫',
        recommendedFontKey: 'round',
        styleType: 'Osamu Tezuka Style: foundational Japanese manga/anime look, simple curves, iconic large eyes, symbolic expressive acting',
        drawingMethod: 'Simple curved outlines, large circular eyes, iconic simplified shapes, clear pose symbols. Avoid: hyper-detail modern seinen rendering.',
        outlinePreference: 'style',
    },
    katsuhiroOtomo: {
        label: '大友克洋',
        recommendedFontKey: 'bold',
        styleType: 'Katsuhiro Otomo Style: realistic proportions, high-density mechanical and urban detail language, hard-SF cinematic framing',
        drawingMethod: 'Precise mechanical line, realistic anatomy, controlled hatching for volume; for stickers emphasize readable figure over full cityscapes. Avoid: soft cute chibi.',
        outlinePreference: 'style',
    },
    taiyoMatsumoto: {
        label: '松本大洋',
        recommendedFontKey: 'thinHandwritten',
        styleType: 'Taiyo Matsumoto Style: free twisted or naive lines, strong perspective warp, surreal composition, high emotional tension',
        drawingMethod: 'Loose warped sketch lines, odd perspective on limbs/head, raw emotional faces, limited muddy palette optional. Avoid: commercial clean vector anime.',
        outlinePreference: 'style',
    },
    yoshitakaAmano: {
        label: '天野喜孝',
        recommendedFontKey: 'handwritten',
        styleType: 'Yoshitaka Amano Style: ethereal dreamlike fantasy, calligraphy-like flowing lines, ornate decoration, slender elegant figures',
        drawingMethod: 'Fluid calligraphic strokes, delicate ornamental detail, soft watercolor/pastel washes, elegant thin silhouettes. Avoid: thick gag cartoon outlines.',
        lightingPreference: 'soft',
        outlinePreference: 'style',
    },
    tsutomuNihei: {
        label: '弐瓶勉',
        recommendedFontKey: 'bold',
        styleType: 'Tsutomu Nihei Style: vast cold megastructures vibe, post-apocalyptic bleakness, biomechanical design, minimal faces, stark B/W contrast, hard sci-fi',
        drawingMethod: 'Heavy black-white contrast, industrial biomechanic forms, sparse facial detail, bold graphic blacks. Avoid: bright kawaii pastel.',
        outlinePreference: 'style',
    },
    masamuneShirow: {
        label: '士郎正宗',
        recommendedFontKey: 'bold',
        styleType: 'Masamune Shirow Style: precise mecha design language, strong athletic characters, cyberpunk aesthetic, clean technical line',
        drawingMethod: 'Clean technical outlines, detailed but readable mech/armor bits, sleek cyberpunk color blocks. Avoid: messy sketch scribble, soft watercolor bleed.',
        outlinePreference: 'style',
    },
    mamoruNagano: {
        label: '永野護',
        recommendedFontKey: 'handwritten',
        styleType: 'Mamoru Nagano Style: extremely elongated slender figures and mecha, ornate gothic + art-deco fusion, complex elegant design',
        drawingMethod: 'Ultra-slender proportions, ornate filigree on suits/armor kept semi-simplified for stickers, gothic-decorative line. Avoid: short chibi proportions.',
        outlinePreference: 'style',
    },
    shinichiroWatanabe: {
        label: '渡邊信一郎',
        recommendedFontKey: 'pop',
        styleType: 'Shinichiro Watanabe works vibe: stylized realism, cinematic cool, music-driven mood (jazz/hip-hop attitude), mature atmosphere, fluid action',
        drawingMethod: 'Stylish semi-realistic character design, cinematic posing, muted cool palette with sharp accent colors, sleek motion-readable silhouettes. Avoid: pure SD kawaii.',
        outlinePreference: 'style',
    },
    masaakiYuasa: {
        label: '湯淺政明',
        recommendedFontKey: 'pop',
        styleType: 'Masaaki Yuasa Style: wildly free lines and morphing, vivid or weird color combos, unconventional perspective, stream-of-consciousness visuals',
        drawingMethod: 'Elastic deforming outlines, bold unexpected colors, skewed perspective on face/body, energetic experimental cartooning. Avoid: stiff realistic anime.',
        outlinePreference: 'style',
    },
    posukaDemizu: {
        label: '出水ぽすか',
        recommendedFontKey: 'sweetChalk',
        styleType: 'Posuka Demizu Style: dense fantasy illustration, delicate props and background motifs, rich expressions with a slight uneasy fairy-tale darkness',
        drawingMethod: 'Fine detailed fantasy line, ornate small props near subject, expressive slightly uneasy eyes, fairy-tale color; keep chroma field clear of full scenic backgrounds. Avoid: ultra-flat icon stickers.',
        outlinePreference: 'style',
        lightingPreference: 'soft',
    },
    yoshiyukiSadamoto: {
        label: '貞本義行',
        recommendedFontKey: 'round',
        styleType: 'Yoshiyuki Sadamoto Style: slender fashionable character design, slightly melancholic eyes, clean lines, soft color, careful clothing material read',
        drawingMethod: 'Clean refined anime contours, elongated fashionable figures, soft muted colors, subtle fabric folds. Avoid: rough gag deformation.',
        lightingPreference: 'soft',
    },
    yusukeMurata: {
        label: '村田雄介',
        recommendedFontKey: 'bold',
        styleType: 'Yusuke Murata Style: elite draftsmanship, ultra-fluid dynamic action, razor-clean lines, packed but clear composition, precise perspective',
        drawingMethod: 'Very clean decisive outlines, dynamic foreshortening, crisp impact poses, controlled detail density for sticker scale. Avoid: soft crayon texture, shaky doodle lines.',
        outlinePreference: 'style',
    },
    sumiE: {
        label: '水墨墨繪',
        recommendedFontKey: 'naikai',
        styleType: 'Sumi-e / Ink Wash Style: traditional ink-wash brush feel, ink value contrast, expressive empty space, East-Asian literati mood',
        drawingMethod: 'Ink brush strokes with wet blooms and dry brush, limited ink grayscale (optional soft color wash), clever negative space. Avoid: thick Western comic inks, neon flat cel.',
        lightingPreference: 'soft',
        outlinePreference: 'style',
    },
};

/** Default sticker caption font for an art-style preset (unless the job explicitly sets fontKey). */
export function resolveFontKeyForStyle(
    styleKey?: string,
    explicitFontKey?: LineStickerFontKey
): LineStickerFontKey {
    if (explicitFontKey) {
        return explicitFontKey;
    }
    const key =
        styleKey && styleKey !== 'custom' && styleKey in STYLE_PRESETS ? styleKey : 'matchUploaded';
    const preset = STYLE_PRESETS[key as keyof typeof STYLE_PRESETS];
    return preset.recommendedFontKey ?? 'round';
}

/** Style key: preset key or 'custom' for user-defined style. */
export type LineStickerStyleOption = keyof typeof STYLE_PRESETS | 'custom';

/** Display order for style dropdown: recommended and LINE-friendly first, then variety. */
export const STYLE_PRESET_ORDER: (keyof typeof STYLE_PRESETS)[] = [
    'matchUploaded',
    'chibi',
    'lineChibi',
    'minimalist',
    'yurukawa',
    'anime',
    'watercolor',
    'pastel',
    'cartoon',
    'flat',
    'doodle',
    'kidDoodle',
    'gouache',
    'pixel',
    // Japanese artist / studio styles (https://home.gamer.com.tw/artwork.php?sn=6211319)
    'studioGhibli',
    'akiraToriyama',
    'eiichiroOda',
    'makotoShinkai',
    'clamp',
    'hirohikoAraki',
    'takehikoInoue',
    'kyotoAnimation',
    'ufotable',
    'trigger',
    'kentaroMiura',
    'rumikoTakahashi',
    'osamuTezuka',
    'katsuhiroOtomo',
    'taiyoMatsumoto',
    'yoshitakaAmano',
    'tsutomuNihei',
    'masamuneShirow',
    'mamoruNagano',
    'shinichiroWatanabe',
    'masaakiYuasa',
    'posukaDemizu',
    'yoshiyukiSadamoto',
    'yusukeMurata',
    'sumiE',
];

// label: for UI; appearance / personality: English for image model
export const CHARACTER_PRESETS: Record<string, { label: string; appearance: string; personality: string }> = {
    cute: {
        label: '可愛萌系 (Default)',
        appearance: 'Round cute character, approachable, big eyes and soft blush',
        personality: 'Gentle, shy, healing'
    },
    funny: {
        label: '搞怪幽默 (Meme Style)',
        appearance: 'Exaggerated poses, funny expressions, meme-like energy',
        personality: 'Humorous, quirky, unpredictable'
    },
    cool: {
        label: '酷帥型格 (Cool)',
        appearance: 'Sharp lines, sharp eyes, cool handsome look',
        personality: 'Confident, calm, deep'
    },
    energetic: {
        label: '陽光活力 (Energetic)',
        appearance: 'Dynamic, bright colors, full of energy',
        personality: 'Passionate, positive, sunny'
    },
    healing: {
        label: '軟萌療癒 (Healing)',
        appearance: 'Soft minimal lines, marshmallow-like feel, gentle shape',
        personality: 'Quiet, gentle, healing'
    },
    elegant: {
        label: '優雅氣質 (Elegant)',
        appearance: 'Refined elegant look, slender flowing lines, graceful pose',
        personality: 'Intellectual, elegant, gentle'
    }
};

export const DEFAULT_CHARACTER_SLOT: CharacterSlot = {
    originalImageRules: 'Draw exactly the subject(s) and visual style from the reference image. If the reference has multiple characters, include all of them in every cell with the same composition. Do not reduce to one character. Layout follows the sticker grid (one composition per cell).',
};

export const TEXT_PRESETS: Record<string, TextSlot & { label: string }> = {
    'zh-TW': { ...DEFAULT_TEXT_SLOT, label: '繁體中文' },
    'zh-CN': {
        label: '简体中文',
        language: 'Simplified Chinese',
        textStyle: FONT_PRESETS.handwritten.promptDesc,
        textColor: TEXT_COLOR_PRESETS.black.promptDesc,
        lengthConstraints: { chinese: '最多 5 個字，宜 2～4 字', english: '最多 3 個單字，宜 1～2 字' }
    },
    en: {
        label: 'English',
        language: 'English',
        textStyle: 'Hand-written style font',
        textColor: TEXT_COLOR_PRESETS.black.promptDesc,
        lengthConstraints: { chinese: '最多 5 個字，宜 2～4 字', english: '最多 3 個單字，宜 1～2 字' }
    },
    ja: {
        label: '日本語',
        language: 'Japanese',
        textStyle: 'Hand-written style font',
        textColor: TEXT_COLOR_PRESETS.black.promptDesc,
        lengthConstraints: { chinese: '最多 5 個字，宜 2～4 字', english: '最多 3 個單字，宜 1～2 字' }
    }
};
