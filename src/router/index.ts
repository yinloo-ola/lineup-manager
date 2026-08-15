import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useTournamentStore } from '@/stores/tournament'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: () => import('@/views/LoginView.vue'),
      meta: { public: true }
    },
    // The admin shell (ticket #13 / spec §3): every admin page renders inside
    // the layout — rail + app bar. Old paths survive as aliases so existing
    // links and e2e navigation keep working; the labels "Home"/"Manage" are gone.
    {
      path: '/',
      component: () => import('@/views/AdminShellView.vue'),
      meta: { adminOnly: true },
      children: [
        { path: '', name: 'home', redirect: { name: 'matches' } },
        {
          path: 'matches',
          name: 'matches',
          component: () => import('@/views/AdminLineupsView.vue'),
          meta: { title: 'Matches' },
          alias: '/admin/lineups'
        },
        {
          path: 'setup',
          name: 'setup',
          component: () => import('@/views/SetupEmptyView.vue'),
          meta: { title: 'Getting started' }
        },
        {
          path: 'settings',
          name: 'settings',
          component: () => import('@/views/AdminManageView.vue'),
          meta: { title: 'Tournament settings' },
          alias: '/manage'
        },
        {
          path: 'formats',
          name: 'formats',
          component: () => import('@/views/AuthorTieFormatView.vue'),
          meta: { title: 'Team match formats' },
          alias: '/format'
        },
        {
          path: 'provision',
          name: 'provision',
          component: () => import('@/views/AdminProvisionView.vue'),
          meta: { title: 'Provision managers' },
          alias: '/provision'
        }
      ]
    },
    // The import page became the selector's dialog; keep the path working.
    { path: '/import', redirect: '/' },
    {
      path: '/manager',
      name: 'manager',
      component: () => import('@/views/ManagerView.vue')
    },
    {
      path: '/manager/tie/:tieId',
      name: 'lineup-builder',
      component: () => import('@/views/LineupBuilderView.vue')
    },
    {
      path: '/change-password',
      name: 'change-password',
      component: () => import('@/views/ChangePasswordView.vue')
    }
  ]
})

// Guard: init the session once, gate non-public routes on auth, force managers
// with a temporary password to /change-password first, keep managers on
// /manager (admin pages are admin-only), and land the admin setup-aware
// (spec §3): Matches when a tournament exists, the empty state when none does.
router.beforeEach(async (to) => {
  const auth = useAuthStore()
  await auth.init()

  if (!to.meta.public && !auth.isAuthenticated) {
    return { name: 'login' }
  }

  if (to.name === 'login' && auth.isAuthenticated) {
    return {
      name: auth.mustChangePassword
        ? 'change-password'
        : auth.isManager
          ? 'manager'
          : landingName()
    }
  }

  if (auth.isAuthenticated && auth.mustChangePassword && to.name !== 'change-password') {
    return { name: 'change-password' }
  }

  if (auth.isAuthenticated && !auth.mustChangePassword) {
    if (auth.isManager && (to.name === 'home' || to.meta.adminOnly)) return { name: 'manager' }
    if (!auth.isManager && (to.name === 'home' || to.name === 'manager')) {
      return { name: landingName() }
    }
    if (to.name === 'change-password') {
      return { name: auth.isManager ? 'manager' : landingName() }
    }
  }

  return undefined
})

/** The admin's landing destination: Matches with a tournament, setup without. */
function landingName(): 'matches' | 'setup' {
  return useTournamentStore().active ? 'matches' : 'setup'
}

export default router
