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
    onSuccess: (_data: Website, vars: { id: number } & Partial<Website>) => {
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
    onSuccess: (_data: WebsitePage, vars: { siteId: number; pageId: number } & Partial<WebsitePage>) => {
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
    onSuccess: (_data: unknown, vars: { siteId: number; pageId: number }) => {
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
    onSuccess: (_data: unknown, vars: { siteId: number; pageId: number; section_type: SectionType; additional_context?: string }) => {
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
    onSuccess: (_data: unknown, siteId: number) => {
      qc.invalidateQueries({ queryKey: ['website', siteId] })
    },
  })
}

export interface WebsiteRequirements {
  id: number
  website_id: number
  intake_token: string
  client_name: string | null
  client_email: string | null
  business_name: string | null
  target_audience: string | null
  design_style: string | null
  color_preferences: string | null
  competitor_urls: string | null
  reference_sites: string | null
  must_have_features: string | null
  pages_needed: string | null
  content_ready: boolean
  logo_ready: boolean
  images_ready: boolean
  deadline_notes: string | null
  special_requests: string | null
  submitted_at: string | null
  created_at: string
}

export interface WebsiteRevision {
  id: number
  website_id: number
  requested_by: string | null
  page_name: string | null
  section_type: string | null
  description: string
  status: 'pending' | 'in_progress' | 'done' | 'rejected'
  priority: 'low' | 'medium' | 'high'
  agency_notes: string | null
  created_at: string
  updated_at: string
}

export function useWebsiteRequirements(siteId: number) {
  return useQuery<WebsiteRequirements[]>({
    queryKey: ['website-requirements', siteId],
    queryFn: async () => (await axios.get(`${BASE}/${siteId}/requirements`)).data,
    enabled: siteId > 0,
  })
}

export function useSendRequirements() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (siteId: number) =>
      (await axios.post<WebsiteRequirements>(`${BASE}/${siteId}/requirements/send`)).data,
    onSuccess: (_data: WebsiteRequirements, siteId: number) => {
      qc.invalidateQueries({ queryKey: ['website-requirements', siteId] })
      qc.invalidateQueries({ queryKey: ['website', siteId] })
    },
  })
}

export function useWebsiteRevisions(siteId: number) {
  return useQuery<WebsiteRevision[]>({
    queryKey: ['website-revisions', siteId],
    queryFn: async () => (await axios.get(`${BASE}/${siteId}/revisions`)).data,
    enabled: siteId > 0,
  })
}

type CreateRevisionVars = { siteId: number; description: string; requested_by?: string; page_name?: string; priority?: string }
type UpdateRevisionVars = { siteId: number; rid: number; status?: string; agency_notes?: string }
type DeleteRevisionVars = { siteId: number; rid: number }
type DeploySiteVars = { siteId: number; platform: string; wp_url?: string; wp_username?: string; wp_app_password?: string }

export function useCreateRevision() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ siteId, ...payload }: CreateRevisionVars) =>
      (await axios.post<WebsiteRevision>(`${BASE}/${siteId}/revisions`, payload)).data,
    onSuccess: (_data: WebsiteRevision, vars: CreateRevisionVars) => {
      qc.invalidateQueries({ queryKey: ['website-revisions', vars.siteId] })
    },
  })
}

export function useUpdateRevision() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ siteId, rid, ...payload }: UpdateRevisionVars) =>
      (await axios.patch<WebsiteRevision>(`${BASE}/${siteId}/revisions/${rid}`, payload)).data,
    onSuccess: (_data: WebsiteRevision, vars: UpdateRevisionVars) => {
      qc.invalidateQueries({ queryKey: ['website-revisions', vars.siteId] })
    },
  })
}

export function useDeleteRevision() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ siteId, rid }: DeleteRevisionVars) =>
      axios.delete(`${BASE}/${siteId}/revisions/${rid}`),
    onSuccess: (_data: unknown, vars: DeleteRevisionVars) => {
      qc.invalidateQueries({ queryKey: ['website-revisions', vars.siteId] })
    },
  })
}

export function useDeploySite() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ siteId, ...payload }: DeploySiteVars) =>
      (await axios.post(`${BASE}/${siteId}/deploy`, payload)).data,
    onSuccess: (_data: unknown, vars: DeploySiteVars) => {
      qc.invalidateQueries({ queryKey: ['website', vars.siteId] })
      qc.invalidateQueries({ queryKey: ['websites'] })
    },
  })
}

export function useExportHTML() {
  return useMutation({
    mutationFn: async ({ siteId, name }: { siteId: number; name: string }) => {
      const resp = await axios.get(`${BASE}/${siteId}/export-html`, { responseType: 'blob' })
      const url = window.URL.createObjectURL(new Blob([resp.data], { type: 'application/zip' }))
      const a = document.createElement('a')
      a.href = url; a.download = `${name.toLowerCase().replace(/\s+/g, '-')}.zip`
      document.body.appendChild(a); a.click()
      document.body.removeChild(a); window.URL.revokeObjectURL(url)
    },
  })
}
