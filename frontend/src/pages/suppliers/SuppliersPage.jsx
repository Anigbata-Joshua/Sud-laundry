import { useCallback, useEffect, useState } from 'react'
import { Edit3, Plus, Trash2 } from 'lucide-react'
import {
  createSupplier,
  deleteSupplier,
  getSuppliers,
  updateSupplier,
} from '../../api/suppliers.api'
import Button from '../../components/common/Button'
import PageHeading from '../../components/common/PageHeading'
import Panel from '../../components/common/Panel'
import SearchInput from '../../components/common/SearchInput'
import { useDialog } from '../../hooks/useDialog'
import { useToast } from '../../hooks/useToast'

const empty = { name: '', phone: '', email: '', address: '', items: '' }
export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState([])
  const [query, setQuery] = useState('')
  const [form, setForm] = useState(empty)
  const [editing, setEditing] = useState(null)
  const [open, setOpen] = useState(false)
  const [message, setMessage] = useState('')
  const { confirm } = useDialog()
  const { notify } = useToast()

  const load = useCallback(async () => {
    try {
      const response = await getSuppliers({ q: query, limit: 100 })
      setSuppliers(response.data.data?.items ?? [])
    } catch (error) {
      setMessage(error.response?.data?.message ?? 'Unable to load suppliers.')
    }
  }, [query])
  useEffect(() => {
    const timer = setTimeout(load, 250)
    return () => clearTimeout(timer)
  }, [load])
  function edit(supplier = null) {
    setEditing(supplier)
    setForm(
      supplier
        ? {
            name: supplier.name,
            phone: supplier.contact?.phone ?? '',
            email: supplier.contact?.email ?? '',
            address: supplier.contact?.address ?? '',
            items: supplier.items_supplied?.join(', ') ?? '',
          }
        : empty,
    )
    setOpen(true)
  }
  async function submit(event) {
    event.preventDefault()
    const payload = {
      name: form.name,
      contact: { phone: form.phone, email: form.email, address: form.address },
      items_supplied: form.items
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean),
    }
    try {
      if (editing) await updateSupplier(editing._id, payload)
      else await createSupplier(payload)
      setOpen(false)
      await load()
    } catch (error) {
      setMessage(error.response?.data?.message ?? 'Unable to save supplier.')
    }
  }
  async function remove(supplier) {
    const ok = await confirm(`"${supplier.name}" will no longer appear in the catalog.`, {
      title: 'Deactivate supplier?',
      tone: 'warning',
      confirmLabel: 'Deactivate',
    })

    if (!ok) return
    try {
      await deleteSupplier(supplier._id)
      notify({
        tone: 'success',
        title: 'Supplier removed',
        message: `${supplier.name} no longer has supplier access.`,
      })
      load()
    } catch (error) {
      notify({
        tone: 'error',
        title: 'Failed to remove supplier',
        message: error.response?.data?.message ?? 'Unable to remove supplier.',
      })
    }
  }
  return (
    <>
      <PageHeading
        eyebrow="Inventory"
        title="Suppliers"
        subtitle="Manage company supplier records."
      >
        <Button primary onClick={() => edit()}>
          <Plus className="size-4" /> Add supplier
        </Button>
      </PageHeading>
      {message && <p className="mb-3 rounded-lg bg-red-50 p-3 text-xs text-red-700">{message}</p>}
      <Panel className="overflow-hidden">
        <div className="border-b border-line p-4">
          <SearchInput
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search suppliers…"
            className="max-w-sm"
          />
        </div>
        <div className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-3">
          {suppliers.map((supplier) => (
            <article key={supplier._id} className="rounded-xl border border-line p-4">
              <h2 className="font-extrabold">{supplier.name}</h2>
              <p className="mt-2 text-xs text-gray-500">{supplier.contact?.phone}</p>
              <p className="text-xs text-gray-500">{supplier.contact?.email || 'No email'}</p>
              <p className="mt-2 text-[10px] text-gray-400">
                {supplier.items_supplied?.join(', ') || 'No supplied items listed'}
              </p>
              <div className="mt-4 flex gap-2">
                <Button onClick={() => edit(supplier)}>
                  <Edit3 className="size-3.5" /> Edit
                </Button>
                <Button onClick={() => remove(supplier)}>
                  <Trash2 className="size-3.5" /> Deactivate
                </Button>
              </div>
            </article>
          ))}
        </div>
      </Panel>
      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
          <Panel className="w-full max-w-lg p-6">
            <h2 className="mb-4 text-lg font-extrabold">
              {editing ? 'Edit supplier' : 'New supplier'}
            </h2>
            <form className="grid gap-3" onSubmit={submit}>
              {[
                ['Name', 'name'],
                ['Phone', 'phone'],
                ['Email', 'email'],
                ['Address', 'address'],
                ['Items supplied (comma-separated)', 'items'],
              ].map(([label, key]) => (
                <label key={key} className="grid gap-1 text-xs font-bold">
                  {label}
                  <input
                    className="rounded-xl border border-line p-3 font-normal"
                    value={form[key]}
                    onChange={(event) => setForm({ ...form, [key]: event.target.value })}
                    required={['name', 'phone', 'items'].includes(key)}
                  />
                </label>
              ))}
              <div className="flex justify-end gap-2">
                <Button onClick={() => setOpen(false)}>Cancel</Button>
                <Button primary type="submit">
                  Save
                </Button>
              </div>
            </form>
          </Panel>
        </div>
      )}
    </>
  )
}
