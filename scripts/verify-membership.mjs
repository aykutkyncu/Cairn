/**
 * Faz 03 doğrulaması: çember kurma ve davet kabulü.
 *
 * Gerçek bir Postgres motorunda (PGlite) atomik üyelik RPC'lerini sınar.
 *
 * NE DOĞRULAR:
 *   - Yeni kullanıcı çember kurabiliyor mu (RLS kısır döngüsü kırıldı mı)
 *   - Doğrudan INSERT ile çember kurulamıyor mu
 *   - Viewer davet oluşturabiliyor mu, owner rolü davetle verilebiliyor mu
 *   - Geçersiz / süresi dolmuş / ikinci kez kullanılan davet reddediliyor mu
 *   - Kabul sonrası rol ve tüketim işareti doğru mu
 *   - Rate limit istemciye kapalı mı ve IP boyutu kullanıyor mu
 *
 * NE DOĞRULAMAZ:
 *   - GERÇEK EŞZAMANLILIK. PGlite tek bağlantılıdır; iki kabul denemesinin
 *     aynı anda çalıştığı yarış senaryosu burada kurulamaz. Atomikliğin
 *     kanıtı, kontrolün ve yazmanın TEK bir UPDATE ifadesinde olmasıdır
 *     (satır kilidi); bunun çok bağlantılı doğrulaması CI'daki pgTAP
 *     koşusuna aittir.
 */
import {
  IDS,
  asUser,
  bootstrap,
  createReporter,
  expectRejected,
  loginAs,
  logout,
  seedBaseData,
} from './lib/pg-harness.mjs';

const reporter = createReporter();
const { check } = reporter;

