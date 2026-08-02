import {
  useMutation,
  useQuery,
  useQueryClient,
  keepPreviousData,
} from '@tanstack/react-query';
import { urlsApi, type CreateUrlInput, type ListUrlParams, type UpdateUrlInput } from '@/api/urls.api';
import { toast } from 'sonner';

export function useUrls(params: ListUrlParams) {
  return useQuery({
    queryKey: ['urls', params],
    queryFn: () => urlsApi.list(params),
    placeholderData: keepPreviousData,
  });
}

export function useCreateUrl() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateUrlInput) => urlsApi.create(input),
    onSuccess: (url) => {
      queryClient.invalidateQueries({ queryKey: ['urls'] });
      queryClient.invalidateQueries({ queryKey: ['overview'] });
      toast.success(`Link created: ${url.shortUrl}`);
    },
    onError: (err) => {
      toast.error(getErrorMessage(err, 'Failed to create link'));
    },
  });
}

export function useUpdateUrl() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateUrlInput }) =>
      urlsApi.update(id, input),
    onSuccess: (_url, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['urls'] });
      queryClient.invalidateQueries({ queryKey: ['analytics', id] });
      toast.success('Link updated');
    },
    onError: (err) => {
      toast.error(getErrorMessage(err, 'Failed to update link'));
    },
  });
}

export function useDeleteUrl() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => urlsApi.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['urls'] });
      queryClient.invalidateQueries({ queryKey: ['overview'] });
      toast.success('Link deleted');
    },
    onError: (err) => {
      toast.error(getErrorMessage(err, 'Failed to delete link'));
    },
  });
}

export function getErrorMessage(error: unknown, fallback: string): string {
  if (error && typeof error === 'object' && 'response' in error) {
    const response = (error as { response?: { data?: { message?: string } } }).response;
    if (response?.data?.message) return response.data.message;
  }
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}
