import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'

const BASE = '/api/v1/invoices'

export interface LineItem {
  description: string
  quantity: number
  unit_price: number
  amount: number
}

export interface Invoice {
  id: number
  invoice_number: string
  proposal_id: number | null
  client_name: string
  client_email: string | null
  client_phone: string | null
  client_company: string | null
  client_address: string | null
  items: string          // JSON
  currency: string
  subtotal: number
  tax_rate: number
  tax_amount: number
  discount_amount: number
  total: number
  amount_paid: number
  status: 'draft' | 'sent' | 'viewed' | 'paid' | 'partial' | 'overdue' | 'cancelled'
  payment_method: 'stripe' | 'mpesa' | 'bank_transfer' | 'cash' | 'other' | null
  stripe_payment_url: string | null
  mpesa_phone: string | null
  mpesa_receipt: string | null
  share_token: string
  notes: string | null
  due_date: string | null
  sent_at: string | null
  paid_at: string | null
  created_at: string
  updated_at: string
}

export interface InvoiceStats {
  total: number
  total_invoiced: number
  total_paid: number
  total_outstanding: number
  overdue: number
  by_status: Record<string, number>
}

export interface CreateInvoicePayload {
  proposal_id?: number
  client_name: string
  client_email?: string
  client_phone?: string
  client_company?: string
  client_address?: string
  items: Omit<LineItem, 'amount'>[]
  currency: string
  tax_rate: number
  discount_amount: number
  due_date?: string
  notes?: string
}

export function useInvoices() {
  return useQuery<Invoice[]>({
    queryKey: ['invoices'],
    queryFn: async () => (await axios.get(BASE)).data,
    staleTime: 30_000,
  })
}

export function useInvoiceStats() {
  return useQuery<InvoiceStats>({
    queryKey: ['invoice-stats'],
    queryFn: async () => (await axios.get(`${BASE}/stats`)).data,
    staleTime: 30_000,
  })
}

export function useInvoice(id: number | null) {
  return useQuery<Invoice>({
    queryKey: ['invoice', id],
    queryFn: async () => (await axios.get(`${BASE}/${id}`)).data,
    enabled: id != null && id > 0,
  })
}

export function useCreateInvoice() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: CreateInvoicePayload) =>
      (await axios.post<Invoice>(BASE, payload)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invoices'] })
      qc.invalidateQueries({ queryKey: ['invoice-stats'] })
    },
  })
}

export function useUpdateInvoice() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...payload }: { id: number } & Partial<CreateInvoicePayload> & { status?: string }) =>
      (await axios.patch<Invoice>(`${BASE}/${id}`, payload)).data,
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['invoice', vars.id] })
      qc.invalidateQueries({ queryKey: ['invoices'] })
      qc.invalidateQueries({ queryKey: ['invoice-stats'] })
    },
  })
}

export function useDeleteInvoice() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: number) => axios.delete(`${BASE}/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invoices'] })
      qc.invalidateQueries({ queryKey: ['invoice-stats'] })
    },
  })
}

export function useMarkInvoicePaid() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: number) => (await axios.patch<Invoice>(`${BASE}/${id}/mark-paid`)).data,
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: ['invoice', id] })
      qc.invalidateQueries({ queryKey: ['invoices'] })
      qc.invalidateQueries({ queryKey: ['invoice-stats'] })
    },
  })
}

export function useSendInvoiceEmail() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: number) => (await axios.post(`${BASE}/${id}/send-email`)).data,
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: ['invoice', id] })
      qc.invalidateQueries({ queryKey: ['invoices'] })
    },
  })
}

export function useStripeCheckout() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: number) => (await axios.post(`${BASE}/${id}/stripe-checkout`)).data,
    onSuccess: (data: { url: string | null }) => {
      if (data.url) window.open(data.url, '_blank')
      qc.invalidateQueries({ queryKey: ['invoices'] })
    },
  })
}

export function useMpesaPayment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, phone }: { id: number; phone: string }) =>
      (await axios.post(`${BASE}/${id}/mpesa`, { phone })).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['invoices'] }),
  })
}

export function useDownloadInvoicePDF() {
  return useMutation({
    mutationFn: async ({ id, number }: { id: number; number: string }) => {
      const resp = await axios.get(`${BASE}/${id}/pdf`, { responseType: 'blob' })
      const url = window.URL.createObjectURL(new Blob([resp.data], { type: 'application/pdf' }))
      const a = document.createElement('a')
      a.href = url; a.download = `${number}.pdf`
      document.body.appendChild(a); a.click()
      document.body.removeChild(a); window.URL.revokeObjectURL(url)
    },
  })
}
