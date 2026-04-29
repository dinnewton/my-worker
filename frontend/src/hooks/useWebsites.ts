import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import type {
  Website, WebsiteSummary, WebsiteStats, WebsitePage,
  AIGenerateSiteRequest, WebsiteStatus, SectionType,
} from '../types'

const BASE = '/api/v1/websites'

export function useWebsites(status?: string) {
  return useQuery<WebsiteSummary[]>({
    queryKey: ['websites', status],
    queryFn: async () => {
      const { data } = await axios.get<WebsiteSummary[]>(BASE, { params: status ? { status } : {} })
      return data
    },
    staleTime: 30_000,
  })
}

export function useWebsiteStats() {
  return useQuery<WebsiteStats>({
    queryKey: ['website-stats'],
    queryFn: async () => {
      const { data } = await axios.get<WebsiteStats>(`${BASE}/stats`)
      return data
    },
    staleTime: 30_000,
  })
}

export function useWebsite(id: number) {
  return useQuery<Website>({
    queryKey: ['website', id],
    queryFn: async () => {
      const { data } = await axios.get<Website>(`${BASE}/${id}`)
      return data
    },
    enabled: id > 0,
  })
}

export function useCreateWebsite() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: Partial<Website> & { name: string; client_name: string }) => {
      const { data } = await axios.post<Website>(BASE, payload)
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['websites'] })
      qc.invalidateQueries({ queryKey: ['website-stats'] })
      qc.invalidateQueries({ queryKey: ['kpis'] })
    },
  })
}

export function useUpdateWebsite() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...payload }: { id: number } & Partial<Website>) => {
      const { data } = await axios.patch<Website>(`${BASE}/${id}`, payload)
      return data
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['website', vars.id] })
      qc.invalidateQueries({ queryKey: ['websites'] })
      qc.invalidateQueries({ queryKey: ['website-stats'] })
    },
  })
}

export function useDeleteWebsite() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: number) => { await axios.delete(`${BASE}/${id}`) },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['websites'] })
      qc.invalidateQueries({ queryKey: ['website-stats'] })
      qc.invalidateQueries({ queryKey: ['kpis'] })
    },
  })
}

export function useWebsitePages(siteId: number) {
  return useQuery<WebsitePage[]>({
    queryKey: ['website-pages', siteId],
    queryFn: async () => {
      const { data } = await axios.get<WebsitePage[]>(`${BASE}/${siteId}/pages`)
      return data
    },
    enabled: siteId > 0,
  })
}

export function useUpdatePage() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ siteId, pageId, ...payload }: { siteId: number; pageId: number } & Partial<WebsitePage>) => {
      const { data } = await axios.patch<WebsitePage>(`${BASE}/${siteId}/pages/${pageId}`, payload)
      return data
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['website-pages', vars.siteId] })
      qc.invalidateQueries({ queryKey: ['website', vars.siteId] })
    },
  })
}

export function useDeletePage() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ siteId, pageId }: { siteId: number; pageId: number }) => {
      await axios.delete(`${BASE}/${siteId}/pages/${pageId}`)
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['website-pages', vars.siteId] })
      qc.invalidateQueries({ queryKey: ['website', vars.siteId] })
    },
  })
}

export function useAIGenerateSite() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (req: AIGenerateSiteRequest) => {
      const { data } = await axios.post<Website>(`${BASE}/ai/generate`, req)
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['websites'] })
      qc.invalidateQueries({ queryKey: ['website-stats'] })
      qc.invalidateQueries({ queryKey: ['kpis'] })
    },
  })
}

export function useAIGenerateSection() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      siteId, pageId, section_type, additional_context,
    }: { siteId: number; pageId: number; section_type: SectionType; additional_context?: string }) => {
      const { data } = await axios.post(
        `${BASE}/${siteId}/pages/${pageId}/ai/section`,
        { website_id: siteId, page_id: pageId, section_type, additional_context },
      )
      return data
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['website-pages', vars.siteId] })
    },
  })
}

export function useAISEOAudit() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (siteId: number) => {
      const { data } = await axios.post(`${BASE}/${siteId}/ai/seo-audit`)
      return data
    },
    onSuccess: (_, siteId) => {
      qc.invalidateQueries({ queryKey: ['website', siteId] })
    },
  })
}
