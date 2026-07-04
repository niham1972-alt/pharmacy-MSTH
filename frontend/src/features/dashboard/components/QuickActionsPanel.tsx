import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../shared/auth/AuthContext';
import { QUICK_ACTIONS_BY_ROLE } from '../utils/rolePermissions';

const ACTION_ROUTES: Record<string, string> = {
  newSale: '/sales/new',
  newPurchase: '/purchases/new',
  addMedicine: '/medicines/new',
  addCustomer: '/customers/new',
};

export function QuickActionsPanel() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();

  const actions = (user ? QUICK_ACTIONS_BY_ROLE[user.role] : []) ?? [];
  if (actions.length === 0) return null;

  return (
    <section aria-labelledby="quick-actions-heading" className="rounded-lg border border-gray-200 dark:border-gray-800 p-4">
      <h2 id="quick-actions-heading" className="mb-3 text-sm font-semibold text-gray-900 dark:text-gray-100">
        {t('dashboard.quickActions.title')}
      </h2>
      <div className="flex flex-wrap gap-2">
        {actions.map((action) => (
          <button
            key={action}
            type="button"
            onClick={() => navigate(ACTION_ROUTES[action])}
            className="rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700"
          >
            {t(`dashboard.quickActions.${action}`)}
          </button>
        ))}
      </div>
    </section>
  );
}
