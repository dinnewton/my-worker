import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import type {
  ContentPost, GenerateContentRequest, GenerateContentResponse,
  ContentAnalyticsSummary, CalendarData, ImagePrompts,
} from '../types'

const BASE = '/api/v1/content'

export function useContentPosts(status?: string, platform?: string) {
  return useQuery<ContentPost[]>({
    queryKey: ['content-posts', status, platform],
    queryFn: async () => {
      const { data } = await axios.get<ContentPost[]>(`${BASE}/posts`, {
        params: { status, platform, limit: 100 },
      })
      return data
    },
    staleTime: 30_000,
  })
}

export function useContentPost(id: number) {
  return useQuery<ContentPost>({
    queryKey: ['content-post', id],
    queryFn: async () => {
      const { data } = await axios.get<ContentPost>(`${BASE}/posts/${id}`)
      return data
    },
    enabled: id > 0,
  })
}

export function useGenerateContent() {
  return useMutation<GenerateContentResponse, Error, GenerateContentRequest>({
    mutationFn: async (req) => {
      const { data } = await axios.post<GenerateContentResponse>(`${BASE}/generate`, req)
      return data
    },
  })
}

export function useGenerateImagePrompts() {
  return useMutation<ImagePrompts, Error, { topic: string; platform: string; style?: string; mood?: string }>({
    mutationFn: async (req) => {
      const { data } = await axios.post<ImagePrompts>(`${BASE}/generate/image-prompt`, req)
      return data
    },
  })
}

export function useCreatePost() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: Partial<ContentPost> & { platforms: string[] }) => {
      const { data } = await axios.post<ContentPost>(`${BASE}/posts`, payload)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['content-posts'] }),
  })
}

export function useUpdatePost() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...payload }: { id: number } & Partial<ContentPost>) => {
      const { data } = await axios.patch<ContentPost>(`${BASE}/posts/${id}`, payload)
      return data
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['content-posts'] })
      qc.invalidateQueries({ queryKey: ['content-post', vars.id] })
    },
  })
}

export function useDeletePost() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: number) => {
      await axios.delete(`${BASE}/posts/${id}`)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['content-posts'] }),
  })
}

export function usePublishPost() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: number) => {
      const { data } = await axios.post(`${BASE}/posts/${id}/publish`)
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['content-posts'] })
      qc.invalidateQueries({ queryKey: ['kpis'] })
    },
  })
}

export function useSchedulePost() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, scheduled_at, platforms }: { id: number; scheduled_at: string; platforms?: string[] }) => {
      const { data } = await axios.post(`${BASE}/posts/${id}/schedule`, { post_id: id, scheduled_at, platforms })
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['content-posts'] }),
  })
}

export function useContentCalendar(year: number, month: number) {
  return useQuery<CalendarData>({
    queryKey: ['content-calendar', year, month],
    queryFn: async () => {
      const { data } = await axios.get<CalendarData>(`${BASE}/calendar`, { params: { year, month } })
      return data
    },
    staleTime: 60_000,
  })
}

export function useContentAnalytics() {
  return useQuery<ContentAnalyticsSummary>({
    queryKey: ['content-analytics'],
    queryFn: async () => {
      const { data } = await axios.get<ContentAnalyticsSummary>(`${BASE}/analytics`)
      return data
    },
    staleTime: 120_000,
  })
}

export function useOptimalTime(platform: string) {
  return useQuery<{ platform: string; optimal_time: string }>({
    queryKey: ['optimal-time', platform],
    queryFn: async () => {
      const { data } = await axios.get(`${BASE}/optimal-time/${platform}`)
      return data
    },
    staleTime: 300_000,
  })
}
