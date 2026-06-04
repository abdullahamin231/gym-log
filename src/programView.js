import { hardcodedProgram } from './defaultProgram.js';
import { dom } from './dom.js';

export function renderPrograms() {
  renderHardcodedProgramSheet();
}

function renderHardcodedProgramSheet() {
  if (!dom.hardcodedProgramSheet) return;
  dom.hardcodedProgramSheet.innerHTML = '';

  const title = document.createElement('div');
  title.className = 'program-sheet-title';
  title.textContent = hardcodedProgram.name;
  dom.hardcodedProgramSheet.appendChild(title);

  hardcodedProgram.days.forEach(day => {
    const section = document.createElement('section');
    section.className = 'program-day';

    const heading = document.createElement('div');
    heading.className = 'program-day-heading';
    const name = document.createElement('h3');
    name.textContent = day.name;
    heading.appendChild(name);
    if (day.subtitle) {
      const subtitle = document.createElement('span');
      subtitle.textContent = day.subtitle;
      heading.appendChild(subtitle);
    }
    section.appendChild(heading);

    day.blocks.forEach(block => {
      const row = document.createElement('div');
      row.className = 'program-block';
      block.forEach(item => {
        const cell = document.createElement('div');
        cell.className = 'program-prescription';
        const exercise = document.createElement('strong');
        exercise.textContent = item.name;
        const prescription = document.createElement('span');
        prescription.textContent = item.display;
        cell.append(exercise, prescription);
        row.appendChild(cell);
      });
      section.appendChild(row);
    });

    dom.hardcodedProgramSheet.appendChild(section);
  });
}
