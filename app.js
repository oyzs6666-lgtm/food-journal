const ENTRY_KEY = 'satiety-journal.entries.v1';
const PROMPT_KEY = 'satiety-journal.prompts.v1';

if ('scrollRestoration' in history) history.scrollRestoration = 'manual';

const DEFAULT_PROMPTS = [
  '饿坏了，浑身无力、手抖、头晕',
  '很饿，情绪和注意力明显受影响，但还没有手抖头晕',
  '饥饿感明显，胃叫，但身体仍正常',
  '有点饿，感觉胃空，暂时不吃也不难受',
  '不饿不饱，感觉不到胃的存在',
  '有点儿饱，把食物收走会难受烦躁',
  '胃里有舒服的充实感，嘴馋但现在把食物收走不难受',
  '明显饱，已经出现轻微顶胀，再吃主要是舍不得停',
  '已经撑了，腹部发紧，继续吃会明显不舒服。',
  '撑到极限，可能恶心、反流、胀痛或想吐。'
];

const LEVEL_COLORS = [
  '#2d70b7', '#347fc0', '#3e91bd', '#46a5ad', '#62b593',
  '#9ebd62', '#d1b94e', '#e7a245', '#eb793f', '#e84f49'
];

let entries = loadJson(ENTRY_KEY, []);
let prompts = loadPrompts();
let selectedLevel = null;
let statsDate = dateKey(new Date());
let chartPoints = [];
let toastTimer;
let editingId = null;
let editingLevel = null;

const elements = {
  todayLabel: document.querySelector('#today-label'),
  todayCalories: document.querySelector('#today-calories'),
  levelGrid: document.querySelector('#level-grid'),
  selectionStatus: document.querySelector('#selection-status'),
  promptCard: document.querySelector('#prompt-card'),
  promptNumber: document.querySelector('#prompt-number'),
  promptText: document.querySelector('#prompt-text'),
  foodName: document.querySelector('#food-name'),
  foodCalories: document.querySelector('#food-calories'),
  saveButton: document.querySelector('#save-button'),
  todayRecords: document.querySelector('#today-records'),
  entryCount: document.querySelector('#entry-count'),
  recordView: document.querySelector('#record-view'),
  statsView: document.querySelector('#stats-view'),
  navButtons: [...document.querySelectorAll('.nav-button')],
  promptDialog: document.querySelector('#prompt-dialog'),
  promptForm: document.querySelector('#prompt-form'),
  promptFields: document.querySelector('#prompt-fields'),
  editRecordDialog: document.querySelector('#edit-record-dialog'),
  editRecordForm: document.querySelector('#edit-record-form'),
  editLevelGrid: document.querySelector('#edit-level-grid'),
  editFoodName: document.querySelector('#edit-food-name'),
  editFoodCalories: document.querySelector('#edit-food-calories'),
  editRecordTime: document.querySelector('#edit-record-time'),
  statsDateLabel: document.querySelector('#stats-date-label'),
  statsDateInput: document.querySelector('#stats-date-input'),
  nextDay: document.querySelector('#next-day'),
  chart: document.querySelector('#satiety-chart'),
  chartWrap: document.querySelector('#chart-wrap'),
  chartEmpty: document.querySelector('#chart-empty'),
  chartTooltip: document.querySelector('#chart-tooltip'),
  toast: document.querySelector('#toast')
};

function loadJson(key, fallback) {
  try {
    const value = JSON.parse(localStorage.getItem(key));
    return Array.isArray(value) ? value : fallback;
  } catch {
    return fallback;
  }
}

function loadPrompts() {
  const saved = loadJson(PROMPT_KEY, DEFAULT_PROMPTS);
  if (saved.length !== 10 || saved.some((item) => typeof item !== 'string')) return [...DEFAULT_PROMPTS];
  return saved;
}

function persistEntries() {
  localStorage.setItem(ENTRY_KEY, JSON.stringify(entries));
}

