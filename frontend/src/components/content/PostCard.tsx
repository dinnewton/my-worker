import { useState } from 'react'
import { format } from 'date-fns'
import { Send, Trash2, Edit3, Clock, CheckCircle, XCircle, Loader2, Calendar } from 'lucide-react'
import { clsx } from 'clsx'
import { PlatformBadge } from './PlatformBadge'
import { usePublishPost, useDeletePost } from '../../hooks/useContent'
import type { ContentPost, PostStatus } from '../../types'

const STATUS_CONFIG: Record<PostStatus, { label: string; color: string; icon: React.ElementType }> = {
  draft:      { label: 'Draft',      color: 'text-gray-500',  icon: Edit3 },
  scheduled:  { label: 'Scheduled',  color: 'text-yellow-600',icon: Clock },
  publishing: { label: 'Publishing', color: 'text-blue-600',  icon: Loader2 },
  published:  { label: 'Published',  color: 'text-green-600', icon: CheckCircle },
  failed:     { label: 'Failed',     color: 'text-red-600',   icon: XCircle },
}

const TYPE_LABEL: Record<string, string> = {
  caption:          'Caption',
  blog_post:        'Blog Post',
  ad_copy:          'Ad Copy',
  thread:           'Thread',
  linkedin_article: 'LinkedIn',
  tiktok_script:    'TikTok Script',
  hashtags:         'Hashtags',
  image_prompt:     'Image Prompt',
}

interface PostCardProps {
  post: ContentPost
  onEdit?: (post: ContentPost) => void
}

export function PostCard({ post, onEdit }: PostCardProps) {
  const [confirmDelete, setConfirmDelete] = useState(false)
  const publishPost = usePublishPost()
  const deletePost = useDeletePost()

  const statusCfg = STATUS_CONFIG[post.status]
  const StatusIcon = statusCfg.icon
  const platforms: string[] = JSON.parse(post.platforms || '[]')
  const hashtags: string[] = post.hashtags ? JSON.parse(post.hashtags) : []

  const engagement = post.likes + post.comments + post.shares

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 hover:shadow-md transition-shadow">
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{post.title}</p>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span className="text-[11px] px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 rounded-full">
              {TYPE_LABEL[post.content_type] ?? post.content_type}
            </span>
            <span className={clsx('flex items-center gap-1 text-[11px] font-medium', statusCfg.color)}>
              <StatusIcon className={clsx('w-3 h-3', post.status === 'publishing' && 'animate-spin')} />
              {statusCfg.label}
            </span>
          </div>
        </div>
      </div>

      {/* Platforms */}
      <div className="flex flex-wrap gap-1 mb-3">
        {platforms.map((p) => <PlatformBadge key={p} platform={p} size="sm" showDot />)}
      </div>

      {/* Content Preview */}
      <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-3 leading-relaxed mb-3">
        {post.content}
      </p>

      {/* Hashtags preview */}
      {hashtags.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-3">
          {hashtags.slice(0, 5).map((tag) => (
            <span key={tag} className="text-[10px] text-brand-600 dark:text-brand-400">
              {tag}
            </span>
          ))}
          {hashtags.length > 5 && (
            <span className="text-[10px] text-gray-400">+{hashtags.length - 5}</span>
          )}
        </div>
      )}

      {/* Scheduling / Analytics */}
      <div className="flex items-center justify-between text-[11px] text-gray-400 mb-3">
        <span className="flex items-center gap-1">
          <Calendar className="w-3 h-3" />
          {post.scheduled_at
            ? `Scheduled: ${format(new Date(post.scheduled_at), 'MMM d, h:mm a')}`
            : post.published_at
            ? `Published: ${format(new Date(post.published_at), 'MMM d, h:mm a')}`
            : `Created: ${format(new Date(post.created_at), 'MMM d')}`
          }
        </span>
        {post.status === 'published' && engagement > 0 && (
          <span className="text-green-600">
            ♥ {post.likes} · 💬 {post.comments} · ↗ {post.shares}
          </span>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-2 pt-3 border-t border-gray-100 dark:border-gray-700">
        {(post.status === 'draft' || post.status === 'scheduled' || post.status === 'failed') && (
          <button
            onClick={() => publishPost.mutate(post.id)}
            disabled={publishPost.isPending}
            className="flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium bg-brand-600 hover:bg-brand-700 text-white rounded-lg transition-colors disabled:opacity-60"
          >
            {publishPost.isPending ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Send className="w-3.5 h-3.5" />
            )}
            Publish Now
          </button>
        )}
        {onEdit && (
          <button
            onClick={() => onEdit(post)}
            className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            <Edit3 className="w-3.5 h-3.5" /> Edit
          </button>
        )}
        {!confirmDelete ? (
          <button
            onClick={() => setConfirmDelete(true)}
            className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        ) : (
          <div className="flex gap-1">
            <button
              onClick={() => deletePost.mutate(post.id)}
              className="px-2 py-1.5 text-[11px] font-medium bg-red-600 text-white rounded-lg hover:bg-red-700"
            >
              Delete
            </button>
            <button
              onClick={() => setConfirmDelete(false)}
              className="px-2 py-1.5 text-[11px] text-gray-500 border border-gray-200 dark:border-gray-600 rounded-lg"
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
