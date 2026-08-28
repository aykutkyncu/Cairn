-- 0001_foundation.sql
-- Cairn temel altyapısı: uzantılar, enum'lar ve paylaşılan trigger fonksiyonları.
--
-- Sözleşme kararları:
--   * Zaman damgaları daima timestamptz.
--   * Para daima integer minor unit (kuruş); float kullanılmaz.
--   * Roller PostgreSQL enum'udur.
--   * Silme fiziksel değildir: deleted_at + sync_tombstones ile senkronizasyona görünür.
--   * Değişebilir kaynaklarda revision, çakışma çözümü için trigger ile artar.

create extension if not exists "pgcrypto" with schema extensions;

-- ---------------------------------------------------------------------------
-- Enum'lar
-- ---------------------------------------------------------------------------

-- Çember içi yetki. Sıralama bilinçli: owner > caregiver > viewer.
create type public.circle_role as enum ('owner', 'caregiver', 'viewer');

-- Üyelik yaşam döngüsü. 'invited' davet kabul edilmeden önceki geçici durumdur.
create type public.membership_state as enum ('invited', 'active', 'removed');

-- Görev türü. 'other' bilinçli olarak vardır; kullanıcıyı tür seçmeye zorlamayız.
create type public.task_kind as enum ('medication', 'appointment', 'visit', 'other');

-- Tamamlama kaydının türü. 'void' geri alma için üretilir; completion silinmez.
create type public.completion_kind as enum ('done', 'skipped', 'void');

-- Masraf bölüşüm yöntemi. Snapshot olarak saklanır, sonradan değişmez.
create type public.split_method as enum ('equal', 'percentage', 'fixed');

-- Rıza türü. Sağlık verisi işleme ve harici aktarım ayrı ayrı rıza gerektirir.
create type public.consent_kind as enum (
  'health_data_processing',
  'external_ai_processing',
  'audio_recording',
  'push_notifications'
);

-- Denetim olayı türü.
create type public.audit_action as enum ('insert', 'update', 'delete');

-- ---------------------------------------------------------------------------
-- Paylaşılan trigger fonksiyonları
-- ---------------------------------------------------------------------------

-- updated_at'i sunucu saatinden yazar. İstemciden gelen updated_at'e güvenilmez.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

comment on function public.set_updated_at() is
  'updated_at alanını sunucu saatiyle günceller. İstemci değeri yok sayılır.';

-- revision'ı her gerçek güncellemede bir artırır.
-- Offline senkronizasyonda base_revision karşılaştırması buna dayanır; bu yüzden
-- istemcinin gönderdiği revision değeri asla kabul edilmez.
create or replace function public.bump_revision()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  new.revision := old.revision + 1;
  new.updated_at := now();
  return new;
end;
$$;

comment on function public.bump_revision() is
  'Her güncellemede revision değerini bir artırır. İstemci revision gönderemez.';
