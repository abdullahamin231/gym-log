import { dom } from './dom.js';
import { foodList, mealPlanDisplay } from './mealPlan.js';
import { saveState, state } from './storage.js';
import { uid } from './utils.js';

const FOODS = foodList;

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
  dom.openCalorieModalBtn?.addEventListener('click', openCalorieModal);
  dom.closeCalorieModalBtn?.addEventListener('click', closeCalorieModal);
  dom.calorieModal?.addEventListener('click', e => {
    if (e.target === dom.calorieModal) closeCalorieModal();
  });
  dom.calorieInput?.addEventListener('keydown', e => {
    if (e.key === 'Enter') addManualCalories();
  });
  dom.addCalorieConfirmBtn?.addEventListener('click', addManualCalories);
  dom.foodSelect?.addEventListener('change', renderFoodModalNutrition);
  dom.foodWeightInput?.addEventListener('input', renderFoodModalNutrition);
  dom.foodWeightInput?.addEventListener('keydown', e => {
    if (e.key === 'Enter') addSelectedFood();
  });
  dom.addFoodConfirmBtn?.addEventListener('click', addSelectedFood);
  dom.submitWalkBtn?.addEventListener('click', submitWalkBurn);

  [dom.walkGradeInput, dom.walkSpeedInput, dom.walkTimeInput].forEach(input => {
    input?.addEventListener('input', saveWalkDraft);
    input?.addEventListener('blur', saveWalkDraft);
    input?.addEventListener('keydown', e => {
      if (e.key === 'Enter') submitWalkBurn();
    });
  });
}

export function renderCalorieView() {
  const day = getToday();
  renderGoals();
  renderMealPlan();
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
    day = { id: uid(), date, foods: [], manualCalories: [], walk: { grade: '', speed: '', time: '', burned: 0 } };
    state.calorieDays.push(day);
    saveState();
  }
  day.foods ||= [];
  day.manualCalories ||= [];
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

function renderMealPlan() {
  if (!dom.mealPlanList) return;
  dom.mealPlanList.innerHTML = '';

  mealPlanDisplay.meals.forEach(meal => {
    const item = document.createElement('section');
    item.className = 'meal-plan-card';

    const header = document.createElement('div');
    header.className = 'meal-plan-card-head';

    const title = document.createElement('h3');
    title.textContent = meal.title;

    const macros = document.createElement('strong');
    macros.textContent = meal.macros;

    const add = document.createElement('button');
    add.className = 'btn ghost meal-plan-add';
    add.type = 'button';
    add.textContent = 'Add';
    add.addEventListener('click', () => addMealPlanEntry(meal.title, meal.macroTotals));

    const ingredients = document.createElement('ul');
    ingredients.className = 'meal-plan-ingredients';
    meal.ingredients.forEach(ingredient => {
      const li = document.createElement('li');
      li.textContent = ingredient;
      ingredients.appendChild(li);
    });

    header.append(title, add);
    item.append(header, macros, ingredients);
    dom.mealPlanList.appendChild(item);
  });

  const misc = document.createElement('section');
  misc.className = 'meal-plan-card meal-plan-misc';

  const miscHeader = document.createElement('div');
  miscHeader.className = 'meal-plan-card-head';

  const miscTitle = document.createElement('h3');
  miscTitle.textContent = mealPlanDisplay.misc.title;

  const miscMacros = document.createElement('strong');
  miscMacros.textContent = mealPlanDisplay.misc.macros;

  const miscAdd = document.createElement('button');
  miscAdd.className = 'btn ghost meal-plan-add';
  miscAdd.type = 'button';
  miscAdd.textContent = 'Add';
  miscAdd.addEventListener('click', () => addMealPlanEntry(mealPlanDisplay.misc.title, mealPlanDisplay.misc.macroTotals));

  const miscNote = document.createElement('p');
  miscNote.textContent = `${mealPlanDisplay.misc.ingredients.join(', ')}. ${mealPlanDisplay.misc.note}`;

  const total = document.createElement('div');
  total.className = 'meal-plan-total';
  total.textContent = `Daily total: ${mealPlanDisplay.dailyTotal}`;

  miscHeader.append(miscTitle, miscAdd);
  misc.append(miscHeader, miscMacros, miscNote, total);
  dom.mealPlanList.appendChild(misc);
}

function addMealPlanEntry(label, macros) {
  const day = getToday();
  day.manualCalories.push({
    id: uid(),
    label,
    calories: Number(macros.calories) || 0,
    protein: Number(macros.protein) || 0,
    carbs: Number(macros.carbs) || 0,
    fats: Number(macros.fats) || 0
  });
  saveState();
  renderCalorieView();
}

