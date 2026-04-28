import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import type { Proposal, ProposalSummary, ProposalStats, AIGenerateProposalRequest, ProposalStatus, ProposalTemplate } from '../types'

const BASE = '/api/v1/proposals'

export function useProposals(status?: string) {
  return useQuery<ProposalSummary[]>({
    queryKey: ['proposals', status],
    queryFn: async () => {
      const { data } = await axios.get<ProposalSummary[]>(BASE, { params: status ? { status } : {} })
      return data
    },
    staleTime: 30_000,
  })
}

export function useProposalStats() {
  return useQuery<ProposalStats>({
    queryKey: ['proposal-stats'],
    queryFn: async () => {
      const { data } = await axios.get<ProposalStats>(`${BASE}/stats`)
      return data
    },
    staleTime: 30_000,
  })
}

export function useProposal(id: number) {
  return useQuery<Proposal>({
    queryKey: ['proposal', id],
    queryFn: async () => {
      const { data } = await axios.get<Proposal>(`${BASE}/${id}`)
      return data
    },
    enabled: id > 0,
  })
}

export function useCreateProposal() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: Partial<Proposal> & { title: string; client_name: string }) => {
      const { data } = await axios.post<Proposal>(BASE, payload)
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['proposals'] })
      qc.invalidateQueries({ queryKey: ['proposal-stats'] })
      qc.invalidateQueries({ queryKey: ['kpis'] })
    },
  })
}

export function useUpdateProposal() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...payload }: { id: number } & Partial<Proposal>) => {
      const { data } = await axios.patch<Proposal>(`${BASE}/${id}`, payload)
      return data
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['proposal', vars.id] })
      qc.invalidateQueries({ queryKey: ['proposals'] })
      qc.invalidateQueries({ queryKey: ['proposal-stats'] })
    },
  })
}

export function useDeleteProposal() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: number) => {
      await axios.delete(`${BASE}/${id}`)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['proposals'] })
      qc.invalidateQueries({ queryKey: ['proposal-stats'] })
      qc.invalidateQueries({ queryKey: ['kpis'] })
    },
  })
}

export function useUpdateProposalStatus() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, status }: { id: number; status: ProposalStatus }) => {
      const { data } = await axios.patch<Proposal>(`${BASE}/${id}/status`, { status })
      return data
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['proposal', vars.id] })
      qc.invalidateQueries({ queryKey: ['proposals'] })
      qc.invalidateQueries({ queryKey: ['proposal-stats'] })
      qc.invalidateQueries({ queryKey: ['kpis'] })
    },
  })
}

export function useAIGenerateProposal() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (req: AIGenerateProposalRequest) => {
      const { data } = await axios.post<Proposal>(`${BASE}/ai/generate`, req)
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['proposals'] })
      qc.invalidateQueries({ queryKey: ['proposal-stats'] })
      qc.invalidateQueries({ queryKey: ['kpis'] })
    },
  })
}

export function useDownloadPDF() {
  return useMutation({
    mutationFn: async ({ id, clientName }: { id: number; clientName: string }) => {
      const response = await axios.get(`${BASE}/${id}/pdf`, { responseType: 'blob' })
      const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }))
      const link = document.createElement('a')
      link.href = url
      link.download = `proposal_${clientName.replace(/\s+/g, '_')}.pdf`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
    },
  })
}

export function useSharedProposal(token: string) {
  return useQuery<Proposal>({
    queryKey: ['shared-proposal', token],
    queryFn: async () => {
      const { data } = await axios.get<Proposal>(`${BASE}/share/${token}`)
      return data
    },
    enabled: Boolean(token),
  })
}
