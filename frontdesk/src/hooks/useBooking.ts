import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import type { AvailabilityDTO, ServiceDTO, TokenDTO } from "@/lib/contract-types";
import type { BookInput } from "@/lib/validators";

export function useServices() {
  return useQuery({
    queryKey: ["services"],
    queryFn: () => apiClient<ServiceDTO[]>("/services"),
    staleTime: 60_000,
  });
}

export function useAvailability(serviceId?: string) {
  return useQuery({
    queryKey: ["availability", serviceId],
    queryFn: () => apiClient<AvailabilityDTO>(`/services/${serviceId}/availability`),
    enabled: !!serviceId,
  });
}

export function useBookTokenMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: BookInput) => apiClient<TokenDTO>("/tokens", { method: "POST", body: JSON.stringify(input) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tokens"] }),
  });
}
