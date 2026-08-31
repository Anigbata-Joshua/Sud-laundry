// Working shell template: this is the initial operations experience; move feature routes into src/routes as they mature.
import { useState } from 'react'
import { Bell, ChevronDown, LayoutDashboard, Menu, Package, Shirt, Users, X } from 'lucide-react'
import { Link, NavLink, Route, Routes } from 'react-router-dom'
import './App.css'

const navigation = [
  { label: 'Overview', path: '/', icon: LayoutDashboard },
  { label: 'Orders', path: '/orders', icon: Shirt },
  { label: 'Inventory', path: '/products', icon: Package },
  { label: 'Team', path: '/employees', icon: Users },
]

function Dashboard() {
  return (
    <div className="dashboard-grid">
      <section className="welcome-panel">
        <p className="eyebrow">Tuesday, 25 August 2026</p>
        <h1>Good morning, manager.</h1>
        <p>Here is the pulse of your laundry operation today.</p>
        <Link className="primary-button" to="/orders">Review orders</Link>
      </section>
      <section className="metric-grid" aria-label="Operations summary">
        <article className="metric-card"><span>Orders today</span><strong>128</strong><small className="positive">+12.4%</small></article>
        <article className="metric-card"><span>Ready for pickup</span><strong>36</strong><small>Across 3 branches</small></article>
        <article className="metric-card"><span>Low stock items</span><strong>08</strong><small className="warning">Needs attention</small></article>
      </section>
      <section className="activity-panel">
        <div className="section-heading"><div><p className="eyebrow">Live activity</p><h2>Recent orders</h2></div><Link to="/orders">View all</Link></div>
        <div className="activity-row"><span className="order-mark">LN</span><div><strong>LN-1048</strong><p>Wash & fold · Downtown</p></div><span className="status ready">Ready</span></div>
        <div className="activity-row"><span className="order-mark peach">AM</span><div><strong>LN-1047</strong><p>Dry cleaning · Westside</p></div><span className="status processing">Processing</span></div>
        <div className="activity-row"><span className="order-mark blue">RK</span><div><strong>LN-1046</strong><p>Express service · Downtown</p></div><span className="status awaiting">Awaiting pickup</span></div>
      </section>
      <section className="insight-panel"><p className="eyebrow">This week</p><h2>Keep the floor moving.</h2><p>Orders are up across every branch. Stock up on detergent before tomorrow's morning run.</p><Link to="/stock-movements">Open inventory</Link></section>
    </div>
  )
}

function PlaceholderPage({ title }) {
  return <section className="placeholder-page"><p className="eyebrow">Workspace</p><h1>{title}</h1><p>This feature area is ready for its API and workflow implementation.</p></section>
}

function App() {
  const [menuOpen, setMenuOpen] = useState(false)
  return (
    <div className="app-shell">
      <aside className={menuOpen ? 'sidebar open' : 'sidebar'}>
        <div className="brand"><span className="brand-mark">L</span><span>Linen & Loop</span><button className="icon-button close-menu" onClick={() => setMenuOpen(false)} aria-label="Close menu"><X size={20} /></button></div>
        <p className="nav-label">Manage</p>
        <nav>{navigation.map(({ label, path, icon: Icon }) => <NavLink key={path} to={path} end={path === '/'} onClick={() => setMenuOpen(false)}><Icon size={18} />{label}</NavLink>)}</nav>
        <p className="nav-label secondary-label">Workspace</p>
        <nav>{['Services', 'Branches', 'Payments', 'Reports'].map((label) => <NavLink key={label} to={`/${label.toLowerCase()}`} onClick={() => setMenuOpen(false)}><span className="nav-dot" />{label}</NavLink>)}</nav>
        <div className="sidebar-footer"><div className="avatar">JD</div><div><strong>Jordan Davis</strong><small>Administrator</small></div><ChevronDown size={16} /></div>
      </aside>
      <main className="main-content">
        <header className="topbar"><button className="icon-button menu-button" onClick={() => setMenuOpen(true)} aria-label="Open menu"><Menu size={21} /></button><div className="breadcrumb">Operations <span>/</span> <strong>Overview</strong></div><div className="topbar-actions"><button className="icon-button" aria-label="Notifications"><Bell size={20} /></button><div className="top-avatar">JD</div></div></header>
        <div className="page-content"><Routes><Route path="/" element={<Dashboard />} />{['orders', 'products', 'employees', 'services', 'branches', 'payments', 'reports', 'stock-movements'].map((path) => <Route key={path} path={`/${path}`} element={<PlaceholderPage title={path.replace('-', ' ')} />} />)}</Routes></div>
      </main>
    </div>
  )
}

export default App
