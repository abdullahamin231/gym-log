import { dom } from './dom.js';
import { saveState, state } from './storage.js';
import { uid } from './utils.js';

const FOODS = [
  { id: 'eggs', name: 'Eggs', unit: '100g', calories: 143, protein: 12.6, carbs: 0.7, fats: 9.5 },
  { id: 'chicken-breast-raw', name: 'Chicken breast uncooked', unit: '100g', calories: 120, protein: 22.5, carbs: 0, fats: 2.6 },
  { id: 'boiled-basmati-rice', name: 'Boiled basmati rice', unit: '100g', calories: 121, protein: 2.0, carbs: 27, fats: 0.3 },
  { id: 'cooking-oil', name: 'Oil', unit: '1g', calories: 9, protein: 0, carbs: 0, fats: 1 }
];

export function initCalorieView() {
  dom.proteinGoalInput?.addEventListener('blur', saveGoals);
  dom.calorieGoalInput?.addEventListener('blur', saveGoals);
  dom.proteinGoalInput?.addEventListener('keydown', blurOnEnter);
  dom.calorieGoalInput?.addEventListener('keydown', blurOnEnter);
  dom.openFoodModalBtn?.addEventListener('click', openFoodModal);
  dom.closeFoodModalBtn?.addEventListener('click', closeFoodModal);
  dom.foodModal?.addEventListener('click', e => {
    if (e.target === dom.foodModal) closeFoodModal();
  });
  dom.foodSelect?.addEventListener('change', renderFoodModalNutrition);
  dom.foodWeightInput?.addEventListener('input', renderFoodModalNutrition);
  dom.foodWeightInput?.addEventListener('keydown', e => {
    if (e.key === 'Enter') addSelectedFood();
  });
  dom.addFoodConfirmBtn?.addEventListener('click', addSelectedFood);

  [dom.walkGradeInput, dom.walkSpeedInput, dom.walkTimeInput].forEach(input => {
    input?.addEventListener('input', saveWalkBurn);
    input?.addEventListener('blur', saveWalkBurn);
  });
}

export function renderCalorieView() {
  const day = getToday();
  renderGoals();
  renderFoodList(day);
  renderWalk(day);
  renderTotals(day);
  renderHistory();
}

