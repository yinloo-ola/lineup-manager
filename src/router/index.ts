import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: () => import('@/views/LoginView.vue'),
      meta: { public: true }
    },
    {
      path: '/',
      name: 'home',
      component: () => import('@/views/AdminHomeView.vue')
    },
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
      path: '/admin/lineups',
      name: 'admin-lineups',
      component: () => import('@/views/AdminLineupsView.vue'),
      meta: { adminOnly: true }
    },
    {
      path: '/import',
      name: 'import',
      component: () => import('@/views/AdminImportView.vue'),
      meta: { adminOnly: true }
    },
    {
      path: '/change-password',
      name: 'change-password',
      component: () => import('@/views/ChangePasswordView.vue')
    },
    {
      path: '/provision',
      name: 'provision',
      component: () => import('@/views/AdminProvisionView.vue'),
      meta: { adminOnly: true }
    },
    {
      path: '/format',
      name: 'format',
      component: () => import('@/views/AuthorTieFormatView.vue'),
      meta: { adminOnly: true }
    },
    {
      path: '/manage',
      name: 'manage',
      component: () => import('@/views/AdminManageView.vue'),
      meta: { adminOnly: true }
    }
  ]
})

// Guard: init the session once, gate non-public routes on auth, force managers
// with a temporary password to /change-password first, and keep managers on
// /manager (admin pages are admin-only).
router.beforeEach(async (to) => {
  const auth = useAuthStore()
  await auth.init()

  if (!to.meta.public && !auth.isAuthenticated) {
    return { name: 'login' }
  }

  if (to.name === 'login' && auth.isAuthenticated) {
    return { name: auth.mustChangePassword ? 'change-password' : auth.isManager ? 'manager' : 'home' }
  }

  if (auth.isAuthenticated && auth.mustChangePassword && to.name !== 'change-password') {
    return { name: 'change-password' }
  }

  if (auth.isAuthenticated && !auth.mustChangePassword) {
    if (auth.isManager && (to.name === 'home' || to.meta.adminOnly)) return { name: 'manager' }
    if (!auth.isManager && to.name === 'manager') {
      return { name: 'home' }
    }
    if (to.name === 'change-password') return { name: auth.isManager ? 'manager' : 'home' }
  }

  return undefined
})

export default router
