const EMOTION_TAG_KEYS = [
  'happy',
  'calm',
  'anxious',
  'achievement',
  'satisfied',
  'worried',
  'expectant',
  'exhausted',
  'touched',
  'angry',
  'sad',
  'excited',
] as const

const EMOTION_TAG_ALIASES: Record<string, string> = {
  joyful: 'happy',
  cheerful: 'happy',
  peaceful: 'calm',
  anxiety: 'anxious',
  concern: 'worried',
  accomplished: 'achievement',
  proud: 'achievement',
  content: 'satisfied',
  hopeful: 'expectant',
  tired: 'exhausted',
  fatigue: 'exhausted',
  moved: 'touched',
  grateful: 'touched',
  thankful: 'touched',
  sorrow: 'sad',
  upset: 'sad',
  furious: 'angry',
  thrilled: 'excited',
}

function normalizeEmotionKey(tag: string): string {
  return tag.trim().toLowerCase().replace(/[_\s-]+/g, '')
}

export function isPresetEmotionKey(tag: string): boolean {
  return (EMOTION_TAG_KEYS as readonly string[]).includes(tag)
}

export function getEmotionDisplayLabel(t: (key: string, options?: any) => string, tag: string): string {
  const raw = (tag || '').trim()
  if (!raw) return raw

  if (isPresetEmotionKey(raw)) {
    return t(`diary.emotion.${raw}`, { defaultValue: raw })
  }

  const normalized = normalizeEmotionKey(raw)
  const mappedKey = EMOTION_TAG_ALIASES[normalized]
  if (mappedKey) {
    return t(`diary.emotion.${mappedKey}`, { defaultValue: raw })
  }

  return raw
}

export { EMOTION_TAG_KEYS }
