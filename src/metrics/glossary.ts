import type { TipContent } from '../components/ui/Tip';

/** Simple definitions shown in hover tips. Written for a high-school reader. */
export const GLOSSARY = {
  kpi: {
    title: 'Goal number',
    body: 'A score that shows how well students are doing. Higher (or hitting the goal) is good.',
  },
  kri: {
    title: 'Opportunities number',
    body: 'A score that flags a problem early — like a big gap between groups. You want these to stay small or quiet.',
  },
  leading: {
    title: 'Opportunities number',
    body: 'Moves before final grades are locked in. Use it to spot trouble early.',
  },
  smallCell: {
    title: 'Too few students to show',
    body: 'If a group has fewer than 20 students, we hide the number so no one can guess who the students are.',
  },
  moduleFilter: {
    title: 'Card filter',
    body: 'Narrows only this card. It cannot show more students than the filters at the top of the page.',
  },
  globalScope: {
    title: 'Who you are looking at',
    body: 'The students included by the filters at the top. Every chart and key number uses this same group.',
  },
} as const satisfies Record<string, TipContent>;
