import { useState } from 'react'
import { Sparkles, Copy, Save, Send, ChevronDown, Loader2, Image, Hash, RefreshCw } from 'lucide-react'
import { clsx } from 'clsx'
import { PlatformSelector } from './PlatformBadge'
import { useGenerateContent, useGenerateImagePrompts, useCreatePost } from '../../hooks/useContent'
import type { ContentType, ContentTone, GenerateContentResponse, ImagePrompts } from '../../types'

const CONTENT_TYPES: { value: ContentType; label: string; desc: string }[] = [
  { value: 'caption',          label: 'Caption',          desc: 'Social media caption' },
  { value: 'blog_post',        label: 'Blog Post',        desc: 'Full SEO article' },
  { value: 'ad_copy',          label: 'Ad Copy',          desc: 'Paid advertising copy' },
  { value: 'thread',           label: 'Thread',           desc: 'Twitter/X thread' },
  { value: 'linkedin_article', label: 'LinkedIn Article', desc: 'Long-form post' },
  { value: 'tiktok_script',    label: 'TikTok Script',    desc: 'Video script' },
  { value: 'hashtags',         label: 'Hashtags',         desc: 'Hashtag research' },
]

const TONES: { value: ContentTone; label: string }[] = [
  { value: 'professional',  label: 'Professional' },
  { value: 'casual',        label: 'Casual' },
  { value: 'humorous',      label: 'Humorous' },
  { value: 'inspirational', label: 'Inspirational' },
  { value: 'educational',   label: 'Educational' },
  { value: 'persuasive',    label: 'Persuasive' },
]