function renderFoodList(day) {
  if (!dom.foodList) return;
  dom.foodList.innerHTML = '';
  if (!day.foods.length && !(day.manualCalories || []).length) {
    dom.foodList.innerHTML = '<div class="muted">No food logged today.</div>';
    return;
  }

  day.foods.forEach(entry => {
    const food = findFood(entry.foodId);
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
  (day.manualCalories || []).forEach(entry => {
    const item = document.createElement('div');
    item.className = 'logged-food';
    const label = document.createElement('span');
    const hasMacros = [entry.protein, entry.carbs, entry.fats].some(value => Number(value) > 0);
    label.textContent = entry.label || 'Manual calories';
    const calories = document.createElement('strong');
    calories.textContent = hasMacros
      ? `${round(entry.calories)} cal | ${round(entry.protein)}p / ${round(entry.carbs)}c / ${round(entry.fats)}f`
      : `${round(entry.calories)} cal`;
    const remove = document.createElement('button');
    remove.className = 'btn ghost danger';
    remove.type = 'button';
    remove.textContent = 'Remove';
    remove.addEventListener('click', () => {
      day.manualCalories = day.manualCalories.filter(e => e.id !== entry.id);
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
  const food = findFood(dom.foodSelect?.value) || FOODS[0];
  const grams = Number(dom.foodWeightInput?.value) || food.unit;
  const totals = scaleFood(food, grams);
  dom.foodModalNutrition.textContent =
    `${round(totals.calories)} cal | ${round(totals.protein)}p / ${round(totals.carbs)}c / ${round(totals.fats)}f`;
}

function openCalorieModal() {
  if (!dom.calorieModal || !dom.calorieInput) return;
  dom.calorieInput.value = '';
  dom.calorieModal.classList.remove('hidden');
  dom.calorieInput?.focus();
}

function closeCalorieModal() {
  dom.calorieModal?.classList.add('hidden');
}

function addManualCalories() {
  const day = getToday();
  const calories = Number(dom.calorieInput?.value);
  if (!Number.isFinite(calories) || calories <= 0) return;
  day.manualCalories.push({ id: uid(), calories });
  saveState();
  closeCalorieModal();
  renderCalorieView();
}

function addSelectedFood() {
  const day = getToday();
  const food = findFood(dom.foodSelect?.value);
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
  if (dom.walkTimeInput && document.activeElement !== dom.walkTimeInput) dom.walkTimeInput.value = formatWalkMinutes(day.walk.time);
  if (dom.walkWeightLabel) dom.walkWeightLabel.textContent = `(${round(latestWeightKg())}kg)`;
  const pendingBurn = calculateWalkBurn(day.walk);
  if (dom.walkBurnedResult) dom.walkBurnedResult.textContent = `${round(pendingBurn)} cal`;
  if (dom.submitWalkBtn) dom.submitWalkBtn.disabled = pendingBurn <= 0;
}

function saveWalkDraft() {
  const day = getToday();
  day.walk.grade = dom.walkGradeInput?.value.trim() || '';
  day.walk.speed = dom.walkSpeedInput?.value.trim() || '';
  day.walk.time = dom.walkTimeInput?.value.trim() || '';
  saveState();
  renderWalk(day);
}

function submitWalkBurn() {
  const day = getToday();
  day.walk.grade = dom.walkGradeInput?.value.trim() || '';
  day.walk.speed = dom.walkSpeedInput?.value.trim() || '';
  day.walk.time = dom.walkTimeInput?.value.trim() || '';
  const burned = calculateWalkBurn(day.walk);
  if (burned <= 0) return;
  day.walk.burned = (Number(day.walk.burned) || 0) + burned;
  day.walk.time = '';
  if (dom.walkTimeInput) dom.walkTimeInput.value = '';
  saveState();
  renderCalorieView();
}

function calculateWalkBurn(walk) {
  const grade = Number(walk.grade);
  const speedKmph = Number(walk.speed);
  const minutes = parseWalkMinutes(walk.time);
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

function parseWalkMinutes(raw) {
  const value = String(raw || '').trim();
  if (!value) return 0;
  if (!value.includes(':')) return Number(value);
  const [mins, secs] = value.split(':').map(part => Number(part));
  if (!Number.isFinite(mins) || !Number.isFinite(secs)) return 0;
  return mins + (secs / 60);
}

function formatWalkMinutes(raw) {
  const minutes = parseWalkMinutes(raw);
  return Number.isFinite(minutes) && minutes > 0 ? String(round(minutes)) : '';
}

function renderTotals(day) {
  const totals = calculateDayTotals(day);
  const calorieGoal = Number(state.calorieGoals.calories) || 1600;
  const proteinGoal = Number(state.calorieGoals.protein) || 150;
  const netCalories = totals.calories - (Number(day.walk?.burned) || 0);

  dom.calorieIntakeText.textContent = round(totals.calories);
  dom.calorieWalkText.textContent = round(day.walk?.burned || 0);
  dom.calorieNetText.textContent = round(netCalories);
  dom.calorieMacrosText.textContent = `${round(totals.protein)}p / ${round(totals.carbs)}c / ${round(totals.fats)}f`;

  const proteinPercent = proteinGoal > 0 ? (totals.protein / proteinGoal) * 100 : 0;
  const caloriePercent = calorieGoal > 0 ? (Math.abs(netCalories) / calorieGoal) * 100 : 0;
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
  const totals = (day.foods || []).reduce((totals, entry) => {
    const food = findFood(entry.foodId);
    if (!food) return totals;
    const scaled = scaleFood(food, Number(entry.grams) || 0);
    totals.calories += scaled.calories;
    totals.protein += scaled.protein;
    totals.carbs += scaled.carbs;
    totals.fats += scaled.fats;
    return totals;
  }, { calories: 0, protein: 0, carbs: 0, fats: 0 });
  (day.manualCalories || []).forEach(entry => {
    totals.calories += Number(entry.calories) || 0;
    totals.protein += Number(entry.protein) || 0;
    totals.carbs += Number(entry.carbs) || 0;
    totals.fats += Number(entry.fats) || 0;
  });
  return totals;
}

function scaleFood(food, grams) {
  const factor = grams / food.unit;
  return {
    calories: food.calories * factor,
    protein: food.protein * factor,
    carbs: food.carbs * factor,
    fats: food.fats * factor
  };
}

function findFood(foodId) {
  return FOODS.find(item => item.id === foodId);
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
    const net = totals.calories - burned;
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
