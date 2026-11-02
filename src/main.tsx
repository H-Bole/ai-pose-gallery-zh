import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createRouter, RouterProvider } from '@tanstack/react-router'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ThemeProvider } from '@/components/theme/ThemeProvider'
import { StudioProvider } from '@/store/studioStore'
import { routeTree } from './routeTree.gen'
import './index.css'
import './notifications.css'
import './card-effects.css'
import './gallery-feedback.css'
import { MotionProvider } from '@/components/motion/MotionProvider'

// 仅个人生产站启用统计，避免本地预览和其他 fork 污染数据。
if (import.meta.env.PROD && window.location.hostname === 'pose.boledev.dpdns.org') {
  const beacon = document.createElement('script')
  beacon.type = 'module'
  beacon.src = 'https://static.cloudflareinsights.com/beacon.min.js'
  beacon.dataset.cfBeacon = JSON.stringify({ token: '13fede9120554c5985b735736ab03002' })
  document.head.append(beacon)
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: Infinity,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})

const router = createRouter({
  routeTree,
  context: { queryClient },
  defaultPreload: 'intent',
  defaultPreloadStaleTime: 0,
  scrollRestoration: true,
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
  interface StaticDataRouteOption {
    title?: string
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <MotionProvider><StudioProvider>
          <RouterProvider router={router} />
        </StudioProvider></MotionProvider>
      </QueryClientProvider>
    </ThemeProvider>
  </StrictMode>
)
