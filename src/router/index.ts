import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router';
import { useAuthStore } from '../stores/auth';

const routes: RouteRecordRaw[] = [
  { path: '/login', name: 'login', component: () => import('../views/auth/LoginView.vue'), meta: { public: true } },
  { path: '/register', name: 'register', component: () => import('../views/auth/RegisterView.vue'), meta: { public: true } },
  { path: '/two-factor', name: 'two-factor', component: () => import('../views/auth/TwoFactorView.vue'), meta: { public: true } },
  { path: '/', name: 'dashboard', component: () => import('../views/DashboardView.vue') },
  { path: '/section/personal', component: () => import('../views/sections/PersonalInfoSection.vue') },
  { path: '/section/income', component: () => import('../views/sections/IncomeSection.vue') },
  { path: '/section/interest-dividends', component: () => import('../views/sections/InterestDividendsSection.vue') },
  { path: '/section/self-employment', component: () => import('../views/sections/SelfEmploymentSection.vue') },
  { path: '/section/capital-gains', component: () => import('../views/sections/CapitalGainsSection.vue') },
  { path: '/section/retirement', component: () => import('../views/sections/RetirementSection.vue') },
  { path: '/section/ss-benefits', component: () => import('../views/sections/SsBenefitsSection.vue') },
  { path: '/section/unemployment', component: () => import('../views/sections/UnemploymentSection.vue') },
  { path: '/section/gambling', component: () => import('../views/sections/GamblingSection.vue') },
  { path: '/section/other-income', component: () => import('../views/sections/OtherIncomeSection.vue') },
  { path: '/section/schedule-e', component: () => import('../views/sections/ScheduleESection.vue') },
  { path: '/section/k1', component: () => import('../views/sections/K1Section.vue') },
  { path: '/section/schedule-f', component: () => import('../views/sections/ScheduleFSection.vue') },
  { path: '/section/form-4797', component: () => import('../views/sections/Form4797Section.vue') },
  { path: '/section/form-4562', component: () => import('../views/sections/Form4562Section.vue') },
  { path: '/section/form-8829', component: () => import('../views/sections/Form8829Section.vue') },
  { path: '/section/schedule-1-adjustments', component: () => import('../views/sections/Schedule1Section.vue') },
  { path: '/section/form-8606', component: () => import('../views/sections/Form8606Section.vue') },
  { path: '/section/form-8889', component: () => import('../views/sections/Form8889Section.vue') },
  { path: '/section/form-2441', component: () => import('../views/sections/Form2441Section.vue') },
  { path: '/section/form-8863', component: () => import('../views/sections/Form8863Section.vue') },
  { path: '/section/form-8880', component: () => import('../views/sections/Form8880Section.vue') },
  { path: '/section/schedule-r', component: () => import('../views/sections/ScheduleRSection.vue') },
  { path: '/section/form-8396', component: () => import('../views/sections/Form8396Section.vue') },
  { path: '/section/form-5695', component: () => import('../views/sections/Form5695Section.vue') },
  { path: '/section/form-8936', component: () => import('../views/sections/Form8936Section.vue') },
  { path: '/section/form-1116', component: () => import('../views/sections/Form1116Section.vue') },
  { path: '/section/schedule-8812', component: () => import('../views/sections/Schedule8812Section.vue') },
  { path: '/section/eitc', component: () => import('../views/sections/EitcSection.vue') },
  { path: '/section/form-8962', component: () => import('../views/sections/Form8962Section.vue') },
  { path: '/section/form-6251', component: () => import('../views/sections/Form6251Section.vue') },
  { path: '/section/form-8960', component: () => import('../views/sections/Form8960Section.vue') },
  { path: '/section/form-8959', component: () => import('../views/sections/Form8959Section.vue') },
  { path: '/section/form-2555', component: () => import('../views/sections/Form2555Section.vue') },
  { path: '/section/schedule-h', component: () => import('../views/sections/ScheduleHSection.vue') },
  { path: '/section/form-2210', component: () => import('../views/sections/Form2210Section.vue') },
  { path: '/section/form-5405', component: () => import('../views/sections/Form5405Section.vue') },
  { path: '/section/form-4972', component: () => import('../views/sections/Form4972Section.vue') },
  { path: '/section/deductions', component: () => import('../views/sections/DeductionsSection.vue') },
  { path: '/section/review', component: () => import('../views/sections/ReviewSection.vue') },
  { path: '/admin', name: 'admin', component: () => import('../views/admin/AdminView.vue'), meta: { admin: true } },
  {
    path: '/admin/tax-years/:year',
    name: 'admin-tax-year',
    component: () => import('../views/admin/TaxYearEditView.vue'),
    meta: { admin: true },
    props: true,
  },
  { path: '/:pathMatch(.*)*', redirect: '/' },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

let warmedUp = false;

router.beforeEach(async (to) => {
  const auth = useAuthStore();
  if (!warmedUp) {
    warmedUp = true;
    await auth.fetchMe();
  }
  if (to.meta.public) {
    // If already logged in, bounce away from auth pages.
    if (auth.user && (to.name === 'login' || to.name === 'register')) {
      return { path: '/' };
    }
    return true;
  }
  if (!auth.user) {
    return { name: 'login', query: { next: to.fullPath } };
  }
  if (to.meta.admin && !auth.user.isAdmin) {
    return { path: '/' };
  }
  return true;
});

export default router;
