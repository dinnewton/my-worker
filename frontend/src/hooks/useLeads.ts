import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import type {
  Lead, FollowUpTask, LeadActivity, PipelineStats,
  LeadStatus, LeadScoreResult,
} from '../types'

const BASE = '/api/v1/leads'

// ─── Pipeline ─────────────────────────────────────────────────────────────────

export function usePipeline() {
  return useQuery<PipelineStats>({
    queryKey: ['pipeline'],
    queryFn: async () => {
      const { data } = await axios.get<PipelineStats>(`${BASE}/pipeline`)
      return data
    },
    staleTime: 20_000,
    refetchInterval: 60_000,
  })
}

// ─── Leads CRUD ───────────────────────────────────────────────────────────────

export function useLeads(filters?: { status?: string; source?: string; search?: string; min_score?: number }) {
  return useQuery<Lead[]>({
    queryKey: ['leads', filters],
    queryFn: async () => {
      const { data } = await axios.get<Lead[]>(BASE, { params: filters })
      return data
    },
    staleTime: 30_000,
  })
}

export function useLead(id: number) {
  return useQuery<Lead>({
    queryKey: ['lead', id],
    queryFn: async () => {
      const { data } = await axios.get<Lead>(`${BASE}/${id}`)
      return data
    },
    enabled: id > 0,
  })
}

export function useCreateLead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: Partial<Lead> & { name: string }) => {
      const { data } = await axios.post<Lead>(BASE, payload)
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['leads'] })
      qc.invalidateQueries({ queryKey: ['pipeline'] })
      qc.invalidateQueries({ queryKey: ['kpis'] })
    },
  })
}

export function useUpdateLead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...payload }: { id: number } & Partial<Lead>) => {
      const { data } = await axios.patch<Lead>(`${BASE}/${id}`, payload)
      return data
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['lead', vars.id] })
      qc.invalidateQueries({ queryKey: ['leads'] })
      qc.invalidateQueries({ queryKey: ['pipeline'] })
    },
  })
}

export function useDeleteLead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: number) => {
      await axios.delete(`${BASE}/${id}`)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['leads'] })
      qc.invalidateQueries({ queryKey: ['pipeline'] })
    },
  })
}

export function useMoveLeadStage() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, status, note }: { id: number; status: LeadStatus; note?: string }) => {
      const { data } = await axios.patch<Lead>(`${BASE}/${id}/status`, { status, note })
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pipeline'] })
      qc.invalidateQueries({ queryKey: ['leads'] })
      qc.invalidateQueries({ queryKey: ['kpis'] })
    },
  })
}

// ─── Activities ───────────────────────────────────────────────────────────────

export function useLeadActivities(leadId: number) {
  return useQuery<LeadActivity[]>({
    queryKey: ['lead-activities', leadId],
    queryFn: async () => {
      const { data } = await axios.get<LeadActivity[]>(`${BASE}/${leadId}/activities`)
      return data
    },
    enabled: leadId > 0,
    staleTime: 15_000,
  })
}

export function useAddActivity() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      leadId,
      ...payload
    }: { leadId: number; kind: string; title: string; description?: string }) => {
      const { data } = await axios.post<LeadActivity>(`${BASE}/${leadId}/activities`, payload)
      return data
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['lead-activities', vars.leadId] })
    },
  })
}

// ─── Tasks ────────────────────────────────────────────────────────────────────

export function useLeadTasks(leadId: number) {
  return useQuery<FollowUpTask[]>({
    queryKey: ['lead-tasks', leadId],
    queryFn: async () => {
      const { data } = await axios.get<FollowUpTask[]>(`${BASE}/${leadId}/tasks`)
      return data
    },
    enabled: leadId > 0,
    staleTime: 15_000,
  })
}

export function useAllTasks(completed?: boolean) {
  return useQuery<FollowUpTask[]>({
    queryKey: ['all-tasks', completed],
    queryFn: async () => {
      const { data } = await axios.get<FollowUpTask[]>(`${BASE}/tasks/all`, {
        params: { completed },
      })
      return data
    },
    staleTime: 30_000,
  })
}

export function useUpdateTask() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, leadId, ...payload }: { id: number; leadId: number } & Partial<FollowUpTask>) => {
      const { data } = await axios.patch<FollowUpTask>(`${BASE}/tasks/${id}`, payload)
      return data
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['lead-tasks', vars.leadId] })
      qc.invalidateQueries({ queryKey: ['all-tasks'] })
    },
  })
}

export function useDeleteTask() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, leadId }: { id: number; leadId: number }) => {
      await axios.delete(`${BASE}/tasks/${id}`)
      return { leadId }
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['lead-tasks', vars.leadId] })
      qc.invalidateQueries({ queryKey: ['all-tasks'] })
    },
  })
}

// ─── AI Operations ────────────────────────────────────────────────────────────

export function useAIScoreLead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: number) => {
      const { data } = await axios.post<LeadScoreResult>(`${BASE}/${id}/ai/score`)
      return data
    },
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: ['lead', id] })
      qc.invalidateQueries({ queryKey: ['pipeline'] })
    },
  })
}

export function useAIGenerateTasks() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: number) => {
      const { data } = await axios.post(`${BASE}/${id}/ai/tasks`)
      return data
    },
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: ['lead-tasks', id] })
    },
  })
}

export function useAIOutreach() {
  return useMutation({
    mutationFn: async ({ id, channel }: { id: number; channel: string }) => {
      const { data } = await axios.post<{ channel: string; message: string }>(
        `${BASE}/${id}/ai/outreach`, { channel }
      )
      return data
    },
  })
}

export function useAIInsights(leadId: number) {
  return useQuery({
    queryKey: ['lead-insights', leadId],
    queryFn: async () => {
      const { data } = await axios.get(`${BASE}/${leadId}/ai/insights`)
      return data
    },
    enabled: leadId > 0,
    staleTime: 5 * 60_000,
  })
}
