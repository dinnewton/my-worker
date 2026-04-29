export type ActivityType =
  | 'lead_found'
  | 'post_published'
  | 'proposal_sent'
  | 'site_built'
  | 'email_sent'
  | 'seo_audit'
  | 'content_created'
  | 'campaign_launched'
  | 'agent_thinking'
  | 'system'

export type ActivityStatus = 'pending' | 'running' | 'success' | 'failed'

export interface Activity {
  id: number
  type: ActivityType
  status: ActivityStatus
  title: string
  description: string | null
  module: string | null
  created_at: string
}

export type LeadStatus = 'new' | 'contacted' | 'qualified' | 'proposal_sent' | 'won' | 'lost'
export type LeadSource = 'web_scrape' | 'referral' | 'social_media' | 'email_campaign' | 'manual'

export interface Lead {
  id: number
  name: string
  company: string | null
  email: string | null
  industry: string | null
  status: LeadStatus
  source: LeadSource
  score: number
  ai_summary: string | null
  created_at: string
}

export type ProposalStatus = 'draft' | 'sent' | 'viewed' | 'accepted' | 'rejected'

export interface Proposal {
  id: number
  title: string
  client_name: string
  client_email: string | null
  status: ProposalStatus
  services: string | null
  value: number
  ai_generated: boolean
  created_at: string
  sent_at: string | null
}

export interface KPIData {
  active_leads: number
  posts_published: number
  proposals_sent: number
  sites_built: number
  revenue: number
  leads_delta: number
  posts_delta: number
  proposals_delta: number
  revenue_delta: number
}

export interface Notification {
  id: string
  title: string
  message: string
  type: 'info' | 'success' | 'warning' | 'error'
  read: boolean
  created_at: string
}

export interface WSMessage {
  event: string
  data: unknown
}

// ─── Lead CRM Module ─────────────────────────────────────────────────────────

export type LeadStatus =
  | 'new' | 'contacted' | 'qualified' | 'proposal_sent' | 'won' | 'lost'

export type LeadSource =
  | 'web_scrape' | 'referral' | 'social_media' | 'email_campaign' | 'manual'
  | 'whatsapp' | 'website_form' | 'linkedin' | 'instagram' | 'facebook'
  | 'cold_outreach'

export type LeadPriority = 'low' | 'medium' | 'high' | 'urgent'

export interface Lead {
  id: number
  name: string
  company: string | null
  email: string | null
  phone: string | null
  whatsapp: string | null
  website: string | null
  industry: string | null
  location: string | null
  status: LeadStatus
  source: LeadSource
  priority: LeadPriority
  score: number
  deal_value: number
  tags: string | null          // JSON string: ["tag1","tag2"]
  notes: string | null
  ai_summary: string | null
  ai_next_action: string | null
  ai_key_factors: string | null  // JSON string: ["factor1",...]
  assigned_to: string | null
  last_contact_at: string | null
  next_followup_at: string | null
  created_at: string
  updated_at: string
}

export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent'
export type TaskType = 'call' | 'email' | 'whatsapp' | 'meeting' | 'proposal' | 'follow_up' | 'research' | 'other'

export interface FollowUpTask {
  id: number
  lead_id: number
  title: string
  description: string | null
  task_type: TaskType
  priority: TaskPriority
  due_date: string | null
  completed: boolean
  completed_at: string | null
  ai_generated: boolean
  created_at: string
}

export type ActivityKind =
  | 'note' | 'call' | 'email' | 'whatsapp' | 'meeting'
  | 'status_change' | 'score_update' | 'task_created' | 'task_completed'
  | 'proposal_sent' | 'ai_action' | 'form_submit'

export interface LeadActivity {
  id: number
  lead_id: number
  kind: ActivityKind
  title: string
  description: string | null
  metadata_json: string | null
  created_by: string
  created_at: string
}

