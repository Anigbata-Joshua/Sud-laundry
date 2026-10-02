import { ArrowLeft } from 'lucide-react'
import { Link } from 'react-router-dom'
import Button from '../components/common/Button'
import Panel from '../components/common/Panel'

export default function NotFoundPage() {
  return (
    <Panel className="mx-auto mt-20 max-w-lg p-10 text-center">
      <p className="text-xs font-extrabold uppercase tracking-widest text-brand">404</p>
      <h1 className="mt-3 text-2xl font-extrabold">Page not found</h1>
      <p className="mt-2 text-sm text-muted">
        The page may have moved or the address may be incorrect.
      </p>
      <Link className="mt-6 inline-block" to="/">
        <Button primary>
          <ArrowLeft className="size-4" /> Return to overview
        </Button>
      </Link>
    </Panel>
  )
}
