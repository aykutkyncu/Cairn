import { useMutation, useQueryClient } from '@tanstack/react-query';

import { createTask, type CreateTaskInput } from './create-task';
import { taskKeys } from './use-day-plan';

/**
 * Görev oluşturma hook'u.
 *
 * Başarıda çemberin görev listesi geçersizlenir; Bugün ekranı yeni görevi
 * bir sonraki okumada gösterir. İyimser güncelleme YAPILMAZ: görev
 * oluşturma nadir bir işlemdir ve sunucunun ürettiği kimliği beklemek,
 * yerelde uydurulmuş bir kimlikle çalışmaktan güvenlidir.
 */
export const useCreateTask = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateTaskInput) => createTask(input),
    onSuccess: async (_task, input) => {
      await queryClient.invalidateQueries({ queryKey: taskKeys.list(input.circleId) });
    },
  });
};
