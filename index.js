import { useEffect, useState } from 'react';

async function api(path, options) {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'حدث خطأ');
  return data;
}

export default function Home() {
  const [tab, setTab] = useState('today');

  return (
    <div className="container">
      <div className="header">
        <h1>📋 متابعة جهات الاتصال</h1>
        <p>10 اتصالات يومياً • تخطي عطلة نهاية الأسبوع • تناوب تلقائي بين المجموعات</p>
      </div>

      <div className="tabs">
        <div className={`tab ${tab === 'today' ? 'active' : ''}`} onClick={() => setTab('today')}>اليوم</div>
        <div className={`tab ${tab === 'contacts' ? 'active' : ''}`} onClick={() => setTab('contacts')}>جهات الاتصال</div>
        <div className={`tab ${tab === 'groups' ? 'active' : ''}`} onClick={() => setTab('groups')}>المجموعات</div>
      </div>

      {tab === 'today' && <TodayTab />}
      {tab === 'contacts' && <ContactsTab />}
      {tab === 'groups' && <GroupsTab />}
    </div>
  );
}

function StatusMsg({ msg }) {
  if (!msg) return null;
  return <div className={`status-box ${msg.type}`}>{msg.text}</div>;
}

function TodayTab() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  async function load() {
    setLoading(true);
    try {
      const d = await api('/api/daily/today');
      setData(d);
    } catch (e) {
      setMsg({ type: 'error', text: e.message });
    }
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function generate(sendToTelegram) {
    setBusy(true);
    setMsg(null);
    try {
      const r = await api('/api/daily/generate', {
        method: 'POST',
        body: JSON.stringify({ sendToTelegram }),
      });
      if (r.skipped) {
        const reasons = {
          weekend: 'اليوم عطلة نهاية أسبوع، لا يتم اختيار قائمة.',
          already_generated: 'تم توليد قائمة اليوم مسبقاً.',
          no_groups: 'لا توجد مجموعات بعد، أضف مجموعات أولاً.',
          no_pending_contacts: 'لا توجد جهات اتصال بحالة "لم يُتصل بها" لاختيارها.',
        };
        setMsg({ type: 'error', text: reasons[r.reason] || 'تم التخطي.' });
      } else {
        setMsg({
          type: 'success',
          text: r.telegramSent
            ? `تم توليد ${r.contacts.length} جهة اتصال وإرسالها إلى تيليجرام ✅`
            : `تم توليد ${r.contacts.length} جهة اتصال ✅`,
        });
      }
      await load();
    } catch (e) {
      setMsg({ type: 'error', text: e.message });
    }
    setBusy(false);
  }

  return (
    <div>
      <div className="card">
        <h2>قائمة اليوم {data ? `— ${data.date}` : ''}</h2>
        <StatusMsg msg={msg} />
        <button onClick={() => generate(false)} disabled={busy}>
          {busy ? 'جارٍ التوليد...' : 'توليد قائمة اليوم'}
        </button>
        <button className="secondary" onClick={() => generate(true)} disabled={busy}>
          توليد + إرسال إلى تيليجرام الآن
        </button>
      </div>

      <div className="card">
        <h2>الأسماء ({data?.contacts?.length || 0})</h2>
        {loading && <div className="empty">جارٍ التحميل...</div>}
        {!loading && (!data || data.contacts.length === 0) && (
          <div className="empty">لا توجد قائمة لهذا اليوم بعد</div>
        )}
        {!loading && data && data.contacts.map((c) => (
          <div className="row" key={c.id}>
            <div className="row-info">
              <div className="row-name">{c.name}</div>
              <div className="row-sub">{c.phone} • {c.groups?.name || ''}</div>
            </div>
            <span className="badge done">تم</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ContactsTab() {
  const [contacts, setContacts] = useState([]);
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState(null);
  const [filter, setFilter] = useState('');

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [groupId, setGroupId] = useState('');
  const [bulk, setBulk] = useState('');

  async function load() {
    setLoading(true);
    try {
      const [c, g] = await Promise.all([api('/api/contacts'), api('/api/groups')]);
      setContacts(c);
      setGroups(g);
    } catch (e) {
      setMsg({ type: 'error', text: e.message });
    }
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function addSingle(e) {
    e.preventDefault();
    setMsg(null);
    try {
      await api('/api/contacts', {
        method: 'POST',
        body: JSON.stringify({ name, phone, group_id: groupId }),
      });
      setName(''); setPhone(''); setGroupId('');
      setMsg({ type: 'success', text: 'تمت إضافة جهة الاتصال ✅' });
      load();
    } catch (e) {
      setMsg({ type: 'error', text: e.message });
    }
  }

  async function addBulk(e) {
    e.preventDefault();
    setMsg(null);
    try {
      const r = await api('/api/contacts', { method: 'POST', body: JSON.stringify({ bulk }) });
      setBulk('');
      setMsg({ type: 'success', text: `تم استيراد ${r.inserted} جهة اتصال ✅` });
      load();
    } catch (e) {
      setMsg({ type: 'error', text: e.message });
    }
  }

  async function toggleStatus(c) {
    try {
      await api(`/api/contacts/${c.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: c.status === 'pending' ? 'done' : 'pending' }),
      });
      load();
    } catch (e) {
      setMsg({ type: 'error', text: e.message });
    }
  }

  async function remove(id) {
    try {
      await api(`/api/contacts/${id}`, { method: 'DELETE' });
      load();
    } catch (e) {
      setMsg({ type: 'error', text: e.message });
    }
  }

  const filtered = contacts.filter((c) =>
    c.name.toLowerCase().includes(filter.toLowerCase()) || c.phone.includes(filter)
  );

  return (
    <div>
      <StatusMsg msg={msg} />

      <div className="card">
        <h2>إضافة جهة اتصال واحدة</h2>
        <form onSubmit={addSingle}>
          <input placeholder="الاسم" value={name} onChange={(e) => setName(e.target.value)} required />
          <input placeholder="رقم الهاتف" value={phone} onChange={(e) => setPhone(e.target.value)} required />
          <select value={groupId} onChange={(e) => setGroupId(e.target.value)} required>
            <option value="">اختر المجموعة</option>
            {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
          <button type="submit">إضافة</button>
        </form>
      </div>

      <div className="card">
        <h2>استيراد جماعي</h2>
        <p className="row-sub" style={{ marginBottom: 8 }}>
          كل سطر بصيغة: الاسم,الرقم,اسم المجموعة — إذا كانت المجموعة غير موجودة سيتم إنشاؤها تلقائياً
        </p>
        <form onSubmit={addBulk}>
          <textarea
            placeholder={'مثال:\nأحمد علي,0500000000,عملاء جدد\nسارة محمد,0511111111,متابعة'}
            value={bulk}
            onChange={(e) => setBulk(e.target.value)}
            required
          />
          <button type="submit">استيراد</button>
        </form>
      </div>

      <div className="card">
        <h2>كل جهات الاتصال ({contacts.length})</h2>
        <input placeholder="بحث بالاسم أو الرقم..." value={filter} onChange={(e) => setFilter(e.target.value)} />
        {loading && <div className="empty">جارٍ التحميل...</div>}
        {!loading && filtered.length === 0 && <div className="empty">لا توجد نتائج</div>}
        {!loading && filtered.map((c) => (
          <div className="row" key={c.id}>
            <div className="row-info">
              <div className="row-name">{c.name}</div>
              <div className="row-sub">{c.phone} • {c.groups?.name || ''}</div>
            </div>
            <span className={`badge ${c.status}`} style={{ cursor: 'pointer' }} onClick={() => toggleStatus(c)}>
              {c.status === 'pending' ? 'لم يُتصل' : 'تم'}
            </span>
            <button className="danger small-btn" onClick={() => remove(c.id)}>حذف</button>
          </div>
        ))}
      </div>
    </div>
  );
}

function GroupsTab() {
  const [groups, setGroups] = useState([]);
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState(null);

  async function load() {
    setLoading(true);
    try {
      const g = await api('/api/groups');
      setGroups(g);
    } catch (e) {
      setMsg({ type: 'error', text: e.message });
    }
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function add(e) {
    e.preventDefault();
    setMsg(null);
    try {
      await api('/api/groups', { method: 'POST', body: JSON.stringify({ name }) });
      setName('');
      load();
    } catch (e) {
      setMsg({ type: 'error', text: e.message });
    }
  }

  async function remove(id) {
    try {
      await api(`/api/groups?id=${id}`, { method: 'DELETE' });
      load();
    } catch (e) {
      setMsg({ type: 'error', text: e.message });
    }
  }

  return (
    <div>
      <StatusMsg msg={msg} />
      <div className="card">
        <h2>إضافة مجموعة جديدة</h2>
        <form onSubmit={add}>
          <input placeholder="اسم المجموعة" value={name} onChange={(e) => setName(e.target.value)} required />
          <button type="submit">إضافة</button>
        </form>
      </div>

      <div className="card">
        <h2>ترتيب التناوب بين المجموعات ({groups.length})</h2>
        <p className="row-sub" style={{ marginBottom: 8 }}>
          الاختيار اليومي يبدأ من المجموعة الأولى ثم ينتقل تلقائياً للتالية عند نفاد الأسماء
        </p>
        {loading && <div className="empty">جارٍ التحميل...</div>}
        {!loading && groups.length === 0 && <div className="empty">لا توجد مجموعات بعد</div>}
        {!loading && groups.map((g, i) => (
          <div className="row" key={g.id}>
            <div className="row-info">
              <div className="row-name">{i + 1}. {g.name}</div>
            </div>
            <button className="danger small-btn" onClick={() => remove(g.id)}>حذف</button>
          </div>
        ))}
      </div>
    </div>
  );
}
