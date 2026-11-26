
'use strict';

// ====================================
// Supabase接続情報
// この3行を取得した情報に置き換える
// ====================================

const SUPABASE_URL = 'https://sebeasemgrjjraqbgrog.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNlYmVhc2VtZ3JqanJhcWJncm9nIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTU2MTc3NjMsImV4cCI6MjExMTE5Mzc2M30.Ui5cu1cPnbfNPG2OMgoUPrhfAhtP4Xr9yej_aqZUDLg';
const OWNER_UID = 'd1b54c0e-c9f1-44b2-b10d-ca5d52140d7f';

// ====================================

const $ = id => document.getElementById(id);

const db = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_KEY
);

const months = [
  'January', 'February', 'March',
  'April', 'May', 'June',
  'July', 'August', 'September',
  'October', 'November', 'December'
];

const weekdays = [
  'sun.', 'mon.', 'tue.', 'wed.',
  'thu.', 'fri.', 'sat.'
];

const pad = n => String(n).padStart(2, '0');

const dateKey = d =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

const yesterday = () => {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return dateKey(d);
};

let entries = [];
let isOwner = false;
let activeMonth = yesterday().slice(0, 7);
let archiveYear = Number(activeMonth.slice(0, 4));

const DRAFT_KEY = `yesterday-draft-${OWNER_UID}`;

// HTML要素を生成

const el = (tag, cls, text) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
};

// ====================================
// ログイン・ログアウト
// ====================================

async function updateAuth(session) {
  isOwner = session?.user?.id === OWNER_UID;

  $('write-toggle').hidden = !isOwner;
  $('login-toggle').textContent =
    isOwner ? 'logout' : 'login';

  if (!isOwner) {
    closeComposer();
    $('entry-body').value = '';
    $('entry-date').value = '';
  } else {
    $('login-form').hidden = true;
    restoreDraft();
  }

  render();
}

$('login-toggle').onclick = async () => {
  if (isOwner) {
    saveDraft();

    const { error } = await db.auth.signOut();

    if (error) {
      alert('ログアウトできませんでした。');
      return;
    }

    await updateAuth(null);
    return;
  }

  $('login-form').hidden =
    !$('login-form').hidden;

  if (!$('login-form').hidden) {
    $('login-form').scrollIntoView({
      behavior: 'smooth',
      block: 'end'
    });

    $('login-email').focus({
      preventScroll: true
    });
  }
};

$('login-form').onsubmit = async e => {
  e.preventDefault();

  const button =
    $('login-form').querySelector('[type="submit"]');

  button.disabled = true;
  $('login-message').textContent = 'ログイン中…';

  try {
    const { data, error } =
      await db.auth.signInWithPassword({
        email: $('login-email').value.trim(),
        password: $('login-password').value
      });

    if (error) {
      $('login-message').textContent =
        'ログインできませんでした。';
      return;
    }

    if (data.user?.id !== OWNER_UID) {
      await db.auth.signOut();

      $('login-message').textContent =
        'このアカウントでは編集できません。';
      return;
    }

    $('login-password').value = '';
    $('login-message').textContent = '';
    $('login-form').hidden = true;

    await updateAuth(data.session);
    await loadEntries();

  } catch (error) {
    $('login-message').textContent =
      '通信エラーが発生しました。';
    console.error(error);

  } finally {
    button.disabled = false;
  }
};

// ====================================
// 下書きの自動保存
// ====================================

function saveDraft() {
  if (!isOwner) return;

  try {
    const body = $('entry-body').value;

    if (!body.trim()) {
      localStorage.removeItem(DRAFT_KEY);
      $('draft-status').textContent = '';
      return;
    }

    const draft = {
      date: $('entry-date').value,
      body: body
    };

    localStorage.setItem(
      DRAFT_KEY,
      JSON.stringify(draft)
    );

    $('draft-status').textContent =
      'draft saved';

  } catch (error) {
    $('draft-status').textContent =
      '下書きを保存できませんでした。';
  }
}

function restoreDraft() {
  if (!isOwner) return;

  try {
    const raw = localStorage.getItem(DRAFT_KEY);

    if (raw) {
      const draft = JSON.parse(raw);

      $('entry-date').value =
        draft.date || yesterday();

      $('entry-body').value =
        draft.body || '';

      $('draft-status').textContent =
        'draft restored';

    } else {
      $('entry-date').value = yesterday();
      $('entry-body').value = '';
      $('draft-status').textContent = '';
    }

  } catch (error) {
    console.error(error);
  }
}

$('entry-body').addEventListener(
  'input',
  saveDraft
);

$('entry-date').addEventListener(
  'change',
  saveDraft
);