export function ContentGenerator() {
  const [contentType, setContentType]     = useState<ContentType>('caption')
  const [platforms, setPlatforms]         = useState<string[]>(['instagram'])
  const [topic, setTopic]                 = useState('')
  const [tone, setTone]                   = useState<ContentTone>('professional')
  const [audience, setAudience]           = useState('')
  const [keywords, setKeywords]           = useState('')
  const [additionalCtx, setAdditionalCtx] = useState('')
  const [result, setResult]               = useState<GenerateContentResponse | null>(null)
  const [imgPrompts, setImgPrompts]       = useState<ImagePrompts | null>(null)
  const [activeTab, setActiveTab]         = useState<'content' | 'hashtags' | 'image'>('content')
  const [copied, setCopied]               = useState(false)
  const [saveSuccess, setSaveSuccess]     = useState(false)

  const generate    = useGenerateContent()
  const genImages   = useGenerateImagePrompts()
  const createPost  = useCreatePost()

  const handleGenerate = async () => {
    if (!topic.trim()) return
    const res = await generate.mutateAsync({
      content_type: contentType,
      topic,
      platforms: platforms as never[],
      tone,
      target_audience: audience || undefined,
      keywords: keywords ? keywords.split(',').map((k) => k.trim()) : [],
      additional_context: additionalCtx || undefined,
      generate_image_prompt: true,
      num_hashtags: 25,
    })
    setResult(res)
    setActiveTab('content')
  }

  const handleGenImages = async () => {
    if (!topic.trim()) return
    const res = await genImages.mutateAsync({ topic, platform: platforms[0] || 'instagram' })
    setImgPrompts(res)
    setActiveTab('image')
  }

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleSave = async () => {
    if (!result) return
    await createPost.mutateAsync({
      title: topic.slice(0, 80),
      content_type: contentType,
      content: result.content,
      platforms: platforms,
      hashtags: result.hashtags,
      image_prompt: result.image_prompt ?? undefined,
      tone,
      topic,
      target_audience: audience || undefined,
    } as never)
    setSaveSuccess(true)
    setTimeout(() => setSaveSuccess(false), 2000)
  }

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
      {/* ── Input Panel ── */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 space-y-5">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-brand-600" />
          <h2 className="font-semibold text-gray-900 dark:text-white">AI Content Generator</h2>
        </div>

        {/* Content Type */}
        <div>
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Content Type</label>
          <div className="grid grid-cols-2 gap-2">
            {CONTENT_TYPES.map(({ value, label, desc }) => (
              <button
                key={value}
                onClick={() => setContentType(value)}
                className={clsx(
                  'text-left p-2.5 rounded-lg border text-sm transition-all',
                  contentType === value
                    ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/20 text-brand-700 dark:text-brand-300'
                    : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                )}
              >
                <div className="font-medium">{label}</div>
                <div className="text-xs text-gray-400 mt-0.5">{desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Platforms */}
        <div>
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Platforms</label>
          <PlatformSelector selected={platforms} onChange={setPlatforms} />
        </div>

        {/* Topic */}
        <div>
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">Topic / Subject *</label>
          <textarea
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="e.g. 5 ways AI is transforming digital marketing in 2025"
            rows={3}
            className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>

        {/* Tone + Audience */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">Tone</label>
            <div className="relative">
              <select
                value={tone}
                onChange={(e) => setTone(e.target.value as ContentTone)}
                className="w-full appearance-none px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500 pr-8"
              >
                {TONES.map(({ value, label }) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-2.5 top-2.5 w-4 h-4 text-gray-400 pointer-events-none" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">Target Audience</label>
            <input
              value={audience}
              onChange={(e) => setAudience(e.target.value)}
              placeholder="e.g. Marketing managers"
              className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
        </div>

        {/* Keywords */}
        <div>
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">Keywords (comma-separated)</label>
          <input
            value={keywords}
            onChange={(e) => setKeywords(e.target.value)}
            placeholder="e.g. AI marketing, automation, ROI"
            className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>

        {/* Additional Context */}
        <div>
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">Additional Context</label>
          <input
            value={additionalCtx}
            onChange={(e) => setAdditionalCtx(e.target.value)}
            placeholder="e.g. Promoting our new AI tool launch..."
            className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <button
            onClick={handleGenerate}
            disabled={!topic.trim() || generate.isPending}
            className="flex-1 flex items-center justify-center gap-2 bg-brand-600 hover:bg-brand-700 disabled:bg-brand-300 text-white font-medium py-2.5 rounded-lg text-sm transition-colors"
          >
            {generate.isPending ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Generating...</>
            ) : (
              <><Sparkles className="w-4 h-4" /> Generate</>
            )}
          </button>
          <button
            onClick={handleGenImages}
            disabled={!topic.trim() || genImages.isPending}
            className="flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium border border-gray-200 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
            title="Generate image prompts"
          >
            {genImages.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Image className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* ── Output Panel ── */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 flex flex-col">
        {/* Tabs */}
        <div className="flex border-b border-gray-100 dark:border-gray-700 px-4">
          {([
            { key: 'content',  label: 'Content',  icon: Sparkles },
            { key: 'hashtags', label: 'Hashtags', icon: Hash },
            { key: 'image',    label: 'Image AI',  icon: Image },
          ] as const).map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={clsx(
                'flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 transition-colors',
                activeTab === key
                  ? 'border-brand-600 text-brand-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
              )}
            >
              <Icon className="w-3.5 h-3.5" />{label}
            </button>
          ))}
        </div>

        <div className="flex-1 p-4 overflow-y-auto">
          {!result && !imgPrompts && (
            <div className="flex flex-col items-center justify-center h-full text-center text-gray-400 py-16">
              <Sparkles className="w-10 h-10 mb-3 opacity-30" />
              <p className="text-sm">Fill in the form and click Generate to create AI-powered content</p>
            </div>
          )}

          {/* Content Tab */}
          {activeTab === 'content' && result && (
            <div className="space-y-3">
              <div className="relative">
                <pre className="whitespace-pre-wrap text-sm text-gray-800 dark:text-gray-200 bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 font-sans leading-relaxed max-h-80 overflow-y-auto">
                  {result.content}
                </pre>
              </div>
              {Object.keys(result.platform_adaptations).length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Platform Adaptations</p>
                  {Object.entries(result.platform_adaptations).map(([platform, text]) => (
                    <details key={platform} className="bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                      <summary className="px-3 py-2 text-xs font-medium text-gray-600 dark:text-gray-300 cursor-pointer capitalize">
                        {platform}
                      </summary>
                      <pre className="px-3 pb-3 text-xs text-gray-700 dark:text-gray-300 whitespace-pre-wrap font-sans">
                        {text}
                      </pre>
                    </details>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Hashtags Tab */}
          {activeTab === 'hashtags' && result && (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                {result.hashtags.map((tag) => (
                  <button
                    key={tag}
                    onClick={() => handleCopy(tag)}
                    className="text-xs px-2.5 py-1 rounded-full bg-brand-50 dark:bg-brand-900/20 text-brand-700 dark:text-brand-300 hover:bg-brand-100 dark:hover:bg-brand-900/40 transition-colors"
                  >
                    {tag}
                  </button>
                ))}
              </div>
              <button
                onClick={() => handleCopy(result.hashtags.join(' '))}
                className="text-xs text-brand-600 hover:underline"
              >
                Copy all hashtags
              </button>
            </div>
          )}

          {/* Image AI Tab */}
          {activeTab === 'image' && imgPrompts && (
            <div className="space-y-3">
              {(Object.entries(imgPrompts) as [keyof ImagePrompts, string][])
                .filter(([k]) => k !== 'style_notes')
                .map(([tool, prompt]) => (
                  <div key={tool} className="space-y-1">
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400 capitalize">{tool}</p>
                    <div className="relative bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
                      <p className="text-xs text-gray-700 dark:text-gray-300 pr-8 leading-relaxed">{prompt}</p>
                      <button
                        onClick={() => handleCopy(prompt)}
                        className="absolute top-2 right-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              {imgPrompts.style_notes && (
                <p className="text-xs text-gray-500 italic">{imgPrompts.style_notes}</p>
              )}
            </div>
          )}
        </div>

        {/* Output Actions */}
        {result && (
          <div className="flex gap-2 p-4 border-t border-gray-100 dark:border-gray-700">
            <button
              onClick={() => handleCopy(
                activeTab === 'hashtags' ? result.hashtags.join(' ') : result.content
              )}
              className={clsx(
                'flex-1 flex items-center justify-center gap-1.5 py-2 text-sm font-medium rounded-lg border transition-all',
                copied
                  ? 'border-green-500 text-green-600 bg-green-50 dark:bg-green-900/20'
                  : 'border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
              )}
            >
              <Copy className="w-4 h-4" />
              {copied ? 'Copied!' : 'Copy'}
            </button>
            <button
              onClick={handleGenerate}
              disabled={generate.isPending}
              className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium border border-gray-200 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              title="Regenerate"
            >
              <RefreshCw className={clsx('w-4 h-4', generate.isPending && 'animate-spin')} />
            </button>
            <button
              onClick={handleSave}
              disabled={createPost.isPending}
              className={clsx(
                'flex-1 flex items-center justify-center gap-1.5 py-2 text-sm font-medium rounded-lg transition-all',
                saveSuccess
                  ? 'bg-green-600 text-white'
                  : 'bg-brand-600 hover:bg-brand-700 text-white'
              )}
            >
              {createPost.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              {saveSuccess ? 'Saved!' : 'Save Draft'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
