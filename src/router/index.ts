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
      path: '/import',
      name: 'import',
      component: () => import('@/views/AdminImportView.vue')
    },
    {
      path: '/change-password',
      name: 'change-password',
      component: () => import('@/views/ChangePasswordView.vue')
    },
    {
      path: '/provision',
      name: 'provision',
      component: () => import('@/views/AdminProvisionView.vue')
    }
  ]
})

// Guard: lazily init the session once, then gate non-public routes on auth,
// and force managers with a temporary password to /change-password first.
router.beforeEach(async (to) => {
  const auth = useAuthStore()
  await auth.init()
  if (!to.meta.public && !auth.isAuthenticated) {
    return { name: 'login' }
  }
  if (to.name === 'login' && auth.isAuthenticated) {
    return { name: 'home' }
  }
  if (auth.isAuthenticated && auth.mustChangePassword && to.name !== 'change-password') {
    return { name: 'change-password' }
  }
  if (to.name === 'change-password' && auth.isAuthenticated && !auth.mustChangePassword) {
    return { name: 'home' }
  }
})

export default router
