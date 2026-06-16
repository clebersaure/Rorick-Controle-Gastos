import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import api from '../services/api';

const REFETCH = 30_000;

export function useResumoMensal(ano = new Date().getFullYear()) {
  return useQuery({
    queryKey: ['resumo-mensal', ano],
    queryFn: () => api.get(`/gastos/resumo-mensal?ano=${ano}`).then((r) => r.data),
    refetchInterval: REFETCH,
  });
}

export function useResumoCategorias(mes, ano) {
  const hoje = new Date();
  const m = mes ?? hoje.getMonth() + 1;
  const a = ano ?? hoje.getFullYear();
  return useQuery({
    queryKey: ['resumo-categorias', m, a],
    queryFn: () => api.get(`/gastos/resumo-categorias?mes=${m}&ano=${a}`).then((r) => r.data),
    refetchInterval: REFETCH,
  });
}

export function useGastos(filtros = {}) {
  const params = new URLSearchParams();
  Object.entries(filtros).forEach(([k, v]) => { if (v != null && v !== '') params.set(k, v); });
  return useQuery({
    queryKey: ['gastos', filtros],
    queryFn: () => api.get(`/gastos?${params}`).then((r) => r.data.items ?? r.data),
    refetchInterval: REFETCH,
  });
}

export function useCategorias() {
  return useQuery({
    queryKey: ['categorias'],
    queryFn: () => api.get('/categorias').then((r) => r.data),
    staleTime: 60_000,
  });
}

export function useUsuarios() {
  return useQuery({
    queryKey: ['usuarios'],
    queryFn: () =>
      api.get('/usuarios').then((r) => r.data).catch((err) => {
        if (err.response?.status === 403) return [];
        throw err;
      }),
    staleTime: 60_000,
  });
}