function dateKey(value) {
  const date = new Date(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function dateFromKey(key) {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function formatDate(key, includeYear = true) {
  return new Intl.DateTimeFormat('zh-CN', {
    ...(includeYear ? { year: 'numeric' } : {}), month: 'long', day: 'numeric', weekday: 'long'
  }).format(dateFromKey(key));
}

function formatTime(value) {
  return new Intl.DateTimeFormat('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(value));
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char]);
}

function makeId() {
  return crypto.randomUUID?.() || `record-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function renderLevelButtons() {
  elements.levelGrid.innerHTML = LEVEL_COLORS.map((color, index) => {
    const level = index + 1;
    return `<button class="level-button" type="button" role="radio" aria-checked="${selectedLevel === level}" aria-label="${level}分饱：${escapeHtml(prompts[index])}" data-level="${level}" style="--level-color:${color}">${level}</button>`;
  }).join('');
}

function selectLevel(level) {
  selectedLevel = level;
  renderLevelButtons();
  const color = LEVEL_COLORS[level - 1];
  elements.selectionStatus.textContent = `${level} 分饱`;
  elements.promptNumber.textContent = level;
  elements.promptText.textContent = prompts[level - 1];
  elements.promptCard.style.setProperty('--selected-color', color);
  elements.promptCard.classList.add('is-selected');
  elements.saveButton.disabled = false;
  elements.saveButton.textContent = `记录 ${level} 分饱`;
}

function todayEntries() {
  const today = dateKey(new Date());
  return entries.filter((entry) => dateKey(entry.timestamp) === today).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
}

function renderHome() {
  const today = dateKey(new Date());
  const records = todayEntries();
  elements.todayLabel.textContent = formatDate(today);
  elements.todayCalories.textContent = records.reduce((sum, entry) => sum + (Number(entry.calories) || 0), 0).toLocaleString('zh-CN');
  elements.entryCount.textContent = `${records.length} 条`;
  elements.todayRecords.innerHTML = records.length ? records.map((entry) => {
    const details = [entry.food, entry.calories !== null && entry.calories !== '' ? `${entry.calories} kcal` : ''].filter(Boolean).join(' · ') || '未填写食物和热量';
    return `<article class="record-row">
      <button class="record-edit-button" type="button" data-edit="${entry.id}" aria-label="编辑${formatTime(entry.timestamp)}的记录">
        <span class="record-level" style="--level-color:${LEVEL_COLORS[entry.level - 1]}">${entry.level}</span>
        <span class="record-main"><strong>${entry.level} 分饱</strong><span>${escapeHtml(details)}</span></span>
        <time class="record-time" datetime="${entry.timestamp}">${formatTime(entry.timestamp)}</time>
      </button>
      <button class="delete-record" type="button" data-delete="${entry.id}" aria-label="删除${formatTime(entry.timestamp)}的记录">×</button>
    </article>`;
  }).join('') : '<p class="empty-records">今天还没有记录，先留意一下此刻身体的感觉吧。</p>';
}

function saveRecord() {
  if (!selectedLevel) return;
  const rawCalories = elements.foodCalories.value.trim();
  const calories = rawCalories === '' ? null : Math.max(0, Math.min(9999, Number(rawCalories)));
  if (rawCalories !== '' && !Number.isFinite(calories)) {
    showToast('请填写有效的热量数字');
    return;
  }
  const timestamp = new Date();
  entries.push({
    id: makeId(),
    timestamp: timestamp.toISOString(),
    level: selectedLevel,
    food: elements.foodName.value.trim(),
    calories
  });
  try {
    persistEntries();
  } catch {
    entries.pop();
    showToast('保存失败，浏览器存储空间可能已满');
    return;
  }
  elements.foodName.value = '';
  elements.foodCalories.value = '';
  selectedLevel = null;
  renderLevelButtons();
  elements.selectionStatus.textContent = '尚未选择';
  elements.promptNumber.textContent = '—';
  elements.promptText.textContent = '点击上方数字，查看对应的身体感受提示。';
  elements.promptCard.classList.remove('is-selected');
  elements.promptCard.style.removeProperty('--selected-color');
  elements.saveButton.disabled = true;
  elements.saveButton.textContent = '选择饱腹度后记录';
  renderHome();
  if (dateKey(timestamp) === statsDate) renderChart();
  const hour = timestamp.getHours() + timestamp.getMinutes() / 60;
  showToast(hour >= 7 ? '已记录此刻的饱腹感' : '记录已保存；夜间数据不进入折线图');
}

function deleteRecord(id) {
  const record = entries.find((entry) => entry.id === id);
  if (!record || !confirm(`删除 ${formatTime(record.timestamp)} 的 ${record.level} 分饱记录？`)) return;
  entries = entries.filter((entry) => entry.id !== id);
  persistEntries();
  renderHome();
  renderChart();
  showToast('记录已删除');
}

function renderEditLevels() {
  elements.editLevelGrid.innerHTML = LEVEL_COLORS.map((color, index) => {
    const level = index + 1;
    return `<button class="edit-level-button" type="button" role="radio" aria-checked="${editingLevel === level}" data-edit-level="${level}" style="--level-color:${color}" aria-label="改为${level}分饱">${level}</button>`;
  }).join('');
}

function openRecordEditor(id) {
  const record = entries.find((entry) => entry.id === id);
  if (!record) return;
  editingId = id;
  editingLevel = Number(record.level);
  elements.editFoodName.value = record.food || '';
  elements.editFoodCalories.value = record.calories === null || record.calories === '' ? '' : record.calories;
  const time = new Date(record.timestamp);
  elements.editRecordTime.value = `${String(time.getHours()).padStart(2, '0')}:${String(time.getMinutes()).padStart(2, '0')}`;
  renderEditLevels();
  elements.editRecordDialog.showModal();
}

function saveEditedRecord(event) {
  event.preventDefault();
  const index = entries.findIndex((entry) => entry.id === editingId);
  if (index < 0 || !editingLevel) return;
  const rawCalories = elements.editFoodCalories.value.trim();
  const calories = rawCalories === '' ? null : Math.max(0, Math.min(9999, Number(rawCalories)));
  if (rawCalories !== '' && !Number.isFinite(calories)) {
    showToast('请填写有效的热量数字');
    return;
  }
  const timeParts = elements.editRecordTime.value.split(':').map(Number);
  if (timeParts.length !== 2 || timeParts.some((value) => !Number.isFinite(value))) {
    showToast('请选择有效的记录时间');
    return;
  }
  const original = entries[index];
  const originalTime = new Date(original.timestamp);
  const updatedTime = new Date(
    originalTime.getFullYear(), originalTime.getMonth(), originalTime.getDate(),
    timeParts[0], timeParts[1], 0, 0
  );
  const updated = {
    ...original,
    level: editingLevel,
    food: elements.editFoodName.value.trim(),
    calories,
    timestamp: updatedTime.toISOString()
  };
  const previous = entries[index];
  entries[index] = updated;
  try {
    persistEntries();
  } catch {
    entries[index] = previous;
    showToast('保存失败，请稍后重试');
    return;
  }
  editingId = null;
  editingLevel = null;
  elements.editRecordDialog.close();
  renderHome();
  renderChart();
  showToast('记录已更新');
}

function resetRecordScroll() {
  const reset = () => {
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  };
  reset();
  requestAnimationFrame(() => requestAnimationFrame(reset));
  setTimeout(reset, 120);
}

function showView(name) {
  const showStats = name === 'stats';
  document.documentElement.classList.toggle('stats-active', showStats);
  document.body.classList.toggle('stats-active', showStats);
  elements.recordView.hidden = showStats;
  elements.statsView.hidden = !showStats;
  elements.navButtons.forEach((button) => {
    const active = button.dataset.view === name;
    button.classList.toggle('is-active', active);
    active ? button.setAttribute('aria-current', 'page') : button.removeAttribute('aria-current');
  });
  if (showStats) requestAnimationFrame(renderChart);
  else resetRecordScroll();
}

function renderPromptEditor() {
  elements.promptFields.innerHTML = prompts.map((prompt, index) => `<label class="prompt-field">
    <span style="--level-color:${LEVEL_COLORS[index]}">${index + 1}</span>
    <textarea maxlength="120" required aria-label="${index + 1}分饱提示词">${escapeHtml(prompt)}</textarea>
  </label>`).join('');
}

function savePrompts(event) {
  event.preventDefault();
  const values = [...elements.promptFields.querySelectorAll('textarea')].map((field) => field.value.trim());
  if (values.some((value) => !value)) {
    showToast('每个等级都需要保留一条提示词');
    return;
  }
  prompts = values;
  localStorage.setItem(PROMPT_KEY, JSON.stringify(prompts));
  renderLevelButtons();
  if (selectedLevel) selectLevel(selectedLevel);
  elements.promptDialog.close();
  showToast('提示词已更新');
}

function moveStatsDay(offset) {
  const date = dateFromKey(statsDate);
  date.setDate(date.getDate() + offset);
  const next = dateKey(date);
  if (next > dateKey(new Date())) return;
  statsDate = next;
  renderChart();
}

function getChartEntries() {
  return entries.filter((entry) => {
    if (dateKey(entry.timestamp) !== statsDate) return false;
    const time = new Date(entry.timestamp);
    const hour = time.getHours() + time.getMinutes() / 60 + time.getSeconds() / 3600;
    return hour >= 7 && hour < 24;
  }).sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
}

function roundRect(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, r);
}

function renderChart() {
  const canvas = elements.chart;
  const bounds = elements.chartWrap.getBoundingClientRect();
  if (!bounds.width || !bounds.height) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(bounds.width * dpr);
  canvas.height = Math.round(bounds.height * dpr);
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, bounds.width, bounds.height);

  elements.statsDateLabel.textContent = statsDate === dateKey(new Date()) ? '今天' : formatDate(statsDate, false);
  elements.statsDateInput.value = statsDate;
  elements.statsDateInput.max = dateKey(new Date());
  elements.nextDay.disabled = statsDate >= dateKey(new Date());
  elements.chartTooltip.hidden = true;

  const compact = bounds.height < 310;
  const denseXAxis = bounds.width < 520;
  const bottomInset = denseXAxis ? 47 : compact ? 25 : 34;
  const plot = { left: 5, right: bounds.width - 4, top: compact ? 16 : 27, bottom: bounds.height - bottomInset };
  const xFor = (hour) => plot.left + ((hour - 7) / 17) * (plot.right - plot.left);
  const yFor = (level) => plot.bottom - ((level - 1) / 9) * (plot.bottom - plot.top);

  ctx.font = `${compact ? 9 : 10}px system-ui, sans-serif`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  for (let level = 1; level <= 10; level += 1) {
    const y = yFor(level);
    ctx.strokeStyle = level === 1 || level === 10 ? '#d3cec5' : '#e9e5de';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(plot.left, y); ctx.lineTo(plot.right, y); ctx.stroke();
    ctx.fillStyle = '#88847c';
    ctx.fillText(String(level), plot.left + 4, y);
  }

  ctx.font = `${denseXAxis ? 9 : compact ? 9 : 10}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  for (let hour = 7; hour <= 24; hour += 1) {
    const x = xFor(hour);
    ctx.strokeStyle = hour % 2 === 1 ? '#f0ece5' : '#e4e0d8';
    ctx.beginPath(); ctx.moveTo(x, plot.top); ctx.lineTo(x, plot.bottom); ctx.stroke();
    ctx.fillStyle = '#88847c';
    ctx.textAlign = hour === 7 ? 'left' : hour === 24 ? 'right' : 'center';
    const stagger = denseXAxis && (hour - 7) % 2 === 1 ? 13 : 0;
    ctx.fillText(`${hour}:00`, x, plot.bottom + 7 + stagger);
  }

  const records = getChartEntries();
  elements.chartEmpty.hidden = records.length > 0;
  chartPoints = records.map((entry) => {
    const time = new Date(entry.timestamp);
    const hour = time.getHours() + time.getMinutes() / 60 + time.getSeconds() / 3600;
    return { x: xFor(hour), y: yFor(entry.level), entry };
  });
  if (!chartPoints.length) return;

  if (chartPoints.length > 1) {
    const gradient = ctx.createLinearGradient(plot.left, 0, plot.right, 0);
    gradient.addColorStop(0, '#3178bd');
    gradient.addColorStop(1, '#e8584f');
    ctx.strokeStyle = gradient;
    ctx.lineWidth = compact ? 2 : 2.5;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.beginPath();
    chartPoints.forEach((point, index) => index ? ctx.lineTo(point.x, point.y) : ctx.moveTo(point.x, point.y));
    ctx.stroke();
  }

  chartPoints.forEach((point, index) => {
    const { entry } = point;
    ctx.fillStyle = LEVEL_COLORS[entry.level - 1];
    ctx.strokeStyle = '#fffdf9';
    ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(point.x, point.y, compact ? 4.5 : 5.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();

    const label = [entry.food, entry.calories !== null && entry.calories !== '' ? `${entry.calories} kcal` : ''].filter(Boolean).join('，');
    if (!label) return;
    const shortLabel = label.length > 18 ? `${label.slice(0, 17)}…` : label;
    ctx.font = `${compact ? 9 : 10}px system-ui, sans-serif`;
    const labelWidth = Math.min(ctx.measureText(shortLabel).width + 12, 160);
    const labelHeight = compact ? 18 : 20;
    let labelX = point.x - labelWidth / 2;
    labelX = Math.max(plot.left, Math.min(plot.right - labelWidth, labelX));
    let labelY = point.y - labelHeight - 9;
    if (labelY < plot.top) labelY = point.y + 9;
    if (index > 0 && Math.abs(point.x - chartPoints[index - 1].x) < labelWidth * .55) {
      labelY = point.y + 9;
    }
    ctx.fillStyle = 'rgba(255,253,249,.94)';
    ctx.strokeStyle = '#d8d3ca';
    ctx.lineWidth = 1;
    roundRect(ctx, labelX, labelY, labelWidth, labelHeight, 6); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#4f4c46';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(shortLabel, labelX + labelWidth / 2, labelY + labelHeight / 2 + .5, labelWidth - 8);
  });
}

function showChartPoint(event) {
  if (!chartPoints.length) return;
  const rect = elements.chart.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;
  let closest = null;
  let distance = Infinity;
  chartPoints.forEach((point) => {
    const nextDistance = Math.hypot(point.x - x, point.y - y);
    if (nextDistance < distance) { closest = point; distance = nextDistance; }
  });
  if (!closest || distance > 28) {
    elements.chartTooltip.hidden = true;
    return;
  }
  const entry = closest.entry;
  const details = [entry.food, entry.calories !== null && entry.calories !== '' ? `${entry.calories} kcal` : ''].filter(Boolean).join('，');
  elements.chartTooltip.textContent = `${formatTime(entry.timestamp)} · ${entry.level}分饱${details ? ` · ${details}` : ''}`;
  elements.chartTooltip.style.left = `${Math.max(80, Math.min(rect.width - 80, closest.x))}px`;
  elements.chartTooltip.style.top = `${Math.max(48, closest.y)}px`;
  elements.chartTooltip.hidden = false;
}

function showToast(message) {
  clearTimeout(toastTimer);
  elements.toast.textContent = message;
  elements.toast.classList.add('is-visible');
  toastTimer = setTimeout(() => elements.toast.classList.remove('is-visible'), 1900);
}

elements.levelGrid.addEventListener('click', (event) => {
  const button = event.target.closest('[data-level]');
  if (button) selectLevel(Number(button.dataset.level));
});
elements.saveButton.addEventListener('click', saveRecord);
elements.todayRecords.addEventListener('click', (event) => {
  const deleteButton = event.target.closest('[data-delete]');
  if (deleteButton) {
    deleteRecord(deleteButton.dataset.delete);
    return;
  }
  const editButton = event.target.closest('[data-edit]');
  if (editButton) openRecordEditor(editButton.dataset.edit);
});
elements.editLevelGrid.addEventListener('click', (event) => {
  const button = event.target.closest('[data-edit-level]');
  if (!button) return;
  editingLevel = Number(button.dataset.editLevel);
  renderEditLevels();
});
elements.editRecordForm.addEventListener('submit', saveEditedRecord);
document.querySelectorAll('[data-close-edit]').forEach((button) => button.addEventListener('click', () => {
  editingId = null;
  editingLevel = null;
  elements.editRecordDialog.close();
}));
elements.navButtons.forEach((button) => button.addEventListener('click', () => showView(button.dataset.view)));
document.querySelector('#edit-prompts-button').addEventListener('click', () => {
  renderPromptEditor();
  elements.promptDialog.showModal();
});
document.querySelector('[data-close-dialog]').addEventListener('click', () => elements.promptDialog.close());
elements.promptForm.addEventListener('submit', savePrompts);
document.querySelector('#reset-prompts').addEventListener('click', () => {
  if (!confirm('把十条提示词全部恢复为默认内容？')) return;
  prompts = [...DEFAULT_PROMPTS];
  renderPromptEditor();
  showToast('已恢复默认内容，点击保存即可生效');
});
document.querySelector('#previous-day').addEventListener('click', () => moveStatsDay(-1));
elements.nextDay.addEventListener('click', () => moveStatsDay(1));
elements.statsDateInput.addEventListener('change', () => {
  if (!elements.statsDateInput.value) return;
  statsDate = elements.statsDateInput.value;
  renderChart();
});
elements.chart.addEventListener('pointerdown', showChartPoint);

const resizeObserver = new ResizeObserver(() => {
  if (!elements.statsView.hidden) renderChart();
});
resizeObserver.observe(elements.chartWrap);
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) {
    renderHome();
    if (statsDate > dateKey(new Date())) statsDate = dateKey(new Date());
    showView('record');
  }
});
window.addEventListener('pageshow', () => showView('record'));

renderLevelButtons();
renderHome();
showView('record');