export interface PipelineColumn {
  status: LeadStatus
  label: string
  count: number
  total_value: number
  leads: Lead[]
}

export interface PipelineStats {
  total_leads: number
  total_pipeline_value: number
  avg_score: number
  won_this_month: number
  conversion_rate: number
  columns: PipelineColumn[]
}

export interface LeadScoreResult {
  score: number
  summary: string
  next_action: string
  key_factors: string[]
  strengths: string[]
  risks: string[]
  recommended_approach: string
  estimated_close_probability: number
  suggested_deal_value: number
}

// ─── Proposals Module ────────────────────────────────────────────────────────

export type ProposalStatus = 'draft' | 'sent' | 'viewed' | 'accepted' | 'rejected' | 'expired'

export type ProposalTemplate =
  | 'digital_marketing'
  | 'web_development'
  | 'seo'
  | 'social_media'
  | 'email_marketing'
  | 'content_creation'
  | 'full_service'
  | 'custom'

export interface ProposalSection {
  heading: string
  content: string
}

export interface ProposalMilestone {
  week: string
  milestone: string
}

export interface PricingItem {
  item: string
  description: string
  price: number
}

export interface Proposal {
  id: number
  lead_id: number | null
  title: string
  client_name: string
  client_email: string | null
  client_company: string | null
  template_type: ProposalTemplate
  status: ProposalStatus
  cover_letter: string | null
  services: string | null        // JSON string[]
  sections: string | null        // JSON ProposalSection[]
  timeline: string | null        // JSON ProposalMilestone[]
  deliverables: string | null    // JSON string[]
  pricing_breakdown: string | null  // JSON PricingItem[]
  value: number
  monthly_retainer: number
  setup_fee: number
  timeline_weeks: number
  notes: string | null
  version: number
  valid_until: string | null
  ai_generated: boolean
  ai_win_tips: string | null     // JSON string[]
  share_token: string
  file_path: string | null
  signature_name: string | null
  signature_date: string | null
  created_at: string
  updated_at: string
  sent_at: string | null
  viewed_at: string | null
  accepted_at: string | null
  rejected_at: string | null
}

export interface ProposalSummary {
  id: number
  title: string
  client_name: string
  client_company: string | null
  status: ProposalStatus
  template_type: ProposalTemplate
  value: number
  ai_generated: boolean
  created_at: string
  sent_at: string | null
  accepted_at: string | null
}

export interface ProposalStats {
  total: number
  by_status: Record<string, number>
  total_pipeline_value: number
  won_value: number
  win_rate: number
  draft: number
  sent: number
  viewed: number
  accepted: number
  rejected: number
}

export interface AIGenerateProposalRequest {
  lead_id?: number
  client_name: string
  client_company?: string
  client_email?: string
  template_type: ProposalTemplate
  services: string[]
  budget: number
  timeline_weeks: number
  notes?: string
}

// ─── Websites Module ─────────────────────────────────────────────────────────

export type WebsiteStatus = 'planning' | 'in_progress' | 'review' | 'live' | 'maintenance' | 'paused'

export type WebsiteTemplate =
  | 'business' | 'portfolio' | 'landing_page' | 'ecommerce'
  | 'blog' | 'restaurant' | 'agency' | 'saas'

export type SectionType =
  | 'hero' | 'about' | 'services' | 'portfolio' | 'testimonials'
  | 'pricing' | 'faq' | 'contact' | 'blog' | 'team' | 'cta' | 'stats' | 'custom'

export interface WebsiteSection {
  type: SectionType
  heading: string
  subheading?: string
  content?: string
  items?: { title: string; description: string; icon?: string }[]
  cta_text?: string
  cta_link?: string
}

export interface WebsitePage {
  id: number
  website_id: number
  name: string
  slug: string
  title: string | null
  meta_description: string | null
  sections: string | null   // JSON WebsiteSection[]
  is_published: boolean
  order: number
  created_at: string
  updated_at: string
}

