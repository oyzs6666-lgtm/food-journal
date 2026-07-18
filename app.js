const STORAGE_KEY = 'food-journal.entries.v1';
const GOAL_KEY = 'food-journal.goal.v1';
const mealNames = { breakfast: '早', lunch: '中', dinner: '晚' };
const mealLabels = { breakfast: '早餐', lunch: '午餐', dinner: '晚餐' };
const imagePaths = ['assets/demo-a.jpg', 'assets/demo-b.jpg', 'assets/demo-c.jpg', 'assets/demo-d.jpg', 'assets/demo-e.jpg'];
const now = new Date();

let entries = loadEntries();
let calorieGoal = Number(localStorage.getItem(GOAL_KEY)) || 2000;
let monthOffset = 0;
let draftDate = new Date();
let draftMeal = 'breakfast';
let draftImage = '';

function makeId() {
  return globalThis.crypto?.randomUUID?.() || `entry-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

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

function loadEntries() {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    try {
      const saved = JSON.parse(stored);
      return saved.map((entry) => ({ ...entry, image: entry.image?.replace('sample-1.jpg', 'demo-a.jpg').replace('sample-2.jpg', 'demo-b.jpg').replace('sample-3.jpg', 'demo-c.jpg').replace('sample-4.jpg', 'demo-d.jpg').replace('sample-5.jpg', 'demo-e.jpg') }));
    } catch { localStorage.removeItem(STORAGE_KEY); }
  }
  return seedEntries();
}

function seedEntries() {
  const day = dateOnly(new Date());
  const previous = new Date(day); previous.setDate(previous.getDate() - 1);
  const sample = (offset, meal, name, calories, time, image) => {
    const date = new Date(offset); date.setHours(time[0], time[1], 0, 0);
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
  localStorage.setItem(STORAGE_KEY, JSON.stringify(seeded));
  return seeded;
}

function dateOnly(value) { const date = new Date(value); date.setHours(0, 0, 0, 0); return date; }
function dateKey(value) { return dateOnly(value).toISOString().slice(0, 10); }
function formatMonth(date) { return new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: 'long' }).format(date); }
function formatWeekday(date) { return new Intl.DateTimeFormat('zh-CN', { weekday: 'short' }).format(date); }
function formatTime(value) { return new Intl.DateTimeFormat('zh-CN', { hour: 'numeric', minute: '2-digit' }).format(new Date(value)); }
function saveEntries() { localStorage.setItem(STORAGE_KEY, JSON.stringify(entries)); }
function daysForView() {
  const anchor = new Date(now.getFullYear(), now.getMonth() + monthOffset + 1, 0);
  if (monthOffset === 0) anchor.setTime(dateOnly(now).getTime());
  return Array.from({ length: 7 }, (_, index) => {
    const day = new Date(anchor); day.setDate(anchor.getDate() - index); return day;
  });
}
function entriesFor(day, meal) { return entries.filter((entry) => dateKey(entry.date) === dateKey(day) && entry.meal === meal).sort((a, b) => new Date(a.date) - new Date(b.date)); }
function totalFor(day) { return entries.filter((entry) => dateKey(entry.date) === dateKey(day)).reduce((sum, entry) => sum + Number(entry.calories || 0), 0); }
function mealTotal(day, meal) { return entriesFor(day, meal).reduce((sum, entry) => sum + Number(entry.calories || 0), 0); }

function render() {
  const days = daysForView();
  document.querySelector('#month-title').textContent = formatMonth(days[0]);
  document.querySelector('#next-month').disabled = monthOffset >= 0;
  timeline.innerHTML = days.map(renderDay).join('');
  timeline.querySelectorAll('[data-add]').forEach((button) => button.addEventListener('click', () => openEntry(button.dataset.date, button.dataset.add)));
  timeline.querySelectorAll('[data-delete]').forEach((button) => button.addEventListener('click', () => deleteEntry(button.dataset.delete)));
}

function renderDay(day) {
  const today = dateKey(day) === dateKey(now);
  const mealRows = ['breakfast', 'lunch', 'dinner'].map((meal) => {
    const mealEntries = entriesFor(day, meal);
    const cards = mealEntries.map(renderFood).join('');
    return `<div class="meal-row"><div class="meal-label"><strong>${mealNames[meal]}</strong><span>${mealTotal(day, meal)} kcal</span></div><div class="food-grid">${cards}</div></div>`;
  }).join('');
  return `<article class="day-section${today ? ' is-today' : ''}"><div class="day-meta">${today ? '<span class="today-label">今天</span>' : ''}<span class="weekday">${formatWeekday(day)}</span><span class="day-number">${day.getDate()}</span><span class="day-total">${totalFor(day)} kcal</span></div><div class="meal-stack">${mealRows}</div></article>`;
}

function renderFood(entry) {
  return `<div class="food-card"><button type="button" class="food-card-button" data-delete="${entry.id}" aria-label="删除${escapeHtml(entry.name)}"><span class="food-photo"><img src="${entry.image}" alt="${escapeHtml(entry.name)}"></span><span class="food-time">${formatTime(entry.date)}</span><span class="food-name">${escapeHtml(entry.name)}</span><span class="food-calories">${entry.calories} kcal</span></button></div>`;
}

function escapeHtml(value) { return String(value).replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[character])); }

function openEntry(date, meal = 'breakfast') {
  draftDate = new Date(`${date}T${new Date().toTimeString().slice(0, 5)}`);
  draftMeal = meal;
  draftImage = '';
  entryForm.reset();
  document.querySelector(`input[name="meal"][value="${meal}"]`).checked = true;
  document.querySelector('#entry-time').value = toInputDate(draftDate);
  photoPreview.hidden = true;
  photoPreview.removeAttribute('src');
  photoPlaceholder.hidden = false;
  formError.textContent = '';
  entryDialog.showModal();
}

function toInputDate(date) { const offset = date.getTimezoneOffset(); return new Date(date.getTime() - offset * 60000).toISOString().slice(0, 16); }
function addEntry(event) {
  event.preventDefault();
  const name = document.querySelector('#entry-name').value.trim();
  const calories = Number(document.querySelector('#entry-calories').value);
  const image = draftImage;
  if (!name || !calories || !image) { formError.textContent = '请添加照片、描述和热量'; return; }
  const meal = document.querySelector('input[name="meal"]:checked').value;
  const date = new Date(document.querySelector('#entry-time').value);
  entries.push({ id: makeId(), name, calories, meal, date: date.toISOString(), image });
  saveEntries();
  entryDialog.close();
  render();
  showToast('记录已保存');
}

function deleteEntry(id) {
  const target = entries.find((entry) => entry.id === id);
  if (!target || !window.confirm(`删除“${target.name}”这条记录？`)) return;
  entries = entries.filter((entry) => entry.id !== id); saveEntries(); render(); showToast('记录已删除');
}
function showToast(message) { toast.textContent = message; toast.classList.add('is-visible'); setTimeout(() => toast.classList.remove('is-visible'), 1800); }

function readPhoto(input) {
  const file = input.files?.[0]; if (!file) return;
  const reader = new FileReader(); reader.onload = () => { draftImage = String(reader.result); photoPreview.src = draftImage; photoPreview.hidden = false; photoPlaceholder.hidden = true; }; reader.readAsDataURL(file);
}
cameraInput.addEventListener('change', () => readPhoto(cameraInput));
albumInput.addEventListener('change', () => readPhoto(albumInput));
document.querySelector('#take-photo').addEventListener('click', () => cameraInput.click());
document.querySelector('#choose-photo').addEventListener('click', () => albumInput.click());
entryForm.addEventListener('submit', addEntry);
document.querySelector('#close-dialog').addEventListener('click', () => entryDialog.close());
document.querySelector('#floating-add').addEventListener('click', () => openEntry(dateKey(now), 'breakfast'));
document.querySelector('#today-button').addEventListener('click', () => { monthOffset = 0; render(); });
document.querySelector('#previous-month').addEventListener('click', () => { monthOffset -= 1; render(); });
document.querySelector('#next-month').addEventListener('click', () => { if (monthOffset < 0) { monthOffset += 1; render(); } });
document.querySelector('#settings-button').addEventListener('click', () => { document.querySelector('#goal-input').value = calorieGoal; settingsDialog.showModal(); });
document.querySelector('[data-close-settings]').addEventListener('click', () => settingsDialog.close());
document.querySelector('#settings-form').addEventListener('submit', (event) => { event.preventDefault(); calorieGoal = Number(document.querySelector('#goal-input').value) || 2000; localStorage.setItem(GOAL_KEY, calorieGoal); settingsDialog.close(); showToast('目标已更新'); });
document.querySelector('#clear-data').addEventListener('click', () => { if (window.confirm('清空所有饮食记录？')) { entries = []; saveEntries(); settingsDialog.close(); render(); showToast('记录已清空'); } });
if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
render();
