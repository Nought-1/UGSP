import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import type { TokenDTO, TokenStatusDTO } from "@/lib/contract-types";

const FINAL = ["COMPLETED", "CANCELLED", "NO_SHOW"];

export function useMyTokens(status: "active" | "past") {
  return useQuery({
    queryKey: ["tokens", "mine", status],
    queryFn: () => apiClient<TokenDTO[]>(`/tokens?status=${status}`),
    refetchInterval: status === "active" ? 15_000 : false,
  });
}

// Live status, polled every 10 s until the token reaches a final state
export function useTokenStatus(tokenId?: string) {
  return useQuery({
    queryKey: ["tokens", "status", tokenId],
    queryFn: () => apiClient<TokenStatusDTO>(`/tokens/${tokenId}`),
    enabled: !!tokenId,
    refetchInterval: (query) => (FINAL.includes(query.state.data?.token.status ?? "") ? false : 10_000),
  });
}

export const isFinal = (status: string) => FINAL.includes(status);

export function useCancelToken() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (tokenId: string) =>
      apiClient<TokenDTO>(`/tokens/${tokenId}`, { method: "PATCH", body: JSON.stringify({ action: "cancel" }) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tokens"] }),
  });
}