export interface Website {
  id: number
  lead_id: number | null
  name: string
  client_name: string
  client_email: string | null
  domain: string | null
  live_url: string | null
  template: WebsiteTemplate
  status: WebsiteStatus
  industry: string | null
  description: string | null
  brand_colors: string | null   // JSON string[]
  target_audience: string | null
  key_services: string | null   // JSON string[]
  notes: string | null
  progress: number
  pages_count: number
  project_value: number
  monthly_maintenance: number
  ai_generated: boolean
  seo_score: number | null
  deadline: string | null
  launched_at: string | null
  created_at: string
  updated_at: string
  pages: WebsitePage[]
}

export interface WebsiteSummary {
  id: number
  name: string
  client_name: string
  domain: string | null
  live_url: string | null
  template: WebsiteTemplate
  status: WebsiteStatus
  progress: number
  pages_count: number
  project_value: number
  ai_generated: boolean
  created_at: string
  deadline: string | null
}

export interface WebsiteStats {
  total: number
  live: number
  in_progress: number
  total_value: number
  sites_by_template: Record<string, number>
  sites_by_status: Record<string, number>
}

export interface AIGenerateSiteRequest {
  lead_id?: number
  client_name: string
  client_email?: string
  business_name: string
  industry: string
  description: string
  template: WebsiteTemplate
  target_audience?: string
  key_services: string[]
  brand_colors: string[]
  pages: string[]
}

// ─── Content Module ──────────────────────────────────────────────────────────

export type ContentType =
  | 'caption'
  | 'blog_post'
  | 'ad_copy'
  | 'thread'
  | 'linkedin_article'
  | 'tiktok_script'
  | 'hashtags'
  | 'image_prompt'

export type SocialPlatform =
  | 'instagram'
  | 'facebook'
  | 'linkedin'
  | 'tiktok'
  | 'twitter'
  | 'all'

export type PostStatus = 'draft' | 'scheduled' | 'publishing' | 'published' | 'failed'
export type ContentTone = 'professional' | 'casual' | 'humorous' | 'inspirational' | 'educational' | 'persuasive'

export interface ContentPost {
  id: number
  title: string
  content_type: ContentType
  platforms: string       // JSON string: ["instagram","facebook"]
  status: PostStatus
  content: string
  hashtags: string | null // JSON string: ["#tag1","#tag2"]
  image_prompt: string | null
  image_url: string | null
  ai_generated: boolean
  tone: ContentTone | null
  topic: string | null
  target_audience: string | null
  scheduled_at: string | null
  published_at: string | null
  likes: number
  comments: number
  shares: number
  reach: number
  impressions: number
  clicks: number
  engagement_rate: number
  created_at: string
  updated_at: string
}

export interface GenerateContentRequest {
  content_type: ContentType
  topic: string
  platforms: SocialPlatform[]
  tone: ContentTone
  target_audience?: string
  keywords?: string[]
  additional_context?: string
  generate_image_prompt?: boolean
  num_hashtags?: number
}

export interface GenerateContentResponse {
  content: string
  hashtags: string[]
  image_prompt: string | null
  alternative_versions: string[]
  platform_adaptations: Record<string, string>
}

export interface ImagePrompts {
  dalle3: string
  midjourney: string
  stable_diffusion: string
  canva: string
  style_notes: string
}

export interface ContentAnalyticsSummary {
  total_posts: number
  published_posts: number
  scheduled_posts: number
  draft_posts: number
  total_reach: number
  total_impressions: number
  total_engagement: number
  avg_engagement_rate: number
  platform_breakdown: Record<string, number>
  top_posts: ContentPost[]
}

export interface CalendarDay {
  id: number
  title: string
  status: PostStatus
  platforms: string[]
  content_type: ContentType
  scheduled_at: string
}

export interface CalendarData {
  year: number
  month: number
  days: Record<string, CalendarDay[]>
}
