import { useQuery } from '@tanstack/react-query'
import axios from 'axios'
import type { KPIData } from '../types'

export function useKPIs() {
  return useQuery<KPIData>({
    queryKey: ['kpis'],
    queryFn: async () => {
      const { data } = await axios.get<KPIData>('/api/v1/dashboard/kpis')
      return data
    },
    refetchInterval: 30_000,
    staleTime: 20_000,
  })
}
