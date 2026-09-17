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
import { useToast } from '../../hooks/useToast'
import { useDialog } from '../../hooks/useDialog'

const empty = { name: '', phone: '', email: '', address: '', items: '' }

export default function SuppliersPage() {
  const toast = useToast()
  const { confirm } = useDialog()
  const [suppliers, setSuppliers] = useState([])
  const [query, setQuery] = useState('')
  const [form, setForm] = useState(empty)
  const [editing, setEditing] = useState(null)
  const [open, setOpen] = useState(false)
  const [message, setMessage] = useState('')

  const load = useCallback(async () => {
    try {
      const response = await getSuppliers({ q: query, limit: 100 })
      setSuppliers(response.data.data?.items ?? [])
      setMessage('')
    } catch (error) {
      const msg = error.response?.data?.message ?? 'Unable to load suppliers.'
      setMessage(msg)
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
      toast.success(editing ? 'Supplier updated' : 'Supplier created')
      await load()
    } catch (error) {
      const msg = error.response?.data?.message ?? 'Unable to save supplier.'
      setMessage(msg)
      toast.error(msg)
    }
  }

  async function remove(supplier) {
    const confirmed = await confirm({
      title: 'Deactivate Supplier',
      message: `Are you sure you want to deactivate "${supplier.name}"?`,
      confirmText: 'Deactivate Supplier',
      tone: 'danger',
    })
    if (!confirmed) return
    try {
      await deleteSupplier(supplier._id)
      toast.success('Supplier deactivated')
      await load()
    } catch (error) {
      const msg = error.response?.data?.message ?? 'Unable to deactivate supplier.'
      setMessage(msg)
      toast.error(msg)
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
              <h2 className="font-extrabold text-ink">{supplier.name}</h2>
              <p className="mt-2 text-xs text-muted">{supplier.contact?.phone}</p>
              <p className="text-xs text-muted">{supplier.contact?.email || 'No email'}</p>
              <p className="mt-2 text-[10px] text-slate-400">
                {supplier.items_supplied?.join(', ') || 'No supplied items listed'}
              </p>
              <div className="mt-4 flex gap-2">
                <Button onClick={() => edit(supplier)}>
                  <Edit3 className="size-3.5" /> Edit
                </Button>
                <Button onClick={() => remove(supplier)}>
                  <Trash2 className="size-3.5 text-rose-500" /> Deactivate
                </Button>
              </div>
            </article>
          ))}
          {suppliers.length === 0 && (
            <p className="py-12 text-center text-xs text-muted col-span-full">No suppliers found.</p>
          )}
        </div>
      </Panel>

      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4 backdrop-blur-xs">
          <Panel className="w-full max-w-lg p-6 shadow-2xl">
            <h2 className="mb-4 text-lg font-extrabold text-ink">
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
                <label key={key} className="grid gap-1 text-xs font-bold text-ink">
                  {label}
                  <input
                    className="rounded-xl border border-line p-3 font-normal bg-white focus:border-sky-500 focus:outline-hidden"
                    value={form[key]}
                    onChange={(event) => setForm({ ...form, [key]: event.target.value })}
                    required={['name', 'phone', 'items'].includes(key)}
                  />
                </label>
              ))}
              <div className="mt-2 flex justify-end gap-2">
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