const main = async () => {
  const db = await bootstrap(reporter);
  await seedBaseData(db);

  // -------------------------------------------------------------------------
  console.log('\n1. Çember kurma');
  // -------------------------------------------------------------------------

  const directInsert = await expectRejected(
    db,
    IDS.newcomer,
    `insert into public.circles (care_recipient_name, created_by) values ('Doğrudan', $1)`,
    [IDS.newcomer],
  );
  check(
    'Çember doğrudan INSERT ile kurulamıyor',
    directInsert.rejected && directInsert.code === '42501',
    `kod=${directInsert.code}`,
  );

  const created = await asUser(db, IDS.newcomer, async () => {
    const r = await db.query(`select public.create_circle_with_owner($1, $2) as id`, [
      'Yeni Bakılan Kişi',
      'Europe/Istanbul',
    ]);
    const circleId = r.rows[0].id;
    return {
      circleId,
      role: (await db.query(`select public.circle_role_of($1) as v`, [circleId])).rows[0].v,
      visible: (await db.query(`select id from public.circles where id = $1`, [circleId])).rows
        .length,
      memberCount: (
        await db.query(`select id from public.circle_members where circle_id = $1`, [circleId])
      ).rows.length,
    };
  });
  check(
    'RPC ile çember kurulabiliyor',
    created.circleId !== null && created.circleId !== undefined,
  );
  check('Kurucu owner rolünü alıyor', created.role === 'owner', created.role);
  check('Kurucu kendi çemberini okuyabiliyor', created.visible === 1);
  check('Tek owner üyeliği oluşuyor', created.memberCount === 1);

  const invalidTimezone = await expectRejected(
    db,
    IDS.newcomer,
    `select public.create_circle_with_owner($1, $2)`,
    ['Test', 'Europe/Istnbul'],
  );
  check('Geçersiz zaman dilimi reddediliyor', invalidTimezone.rejected, invalidTimezone.code ?? '');

  // -------------------------------------------------------------------------
  console.log('\n2. Davet oluşturma yetkisi');
  // -------------------------------------------------------------------------

  const hashValid = Buffer.alloc(32, 1);
  const hashSecond = Buffer.alloc(32, 2);
  const hashExpired = Buffer.alloc(32, 3);
  const hashOtherCircle = Buffer.alloc(32, 4);

  const viewerInvite = await expectRejected(
    db,
    IDS.viewerA,
    `select public.create_circle_invitation($1, $2)`,
    [IDS.circleA, hashValid],
  );
  check(
    'Viewer davet oluşturamıyor',
    viewerInvite.rejected && viewerInvite.code === '42501',
    `kod=${viewerInvite.code}`,
  );

  const strangerInvite = await expectRejected(
    db,
    IDS.ownerB,
    `select public.create_circle_invitation($1, $2)`,
    [IDS.circleA, hashValid],
  );
  check(
    'Yabancı çembere davet oluşturulamıyor',
    strangerInvite.rejected && strangerInvite.code === '42501',
    `kod=${strangerInvite.code} mesaj=${strangerInvite.message}`,
  );

  // Regresyon koruması: bu fonksiyonlar üye olmayan için NULL dönerse
  // PL/pgSQL guard'ları (`if not f() then raise`) sessizce atlanır.
  const strangerFlags = await asUser(db, IDS.ownerB, async () => ({
    canWrite: (await db.query(`select public.can_write_circle($1) as v`, [IDS.circleA])).rows[0].v,
    isOwner: (await db.query(`select public.is_circle_owner($1) as v`, [IDS.circleA])).rows[0].v,
  }));
  check(
    'can_write_circle üye olmayan için false döndürüyor (NULL değil)',
    strangerFlags.canWrite === false,
    String(strangerFlags.canWrite),
  );
  check(
    'is_circle_owner üye olmayan için false döndürüyor (NULL değil)',
    strangerFlags.isOwner === false,
    String(strangerFlags.isOwner),
  );

  const ownerRoleInvite = await expectRejected(
    db,
    IDS.ownerA,
    `select public.create_circle_invitation($1, $2, 'owner')`,
    [IDS.circleA, hashValid],
  );
  check(
    'Davetle owner rolü verilemiyor',
    ownerRoleInvite.rejected && ownerRoleInvite.code === '22023',
    `kod=${ownerRoleInvite.code}`,
  );

  const shortHash = await expectRejected(
    db,
    IDS.ownerA,
    `select public.create_circle_invitation($1, $2)`,
    [IDS.circleA, Buffer.alloc(8, 9)],
  );
  check(
    '32 bayt olmayan hash reddediliyor',
    shortHash.rejected && shortHash.code === '22023',
    `kod=${shortHash.code}`,
  );

  const longTtl = await expectRejected(
    db,
    IDS.ownerA,
    `select public.create_circle_invitation($1, $2, 'caregiver', 30)`,
    [IDS.circleA, hashValid],
  );
  check(
    '7 günden uzun davet ömrü reddediliyor',
    longTtl.rejected && longTtl.code === '22023',
    `kod=${longTtl.code}`,
  );

  // -------------------------------------------------------------------------
  console.log('\n3. Kalıcı davetler hazırlanıyor');
  // -------------------------------------------------------------------------

  await loginAs(db, IDS.ownerA);
  await db.query(`select public.create_circle_invitation($1, $2)`, [IDS.circleA, hashValid]);
  await db.query(`select public.create_circle_invitation($1, $2)`, [IDS.circleA, hashSecond]);
  await logout(db);

  await loginAs(db, IDS.ownerB);
  await db.query(`select public.create_circle_invitation($1, $2)`, [IDS.circleB, hashOtherCircle]);
  await logout(db);

  // Süresi geçmiş davet doğrudan yazılır: RPC geçmiş ömür kabul etmez.
  // created_at da geriye alınır, yoksa expires_at > created_at kısıtı takılır.
  await db.query(
    `insert into public.invitations (circle_id, token_hash, created_at, expires_at, created_by)
     values ($1, $2, now() - interval '10 days', now() - interval '1 day', $3)`,
    [IDS.circleA, hashExpired, IDS.ownerA],
  );
  check('Test davetleri oluşturuldu', true);

  const hashless = await db.query(
    `select count(*)::int as n from public.invitations where token_hash is null`,
  );
  check('Hash’siz davet satırı yok', hashless.rows[0].n === 0);

  // -------------------------------------------------------------------------
  console.log('\n4. Davet kabulü: reddedilen durumlar');
  // -------------------------------------------------------------------------

  const bogus = await expectRejected(
    db,
    IDS.newcomer,
    `select public.accept_circle_invitation($1)`,
    [Buffer.alloc(32, 200)],
  );
  check(
    'Var olmayan davet reddediliyor',
    bogus.rejected && bogus.message.includes('geçersiz'),
    bogus.message,
  );

  const expired = await expectRejected(
    db,
    IDS.newcomer,
    `select public.accept_circle_invitation($1)`,
    [hashExpired],
  );
  check(
    'Süresi dolmuş davet reddediliyor',
    expired.rejected && expired.message.includes('süresi dolmuş'),
    expired.message,
  );

  // -------------------------------------------------------------------------
  console.log('\n5. Davet kabulü: başarılı akış');
  // -------------------------------------------------------------------------

  await loginAs(db, IDS.newcomer);
  const acceptedCircle = (
    await db.query(`select public.accept_circle_invitation($1) as id`, [hashValid])
  ).rows[0].id;
  check('Geçerli davet kabul ediliyor', acceptedCircle === IDS.circleA, acceptedCircle);

  const roleAfterAccept = (await db.query(`select public.circle_role_of($1) as v`, [IDS.circleA]))
    .rows[0].v;
  check('Kabul eden caregiver rolünü alıyor', roleAfterAccept === 'caregiver', roleAfterAccept);

  const seesCircle = await db.query(`select id from public.circles where id = $1`, [IDS.circleA]);
  check('Kabul eden çemberi görebiliyor', seesCircle.rows.length === 1);

  const seesOtherCircle = await db.query(`select id from public.circles where id = $1`, [
    IDS.circleB,
  ]);
  check('Kabul eden yalnız katıldığı çemberi görüyor', seesOtherCircle.rows.length === 0);

  let secondUse = false;
  let secondUseMessage = '';
  try {
    await db.query(`select public.accept_circle_invitation($1)`, [hashValid]);
  } catch (error) {
    secondUse = true;
    secondUseMessage = error.message;
  }
  check(
    'Aynı davet ikinci kez kabul edilemiyor',
    secondUse && secondUseMessage.includes('daha önce kullanılmış'),
    secondUseMessage,
  );
  await logout(db);

  const usedRow = await db.query(
    `select used_at, used_by from public.invitations where token_hash = $1`,
    [hashValid],
  );
  check('Kullanılan davet used_at ile işaretleniyor', usedRow.rows[0].used_at !== null);
  check('Daveti kullanan kullanıcı kaydediliyor', usedRow.rows[0].used_by === IDS.newcomer);

  // -------------------------------------------------------------------------
  console.log('\n6. Rol koruması: mevcut owner düşürülmüyor');
  // -------------------------------------------------------------------------

  await loginAs(db, IDS.ownerA);
  await db.query(`select public.accept_circle_invitation($1)`, [hashSecond]);
  const ownerRoleAfter = (await db.query(`select public.circle_role_of($1) as v`, [IDS.circleA]))
    .rows[0].v;
  check(
    'Owner, caregiver davetini kabul edince owner kalıyor',
    ownerRoleAfter === 'owner',
    ownerRoleAfter,
  );
  await logout(db);

  // -------------------------------------------------------------------------
  console.log('\n7. Rate limit');
  // -------------------------------------------------------------------------

  const rateLimitPolicies = await db.query(
    `select count(*)::int as n from pg_policies
     where schemaname = 'public' and tablename = 'rate_limit_buckets'`,
  );
  check('rate_limit_buckets istemciye kapalı (politika yok)', rateLimitPolicies.rows[0].n === 0);

  const rlsOn = await db.query(
    `select relrowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relname = 'rate_limit_buckets'`,
  );
  check('rate_limit_buckets üzerinde RLS açık', rlsOn.rows[0].relrowsecurity === true);

  // Sınır fonksiyonu istemciye kapalıdır: doğrudan çağrı yetki hatası verir.
  const directLimitCall = await expectRejected(
    db,
    IDS.ownerA,
    `select public.enforce_rate_limit('invite_accept', 'x', 5, 3600)`,
  );
  check(
    'enforce_rate_limit istemciden çağrılamıyor',
    directLimitCall.rejected && directLimitCall.code === '42501',
    `kod=${directLimitCall.code}`,
  );

  // Gerçek sınır: kullanıcı başına saatte 10 davet. Denemeler geri alınacak bir
  // transaction içinde yapılır, kalıcı sayaç bozulmasın.
  const exhaustion = await asUser(db, IDS.ownerA, async () => {
    for (let attempt = 1; attempt <= 25; attempt += 1) {
      try {
        await db.query(`select public.create_circle_invitation($1, $2)`, [
          IDS.circleA,
          Buffer.alloc(32, 100 + attempt),
        ]);
      } catch (error) {
        return {
          attempt,
          code: error?.cause?.code ?? error?.code ?? null,
          message: error.message,
        };
      }
    }
    return { attempt: null, code: null, message: 'sınıra hiç ulaşılmadı' };
  });
  check(
    'Davet oluşturma sınırı aşılınca 53400 ile reddediliyor',
    exhaustion.code === '53400',
    `deneme=${exhaustion.attempt} kod=${exhaustion.code}`,
  );
  check(
    'Sınır makul bir deneme sayısında devreye giriyor',
    exhaustion.attempt !== null && exhaustion.attempt <= 25,
    `deneme=${exhaustion.attempt}`,
  );

  const ipColumns = await db.query(
    `select column_name from information_schema.columns
     where table_schema = 'public' and table_name = 'rate_limit_buckets'
       and column_name in ('ip', 'ip_address', 'client_ip', 'forwarded_for')`,
  );
  check('Rate limit IP boyutu kullanmıyor', ipColumns.rows.length === 0);

  // -------------------------------------------------------------------------
  console.log('\n8. RPC sertleştirmesi');
  // -------------------------------------------------------------------------

  const rpcNames = [
    'create_circle_with_owner',
    'create_circle_invitation',
    'accept_circle_invitation',
    'enforce_rate_limit',
  ];

  const definerCheck = await db.query(
    `select p.proname, p.prosecdef, p.proconfig,
            has_function_privilege('public', p.oid, 'execute') as public_exec
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname = any($1)`,
    [rpcNames],
  );
  check('Tüm üyelik RPC’leri tanımlı', definerCheck.rows.length === rpcNames.length);
  check(
    'Tümü SECURITY DEFINER',
    definerCheck.rows.every((r) => r.prosecdef),
  );
  check(
    'Tümünde search_path sabit',
    definerCheck.rows.every((r) => (r.proconfig ?? []).some((c) => c.startsWith('search_path='))),
  );
  check(
    'Hiçbirinde PUBLIC execute yok',
    definerCheck.rows.every((r) => !r.public_exec),
  );

  await db.close();
  reporter.finish('Üyelik RPC doğrulaması');
};

try {
  await main();
} catch (error) {
  console.error(`\nBeklenmeyen hata: ${error.message}`);
  if (error.query) console.error(`Sorgu: ${error.query}`);
  process.exit(1);
}
