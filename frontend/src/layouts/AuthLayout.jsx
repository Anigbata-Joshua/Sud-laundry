import { Outlet } from 'react-router-dom'

export default function AuthLayout() {
  return (
    <main className="grid min-h-screen bg-[#f7f7fb] lg:grid-cols-[1.05fr_0.95fr]">
      <Outlet />
    </main>
  )
}
