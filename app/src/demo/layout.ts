// The demo's Overview, top to bottom (six units across on a big screen), as in the reference screen recording: Activity (all history) and the insight banners;
// Money personality, Net worth, Earned, Spent, Heads up (Safe to spend) and Needs attention in one row; Budgets full width; Cash, Credit cards, Coming up;
// Where it went, Top payees, Income sources; Category trends, Loans, Savings goals; Spending pace, Money flow, Cash flow; Recent transactions full width;
// then Daily spending, Subscriptions and Savings rate. No rating cards. Real installs keep the app's own defaults.
export const DEMO_DASH = {
  v: 3, units: 6,
  order: ['activity', 'insights', 'scorecard', 'networth', 'earned', 'spent', 'safe', 'attention', 'budgets', 'cash', 'cards', 'bills', 'spending', 'payees', 'income', 'trends', 'loans', 'goals', 'pace', 'flow', 'cashflow', 'recent', 'heatmap', 'subs', 'savings'],
  shown: ['scorecard', 'cash', 'cards', 'heatmap', 'loans', 'payees', 'flow', 'income', 'goals', 'pace', 'savings', 'recent', 'trends', 'subs'], hidden: [] as string[],
  size: { activity: 'l', insights: 'l', scorecard: 's', networth: 's', earned: 's', spent: 's', safe: 's', attention: 's', budgets: 'l', cash: 'm', cards: 'm', bills: 'm', spending: 'm', payees: 'm', income: 'm', trends: 'm', loans: 'm', goals: 'm',
    pace: 'm', flow: 'm', cashflow: 'm', recent: 'l', heatmap: 's', subs: 's', savings: 'm' },
  opts: { activity: { range: 'all' } },
};
