// unit is grams
export const foodDatabase = {
  chickenBreast: {
    label: "Chicken breast",
    unit: 100,
    macros: { calories: 120, protein: 22.5, carbs: 0, fats: 2.6 },
  },
  oil: {
    label: "Oil",
    unit: 1,
    macros: { calories: 9, protein: 0, carbs: 0, fats: 1 },
  },
  eggs: {
    label: "Eggs",
    unit: 100,
    macros: { calories: 147, protein: 12.5, carbs: 0.7, fats: 10 },
  },
  faujiOats: {
    label: "Fauji oats",
    unit: 30,
    macros: { calories: 116, protein: 2.6, carbs: 25.7, fats: 0.3 },
  },
  olpers: {
    label: "Olpers",
    unit: 100,
    macros: { calories: 64, protein: 2.7, carbs: 5.4, fats: 3.5 },
  },
  rice: {
    label: "Rice",
    unit: 100,
    macros: { calories: 130, protein: 2.7, carbs: 28, fats: 0.3 },
  },
};

export const foodList = Object.entries(foodDatabase).map(([id, food]) => ({
  id,
  name: food.label,
  unit: food.unit,
  ...food.macros,
}));

function addMacros(a, b) {
  return {
    calories: a.calories + b.calories,
    protein: a.protein + b.protein,
    carbs: a.carbs + b.carbs,
    fats: a.fats + b.fats,
  };
}

function scaleFood(foodName, weightInGrams) {
  const food = foodDatabase[foodName];
  if (!food) throw new Error(`Unknown food: ${foodName}`);

  const factor = weightInGrams / food.unit;

  return Object.fromEntries(
    Object.entries(food.macros).map(([k, v]) => [
      k,
      Math.round(v * factor * 100) / 100,
    ]),
  );
}

function sumMacros(items) {
  const totals = items.reduce((acc, item) => addMacros(acc, item.macros), {
    calories: 0,
    protein: 0,
    carbs: 0,
    fats: 0,
  });

  return roundMacros(totals);
}

function roundMacros(macros) {
  return Object.fromEntries(
    Object.entries(macros).map(([key, value]) => [
      key,
      Math.round(value * 100) / 100,
    ]),
  );
}

function ingredient(foodName, weight) {
  const food = foodDatabase[foodName];
  if (!food) throw new Error(`Unknown food: ${foodName}`);

  return {
    name: foodName,
    label: food.label,
    weight,
    macros: scaleFood(foodName, weight),
  };
}

const meals = {
  "chicken-and-rice": ({
    title,
    chickenWeight,
    riceWeight,
    oilWeight = 10,
  }) => {
    const parts = [
      ingredient("chickenBreast", chickenWeight),
      ingredient("rice", riceWeight),
      ingredient("oil", oilWeight),
    ];

    return {
      title,
      macros: sumMacros(parts),
      ingredients: parts,
    };
  },

  breakfast: ({ oatsWeight, olpersWeight }) => {
    const parts = [
      ingredient("faujiOats", oatsWeight),
      ingredient("olpers", olpersWeight),
    ];

    return {
      title: "Breakfast",
      macros: sumMacros(parts),
      ingredients: parts,
    };
  },
};

export const mealPlan = {
  misc: {
    title: "Daily misc",
    note: "3 eggs (cooked in 10g oil) are mixed into the rice and eaten across the day, so they are counted only in daily totals.",
    macros: addMacros(scaleFood("eggs", 150), scaleFood("oil", 10)),
    ingredients: [ingredient("eggs", 150), ingredient("oil", 10)],
  },
  breakfast: meals.breakfast({ oatsWeight: 30, olpersWeight: 200 }),
  lunch: meals["chicken-and-rice"]({
    title: "Lunch",
    chickenWeight: 200,
    riceWeight: 250,
    oilWeight: 10,
  }),
  dinner: meals["chicken-and-rice"]({
    title: "Dinner",
    chickenWeight: 300,
    riceWeight: 200,
    oilWeight: 10,
  }),
};

export const displayedMeals = [
  mealPlan.breakfast,
  mealPlan.lunch,
  mealPlan.dinner,
];

export const macros = sumMacros([
  mealPlan.misc,
  mealPlan.breakfast,
  mealPlan.lunch,
  mealPlan.dinner,
]);

function formatMacros({ calories, protein, carbs, fats }) {
  return `${calories} cal | ${protein}p / ${carbs}c / ${fats}f`;
}

function formatIngredient({ label, weight }) {
  return `${label} - ${weight}g`;
}

export const mealPlanDisplay = {
  meals: displayedMeals.map((meal) => ({
    title: meal.title,
    ingredients: meal.ingredients.map(formatIngredient),
    macroTotals: meal.macros,
    macros: formatMacros(meal.macros),
  })),
  misc: {
    title: mealPlan.misc.title,
    note: mealPlan.misc.note,
    ingredients: mealPlan.misc.ingredients.map(formatIngredient),
    macroTotals: mealPlan.misc.macros,
    macros: formatMacros(mealPlan.misc.macros),
  },
  dailyTotal: formatMacros(macros),
};
