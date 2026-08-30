import { supabase } from './supabaseClient';

const DAILY_TARGET = 10;

// السبت = 6 والأحد = 0
export function isWeekend(date) {
  const day = date.getDay();
  return day === 0 || day === 6;
}

export function getLocalDate() {
  const offsetHours = parseInt(process.env.TIMEZONE_OFFSET_HOURS || '3', 10);
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  return new Date(utc + offsetHours * 3600000);
}

export async function generateDailyList({ force = false } = {}) {
  const localDate = getLocalDate();
  const dateStr = localDate.toISOString().slice(0, 10);

  if (!force && isWeekend(localDate)) {
    return { skipped: true, reason: 'weekend', date: dateStr };
  }

  const { data: existingLog } = await supabase
    .from('daily_logs')
    .select('*')
    .eq('run_date', dateStr)
    .maybeSingle();

  if (existingLog && !force) {
    const { data: contacts } = await supabase
      .from('contacts')
      .select('*, groups(name)')
      .in('id', existingLog.contact_ids);
    return {
      skipped: true,
      reason: 'already_generated',
      date: dateStr,
      contacts: contacts || [],
    };
  }

  const { data: groups, error: groupsErr } = await supabase
    .from('groups')
    .select('*')
    .order('order_index', { ascending: true });
  if (groupsErr) throw groupsErr;
  if (!groups || groups.length === 0) {
    return { skipped: true, reason: 'no_groups', date: dateStr };
  }

  const { data: rotationState, error: stateErr } = await supabase
    .from('rotation_state')
    .select('*')
    .eq('id', 1)
    .maybeSingle();
  if (stateErr) throw stateErr;

  let startIndex = rotationState?.current_group_index || 0;
  if (startIndex >= groups.length) startIndex = 0;

  const { data: pendingContacts, error: contactsErr } = await supabase
    .from('contacts')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: true });
  if (contactsErr) throw contactsErr;

  const contactsByGroup = {};
  for (const g of groups) contactsByGroup[g.id] = [];
  for (const c of pendingContacts || []) {
    if (contactsByGroup[c.group_id]) contactsByGroup[c.group_id].push(c);
  }

  // نلف على المجموعات بالترتيب بدءاً من نقطة التوقف السابقة، ونسحب من كل
  // مجموعة أكبر عدد ممكن حتى نكتمل 10، وإذا نفدت مجموعة ننتقل للتي تليها
  let need = DAILY_TARGET;
  const selected = [];
  let idx = startIndex;
  let visitedGroups = 0;

  while (need > 0 && visitedGroups < groups.length) {
    const group = groups[idx];
    const pool = contactsByGroup[group.id] || [];
    const take = pool.slice(0, need);
    for (const c of take) selected.push(c);
    need -= take.length;
    idx = (idx + 1) % groups.length;
    visitedGroups++;
  }

  if (selected.length === 0) {
    return { skipped: true, reason: 'no_pending_contacts', date: dateStr };
  }

  const idsToMark = selected.map((c) => c.id);
  const { error: updateErr } = await supabase
    .from('contacts')
    .update({ status: 'done', updated_at: new Date().toISOString() })
    .in('id', idsToMark);
  if (updateErr) throw updateErr;

  const { error: logErr } = await supabase
    .from('daily_logs')
    .upsert({ run_date: dateStr, contact_ids: idsToMark }, { onConflict: 'run_date' });
  if (logErr) throw logErr;

  await supabase
    .from('rotation_state')
    .upsert({ id: 1, current_group_index: idx, last_run_date: dateStr });

  return {
    skipped: false,
    date: dateStr,
    contacts: selected,
    remainingUnfilled: need,
  };
}

export function formatTelegramMessage(dateStr, contacts, remainingUnfilled) {
  let msg = `📞 <b>قائمة المتابعة اليومية</b>\n📅 ${dateStr}\n\n`;
  contacts.forEach((c, i) => {
    msg += `${i + 1}. ${c.name} — ${c.phone}\n`;
  });
  if (remainingUnfilled && remainingUnfilled > 0) {
    msg += `\n⚠️ لم يتم إيجاد سوى ${contacts.length} من أصل 10 (القوائم أوشكت على الانتهاء).`;
  }
  msg += `\n✅ العدد الكلي: ${contacts.length}`;
  return msg;
}
