import { z } from 'zod';

import { parseAtBoundary } from '../boundary';

/**
 * Sınır doğrulaması testleri.
 *
 * Kritik davranış: parse hatası raporlanırken doğrulanan DEĞER hiçbir yere
 * çıkmaz. Yalnız şema adı, işlem adı ve alan yolu taşınır.
 */

const medicationSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  dose: z.string().min(1),
});

describe('parseAtBoundary', () => {
  it('geçerli veriyi tiplenmiş biçimde döndürür', () => {
    // Arrange
    const value = {
      id: '11111111-1111-4111-8111-111111111111',
      name: 'Metformin',
      dose: '850 mg',
    };

    // Act
    const result = parseAtBoundary(medicationSchema, 'medication', 'get_medication', value);

    // Assert
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.name).toBe('Metformin');
  });

  it('hata durumunda değeri değil, yalnız alan yolunu raporlar', () => {
    // Arrange: adı geçerli ama dozu eksik bir kayıt.
    const value = { id: 'geçersiz-uuid', name: 'Metformin', dose: '' };

    // Act
    const result = parseAtBoundary(medicationSchema, 'medication', 'get_medication', value);

    // Assert
    expect(result.ok).toBe(false);
    if (result.ok) return;

    const serialized = JSON.stringify(result.issue);
    expect(result.issue.schema).toBe('medication');
    expect(result.issue.operation).toBe('get_medication');
    expect(result.issue.paths).toEqual(expect.arrayContaining(['id', 'dose']));
    expect(serialized).not.toContain('Metformin');
    expect(serialized).not.toContain('geçersiz-uuid');
  });

  it('kök seviyedeki tip hatasında yolu açıkça adlandırır', () => {
    // Act
    const result = parseAtBoundary(z.array(medicationSchema), 'list', 'list_medications', 'metin');

    // Assert
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issue.paths).toEqual(['(kök)']);
  });

  it('çok sayıda hatada raporlanan yol sayısını sınırlar', () => {
    // Arrange: 20 elemanlı, hepsi geçersiz bir liste.
    const invalidList = Array.from({ length: 20 }, () => ({ id: 'x', name: '', dose: '' }));

    // Act
    const result = parseAtBoundary(
      z.array(medicationSchema),
      'list',
      'list_medications',
      invalidList,
    );

    // Assert
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issue.issueCount).toBeGreaterThan(10);
      expect(result.issue.paths.length).toBe(10);
    }
  });
});
