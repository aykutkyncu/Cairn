import {
  MedicalError,
  createHealthRecord,
  createMedication,
  listHealthRecords,
  listMedications,
  searchHealthRecords,
} from '../medical-repository';

/**
 * Tıbbi dosya repository testleri.
 *
 * Sınanan davranışlar:
 * - Sağlık verisi (ilaç adı, başlık, arama metni) LOGA GİTMEZ.
 * - RLS reddi (42501) hassas ayrıntı taşımayan `forbidden` koduna iner.
 * - Arama kalıbındaki `%` ve `_` kaçırılır; kullanıcının düz metni joker
 *   olarak yorumlanmaz.
 * - Boş tür listesiyle sunucuya hiç gidilmez.
 */

const mockIsConfigured = jest.fn(() => true);
const mockSelectResult = jest.fn();
const mockInsertResult = jest.fn();
const mockInsertSpy = jest.fn();
const mockFromSpy = jest.fn();
const mockIlikeSpy = jest.fn();
const mockInSpy = jest.fn();

/** Zincirlenebilir PostgREST taklidi: her filtre kendini döndürür. */
const makeQuery = (result: () => unknown) => {
  const query: Record<string, unknown> = {};
  const chain = () => query;

  query.select = chain;
  query.eq = chain;
  query.is = chain;
  query.order = chain;
  query.limit = chain;
  query.in = (column: string, values: unknown) => {
    mockInSpy(column, values);
    return query;
  };
  query.ilike = (column: string, pattern: string) => {
    mockIlikeSpy(column, pattern);
    return query;
  };
  query.then = (resolve: (value: unknown) => unknown) => Promise.resolve(result()).then(resolve);

  return query;
};

jest.mock('@/lib/supabase', () => ({
  get isSupabaseConfigured() {
    return mockIsConfigured();
  },
  getSupabaseClient: () => ({
    from: (table: string) => {
      mockFromSpy(table);
      return {
        select: () => makeQuery(() => mockSelectResult()),
        insert: (payload: unknown) => {
          mockInsertSpy(payload);
          return { select: () => makeQuery(() => mockInsertResult()) };
        },
      };
    },
  }),
}));

const mockLogWarn = jest.fn();
const mockLogInfo = jest.fn();

jest.mock('@/lib/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: (event: string, data?: unknown) => mockLogInfo(event, data),
    warn: (event: string, data?: unknown) => mockLogWarn(event, data),
    error: jest.fn(),
  },
}));

const CIRCLE_ID = '11111111-1111-4111-8111-111111111111';
const MEDICATION_ID = '22222222-2222-4222-8222-222222222222';
const RECORD_ID = '33333333-3333-4333-8333-333333333333';

const medicationRow = {
  id: MEDICATION_ID,
  circle_id: CIRCLE_ID,
  name: 'Metformin',
  dosage: '500 mg',
  frequency_text: null,
  started_on: null,
  ended_on: null,
  prescribed_by: null,
  notes: null,
};

const recordRow = {
  id: RECORD_ID,
  circle_id: CIRCLE_ID,
  record_type: 'diagnosis',
  title: 'Tip 2 diyabet',
  body: null,
  recorded_on: null,
  created_at: '2026-02-01T10:00:00+00:00',
  updated_at: '2026-02-01T10:00:00+00:00',
  created_by: null,
  revision: 1,
};