function blurOnEnter(e) {
  if (e.key === 'Enter') e.currentTarget.blur();
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function getToday() {
  const date = todayKey();
  let day = state.calorieDays.find(entry => entry.date === date);
  if (!day) {
    day = { id: uid(), date, foods: [], walk: { grade: '', speed: '', time: '', burned: 0 } };
    state.calorieDays.push(day);
    saveState();
  }
  day.foods ||= [];
  day.walk ||= { grade: '', speed: '', time: '', burned: 0 };
  return day;
}

function renderGoals() {
  if (dom.proteinGoalInput && document.activeElement !== dom.proteinGoalInput) {
    dom.proteinGoalInput.value = Math.round(Number(state.calorieGoals.protein) || 150);
  }
  if (dom.calorieGoalInput && document.activeElement !== dom.calorieGoalInput) {
    dom.calorieGoalInput.value = Math.round(Number(state.calorieGoals.calories) || 1600);
  }
}

function saveGoals() {
  const protein = Number(dom.proteinGoalInput?.value);
  const calories = Number(dom.calorieGoalInput?.value);
  if (Number.isFinite(protein) && protein > 0) state.calorieGoals.protein = Math.round(protein);
  if (Number.isFinite(calories) && calories > 0) state.calorieGoals.calories = Math.round(calories);
  saveState();
  renderCalorieView();
}

function renderFoodList(day) {
  if (!dom.foodList) return;
  dom.foodList.innerHTML = '';
  if (!day.foods.length) {
    dom.foodList.innerHTML = '<div class="muted">No food logged today.</div>';
    return;
  }

  day.foods.forEach(entry => {
    const food = FOODS.find(item => item.id === entry.foodId);
    if (!food) return;
    const item = document.createElement('div');
    item.className = 'logged-food';
    const totals = scaleFood(food, entry.grams);
    const label = document.createElement('span');
    label.textContent = `${food.name} | ${round(entry.grams)}g`;
    const calories = document.createElement('strong');
    calories.textContent = `${round(totals.calories)} cal`;
    const remove = document.createElement('button');
    remove.className = 'btn ghost danger';
    remove.type = 'button';
    remove.textContent = 'Remove';
    remove.addEventListener('click', () => {
      day.foods = day.foods.filter(foodEntry => foodEntry.id !== entry.id);
      saveState();
      renderCalorieView();
    });
    item.append(label, calories, remove);
    dom.foodList.appendChild(item);
  });
}

function openFoodModal() {
  renderFoodOptions();
  dom.foodWeightInput.value = '';
  renderFoodModalNutrition();
  dom.foodModal?.classList.remove('hidden');
  dom.foodSelect?.focus();
}

function closeFoodModal() {
  dom.foodModal?.classList.add('hidden');
}

function renderFoodOptions() {
  if (!dom.foodSelect || dom.foodSelect.options.length === FOODS.length) return;
  dom.foodSelect.innerHTML = '';
  FOODS.forEach(food => {
    const option = document.createElement('option');
    option.value = food.id;
    option.textContent = food.name;
    dom.foodSelect.appendChild(option);
  });
}

function renderFoodModalNutrition() {
  if (!dom.foodModalNutrition) return;
  const food = FOODS.find(item => item.id === dom.foodSelect?.value) || FOODS[0];
  const grams = Number(dom.foodWeightInput?.value) || (food.unit === '1g' ? 1 : 100);
  const totals = scaleFood(food, grams);
  dom.foodModalNutrition.textContent =
    `${round(totals.calories)} cal | ${round(totals.protein)}p / ${round(totals.carbs)}c / ${round(totals.fats)}f`;
}

function addSelectedFood() {
  const day = getToday();
  const food = FOODS.find(item => item.id === dom.foodSelect?.value);
  const grams = Number(dom.foodWeightInput?.value);
  if (!food || !Number.isFinite(grams) || grams <= 0) return;
  day.foods.push({ id: uid(), foodId: food.id, grams });
  saveState();
  closeFoodModal();
  renderCalorieView();
}

function renderWalk(day) {
  if (dom.walkGradeInput && document.activeElement !== dom.walkGradeInput) dom.walkGradeInput.value = day.walk.grade ?? '';
  if (dom.walkSpeedInput && document.activeElement !== dom.walkSpeedInput) dom.walkSpeedInput.value = day.walk.speed ?? '';
  if (dom.walkTimeInput && document.activeElement !== dom.walkTimeInput) dom.walkTimeInput.value = day.walk.time ?? '';
  if (dom.walkWeightLabel) dom.walkWeightLabel.textContent = `(${round(latestWeightKg())}kg)`;
  if (dom.walkBurnedResult) dom.walkBurnedResult.textContent = `${round(day.walk.burned || 0)} cal`;
}

function saveWalkBurn() {
  const day = getToday();
  day.walk.grade = dom.walkGradeInput?.value.trim() || '';
  day.walk.speed = dom.walkSpeedInput?.value.trim() || '';
  day.walk.time = dom.walkTimeInput?.value.trim() || '';
  day.walk.burned = calculateWalkBurn(day.walk);
  saveState();
  renderTotals(day);
  renderWalk(day);
  renderHistory();
}

function calculateWalkBurn(walk) {
  const grade = Number(walk.grade);
  const speedKmph = Number(walk.speed);
  const minutes = parseDuration(walk.time);
  const weightKg = latestWeightKg();
  if (![grade, speedKmph, minutes, weightKg].every(Number.isFinite) || speedKmph <= 0 || minutes <= 0 || weightKg <= 0) {
    return 0;
  }
  const speedMMin = (speedKmph * 1000) / 60;
  const vo2 = (0.1 * speedMMin) + (1.8 * speedMMin * (grade / 100)) + 3.5;
  return (vo2 * weightKg * 5 / 1000) * minutes;
}

function latestWeightKg() {
  const latest = state.weightEntries
    .slice()
    .sort((a, b) => String(b.date).localeCompare(String(a.date)))[0];
  return Number(latest?.weight) || 70;
}

function parseDuration(raw) {
  const value = String(raw || '').trim();
  if (!value) return 0;
  if (!value.includes(':')) return Number(value) || 0;
  const [mins, secs] = value.split(':').map(part => Number(part));
  if (!Number.isFinite(mins) || !Number.isFinite(secs)) return 0;
  return mins + (secs / 60);
}

function renderTotals(day) {
  const totals = calculateDayTotals(day);
  const calorieGoal = Number(state.calorieGoals.calories) || 1600;
  const proteinGoal = Number(state.calorieGoals.protein) || 150;
  const netCalories = Math.max(0, totals.calories - (day.walk?.burned || 0));

  dom.calorieIntakeText.textContent = round(totals.calories);
  dom.calorieWalkText.textContent = round(day.walk?.burned || 0);
  dom.calorieNetText.textContent = round(netCalories);
  dom.calorieMacrosText.textContent = `${round(totals.protein)}p / ${round(totals.carbs)}c / ${round(totals.fats)}f`;

  const proteinPercent = proteinGoal > 0 ? (totals.protein / proteinGoal) * 100 : 0;
  const caloriePercent = calorieGoal > 0 ? (netCalories / calorieGoal) * 100 : 0;
  const proteinColor = proteinPercent >= 90 ? '#31c96f' : '#d93838';
  const calorieColor = getCalorieColor(netCalories, calorieGoal);

  dom.proteinProgressBar.style.width = `${Math.min(100, proteinPercent)}%`;
  dom.proteinProgressBar.style.background = proteinColor;
  dom.calorieProgressBar.style.width = `${Math.min(100, caloriePercent)}%`;
  dom.calorieProgressBar.style.background = calorieColor;
  dom.proteinProgressText.textContent = `${round(totals.protein)}g / ${round(proteinGoal)}g`;
  dom.calorieProgressText.textContent = `${round(netCalories)} / ${round(calorieGoal)}`;
}

function getCalorieColor(calories, goal) {
  if (calories <= goal) return '#31c96f';
  const overRatio = Math.min(1, (calories - goal) / goal);
  const hue = 120 - (120 * overRatio);
  return `hsl(${hue} 72% 48%)`;
}

function calculateDayTotals(day) {
  return (day.foods || []).reduce((totals, entry) => {
    const food = FOODS.find(item => item.id === entry.foodId);
    if (!food) return totals;
    const scaled = scaleFood(food, Number(entry.grams) || 0);
    totals.calories += scaled.calories;
    totals.protein += scaled.protein;
    totals.carbs += scaled.carbs;
    totals.fats += scaled.fats;
    return totals;
  }, { calories: 0, protein: 0, carbs: 0, fats: 0 });
}

function scaleFood(food, grams) {
  const divisor = food.unit === '1g' ? 1 : 100;
  const factor = grams / divisor;
  return {
    calories: food.calories * factor,
    protein: food.protein * factor,
    carbs: food.carbs * factor,
    fats: food.fats * factor
  };
}

function renderHistory() {
  if (!dom.calorieHistoryList) return;
  const today = todayKey();
  const entries = state.calorieDays
    .filter(day => day.date !== today)
    .slice()
    .sort((a, b) => String(b.date).localeCompare(String(a.date)));

  dom.calorieHistoryList.innerHTML = '';
  if (!entries.length) {
    dom.calorieHistoryList.innerHTML = '<li class="muted" style="list-style:none">No previous calorie days.</li>';
    return;
  }

  entries.forEach(day => {
    const totals = calculateDayTotals(day);
    const burned = Number(day.walk?.burned) || 0;
    const net = Math.max(0, totals.calories - burned);
    const li = document.createElement('li');
    li.className = 'calorie-history-item';
    li.textContent = `${day.date}: ${round(net)} (${round(totals.protein)}p / ${round(totals.carbs)}c / ${round(totals.fats)}f)${burned > 0 ? ` - walk burned: ${round(burned)}` : ''}`;
    dom.calorieHistoryList.appendChild(li);
  });
}

function round(value) {
  const number = Number(value) || 0;
  return Math.round(number * 10) / 10;
}
