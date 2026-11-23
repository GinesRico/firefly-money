// The demo's Overview, top to bottom (six units across on a big screen): Activity (all history) and the insight banners;
// Net worth (5Y), Earned, Spent, Needs attention (wide), Safe to spend; Money personality, then the six ratings; Coming up, Cash and Credit cards; Daily spending,
// Budgets, Loans, Top payees; Money flow, Where it went, Income sources; Savings goals, Spending pace, Savings rate;
// the Money personality (wide) and the six rating cards in a row; then Cash flow and Recent transactions full width. Real installs keep the app's own defaults.
export const DEMO_DASH = {
  v: 3, units: 6,
  order: ['activity', 'insights', 'networth', 'earned', 'spent', 'attention', 'safe', 'scorecard', 'scSavings', 'scConsistency', 'scBills', 'scCushion', 'scTidiness', 'scDebt', 'bills', 'cash', 'cards', 'heatmap', 'budgets', 'loans', 'payees',
    'flow', 'spending', 'income', 'goals', 'pace', 'savings', 'cashflow', 'recent'],
  shown: ['scorecard', 'scSavings', 'scConsistency', 'scBills', 'scCushion', 'scTidiness', 'scDebt', 'cash', 'cards', 'heatmap', 'loans', 'payees', 'flow', 'income', 'goals', 'pace', 'savings', 'recent'], hidden: [] as string[],
  size: { activity: 'l', insights: 'l', networth: 's', earned: 's', spent: 's', attention: 'm', safe: 's', scorecard: 'l', scSavings: 's', scConsistency: 's', scBills: 's', scCushion: 's', scTidiness: 's', scDebt: 's', bills: 'm', cash: 'm', cards: 'm', heatmap: 'm', budgets: 's', loans: 's',
    payees: 'm', flow: 'm', spending: 'm', income: 'm', goals: 'm', pace: 'm', savings: 'm', cashflow: 'l', recent: 'l' },
  opts: { activity: { range: 'all' } },
};
