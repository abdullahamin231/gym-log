export const hardcodedProgram = {
  name: 'program',
  days: [
    {
      name: 'Upper 1',
      blocks: [
        [{ name: 'Incline Bench', sets: 3, target: 8, display: '2-3 sets 4-8 reps' }, { name: 'DB Row', sets: 2, target: 12, display: '2 sets 8-12 reps' }],
        [{ name: 'Pec Deck', sets: 3, target: 12, display: '3 sets 8-12 reps' }, { name: 'Back Row Machine', sets: 3, target: 12, display: '3 sets 8-12 reps' }],
        [{ name: 'DB OHP', sets: 2, target: 12, display: '2 sets 8-12 reps' }, { name: 'EZ Bar Curls', sets: 2, targets: [4, 12], display: '30kgx4, 25kgx12' }],
        [{ name: 'Machine Triceps Extension', sets: 3, target: 12, display: '3 sets 8-12 reps' }, { name: 'Ab Crunches', sets: 3, target: 12, display: '3x8-12' }]
      ]
    },
    {
      name: 'Lower',
      blocks: [
        [{ name: 'Barbell Squats', sets: 2, target: 8, display: '2 sets 4-8 reps' }, { name: 'Hammer Curls', sets: 3, target: 12, display: '3 sets 8-12 reps' }],
        [{ name: 'RDL', sets: 2, target: 8, display: '2 sets 4-8 reps' }, { name: 'Ab Crunches', sets: 2, target: 8, display: '2 sets 4-8 reps' }],
        [{ name: 'Quad Isolation', sets: 4, target: 20, display: '3-4x15-20' }, { name: 'Neck Extensions', sets: 4, target: 20, display: '3-4x15-20' }]
      ]
    },
    {
      name: 'Arms',
      blocks: [
        [{ name: 'Close Grip Bench', sets: 3, target: 8, display: '2-3 sets 4-8 reps' }, { name: 'DB Pullovers', sets: 3, target: 8, display: '2-3 sets 4-8 reps' }],
        [{ name: 'Skull-crushers', sets: 3, target: 12, display: '2-3 sets 8-12 reps' }, { name: 'EZ Bar Curls', sets: 3, target: 12, display: '2-3 sets 8-12 reps' }],
        [{ name: 'Hammer Curls', sets: 3, target: 12, display: '2-3 sets 8-12 reps' }, { name: 'Upright Rows', sets: 3, target: 12, display: '2-3 sets 8-12 reps' }],
        [{ name: 'Ab Crunches', sets: 3, target: 12, display: '3 sets 8-12 reps' }]
      ]
    },
    {
      name: 'Upper 2',
      subtitle: 'Back focused',
      blocks: [
        [{ name: 'Incline Bench Press', sets: 3, target: 8, display: '2-3 sets 4-8 reps' }],
        [{ name: 'DB Rows', sets: 2, target: 12, display: '2 sets 8-12 reps' }, { name: 'Back Row Machine', sets: 3, target: 12, display: '3 sets 8-12 reps' }],
        [{ name: 'Pullups', sets: 3, target: 0, display: '3 sets AMRAP' }, { name: 'Triceps Pushdowns', sets: 2, targets: [7, 6], display: '14px7, 6' }],
        [{ name: 'Bicep Curls', sets: 3, target: 12, display: '2-3 sets 8-12 reps' }, { name: 'Ab Crunches', sets: 2, targets: [10, 8], display: '5p x10, 8' }],
        [{ name: 'Cable Lateral Raises', sets: 3, target: 15, display: '3 sets 8-15' }]
      ]
    }
  ]
};
