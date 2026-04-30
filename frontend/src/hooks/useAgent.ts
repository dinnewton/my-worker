import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'

const API = '/api/v1/agent'

export interface AgentAction {
  id: number
  tool_name: string
  tool_input: string | null
  tool_output: string | null
  status: string
  error: string | null
  duration_ms: number | null
  created_at: string
}

export interface AgentRun {
  id: number
  run_type: string
  status: 'running' | 'success' | 'partial' | 'failed' | 'skipped'
  trigger: 'scheduled' | 'manual'
  actions_taken: number
  actions_succeeded: number
  actions_failed: number
  summary: string | null
  error_message: string | null
  started_at: string
  completed_at: string | null
  duration_seconds: number | null
  actions: AgentAction[]
}

export interface AgentStatus {
  enabled: boolean
  jobs: { id: string; next_run: string | null }[]
  last_runs: {
    run_type: string
    status: string
    started_at: string
    actions_taken: number
    duration_seconds: number | null
  }[]
}

export function useAgentRuns(runType?: string) {
  return useQuery<AgentRun[]>({
    queryKey: ['agent-runs', runType],
    queryFn: async () => {
      const params = runType ? { run_type: runType } : {}
      const { data } = await axios.get(API + '/runs', { params })
      return data
    },
    refetchInterval: 10_000,
  })
}

export function useAgentRun(runId: number) {
  return useQuery<AgentRun>({
    queryKey: ['agent-run', runId],
    queryFn: async () => {
      const { data } = await axios.get(`${API}/runs/${runId}`)
      return data
    },
  })
}

export function useAgentStatus() {
  return useQuery<AgentStatus>({
    queryKey: ['agent-status'],
    queryFn: async () => {
      const { data } = await axios.get(`${API}/status`)
      return data
    },
    refetchInterval: 30_000,
  })
}

export function useTriggerAgent() {
  const qc = useQueryClient()
  return useMutation<void, Error, string>({
    mutationFn: async (task_type: string) => {
      await axios.post(`${API}/trigger`, { task_type })
    },
    onSuccess: () => {
      setTimeout(() => {
        qc.invalidateQueries({ queryKey: ['agent-runs'] })
        qc.invalidateQueries({ queryKey: ['agent-status'] })
      }, 1500)
    },
  })
}

export function useDeleteAgentRun() {
  const qc = useQueryClient()
  return useMutation<void, Error, number>({
    mutationFn: async (id: number) => {
      await axios.delete(`${API}/runs/${id}`)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['agent-runs'] })
    },
  })
}