// ====================================
// データベースから日記を読み込む
// ====================================

async function loadEntries() {
  $('page-message').textContent = 'loading...';

  try {
    const result = [];
    const pageSize = 500;
    let offset = 0;

    while (true) {
      const { data, error } = await db
        .from('yesterday_entries')
        .select('id, entry_date, body')
        .order('entry_date', { ascending: false })
        .range(offset, offset + pageSize - 1);

      if (error) throw error;

      result.push(...data);

      if (data.length < pageSize) break;

      offset += pageSize;
    }

    entries = result.map(entry => ({
      id: entry.id,
      date: entry.entry_date,
      body: entry.body
    }));

    $('page-message').textContent =
      entries.length ? '' : 'まだ日記がありません。';

    render();

  } catch (error) {
    console.error('読み込みエラー:', error);

    $('page-message').textContent =
      '日記を読み込めませんでした。';
  }
}

// ====================================
// ヘッダー・アーカイブ
// ====================================

function setMonth(key) {
  activeMonth = key;

  const [y, m] = key.split('-').map(Number);

  $('current-month').textContent =
    `${months[m - 1]}, ${y}`;
}

function closeArchive() {
  $('archive').hidden = true;

  $('archive-toggle').setAttribute(
    'aria-expanded',
    'false'
  );
}

function closeComposer() {
  $('composer').hidden = true;
  $('write-toggle').textContent = 'write';
}

function renderArchive() {
  $('archive-year').textContent = archiveYear;

  const years = entries.map(
    e => Number(e.date.slice(0, 4))
  );

  $('prev-year').disabled =
    !years.length ||
    archiveYear <= Math.min(...years);

  $('next-year').disabled =
    !years.length ||
    archiveYear >= Math.max(...years);

  $('archive-months').replaceChildren();

  months.forEach((m, i) => {
    const key = `${archiveYear}-${pad(i + 1)}`;

    const b = el(
      'button',
      '',
      m.slice(0, 3) + '.'
    );

    b.type = 'button';

    b.disabled = !entries.some(
      e => e.date.startsWith(key)
    );

    if (key === activeMonth) {
      b.setAttribute('aria-current', 'true');
    }

    b.onclick = () => {
      closeArchive();
      setMonth(key);

      $('month-' + key)?.scrollIntoView({
        behavior: 'smooth'
      });
    };

    $('archive-months').append(b);
  });
}

// ====================================
// 日記一覧の表示
// ====================================

function render() {
  $('entries').replaceChildren();

  if (!entries.length) {
    setMonth(yesterday().slice(0, 7));
    return;
  }

  let key = '';
  let section;

  entries.sort(
    (a, b) => b.date.localeCompare(a.date)
  );

  entries.forEach(entry => {
    const k = entry.date.slice(0, 7);

    if (k !== key) {
      key = k;

      section = el('section', 'diary-month');
      section.id = 'month-' + k;
      section.dataset.month = k;

      section.append(
        el('h2', '', months[Number(k.slice(5)) - 1]),
        el('p', 'diary-year', k.slice(0, 4))
      );

      $('entries').append(section);
    }

    const article = el('article', 'diary-entry');
    const head = el('div', 'diary-entry-head');

    const d = new Date(entry.date + 'T12:00:00');

    const label =
      `${pad(d.getMonth() + 1)}.${pad(d.getDate())} ${weekdays[d.getDay()]}`;

    const time = el('time', '', label);
    time.dateTime = entry.date;

    const body = el(
      'p',
      'diary-text',
      entry.body
    );

    head.append(time, el('span', 'line'));

    // ログイン中のみeditを表示

    if (isOwner) {
      const edit = el('button', '', 'edit');
      edit.type = 'button';

      edit.onclick = () => {
        openEditor(article, body, entry);
      };

      head.append(edit);
    }

    article.append(head, body);
    section.append(article);
  });

  updateScroll();
}

// ====================================
// 日記の編集・保存
// ====================================

