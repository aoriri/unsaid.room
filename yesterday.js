
'use strict';

// デザイン確認用
// 現段階ではデータの永続的な保存は行わない

const $ = id => document.getElementById(id);

const months = [
  'January', 'February', 'March',
  'April', 'May', 'June',
  'July', 'August', 'September',
  'October', 'November', 'December'
];

const pad = n => String(n).padStart(2, '0');

const dateKey = d =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

// 昨日の日付を取得
const yesterday = () => {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return dateKey(d);
};

// 仮の日記データ
let entries = [
  {
    date: '2026-11-23',
    body: '午後から買い物に行った。帰ってから紅茶を飲んだ。'
  },
  {
    date: '2026-11-22',
    body: '久しぶりに映画を観た。\n夜は家でのんびり過ごした。'
  },
  {
    date: '2026-11-01',
    body: '11月になった。そろそろ冬服を出したい。'
  },
  {
    date: '2026-10-31',
    body: '帰り道が少し寒かった。'
  },
  {
    date: '2026-10-30',
    body: '今日は久しぶりに早く起きた。'
  }
];

let activeMonth = entries[0].date.slice(0, 7);
let archiveYear = Number(activeMonth.slice(0, 4));

// HTML要素を生成
const el = (tag, cls, text) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
};

// ヘッダーの年月を更新
function setMonth(key) {
  activeMonth = key;
  const [y, m] = key.split('-').map(Number);
  $('current-month').textContent = `${months[m - 1]}, ${y}`;
}

// アーカイブを閉じる
function closeArchive() {
  $('archive').hidden = true;
  $('archive-toggle').setAttribute('aria-expanded', 'false');
}

// 記入欄を閉じる
function closeComposer() {
  $('composer').hidden = true;
  $('write-toggle').textContent = 'write';
  $('write-toggle').setAttribute('aria-expanded', 'false');
}

// 月別アーカイブを生成
function renderArchive() {
  $('archive-year').textContent = archiveYear;

  const years = entries.map(
    e => Number(e.date.slice(0, 4))
  );

  $('prev-year').disabled =
    archiveYear <= Math.min(...years);

  $('next-year').disabled =
    archiveYear >= Math.max(...years);

  $('archive-months').replaceChildren();

  months.forEach((m, i) => {
    const key = `${archiveYear}-${pad(i + 1)}`;
    const b = el('button', '', m.slice(0, 3) + '.');

    b.type = 'button';
    b.disabled = !entries.some(e => e.date.startsWith(key));

    if (key === activeMonth) {
      b.setAttribute('aria-current', 'true');
    }

    b.onclick = () => {
      closeArchive();
      setMonth(key);

      document.getElementById('month-' + key)
        .scrollIntoView({ behavior: 'smooth' });
    };

    $('archive-months').append(b);
  });
}

// 日記一覧を生成
function render() {
  $('entries').replaceChildren();

  let key = '';
  let section;

  entries.sort((a, b) => b.date.localeCompare(a.date));

  entries.forEach(entry => {
    const k = entry.date.slice(0, 7);

    // 月が変わったときに見出しを追加
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

    const weekdays = [
      'sun.', 'mon.', 'tue.', 'wed.',
      'thu.', 'fri.', 'sat.'
    ];

    const label =
      `${pad(d.getMonth() + 1)}.${pad(d.getDate())} ${weekdays[d.getDay()]}`;

    const time = el('time', '', label);
    time.dateTime = entry.date;

    const edit = el('button', '', 'edit');
    const body = el('p', 'diary-text', entry.body);

    edit.type = 'button';

    head.append(time, el('span', 'line'), edit);
    article.append(head, body);
    section.append(article);

    // 編集ボタン
    edit.onclick = () => {
      if (article.querySelector('form')) return;

      const f = el('form', 'diary-form');
      const t = el('textarea');

      t.value = entry.body;
      t.rows = 5;
      t.required = true;
      t.setAttribute('aria-label', '日記を編集');

      const actions = el('div', 'diary-actions');
      const cancel = el('button', '', 'cancel');
      const save = el('button', '', 'save');

      cancel.type = 'button';
      save.type = 'submit';

      actions.append(cancel, save);
      f.append(t, actions);

      body.hidden = true;
      article.append(f);
      t.focus();

      cancel.onclick = () => {
        f.remove();
        body.hidden = false;
      };

      f.onsubmit = e => {
        e.preventDefault();

        if (!t.value.trim()) return;

        entry.body = t.value;
        body.textContent = entry.body;

        f.remove();
        body.hidden = false;
      };
    };
  });

  updateScroll();
}

// スクロールに合わせて年月を更新
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

// アーカイブの開閉
$('archive-toggle').onclick = () => {
  if (!$('archive').hidden) {
    closeArchive();
    return;
  }

  closeComposer();

  archiveYear = Number(activeMonth.slice(0, 4));
  renderArchive();

  $('archive').hidden = false;
  $('archive-toggle').setAttribute('aria-expanded', 'true');
};

$('prev-year').onclick = () => {
  archiveYear--;
  renderArchive();
};

$('next-year').onclick = () => {
  archiveYear++;
  renderArchive();
};

// 記入欄の開閉
$('write-toggle').onclick = () => {
  if (!$('composer').hidden) {
    closeComposer();
    return;
  }

  closeArchive();

  $('composer').hidden = false;
  $('write-toggle').textContent = 'close';
  $('write-toggle').setAttribute('aria-expanded', 'true');

  if (!$('entry-date').value) {
    $('entry-date').value = yesterday();
  }

  $('composer').scrollIntoView({
    behavior: 'smooth',
    block: 'start'
  });

  $('entry-body').focus({ preventScroll: true });
};

// 新しい日記を追加
$('composer').onsubmit = e => {
  e.preventDefault();

  const date = $('entry-date').value;
  const body = $('entry-body').value;

  if (!body.trim()) return;

  if (entries.some(x => x.date === date)) {
    $('composer-message').textContent =
      'この日付の記録はすでにあります。edit から編集できます。';
    return;
  }

  entries.push({ date, body });

  $('entry-body').value = '';
  $('entry-date').value = yesterday();
  $('composer-message').textContent = '';

  closeComposer();
  render();

  document.getElementById('month-' + date.slice(0, 7))
    .scrollIntoView({ behavior: 'smooth' });
};

// 初期表示
window.addEventListener('scroll', updateScroll, {
  passive: true
});

window.addEventListener('resize', updateScroll);

setMonth(activeMonth);
render();
