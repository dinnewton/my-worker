import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'

const BASE = '/api/v1/settings'

export interface AppSettings {
  // Business
  agency_name: string
  agency_email: string
  agency_phone: string | null
  agency_website: string | null
  agency_logo_url: string | null
  tagline: string | null
  timezone: string
  currency: string
  services_offered: string[]
  pricing_model: string
  starting_price: number
  // Social
  twitter_handle: string | null
  linkedin_url: string | null
  facebook_page: string | null
  instagram_handle: string | null
  tiktok_handle: string | null
  // Notifications
  notif_new_lead: boolean
  notif_proposal_viewed: boolean
  notif_proposal_signed: boolean
  notif_campaign_report: boolean
  notif_weekly_summary: boolean
  notif_email: string | null
  notif_whatsapp: string | null
  // Working hours
  work_start_time: string
  work_end_time: string
  work_days: string[]
  respect_working_hours: boolean
  // Agent
  agent_enabled: boolean
  agent_tone: string
  agent_aggressiveness: string
  agent_auto_reply_whatsapp: boolean
  agent_auto_draft_proposals: boolean
  agent_proposal_min_score: number
  agent_daily_summary: boolean
  agent_summary_hour: number
  agent_loop_interval_hours: number
  admin_email: string | null
  admin_whatsapp: string | null
  followup_intervals: Record<string, number[]>
  // Schedules
  schedule_content: string
  schedule_lead_scoring: string
  schedule_seo_monitoring: string
  schedule_campaign_reports: string
  // API keys (masked)
  anthropic_api_key: string
  sendgrid_api_key: string
  semrush_api_key: string
  google_analytics_id: string
  stripe_secret_key: string
  stripe_publishable_key: string
  whatsapp_phone_number_id: string
  whatsapp_access_token: string
  whatsapp_app_secret: string
  facebook_page_access_token: string
  instagram_business_id: string
  linkedin_access_token: string
  tiktok_access_token: string
  twitter_api_key: string
  twitter_api_secret: string
  twitter_access_token: string
  twitter_access_secret: string
  netlify_access_token: string
  vercel_access_token: string
  imap_host: string | null
  imap_port: number
  imap_user: string | null
  imap_password: string
  updated_at: string
}

export interface TeamMember {
  id: number
  name: string
  email: string
  role: string
  avatar_url: string | null
  initials: string
  is_active: boolean
  invited_at: string
  last_active_at: string | null
}

export function useSettings() {
  return useQuery<AppSettings>({
    queryKey: ['settings'],
    queryFn: async () => (await axios.get(`${BASE}/`)).data,
    staleTime: 60_000,
  })
}

export function useSaveSettings() {
  const qc = useQueryClient()
  return useMutation<AppSettings, Error, Partial<AppSettings>>({
    mutationFn: async (data) => (await axios.put(`${BASE}/`, data)).data,
    onSuccess: (data) => {
      qc.setQueryData(['settings'], data)
    },
  })
}

export function useTeam() {
  return useQuery<TeamMember[]>({
    queryKey: ['team'],
    queryFn: async () => (await axios.get(`${BASE}/team`)).data,
  })
}

export function useAddTeamMember() {
  const qc = useQueryClient()
  return useMutation<TeamMember, Error, { name: string; email: string; role: string }>({
    mutationFn: async (data) => (await axios.post(`${BASE}/team`, data)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['team'] }),
  })
}

export function useUpdateTeamMember() {
  const qc = useQueryClient()
  return useMutation<TeamMember, Error, { id: number; data: Partial<TeamMember> }>({
    mutationFn: async ({ id, data }) => (await axios.patch(`${BASE}/team/${id}`, data)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['team'] }),
  })
}

export function useRemoveTeamMember() {
  const qc = useQueryClient()
  return useMutation<void, Error, number>({
    mutationFn: async (id) => { await axios.delete(`${BASE}/team/${id}`) },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['team'] }),
  })
}

export function useTestConnection() {
  return useMutation<{ ok: boolean; message: string }, Error, string>({
    mutationFn: async (service) => (await axios.post(`${BASE}/test/${service}`)).data,
  })
}
