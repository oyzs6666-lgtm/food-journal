const STORAGE_KEY = 'food-journal.entries.v1';
const GOAL_KEY = 'food-journal.goal.v1';
const mealNames = { breakfast: '早', lunch: '中', dinner: '晚' };
const imagePaths = ['assets/demo-a.jpg', 'assets/demo-b.jpg', 'assets/demo-c.jpg', 'assets/demo-d.jpg', 'assets/demo-e.jpg'];
const now = new Date();

let entries = loadEntries();
let calorieGoal = Number(localStorage.getItem(GOAL_KEY)) || 2000;
let monthOffset = 0;
let draftImage = '';
let photoBusy = false;
let editingId = null;

const timeline = document.querySelector('#timeline');
const entryDialog = document.querySelector('#entry-dialog');
const settingsDialog = document.querySelector('#settings-dialog');
const entryForm = document.querySelector('#entry-form');
const cameraInput = document.querySelector('#camera-input');
const albumInput = document.querySelector('#album-input');
const photoPreview = document.querySelector('#photo-preview');
const photoPlaceholder = document.querySelector('#photo-placeholder');
const formError = document.querySelector('#form-error');
const toast = document.querySelector('#toast');

function makeId() {
  return globalThis.crypto?.randomUUID?.() || `entry-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function loadEntries() {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    try {
      const saved = JSON.parse(stored);
      return saved.map((entry) => ({
        ...entry,
        image: entry.image?.replace('sample-1.jpg', 'demo-a.jpg').replace('sample-2.jpg', 'demo-b.jpg').replace('sample-3.jpg', 'demo-c.jpg').replace('sample-4.jpg', 'demo-d.jpg').replace('sample-5.jpg', 'demo-e.jpg')
      }));
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    }
  }
  return seedEntries();
}

function seedEntries() {
  const day = dateOnly(new Date());
  const previous = new Date(day);
  previous.setDate(previous.getDate() - 1);
  const sample = (dateValue, meal, name, calories, time, image) => {
    const date = new Date(dateValue);
    date.setHours(time[0], time[1], 0, 0);
    return { id: makeId(), date: date.toISOString(), meal, name, calories, image };
  };
  const seeded = [
    sample(previous, 'breakfast', '拿铁咖啡', 120, [8, 26], imagePaths[0]),
    sample(previous, 'breakfast', '鸡蛋吐司', 280, [10, 12], imagePaths[1]),
    sample(previous, 'lunch', '午餐', 520, [12, 12], imagePaths[2]),
    sample(previous, 'dinner', '汉堡', 640, [19, 51], imagePaths[4]),
    sample(day, 'breakfast', '冰美式', 80, [8, 7], imagePaths[0]),
    sample(day, 'breakfast', '牛奶', 160, [10, 18], imagePaths[1]),
    sample(day, 'lunch', '蜂蜜面包', 260, [12, 1], imagePaths[3])
  ];
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(seeded)); } catch {}
  return seeded;
}

function dateOnly(value) {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

function dateKey(value) {
  const date = dateOnly(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatMonth(date) {
  return new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: 'long' }).format(date);
}

function formatWeekday(date) {
  return new Intl.DateTimeFormat('zh-CN', { weekday: 'short' }).format(date);
}

function saveEntries(nextEntries = entries) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(nextEntries));
}

function daysForView() {
  const anchor = new Date(now.getFullYear(), now.getMonth() + monthOffset + 1, 0);
  if (monthOffset === 0) anchor.setTime(dateOnly(now).getTime());
  return Array.from({ length: 7 }, (_, index) => {
    const day = new Date(anchor);
    day.setDate(anchor.getDate() - index);
    return day;
  });
}

function entriesFor(day, meal) {
  return entries
    .filter((entry) => dateKey(entry.date) === dateKey(day) && entry.meal === meal)
    .sort((a, b) => new Date(a.date) - new Date(b.date));
}

function totalFor(day) {
  return entries.filter((entry) => dateKey(entry.date) === dateKey(day)).reduce((sum, entry) => sum + Number(entry.calories || 0), 0);
}

function mealTotal(day, meal) {
  return entriesFor(day, meal).reduce((sum, entry) => sum + Number(entry.calories || 0), 0);
}

function render() {
  const days = daysForView();
  document.querySelector('#month-title').textContent = formatMonth(days[0]);
  document.querySelector('#next-month').disabled = monthOffset >= 0;
  timeline.innerHTML = days.map(renderDay).join('');
  requestAnimationFrame(() => window.scrollTo({ top: 0, left: 0, behavior: 'instant' }));
}

function renderDay(day) {
  const mealRows = ['breakfast', 'lunch', 'dinner'].map((meal) => {
    const cards = entriesFor(day, meal).map(renderFood).join('');
    return `<div class="meal-row"><div class="meal-label"><strong>${mealNames[meal]}</strong><span>${mealTotal(day, meal)} kcal</span></div><div class="food-grid">${cards}</div></div>`;
  }).join('');
  return `<article class="day-section"><div class="day-meta"><span class="weekday">${formatWeekday(day)}</span><span class="day-number">${day.getDate()}</span><span class="day-total">${totalFor(day)} kcal</span></div><div class="meal-stack">${mealRows}</div></article>`;
}

function renderFood(entry) {
  return `<div class="food-card"><button type="button" class="food-card-button" data-edit="${entry.id}" aria-label="编辑${escapeHtml(entry.name)}"><span class="food-photo"><img src="${entry.image}" alt="${escapeHtml(entry.name)}"></span><span class="food-name">${escapeHtml(entry.name)}</span><span class="food-calories">${entry.calories} kcal</span></button></div>`;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[character]));
}

function openEntry(date, meal = 'breakfast') {
  const draftDate = new Date(`${date}T${new Date().toTimeString().slice(0, 5)}`);
  draftImage = '';
  photoBusy = false;
  editingId = null;
  document.querySelector('#delete-entry').hidden = true;
  entryForm.reset();
  document.querySelector(`input[name="meal"][value="${meal}"]`).checked = true;
  document.querySelector('#entry-time').value = toInputDate(draftDate);
  photoPreview.hidden = true;
  photoPreview.removeAttribute('src');
  photoPlaceholder.hidden = false;
  formError.textContent = '';
  entryDialog.showModal();
  entryDialog.scrollTop = 0;
}

function openEdit(id) {
  const entry = entries.find((item) => item.id === id);
  if (!entry) return;
  editingId = id;
  draftImage = entry.image;
  photoBusy = false;
  entryForm.reset();
  document.querySelector('#entry-name').value = entry.name;
  document.querySelector('#entry-calories').value = entry.calories;
  document.querySelector(`input[name="meal"][value="${entry.meal}"]`).checked = true;
  document.querySelector('#entry-time').value = toInputDate(new Date(entry.date));
  photoPreview.src = entry.image;
  photoPreview.hidden = false;
  photoPlaceholder.hidden = true;
  formError.textContent = '';
  document.querySelector('#delete-entry').hidden = false;
  entryDialog.showModal();
  entryDialog.scrollTop = 0;
}

function toInputDate(date) {
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60000).toISOString().slice(0, 16);
}

function addEntry(event) {
  event.preventDefault();
  if (photoBusy) {
    formError.textContent = '图片正在处理中，请稍候';
    return;
  }
  const name = document.querySelector('#entry-name').value.trim();
  const calories = Number(document.querySelector('#entry-calories').value);
  const meal = document.querySelector('input[name="meal"]:checked')?.value;
  const date = new Date(document.querySelector('#entry-time').value);
  if (!name || !calories || !draftImage) {
    formError.textContent = '请添加照片、描述和热量';
    return;
  }
  if (!meal || Number.isNaN(date.getTime())) {
    formError.textContent = '请选择有效的餐次和时间';
    return;
  }
  const nextEntry = { id: editingId || makeId(), name, calories, meal, date: date.toISOString(), image: draftImage };
  const nextEntries = editingId ? entries.map((entry) => entry.id === editingId ? nextEntry : entry) : [...entries, nextEntry];
  try {
    saveEntries(nextEntries);
    entries = nextEntries;
  } catch {
    formError.textContent = '保存失败：存储空间不足，请删除一些旧记录后重试';
    return;
  }
  editingId = null;
  entryDialog.close();
  render();
  showToast('记录已保存');
}

function deleteEntry(id) {
  if (!entries.some((entry) => entry.id === id)) return;
  const previousEntries = entries;
  const nextEntries = entries.filter((entry) => entry.id !== id);
  try {
    saveEntries(nextEntries);
    entries = nextEntries;
  } catch {
    entries = previousEntries;
    showToast('删除失败，请稍后重试');
    return;
  }
  render();
  showToast('记录已删除');
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add('is-visible');
  setTimeout(() => toast.classList.remove('is-visible'), 1800);
}

function compressPhoto(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      const image = new Image();
      image.onerror = reject;
      image.onload = () => {
        const maxSide = 900;
        const scale = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
        canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
        const context = canvas.getContext('2d');
        if (!context) { reject(new Error('canvas')); return; }
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.78));
      };
      image.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

async function readPhoto(input) {
  const file = input.files?.[0];
  if (!file) return;
  photoBusy = true;
  formError.textContent = '图片处理中...';
  try {
    draftImage = await compressPhoto(file);
    photoPreview.src = draftImage;
    photoPreview.hidden = false;
    photoPlaceholder.hidden = true;
    formError.textContent = '';
  } catch {
    draftImage = '';
    formError.textContent = '照片读取失败，请重新选择';
  } finally {
    photoBusy = false;
    input.value = '';
  }
}

timeline.addEventListener('click', (event) => {
  const editButton = event.target.closest('[data-edit]');
  if (editButton) {
    event.preventDefault();
    openEdit(editButton.dataset.edit);
  }
});
cameraInput.addEventListener('change', () => readPhoto(cameraInput));
albumInput.addEventListener('change', () => readPhoto(albumInput));
document.querySelector('#take-photo').addEventListener('click', () => cameraInput.click());
document.querySelector('#choose-photo').addEventListener('click', () => albumInput.click());
entryForm.addEventListener('submit', addEntry);
document.querySelector('#close-dialog').addEventListener('click', () => entryDialog.close());
document.querySelector('#delete-entry').addEventListener('click', () => {
  if (!editingId || !window.confirm('删除这条饮食记录？')) return;
  deleteEntry(editingId);
  editingId = null;
  entryDialog.close();
});
document.querySelector('#floating-add').addEventListener('click', () => openEntry(dateKey(now), 'breakfast'));
document.querySelector('#today-button').addEventListener('click', () => { monthOffset = 0; render(); });
document.querySelector('#previous-month').addEventListener('click', () => { monthOffset -= 1; render(); });
document.querySelector('#next-month').addEventListener('click', () => { if (monthOffset < 0) { monthOffset += 1; render(); } });
document.querySelector('#settings-button').addEventListener('click', () => {
  document.querySelector('#goal-input').value = calorieGoal;
  settingsDialog.showModal();
  settingsDialog.scrollTop = 0;
});
document.querySelector('[data-close-settings]').addEventListener('click', () => settingsDialog.close());
document.querySelector('#settings-form').addEventListener('submit', (event) => {
  event.preventDefault();
  calorieGoal = Number(document.querySelector('#goal-input').value) || 2000;
  try { localStorage.setItem(GOAL_KEY, calorieGoal); } catch {}
  settingsDialog.close();
  showToast('目标已更新');
});
document.querySelector('#clear-data').addEventListener('click', () => {
  if (!window.confirm('清空所有饮食记录？')) return;
  entries = [];
  try { saveEntries(); } catch {}
  settingsDialog.close();
  render();
  showToast('记录已清空');
});

render();