describe('medical-repository', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsConfigured.mockReturnValue(true);
  });

  describe('listMedications', () => {
    it('ilaçları arayüz biçiminde döndürür', async () => {
      mockSelectResult.mockReturnValue({ data: [medicationRow], error: null });

      const medications = await listMedications(CIRCLE_ID);

      expect(medications).toHaveLength(1);
      expect(medications[0]?.name).toBe('Metformin');
      expect(mockFromSpy).toHaveBeenCalledWith('medications');
    });

    it('yapılandırma yokken sunucuya gitmez', async () => {
      mockIsConfigured.mockReturnValue(false);

      await expect(listMedications(CIRCLE_ID)).rejects.toThrow(MedicalError);
      expect(mockFromSpy).not.toHaveBeenCalled();
    });

    it('RLS reddini forbidden koduna indirger ve ilaç adını loglamaz', async () => {
      mockSelectResult.mockReturnValue({ data: null, error: { code: '42501' } });

      await expect(listMedications(CIRCLE_ID)).rejects.toMatchObject({ code: 'forbidden' });
      expect(JSON.stringify(mockLogWarn.mock.calls)).not.toContain('Metformin');
    });

    it('bozuk yanıtı kabul etmez', async () => {
      // Sunucu beklenmedik bir biçim döndürdüyse yarım veri göstermek,
      // bakım vereni yanlış bilgilendirmek olurdu.
      mockSelectResult.mockReturnValue({ data: [{ id: 'uuid-değil' }], error: null });

      await expect(listMedications(CIRCLE_ID)).rejects.toMatchObject({ code: 'invalid_response' });
    });
  });

  describe('listHealthRecords', () => {
    it('istenen türleri sunucuya iletir', async () => {
      mockSelectResult.mockReturnValue({ data: [recordRow], error: null });

      const records = await listHealthRecords(CIRCLE_ID, ['diagnosis', 'allergy']);

      expect(records[0]?.type).toBe('diagnosis');
      expect(mockInSpy).toHaveBeenCalledWith('record_type', ['diagnosis', 'allergy']);
    });

    it('boş tür listesiyle sunucuya hiç gitmez', async () => {
      // Boş liste "hepsi" demek değildir; bir alerji ekranı yanlışlıkla
      // notları çekmemelidir.
      await expect(listHealthRecords(CIRCLE_ID, [])).resolves.toEqual([]);
      expect(mockFromSpy).not.toHaveBeenCalled();
    });
  });

  describe('searchHealthRecords', () => {
    it('kısa sorguyu sunucuya göndermez', async () => {
      await expect(searchHealthRecords(CIRCLE_ID, 'a')).resolves.toEqual([]);
      expect(mockFromSpy).not.toHaveBeenCalled();
    });

    it('joker karakterleri kaçırır', async () => {
      mockSelectResult.mockReturnValue({ data: [], error: null });

      await searchHealthRecords(CIRCLE_ID, '100%_şeker');

      // Kaçırılmazsa `%` ve `_` joker olur ve kullanıcının yazmadığı
      // satırlar dönerdi.
      expect(mockIlikeSpy).toHaveBeenCalledWith('title', '%100\\%\\_şeker%');
    });

    it('arama metnini loglamaz', async () => {
      mockSelectResult.mockReturnValue({ data: null, error: { code: '08006' } });

      await expect(searchHealthRecords(CIRCLE_ID, 'kanser')).rejects.toMatchObject({
        code: 'network',
      });
      // Kullanıcının aradığı şey de sağlık verisidir.
      expect(JSON.stringify(mockLogWarn.mock.calls)).not.toContain('kanser');
    });
  });

  describe('createMedication', () => {
    it('kaydı yazar ve arayüz biçiminde döndürür', async () => {
      mockInsertResult.mockReturnValue({ data: [medicationRow], error: null });

      const created = await createMedication({
        circleId: CIRCLE_ID,
        name: 'Metformin',
        dosage: '500 mg',
        frequencyText: null,
        startedOn: null,
        endedOn: null,
        prescribedBy: null,
        notes: null,
      });

      expect(created.id).toBe(MEDICATION_ID);
      expect(mockInsertSpy).toHaveBeenCalledWith(
        expect.objectContaining({ circle_id: CIRCLE_ID, name: 'Metformin' }),
      );
    });

    it('başarı log satırına ilaç adını yazmaz', async () => {
      mockInsertResult.mockReturnValue({ data: [medicationRow], error: null });

      await createMedication({
        circleId: CIRCLE_ID,
        name: 'Metformin',
        dosage: null,
        frequencyText: null,
        startedOn: null,
        endedOn: null,
        prescribedBy: null,
        notes: null,
      });

      expect(mockLogInfo).toHaveBeenCalledWith('medication_created', undefined);
      expect(JSON.stringify(mockLogInfo.mock.calls)).not.toContain('Metformin');
    });
  });

  describe('createHealthRecord', () => {
    it('gövde metnini olduğu gibi gönderir', async () => {
      // Sözleşme: sağlık notunun içeriğini bozacak genel metin temizleme
      // yapılmaz.
      const body = '  <b>Sabah</b> 3 kez — ölçüm 140/90  ';
      mockInsertResult.mockReturnValue({ data: [recordRow], error: null });

      await createHealthRecord({
        circleId: CIRCLE_ID,
        type: 'note',
        title: 'Kontrol notu',
        body,
        recordedOn: null,
      });

      expect(mockInsertSpy).toHaveBeenCalledWith(expect.objectContaining({ body }));
    });

    it('başarı log satırına başlık veya gövde yazmaz', async () => {
      mockInsertResult.mockReturnValue({ data: [recordRow], error: null });

      await createHealthRecord({
        circleId: CIRCLE_ID,
        type: 'diagnosis',
        title: 'Tip 2 diyabet',
        body: null,
        recordedOn: null,
      });

      expect(mockLogInfo).toHaveBeenCalledWith('health_record_created', { type: 'diagnosis' });
      expect(JSON.stringify(mockLogInfo.mock.calls)).not.toContain('diyabet');
    });
  });
});