function openEditor(article, body, entry) {
  if (!isOwner) return;
  if (article.querySelector('form')) return;

  const f = el('form', 'diary-form');
  const t = el('textarea');

  t.value = entry.body;
  t.rows = 5;
  t.required = true;

  t.setAttribute(
    'aria-label',
    '日記を編集'
  );

  const actions = el('div', 'diary-actions');
  const message = el('span', 'diary-note');
  const cancel = el('button', '', 'cancel');
  const save = el('button', '', 'save');

  cancel.type = 'button';
  save.type = 'submit';

  actions.append(message, cancel, save);
  f.append(t, actions);

  body.hidden = true;
  article.append(f);
  t.focus();

  cancel.onclick = () => {
    f.remove();
    body.hidden = false;
  };

  f.onsubmit = async e => {
    e.preventDefault();

    if (!isOwner || !t.value.trim()) return;

    save.disabled = true;
    cancel.disabled = true;
    message.textContent = 'saving...';

    try {
      const { data, error } = await db
        .from('yesterday_entries')
        .update({
          body: t.value,
          updated_at: new Date().toISOString()
        })
        .eq('id', entry.id)
        .select('id')
        .single();

      if (error || !data) {
        throw error || new Error('更新失敗');
      }

      entry.body = t.value;
      body.textContent = entry.body;

      f.remove();
      body.hidden = false;

    } catch (error) {
      console.error(error);

      message.textContent =
        '保存できませんでした。';

    } finally {
      save.disabled = false;
      cancel.disabled = false;
    }
  };
}

// ====================================
// スクロールに合わせて年月を更新
// ====================================

function updateScroll() {
  const sections = [
    ...document.querySelectorAll('.diary-month')
  ];

  if (!sections.length) return;

  let current = sections[0];

  const edge =
    $('toolbar').getBoundingClientRect().bottom + 24;

  for (const s of sections) {
    if (s.getBoundingClientRect().top <= edge) {
      current = s;
    }
  }

  setMonth(current.dataset.month);
}

// ====================================
// ボタン操作
// ====================================

$('archive-toggle').onclick = () => {
  if (!$('archive').hidden) {
    closeArchive();
    return;
  }

  closeComposer();

  archiveYear = Number(
    activeMonth.slice(0, 4)
  );

  renderArchive();

  $('archive').hidden = false;

  $('archive-toggle').setAttribute(
    'aria-expanded',
    'true'
  );
};

$('prev-year').onclick = () => {
  archiveYear--;
  renderArchive();
};

$('next-year').onclick = () => {
  archiveYear++;
  renderArchive();
};

$('write-toggle').onclick = () => {
  if (!isOwner) return;

  if (!$('composer').hidden) {
    saveDraft();
    closeComposer();
    return;
  }

  closeArchive();

  $('composer').hidden = false;
  $('write-toggle').textContent = 'close';

  if (!$('entry-body').value.trim()) {
    $('entry-date').value = yesterday();
  }

  $('composer').scrollIntoView({
    behavior: 'smooth',
    block: 'start'
  });

  $('entry-body').focus({
    preventScroll: true
  });
};

// ====================================
// 新しい日記をデータベースに保存
// ====================================

$('composer').onsubmit = async e => {
  e.preventDefault();

  if (!isOwner) return;

  const date = $('entry-date').value;
  const body = $('entry-body').value;

  if (!date || !body.trim()) return;

  if (entries.some(x => x.date === date)) {
    $('composer-message').textContent =
      'この日付の記録はすでにあります。editから編集できます。';

    return;
  }

  const button =
    $('composer').querySelector('[type="submit"]');

  button.disabled = true;

  $('composer-message').textContent =
    'saving...';

  try {
    const { data, error } = await db
      .from('yesterday_entries')
      .insert({
        entry_date: date,
        body: body
      })
      .select('id, entry_date, body')
      .single();

    if (error) throw error;

    entries.push({
      id: data.id,
      date: data.entry_date,
      body: data.body
    });

    $('entry-body').value = '';
    $('entry-date').value = yesterday();
    $('composer-message').textContent = '';
    $('draft-status').textContent = '';
    $('page-message').textContent = '';

    try {
      localStorage.removeItem(DRAFT_KEY);
    } catch (error) {
      console.error(error);
    }

    closeComposer();
    render();

    $('month-' + date.slice(0, 7))
      ?.scrollIntoView({
        behavior: 'smooth'
      });

  } catch (error) {
    console.error('保存エラー:', error);

    $('composer-message').textContent =
      error.code === '23505'
        ? 'この日付の日記はすでにあります。'
        : '保存できませんでした。もう一度お試しください。';

    saveDraft();

  } finally {
    button.disabled = false;
  }
};

// ====================================
// 初期表示
// ====================================

window.addEventListener(
  'scroll',
  updateScroll,
  { passive: true }
);

window.addEventListener(
  'resize',
  updateScroll
);

async function init() {
  setMonth(activeMonth);

  try {
    const { data, error } =
      await db.auth.getSession();

    if (error) throw error;

    await updateAuth(data.session);

  } catch (error) {
    console.error('認証エラー:', error);
    await updateAuth(null);
  }

  await loadEntries();
}

db.auth.onAuthStateChange((event, session) => {
  const owner =
    session?.user?.id === OWNER_UID;

  if (owner !== isOwner) {
    updateAuth(session);
  }
});

init();

