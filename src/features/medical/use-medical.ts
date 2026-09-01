import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  createHealthRecord,
  createMedication,
  getHealthRecord,
  listHealthRecords,
  listMedications,
  searchHealthRecords,
  updateHealthRecord,
  type HealthRecordInput,
  type HealthRecordUpdate,
  type MedicationInput,
} from './medical-repository';
import type { HealthRecordType } from './medical-schema';

/**
 * Tıbbi dosya hook'ları.
 *
 * Sunucu verisi TanStack Query önbelleğinde yaşar. Sağlık verisi kalıcı
 * yerel depoya yazılmaz: önbellek bellektedir ve uygulama kapanınca gider.
 * Çevrimdışı okuma Faz 07'nin şifreli yerel deposuna aittir; burada
 * uydurulmuş bir "çevrimdışı dosya" vaadi verilmez.
 */

export const medicalKeys = {
  all: ['medical'] as const,
  medications: (circleId: string) => [...medicalKeys.all, 'medications', circleId] as const,
  record: (id: string) => [...medicalKeys.all, 'record', id] as const,
  records: (circleId: string, types: readonly HealthRecordType[]) =>
    [...medicalKeys.all, 'records', circleId, [...types].sort().join(',')] as const,
  search: (circleId: string, query: string) =>
    [...medicalKeys.all, 'search', circleId, query] as const,
} as const;

export const useMedications = (circleId: string | null) =>
  useQuery({
    queryKey: medicalKeys.medications(circleId ?? ''),
    queryFn: () => listMedications(circleId as string),
    // Çember seçilmeden sorgu koşmaz: yetkisiz bir istek göndermek hem
    // gereksiz, hem de hata durumunu kullanıcıya yanlış gösterir.
    enabled: circleId !== null,
  });

export const useHealthRecords = (circleId: string | null, types: readonly HealthRecordType[]) =>
  useQuery({
    queryKey: medicalKeys.records(circleId ?? '', types),
    queryFn: () => listHealthRecords(circleId as string, types),
    enabled: circleId !== null && types.length > 0,
  });

/**
 * Sağlık kaydı araması.
 *
 * Sorgu sunucuya gider. Arayüz bunu kullanıcıya açıkça söyler; "arama
 * cihazdan çıkmıyor" demek yanlış bir gizlilik vaadi olurdu.
 */
/** Tek kaydı kimliğiyle okur. Düzenleme ekranı bunu kullanır. */
export const useHealthRecord = (id: string | null) =>
  useQuery({
    queryKey: medicalKeys.record(id ?? ''),
    queryFn: () => getHealthRecord(id as string),
    enabled: id !== null,
  });

export const useHealthRecordSearch = (circleId: string | null, query: string) =>
  useQuery({
    queryKey: medicalKeys.search(circleId ?? '', query.trim()),
    queryFn: () => searchHealthRecords(circleId as string, query),
    enabled: circleId !== null && query.trim().length >= 2,
  });

/**
 * Sağlık kaydı güncelleme.
 *
 * Çakışma (`conflict`) bir hata gibi ele alınır ve KULLANICIYA gösterilir:
 * sessizce yeniden denemek, başkasının yazdığı sağlık metnini üzerine
 * yazmak olurdu.
 */
export const useUpdateHealthRecord = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: HealthRecordUpdate) => updateHealthRecord(input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: medicalKeys.all });
    },
  });
};

export const useCreateMedication = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: MedicationInput) => createMedication(input),
    onSuccess: async (_medication, input) => {
      await queryClient.invalidateQueries({ queryKey: medicalKeys.medications(input.circleId) });
    },
  });
};

export const useCreateHealthRecord = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: HealthRecordInput) => createHealthRecord(input),
    onSuccess: async () => {
      // Tür bazlı anahtarları tek tek geçersizlemek yerine tüm tıbbi dosya
      // önbelleği geçersizlenir: arama sonucu da eskimiş olabilir.
      await queryClient.invalidateQueries({ queryKey: medicalKeys.all });
    },
  });
};
